import {
  ChangeEvent,
  FC,
  FormEvent,
  useEffect,
  useMemo,
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
  useRouteRef,
} from '@backstage/core-plugin-api';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Checkbox,
  Chip,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  LinearProgress,
  Divider,
  MenuItem,
  Select,
  Slider,
  TextField,
  Typography,
  makeStyles,
} from '@material-ui/core';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import CloudQueueIcon from '@material-ui/icons/CloudQueue';
import StorageIcon from '@material-ui/icons/Storage';
import LockIcon from '@material-ui/icons/Lock';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  AuthenticationError,
  AuthorizationError,
  CreateWorkspaceRequest,
  createWorkspace,
} from '../api/aegisClient';
import { keycloakAuthApiRef } from '../api/refs';
import { workloadsRouteRef } from '../routes';
import {
  ComputeProfileDefinition,
  ProjectDefinition,
  environmentsCopy,
  projectCatalog,
} from './projects/projectCatalog';

const useStyles = makeStyles(theme => ({
  page: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(3),
  },
  layout: {
    display: 'grid',
    gridTemplateColumns: 'minmax(480px, 1.4fr) minmax(320px, 0.8fr)',
    gap: theme.spacing(3),
    [theme.breakpoints.down('lg')]: {
      gridTemplateColumns: '1fr',
    },
  },
  card: {
    borderRadius: theme.shape.borderRadius,
    border: `1px solid var(--aegis-card-border)`,
    backgroundColor: 'var(--aegis-card-surface)',
  },
  cardContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2.5),
  },
  sectionTitle: {
    fontWeight: 600,
    letterSpacing: '-0.01em',
  },
  computeProfileGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: theme.spacing(2),
  },
  computeProfileCard: {
    height: '100%',
    border: `1px solid var(--aegis-card-border)`,
    borderRadius: theme.shape.borderRadius,
    backgroundColor: 'transparent',
    transition: 'border-color 150ms ease, box-shadow 150ms ease',
    '&.selected': {
      borderColor: theme.palette.primary.main,
      boxShadow: '0 0 0 2px rgba(59,130,246,0.25)',
    },
  },
  computeProfileCardContent: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: theme.spacing(1.5),
  },
  chipRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
  },
  summaryCard: {
    padding: theme.spacing(3),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  },
  inlineField: {
    display: 'flex',
    gap: theme.spacing(2),
    flexWrap: 'wrap',
  },
  advancedSection: {
    backgroundColor:
      theme.palette.type === 'dark'
        ? 'rgba(59,130,246,0.08)'
        : 'rgba(191,219,254,0.35)',
  },
  budgetMeter: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  },
  envLabel: {
    borderRadius: 999,
    fontWeight: 600,
  },
  summaryHeader: {
    display: 'flex',
    alignItems: 'center',
    columnGap: theme.spacing(1.5),
  },
  summaryColumn: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: theme.spacing(1.5),
  },
  summaryRow: {
    display: 'flex',
    alignItems: 'center',
    columnGap: theme.spacing(1.5),
  },
  summaryActions: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: theme.spacing(1.5),
  },
}));

type WorkspaceImageDefinition = {
  id: string;
  label: string;
  description: string;
  image: string;
  badges: string[];
};

const workspaceImages: WorkspaceImageDefinition[] = [
  {
    id: 'vscode-python',
    label: 'VS Code · Python 3.11',
    description: 'Fully-managed VS Code with CUDA extensions and CLI tools.',
    image: 'ghcr.io/aegis/workspace-vscode-python:3.11',
    badges: ['Prebuilt CUDA', 'Devcontainer ready'],
  },
  {
    id: 'jupyter-gpu',
    label: 'JupyterLab · GPU',
    description: 'JupyterLab image with PyTorch, TensorFlow, and notebook tooling.',
    image: 'ghcr.io/aegis/workspace-jupyterlab:gpu-latest',
    badges: ['Notebook ready', 'CUDA 12'],
  },
  {
    id: 'cli-ops',
    label: 'Secure CLI',
    description: 'Minimal shell with kubectl, cloud CLIs, and Git.',
    image: 'ghcr.io/aegis/workspace-cli:latest',
    badges: ['Air-gapped approved'],
  },
];

const randomSuffix = () => Math.random().toString(36).slice(-5);

const sanitizeWorkspaceName = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');

const formatCurrency = (value: number) =>
  `$${value.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

const computeBudgetPercent = (project?: ProjectDefinition) => {
  if (!project) {
    return 0;
  }
  const { monthlyLimit, monthlyUsed } = project.budget;
  return Math.min(100, Math.round((monthlyUsed / Math.max(1, monthlyLimit)) * 100));
};

export const LaunchWorkspacePage: FC = () => {
  const classes = useStyles();
  const alertApi = useApi(alertApiRef);
  const fetchApi = useApi(fetchApiRef);
  const discoveryApi = useApi(discoveryApiRef);
  const identityApi = useApi(identityApiRef);
  const authApi = useApi(keycloakAuthApiRef);
  const workloadsLink = useRouteRef(workloadsRouteRef);
  const navigate = useNavigate();

  const [projectId, setProjectId] = useState<string>(projectCatalog[0]?.id ?? '');
  const [computeProfileId, setComputeProfileId] = useState<string>(
    projectCatalog[0]?.defaultComputeProfileId ?? '',
  );
  const [imageId, setImageId] = useState<string>(workspaceImages[0]?.id ?? '');
  const [workspaceName, setWorkspaceName] = useState<string>(
    `${projectCatalog[0]?.id ?? 'workspace'}-lab-${randomSuffix()}`,
  );
  const [dataConnectionIds, setDataConnectionIds] = useState<string[]>(
    projectCatalog[0]?.dataConnections.map(connection => connection.id) ?? [],
  );
  const [secretScopeIds, setSecretScopeIds] = useState<string[]>(
    projectCatalog[0]?.secretScopes.map(scope => scope.id) ?? [],
  );
  const [keepUserData, setKeepUserData] = useState<boolean>(true);
  const [attachProjectData, setAttachProjectData] = useState<boolean>(false);
  const [ttlHours, setTtlHours] = useState<number>(24);
  const [notes, setNotes] = useState('');
  const [clusterOverride, setClusterOverride] = useState('');
  const [namespaceOverride, setNamespaceOverride] = useState('');
  const [storageClassOverride, setStorageClassOverride] = useState('');
  const [networkZoneOverride, setNetworkZoneOverride] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedProject = useMemo(
    () => projectCatalog.find(project => project.id === projectId) ?? null,
    [projectId],
  );

  const computeProfiles = selectedProject?.computeProfiles ?? [];

  const selectedProfile: ComputeProfileDefinition | undefined = useMemo(
    () => computeProfiles.find(profile => profile.id === computeProfileId),
    [computeProfiles, computeProfileId],
  );

  const selectedImage = useMemo(
    () => workspaceImages.find(candidate => candidate.id === imageId) ?? workspaceImages[0],
    [imageId],
  );

  useEffect(() => {
    if (!selectedProject) {
      return;
    }
    setComputeProfileId(prev => {
      if (selectedProject.computeProfiles.some(profile => profile.id === prev)) {
        return prev;
      }
      return selectedProject.defaultComputeProfileId;
    });
    setDataConnectionIds(selectedProject.dataConnections.map(connection => connection.id));
    setSecretScopeIds(selectedProject.secretScopes.map(scope => scope.id));
    setWorkspaceName(prev => {
      const sanitized = sanitizeWorkspaceName(prev);
      if (!sanitized || !sanitized.startsWith(selectedProject.id)) {
        return `${selectedProject.id}-lab-${randomSuffix()}`;
      }
      return sanitized;
    });
    setClusterOverride('');
    setNamespaceOverride('');
    setStorageClassOverride('');
    setNetworkZoneOverride('');
  }, [selectedProject]);

  const handleProjectChange = (event: ChangeEvent<{ value: unknown }>) => {
    setProjectId(event.target.value as string);
  };

  const handleProfileSelect = (profile: ComputeProfileDefinition) => {
    setComputeProfileId(profile.id);
  };

  const handleImageSelect = (image: WorkspaceImageDefinition) => {
    setImageId(image.id);
  };

  const handleWorkspaceNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    setWorkspaceName(sanitizeWorkspaceName(event.target.value));
  };

  const handleDataConnectionsChange = (event: ChangeEvent<{ value: unknown }>) => {
    setDataConnectionIds(event.target.value as string[]);
  };

  const handleSecretScopesChange = (event: ChangeEvent<{ value: unknown }>) => {
    setSecretScopeIds(event.target.value as string[]);
  };

  const estimatedCost = selectedProfile ? formatCurrency(selectedProfile.hourlyRate) : '$0.00';
  const budgetPercent = computeBudgetPercent(selectedProject ?? undefined);
  const environmentLabel = selectedProject
    ? environmentsCopy[selectedProject.environment].label
    : '';

  const uniqueClusters = useMemo(() => {
    const clusters = computeProfiles.map(profile => profile.cluster);
    return Array.from(new Map(clusters.map(cluster => [cluster.id, cluster])).values());
  }, [computeProfiles]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedProject || !selectedProfile || !workspaceName.trim()) {
      setError('Select a project, compute profile, and workspace name.');
      return;
    }

    const payload: CreateWorkspaceRequest = {
      projectId: selectedProject.id,
      workspaceId: sanitizeWorkspaceName(workspaceName),
      queue: selectedProfile.queueId,
      workspace: {
        flavor: selectedProfile.flavor,
        image: selectedImage.image,
        interactive: true,
        maxDurationSeconds: Math.max(1, ttlHours) * 3600,
        env: {
          ...(dataConnectionIds.length
            ? { AEGIS_DATA_CONNECTIONS: dataConnectionIds.join(',') }
            : {}),
          ...(secretScopeIds.length
            ? { AEGIS_SECRET_SCOPES: secretScopeIds.join(',') }
            : {}),
          ...(keepUserData ? { AEGIS_PERSIST_USER_DATA: 'true' } : {}),
          ...(attachProjectData ? { AEGIS_ATTACH_PROJECT_DATA: 'true' } : {}),
          ...(notes ? { AEGIS_WORKSPACE_NOTES: notes } : {}),
        },
      },
    };

    try {
      setSubmitting(true);
      setError(null);
      const response = await createWorkspace(
        fetchApi,
        discoveryApi,
        identityApi,
        authApi,
        payload,
      );
      const createdId = response?.workload?.id ?? payload.workspaceId ?? workspaceName;
      alertApi.post({
        message: `Workspace ${createdId} is launching`,
        severity: 'success',
      });
      if (workloadsLink) {
        navigate(workloadsLink());
      }
    } catch (e: unknown) {
      let message = 'Failed to submit workspace.';
      if (e instanceof AuthenticationError || e instanceof AuthorizationError) {
        message = e.message;
      } else if (e instanceof Error) {
        message = e.message || message;
      }
      setError(message);
      alertApi.post({
        message,
        severity: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Page themeId="tool">
      <Content>
        <ContentHeader title="Launch Workspace">
          <Button component={RouterLink} to="/aegis/admin/projects">
            Manage Projects
          </Button>
        </ContentHeader>
        <form onSubmit={handleSubmit} className={classes.page}>
          <div className={classes.layout}>
            <div className={classes.page}>
              <Card elevation={0} className={classes.card}>
                <CardContent className={classes.cardContent}>
                  <div>
                    <Typography variant="h6" className={classes.sectionTitle}>
                      Project & compute
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Choose the project, then pick a compute profile. Costs and
                      guardrails inherit from the project.
                    </Typography>
                  </div>
                  <FormControl variant="outlined" fullWidth>
                    <InputLabel id="project-select-label">Project</InputLabel>
                    <Select
                      labelId="project-select-label"
                      value={projectId}
                      onChange={handleProjectChange}
                      label="Project"
                    >
                      {projectCatalog.map(project => (
                        <MenuItem key={project.id} value={project.id}>
                          <Box display="flex" flexDirection="column">
                            <Typography variant="body1">{project.displayName}</Typography>
                            <Typography variant="caption" color="textSecondary">
                              {project.description}
                            </Typography>
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <div className={classes.computeProfileGrid}>
                    {computeProfiles.map(profile => {
                      const selected = profile.id === computeProfileId;
                      return (
                        <Card
                          key={profile.id}
                          elevation={0}
                          className={`${classes.computeProfileCard} ${
                            selected ? 'selected' : ''
                          }`}
                        >
                          <CardActionArea onClick={() => handleProfileSelect(profile)}>
                            <CardContent className={classes.computeProfileCardContent}>
                              <Typography variant="subtitle1">{profile.label}</Typography>
                              <Typography variant="body2" color="textSecondary">
                                {profile.description}
                              </Typography>
                              <Typography variant="body2">
                                {formatCurrency(profile.hourlyRate)}/hr
                              </Typography>
                              <Typography variant="caption" color="textSecondary">
                                {profile.cluster.name} · {profile.cluster.region}
                              </Typography>
                              <div className={classes.chipRow}>
                                {profile.badges.map(badge => (
                                  <Chip key={badge} label={badge} size="small" />
                                ))}
                              </div>
                            </CardContent>
                          </CardActionArea>
                        </Card>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card elevation={0} className={classes.card}>
                <CardContent className={classes.cardContent}>
                  <div>
                    <Typography variant="h6" className={classes.sectionTitle}>
                      Workspace basics
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Name follows <code>org-proj-env-purpose-rand</code>. Images are
                      curated for security and compliance.
                    </Typography>
                  </div>
                  <TextField
                    label="Workspace name"
                    value={workspaceName}
                    onChange={handleWorkspaceNameChange}
                    helperText="Slugified name becomes your Kubernetes namespace."
                    fullWidth
                    required
                  />
                  <TextField
                    label="Environment"
                    value={environmentLabel}
                    variant="outlined"
                    fullWidth
                    disabled
                  />
                  <div className={classes.computeProfileGrid}>
                    {workspaceImages.map(image => {
                      const selected = image.id === imageId;
                      return (
                        <Card
                          key={image.id}
                          elevation={0}
                          className={`${classes.computeProfileCard} ${
                            selected ? 'selected' : ''
                          }`}
                        >
                          <CardActionArea onClick={() => handleImageSelect(image)}>
                            <CardContent className={classes.computeProfileCardContent}>
                              <Typography variant="subtitle1">{image.label}</Typography>
                              <Typography variant="body2" color="textSecondary">
                                {image.description}
                              </Typography>
                              <div className={classes.chipRow}>
                                {image.badges.map(badge => (
                                  <Chip key={badge} label={badge} size="small" />
                                ))}
                              </div>
                            </CardContent>
                          </CardActionArea>
                        </Card>
                      );
                    })}
                  </div>
                  <Box>
                    <Typography gutterBottom>Time to live</Typography>
                    <Slider
                      value={ttlHours}
                      min={1}
                      max={72}
                      step={1}
                      onChange={(_, value) => setTtlHours(value as number)}
                      valueLabelDisplay="auto"
                      valueLabelFormat={value => `${value}h`}
                    />
                  </Box>
                </CardContent>
              </Card>

              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Card elevation={0} className={classes.card}>
                    <CardContent className={classes.cardContent}>
                      <Typography variant="h6" className={classes.sectionTitle}>
                        Data connections
                      </Typography>
                      <FormControl variant="outlined" fullWidth>
                        <InputLabel id="data-connections-label">Connections</InputLabel>
                        <Select
                          labelId="data-connections-label"
                          multiple
                          value={dataConnectionIds}
                          onChange={handleDataConnectionsChange}
                          label="Connections"
                          renderValue={selected =>
                            (selected as string[])
                              .map(id =>
                                selectedProject?.dataConnections.find(
                                  connection => connection.id === id,
                                )?.name,
                              )
                              .filter(Boolean)
                              .join(', ')
                          }
                        >
                          {selectedProject?.dataConnections.map(connection => (
                            <MenuItem key={connection.id} value={connection.id}>
                              <Box display="flex" flexDirection="column">
                                <Typography variant="body1">{connection.name}</Typography>
                                <Typography variant="caption" color="textSecondary">
                                  {connection.uri}
                                </Typography>
                              </Box>
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Card elevation={0} className={classes.card}>
                    <CardContent className={classes.cardContent}>
                      <Typography variant="h6" className={classes.sectionTitle}>
                        Secrets
                      </Typography>
                      <FormControl variant="outlined" fullWidth>
                        <InputLabel id="secret-scopes-label">Secret scopes</InputLabel>
                        <Select
                          labelId="secret-scopes-label"
                          multiple
                          value={secretScopeIds}
                          onChange={handleSecretScopesChange}
                          label="Secret scopes"
                          renderValue={selected =>
                            (selected as string[])
                              .map(id =>
                                selectedProject?.secretScopes.find(scope => scope.id === id)?.name,
                              )
                              .filter(Boolean)
                              .join(', ')
                          }
                        >
                          {selectedProject?.secretScopes.map(scope => (
                            <MenuItem key={scope.id} value={scope.id}>
                              <Box display="flex" flexDirection="column">
                                <Typography variant="body1">{scope.name}</Typography>
                                <Typography variant="caption" color="textSecondary">
                                  {scope.provider}
                                </Typography>
                              </Box>
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              <Card elevation={0} className={classes.card}>
                <CardContent className={classes.cardContent}>
                  <Typography variant="h6" className={classes.sectionTitle}>
                    Persistence & metadata
                  </Typography>
                  <FormControlLabel
                    control={
                      <Checkbox
                        color="primary"
                        checked={keepUserData}
                        onChange={(_, checked) => setKeepUserData(checked)}
                      />
                    }
                    label="Keep my user data PVC"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        color="primary"
                        checked={attachProjectData}
                        onChange={(_, checked) => setAttachProjectData(checked)}
                      />
                    }
                    label="Attach project data volume"
                  />
                  <TextField
                    label="Notes for platform team"
                    value={notes}
                    onChange={event => setNotes(event.target.value)}
                    multiline
                    minRows={2}
                    variant="outlined"
                    fullWidth
                  />
                  <Accordion elevation={0} className={classes.advancedSection}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="subtitle1" className={classes.sectionTitle}>
                        Advanced placement
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                          <FormControl variant="outlined" fullWidth>
                            <InputLabel id="cluster-override-label">Cluster</InputLabel>
                            <Select
                              labelId="cluster-override-label"
                              value={clusterOverride || selectedProfile?.cluster.id || ''}
                              onChange={event => setClusterOverride(event.target.value as string)}
                              label="Cluster"
                            >
                              {uniqueClusters.map(cluster => (
                                <MenuItem key={cluster.id} value={cluster.id}>
                                  {cluster.name} · {cluster.region}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <TextField
                            label="Namespace"
                            value={namespaceOverride || selectedProfile?.namespace || ''}
                            onChange={event => setNamespaceOverride(event.target.value)}
                            variant="outlined"
                            fullWidth
                          />
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <TextField
                            label="Storage class"
                            value={storageClassOverride || selectedProfile?.storageClass || ''}
                            onChange={event => setStorageClassOverride(event.target.value)}
                            variant="outlined"
                            fullWidth
                          />
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <TextField
                            label="Network zone"
                            value={networkZoneOverride || selectedProfile?.networkZone || ''}
                            onChange={event => setNetworkZoneOverride(event.target.value)}
                            variant="outlined"
                            fullWidth
                          />
                        </Grid>
                      </Grid>
                    </AccordionDetails>
                  </Accordion>
                </CardContent>
              </Card>
            </div>

            <Card elevation={0} className={`${classes.card} ${classes.summaryCard}`}>
              <Box className={classes.summaryHeader}>
                <CloudQueueIcon color="primary" />
                <Typography variant="subtitle1" className={classes.sectionTitle}>
                  Launch summary
                </Typography>
              </Box>
              <Box className={classes.budgetMeter}>
                <Typography variant="body2" color="textSecondary">
                  Estimated cost
                </Typography>
                <Typography variant="h4">{estimatedCost} / hr</Typography>
                <Typography variant="caption" color="textSecondary">
                  Billed to {selectedProject?.displayName ?? 'Project'}
                </Typography>
              </Box>
              <Divider />
              <Box className={classes.budgetMeter}>
                <Typography variant="body2" color="textSecondary">
                  Project budget
                </Typography>
                <Typography variant="body1">
                  {formatCurrency(selectedProject?.budget.monthlyUsed ?? 0)} used of{' '}
                  {formatCurrency(selectedProject?.budget.monthlyLimit ?? 0)}
                </Typography>
                <LinearProgress variant="determinate" value={budgetPercent} />
              </Box>
              <Divider />
              <Box className={classes.summaryColumn}>
                <Box className={classes.summaryRow}>
                  <StorageIcon fontSize="small" />
                  <Typography variant="body2">
                    {keepUserData ? 'User data persisted' : 'Ephemeral user data'}
                  </Typography>
                </Box>
                <Box className={classes.summaryRow}>
                  <LockIcon fontSize="small" />
                  <Typography variant="body2">
                    Secrets: {secretScopeIds.length} scope(s)
                  </Typography>
                </Box>
              </Box>
              {error && (
                <WarningPanel severity="error" title="Workspace launch blocked">
                  {error}
                </WarningPanel>
              )}
              <Box className={classes.summaryActions}>
                <Button
                  type="submit"
                  color="primary"
                  variant="contained"
                  disabled={submitting || !selectedProject || !selectedProfile}
                >
                  Launch workspace
                </Button>
                {submitting && <Progress />}
              </Box>
            </Card>
          </div>
        </form>
      </Content>
    </Page>
  );
};
