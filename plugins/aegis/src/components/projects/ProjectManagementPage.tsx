import { FC, useMemo, useState } from 'react';
import {
  Content,
  ContentHeader,
  HeaderLabel,
  Page,
  StatusOK,
  StatusWarning,
} from '@backstage/core-components';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Card,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Select,
  Switch,
  TextField,
  Typography,
  makeStyles,
} from '@material-ui/core';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import AddCircleOutlineIcon from '@material-ui/icons/AddCircleOutline';
import PolicyIcon from '@material-ui/icons/Policy';
import SecurityIcon from '@material-ui/icons/Security';
import TimelineIcon from '@material-ui/icons/Timeline';
import { alertApiRef, useApi } from '@backstage/core-plugin-api';
import {
  ComputeProfileGrant,
  DataConnectionDefinition,
  ProjectDefinition,
  ProjectEnvironment,
  SecretScopeDefinition,
  projectCatalog,
  visibilityCopy,
} from './projectCatalog';

const useStyles = makeStyles(theme => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(3),
  },
  heroCard: {
    background: 'linear-gradient(135deg, rgba(79,70,229,0.22), rgba(14,165,233,0.16))',
    borderRadius: theme.shape.borderRadius * 2,
    padding: theme.spacing(4),
    border: `1px solid ${theme.palette.primary.main}33`,
    boxShadow: 'var(--aegis-card-shadow)',
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2.5),
  },
  heroTitle: {
    fontWeight: 700,
    letterSpacing: '-0.01em',
    fontSize: theme.typography.h4.fontSize,
  },
  heroActions: {
    display: 'flex',
    gap: theme.spacing(1.5),
    flexWrap: 'wrap',
  },
  layout: {
    display: 'grid',
    gridTemplateColumns: 'minmax(320px, 1fr) minmax(0, 1.5fr)',
    gap: theme.spacing(3),
    [theme.breakpoints.down('md')]: {
      gridTemplateColumns: '1fr',
    },
  },
  panel: {
    backgroundColor: 'var(--aegis-card-surface)',
    borderRadius: theme.shape.borderRadius,
    border: `1px solid var(--aegis-card-border)`,
    padding: theme.spacing(3),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  },
  panelHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
  },
  panelTitle: {
    fontWeight: 600,
    letterSpacing: '-0.01em',
  },
  projectList: {
    borderRadius: theme.shape.borderRadius,
    border: `1px solid var(--aegis-card-border)`,
    padding: theme.spacing(0.5),
  },
  listItem: {
    borderRadius: theme.shape.borderRadius,
    margin: theme.spacing(0.5, 0),
    '&.Mui-selected, &.Mui-selected:hover': {
      backgroundColor:
        theme.palette.type === 'dark'
          ? 'rgba(96, 165, 250, 0.18)'
          : 'rgba(96, 165, 250, 0.22)',
    },
  },
  computeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: theme.spacing(2),
  },
  computeCard: {
    borderRadius: theme.shape.borderRadius,
    border: `1px solid var(--aegis-card-border)`,
    padding: theme.spacing(2.5),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
    background:
      theme.palette.type === 'dark'
        ? 'rgba(148, 163, 184, 0.08)'
        : 'rgba(79, 70, 229, 0.05)',
  },
  computeHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: theme.spacing(1.5),
  },
  statPill: {
    fontWeight: 600,
    letterSpacing: '0.04em',
  },
  inlineList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
  },
  budgetGauge: {
    display: 'flex',
    gap: theme.spacing(2),
    alignItems: 'center',
  },
  badgeRow: {
    display: 'flex',
    gap: theme.spacing(1),
    flexWrap: 'wrap',
  },
  accordionRoot: {
    borderRadius: theme.shape.borderRadius,
    border: `1px solid var(--aegis-card-border)`,
    backgroundColor: 'var(--aegis-card-surface)',
  },
  dialogContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    marginTop: theme.spacing(1),
  },
  chipList: {
    display: 'flex',
    gap: theme.spacing(1),
    flexWrap: 'wrap',
  },
}));

const formatUsd = (value: number): string => `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

const budgetCopy = (budget: ProjectDefinition['budget']) =>
  `${formatUsd(budget.monthlyUsed)} / ${formatUsd(budget.monthlyLimit)}`;

const guardrailCopy = (guardrails: ProjectDefinition['guardrails']) =>
  `${guardrails.maxConcurrentWorkspaces} workspaces · ${guardrails.maxGpuCount} GPUs · ${formatUsd(
    guardrails.maxBudgetPerWorkspaceUsd,
  )} cap per workspace`;

const uniqueComputeProfiles = (): ComputeProfileGrant[] => {
  const registry = new Map<string, ComputeProfileGrant>();
  projectCatalog.forEach(project => {
    project.computeProfiles.forEach(profile => {
      if (!registry.has(profile.id)) {
        registry.set(profile.id, profile);
      }
    });
  });
  return Array.from(registry.values());
};

const uniqueDataConnections = (): DataConnectionDefinition[] => {
  const registry = new Map<string, DataConnectionDefinition>();
  projectCatalog.forEach(project => {
    project.dataConnections.forEach(connection => {
      if (!registry.has(connection.id)) {
        registry.set(connection.id, connection);
      }
    });
  });
  return Array.from(registry.values());
};

const uniqueSecretScopes = (): SecretScopeDefinition[] => {
  const registry = new Map<string, SecretScopeDefinition>();
  projectCatalog.forEach(project => {
    project.secretScopes.forEach(scope => {
      if (!registry.has(scope.id)) {
        registry.set(scope.id, scope);
      }
    });
  });
  return Array.from(registry.values());
};

const environmentCopy: Record<ProjectEnvironment, string> = {
  dev: 'Development',
  test: 'Test',
  prod: 'Production',
};

export const ProjectManagementPage: FC = () => {
  const classes = useStyles();
  const alertApi = useApi(alertApiRef);
  const [selectedProjectId, setSelectedProjectId] = useState(projectCatalog[0]?.id ?? '');
  const [createOpen, setCreateOpen] = useState(false);
  const [newProject, setNewProject] = useState({
    displayName: '',
    slug: '',
    environment: 'dev' as ProjectEnvironment,
    monthlyBudget: 5000,
    owners: '',
    includeProdAccount: true,
    computeProfiles: [] as string[],
    dataConnections: [] as string[],
    secretScopes: [] as string[],
  });

  const selectedProject = useMemo(
    () => projectCatalog.find(project => project.id === selectedProjectId) ?? projectCatalog[0],
    [selectedProjectId],
  );

  const computeProfiles = useMemo(() => uniqueComputeProfiles(), []);
  const dataConnections = useMemo(() => uniqueDataConnections(), []);
  const secretScopes = useMemo(() => uniqueSecretScopes(), []);

  const budgetUtilization = useMemo(() => {
    if (!selectedProject) {
      return 0;
    }
    return Math.min(100, Math.round((selectedProject.budget.monthlyUsed / selectedProject.budget.monthlyLimit) * 100));
  }, [selectedProject]);

  const handleCreateProject = (event: React.FormEvent) => {
    event.preventDefault();
    alertApi.post({
      message: `Project ${newProject.displayName || newProject.slug} staged with ${
        newProject.computeProfiles.length
      } compute profiles.`,
      severity: 'success',
    });
    setCreateOpen(false);
    setNewProject({
      displayName: '',
      slug: '',
      environment: 'dev',
      monthlyBudget: 5000,
      owners: '',
      includeProdAccount: true,
      computeProfiles: [],
      dataConnections: [],
      secretScopes: [],
    });
  };

  return (
    <Page themeId="tool">
      <Content>
        <ContentHeader title="Projects" subtitle="Budgets, guardrails, and access policies for ÆGIS workspaces.">
          <HeaderLabel label="Persona" value="Project Admin" />
          <HeaderLabel label="Budget" value={budgetCopy(selectedProject.budget)} />
        </ContentHeader>
        <div className={classes.root}>
          <Card className={classes.heroCard}>
            <Typography className={classes.heroTitle}>Project-centric controls with budget guardrails.</Typography>
            <Typography variant="body1" color="textSecondary">
              Projects wrap policies, data, and compute access. Launch workspaces confidently knowing each compute
              profile honors guardrails, chargeback tags, and compliance tiers across AWS, Azure, and GCP.
            </Typography>
            <div className={classes.heroActions}>
              <Button
                variant="contained"
                color="primary"
                startIcon={<AddCircleOutlineIcon />}
                onClick={() => setCreateOpen(true)}
              >
                Create Project
              </Button>
              <Button variant="outlined" color="primary">
                View Chargeback Reports
              </Button>
            </div>
          </Card>

          <div className={classes.layout}>
            <div>
              <div className={classes.panel}>
                <div className={classes.panelHeader}>
                  <Typography className={classes.panelTitle}>Projects</Typography>
                  <Chip
                    size="small"
                    label={`${projectCatalog.length} available`}
                    className={classes.statPill}
                    color="primary"
                  />
                </div>
                <Typography variant="body2" color="textSecondary">
                  Select a project to view budgets, compute access, and data guardrails.
                </Typography>
                <List className={classes.projectList} disablePadding>
                  {projectCatalog.map(project => (
                    <ListItem
                      button
                      key={project.id}
                      selected={selectedProject?.id === project.id}
                      onClick={() => setSelectedProjectId(project.id)}
                      className={classes.listItem}
                    >
                      <ListItemText
                        primary={project.name}
                        secondary={`${environmentCopy[project.environment]} · ${visibilityCopy[project.visibility].label}`}
                      />
                    </ListItem>
                  ))}
                </List>
              </div>
            </div>

            {selectedProject && (
              <div className={classes.panel}>
                <div className={classes.panelHeader}>
                  <Box display="flex" flexDirection="column" gap={4 / 8}>
                    <Typography variant="h5" className={classes.panelTitle}>
                      {selectedProject.name}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Slug {selectedProject.slug} · Environment {environmentCopy[selectedProject.environment]}
                    </Typography>
                  </Box>
                  <div className={classes.badgeRow}>
                    <Chip
                      label={`${budgetUtilization}% of budget`}
                      color={budgetUtilization > 90 ? 'secondary' : 'primary'}
                      icon={budgetUtilization > 90 ? <StatusWarning /> : <StatusOK />}
                    />
                    <Chip label={visibilityCopy[selectedProject.visibility].label} variant="outlined" />
                  </div>
                </div>
                <Typography variant="body1">{selectedProject.description}</Typography>
                <Divider />
                <div className={classes.budgetGauge}>
                  <TimelineIcon color="primary" />
                  <Box>
                    <Typography variant="subtitle2">Budget</Typography>
                    <Typography variant="body2" color="textSecondary">
                      {budgetCopy(selectedProject.budget)} · Lead {selectedProject.lead}
                    </Typography>
                  </Box>
                </div>
                {selectedProject.badges && selectedProject.badges.length > 0 && (
                  <div>
                    <Typography variant="subtitle2">Compliance</Typography>
                    <div className={classes.badgeRow}>
                      {selectedProject.badges.map(badge => (
                        <Chip key={badge} icon={<SecurityIcon />} label={badge} size="small" />
                      ))}
                    </div>
                  </div>
                )}
                {selectedProject.costAlerts && selectedProject.costAlerts.length > 0 && (
                  <div>
                    <Typography variant="subtitle2">Budget Alerts</Typography>
                    <div className={classes.badgeRow}>
                      {selectedProject.costAlerts.map(alert => (
                        <Chip key={alert} color="secondary" label={alert} size="small" />
                      ))}
                    </div>
                  </div>
                )}
                <Divider />
                <Typography variant="subtitle2">Compute access</Typography>
                <div className={classes.computeGrid}>
                  {selectedProject.computeProfiles.map(profile => (
                    <Box key={profile.id} className={classes.computeCard}>
                      <div className={classes.computeHeader}>
                        <Typography variant="h6">{profile.label}</Typography>
                        <Chip label={`${formatUsd(profile.hourlyRateUsd)}/hr`} color="primary" size="small" />
                      </div>
                      <Typography variant="body2" color="textSecondary">
                        {profile.description}
                      </Typography>
                      <div className={classes.inlineList}>
                        <Chip size="small" label={profile.gpu} />
                        <Chip size="small" label={profile.cpu} />
                        <Chip size="small" label={profile.memory} />
                        {profile.scratch ? <Chip size="small" label={profile.scratch} /> : null}
                      </div>
                      <Typography variant="caption" color="textSecondary">
                        Clusters: {profile.clusters.join(', ')}
                      </Typography>
                      <div className={classes.inlineList}>
                        <Chip size="small" label={`Queue: ${profile.queueId}`} variant="outlined" />
                        <Chip size="small" label={`Visibility: ${visibilityCopy[profile.visibility].label}`} variant="outlined" />
                      </div>
                      {profile.badges && profile.badges.length > 0 && (
                        <div className={classes.chipList}>
                          {profile.badges.map(badge => (
                            <Chip key={badge} size="small" label={badge} icon={<PolicyIcon />} />
                          ))}
                        </div>
                      )}
                    </Box>
                  ))}
                </div>

                <Divider />
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2">Data connections</Typography>
                    <div className={classes.inlineList}>
                      {selectedProject.dataConnections.map(connection => (
                        <Chip
                          key={connection.id}
                          label={`${connection.label}${connection.readOnly ? ' · read-only' : ''}`}
                          variant="outlined"
                        />
                      ))}
                    </div>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2">Secret scopes</Typography>
                    <div className={classes.inlineList}>
                      {selectedProject.secretScopes.map(scope => (
                        <Chip key={scope.id} label={`${scope.label} · ${scope.provider.toUpperCase()}`} variant="outlined" />
                      ))}
                    </div>
                  </Grid>
                </Grid>

                <Divider />
                <Typography variant="subtitle2">Guardrails</Typography>
                <Typography variant="body2" color="textSecondary">
                  {guardrailCopy(selectedProject.guardrails)}
                </Typography>

                <Accordion className={classes.accordionRoot} elevation={0} defaultExpanded>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="subtitle2">Activity &amp; chargeback preview</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Box display="flex" flexDirection="column" gap={1.5}>
                      <Typography variant="body2" color="textSecondary">
                        Chargeback exports include compute usage by profile, data egress, and persistent storage
                        retention. Export to finance or automate via API.
                      </Typography>
                      <Button variant="outlined" color="primary">
                        Export latest CSV
                      </Button>
                    </Box>
                  </AccordionDetails>
                </Accordion>
              </div>
            )}
          </div>
        </div>
      </Content>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create new Project</DialogTitle>
        <form onSubmit={handleCreateProject}>
          <DialogContent className={classes.dialogContent}>
            <Typography variant="body2" color="textSecondary">
              Define the project slug, environment, and which compute profiles and data connections it should inherit at
              launch. Guardrails and budgets are enforced automatically.
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Display name"
                  value={newProject.displayName}
                  onChange={event => setNewProject(prev => ({ ...prev, displayName: event.target.value }))}
                  fullWidth
                  required
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Project slug"
                  value={newProject.slug}
                  onChange={event => setNewProject(prev => ({ ...prev, slug: event.target.value }))}
                  helperText="org-proj-env (e.g. acme-vision-prod)"
                  fullWidth
                  required
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel id="new-project-environment-label">Environment</InputLabel>
                  <Select
                    labelId="new-project-environment-label"
                    label="Environment"
                    value={newProject.environment}
                    onChange={event =>
                      setNewProject(prev => ({ ...prev, environment: event.target.value as ProjectEnvironment }))
                    }
                  >
                    <MenuItem value="dev">Development</MenuItem>
                    <MenuItem value="test">Test</MenuItem>
                    <MenuItem value="prod">Production</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Monthly budget (USD)"
                  type="number"
                  value={newProject.monthlyBudget}
                  onChange={event =>
                    setNewProject(prev => ({ ...prev, monthlyBudget: Number(event.target.value ?? 0) }))
                  }
                  fullWidth
                  inputProps={{ min: 0 }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Project owners"
                  value={newProject.owners}
                  onChange={event => setNewProject(prev => ({ ...prev, owners: event.target.value }))}
                  helperText="List emails or IAM groups responsible for the project."
                  fullWidth
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      color="primary"
                      checked={newProject.includeProdAccount}
                      onChange={event =>
                        setNewProject(prev => ({ ...prev, includeProdAccount: event.target.checked }))
                      }
                    />
                  }
                  label="Provision dedicated production account"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel id="new-project-compute-label">Compute profiles</InputLabel>
                  <Select
                    labelId="new-project-compute-label"
                    label="Compute profiles"
                    value={newProject.computeProfiles}
                    onChange={event =>
                      setNewProject(prev => ({
                        ...prev,
                        computeProfiles: typeof event.target.value === 'string'
                          ? event.target.value.split(',')
                          : (event.target.value as string[]),
                      }))
                    }
                    multiple
                    renderValue={selected => (selected as string[]).map(id => `#${id}`).join(', ')}
                  >
                    {computeProfiles.map(profile => (
                      <MenuItem key={profile.id} value={profile.id}>
                        <Box display="flex" flexDirection="column">
                          <Typography variant="body1">{profile.label}</Typography>
                          <Typography variant="caption" color="textSecondary">
                            {`${formatUsd(profile.hourlyRateUsd)}/hr · ${profile.gpu}`}
                          </Typography>
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel id="new-project-data-label">Data connections</InputLabel>
                  <Select
                    labelId="new-project-data-label"
                    label="Data connections"
                    value={newProject.dataConnections}
                    onChange={event =>
                      setNewProject(prev => ({
                        ...prev,
                        dataConnections: typeof event.target.value === 'string'
                          ? event.target.value.split(',')
                          : (event.target.value as string[]),
                      }))
                    }
                    multiple
                    renderValue={selected => (selected as string[]).map(id => `#${id}`).join(', ')}
                  >
                    {dataConnections.map(connection => (
                      <MenuItem key={connection.id} value={connection.id}>
                        <Box display="flex" flexDirection="column">
                          <Typography variant="body1">{connection.label}</Typography>
                          <Typography variant="caption" color="textSecondary">
                            {connection.target}
                          </Typography>
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel id="new-project-secrets-label">Secret scopes</InputLabel>
                  <Select
                    labelId="new-project-secrets-label"
                    label="Secret scopes"
                    value={newProject.secretScopes}
                    onChange={event =>
                      setNewProject(prev => ({
                        ...prev,
                        secretScopes: typeof event.target.value === 'string'
                          ? event.target.value.split(',')
                          : (event.target.value as string[]),
                      }))
                    }
                    multiple
                    renderValue={selected => (selected as string[]).map(id => `#${id}`).join(', ')}
                  >
                    {secretScopes.map(scope => (
                      <MenuItem key={scope.id} value={scope.id}>
                        <Box display="flex" flexDirection="column">
                          <Typography variant="body1">{scope.label}</Typography>
                          <Typography variant="caption" color="textSecondary">
                            {scope.provider.toUpperCase()}
                          </Typography>
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit" color="primary" variant="contained" disabled={!newProject.slug || !newProject.displayName}>
              Create Project
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Page>
  );
};
