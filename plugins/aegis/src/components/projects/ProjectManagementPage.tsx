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
  Divider,
  Grid,
  List,
  ListItem,
  ListItemText,
  Typography,
  makeStyles,
} from '@material-ui/core';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import AddCircleOutlineIcon from '@material-ui/icons/AddCircleOutline';
import PolicyIcon from '@material-ui/icons/Policy';
import SecurityIcon from '@material-ui/icons/Security';
import TimelineIcon from '@material-ui/icons/Timeline';
import { Link as RouterLink } from 'react-router-dom';
import {
  ProjectDefinition,
  ProjectEnvironment,
  projectManagementCatalog,
  visibilityCopy,
} from './projectManagementCatalog';

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
  panelMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
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
  chargebackCopy: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
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

const environmentCopy: Record<ProjectEnvironment, string> = {
  dev: 'Development',
  test: 'Test',
  prod: 'Production',
};

export const ProjectManagementPage: FC = () => {
  const classes = useStyles();
  const [selectedProjectId, setSelectedProjectId] = useState(projectManagementCatalog[0]?.id ?? '');

  const selectedProject = useMemo(
    () => projectManagementCatalog.find(project => project.id === selectedProjectId) ?? projectManagementCatalog[0],
    [selectedProjectId],
  );

  const budgetUtilization = useMemo(() => {
    if (!selectedProject) {
      return 0;
    }
    return Math.min(100, Math.round((selectedProject.budget.monthlyUsed / selectedProject.budget.monthlyLimit) * 100));
  }, [selectedProject]);

  return (
    <Page themeId="tool">
      <Content>
        <ContentHeader title="Projects">
          <Typography variant="body2" color="textSecondary">
            Budgets, guardrails, and access policies for ÆGIS workspaces.
          </Typography>
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
                component={RouterLink}
                to="/aegis/admin/projects/create"
                variant="contained"
                color="primary"
                startIcon={<AddCircleOutlineIcon />}
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
                    label={`${projectManagementCatalog.length} available`}
                    className={classes.statPill}
                    color="primary"
                  />
                </div>
                <Typography variant="body2" color="textSecondary">
                  Select a project to view budgets, compute access, and data guardrails.
                </Typography>
                <List className={classes.projectList} disablePadding>
                  {projectManagementCatalog.map(project => (
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
                  <div className={classes.panelMeta}>
                    <Typography variant="h5" className={classes.panelTitle}>
                      {selectedProject.name}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Slug {selectedProject.slug} · Environment {environmentCopy[selectedProject.environment]}
                    </Typography>
                  </div>
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
                    <div className={classes.chargebackCopy}>
                      <Typography variant="body2" color="textSecondary">
                        Chargeback exports include compute usage by profile, data egress, and persistent storage
                        retention. Export to finance or automate via API.
                      </Typography>
                      <Button variant="outlined" color="primary">
                        Export latest CSV
                      </Button>
                    </div>
                  </AccordionDetails>
                </Accordion>
              </div>
            )}
          </div>
        </div>
      </Content>

    </Page>
  );
};
