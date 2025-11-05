import { FC, useEffect, useMemo, useState } from 'react';
import { Page, Content, ContentHeader, Progress, WarningPanel } from '@backstage/core-components';
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
  Card,
  Checkbox,
  Chip,
  Collapse,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  Link,
  MenuItem,
  Select,
  Switch,
  TextField,
  Typography,
  makeStyles,
} from '@material-ui/core';
import { alpha } from '@material-ui/core/styles/colorManipulator';
import LaunchIcon from '@material-ui/icons/PlayArrow';
import SettingsIcon from '@material-ui/icons/Settings';
import ShieldIcon from '@material-ui/icons/Security';
import MonetizationOnIcon from '@material-ui/icons/MonetizationOn';
import StorageIcon from '@material-ui/icons/Storage';
import { useNavigate } from 'react-router-dom';
import {
  AuthenticationError,
  AuthorizationError,
  CreateWorkspaceRequest,
  createWorkspace,
} from '../api/aegisClient';
import { keycloakAuthApiRef } from '../api/refs';
import { projectManagementRouteRef, workloadsRouteRef } from '../routes';
import { projectCatalog } from './projects/projectCatalog';

const useStyles = makeStyles(theme => ({
  layout: {
    display: 'grid',
    gridTemplateColumns: 'minmax(340px, 1fr) minmax(420px, 1.2fr)',
    gap: theme.spacing(3),
    [theme.breakpoints.down('md')]: {
      gridTemplateColumns: '1fr',
    },
  },
  section: {
    backgroundColor: 'var(--aegis-card-surface)',
    borderRadius: theme.shape.borderRadius,
    border: `1px solid var(--aegis-card-border)`,
    padding: theme.spacing(3),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2.5),
  },
  hero: {
    background: 'linear-gradient(135deg, rgba(14,165,233,0.18), rgba(79,70,229,0.24))',
    borderRadius: theme.shape.borderRadius * 1.5,
    border: `1px solid ${alpha(theme.palette.primary.main, 0.32)}`,
    padding: theme.spacing(4),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  },
  heroTitle: {
    fontSize: theme.typography.h4.fontSize,
    fontWeight: 700,
    letterSpacing: '-0.01em',
  },
  chipRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
  },
  computeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: theme.spacing(2),
  },
  computeCard: {
    borderRadius: theme.shape.borderRadius,
    border: `1px solid var(--aegis-card-border)`,
    padding: theme.spacing(2.25),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.25),
    backgroundColor: alpha(theme.palette.primary.main, theme.palette.type === 'dark' ? 0.18 : 0.08),
    cursor: 'pointer',
    transition: 'box-shadow 150ms ease, transform 150ms ease',
    '&:hover': {
      boxShadow: 'var(--aegis-card-shadow)',
      transform: 'translateY(-2px)',
    },
  },
  computeCardActive: {
    boxShadow: 'var(--aegis-card-shadow)',
    borderColor: theme.palette.primary.main,
  },
  advancedRoot: {
    backgroundColor: alpha(theme.palette.info.main, theme.palette.type === 'dark' ? 0.22 : 0.06),
    borderRadius: theme.shape.borderRadius,
    padding: theme.spacing(2),
    border: `1px dashed ${alpha(theme.palette.info.main, 0.4)}`,
  },
  costCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
  },
  inlineList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
  },
}));

const formatUsd = (value: number): string =>
  `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const workspaceTemplates = [
  {
    id: 'vscode-python',
    label: 'VS Code · Python 3.11',
    description: 'Full IDE with CUDA toolkit, poetry, and debugging helpers.',
    image: 'ghcr.io/aegis/workspace-vscode-python:3.11',
    ports: [22, 11111],
    env: { EDITOR: 'code' },
    recommendedProfiles: ['gpu-a10-balanced', 'gpu-l40s-sprint', 'gpu-rtx-validation'],
  },
  {
    id: 'jupyter-lab',
    label: 'JupyterLab · PyTorch',
    description: 'GPU-accelerated notebook stack with torch, rapids, and sagemaker tooling.',
    image: 'ghcr.io/aegis/workspace-jupyter-pytorch:latest',
    ports: [22, 8888],
    env: { NOTEBOOK_TOKEN: 'aegis' },
    recommendedProfiles: ['gpu-a10-balanced', 'gpu-a100-burst', 'gpu-l40s-sprint'],
  },
  {
    id: 'cli-shell',
    label: 'Mission CLI',
    description: 'Lightweight shell with kubectl, helm, aws, az, and gcloud CLIs pre-installed.',
    image: 'ghcr.io/aegis/workspace-cli:latest',
    ports: [22],
    env: {},
    recommendedProfiles: ['gpu-rtx-validation', 'gpu-a40-lab'],
  },
];

export const LaunchWorkspacePage: FC = () => {
  const classes = useStyles();
  const fetchApi = useApi(fetchApiRef);
  const discoveryApi = useApi(discoveryApiRef);
  const identityApi = useApi(identityApiRef);
  const authApi = useApi(keycloakAuthApiRef);
  const alertApi = useApi(alertApiRef);
  const navigate = useNavigate();
  const workloadsRoute = useRouteRef(workloadsRouteRef);
  const manageProjectsRoute = useRouteRef(projectManagementRouteRef);

  const [selectedProjectId, setSelectedProjectId] = useState(projectCatalog[0]?.id ?? '');
  const [selectedComputeProfileId, setSelectedComputeProfileId] = useState<string | null>(
    projectCatalog[0]?.defaultComputeProfile ?? null,
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState(workspaceTemplates[0]?.id ?? '');
  const [workspaceName, setWorkspaceName] = useState('');
  const [persistence, setPersistence] = useState({ userData: true, projectData: false });
  const [selectedDataConnections, setSelectedDataConnections] = useState<string[]>([]);
  const [selectedSecretScopes, setSelectedSecretScopes] = useState<string[]>([]);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [clusterOverride, setClusterOverride] = useState('');
  const [gpuOverride, setGpuOverride] = useState('');
  const [namespaceOverride, setNamespaceOverride] = useState('');
  const [storageClass, setStorageClass] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedProject = useMemo(
    () => projectCatalog.find(project => project.id === selectedProjectId) ?? projectCatalog[0],
    [selectedProjectId],
  );

  const computeProfiles = selectedProject?.computeProfiles ?? [];
  const selectedComputeProfile = useMemo(
    () => computeProfiles.find(profile => profile.id === selectedComputeProfileId) ?? computeProfiles[0],
    [computeProfiles, selectedComputeProfileId],
  );

  const selectedTemplate = useMemo(
    () => workspaceTemplates.find(template => template.id === selectedTemplateId) ?? workspaceTemplates[0],
    [selectedTemplateId],
  );

  useEffect(() => {
    if (selectedProject) {
      setSelectedComputeProfileId(selectedProject.defaultComputeProfile);
      setSelectedDataConnections(selectedProject.dataConnections.map(connection => connection.id));
      setSelectedSecretScopes(selectedProject.secretScopes.map(scope => scope.id));
    }
  }, [selectedProjectId]);

  const hourlyEstimate = useMemo(() => {
    if (!selectedComputeProfile) {
      return 0;
    }
    let multiplier = 1;
    if (persistence.userData) {
      multiplier += 0.05;
    }
    if (persistence.projectData) {
      multiplier += 0.12;
    }
    return selectedComputeProfile.hourlyRateUsd * multiplier;
  }, [selectedComputeProfile, persistence]);

  const policySignals = useMemo(() => {
    const items: string[] = [];
    if (selectedComputeProfile?.badges) {
      items.push(...selectedComputeProfile.badges);
    }
    if (selectedProject?.guardrails.maxConcurrentWorkspaces) {
      items.push(`${selectedProject.guardrails.maxConcurrentWorkspaces} workspace limit`);
    }
    items.push(`${selectedProject?.guardrails.maxGpuCount ?? 0} GPU cap`);
    return items;
  }, [selectedComputeProfile, selectedProject]);

  const handleComputeProfileSelect = (profileId: string) => {
    setSelectedComputeProfileId(profileId);
  };

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedProject || !selectedComputeProfile || !selectedTemplate) {
      return;
    }
    setSubmitting(true);
    setError(null);

    const env: Record<string, string> = {
      ...selectedTemplate.env,
      ...(selectedDataConnections.length > 0
        ? { AEGIS_DATA_CONNECTIONS: selectedDataConnections.join(',') }
        : {}),
      ...(selectedSecretScopes.length > 0 ? { AEGIS_SECRETS: selectedSecretScopes.join(',') } : {}),
      PERSIST_USER_DATA: persistence.userData ? 'true' : 'false',
      PERSIST_PROJECT_DATA: persistence.projectData ? 'true' : 'false',
      ...(clusterOverride ? { AEGIS_CLUSTER_OVERRIDE: clusterOverride } : {}),
      ...(gpuOverride ? { AEGIS_GPU_OVERRIDE: gpuOverride } : {}),
      ...(namespaceOverride ? { AEGIS_NAMESPACE: namespaceOverride } : {}),
      ...(storageClass ? { AEGIS_STORAGE_CLASS: storageClass } : {}),
    };

    const request: CreateWorkspaceRequest = {
      projectId: selectedProject.id,
      queue: selectedComputeProfile.queueId,
      workspace: {
        flavor: selectedComputeProfile.flavorId,
        image: selectedTemplate.image,
        interactive: true,
        ports: selectedTemplate.ports,
        env,
      },
    };

    if (workspaceName.trim().length > 0) {
      request.workspaceId = `${selectedProject.slug}-${workspaceName.trim().replace(/\s+/g, '-').toLowerCase()}`;
    }

    try {
      await createWorkspace(fetchApi, discoveryApi, identityApi, authApi, request);
      alertApi.post({
        message: 'Workspace launch requested. Track status in Workloads.',
        severity: 'success',
      });
      navigate(workloadsRoute());
    } catch (e: unknown) {
      let message = 'Failed to submit workspace launch.';
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

  const manageProjectsHref = manageProjectsRoute();

  return (
    <Page themeId="tool">
      <Content>
        <ContentHeader
          title="Launch Workspace"
          subtitle="Pick a project, choose a compute profile, and we will schedule the workspace on the best cluster."
        >
          <Chip
            label={`${selectedProject?.slug ?? ''}`}
            size="small"
            color="primary"
            style={{ fontWeight: 600 }}
          />
        </ContentHeader>

        <form onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Card className={classes.hero}>
                <Typography className={classes.heroTitle}>Project-first launch with budget signals built in.</Typography>
                <Typography variant="body1" color="textSecondary">
                  Workspaces inherit project guardrails, data access, and secret scopes. Override clusters or GPU SKUs only
                  when advanced controls are expanded.
                </Typography>
                <div className={classes.chipRow}>
                  {policySignals.map(signal => (
                    <Chip key={signal} icon={<ShieldIcon />} label={signal} size="small" />
                  ))}
                </div>
              </Card>
            </Grid>
          </Grid>

          <div className={classes.layout}>
            <div className={classes.section}>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="h6">Project</Typography>
                <Link component="button" onClick={() => navigate(manageProjectsHref)} color="primary">
                  Manage Projects
                </Link>
              </Box>
              <FormControl fullWidth>
                <InputLabel id="project-select-label">Project</InputLabel>
                <Select
                  labelId="project-select-label"
                  label="Project"
                  value={selectedProject?.id ?? ''}
                  onChange={event => setSelectedProjectId(event.target.value as string)}
                >
                  {projectCatalog.map(project => (
                    <MenuItem key={project.id} value={project.id}>
                      <Box display="flex" flexDirection="column">
                        <Typography variant="body1">{project.name}</Typography>
                        <Typography variant="caption" color="textSecondary">
                          {`${project.slug} · ${project.environment.toUpperCase()} · ${project.budget.monthlyUsed.toLocaleString('en-US')} of ${project.budget.monthlyLimit.toLocaleString('en-US')}`}
                        </Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                label="Workspace purpose"
                value={workspaceName}
                onChange={event => setWorkspaceName(event.target.value)}
                helperText={`Workspace name will be ${selectedProject?.slug ?? 'project'}-${
                  workspaceName ? workspaceName.replace(/\s+/g, '-').toLowerCase() : '<purpose>'
                }-xxxxx`}
                fullWidth
              />

              <Divider />

              <Typography variant="subtitle2">Data connections</Typography>
              <div className={classes.inlineList}>
                {selectedProject?.dataConnections.map(connection => {
                  const checked = selectedDataConnections.includes(connection.id);
                  return (
                    <FormControlLabel
                      key={connection.id}
                      control={
                        <Checkbox
                          color="primary"
                          checked={checked}
                          onChange={event => {
                            setSelectedDataConnections(prev =>
                              event.target.checked
                                ? [...prev, connection.id]
                                : prev.filter(id => id !== connection.id),
                            );
                          }}
                        />
                      }
                      label={`${connection.label}${connection.readOnly ? ' · read-only' : ''}`}
                    />
                  );
                })}
              </div>

              <Typography variant="subtitle2">Secrets</Typography>
              <div className={classes.inlineList}>
                {selectedProject?.secretScopes.map(scope => {
                  const checked = selectedSecretScopes.includes(scope.id);
                  return (
                    <FormControlLabel
                      key={scope.id}
                      control={
                        <Checkbox
                          color="primary"
                          checked={checked}
                          onChange={event => {
                            setSelectedSecretScopes(prev =>
                              event.target.checked
                                ? [...prev, scope.id]
                                : prev.filter(id => id !== scope.id),
                            );
                          }}
                        />
                      }
                      label={`${scope.label} · ${scope.provider.toUpperCase()}`}
                    />
                  );
                })}
              </div>

              <Divider />

              <Typography variant="subtitle2">Persistence</Typography>
              <FormControlLabel
                control={
                  <Switch
                    color="primary"
                    checked={persistence.userData}
                    onChange={event => setPersistence(prev => ({ ...prev, userData: event.target.checked }))}
                  />
                }
                label="Keep my user data (home PVC)"
              />
              <FormControlLabel
                control={
                  <Switch
                    color="primary"
                    checked={persistence.projectData}
                    onChange={event => setPersistence(prev => ({ ...prev, projectData: event.target.checked }))}
                  />
                }
                label="Attach project data PVC"
              />
            </div>

            <div className={classes.section}>
              <Typography variant="h6">Compute profile</Typography>
              <Typography variant="body2" color="textSecondary">
                Friendly profiles hide instance types and nodegroups. AEGIS schedules onto the right cluster while keeping
                budgets visible.
              </Typography>
              <div className={classes.computeGrid}>
                {computeProfiles.map(profile => {
                  const active = selectedComputeProfile?.id === profile.id;
                  return (
                    <Card
                      key={profile.id}
                      className={`${classes.computeCard} ${active ? classes.computeCardActive : ''}`}
                      onClick={() => handleComputeProfileSelect(profile.id)}
                    >
                      <Typography variant="subtitle1">{profile.label}</Typography>
                      <Typography variant="body2" color="textSecondary">
                        {profile.description}
                      </Typography>
                      <div className={classes.inlineList}>
                        <Chip size="small" label={profile.gpu} />
                        <Chip size="small" label={profile.cpu} />
                        <Chip size="small" label={profile.memory} />
                        {profile.scratch ? <Chip size="small" label={profile.scratch} /> : null}
                      </div>
                      <div className={classes.inlineList}>
                        <Chip size="small" label={`${formatUsd(profile.hourlyRateUsd)}/hr`} color="primary" />
                        <Chip size="small" label={`Cluster: ${profile.clusters.join(', ')}`} variant="outlined" />
                      </div>
                      {profile.badges && profile.badges.length > 0 && (
                        <div className={classes.inlineList}>
                          {profile.badges.map(badge => (
                            <Chip key={badge} size="small" label={badge} icon={<ShieldIcon />} />
                          ))}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>

              <Divider />

              <Typography variant="subtitle2">Workspace image</Typography>
              <div className={classes.computeGrid}>
                {workspaceTemplates.map(template => {
                  const active = selectedTemplate?.id === template.id;
                  return (
                    <Card
                      key={template.id}
                      className={`${classes.computeCard} ${active ? classes.computeCardActive : ''}`}
                      onClick={() => handleTemplateSelect(template.id)}
                    >
                      <Typography variant="subtitle1">{template.label}</Typography>
                      <Typography variant="body2" color="textSecondary">
                        {template.description}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        Recommended for: {template.recommendedProfiles.join(', ')}
                      </Typography>
                    </Card>
                  );
                })}
              </div>

              <Divider />

              <Box className={classes.costCard}>
                <Typography variant="subtitle2">Estimated cost &amp; guardrails</Typography>
                <div className={classes.inlineList}>
                  <Chip icon={<MonetizationOnIcon />} label={`${formatUsd(hourlyEstimate)}/hr`} color="primary" />
                  <Chip label={`Monthly budget ${formatUsd(selectedProject?.budget.monthlyLimit ?? 0)}`} variant="outlined" />
                  <Chip label={`Spend ${formatUsd(selectedProject?.budget.monthlyUsed ?? 0)}`} variant="outlined" />
                  <Chip icon={<StorageIcon />} label={persistence.projectData ? 'Project PVC attached' : 'Ephemeral only'} />
                </div>
              </Box>

              <Divider />

              <Box>
                <Button
                  type="button"
                  startIcon={<SettingsIcon />}
                  onClick={() => setAdvancedOpen(open => !open)}
                >
                  {advancedOpen ? 'Hide advanced' : 'Show advanced'}
                </Button>
                <Collapse in={advancedOpen} timeout="auto" unmountOnExit>
                  <Box marginTop={2} className={classes.advancedRoot}>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <TextField
                          label="Cluster override"
                          value={clusterOverride}
                          onChange={event => setClusterOverride(event.target.value)}
                          helperText="Optional — stick this workspace to a specific cluster"
                          fullWidth
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          label="GPU SKU"
                          value={gpuOverride}
                          onChange={event => setGpuOverride(event.target.value)}
                          helperText="Expose the exact GPU type if policy allows"
                          fullWidth
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          label="Namespace"
                          value={namespaceOverride}
                          onChange={event => setNamespaceOverride(event.target.value)}
                          helperText="Default mirrors workspace name"
                          fullWidth
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          label="Storage class"
                          value={storageClass}
                          onChange={event => setStorageClass(event.target.value)}
                          helperText="Override storage policy for attached PVCs"
                          fullWidth
                        />
                      </Grid>
                    </Grid>
                  </Box>
                </Collapse>
              </Box>
            </div>
          </div>

          <Grid container spacing={3} style={{ marginTop: 24 }}>
            <Grid item xs={12} md={8}>
              {error && (
                <WarningPanel severity="error" title="Unable to launch workspace">
                  {error}
                </WarningPanel>
              )}
            </Grid>
            <Grid item xs={12} md={4}>
              <Button
                type="submit"
                color="primary"
                variant="contained"
                size="large"
                startIcon={<LaunchIcon />}
                disabled={submitting || !selectedProject || !selectedComputeProfile}
                fullWidth
              >
                {submitting ? <Progress /> : 'Launch Workspace'}
              </Button>
            </Grid>
          </Grid>
        </form>
      </Content>
    </Page>
  );
};
