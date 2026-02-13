import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import {
  Page,
  Content,
  ContentHeader,
  Progress,
  WarningPanel,
} from '@backstage/core-components';
import {
  alertApiRef,
  discoveryApiRef,
  fetchApiRef,
  identityApiRef,
  useApi,
  useRouteRef,
} from '@backstage/core-plugin-api';
import {
  Box,
  Button,
  Grid,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { alpha } from '@material-ui/core/styles/colorManipulator';
import RefreshIcon from '@material-ui/icons/Refresh';
import RocketLaunchIcon from '@material-ui/icons/Whatshot';
import { Skeleton } from '@material-ui/lab';
import { WorkloadDTO, isTerminalStatus, listWorkloads } from '../api/aegisClient';
import { keycloakAuthApiRef } from '../api/refs';
import { createWorkspaceRouteRef } from '../routes';
import { WorkloadCard } from './WorkloadCard';
import { isProvisioningStatus } from './WorkloadStatusIndicator';
import { demoWorkloads } from '../demoData';

const useStyles = makeStyles(theme => ({
  headerRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(2),
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filterRow: {
    marginTop: theme.spacing(2),
  },
  statsRow: {
    display: 'flex',
    gap: theme.spacing(2),
    marginTop: theme.spacing(1),
    color: theme.palette.text.secondary,
  },
  cardsGrid: {
    display: 'grid',
    gap: theme.spacing(2.5),
    marginTop: theme.spacing(3),
  },
  skeletonCard: {
    background: 'var(--aegis-card-surface)',
    border: '1px solid var(--aegis-card-border)',
    borderRadius: theme.shape.borderRadius * 2,
    padding: theme.spacing(3),
  },
  emptyState: {
    marginTop: theme.spacing(3),
    borderRadius: theme.shape.borderRadius * 2,
    border: '1px dashed var(--aegis-card-border)',
    padding: theme.spacing(6, 3),
    background: 'var(--aegis-card-surface)',
    textAlign: 'center',
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    margin: '0 auto',
    background: alpha(theme.palette.primary.main, 0.15),
    color: theme.palette.primary.main,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lastUpdated: {
    fontSize: theme.typography.pxToRem(12),
    color: theme.palette.text.secondary,
  },
  toolbar: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1.5),
    alignItems: 'center',
  },
}));

type WorkloadRow = WorkloadDTO & { displayStatus: string };

type StatusFilter = 'all' | 'active' | 'terminal';

const formatElapsed = (seconds: number): string => {
  if (seconds < 60) {
    return `${seconds}s ago`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

export const WorkloadListPage: FC = () => {
  const classes = useStyles();
  const fetchApi = useApi(fetchApiRef);
  const discoveryApi = useApi(discoveryApiRef);
  const identityApi = useApi(identityApiRef);
  const authApi = useApi(keycloakAuthApiRef);
  const alertApi = useApi(alertApiRef);
  const location = useLocation();
  const createWorkspaceLink = useRouteRef(createWorkspaceRouteRef);
  const createWorkspacePath = createWorkspaceLink();

  const [projectId, setProjectId] = useState(() => {
    const params = new URLSearchParams(location.search);
    return params.get('project') ?? 'p-demo';
  });
  const [rows, setRows] = useState<WorkloadRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const projectParam = params.get('project');
    const highlightParam = params.get('highlight');
    if (projectParam) {
      setProjectId(projectParam);
    }
    setHighlightId(highlightParam);
  }, [location.search]);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent ?? false;
      try {
        if (!silent) {
          setLoading(true);
        }
        setError(null);
        
        let items: WorkloadDTO[] = [];
        try {
          items = await listWorkloads(
            fetchApi,
            discoveryApi,
            identityApi,
            authApi,
            projectId,
          );
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn('Failed to load workloads from API, falling back to demo data', err);
          items = demoWorkloads;
        }
        
        const mapped: WorkloadRow[] = items.map(w => ({
          ...w,
          displayStatus: w.uiStatus ?? w.status ?? 'PLACED',
        }));
        setRows(mapped);
        setLastUpdated(new Date());
      } catch (e: any) {
        const msg = e?.message ?? String(e);
        setError(msg);
        alertApi.post({
          message: `Failed to load workloads: ${msg}`,
          severity: 'error',
        });
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [alertApi, projectId, fetchApi, discoveryApi, identityApi, authApi],
  );

  useEffect(() => {
    load();
  }, [load]);

  const filteredRows = useMemo(() => {
    return rows
      .filter(row => {
        if (!search) {
          return true;
        }
        return row.id?.toLowerCase().includes(search.toLowerCase()) ?? false;
      })
      .filter(row => {
        if (statusFilter === 'terminal') {
          return isTerminalStatus(row.status);
        }
        if (statusFilter === 'active') {
          return !isTerminalStatus(row.status);
        }
        return true;
      });
  }, [rows, search, statusFilter]);

  const shouldPoll = useMemo(
    () => filteredRows.some(row => isProvisioningStatus(row.status)),
    [filteredRows],
  );

  useEffect(() => {
    if (!shouldPoll) {
      return () => {};
    }
    const timer = setInterval(() => {
      load({ silent: true });
    }, 7000);
    return () => clearInterval(timer);
  }, [shouldPoll, load]);

  useEffect(() => {
    if (!highlightId) {
      return () => {};
    }
    const handle = window.setTimeout(() => {
      const element = document.getElementById(`workload-card-${highlightId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 200);
    return () => {
      window.clearTimeout(handle);
    };
  }, [highlightId, filteredRows]);

  const handleProjectChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setProjectId(event.target.value);
  };

  const handleStatusFilter = (event: React.ChangeEvent<{ value: unknown }>) => {
    setStatusFilter(event.target.value as StatusFilter);
  };

  const activeCount = rows.filter(r => !isTerminalStatus(r.status)).length;
  const completedCount = rows.filter(r => isTerminalStatus(r.status)).length;

  const lastUpdatedLabel = lastUpdated
    ? formatElapsed(Math.floor((now - lastUpdated.getTime()) / 1000))
    : '—';

  return (
    <Page themeId="tool">
      <Content>
        <ContentHeader title="Workload Status">
          <Typography variant="body1" color="textSecondary">
            Monitor submitted workspaces, track provisioning progress, and connect once ready.
          </Typography>
        </ContentHeader>

        <Box className={classes.headerRow}>
          <Typography variant="h5">Filters</Typography>
          <Box className={classes.toolbar}>
            <Typography className={classes.lastUpdated}>
              Last updated: {lastUpdatedLabel}
            </Typography>
            <Button
              variant="outlined"
              size="small"
              startIcon={<RefreshIcon />}
              onClick={() => load()}
            >
              Refresh
            </Button>
            <Button
              variant="contained"
              color="primary"
              component={RouterLink}
              to={createWorkspacePath}
            >
              Launch Workspace
            </Button>
          </Box>
        </Box>

        <Grid container spacing={2} alignItems="flex-end" className={classes.filterRow}>
          <Grid item xs={12} md={4}>
            <TextField
              label="Project ID"
              fullWidth
              value={projectId}
              onChange={handleProjectChange}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              label="Search by Workload ID"
              fullWidth
              value={search}
              onChange={event => setSearch(event.target.value)}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <Select
              fullWidth
              value={statusFilter}
              onChange={handleStatusFilter}
              displayEmpty
              inputProps={{ 'aria-label': 'Status filter' }}
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="terminal">Terminal</MenuItem>
            </Select>
          </Grid>
        </Grid>

        <Box className={classes.statsRow}>
          <Typography variant="body2">Active: {activeCount}</Typography>
          <Typography variant="body2">Completed: {completedCount}</Typography>
        </Box>

        {loading && rows.length > 0 ? <Progress /> : null}

        {error ? (
          <Box mt={2}>
            <WarningPanel title="Failed to load workloads" severity="error">
              {error}
              <Box mt={2}>
                <Button variant="outlined" onClick={() => load()}>
                  Retry
                </Button>
              </Box>
            </WarningPanel>
          </Box>
        ) : null}

        {!loading && !error && filteredRows.length === 0 ? (
          <Box className={classes.emptyState}>
            <Box className={classes.emptyIcon}>
              <RocketLaunchIcon />
            </Box>
            <Typography variant="h6" gutterBottom>
              No workspaces yet
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Launch your first GPU workspace and we will keep you updated on provisioning.
            </Typography>
            <Box mt={2}>
              <Button
                variant="contained"
                color="primary"
                component={RouterLink}
                to={createWorkspacePath}
              >
                Launch your first workspace
              </Button>
            </Box>
          </Box>
        ) : null}

        {loading && rows.length === 0 ? (
          <Box className={classes.cardsGrid}>
            {[0, 1, 2].map(item => (
              <Box key={item} className={classes.skeletonCard}>
                <Skeleton variant="rect" height={28} width="40%" />
                <Box mt={2}>
                  <Skeleton variant="rect" height={18} width="60%" />
                </Box>
                <Box mt={2}>
                  <Skeleton variant="rect" height={80} />
                </Box>
                <Box mt={2} display="flex" gridGap={12}>
                  <Skeleton variant="rect" height={32} width={140} />
                  <Skeleton variant="rect" height={32} width={100} />
                </Box>
              </Box>
            ))}
          </Box>
        ) : null}

        {filteredRows.length > 0 ? (
          <Box className={classes.cardsGrid}>
            {filteredRows.map(row => (
              <WorkloadCard
                key={row.id ?? row.displayStatus}
                workload={row}
                highlight={row.id === highlightId}
              />
            ))}
          </Box>
        ) : null}
      </Content>
    </Page>
  );
};