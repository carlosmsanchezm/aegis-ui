import { FC, useMemo } from 'react';
import {
  Page,
  Content,
  ContentHeader,
  Table,
  TableColumn,
} from '@backstage/core-components';
import {
  Box,
  Grid,
  Paper,
  Typography,
  makeStyles,
} from '@material-ui/core';
import { Link as RouterLink } from 'react-router-dom';
import { useRouteRef } from '@backstage/core-plugin-api';
import { operationsResourceDetailsRouteRef } from '../routes';

type ClusterMetric = {
  name: string;
  status: 'Healthy' | 'Degraded' | 'Warning';
  cpuUtilization: number;
  gpuUtilization: number;
  latencyP99: number;
  errorRate: number;
};

const useStyles = makeStyles(theme => ({
  chartCard: {
    backgroundColor: 'var(--aegis-card-surface)',
    border: '1px solid var(--aegis-card-border)',
    boxShadow: 'var(--aegis-card-shadow)',
    padding: theme.spacing(3),
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  },
  chartPlaceholder: {
    flex: 1,
    minHeight: 220,
    borderRadius: theme.shape.borderRadius * 2,
    background:
      'linear-gradient(135deg, rgba(59,130,246,0.12) 0%, rgba(59,130,246,0.04) 100%)',
    border: `1px dashed ${theme.palette.primary.light}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: theme.palette.text.secondary,
    fontWeight: 600,
    letterSpacing: '0.02em',
  },
  tableWrapper: {
    backgroundColor: 'var(--aegis-card-surface)',
    border: '1px solid var(--aegis-card-border)',
    boxShadow: 'var(--aegis-card-shadow)',
    padding: theme.spacing(1, 0),
  },
  link: {
    textDecoration: 'none',
    color: theme.palette.primary.main,
    fontWeight: 600,
  },
}));

const clusterMetrics: ClusterMetric[] = [
  {
    name: 'compute-cluster-a',
    status: 'Healthy',
    cpuUtilization: 68,
    gpuUtilization: 54,
    latencyP99: 142,
    errorRate: 0.24,
  },
  {
    name: 'compute-cluster-b',
    status: 'Warning',
    cpuUtilization: 82,
    gpuUtilization: 71,
    latencyP99: 196,
    errorRate: 0.87,
  },
  {
    name: 'ml-training-east',
    status: 'Degraded',
    cpuUtilization: 91,
    gpuUtilization: 94,
    latencyP99: 244,
    errorRate: 1.36,
  },
  {
    name: 'edge-fleet-eu',
    status: 'Healthy',
    cpuUtilization: 57,
    gpuUtilization: 33,
    latencyP99: 121,
    errorRate: 0.12,
  },
];

export const AegisOpsMetricsPage: FC = () => {
  const classes = useStyles();
  const detailsRoute = useRouteRef(operationsResourceDetailsRouteRef);

  const columns = useMemo<TableColumn<ClusterMetric>[]>(
    () => [
      {
        title: 'Cluster / Node',
        field: 'name',
        highlight: true,
        render: row => (
          <RouterLink className={classes.link} to={detailsRoute({ resourceId: row.name })}>
            {row.name}
          </RouterLink>
        ),
      },
      {
        title: 'Status',
        field: 'status',
      },
      {
        title: 'CPU Utilization',
        field: 'cpuUtilization',
        render: row => `${row.cpuUtilization}%`,
      },
      {
        title: 'GPU Utilization',
        field: 'gpuUtilization',
        render: row => `${row.gpuUtilization}%`,
      },
      {
        title: 'p99 Latency',
        field: 'latencyP99',
        render: row => `${row.latencyP99} ms`,
      },
      {
        title: 'Error Rate',
        field: 'errorRate',
        render: row => `${row.errorRate.toFixed(2)}%`,
      },
    ],
    [classes.link, detailsRoute],
  );

  return (
    <Page themeId="tool">
      <Content>
        <ContentHeader title="Operational Metrics">
          <Typography variant="body1" color="textSecondary">
            Deep visibility into fleet performance and saturation across clusters.
          </Typography>
        </ContentHeader>

        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Paper className={classes.chartCard}>
              <Typography variant="h6">Fleet CPU Utilization</Typography>
              <Typography variant="body2" color="textSecondary">
                Rolling 6h utilization across all nodes
              </Typography>
              <Box className={classes.chartPlaceholder}>Mocked Time-Series Chart</Box>
              <Typography variant="body2" color="textSecondary">
                Peak 5m load: 92% | 24h change: +4.8%
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper className={classes.chartCard}>
              <Typography variant="h6">Fleet GPU Utilization</Typography>
              <Typography variant="body2" color="textSecondary">
                Accelerators saturation for training workloads
              </Typography>
              <Box className={classes.chartPlaceholder}>Mocked Time-Series Chart</Box>
              <Typography variant="body2" color="textSecondary">
                Avg occupancy: 71% | Queue depth: 28 pending jobs
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper className={classes.chartCard}>
              <Typography variant="h6">Latency & Error Rates</Typography>
              <Typography variant="body2" color="textSecondary">
                Front-door API latency paired with 5xx error rate
              </Typography>
              <Box className={classes.chartPlaceholder}>Mocked Time-Series Chart</Box>
              <Typography variant="body2" color="textSecondary">
                p99 latency: 184 ms | Error rate: 0.62%
              </Typography>
            </Paper>
          </Grid>

          <Grid item xs={12}>
            <div className={classes.tableWrapper}>
              <Table
                options={{ paging: false, search: false, padding: 'dense' }}
                data={clusterMetrics}
                columns={columns}
                title="Cluster & Node Overview"
              />
            </div>
          </Grid>
        </Grid>
      </Content>
    </Page>
  );
};

