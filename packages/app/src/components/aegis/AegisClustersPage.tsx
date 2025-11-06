import React, { useMemo, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Chip,
  FormControl,
  Grid,
  InputLabel,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  makeStyles,
  MenuItem,
  Paper,
  Select,
  Typography,
} from '@material-ui/core';
import {
  Content,
  ContentHeader,
  HeaderLabel,
  Page,
} from '@backstage/core-components';
import TimelineIcon from '@material-ui/icons/Timeline';
import CheckCircleOutlineIcon from '@material-ui/icons/CheckCircleOutline';
import ErrorOutlineIcon from '@material-ui/icons/ErrorOutline';
import AutorenewIcon from '@material-ui/icons/Autorenew';

type ClusterMode = 'provision' | 'import';
type ClusterPhase = 'Provisioning' | 'Ready' | 'Error';

type ClusterSummary = {
  id: string;
  project: string;
  region: string;
  mode: ClusterMode;
  phase: ClusterPhase;
  lastSync: string;
  costHint: string;
  controllerCondition: string;
  costDelta?: string;
  steps: Array<{
    label: string;
    status: 'complete' | 'active' | 'pending' | 'error';
    helper?: string;
  }>;
};

const useStyles = makeStyles(theme => ({
  pageContent: {
    paddingBottom: theme.spacing(6),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(3),
  },
  filters: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: theme.spacing(2),
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: theme.spacing(2.5),
  },
  summaryCard: {
    borderRadius: theme.shape.borderRadius * 2,
    border: '1px solid var(--aegis-card-border, rgba(148, 163, 184, 0.24))',
    background: 'var(--aegis-card-surface, rgba(15, 23, 42, 0.45))',
    boxShadow: 'var(--aegis-card-shadow, 0 24px 32px rgba(15, 23, 42, 0.24))',
    padding: theme.spacing(3),
    color: theme.palette.text.primary,
  },
  summaryLabel: {
    textTransform: 'uppercase',
    fontSize: '0.75rem',
    letterSpacing: '0.08em',
    color: theme.palette.text.secondary,
  },
  summaryValue: {
    fontSize: '2rem',
    fontWeight: 600,
    letterSpacing: '-0.02em',
  },
  filterPanel: {
    padding: theme.spacing(3),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(3),
  },
  clusterGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
    gap: theme.spacing(3),
  },
  clusterCard: {
    borderRadius: theme.shape.borderRadius * 2,
    border: '1px solid var(--aegis-card-border, rgba(148, 163, 184, 0.24))',
    background: 'var(--aegis-card-surface, rgba(15, 23, 42, 0.45))',
    boxShadow: 'var(--aegis-card-shadow, 0 16px 32px rgba(15, 23, 42, 0.32))',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 280,
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing(1.5),
  },
  cardMeta: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: theme.spacing(1.5),
    marginTop: theme.spacing(1),
  },
  timelineSection: {
    marginTop: theme.spacing(2),
    paddingTop: theme.spacing(1),
    borderTop: '1px solid rgba(148, 163, 184, 0.24)',
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  },
  costTrend: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    color: theme.palette.success.light,
  },
  listItemIcon: {
    minWidth: 36,
  },
  emptyState: {
    padding: theme.spacing(6),
    textAlign: 'center',
    background: 'transparent',
    border: '1px dashed rgba(148, 163, 184, 0.4)',
    borderRadius: theme.shape.borderRadius * 2,
  },
}));

const clusterDataset: ClusterSummary[] = [
  {
    id: 'aurora-east',
    project: 'mission-x',
    region: 'us-gov-west-1',
    mode: 'provision',
    phase: 'Ready',
    lastSync: '3m ago',
    costHint: '$412 / hr',
    costDelta: '-3.2%',
    controllerCondition: 'Pulumi apply succeeded',
    steps: [
      { label: 'Spec submitted', status: 'complete' },
      { label: 'Pulumi stack refresh', status: 'complete' },
      { label: 'Pulumi apply', status: 'complete' },
      { label: 'Kubeconfigs synced', status: 'complete' },
      {
        label: 'Clusters registered',
        status: 'complete',
        helper: 'Registration confirmed at 12:14 UTC',
      },
    ],
  },
  {
    id: 'sentinel-edge',
    project: 'mission-y',
    region: 'us-gov-east-1',
    mode: 'provision',
    phase: 'Provisioning',
    lastSync: '42s ago',
    costHint: '$275 / hr',
    controllerCondition: 'Pulumi apply running',
    steps: [
      { label: 'Spec submitted', status: 'complete' },
      { label: 'Pulumi stack refresh', status: 'complete' },
      {
        label: 'Pulumi apply',
        status: 'active',
        helper: 'Streaming module updates…',
      },
      { label: 'Kubeconfigs synced', status: 'pending' },
      { label: 'Clusters registered', status: 'pending' },
    ],
  },
  {
    id: 'atlas-import',
    project: 'mission-x',
    region: 'us-east-1',
    mode: 'import',
    phase: 'Error',
    lastSync: '12m ago',
    costHint: '$0 / hr',
    controllerCondition: 'Secret sync failed',
    steps: [
      { label: 'Spec submitted', status: 'complete' },
      { label: 'Secret validated', status: 'complete' },
      {
        label: 'Kubeconfigs synced',
        status: 'error',
        helper: 'Verify AWS role permissions for cross-account secret read',
      },
      { label: 'Clusters registered', status: 'pending' },
    ],
  },
  {
    id: 'euclid-sandbox',
    project: 'mission-z',
    region: 'eu-central-1',
    mode: 'provision',
    phase: 'Ready',
    lastSync: '9m ago',
    costHint: '$198 / hr',
    controllerCondition: 'Helm add-ons healthy',
    costDelta: '+1.1%',
    steps: [
      { label: 'Spec submitted', status: 'complete' },
      { label: 'Pulumi stack refresh', status: 'complete' },
      { label: 'Pulumi apply', status: 'complete' },
      { label: 'Kubeconfigs synced', status: 'complete' },
      { label: 'Clusters registered', status: 'complete' },
    ],
  },
];

const phaseToChip: Record<
  ClusterPhase,
  { label: string; color: 'primary' | 'secondary'; icon: React.ReactElement }
> = {
  Provisioning: {
    label: 'Provisioning',
    color: 'secondary',
    icon: <AutorenewIcon fontSize="small" />,
  },
  Ready: { label: 'Ready', color: 'primary', icon: <CheckCircleOutlineIcon fontSize="small" /> },
  Error: { label: 'Error', color: 'secondary', icon: <ErrorOutlineIcon fontSize="small" /> },
};

const countByPhase = (clusters: ClusterSummary[], phase: ClusterPhase) =>
  clusters.filter(cluster => cluster.phase === phase).length;

export const AegisClustersPage = () => {
  const classes = useStyles();
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [regionFilter, setRegionFilter] = useState<string>('all');
  const [modeFilter, setModeFilter] = useState<'all' | ClusterMode>('all');
  const [phaseFilter, setPhaseFilter] = useState<'all' | ClusterPhase>('all');

  const filteredClusters = useMemo(() => {
    return clusterDataset.filter(cluster => {
      if (projectFilter !== 'all' && cluster.project !== projectFilter) {
        return false;
      }
      if (regionFilter !== 'all' && cluster.region !== regionFilter) {
        return false;
      }
      if (modeFilter !== 'all' && cluster.mode !== modeFilter) {
        return false;
      }
      if (phaseFilter !== 'all' && cluster.phase !== phaseFilter) {
        return false;
      }
      return true;
    });
  }, [modeFilter, phaseFilter, projectFilter, regionFilter]);

  const projectOptions = Array.from(new Set(clusterDataset.map(cluster => cluster.project)));
  const regionOptions = Array.from(new Set(clusterDataset.map(cluster => cluster.region)));

  return (
    <Page themeId="tool">
      <Content className={classes.pageContent}>
        <ContentHeader title="Clusters">
          <HeaderLabel label="Active" value={countByPhase(clusterDataset, 'Ready').toString()} />
          <HeaderLabel label="Provisioning" value={countByPhase(clusterDataset, 'Provisioning').toString()} />
          <HeaderLabel label="Attention" value={countByPhase(clusterDataset, 'Error').toString()} />
        </ContentHeader>

        <Paper elevation={0} className={classes.summaryCard}>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6} md={3}>
              <Typography className={classes.summaryLabel}>Ready clusters</Typography>
              <Typography className={classes.summaryValue}>
                {countByPhase(clusterDataset, 'Ready')}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Typography className={classes.summaryLabel}>Provisioning</Typography>
              <Typography className={classes.summaryValue}>
                {countByPhase(clusterDataset, 'Provisioning')}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Typography className={classes.summaryLabel}>Errored</Typography>
              <Typography className={classes.summaryValue}>
                {countByPhase(clusterDataset, 'Error')}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Typography className={classes.summaryLabel}>Hourly spend</Typography>
              <Typography className={classes.summaryValue}>$885</Typography>
            </Grid>
          </Grid>
        </Paper>

        <Paper elevation={0} className={classes.filterPanel}>
          <div className={classes.filters}>
            <FormControl variant="outlined" size="small">
              <InputLabel id="cluster-project-filter">Project</InputLabel>
              <Select
                labelId="cluster-project-filter"
                value={projectFilter}
                onChange={event => setProjectFilter(event.target.value as string)}
                label="Project"
              >
                <MenuItem value="all">All projects</MenuItem>
                {projectOptions.map(project => (
                  <MenuItem key={project} value={project}>
                    {project}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl variant="outlined" size="small">
              <InputLabel id="cluster-region-filter">Region</InputLabel>
              <Select
                labelId="cluster-region-filter"
                value={regionFilter}
                onChange={event => setRegionFilter(event.target.value as string)}
                label="Region"
              >
                <MenuItem value="all">All regions</MenuItem>
                {regionOptions.map(region => (
                  <MenuItem key={region} value={region}>
                    {region}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl variant="outlined" size="small">
              <InputLabel id="cluster-mode-filter">Mode</InputLabel>
              <Select
                labelId="cluster-mode-filter"
                value={modeFilter}
                onChange={event => setModeFilter(event.target.value as 'all' | ClusterMode)}
                label="Mode"
              >
                <MenuItem value="all">Provision &amp; import</MenuItem>
                <MenuItem value="provision">Provision new</MenuItem>
                <MenuItem value="import">Import existing</MenuItem>
              </Select>
            </FormControl>

            <FormControl variant="outlined" size="small">
              <InputLabel id="cluster-phase-filter">Phase</InputLabel>
              <Select
                labelId="cluster-phase-filter"
                value={phaseFilter}
                onChange={event => setPhaseFilter(event.target.value as 'all' | ClusterPhase)}
                label="Phase"
              >
                <MenuItem value="all">All phases</MenuItem>
                <MenuItem value="Provisioning">Provisioning</MenuItem>
                <MenuItem value="Ready">Ready</MenuItem>
                <MenuItem value="Error">Error</MenuItem>
              </Select>
            </FormControl>
          </div>

          {filteredClusters.length === 0 ? (
            <div className={classes.emptyState}>
              <Typography variant="h6">No clusters match the current filters.</Typography>
              <Typography variant="body2" color="textSecondary">
                Try widening the project, region, or mode filters to rediscover clusters.
              </Typography>
            </div>
          ) : (
            <div className={classes.clusterGrid}>
              {filteredClusters.map(cluster => {
                const chipProps = phaseToChip[cluster.phase];
                const activeIndex = cluster.steps.findIndex(step => step.status === 'active');
                const completed = cluster.steps.filter(step => step.status === 'complete').length;
                const progress = Math.max(
                  5,
                  Math.round((completed / cluster.steps.length) * 100),
                );

                return (
                  <Card key={cluster.id} className={classes.clusterCard}>
                    <CardContent>
                      <div className={classes.cardHeader}>
                        <div>
                          <Typography variant="h6">{cluster.id}</Typography>
                          <Typography variant="body2" color="textSecondary">
                            {cluster.project} · {cluster.region} · {cluster.mode === 'provision' ? 'Provisioned' : 'Imported'}
                          </Typography>
                        </div>
                        <Chip
                          color={chipProps.color}
                          icon={chipProps.icon}
                          label={chipProps.label}
                          variant={cluster.phase === 'Error' ? 'default' : 'outlined'}
                        />
                      </div>

                      <LinearProgress
                        variant="determinate"
                        value={cluster.phase === 'Ready' ? 100 : progress}
                      />

                      <div className={classes.cardMeta}>
                        <Box>
                          <Typography className={classes.summaryLabel}>Controller condition</Typography>
                          <Typography>{cluster.controllerCondition}</Typography>
                        </Box>
                        <Box>
                          <Typography className={classes.summaryLabel}>Last sync</Typography>
                          <Typography>{cluster.lastSync}</Typography>
                        </Box>
                        <Box>
                          <Typography className={classes.summaryLabel}>Cost hint</Typography>
                          <Typography>{cluster.costHint}</Typography>
                          {cluster.costDelta && (
                            <Typography variant="caption" className={classes.costTrend}>
                              <TimelineIcon fontSize="small" /> {cluster.costDelta} vs prior
                            </Typography>
                          )}
                        </Box>
                      </div>

                      <div className={classes.timelineSection}>
                        <Typography variant="subtitle2">Status timeline</Typography>
                        <List dense>
                          {cluster.steps.map((step, index) => {
                            const icon =
                              step.status === 'complete' ? (
                                <CheckCircleOutlineIcon fontSize="small" color="primary" />
                              ) : step.status === 'error' ? (
                                <ErrorOutlineIcon fontSize="small" color="error" />
                              ) : step.status === 'active' ? (
                                <AutorenewIcon fontSize="small" color="secondary" />
                              ) : (
                                <TimelineIcon fontSize="small" color="disabled" />
                              );

                            const primary = `${index + 1}. ${step.label}`;
                            const secondary = step.helper
                              ? step.helper
                              : index === activeIndex && step.status === 'active'
                              ? 'In progress'
                              : undefined;

                            return (
                              <ListItem key={step.label} alignItems="flex-start">
                                <ListItemIcon className={classes.listItemIcon}>{icon}</ListItemIcon>
                                <ListItemText primary={primary} secondary={secondary} />
                              </ListItem>
                            );
                          })}
                        </List>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </Paper>
      </Content>
    </Page>
  );
};

export default AegisClustersPage;
