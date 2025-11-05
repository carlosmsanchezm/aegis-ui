import { useMemo } from 'react';
import {
  Page,
  Content,
  ContentHeader,
  HeaderLabel,
  Table,
  TableColumn,
  InfoCard,
} from '@backstage/core-components';
import {
  Box,
  Chip,
  Grid,
  Typography,
  makeStyles,
} from '@material-ui/core';
import AssignmentTurnedInIcon from '@material-ui/icons/AssignmentTurnedIn';
import VisibilityIcon from '@material-ui/icons/Visibility';
import TimelineIcon from '@material-ui/icons/Timeline';

import {
  ProjectProfile,
  ProjectQueueProfile,
  projectProfiles,
  projectVisibilityLabels,
} from './projectCatalog';

const useStyles = makeStyles(theme => ({
  content: {
    paddingBottom: theme.spacing(6),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(3),
  },
  card: {
    backgroundColor: 'var(--aegis-card-surface)',
    border: '1px solid var(--aegis-card-border)',
    borderRadius: theme.shape.borderRadius,
    boxShadow: 'var(--aegis-card-shadow)',
    padding: theme.spacing(3),
    height: '100%',
  },
  sectionTitle: {
    marginBottom: theme.spacing(2),
  },
  visibilityChip: {
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  queueFlavors: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
  },
  queueChip: {
    fontWeight: 600,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  insightsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
    marginTop: theme.spacing(1.5),
  },
  insightRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing(1.5),
  },
  insightIcon: {
    color: theme.palette.primary.main,
  },
}));

type QueueRow = ProjectQueueProfile & {
  projectId: string;
  projectName: string;
  visibility: string;
};

export const AegisProjectManagementPage = () => {
  const classes = useStyles();

  const projectColumns = useMemo<TableColumn<ProjectProfile>[]>(
    () => [
      {
        title: 'Project',
        render: project => (
          <Box display="flex" flexDirection="column" gap={0.5}>
            <Typography variant="subtitle1">{project.name}</Typography>
            <Typography variant="caption" color="textSecondary">
              {project.id}
            </Typography>
          </Box>
        ),
        customSort: (a, b) => a.name.localeCompare(b.name),
      },
      {
        title: 'Visibility',
        render: project => (
          <Chip
            size="small"
            label={projectVisibilityLabels[project.visibility]}
            variant="outlined"
            className={classes.visibilityChip}
          />
        ),
        customSort: (a, b) =>
          projectVisibilityLabels[a.visibility].localeCompare(
            projectVisibilityLabels[b.visibility],
          ),
      },
      {
        title: 'Sponsor',
        field: 'sponsor',
      },
      {
        title: 'Budget',
        render: project => (
          <Typography variant="body2">
            {project.budget.used} / {project.budget.committed}
          </Typography>
        ),
        customSort: (a, b) =>
          a.budget.used.localeCompare(b.budget.used, undefined, { numeric: true }),
      },
      {
        title: 'Renews',
        render: project => (
          <Typography variant="body2">{project.budget.renews}</Typography>
        ),
      },
      {
        title: 'Queues',
        render: project => (
          <Typography variant="body2">{project.queues.length}</Typography>
        ),
        customSort: (a, b) => a.queues.length - b.queues.length,
      },
    ],
    [classes.visibilityChip],
  );

  const queueRows = useMemo<QueueRow[]>(
    () =>
      projectProfiles.flatMap(project =>
        project.queues.map(queue => ({
          ...queue,
          projectId: project.id,
          projectName: project.name,
          visibility: projectVisibilityLabels[project.visibility],
        })),
      ),
    [],
  );

  const queueColumns = useMemo<TableColumn<QueueRow>[]>(
    () => [
      {
        title: 'Queue',
        render: row => (
          <Box display="flex" flexDirection="column" gap={0.5}>
            <Typography variant="subtitle1">{row.name}</Typography>
            <Typography variant="caption" color="textSecondary">
              {row.id}
            </Typography>
          </Box>
        ),
        customSort: (a, b) => a.name.localeCompare(b.name),
      },
      {
        title: 'Project',
        render: row => (
          <Box display="flex" flexDirection="column" gap={0.5}>
            <Typography variant="body2">{row.projectName}</Typography>
            <Typography variant="caption" color="textSecondary">
              {row.projectId}
            </Typography>
          </Box>
        ),
        customSort: (a, b) => rowCompare(a.projectName, b.projectName),
      },
      {
        title: 'Visibility',
        render: row => (
          <Chip
            size="small"
            label={row.visibility}
            variant="outlined"
            className={classes.visibilityChip}
          />
        ),
      },
      {
        title: 'Type',
        render: row => (
          <Chip
            size="small"
            label={row.kind === 'gpu' ? 'GPU' : row.kind === 'mixed' ? 'Hybrid' : 'CPU'}
            className={classes.queueChip}
            variant="outlined"
            color={row.kind === 'gpu' ? 'secondary' : 'default'}
          />
        ),
      },
      {
        title: 'Backlog (min)',
        field: 'backlogMinutes',
        render: row => `${row.backlogMinutes} min`,
        customSort: (a, b) => a.backlogMinutes - b.backlogMinutes,
      },
      {
        title: 'Capacity',
        field: 'capacity',
      },
      {
        title: 'Policy',
        render: row => (
          <Typography variant="body2" color="textSecondary">
            {row.policy}
          </Typography>
        ),
      },
      {
        title: 'Featured flavors',
        render: row => (
          <div className={classes.queueFlavors}>
            {row.featuredFlavors.map(flavor => (
              <Chip
                key={flavor}
                size="small"
                label={flavor}
                variant="outlined"
                className={classes.queueChip}
              />
            ))}
          </div>
        ),
      },
    ],
    [classes.queueChip, classes.queueFlavors, classes.visibilityChip],
  );

  return (
    <Page themeId="tool">
      <Content className={classes.content}>
        <ContentHeader title="Project & Queue Governance">
          <HeaderLabel label="Projects" value={projectProfiles.length.toString()} />
          <HeaderLabel label="Queues" value={queueRows.length.toString()} />
        </ContentHeader>
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <div className={classes.card}>
              <Typography variant="h6" className={classes.sectionTitle}>
                Active projects
              </Typography>
              <Table
                options={{ paging: false, search: false, padding: 'dense' }}
                columns={projectColumns}
                data={projectProfiles}
              />
            </div>
          </Grid>
          <Grid item xs={12} md={4}>
            <InfoCard title="Governance guidance" className={classes.card}>
              <div className={classes.insightsList}>
                <div className={classes.insightRow}>
                  <VisibilityIcon className={classes.insightIcon} />
                  <Typography variant="body2" color="textSecondary">
                    {projectProfiles.length > 0
                      ? 'Projects define workspace visibility, RBAC boundaries, and queue access tiers. Mission projects receive tighter oversight.'
                      : 'Projects define workspace visibility and access controls.'}
                  </Typography>
                </div>
                <div className={classes.insightRow}>
                  <TimelineIcon className={classes.insightIcon} />
                  <Typography variant="body2" color="textSecondary">
                    Monitor backlog and queue composition to balance GPU-heavy missions with CPU analytics demands.
                  </Typography>
                </div>
                <div className={classes.insightRow}>
                  <AssignmentTurnedInIcon className={classes.insightIcon} />
                  <Typography variant="body2" color="textSecondary">
                    Budget changes flow automatically to the launch wizard. Adjust committed spend here before publishing policy updates.
                  </Typography>
                </div>
              </div>
            </InfoCard>
          </Grid>
          <Grid item xs={12}>
            <div className={classes.card}>
              <Typography variant="h6" className={classes.sectionTitle}>
                Queue catalog
              </Typography>
              <Table
                options={{ paging: false, search: false, padding: 'dense' }}
                columns={queueColumns}
                data={queueRows}
              />
            </div>
          </Grid>
        </Grid>
      </Content>
    </Page>
  );
};

const rowCompare = (a: string, b: string) => a.localeCompare(b);
