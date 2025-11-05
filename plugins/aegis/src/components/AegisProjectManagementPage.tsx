import { FC, useEffect, useMemo, useState } from 'react';
import {
  Page,
  Content,
  ContentHeader,
  HeaderLabel,
  StatusOK,
  StatusWarning,
  StatusError,
  Table,
  TableColumn,
} from '@backstage/core-components';
import {
  Button,
  Chip,
  Divider,
  Grid,
  LinearProgress,
  makeStyles,
  Paper,
  Typography,
} from '@material-ui/core';
import { alpha } from '@material-ui/core/styles/colorManipulator';
import AssessmentIcon from '@material-ui/icons/Assessment';
import AddCircleOutlineIcon from '@material-ui/icons/AddCircleOutline';
import TuneIcon from '@material-ui/icons/Tune';

import {
  projectCatalog,
  ProjectSummary,
  QueueSummary,
  getDefaultProject,
} from './projectCatalog';

const useStyles = makeStyles(theme => ({
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(4),
    paddingBottom: theme.spacing(6),
  },
  hero: {
    color: theme.palette.text.secondary,
    maxWidth: 720,
  },
  card: {
    backgroundColor: 'var(--aegis-card-surface)',
    border: '1px solid var(--aegis-card-border)',
    borderRadius: theme.shape.borderRadius * 1.6,
    boxShadow: 'var(--aegis-card-shadow)',
    padding: theme.spacing(3),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(3),
  },
  tableWrapper: {
    '& [class*="MuiTableCell-root"]': {
      borderBottomColor: alpha(theme.palette.divider, 0.5),
    },
  },
  tableActionButton: {
    textTransform: 'none',
  },
  budgetProgress: {
    height: 8,
    borderRadius: theme.shape.borderRadius,
  },
  budgetCaption: {
    display: 'flex',
    justifyContent: 'space-between',
    color: theme.palette.text.secondary,
    fontSize: '0.85rem',
  },
  queueCard: {
    backgroundColor: theme.palette.type === 'dark'
      ? alpha('#0F172A', 0.75)
      : alpha(theme.palette.background.default, 0.75),
    borderRadius: theme.shape.borderRadius,
    border: `1px solid var(--aegis-card-border)`,
    padding: theme.spacing(2.5),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
  },
  queueHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: theme.spacing(2),
  },
  queueMeta: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    color: theme.palette.text.secondary,
  },
  queueChip: {
    fontWeight: 600,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  },
  queuePill: {
    borderRadius: 999,
    padding: theme.spacing(0.4, 1.25),
    backgroundColor:
      theme.palette.type === 'dark'
        ? alpha('#1F2937', 0.8)
        : alpha(theme.palette.common.white, 0.85),
    border: `1px solid var(--aegis-card-border)`,
    fontSize: '0.8rem',
    fontWeight: 600,
  },
  infoRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1.5),
    color: theme.palette.text.secondary,
    fontSize: '0.95rem',
  },
  detailHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: theme.spacing(2),
  },
  actionRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1.5),
  },
  queueList: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  },
  projectCell: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
  },
  projectCellHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  projectCellTitle: {
    fontWeight: 600,
  },
  projectCellMeta: {
    color: theme.palette.text.secondary,
  },
}));

const formatCurrency = (value: number) => `$${value.toLocaleString()}`;

const queueHealthComponent = (queue: QueueSummary) => {
  if (queue.health === 'healthy') {
    return <StatusOK>{'Healthy'}</StatusOK>;
  }
  if (queue.health === 'degraded') {
    return <StatusWarning>{'Degraded'}</StatusWarning>;
  }
  return <StatusError>{'Paused'}</StatusError>;
};

export const AegisProjectManagementPage: FC = () => {
  const classes = useStyles();
  const [projects, setProjects] = useState<ProjectSummary[]>(projectCatalog);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    getDefaultProject()?.id ?? projectCatalog[0]?.id ?? '',
  );

  useEffect(() => {
    const current = projects.find(project => project.id === selectedProjectId);
    if (!current && projects.length > 0) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  const selectedProject = useMemo(
    () =>
      projects.find(project => project.id === selectedProjectId) ??
      projects[0] ??
      null,
    [projects, selectedProjectId],
  );

  const projectColumns = useMemo<TableColumn<ProjectSummary>[]>(
    () => [
      {
        title: 'Project',
        field: 'name',
        highlight: true,
        render: row => {
          const percent = Math.min(
            100,
            Math.round((row.budget.consumed / row.budget.allocated) * 100),
          );
          return (
            <div className={classes.projectCell}>
              <div className={classes.projectCellHeader}>
                <Typography
                  variant="subtitle1"
                  className={classes.projectCellTitle}
                >
                  {row.name}
                </Typography>
                {row.isDefault ? (
                  <Chip
                    size="small"
                    label="Default"
                    color="primary"
                    className={classes.queueChip}
                  />
                ) : null}
              </div>
              <Typography variant="caption" className={classes.projectCellMeta}>
                {row.id}
              </Typography>
              <Typography variant="caption" className={classes.projectCellMeta}>
                {percent}% of {formatCurrency(row.budget.allocated)} consumed
              </Typography>
            </div>
          );
        },
      },
      {
        title: 'Visibility',
        field: 'visibility',
        render: row => (
          <Chip
            size="small"
            label={row.visibility}
            className={classes.queueChip}
          />
        ),
      },
      {
        title: 'Queues',
        field: 'queues',
        render: row => `${row.queues.length} active`,
      },
      {
        title: 'Actions',
        field: 'actions',
        sorting: false,
        render: row => (
          <Button
            variant="outlined"
            color="primary"
            size="small"
            className={classes.tableActionButton}
            onClick={() => {
              setProjects(prev =>
                prev.map(project => ({
                  ...project,
                  isDefault: project.id === row.id,
                })),
              );
              setSelectedProjectId(row.id);
            }}
            disabled={row.isDefault}
          >
            {row.isDefault ? 'Default' : 'Make default'}
          </Button>
        ),
      },
    ],
    [classes.queueChip, classes.tableActionButton],
  );

  const projectData = useMemo(() => projects, [projects]);

  const budgetPercent = selectedProject
    ? Math.min(
        100,
        Math.round(
          (selectedProject.budget.consumed / selectedProject.budget.allocated) *
            100,
        ),
      )
    : 0;

  return (
    <Page themeId="tool">
      <Content className={classes.content}>
        <ContentHeader title="Projects & Queue Governance">
          <HeaderLabel label="Timeframe" value={selectedProject?.budget.timeframe ?? 'FY24'} />
          <Typography variant="body1" className={classes.hero}>
            Daily users get auto-provisioned defaults for instant workspace launches.
            Admins retain clear controls to tune budgets, queue guardrails, and
            visibility as missions evolve.
          </Typography>
          <Button
            variant="outlined"
            color="primary"
            startIcon={<AddCircleOutlineIcon />}
            className={classes.tableActionButton}
          >
            New project
          </Button>
        </ContentHeader>

        <Grid container spacing={3}>
          <Grid item xs={12} lg={7}>
            <Paper elevation={0} className={`${classes.card} ${classes.tableWrapper}`}>
              <Typography variant="overline" color="textSecondary">
                Portfolio overview
              </Typography>
              <Table<ProjectSummary>
                options={{ paging: false, search: false, toolbar: false, padding: 'dense' }}
                data={projectData}
                columns={projectColumns}
                onRowClick={(_, row) => {
                  if (row) {
                    setSelectedProjectId(row.id);
                  }
                }}
              />
            </Paper>
          </Grid>

          <Grid item xs={12} lg={5}>
            <Paper elevation={0} className={classes.card}>
              <div className={classes.detailHeader}>
                <div>
                  <Typography variant="overline" color="textSecondary">
                    Project details
                  </Typography>
                  <Typography variant="h6">
                    {selectedProject?.name ?? 'Select a project'}
                  </Typography>
                </div>
                <Button
                  variant="outlined"
                  color="primary"
                  size="small"
                  startIcon={<TuneIcon />}
                  className={classes.tableActionButton}
                >
                  Adjust guardrails
                </Button>
              </div>

              {selectedProject ? (
                <>
                  <div className={classes.infoRow}>
                    <span>Owner: {selectedProject.owner}</span>
                    <span>Visibility: {selectedProject.visibility}</span>
                    <span>Mission: {selectedProject.missionFocus}</span>
                  </div>

                  <div>
                    <Typography variant="subtitle2">Budget utilization</Typography>
                    <LinearProgress
                      variant="determinate"
                      value={budgetPercent}
                      className={classes.budgetProgress}
                    />
                    <div className={classes.budgetCaption}>
                      <span>{formatCurrency(selectedProject.budget.consumed)} spent</span>
                      <span>
                        {formatCurrency(selectedProject.budget.allocated)} cap ({
                          budgetPercent
                        }%)
                      </span>
                    </div>
                  </div>

                  <Divider />

                  <Typography variant="subtitle2">Queues & guardrails</Typography>
                  <div className={classes.queueList}>
                    {selectedProject.queues.map(queue => {
                      const utilization = Math.round(queue.utilization * 100);
                      return (
                        <div key={`${selectedProject.id}-${queue.id}`} className={classes.queueCard}>
                          <div className={classes.queueHeader}>
                            <div>
                              <Typography variant="subtitle1">{queue.name}</Typography>
                              <Typography variant="caption" color="textSecondary">
                                {queue.description}
                              </Typography>
                            </div>
                            {queueHealthComponent(queue)}
                          </div>
                          <div className={classes.queueMeta}>
                            <Chip
                              size="small"
                              label={queue.discipline.toUpperCase()}
                              className={classes.queueChip}
                            />
                            <span className={classes.queuePill}>
                              Concurrency {queue.concurrency}
                            </span>
                            <span className={classes.queuePill}>
                              Utilization {utilization}%
                            </span>
                            {queue.budgetGuardrail ? (
                              <span className={classes.queuePill}>
                                {queue.budgetGuardrail}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <Typography variant="body2" color="textSecondary">
                  Select a project to review budgets, visibility, and queue policy.
                </Typography>
              )}

              <Divider />

              <div className={classes.actionRow}>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<AssessmentIcon />}
                >
                  Export usage report
                </Button>
                <Button variant="text" color="primary">
                  View audit log
                </Button>
              </div>
            </Paper>
          </Grid>
        </Grid>
      </Content>
    </Page>
  );
};
