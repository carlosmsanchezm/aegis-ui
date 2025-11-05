import { FC, useMemo, useState } from 'react';
import {
  Content,
  ContentHeader,
  HeaderLabel,
  Page,
  StatusOK,
  StatusWarning,
  Table,
  TableColumn,
} from '@backstage/core-components';
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
import { projectCatalog, ProjectDefinition, QueueDefinition, visibilityCopy } from './projectCatalog';

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

const budgetCopy = (budget: ProjectDefinition['budget']) =>
  `$${budget.monthlyUsed.toLocaleString('en-US')} / $${budget.monthlyLimit.toLocaleString('en-US')}`;

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
    render: queue =>
      `$${queue.budget.monthlyUsed.toLocaleString('en-US')} / $${queue.budget.monthlyLimit.toLocaleString('en-US')}`,
  },
  {
    title: 'Max Runtime',
    field: 'maxRuntimeHours',
    render: queue => `${queue.maxRuntimeHours} hrs`,
  },
];

export const ProjectManagementPage: FC = () => {
  const classes = useStyles();
  const [selectedProjectId, setSelectedProjectId] = useState(projectCatalog[0]?.id ?? '');

  const selectedProject = useMemo(
    () => projectCatalog.find(project => project.id === selectedProjectId) ?? projectCatalog[0],
    [selectedProjectId],
  );

  const queueData = useMemo(() => selectedProject?.queues ?? [], [selectedProject]);

  return (
    <Page themeId="tool">
      <Content>
        <ContentHeader title="Project governance">
          <HeaderLabel label="Budget owner" value={selectedProject?.lead ?? '—'} />
          <HeaderLabel
            label="Monthly burn"
            value={selectedProject ? budgetCopy(selectedProject.budget) : '—'}
          />
        </ContentHeader>
        <div className={classes.root}>
          <Paper className={classes.heroCard} elevation={0}>
            <div className={classes.heroTitle}>Balance autonomy with governance</div>
            <Typography variant="body1">
              Auto-provisioned projects keep new teams moving, while this view gives platform
              leaders precise control over visibility, spending, and queue guardrails. Promote
              healthy defaults, then step in with budget or access adjustments only when needed.
            </Typography>
            <div className={classes.heroActions}>
              <Button variant="contained" color="primary">
                Create project
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
                  Auto-bootstrap ensures at least one project and queue exist. Admins can retag
                  visibility, shift budgets, or archive unused initiatives from here.
                </Typography>
              </div>
              <List className={classes.listRoot} disablePadding>
                {projectCatalog.map(project => {
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
                            {budgetCopy(project.budget)} — Lead: {project.lead}
                          </Typography>
                        }
                      />
                    </ListItem>
                  );
                })}
              </List>
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
                        <span className={classes.emphasisValue}>{budgetCopy(selectedProject.budget)}</span>
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
                    {queueData.map(queue => {
                      const visibility = visibilityCopy[queue.visibility];
                      const utilization = queue.budget.monthlyUsed / queue.budget.monthlyLimit;
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
                              <div>
                                <BudgetStatus />{' '}
                                ${queue.budget.monthlyUsed.toLocaleString('en-US')} / $
                                {queue.budget.monthlyLimit.toLocaleString('en-US')}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
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
                Export-ready snapshot of queue guardrails and spend. Auto-bootstrap creates a starter
                queue for every project — adjust runtime ceilings or retire unused queues anytime.
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
