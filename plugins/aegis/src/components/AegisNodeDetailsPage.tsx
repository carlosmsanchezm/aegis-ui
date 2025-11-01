import { FC, useMemo } from 'react';
import {
  Page,
  Content,
  ContentHeader,
  StructuredMetadataTable,
} from '@backstage/core-components';
import {
  Box,
  Button,
  Grid,
  Paper,
  Typography,
  makeStyles,
} from '@material-ui/core';
import { alertApiRef, useApi } from '@backstage/core-plugin-api';
import { useParams } from 'react-router-dom';

type ResourceMetric = {
  metric: string;
  trend: string;
  detail: string;
};

type ResourceInsight = {
  title: string;
  points: string[];
};

const useStyles = makeStyles(theme => ({
  grid: {
    marginTop: theme.spacing(1),
  },
  card: {
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
    minHeight: 200,
    borderRadius: theme.shape.borderRadius * 2,
    background:
      'linear-gradient(135deg, rgba(14,165,233,0.12) 0%, rgba(14,165,233,0.05) 100%)',
    border: `1px dashed ${theme.palette.info.light}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: theme.palette.text.secondary,
    fontWeight: 600,
    letterSpacing: '0.02em',
    textAlign: 'center',
    padding: theme.spacing(3),
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  },
  actionButtons: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1.5),
  },
}));

const mockResourceMetadata = (resourceId: string) => ({
  'Cluster / Node': resourceId,
  Region: resourceId.includes('eu') ? 'eu-west-1' : 'us-central-1',
  'Kubernetes Version': '1.28.6',
  'Instance Class': resourceId.includes('ml') ? 'n2-standard-32-gpu' : 'c2-standard-16',
  'Drain Status': resourceId.includes('maintenance') ? 'Scheduled' : 'Active',
});

const metrics: ResourceMetric[] = [
  {
    metric: 'CPU Utilization',
    trend: 'Max 1h: 88% | Baseline: 52%',
    detail: 'Spike aligned with nightly ETL batch from 01:10-01:30 UTC.',
  },
  {
    metric: 'GPU Utilization',
    trend: 'Max 1h: 97% | Avg: 81%',
    detail: 'TensorCore saturation triggered MIG partition rebalance.',
  },
  {
    metric: 'Memory Pressure',
    trend: 'Working Set: 89% | RSS: 71%',
    detail: 'OOM killer avoided via proactive eviction threshold (85%).',
  },
];

const insights: ResourceInsight[] = [
  {
    title: 'Operational Insights',
    points: [
      '5 pods retrying due to image pull latency spikes on registry mirror.',
      'Linkerd sidecar version mismatch detected; rollout pending approval.',
      'ReplicaSet autoscaler stabilized after manual override 30 minutes ago.',
    ],
  },
  {
    title: 'Active Playbooks',
    points: [
      'Drain automation on stand-by: readiness gating in effect.',
      'Incident AE-245 triage channel monitoring GPU memory fragmentation.',
    ],
  },
];

export const AegisNodeDetailsPage: FC = () => {
  const classes = useStyles();
  const { resourceId = 'unknown-resource' } = useParams<{ resourceId: string }>();
  const alertApi = useApi(alertApiRef);

  const metadata = useMemo(() => mockResourceMetadata(resourceId), [resourceId]);

  const handleAction = (action: string) => {
    alertApi.post({
      message: `${action} request queued for ${resourceId}`,
      severity: 'info',
    });
  };

  return (
    <Page themeId="tool">
      <Content>
        <ContentHeader title={`Resource: ${resourceId}`}>
          <Typography variant="body1" color="textSecondary">
            Focused telemetry, automation hooks, and recent context for this node/cluster.
          </Typography>
        </ContentHeader>

        <Grid container spacing={3} className={classes.grid}>
          <Grid item xs={12} md={6}>
            <Paper className={classes.card}>
              <Typography variant="h6">Control Plane Actions</Typography>
              <Typography variant="body2" color="textSecondary">
                Issue imperative commands against the node without leaving Backstage.
              </Typography>
              <div className={classes.actionButtons}>
                <Button
                  variant="contained"
                  color="secondary"
                  onClick={() => handleAction('Drain Node')}
                >
                  Drain Node
                </Button>
                <Button
                  variant="outlined"
                  color="secondary"
                  onClick={() => handleAction('Cordon Node')}
                >
                  Cordon Node
                </Button>
                <Button variant="outlined" onClick={() => handleAction('Reboot Node')}>
                  Reboot Node
                </Button>
              </div>
              <StructuredMetadataTable metadata={metadata} />
            </Paper>
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper className={classes.card}>
              <Typography variant="h6">Recent Timeline</Typography>
              <Typography variant="body2" color="textSecondary">
                Streaming diagnostic events correlated to workload saturation.
              </Typography>
              <Box className={classes.chartPlaceholder}>
                Mocked per-resource time-series chart
              </Box>
              <Typography variant="body2" color="textSecondary">
                "Noisy neighbor" detection flagged 3 deployments sharing the same NUMA domain.
              </Typography>
            </Paper>
          </Grid>

          {metrics.map(metric => (
            <Grid key={metric.metric} item xs={12} md={4}>
              <Paper className={classes.card}>
                <Typography variant="h6">{metric.metric}</Typography>
                <Typography variant="body2" color="textSecondary">
                  {metric.trend}
                </Typography>
                <Box className={classes.chartPlaceholder}>Time-Series Telemetry</Box>
                <Typography variant="body2" color="textSecondary">
                  {metric.detail}
                </Typography>
              </Paper>
            </Grid>
          ))}

          {insights.map(section => (
            <Grid key={section.title} item xs={12} md={6}>
              <Paper className={classes.card}>
                <Typography variant="h6">{section.title}</Typography>
                <div className={classes.actions}>
                  {section.points.map(point => (
                    <Typography key={point} variant="body2" color="textSecondary">
                      • {point}
                    </Typography>
                  ))}
                </div>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Content>
    </Page>
  );
};

