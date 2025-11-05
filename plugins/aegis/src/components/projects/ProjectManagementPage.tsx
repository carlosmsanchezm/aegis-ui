import { FC, useEffect, useMemo, useState } from 'react';
import {
  Content,
  ContentHeader,
  EmptyState,
  HeaderLabel,
  Page,
  Progress,
  StatusOK,
  StatusWarning,
  Table,
  TableColumn,
  WarningPanel,
} from '@backstage/core-components';
import { useRouteRef } from '@backstage/core-plugin-api';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Chip,
  Divider,
  Grid,
  List,
  ListItem,
  ListItemText,
  Paper,
  Typography,
  makeStyles,
} from '@material-ui/core';
import {
  ProjectDefinition,
  ProjectVisibility,
  QueueDefinition,
  visibilityCopy,
} from './projectCatalog';
import { useProvisioningCatalog } from '../../hooks/useProvisioningCatalog';
import { createClusterRouteRef } from '../../routes';

const useStyles = makeStyles(theme => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(3),
  },
  heroCard: {
    background: 'linear-gradient(135deg, rgba(99,102,241,0.24), rgba(14,165,233,0.16))',
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
  grid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(360px, 1fr) minmax(420px, 1.35fr)',
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
    flexDirection: 'column',
    gap: theme.spacing(0.5),
  },
  panelTitle: {
    fontWeight: 600,
    letterSpacing: '-0.01em',
  },
  tableWrapper: {
    borderRadius: theme.shape.borderRadius,
    overflow: 'hidden',
    border: `1px solid var(--aegis-card-border)`,
  },
  queueCard: {
    borderRadius: theme.shape.borderRadius,
    border: `1px solid var(--aegis-card-border)`,
    background:
      theme.palette.type === 'dark'
        ? 'rgba(148, 163, 184, 0.08)'
        : 'rgba(79, 70, 229, 0.04)',
    padding: theme.spacing(2.25),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.25),
  },
  queueGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: theme.spacing(2),
  },
  metricRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1.5),
  },
  mutedLabel: {
    color: theme.palette.text.secondary,
    fontSize: theme.typography.pxToRem(13),
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    fontWeight: 600,
  },
  emphasisValue: {
    fontWeight: 700,
    letterSpacing: '-0.02em',
    fontSize: theme.typography.pxToRem(18),
  },
  listRoot: {
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
  subtitle: {
    fontSize: theme.typography.pxToRem(13),
    color: theme.palette.text.secondary,
  },
  projectHero: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(2),
  },
  queueMeta: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: theme.spacing(1),
  },
  badgeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
}));

const normalizeVisibility = (value?: string | null): ProjectVisibility => {
  if (value === 'restricted' || value === 'internal' || value === 'public') {
    return value;
  }
  return 'internal';
};

const formatBudget = (budget?: { monthlyLimit: number; monthlyUsed: number }) => {
  if (!budget) {
    return '—';
  }
  const { monthlyLimit, monthlyUsed } = budget;
  if (!monthlyLimit && !monthlyUsed) {
    return '—';
  }
  return `$${monthlyUsed.toLocaleString('en-US')} / $${monthlyLimit.toLocaleString('en-US')}`;
};

const queueColumns: TableColumn<QueueDefinition>[] = [
  { title: 'Queue', field: 'name' },
  {
    title: 'Visibility',
    field: 'visibility',
    render: queue => visibilityCopy[queue.visibility].label,
  },
  {
    title: 'GPU Class',
    field: 'gpuClass',
  },
  {
    title: 'Active',
    field: 'activeWorkspaces',
    render: queue => `${queue.activeWorkspaces} live`,
  },
  {
    title: 'Budget',
    field: 'budget',
    render: queue => formatBudget(queue.budget),
  },
  {
    title: 'Max Runtime',
    field: 'maxRuntimeHours',
    render: queue => `${queue.maxRuntimeHours} hrs`,
  },
];

export const ProjectManagementPage: FC = () => {
  const classes = useStyles();
  const navigate = useNavigate();
  const createClusterLink = useRouteRef(createClusterRouteRef);
  const clusterProvisioningPath = createClusterLink();
  const { value: catalog, loading, error, retry } = useProvisioningCatalog();

  const [selectedProjectId, setSelectedProjectId] = useState('');

  const projects = useMemo<ProjectDefinition[]>(() => {
    if (!catalog) {
      return [];
    }

    const queuesByProject = new Map<string, QueueDefinition[]>();

    catalog.queues.forEach(queue => {
      const list = queuesByProject.get(queue.projectId) ?? [];
      list.push({
        id: queue.id,
        name: queue.name ?? queue.id,
        description: queue.description ?? 'No queue description provided.',
        visibility: normalizeVisibility(queue.visibility),
        gpuClass: queue.gpuClass ?? 'Unspecified',
        maxRuntimeHours: queue.maxRuntimeHours ?? 0,
        activeWorkspaces: queue.activeWorkspaces ?? 0,
        budget: {
          monthlyLimit: queue.budget?.monthlyLimit ?? 0,
          monthlyUsed: queue.budget?.monthlyUsed ?? 0,
        },
        clusterId: queue.clusterId,
      });
      queuesByProject.set(queue.projectId, list);
    });

    return catalog.projects.map(project => {
      const queues = queuesByProject.get(project.id) ?? [];
      const defaultQueue = project.defaultQueueId ?? queues[0]?.id ?? '';
      return {
        id: project.id,
        name: project.name ?? project.id,
        visibility: normalizeVisibility(project.visibility),
        description: project.description ?? 'No project description provided.',
        lead: project.lead ?? 'Unassigned',
        budget: {
          monthlyLimit: project.budget?.monthlyLimit ?? 0,
          monthlyUsed: project.budget?.monthlyUsed ?? 0,
        },
        defaultQueue,
        queues,
      };
    });
  }, [catalog]);

  useEffect(() => {
    if (projects.length === 0) {
      setSelectedProjectId('');
      return;
    }
    setSelectedProjectId(prev => {
      if (prev && projects.some(project => project.id === prev)) {
        return prev;
      }
      return projects[0].id;
    });
  }, [projects]);

  const selectedProject = useMemo(() => {
    if (projects.length === 0) {
      return null;
    }
    return projects.find(project => project.id === selectedProjectId) ?? projects[0];
  }, [projects, selectedProjectId]);

  const queueData = useMemo(() => selectedProject?.queues ?? [], [selectedProject]);

  const projectLead = selectedProject?.lead ?? '—';
  const projectBudget = selectedProject ? formatBudget(selectedProject.budget) : '—';
  const hasProjects = projects.length > 0;
  const hasQueues = queueData.length > 0;

  return (
    <Page themeId="tool">
      <Content>
        <ContentHeader title="Project governance">
          <HeaderLabel label="Budget owner" value={projectLead} />
          <HeaderLabel label="Monthly burn" value={projectBudget} />
        </ContentHeader>
        {loading && (
          <Box display="flex" justifyContent="center" paddingY={2}>
            <Progress />
          </Box>
        )}
        {!loading && error && (
          <Box marginBottom={2}>
            <WarningPanel severity="error" title="Failed to load provisioning data">
              Unable to retrieve projects or queues from ÆGIS.{' '}
              <Button color="primary" variant="outlined" onClick={() => retry()}>
                Retry
              </Button>
            </WarningPanel>
          </Box>
        )}
        <div className={classes.root}>
          <Paper className={classes.heroCard} elevation={0}>
            <div className={classes.heroTitle}>Balance autonomy with governance</div>
            <Typography variant="body1">
              Platform admins explicitly provision projects, queues, and clusters before teams
              launch workspaces. Use this console to confirm guardrails, adjust visibility, and
              tune budgets before handing access to mission owners.
            </Typography>
            <div className={classes.heroActions}>
              <Button
                variant="contained"
                color="primary"
                onClick={() => navigate(clusterProvisioningPath)}
              >
                Provision cluster
              </Button>
              <Button variant="outlined" color="primary">
                Adjust budget
              </Button>
              <Button variant="outlined">Export audit trail</Button>
            </div>
          </Paper>

          <div className={classes.grid}>
            <div className={classes.panel}>
              <div className={classes.panelHeader}>
                <Typography variant="h6" className={classes.panelTitle}>
                  Projects
                </Typography>
                <Typography className={classes.subtitle}>
                  Provision at least one project, queue, and cluster before opening the workspace
                  launchpad. Manage visibility, budgets, and guardrails from this catalog.
                </Typography>
              </div>
              {hasProjects ? (
                <List className={classes.listRoot} disablePadding>
                  {projects.map(project => {
                    const visibility = visibilityCopy[project.visibility];
                    const isSelected = project.id === selectedProject?.id;
                    return (
                      <ListItem
                        key={project.id}
                        button
                        selected={isSelected}
                        onClick={() => setSelectedProjectId(project.id)}
                        className={classes.listItem}
                      >
                        <ListItemText
                          primary={
                            <Box className={classes.projectHero}>
                              <span>{project.name}</span>
                              <Chip
                                label={visibility.label}
                                color={visibility.tone === 'default' ? 'default' : visibility.tone}
                                size="small"
                              />
                            </Box>
                          }
                          secondary={
                            <Typography variant="body2" color="textSecondary">
                              {formatBudget(project.budget)} — Lead: {project.lead}
                            </Typography>
                          }
                        />
                      </ListItem>
                    );
                  })}
                </List>
              ) : (
                !loading && (
                  <EmptyState
                    missing="data"
                    title="No projects provisioned"
                    description="Create a project, queue, and cluster before enabling workspace launches."
                    action={
                      <Button
                        variant="contained"
                        color="primary"
                        onClick={() => navigate(clusterProvisioningPath)}
                      >
                        Provision cluster
                      </Button>
                    }
                  />
                )
              )}
            </div>

            <div className={classes.panel}>
              {selectedProject ? (
                <>
                  <div className={classes.panelHeader}>
                    <Box className={classes.projectHero}>
                      <Typography variant="h6" className={classes.panelTitle}>
                        {selectedProject.name}
                      </Typography>
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
                    <Typography variant="body2" color="textSecondary">
                      {selectedProject.description}
                    </Typography>
                  </div>
                  <Divider />
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <div className={classes.metricRow}>
                        <span className={classes.mutedLabel}>Budget</span>
                        <span className={classes.emphasisValue}>{formatBudget(selectedProject.budget)}</span>
                      </div>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <div className={classes.metricRow}>
                        <span className={classes.mutedLabel}>Default queue</span>
                        <span className={classes.emphasisValue}>{selectedProject.defaultQueue}</span>
                      </div>
                    </Grid>
                  </Grid>
                  <Divider />
                  <Typography variant="subtitle1" className={classes.panelTitle}>
                    Queues
                  </Typography>
                  <div className={classes.queueGrid}>
                    {hasQueues ? (
                      queueData.map(queue => {
                        const visibility = visibilityCopy[queue.visibility];
                        const limit = queue.budget.monthlyLimit ?? 0;
                        const utilization = limit > 0 ? queue.budget.monthlyUsed / limit : 0;
                        const BudgetStatus = utilization > 0.85 ? StatusWarning : StatusOK;
                        return (
                          <div key={queue.id} className={classes.queueCard}>
                            <div className={classes.badgeRow}>
                              <Typography variant="subtitle1" className={classes.panelTitle}>
                                {queue.name}
                              </Typography>
                              <Chip
                                label={visibility.label}
                                color={visibility.tone === 'default' ? 'default' : visibility.tone}
                                size="small"
                              />
                            </div>
                            <Typography variant="body2" color="textSecondary">
                              {queue.description}
                            </Typography>
                            <div className={classes.queueMeta}>
                              <div>
                                <div className={classes.mutedLabel}>GPU class</div>
                                <div>{queue.gpuClass}</div>
                              </div>
                              <div>
                                <div className={classes.mutedLabel}>Max runtime</div>
                                <div>{queue.maxRuntimeHours} hrs</div>
                              </div>
                              <div>
                                <div className={classes.mutedLabel}>Active workspaces</div>
                                <div>{queue.activeWorkspaces}</div>
                              </div>
                              <div>
                                <div className={classes.mutedLabel}>Budget</div>
                                <div>{formatBudget(queue.budget)}</div>
                              </div>
                            </div>
                            <div className={classes.metricRow}>
                              <span className={classes.mutedLabel}>Utilization</span>
                              <BudgetStatus>{`${Math.round(utilization * 100)}%`}</BudgetStatus>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      !loading && (
                        <EmptyState
                          missing="data"
                          title="No queues configured"
                          description="Provision a queue connected to a cluster so workspace launches inherit the right guardrails."
                          action={
                            <Button
                              variant="contained"
                              color="primary"
                              onClick={() => navigate(clusterProvisioningPath)}
                            >
                              Provision cluster
                            </Button>
                          }
                        />
                      )
                    )}
                  </div>
                </>
              ) : (
                <Typography color="textSecondary">Select a project to view details.</Typography>
              )}
            </div>
          </div>

          <div className={classes.panel}>
            <div className={classes.panelHeader}>
              <Typography variant="h6" className={classes.panelTitle}>
                Queue roster
              </Typography>
              <Typography className={classes.subtitle}>
                Export-ready snapshot of queue guardrails and spend. Provision queues manually to
                align with project budgets, then adjust runtime ceilings or retire unused lanes as
                workloads evolve.
              </Typography>
            </div>
            <div className={classes.tableWrapper}>
              <Table
                options={{ paging: false, search: false, toolbar: false, draggable: false }}
                data={queueData}
                columns={queueColumns}
              />
            </div>
          </div>
        </div>
      </Content>
    </Page>
  );
};
