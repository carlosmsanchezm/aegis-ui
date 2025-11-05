import React, {
  ChangeEvent,
  FC,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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
} from '@backstage/core-plugin-api';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Divider,
  FormControl,
  FormHelperText,
  Grid,
  InputLabel,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  ListSubheader,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import {
  AuthenticationError,
  AuthorizationError,
  ClusterSummary,
  CreateClusterRequest,
  FlavorSummary,
  ProjectSummary,
  QueueVisibility,
  createCluster,
  createFlavor,
  createProject,
  createQueue,
  getClusterJobStatus,
  listClusters,
  listFlavors,
  listProjects,
} from '../api/aegisClient';
import { keycloakAuthApiRef } from '../api/refs';

const useStyles = makeStyles(theme => ({
  layout: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(3),
  },
  card: {
    borderRadius: theme.shape.borderRadius,
    border: '1px solid var(--aegis-card-border)',
    boxShadow: 'var(--aegis-card-shadow)',
  },
  cardContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2.5),
  },
  formGrid: {
    display: 'grid',
    gap: theme.spacing(2),
  },
  formActions: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
  },
  listWrapper: {
    borderRadius: theme.shape.borderRadius,
    border: '1px solid var(--aegis-card-border)',
    maxHeight: 280,
    overflowY: 'auto',
  },
  listSubheader: {
    backgroundColor: theme.palette.type === 'dark' ? '#0F172A' : '#F8FAFF',
  },
  helper: {
    color: theme.palette.text.secondary,
  },
  sectionDivider: {
    margin: theme.spacing(2, 0),
  },
  statusChip: {
    textTransform: 'uppercase',
    fontWeight: 600,
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

const visibilityCopy: Record<
  QueueVisibility,
  { label: string; tone: 'default' | 'primary' | 'secondary' }
> = {
  restricted: { label: 'Restricted', tone: 'secondary' },
  internal: { label: 'Internal', tone: 'primary' },
  public: { label: 'Public', tone: 'default' },
};

export const CreateClusterPage: FC = () => {
  const classes = useStyles();
  const fetchApi = useApi(fetchApiRef);
  const discoveryApi = useApi(discoveryApiRef);
  const identityApi = useApi(identityApiRef);
  const authApi = useApi(keycloakAuthApiRef);
  const alertApi = useApi(alertApiRef);

  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [clusters, setClusters] = useState<ClusterSummary[]>([]);
  const [flavors, setFlavors] = useState<FlavorSummary[]>([]);
  const [provisioningLoading, setProvisioningLoading] = useState(true);
  const [provisioningError, setProvisioningError] = useState<string | null>(null);

  const [projectForm, setProjectForm] = useState({
    projectId: '',
    name: '',
    description: '',
  });
  const [creatingProject, setCreatingProject] = useState(false);

  const [flavorForm, setFlavorForm] = useState({
    flavorId: '',
    displayName: '',
    resources: '',
    description: '',
    category: 'cpu',
  });
  const [creatingFlavor, setCreatingFlavor] = useState(false);

  const [queueForm, setQueueForm] = useState({
    projectId: '',
    queueId: '',
    name: '',
    description: '',
    clusterId: '',
    visibility: 'internal' as QueueVisibility,
    defaultFlavorId: '',
    supportedFlavors: [] as string[],
  });
  const [creatingQueue, setCreatingQueue] = useState(false);

  const [clusterForm, setClusterForm] = useState({
    projectId: '',
    clusterId: '',
    provider: 'aws',
    region: 'us-east-1',
  });
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const pollerRef = useRef<ReturnType<typeof setInterval>>();

  const jobActive = Boolean(jobId && !isTerminalStatus(jobStatus));

  const loadProvisioning = useCallback(async () => {
    try {
      setProvisioningError(null);
      setProvisioningLoading(true);
      const [projectItems, clusterItems, flavorItems] = await Promise.all([
        listProjects(fetchApi, discoveryApi, identityApi, authApi),
        listClusters(fetchApi, discoveryApi, identityApi, authApi),
        listFlavors(fetchApi, discoveryApi, identityApi, authApi),
      ]);
      setProjects(projectItems);
      setClusters(clusterItems);
      setFlavors(flavorItems);
    } catch (e: unknown) {
      let message = 'Unable to load provisioning data.';
      if (e instanceof AuthenticationError || e instanceof AuthorizationError) {
        message = e.message;
      } else if (e instanceof Error) {
        message = e.message || message;
      }
      setProvisioningError(message);
    } finally {
      setProvisioningLoading(false);
    }
  }, [fetchApi, discoveryApi, identityApi, authApi]);

  useEffect(() => {
    loadProvisioning();
  }, [loadProvisioning]);

  useEffect(() => {
    if (projects.length === 0) {
      return;
    }
    setClusterForm(prev =>
      prev.projectId ? prev : { ...prev, projectId: projects[0].id },
    );
    setQueueForm(prev =>
      prev.projectId ? prev : { ...prev, projectId: projects[0].id },
    );
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
        loadProvisioning();
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
    [alertApi, clearPoller, clearStoredJob, loadProvisioning],
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
        setError(null);
        setJobStatus(job.status ?? null);
        setProgress(
          typeof job.progress === 'number' ? Math.max(0, job.progress) : 0,
        );
        if (job.status === 'FAILED') {
          setError(job.error || 'Cluster deployment failed.');
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
        setError(message);
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

  const handleClusterSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!clusterForm.projectId.trim() || !clusterForm.clusterId.trim()) {
      alertApi.post({
        message: 'Project and cluster identifiers are required.',
        severity: 'warning',
      });
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const payload: CreateClusterRequest = {
        projectId: clusterForm.projectId.trim(),
        clusterId: clusterForm.clusterId.trim(),
        provider: clusterForm.provider.trim(),
        region: clusterForm.region.trim(),
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
        projectId: payload.projectId,
        clusterId: payload.clusterId,
        provider: payload.provider,
        region: payload.region,
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
      setError(message);
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
      setClusterForm(prev => ({
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

  const handleProjectFormChange = (field: keyof typeof projectForm) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      setProjectForm(prev => ({ ...prev, [field]: event.target.value }));
    };

  const handleFlavorFormChange = (field: keyof typeof flavorForm) =>
    (event: ChangeEvent<HTMLInputElement | { value: unknown }>) => {
      const value = (event.target as any).value as string;
      setFlavorForm(prev => ({ ...prev, [field]: value }));
    };

  const handleQueueFormChange =
    (field: keyof typeof queueForm) =>
    (event: ChangeEvent<{ value: unknown }>) => {
      const value = event.target.value as string;
      setQueueForm(prev => ({ ...prev, [field]: value }));
    };

  const handleQueueSupportedFlavorsChange = (
    event: ChangeEvent<{ value: unknown }>,
  ) => {
    const value = event.target.value as string[];
    setQueueForm(prev => ({ ...prev, supportedFlavors: value || [] }));
  };

  const handleClusterFormChange =
    (field: keyof typeof clusterForm) =>
    (
      event:
        | ChangeEvent<HTMLInputElement>
        | ChangeEvent<{ value: unknown }>,
    ) => {
      const value = (event.target as any).value as string;
      setClusterForm(prev => ({ ...prev, [field]: value }));
    };

  const handleCreateProject = async (event: FormEvent) => {
    event.preventDefault();
    const projectId = projectForm.projectId.trim();
    const name = projectForm.name.trim();
    if (!projectId || !name) {
      alertApi.post({
        message: 'Project ID and name are required.',
        severity: 'warning',
      });
      return;
    }
    try {
      setCreatingProject(true);
      await createProject(fetchApi, discoveryApi, identityApi, authApi, {
        projectId,
        name,
        description: projectForm.description.trim() || undefined,
      });
      alertApi.post({
        message: `Project ${projectId} created.`,
        severity: 'success',
      });
      setProjectForm({ projectId: '', name: '', description: '' });
      loadProvisioning();
    } catch (e: unknown) {
      let message = 'Failed to create project.';
      if (e instanceof AuthenticationError || e instanceof AuthorizationError) {
        message = e.message;
      } else if (e instanceof Error) {
        message = e.message || message;
      }
      alertApi.post({
        message,
        severity: 'error',
      });
    } finally {
      setCreatingProject(false);
    }
  };

  const handleCreateFlavor = async (event: FormEvent) => {
    event.preventDefault();
    const flavorId = flavorForm.flavorId.trim();
    if (!flavorId) {
      alertApi.post({
        message: 'Flavor ID is required.',
        severity: 'warning',
      });
      return;
    }
    try {
      setCreatingFlavor(true);
      await createFlavor(fetchApi, discoveryApi, identityApi, authApi, {
        flavorId,
        displayName: flavorForm.displayName.trim() || flavorId,
        description: flavorForm.description.trim() || undefined,
        resources: flavorForm.resources.trim() || undefined,
        category: flavorForm.category.trim() || undefined,
      });
      alertApi.post({
        message: `Flavor ${flavorId} created.`,
        severity: 'success',
      });
      setFlavorForm({
        flavorId: '',
        displayName: '',
        resources: '',
        description: '',
        category: flavorForm.category,
      });
      loadProvisioning();
    } catch (e: unknown) {
      let message = 'Failed to create flavor.';
      if (e instanceof AuthenticationError || e instanceof AuthorizationError) {
        message = e.message;
      } else if (e instanceof Error) {
        message = e.message || message;
      }
      alertApi.post({
        message,
        severity: 'error',
      });
    } finally {
      setCreatingFlavor(false);
    }
  };

  const handleCreateQueue = async (event: FormEvent) => {
    event.preventDefault();
    const projectId = queueForm.projectId.trim();
    const queueId = queueForm.queueId.trim();
    if (!projectId || !queueId) {
      alertApi.post({
        message: 'Project and queue identifiers are required.',
        severity: 'warning',
      });
      return;
    }
    try {
      setCreatingQueue(true);
      await createQueue(
        fetchApi,
        discoveryApi,
        identityApi,
        authApi,
        projectId,
        {
          queueId,
          name: queueForm.name.trim() || undefined,
          description: queueForm.description.trim() || undefined,
          clusterId: queueForm.clusterId.trim() || undefined,
          defaultFlavorId: queueForm.defaultFlavorId.trim() || undefined,
          visibility: queueForm.visibility,
          supportedFlavors:
            queueForm.supportedFlavors.length > 0
              ? queueForm.supportedFlavors
              : undefined,
        },
      );
      alertApi.post({
        message: `Queue ${queueId} created.`,
        severity: 'success',
      });
      setQueueForm(prev => ({
        ...prev,
        queueId: '',
        name: '',
        description: '',
        clusterId: '',
        defaultFlavorId: '',
        supportedFlavors: [],
      }));
      loadProvisioning();
    } catch (e: unknown) {
      let message = 'Failed to create queue.';
      if (e instanceof AuthenticationError || e instanceof AuthorizationError) {
        message = e.message;
      } else if (e instanceof Error) {
        message = e.message || message;
      }
      alertApi.post({
        message,
        severity: 'error',
      });
    } finally {
      setCreatingQueue(false);
    }
  };

  const clustersForQueueProject = useMemo(
    () =>
      clusters.filter(cluster =>
        queueForm.projectId
          ? cluster.projectId === queueForm.projectId
          : true,
      ),
    [clusters, queueForm.projectId],
  );

  useEffect(() => {
    if (!queueForm.clusterId) {
      return;
    }
    if (!clustersForQueueProject.some(cluster => cluster.id === queueForm.clusterId)) {
      setQueueForm(prev => ({ ...prev, clusterId: '' }));
    }
  }, [clustersForQueueProject, queueForm.clusterId]);

  const visibilityOptions: QueueVisibility[] = ['restricted', 'internal', 'public'];

  return (
    <Page themeId="tool">
      <Content>
        <ContentHeader title="Provision clusters and workspace primitives" />
        <div className={classes.layout}>
          {provisioningLoading && (
            <Box>
              <LinearProgress />
            </Box>
          )}
          {provisioningError && (
            <WarningPanel severity="error" title="Failed to load data">
              {provisioningError}
            </WarningPanel>
          )}
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card className={classes.card}>
                <CardHeader title="Create project" subheader="Projects scope budgets and access controls." />
                <CardContent className={classes.cardContent}>
                  <form onSubmit={handleCreateProject} className={classes.formGrid}>
                    <TextField
                      label="Project ID"
                      value={projectForm.projectId}
                      onChange={handleProjectFormChange('projectId')}
                      variant="outlined"
                      required
                      fullWidth
                      helperText="Lowercase identifier, e.g. atlas-vision"
                    />
                    <TextField
                      label="Display name"
                      value={projectForm.name}
                      onChange={handleProjectFormChange('name')}
                      variant="outlined"
                      required
                      fullWidth
                    />
                    <TextField
                      label="Description"
                      value={projectForm.description}
                      onChange={handleProjectFormChange('description')}
                      variant="outlined"
                      fullWidth
                      multiline
                      rows={3}
                    />
                    <div className={classes.formActions}>
                      <Button
                        type="submit"
                        color="primary"
                        variant="contained"
                        disabled={creatingProject}
                      >
                        Create project
                      </Button>
                      {creatingProject && <Progress />}
                    </div>
                  </form>
                  <Divider className={classes.sectionDivider} />
                  <Typography variant="subtitle2">Existing projects</Typography>
                  <List dense className={classes.listWrapper}>
                    {projects.length === 0 ? (
                      <ListItem>
                        <ListItemText
                          primary="No projects yet"
                          secondary="Create a project to enable workspace provisioning."
                        />
                      </ListItem>
                    ) : (
                      projects.map(project => (
                        <ListItem key={project.id} alignItems="flex-start">
                          <ListItemText
                            primary={`${project.name ?? project.id} (${project.id})`}
                            secondary={
                              <span className={classes.helper}>
                                {project.queues?.length ?? 0} queues configured
                              </span>
                            }
                          />
                        </ListItem>
                      ))
                    )}
                  </List>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card className={classes.card}>
                <CardHeader title="Create flavor" subheader="Flavors capture compute envelopes for queues." />
                <CardContent className={classes.cardContent}>
                  <form onSubmit={handleCreateFlavor} className={classes.formGrid}>
                    <TextField
                      label="Flavor ID"
                      value={flavorForm.flavorId}
                      onChange={handleFlavorFormChange('flavorId')}
                      variant="outlined"
                      required
                      fullWidth
                      helperText="Short ID, e.g. gpu-standard"
                    />
                    <TextField
                      label="Display name"
                      value={flavorForm.displayName}
                      onChange={handleFlavorFormChange('displayName')}
                      variant="outlined"
                      fullWidth
                    />
                    <TextField
                      label="Resources"
                      value={flavorForm.resources}
                      onChange={handleFlavorFormChange('resources')}
                      variant="outlined"
                      fullWidth
                      helperText="e.g. 1× A100 • 8 vCPU • 64 GiB"
                    />
                    <TextField
                      label="Description"
                      value={flavorForm.description}
                      onChange={handleFlavorFormChange('description')}
                      variant="outlined"
                      fullWidth
                      multiline
                      rows={3}
                    />
                    <FormControl variant="outlined" fullWidth>
                      <InputLabel id="create-flavor-category">Category</InputLabel>
                      <Select
                        labelId="create-flavor-category"
                        label="Category"
                        value={flavorForm.category}
                        onChange={handleFlavorFormChange('category')}
                      >
                        <MenuItem value="cpu">CPU</MenuItem>
                        <MenuItem value="gpu">GPU</MenuItem>
                        <MenuItem value="memory">Memory optimized</MenuItem>
                      </Select>
                    </FormControl>
                    <div className={classes.formActions}>
                      <Button
                        type="submit"
                        color="primary"
                        variant="contained"
                        disabled={creatingFlavor}
                      >
                        Create flavor
                      </Button>
                      {creatingFlavor && <Progress />}
                    </div>
                  </form>
                  <Divider className={classes.sectionDivider} />
                  <Typography variant="subtitle2">Existing flavors</Typography>
                  <List dense className={classes.listWrapper}>
                    {flavors.length === 0 ? (
                      <ListItem>
                        <ListItemText
                          primary="No flavors yet"
                          secondary="Define at least one flavor to enable queue provisioning."
                        />
                      </ListItem>
                    ) : (
                      flavors.map(flavor => (
                        <ListItem key={flavor.id}>
                          <ListItemText
                            primary={`${flavor.displayName ?? flavor.id}`}
                            secondary={flavor.resources || flavor.description || flavor.id}
                          />
                        </ListItem>
                      ))
                    )}
                  </List>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12}>
              <Card className={classes.card}>
                <CardHeader
                  title="Create queue"
                  subheader="Queues map projects and flavors to specific clusters."
                />
                <CardContent className={classes.cardContent}>
                  <form onSubmit={handleCreateQueue} className={classes.formGrid}>
                    <FormControl variant="outlined" fullWidth required>
                      <InputLabel id="create-queue-project">Project</InputLabel>
                      <Select
                        labelId="create-queue-project"
                        label="Project"
                        value={queueForm.projectId}
                        onChange={handleQueueFormChange('projectId')}
                      >
                        {projects.map(project => (
                          <MenuItem key={project.id} value={project.id}>
                            {project.name ?? project.id}
                          </MenuItem>
                        ))}
                      </Select>
                      {projects.length === 0 && (
                        <FormHelperText>No projects available</FormHelperText>
                      )}
                    </FormControl>
                    <TextField
                      label="Queue ID"
                      value={queueForm.queueId}
                      onChange={handleQueueFormChange('queueId')}
                      variant="outlined"
                      required
                      fullWidth
                    />
                    <TextField
                      label="Display name"
                      value={queueForm.name}
                      onChange={handleQueueFormChange('name')}
                      variant="outlined"
                      fullWidth
                    />
                    <TextField
                      label="Description"
                      value={queueForm.description}
                      onChange={handleQueueFormChange('description')}
                      variant="outlined"
                      fullWidth
                      multiline
                      rows={3}
                    />
                    <FormControl variant="outlined" fullWidth>
                      <InputLabel id="create-queue-cluster">Cluster</InputLabel>
                      <Select
                        labelId="create-queue-cluster"
                        label="Cluster"
                        value={queueForm.clusterId}
                        onChange={handleQueueFormChange('clusterId')}
                      >
                        <MenuItem value="">
                          <em>Assign later</em>
                        </MenuItem>
                        {clustersForQueueProject.map(cluster => (
                          <MenuItem key={cluster.id} value={cluster.id}>
                            {cluster.displayName ?? cluster.id}
                          </MenuItem>
                        ))}
                      </Select>
                      {clustersForQueueProject.length === 0 && (
                        <FormHelperText>
                          No clusters detected for this project yet.
                        </FormHelperText>
                      )}
                    </FormControl>
                    <FormControl variant="outlined" fullWidth>
                      <InputLabel id="create-queue-visibility">Visibility</InputLabel>
                      <Select
                        labelId="create-queue-visibility"
                        label="Visibility"
                        value={queueForm.visibility}
                        onChange={handleQueueFormChange('visibility')}
                      >
                        {visibilityOptions.map(option => (
                          <MenuItem key={option} value={option}>
                            {visibilityCopy[option].label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <FormControl variant="outlined" fullWidth>
                      <InputLabel id="create-queue-default-flavor">
                        Default flavor
                      </InputLabel>
                      <Select
                        labelId="create-queue-default-flavor"
                        label="Default flavor"
                        value={queueForm.defaultFlavorId}
                        onChange={handleQueueFormChange('defaultFlavorId')}
                      >
                        <MenuItem value="">
                          <em>None</em>
                        </MenuItem>
                        {flavors.map(flavor => (
                          <MenuItem key={flavor.id} value={flavor.id}>
                            {flavor.displayName ?? flavor.id}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <FormControl variant="outlined" fullWidth>
                      <InputLabel id="create-queue-supported-flavors">
                        Allowed flavors
                      </InputLabel>
                      <Select
                        labelId="create-queue-supported-flavors"
                        label="Allowed flavors"
                        value={queueForm.supportedFlavors}
                        onChange={handleQueueSupportedFlavorsChange}
                        multiple
                        renderValue={selected =>
                          (selected as string[])?.map(id =>
                            flavors.find(flavor => flavor.id === id)?.displayName ?? id,
                          ).join(', ') || 'None'
                        }
                      >
                        {flavors.map(flavor => (
                          <MenuItem key={flavor.id} value={flavor.id}>
                            {flavor.displayName ?? flavor.id}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <div className={classes.formActions}>
                      <Button
                        type="submit"
                        color="primary"
                        variant="contained"
                        disabled={creatingQueue || projects.length === 0}
                      >
                        Create queue
                      </Button>
                      {creatingQueue && <Progress />}
                    </div>
                  </form>
                  <Divider className={classes.sectionDivider} />
                  <Typography variant="subtitle2">Queues by project</Typography>
                  <div className={classes.listWrapper}>
                    {projects.length === 0 ? (
                      <List dense>
                        <ListItem>
                          <ListItemText primary="No projects yet" />
                        </ListItem>
                      </List>
                    ) : (
                      <List dense>
                        {projects.map(project => (
                          <li key={project.id}>
                            <ul>
                              <ListSubheader className={classes.listSubheader}>
                                {project.name ?? project.id}
                              </ListSubheader>
                              {(project.queues ?? []).length === 0 ? (
                                <ListItem>
                                  <ListItemText primary="No queues defined" />
                                </ListItem>
                              ) : (
                                (project.queues ?? []).map(queue => (
                                  <ListItem key={queue.id}>
                                    <ListItemText
                                      primary={queue.name ?? queue.id}
                                      secondary={queue.description ?? queue.id}
                                    />
                                    <Chip
                                      size="small"
                                      label={
                                        visibilityCopy[
                                          (queue.visibility as QueueVisibility) || 'internal'
                                        ].label
                                      }
                                      color={
                                        visibilityCopy[
                                          (queue.visibility as QueueVisibility) || 'internal'
                                        ].tone
                                      }
                                      className={classes.statusChip}
                                    />
                                  </ListItem>
                                ))
                              )}
                            </ul>
                          </li>
                        ))}
                      </List>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12}>
              <Card className={classes.card}>
                <CardHeader
                  title="Create cluster"
                  subheader="Clusters provision the compute substrate backing queues."
                />
                <CardContent className={classes.cardContent}>
                  <form onSubmit={handleClusterSubmit} className={classes.formGrid}>
                    <FormControl variant="outlined" fullWidth required>
                      <InputLabel id="create-cluster-project">Project</InputLabel>
                      <Select
                        labelId="create-cluster-project"
                        label="Project"
                        value={clusterForm.projectId}
                        onChange={handleClusterFormChange('projectId')}
                      >
                        {projects.map(project => (
                          <MenuItem key={project.id} value={project.id}>
                            {project.name ?? project.id}
                          </MenuItem>
                        ))}
                      </Select>
                      {projects.length === 0 && (
                        <FormHelperText>
                          Create a project before provisioning clusters.
                        </FormHelperText>
                      )}
                    </FormControl>
                    <TextField
                      label="Cluster ID"
                      value={clusterForm.clusterId}
                      onChange={handleClusterFormChange('clusterId')}
                      variant="outlined"
                      required
                      fullWidth
                    />
                    <TextField
                      label="Provider"
                      value={clusterForm.provider}
                      onChange={handleClusterFormChange('provider')}
                      variant="outlined"
                      required
                      fullWidth
                      helperText="Provider slug, e.g. aws"
                    />
                    <TextField
                      label="Region"
                      value={clusterForm.region}
                      onChange={handleClusterFormChange('region')}
                      variant="outlined"
                      required
                      fullWidth
                    />
                    <div className={classes.formActions}>
                      <Button
                        type="submit"
                        color="primary"
                        variant="contained"
                        disabled={submitting || jobActive || projects.length === 0}
                      >
                        Create cluster
                      </Button>
                      {(submitting || jobActive) && <Progress />}
                    </div>
                  </form>
                  {jobId && (
                    <Box mt={1.5}>
                      <Typography variant="subtitle1">Job status</Typography>
                      <Typography variant="body2">Job ID: {jobId}</Typography>
                      <Typography variant="body2">Status: {jobStatus}</Typography>
                      <Box mt={1.5}>
                        <LinearProgress variant="determinate" value={normalizedProgress} />
                        <Typography variant="body2" color="textSecondary">
                          Progress: {normalizedProgress}%
                        </Typography>
                      </Box>
                    </Box>
                  )}
                  {error && (
                    <Box mt={2}>
                      <WarningPanel severity="error" title="Cluster creation failed">
                        {error}
                      </WarningPanel>
                    </Box>
                  )}
                  <Divider className={classes.sectionDivider} />
                  <Typography variant="subtitle2">Existing clusters</Typography>
                  <List dense className={classes.listWrapper}>
                    {clusters.length === 0 ? (
                      <ListItem>
                        <ListItemText
                          primary="No clusters provisioned"
                          secondary="Submit a cluster job to wire this project to infrastructure."
                        />
                      </ListItem>
                    ) : (
                      clusters.map(cluster => (
                        <ListItem key={cluster.id}>
                          <ListItemText
                            primary={`${cluster.displayName ?? cluster.id} (${cluster.region ?? 'unknown region'})`}
                            secondary={`Project: ${cluster.projectId ?? '—'} • Provider: ${cluster.provider ?? '—'}`}
                          />
                          <Chip
                            label={cluster.status ?? 'UNKNOWN'}
                            color={cluster.status === 'READY' ? 'primary' : 'default'}
                            size="small"
                            className={classes.statusChip}
                          />
                        </ListItem>
                      ))
                    )}
                  </List>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </div>
      </Content>
    </Page>
  );
};
