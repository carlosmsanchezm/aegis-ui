import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Page,
  Content,
  ContentHeader,
  HeaderLabel,
  Table,
  TableColumn,
  WarningPanel,
} from '@backstage/core-components';
import {
  discoveryApiRef,
  fetchApiRef,
  identityApiRef,
  useApi,
} from '@backstage/core-plugin-api';
import { keycloakAuthApiRef } from '../api/refs';
import { ApiError, listProjects, ProjectRecord } from '../api/aegisClient';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Typography,
  makeStyles,
} from '@material-ui/core';
import SecurityIcon from '@material-ui/icons/Security';

const useStyles = makeStyles(theme => ({
  layout: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(4),
  },
  card: {
    backgroundColor: 'var(--aegis-card-surface)',
    border: `1px solid var(--aegis-card-border)`,
    borderRadius: theme.shape.borderRadius,
    boxShadow: 'var(--aegis-card-shadow)',
    padding: theme.spacing(3),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(3),
  },
  chipRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing(6),
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: theme.spacing(2),
    padding: theme.spacing(6, 2),
    textAlign: 'center',
  },
  iconWrapper: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 64,
    height: 64,
    borderRadius: '50%',
    backgroundColor:
      theme.palette.type === 'dark'
        ? 'rgba(96, 165, 250, 0.15)'
        : 'rgba(79, 70, 229, 0.1)',
  },
}));

type PolicyProjectRow = {
  id: string;
  displayName: string;
  regions: string;
  dataLevel: string;
  denyEgress: string;
};

const projectToPolicyRow = (project: ProjectRecord): PolicyProjectRow => ({
  id: project.id,
  displayName: project.displayName || project.id,
  regions: project.policy?.regions?.join(', ') || 'Not configured',
  dataLevel: project.policy?.dataLevel || 'Not configured',
  denyEgress:
    project.policy?.denyEgressByDefault === true
      ? 'Denied by default'
      : project.policy?.denyEgressByDefault === false
      ? 'Allowed'
      : 'Not configured',
});

export const AegisPolicyManagementPage: FC = () => {
  const classes = useStyles();
  const fetchApi = useApi(fetchApiRef);
  const discoveryApi = useApi(discoveryApiRef);
  const identityApi = useApi(identityApiRef);
  const authApi = useApi(keycloakAuthApiRef);

  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const response = await listProjects(fetchApi, discoveryApi, identityApi, authApi);
      setProjects(response.items ?? []);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'Failed to load projects from Platform API';
      setLoadError(message);
    } finally {
      setLoading(false);
    }
  }, [fetchApi, discoveryApi, identityApi, authApi]);

  useEffect(() => {
    load();
  }, [load]);

  const policyRows = useMemo(
    () => projects.map(projectToPolicyRow),
    [projects],
  );

  const policyColumns = useMemo<TableColumn<PolicyProjectRow>[]>(
    () => [
      { title: 'Project ID', field: 'id' },
      { title: 'Display Name', field: 'displayName' },
      {
        title: 'Allowed Regions',
        field: 'regions',
        render: row => (
          <div className={classes.chipRow}>
            {row.regions === 'Not configured' ? (
              <Typography variant="body2" color="textSecondary">
                Not configured
              </Typography>
            ) : (
              row.regions.split(', ').map(region => (
                <Chip key={region} label={region} size="small" color="primary" />
              ))
            )}
          </div>
        ),
      },
      {
        title: 'Data Classification',
        field: 'dataLevel',
        render: row =>
          row.dataLevel === 'Not configured' ? (
            <Typography variant="body2" color="textSecondary">
              Not configured
            </Typography>
          ) : (
            <Chip label={row.dataLevel} size="small" />
          ),
      },
      {
        title: 'Egress Policy',
        field: 'denyEgress',
        render: row => (
          <Chip
            label={row.denyEgress}
            size="small"
            color={row.denyEgress === 'Denied by default' ? 'secondary' : 'default'}
          />
        ),
      },
    ],
    [classes.chipRow],
  );

  return (
    <Page themeId="tool">
      <Content>
        <ContentHeader title="Policy Management">
          <HeaderLabel label="Administration" value="Compliance policies" />
        </ContentHeader>
        <div className={classes.layout}>
          {loadError && (
            <WarningPanel severity="error" title="Failed to load projects">
              {loadError}
              <Box mt={2}>
                <Button variant="outlined" onClick={load}>
                  Retry
                </Button>
              </Box>
            </WarningPanel>
          )}

          <Paper className={classes.card}>
            <Typography variant="h6">Project compliance policies</Typography>
            <Typography variant="body2" color="textSecondary">
              Policy domains are configured per project and enforced at workload submission time.
              Each project can define allowed regions, data classification levels, and egress
              restrictions.
            </Typography>
            {loading ? (
              <Box className={classes.loadingContainer}>
                <CircularProgress />
              </Box>
            ) : policyRows.length === 0 && !loadError ? (
              <div className={classes.emptyState}>
                <div className={classes.iconWrapper}>
                  <SecurityIcon color="primary" style={{ fontSize: 32 }} />
                </div>
                <Typography variant="h6" color="textSecondary">
                  No projects with policies
                </Typography>
                <Typography variant="body2" color="textSecondary" style={{ maxWidth: 480 }}>
                  No projects have been created yet. Create a project with compliance
                  policies using the platform API to see policy configurations here.
                </Typography>
              </div>
            ) : (
              <Table
                options={{ paging: false, search: true, padding: 'dense' }}
                data={policyRows}
                columns={policyColumns}
              />
            )}
          </Paper>

          <WarningPanel severity="info" title="Policy editing coming soon">
            Policy updates are not yet available from this page. To modify project policies,
            use the project management API (<code>PUT /api/v1/projects</code>) or the project
            creation form. A dedicated policy editor will be available in a future release.
          </WarningPanel>
        </div>
      </Content>
    </Page>
  );
};
