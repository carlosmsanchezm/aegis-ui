import { useMemo } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Grid,
  makeStyles,
  Paper,
  Typography,
} from '@material-ui/core';
import {
  Content,
  ContentHeader,
  HeaderLabel,
  Page,
  Table,
  TableColumn,
} from '@backstage/core-components';

const useStyles = makeStyles(theme => ({
  root: {
    paddingBottom: theme.spacing(6),
  },
  chartPaper: {
    background: 'var(--aegis-card-surface)',
    border: '1px solid var(--aegis-card-border)',
    boxShadow: 'var(--aegis-card-shadow)',
    borderRadius: theme.shape.borderRadius * 2,
    padding: theme.spacing(3),
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: theme.spacing(1.5),
  },
  chartTitle: {
    fontWeight: 600,
  },
  chartSubtitle: {
    color: theme.palette.text.secondary,
  },
  chartPlaceholder: {
    marginTop: theme.spacing(2),
    width: '100%',
    height: 180,
    borderRadius: theme.shape.borderRadius * 1.5,
    border: '1px dashed rgba(148, 163, 184, 0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: theme.palette.text.secondary,
    fontStyle: 'italic',
  },
  tableWrapper: {
    marginTop: theme.spacing(4),
  },
}));

type ClusterRow = {
  id: string;
  name: string;
  status: string;
  cpu: string;
  gpu: string;
  latency: string;
  errorRate: string;
};

const metricsSummaries = [
  {
    title: 'Fleet CPU Utilization',
    subtitle: 'Current rolling average across all clusters',
    metric: '64%',
    trend: 'Trending +4% vs 24h',
  },
  {
    title: 'Accelerator Utilization',
    subtitle: 'GPU saturation across AI workloads',
    metric: '78%',
    trend: 'Stable vs 6h',
  },
  {
    title: 'P99 API Latency',
    subtitle: 'Control plane calls across the fleet',
    metric: '242 ms',
    trend: 'Down 18% week over week',
  },
];

const clusterRows: ClusterRow[] = [
  {
    id: 'aurora-west-1',
    name: 'Aurora · us-gov-west-1',
    status: 'Healthy',
    cpu: '59%',
    gpu: '74%',
    latency: '212 ms',
    errorRate: '0.12%',
  },
  {
    id: 'sentinel-east-2',
    name: 'Sentinel · us-gov-east-2',
    status: 'Warning',
    cpu: '71%',
    gpu: '88%',
    latency: '318 ms',
    errorRate: '0.34%',
  },
  {
    id: 'atlas-eu-central',
    name: 'Atlas · eu-central-1',
    status: 'Healthy',
    cpu: '52%',
    gpu: '63%',
    latency: '198 ms',
    errorRate: '0.08%',
  },
  {
    id: 'titan-apac',
    name: 'Titan · ap-southeast-2',
    status: 'Investigate',
    cpu: '81%',
    gpu: '91%',
    latency: '402 ms',
    errorRate: '0.92%',
  },
];

export const AegisOpsMetricsPage = () => {
  const classes = useStyles();

  const columns = useMemo<TableColumn<ClusterRow>[]>(
    () => [
      {
        title: 'Cluster / Node',
        field: 'name',
        highlight: true,
        render: row => (
          <RouterLink to={`/aegis/operations/resources/${row.id}`} style={{ textDecoration: 'none' }}>
            <Typography color="primary" variant="body2">
              {row.name}
            </Typography>
          </RouterLink>
        ),
      },
      { title: 'Status', field: 'status' },
      { title: 'CPU Utilization', field: 'cpu' },
      { title: 'GPU Utilization', field: 'gpu' },
      { title: 'P95 Latency', field: 'latency' },
      { title: 'Error Rate', field: 'errorRate' },
    ],
    [],
  );

  return (
    <Page themeId="tool">
      <Content className={classes.root}>
        <ContentHeader title="Operational Metrics">
          <HeaderLabel label="Fleets" value="4" />
          <HeaderLabel label="Regions" value="7" />
          <HeaderLabel label="Live Nodes" value="312" />
        </ContentHeader>

        <Grid container spacing={3}>
          {metricsSummaries.map(card => (
            <Grid item xs={12} md={4} key={card.title}>
              <Paper className={classes.chartPaper}>
                <Typography variant="h6" className={classes.chartTitle}>
                  {card.title}
                </Typography>
                <Typography variant="body2" className={classes.chartSubtitle}>
                  {card.subtitle}
                </Typography>
                <Typography variant="h4">{card.metric}</Typography>
                <Typography variant="body2" color="primary">
                  {card.trend}
                </Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>

        <Box mt={4}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Paper className={classes.chartPaper}>
                <Typography variant="h6" className={classes.chartTitle}>
                  Fleet CPU Load
                </Typography>
                <Typography variant="body2" className={classes.chartSubtitle}>
                  Rolling 24h utilization trend
                </Typography>
                <div className={classes.chartPlaceholder}>Time-series chart placeholder</div>
              </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
              <Paper className={classes.chartPaper}>
                <Typography variant="h6" className={classes.chartTitle}>
                  Error Rate Heatmap
                </Typography>
                <Typography variant="body2" className={classes.chartSubtitle}>
                  Aggregated incidents across clusters
                </Typography>
                <div className={classes.chartPlaceholder}>Heatmap placeholder</div>
              </Paper>
            </Grid>
          </Grid>
        </Box>

        <div className={classes.tableWrapper}>
          <Table
            options={{ paging: false, search: false, sorting: false, padding: 'dense' }}
            title="Cluster Health"
            columns={columns}
            data={clusterRows}
          />
        </div>
      </Content>
    </Page>
  );
};
