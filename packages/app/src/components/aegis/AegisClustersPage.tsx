import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import {
  Content,
  ContentHeader,
  Page,
  Progress,
  WarningPanel,
} from '@backstage/core-components';
import {
  alertApiRef,
  discoveryApiRef,
  fetchApiRef,
  identityApiRef,
  useApi,
} from '@backstage/core-plugin-api';
import { keycloakAuthApiRef } from '../../apis';
import {
  ClusterSummary,
  listClusters,
  listProjects,
  ProjectRecord,
} from '../../../../../plugins/aegis/src/api/aegisClient';

const useStyles = makeStyles(theme => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(3),
    paddingBottom: theme.spacing(6),
  },
  actionRow: {
    display: 'flex',
    gap: theme.spacing(1.5),
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
  },
  filters: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: theme.spacing(1.5),
  },
  filterCard: {
    borderRadius: theme.shape.borderRadius * 1.5,
    border: `1px solid ${theme.palette.divider}`,
    padding: theme.spacing(1.5),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  },
  filterLabel: {
    textTransform: 'uppercase',
    fontSize: '0.7rem',
    letterSpacing: '0.14em',
    color: theme.palette.text.secondary,
  },
  filterSelect: {
    width: '100%',
    padding: '10px',
    borderRadius: 12,
    border: '1px solid rgba(148, 163, 184, 0.4)',
    background: 'transparent',
    color: 'inherit',
  },
  tablePaper: {
    borderRadius: theme.shape.borderRadius * 2,
    border: `1px solid ${theme.palette.divider}`,
    overflow: 'hidden',
  },
  table: {
    '& th': {
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      fontSize: '0.75rem',
      color: theme.palette.text.secondary,
    },
  },
  clickableRow: {
    cursor: 'pointer',
  },
}));

type ClusterFilterState = { projectId: string; region: string; phase: string };

const initialFilters: ClusterFilterState = { projectId: 'all', region: 'all', phase: 'all' };

const formatTimestamp = (raw?: string) => {
  if (!raw) {
    return '—';
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return raw;
  }
  return parsed.toLocaleString();
};

const phaseChipColor = (phase?: string): 'default' | 'primary' | 'secondary' => {
  const normalized = (phase ?? '').toLowerCase();
  if (normalized === 'ready') {
    return 'primary';
  }
  if (normalized === 'error' || normalized === 'degraded' || normalized === 'unhealthy') {
    return 'secondary';
  }
  return 'default';
};

export const AegisClustersPage = () => {
  const classes = useStyles();
  const navigate = useNavigate();
  const alertApi = useApi(alertApiRef);
  const fetchApi = useApi(fetchApiRef);
  const discoveryApi = useApi(discoveryApiRef);
  const identityApi = useApi(identityApiRef);
  const authApi = useApi(keycloakAuthApiRef);

  const [filters, setFilters] = useState(initialFilters);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [clusters, setClusters] = useState<ClusterSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [projectsResponse, clusterItems] = await Promise.all([
        listProjects(fetchApi, discoveryApi, identityApi, authApi),
        listClusters(fetchApi, discoveryApi, identityApi, authApi),
      ]);
      setProjects(projectsResponse?.items ?? []);
      setClusters(clusterItems ?? []);
    } catch (err: any) {
      const message =
        typeof err?.message === 'string' ? err.message : 'Failed to load clusters';
      setError(message);
      alertApi.post({ message, severity: 'error' });
    } finally {
      setLoading(false);
    }
  }, [alertApi, authApi, discoveryApi, fetchApi, identityApi]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const projectNameById = useMemo(() => {
    const map = new Map<string, string>();
    projects.forEach(project => {
      map.set(project.id, project.displayName || project.id);
    });
    return map;
  }, [projects]);

  const filterOptions = useMemo(() => {
    const regions = new Set<string>();
    const phases = new Set<string>();
    clusters.forEach(cluster => {
      if (cluster.region) {
        regions.add(cluster.region);
      }
      if (cluster.phase) {
        phases.add(cluster.phase);
      }
    });
    return {
      regions: Array.from(regions).sort(),
      phases: Array.from(phases).sort(),
    };
  }, [clusters]);

  const filteredClusters = useMemo(() => {
    return (clusters ?? []).filter(cluster => {
      if (filters.projectId !== 'all' && cluster.projectId !== filters.projectId) {
        return false;
      }
      if (filters.region !== 'all' && cluster.region !== filters.region) {
        return false;
      }
      if (filters.phase !== 'all' && cluster.phase !== filters.phase) {
        return false;
      }
      return true;
    });
  }, [clusters, filters.phase, filters.projectId, filters.region]);

  return (
    <Page themeId="tool">
      <Content className={classes.root}>
        <ContentHeader title="Clusters">
          <Chip color="primary" label={`${filteredClusters.length} clusters`} />
          <div className={classes.actionRow}>
            <Button variant="outlined" onClick={refresh} disabled={loading}>
              Refresh
            </Button>
            <Button
              variant="contained"
              color="primary"
              onClick={() => navigate('/aegis/create/clusters')}
            >
              Create cluster
            </Button>
          </div>
        </ContentHeader>

        {loading ? <Progress /> : null}
        {error ? (
          <WarningPanel title="Unable to load clusters">{error}</WarningPanel>
        ) : null}

        <div className={classes.filters}>
          {(
            [
              ['projectId', 'Project'],
              ['region', 'Region'],
              ['phase', 'Phase'],
            ] as Array<[keyof ClusterFilterState, string]>
          ).map(([key, label]) => (
            <div key={key} className={classes.filterCard}>
              <span className={classes.filterLabel}>{label}</span>
              <select
                aria-label={label}
                value={filters[key]}
                onChange={event =>
                  setFilters(prev => ({
                    ...prev,
                    [key]: event.target.value,
                  }))
                }
                className={classes.filterSelect}
              >
                <option value="all">All</option>
                {key === 'projectId'
                  ? projects.map(project => (
                      <option key={project.id} value={project.id}>
                        {project.displayName ? `${project.displayName} (${project.id})` : project.id}
                      </option>
                    ))
                  : key === 'region'
                    ? filterOptions.regions.map(value => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))
                    : filterOptions.phases.map(value => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
              </select>
            </div>
          ))}
        </div>

        <Paper className={classes.tablePaper}>
          <Table className={classes.table}>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Project</TableCell>
                <TableCell>Provider</TableCell>
                <TableCell>Region</TableCell>
                <TableCell>Phase</TableCell>
                <TableCell>Created</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredClusters.map(cluster => (
                <TableRow
                  key={cluster.id}
                  hover
                  className={classes.clickableRow}
                  onClick={() => navigate(`/aegis/clusters/${encodeURIComponent(cluster.id)}`)}
                >
                  <TableCell>
                    <Typography variant="subtitle1">{cluster.name || cluster.id}</Typography>
                    <Typography variant="body2" color="textSecondary">
                      {cluster.id}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {projectNameById.get(cluster.projectId) || cluster.projectId || '—'}
                  </TableCell>
                  <TableCell>{cluster.provider || '—'}</TableCell>
                  <TableCell>{cluster.region || '—'}</TableCell>
                  <TableCell>
                    <Chip
                      label={cluster.phase || 'Unknown'}
                      color={phaseChipColor(cluster.phase)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{formatTimestamp(cluster.createdAt)}</TableCell>
                </TableRow>
              ))}
              {!loading && filteredClusters.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6}>
                    <Box paddingY={4} textAlign="center">
                      <Typography variant="subtitle1">No clusters found</Typography>
                      <Typography variant="body2" color="textSecondary">
                        Create a cluster or adjust your filters.
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </Paper>
      </Content>
    </Page>
  );
};
