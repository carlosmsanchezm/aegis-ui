import React, { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Page,
  Content,
  ContentHeader,
  EmptyState,
  Progress,
  Table,
  TableColumn,
  WarningPanel,
} from '@backstage/core-components';
import {
  alertApiRef,
  discoveryApiRef,
  fetchApiRef,
  identityApiRef,
  useApi,
} from '@backstage/core-plugin-api';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControl,
  FormHelperText,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import {
  AuthenticationError,
  AuthorizationError,
  createCluster,
  getClusterJobStatus,
} from '../api/aegisClient';
import { keycloakAuthApiRef } from '../api/refs';
import { useProvisioningCatalog } from '../hooks/useProvisioningCatalog';
import {
  ProjectDefinition,
  ProjectVisibility,
  visibilityCopy,
} from './projects/projectCatalog';

const useStyles = makeStyles(theme => ({
  layout: {
    display: 'grid',
    gridTemplateColumns: 'minmax(360px, 1fr) minmax(420px, 1.4fr)',
    gap: theme.spacing(3),
    [theme.breakpoints.down('md')]: {
      gridTemplateColumns: '1fr',
    },
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  },
  actionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
    flexWrap: 'wrap',
  },
  progressSection: {
    marginTop: theme.spacing(2),
  },
  progressLabel: {
    marginTop: theme.spacing(1),
  },
  selectMenu: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.25),
  },
  panel: {
    borderRadius: theme.shape.borderRadius,
    border: `1px solid var(--aegis-card-border)`,
    backgroundColor: 'var(--aegis-card-surface)',
    boxShadow: 'var(--aegis-card-shadow)',
  },
  panelHeader: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
    marginBottom: theme.spacing(2),
  },
  tableWrapper: {
    borderRadius: theme.shape.borderRadius,
    overflow: 'hidden',
    border: `1px solid var(--aegis-card-border)`,
  },
  clusterMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    color: theme.palette.text.secondary,
    fontSize: theme.typography.pxToRem(13),
  },
}));

const JOB_STORAGE_KEY = 'aegis.clusterJobState';
const POLL_INTERVAL_MS = 5000;

const isTerminalStatus = (status?: string | null): boolean => {
  if (!status) {
    return false;
  }
  const normalized = status.toUpperCase();
  return (
    normalized === 'SUCCEEDED' ||
    normalized === 'SUCCESS' ||
    normalized === 'COMPLETED' ||
    normalized === 'FAILED' ||
    normalized === 'CANCELLED' ||
    normalized === 'CANCELED'
  );
};

type StoredClusterJob = {
  jobId: string;
  projectId: string;
  clusterId: string;
  provider: string;
  region: string;
};

const normalizeVisibility = (value?: string | null): ProjectVisibility => {
  if (value === 'restricted' || value === 'internal' || value === 'public') {
    return value;
  }
  return 'internal';
};

type ClusterRow = {
  id: string;
  displayName: string;
  projectId: string;
  provider: string;
  region: string;
  status: string;
  createdAt?: string;
};

const clusterColumns: TableColumn<ClusterRow>[] = [
  { title: 'Cluster', field: 'displayName' },
  { title: 'Project', field: 'projectId' },
  { title: 'Provider', field: 'provider' },
  { title: 'Region', field: 'region' },
  { title: 'Status', field: 'status' },
  {
    title: 'Created',
    field: 'createdAt',
    render: row => (row.createdAt ? new Date(row.createdAt).toLocaleString() : '—'),
  },
];

export const CreateClusterPage: FC = () => {
  const classes = useStyles();
  const fetchApi = useApi(fetchApiRef);
  const discoveryApi = useApi(discoveryApiRef);
  const identityApi = useApi(identityApiRef);
  const authApi = useApi(keycloakAuthApiRef);
  const alertApi = useApi(alertApiRef);
  const {
    value: catalog,
    loading: catalogLoading,
    error: catalogError,
    retry: reloadCatalog,
  } = useProvisioningCatalog();

  const [form, setForm] = useState({
    projectId: '',
    clusterId: '',
    provider: 'aws',
    region: 'us-east-1',
  });
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [jobError, setJobError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const pollerRef = useRef<ReturnType<typeof setInterval>>();

  const jobActive = Boolean(jobId && !isTerminalStatus(jobStatus));

  const projects = useMemo<ProjectDefinition[]>(() => {
    if (!catalog) {
      return [];
    }
    return catalog.projects.map(project => ({
      id: project.id,
      name: project.name ?? project.id,
      visibility: normalizeVisibility(project.visibility),
      description: project.description ?? 'No project description provided.',
      lead: project.lead ?? 'Unassigned',
      budget: {
        monthlyLimit: project.budget?.monthlyLimit ?? 0,
        monthlyUsed: project.budget?.monthlyUsed ?? 0,
      },
      defaultQueue: project.defaultQueueId ?? '',
      queues: [],
    }));
  }, [catalog]);

  const clusters = useMemo<ClusterRow[]>(() => {
    if (!catalog) {
      return [];
    }
    return catalog.clusters.map(cluster => ({
      id: cluster.id,
      displayName: cluster.displayName ?? cluster.id,
      projectId: cluster.projectId,
      provider: cluster.provider ?? '—',
      region: cluster.region ?? '—',
      status: cluster.status ?? '—',
      createdAt: cluster.createdAt,
    }));
  }, [catalog]);

  const clustersForProject = useMemo(
    () => clusters.filter(cluster => cluster.projectId === form.projectId),
    [clusters, form.projectId],
  );

  const selectedProject = useMemo(
    () => projects.find(project => project.id === form.projectId) ?? null,
    [projects, form.projectId],
  );

  const noProjectsAvailable = !catalogLoading && projects.length === 0;

  const handleFormFieldChange =
    (field: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) => {
      setForm(prev => ({ ...prev, [field]: event.target.value }));
    };

  const handleProjectSelect = (
    event: React.ChangeEvent<{ value: unknown }>,
  ) => {
    const projectId = (event.target.value as string) ?? '';
    setForm(prev => ({ ...prev, projectId }));
  };

  useEffect(() => {
    if (projects.length === 0) {
      setForm(prev => ({ ...prev, projectId: '' }));
      return;
    }
    setForm(prev => {
      if (prev.projectId && projects.some(project => project.id === prev.projectId)) {
        return prev;
      }
      return { ...prev, projectId: projects[0].id };
    });
  }, [projects]);

  const clearPoller = useCallback(() => {
    if (pollerRef.current) {
      clearInterval(pollerRef.current);
      pollerRef.current = undefined;
    }
  }, []);

  const clearStoredJob = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(JOB_STORAGE_KEY);
    }
  }, []);

  const persistStoredJob = useCallback((state: StoredClusterJob) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(JOB_STORAGE_KEY, JSON.stringify(state));
    }
  }, []);

  const handleTerminalJob = useCallback(
    (status: string | null | undefined, errorMessage?: string | null) => {
      if (isTerminalStatus(status)) {
        clearPoller();
        clearStoredJob();
        if (status && status.toUpperCase().startsWith('SUCC')) {
          alertApi.post({
            message: 'Cluster deployment completed successfully.',
            severity: 'success',
          });
        }
        if (status && status.toUpperCase().includes('FAIL')) {
          alertApi.post({
            message: errorMessage || 'Cluster deployment failed.',
            severity: 'error',
          });
        }
      }
    },
    [alertApi, clearPoller, clearStoredJob],
  );

  const fetchJobStatus = useCallback(
    async (id: string) => {
      try {
        const { job } = await getClusterJobStatus(
          fetchApi,
          discoveryApi,
          identityApi,
          authApi,
          id,
        );
        setJobError(null);
        setJobStatus(job.status ?? null);
        setProgress(
          typeof job.progress === 'number' ? Math.max(0, job.progress) : 0,
        );
        if (job.status === 'FAILED') {
          setJobError(job.error || 'Cluster deployment failed.');
        }
        handleTerminalJob(job.status, job.error);
        if (isTerminalStatus(job.status)) {
          pollerRef.current && clearPoller();
        }
      } catch (e: unknown) {
        let message = 'Unable to fetch cluster job status.';
        if (e instanceof AuthenticationError || e instanceof AuthorizationError) {
          message = e.message;
        } else if (e instanceof Error) {
          message = e.message || message;
        }
        setJobError(message);
        clearPoller();
      }
    },
    [clearPoller, discoveryApi, fetchApi, handleTerminalJob, identityApi, authApi],
  );

  const startPolling = useCallback(
    (id: string) => {
      clearPoller();
      fetchJobStatus(id);
      pollerRef.current = setInterval(() => {
        fetchJobStatus(id);
      }, POLL_INTERVAL_MS);
    },
    [clearPoller, fetchJobStatus],
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setJobError(null);
    try {
      const projectId = form.projectId.trim();
      const clusterId = form.clusterId.trim();
      const provider = form.provider.trim();
      const region = form.region.trim();

      if (!projectId) {
        setJobError('Select a project before provisioning a cluster.');
        setSubmitting(false);
        return;
      }
      if (!clusterId) {
        setJobError('Cluster ID is required.');
        setSubmitting(false);
        return;
      }
      if (!region) {
        setJobError('Region is required.');
        setSubmitting(false);
        return;
      }

      const payload = {
        projectId,
        clusterId,
        provider,
        region,
      };

      const { job } = await createCluster(
        fetchApi,
        discoveryApi,
        identityApi,
        authApi,
        payload,
      );
      setJobId(job.id);
      setJobStatus(job.status);
      setProgress(job.progress ?? 0);
      persistStoredJob({
        jobId: job.id,
        projectId,
        clusterId,
        provider,
        region,
      });
      alertApi.post({
        message: `Cluster creation job ${job.id} submitted.`,
        severity: 'success',
      });
      startPolling(job.id);
    } catch (e: unknown) {
      let message = 'Failed to submit cluster deployment.';
      if (e instanceof AuthenticationError || e instanceof AuthorizationError) {
        message = e.message;
      } else if (e instanceof Error) {
        message = e.message || message;
      }
      setJobError(message);
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const raw = window.localStorage.getItem(JOB_STORAGE_KEY);
    if (!raw) {
      return;
    }
    try {
      const stored: StoredClusterJob = JSON.parse(raw);
      if (!stored?.jobId) {
        window.localStorage.removeItem(JOB_STORAGE_KEY);
        return;
      }
      setForm(prev => ({
        ...prev,
        projectId: stored.projectId ?? prev.projectId,
        clusterId: stored.clusterId ?? prev.clusterId,
        provider: stored.provider ?? prev.provider,
        region: stored.region ?? prev.region,
      }));
      setJobId(stored.jobId);
      setJobStatus('RESUMING');
      setProgress(0);
      startPolling(stored.jobId);
    } catch (err) {
      window.localStorage.removeItem(JOB_STORAGE_KEY);
    }
  }, [startPolling]);

  useEffect(() => clearPoller, [clearPoller]);

  const normalizedProgress = Math.min(100, Math.max(0, progress ?? 0));

  return (
    <Page themeId="tool">
      <Content>
        <ContentHeader title="Provision compute clusters" />
        {catalogLoading && (
          <Box display="flex" justifyContent="center" paddingY={2}>
            <Progress />
          </Box>
        )}
        {!catalogLoading && catalogError && (
          <Box marginBottom={2}>
            <WarningPanel severity="error" title="Failed to load projects">
              Unable to retrieve project and cluster metadata.{' '}
              <Button color="primary" variant="outlined" onClick={() => reloadCatalog()}>
                Retry
              </Button>
            </WarningPanel>
          </Box>
        )}
        <div className={classes.layout}>
          <Card className={classes.panel} elevation={0}>
            <CardContent>
              <div className={classes.panelHeader}>
                <Typography variant="h6">Submit new cluster job</Typography>
                <Typography variant="body2" color="textSecondary">
                  Select a project, choose an identifier, and trigger provisioning through the ÆGIS
                  control plane.
                </Typography>
              </div>
              <form onSubmit={handleSubmit} className={classes.form}>
                <FormControl
                  variant="outlined"
                  fullWidth
                  required
                  disabled={catalogLoading || projects.length === 0}
                >
                  <InputLabel id="cluster-project-select">Project</InputLabel>
                  <Select
                    labelId="cluster-project-select"
                    label="Project"
                    value={form.projectId}
                    onChange={handleProjectSelect}
                  >
                    {projects.map(project => {
                      const visibility = visibilityCopy[project.visibility];
                      return (
                        <MenuItem key={project.id} value={project.id}>
                          <div className={classes.selectMenu}>
                            <Typography variant="subtitle1">{project.name}</Typography>
                            <Typography variant="body2" color="textSecondary">
                              {project.description}
                            </Typography>
                          </div>
                        </MenuItem>
                      );
                    })}
                    {projects.length === 0 && !catalogLoading && (
                      <MenuItem value="" disabled>
                        No projects available
                      </MenuItem>
                    )}
                  </Select>
                  <FormHelperText>
                    Clusters inherit guardrails from the selected project. Provision projects first
                    from the governance console.
                  </FormHelperText>
                </FormControl>
                {selectedProject && (
                  <Box display="flex" alignItems="center" justifyContent="space-between">
                    <Typography variant="subtitle1">{selectedProject.name}</Typography>
                    <Chip
                      label={visibilityCopy[selectedProject.visibility].label}
                      color={
                        visibilityCopy[selectedProject.visibility].tone === 'default'
                          ? 'default'
                          : visibilityCopy[selectedProject.visibility].tone
                      }
                      size="small"
                    />
                  </Box>
                )}
                <TextField
                  label="Cluster ID"
                  value={form.clusterId}
                  onChange={handleFormFieldChange('clusterId')}
                  variant="outlined"
                  required
                  fullWidth
                  helperText="Unique identifier for the Kubernetes cluster"
                  disabled={noProjectsAvailable}
                />
                <TextField
                  label="Provider"
                  value={form.provider}
                  onChange={handleFormFieldChange('provider')}
                  variant="outlined"
                  required
                  fullWidth
                  disabled
                  helperText="AWS only (multi-cloud coming soon)"
                />
                <TextField
                  label="Region"
                  value={form.region}
                  onChange={handleFormFieldChange('region')}
                  variant="outlined"
                  required
                  fullWidth
                  disabled={noProjectsAvailable}
                />
                <div className={classes.actionRow}>
                  <Button
                    type="submit"
                    color="primary"
                    variant="contained"
                  disabled={
                    submitting ||
                    jobActive ||
                    catalogLoading ||
                    noProjectsAvailable ||
                    !form.projectId ||
                    !form.clusterId.trim() ||
                    !form.region.trim()
                  }
                >
                    Create cluster
                  </Button>
                  {submitting && <Progress />}
                </div>
                {jobError && (
                  <WarningPanel severity="error" title="Cluster submission failed">
                    {jobError}
                  </WarningPanel>
                )}
                {noProjectsAvailable && (
                  <Box marginTop={2}>
                    <EmptyState
                      missing="data"
                      title="No projects available"
                      description="Provision a project in the governance console before creating clusters."
                    />
                  </Box>
                )}
              </form>
            </CardContent>
          </Card>
          <Card className={classes.panel} elevation={0}>
            <CardContent>
              <div className={classes.panelHeader}>
                <Typography variant="h6">Cluster inventory</Typography>
                <Typography variant="body2" color="textSecondary">
                  Monitor provisioning progress and verify existing clusters for the selected
                  project.
                </Typography>
              </div>
              {jobId && (
                <Paper elevation={0} className={classes.progressSection}>
                  <Typography variant="subtitle1">Latest job</Typography>
                  <Typography>Job ID: {jobId}</Typography>
                  <Typography>Status: {jobStatus}</Typography>
                  <div className={classes.progressSection}>
                    <LinearProgress variant="determinate" value={normalizedProgress} />
                    <Typography
                      className={classes.progressLabel}
                      variant="body2"
                      color="textSecondary"
                    >
                      Progress: {normalizedProgress}%
                    </Typography>
                  </div>
                </Paper>
              )}
              <Box marginTop={2}>
                <div className={classes.tableWrapper}>
                  <Table
                    options={{ paging: false, search: false, toolbar: false, draggable: false }}
                    data={clustersForProject}
                    columns={clusterColumns}
                  />
                </div>
                {!catalogLoading && clustersForProject.length === 0 && !noProjectsAvailable && (
                  <Box marginTop={2}>
                    <EmptyState
                      missing="data"
                      title="No clusters for this project"
                      description="Submit a cluster job to enable workspace launches for the selected project."
                    />
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>
        </div>
      </Content>
    </Page>
  );
};
