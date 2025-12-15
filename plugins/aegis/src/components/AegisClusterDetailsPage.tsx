import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import {
  Content,
  ContentHeader,
  InfoCard,
  Page,
  Progress,
  WarningPanel,
} from '@backstage/core-components';
import {
  alertApiRef,
  discoveryApiRef,
  fetchApiRef,
  identityApiRef,
  useApi,
} from '@backstage/core-plugin-api';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import ErrorOutlineIcon from '@material-ui/icons/ErrorOutline';
import TimelineIcon from '@material-ui/icons/Timeline';
import CloudQueueIcon from '@material-ui/icons/CloudQueue';
import FileCopyIcon from '@material-ui/icons/FileCopy';
import LaunchIcon from '@material-ui/icons/Launch';
import LayersIcon from '@material-ui/icons/Layers';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ApiError,
  ClusterActivityItem,
  ClusterDetail,
  ClusterJobCondition,
  ClusterNodePoolStatus,
  ClusterSummary,
  getCluster,
  listClusters,
} from '../api/aegisClient';
import { keycloakAuthApiRef } from '../api/refs';

const useStyles = makeStyles(theme => ({
  page: {
    paddingBottom: theme.spacing(6),
  },
  chipRow: {
    display: 'flex',
    gap: theme.spacing(1),
    flexWrap: 'wrap',
  },
  tabPanel: {
    marginTop: theme.spacing(3),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(3),
  },
  listCard: {
    display: 'flex',
    flexDirection: 'column',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  },
  timeline: {
    display: 'grid',
    gap: theme.spacing(1.5),
  },
}));

type DetailTab = 0 | 1 | 2 | 3;

const statusChipColor: Record<ClusterDetail['phase'], 'primary' | 'secondary' | 'default'> = {
  Ready: 'primary',
  Provisioning: 'secondary',
  Error: 'default',
  Degraded: 'secondary',
  Upgrading: 'default',
  Scaling: 'default',
};

const statusIcon = (status: 'success' | 'warning' | 'error') => {
  switch (status) {
    case 'success':
      return <CheckCircleIcon color="primary" />;
    case 'warning':
      return <TimelineIcon color="secondary" />;
    case 'error':
    default:
      return <ErrorOutlineIcon color="error" />;
  }
};

const formatCurrency = (value?: number, currency = 'USD') => {
  if (typeof value !== 'number') {
    return '—';
  }
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(value);
  } catch (err) {
    return `$${value.toFixed(2)}`;
  }
};

const buildFallbackCluster = (clusterId: string): ClusterDetail => ({
  id: clusterId,
  name: clusterId,
  projectId: 'mission-alpha',
  provider: 'AWS EKS',
  region: 'us-east-1',
  phase: 'Provisioning',
  createdAt: new Date().toISOString(),
  lastSyncedAt: new Date().toISOString(),
  costEstimate: {
    hourly: 28.5,
    currency: 'USD',
    description: 'Sample fallback footprint.',
  },
  latestCondition: {
    type: 'PulumiApply',
    status: 'Unknown',
    message: 'Pulumi apply running.',
  },
  conditions: [
    {
      type: 'SpecSubmitted',
      status: 'True',
      message: 'Provisioning spec accepted by controller.',
    },
    {
      type: 'PulumiRefresh',
      status: 'True',
      message: 'Stack refreshed successfully.',
    },
    {
      type: 'PulumiApply',
      status: 'Unknown',
      message: 'Streaming Pulumi apply output.',
    },
  ] as ClusterJobCondition[],
  nodePools: [
    {
      name: 'system',
      instanceType: 'm6i.large',
      desiredSize: 2,
      minSize: 2,
      maxSize: 4,
      labels: { 'node-role.kubernetes.io/control-plane': 'true' },
      taints: [],
    },
    {
      name: 'gpu-training',
      instanceType: 'g5.12xlarge',
      desiredSize: 1,
      minSize: 0,
      maxSize: 2,
      labels: { 'aegis.dev/workload': 'ml' },
      taints: [{ key: 'nvidia.com/gpu', value: 'true', effect: 'NoSchedule' }],
    },
  ] as ClusterNodePoolStatus[],
  activity: [
    {
      id: 'evt-1',
      phase: 'Spec submitted',
      timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      message: 'Operator submitted provisioning plan.',
      actor: 'sre.maria',
    },
    {
      id: 'evt-2',
      phase: 'Pulumi apply',
      timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      message: 'Pulumi up in progress.',
      actor: 'automation',
    },
  ],
  helm: {
    namespace: 'aegis-system',
    chartVersion: '1.14.0',
  },
  platformOverrides: {
    apiServer: 'https://platform.aegis.mil',
    metricsEndpoint: 'https://metrics.aegis.mil',
    loggingEndpoint: 'https://logs.aegis.mil',
  },
  kubeconfigSecrets: [
    {
      name: `${clusterId}-admin`,
      namespace: 'aegis-system',
      description: 'Administrative kubeconfig secret.',
    },
  ],
});

const normalizeSummaryPhase = (phase?: string): ClusterDetail['phase'] => {
  const normalized = (phase ?? '').toLowerCase();
  if (normalized.includes('ready')) {
    return 'Ready';
  }
  if (normalized.includes('error')) {
    return 'Error';
  }
  if (normalized.includes('degraded') || normalized.includes('unhealthy')) {
    return 'Degraded';
  }
  if (normalized.includes('upgrad')) {
    return 'Upgrading';
  }
  if (normalized.includes('scal')) {
    return 'Scaling';
  }
  return 'Provisioning';
};

const buildClusterFromSummary = (summary: ClusterSummary): ClusterDetail => {
  const createdAt =
    summary.createdAt && !Number.isNaN(new Date(summary.createdAt).getTime())
      ? summary.createdAt
      : new Date().toISOString();

  const lastHeartbeat =
    summary.lastHeartbeat && !Number.isNaN(new Date(summary.lastHeartbeat).getTime())
      ? summary.lastHeartbeat
      : undefined;

  return {
    id: summary.id,
    name: summary.name || summary.id,
    projectId: summary.projectId,
    provider: summary.provider,
    region: summary.region,
    phase: normalizeSummaryPhase(summary.phase),
    createdAt,
    ...(lastHeartbeat ? { lastSyncedAt: lastHeartbeat } : {}),
  };
};

const NodePoolTable = ({ nodePools }: { nodePools?: ClusterNodePoolStatus[] }) => {
  if (!nodePools || nodePools.length === 0) {
    return <Typography>No node pools reported yet.</Typography>;
  }
  return (
    <List dense>
      {nodePools.map(pool => (
        <ListItem key={pool.name} divider>
          <ListItemText
            primary={`${pool.name} · ${pool.instanceType}`}
            secondary={`Desired ${pool.desiredSize ?? pool.actualSize ?? '—'} · Min ${pool.minSize} · Max ${pool.maxSize}`}
          />
        </ListItem>
      ))}
    </List>
  );
};

const ActivityList = ({ activity }: { activity?: ClusterActivityItem[] }) => {
  if (!activity || activity.length === 0) {
    return <Typography>No activity recorded yet.</Typography>;
  }
  return (
    <List>
      {activity.map(item => (
        <ListItem key={item.id} divider>
          <ListItemIcon>
            {item.phase.toLowerCase().includes('error') ? (
              <ErrorOutlineIcon color="secondary" />
            ) : item.phase.toLowerCase().includes('ready') ? (
              <CheckCircleIcon color="primary" />
            ) : (
              <TimelineIcon color="action" />
            )}
          </ListItemIcon>
          <ListItemText
            primary={`${item.phase}${item.actor ? ` · ${item.actor}` : ''}`}
            secondary={`${new Date(item.timestamp).toLocaleString()} · ${item.message ?? ''}`}
          />
        </ListItem>
      ))}
    </List>
  );
};

export const AegisClusterDetailsPage = () => {
  const classes = useStyles();
  const { id } = useParams<{ id: string }>();
  const fetchApi = useApi(fetchApiRef);
  const discoveryApi = useApi(discoveryApiRef);
  const identityApi = useApi(identityApiRef);
  const authApi = useApi(keycloakAuthApiRef);
  const alertApi = useApi(alertApiRef);
  const navigate = useNavigate();

  const [cluster, setCluster] = useState<ClusterDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<DetailTab>(0);
  const [usingFallback, setUsingFallback] = useState(false);

  useEffect(() => {
    if (!id) {
      setError('Cluster identifier missing.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setUsingFallback(false);
    getCluster(fetchApi, discoveryApi, identityApi, authApi, id)
      .then(detail => {
        setCluster(detail);
      })
      .catch(async (err: unknown) => {
        const message = err instanceof Error ? err.message.toLowerCase() : '';
        if (
          err instanceof ApiError &&
          (err.status === 405 ||
            err.status === 404 ||
            message.includes('method not allowed') ||
            message.includes('not found'))
        ) {
          try {
            const summaries = await listClusters(fetchApi, discoveryApi, identityApi, authApi);
            const summary = summaries.find(item => item.id === id);
            if (summary) {
              setCluster(buildClusterFromSummary(summary));
              setUsingFallback(true);
              alertApi.post({
                severity: 'info',
                message:
                  'Showing cluster summary because detailed cluster data is unavailable.',
              });
              return;
            }
          } catch {
            // fall back to staged sample data below
          }

          setCluster(buildFallbackCluster(id));
          setUsingFallback(true);
          alertApi.post({
            severity: 'info',
            message: 'Showing staged sample data because the Aegis API is unavailable.',
          });
          return;
        }
        setError(err instanceof Error ? err.message : 'Unable to load cluster details.');
      })
      .finally(() => setLoading(false));
  }, [alertApi, authApi, discoveryApi, fetchApi, id, identityApi]);

  const totalNodePools = useMemo(() => {
    const primary = cluster?.nodePools?.length ?? 0;
    const additional = cluster?.additionalClusters?.reduce(
      (count, item) => count + (item.nodePools?.length ?? 0),
      0,
    ) ?? 0;
    return primary + additional;
  }, [cluster]);

  const handleCopy = (value: string) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(value).then(() => {
        alertApi.post({ severity: 'info', message: 'Copied to clipboard.' });
      });
    } else {
      alertApi.post({ severity: 'warning', message: value });
    }
  };

  const handleScale = () => {
    if (!cluster) {
      return;
    }
    navigate('/aegis/create/clusters', {
      state: {
        projectId: cluster.projectId,
        region: cluster.region,
        clusterId: cluster.id,
        mode: 'provision',
      },
    });
    alertApi.post({
      severity: 'info',
      message: 'Wizard pre-filled with cluster context for scaling operations.',
    });
  };

  const handleAddCluster = () => {
    if (!cluster) {
      return;
    }
    navigate('/aegis/create/clusters', {
      state: { projectId: cluster.projectId, region: cluster.region, mode: 'provision' },
    });
  };

  return (
    <Page themeId="tool">
      <Content className={classes.page}>
        <ContentHeader title="Cluster detail">
          <Tooltip title="Scale node pools">
            <span>
              <IconButton onClick={handleScale} disabled={!cluster}>
                <LayersIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Open provisioning wizard">
            <span>
              <IconButton onClick={handleAddCluster} disabled={!cluster}>
                <LaunchIcon />
              </IconButton>
            </span>
          </Tooltip>
        </ContentHeader>
        {error && (
          <WarningPanel severity="error" title="Unable to load cluster details">
            {error}
          </WarningPanel>
        )}
        {usingFallback && (
          <WarningPanel severity="warning" title="Showing staged data">
            The platform API is unavailable in this environment. Displaying staged cluster details
            for UI exploration.
          </WarningPanel>
        )}
        {loading && <Progress />}
        {!loading && cluster && (
          <>
            <Card>
              <CardContent className={classes.section}>
                <Typography variant="h5">{cluster.name}</Typography>
                <Box className={classes.chipRow}>
                  <Chip
                    label={cluster.phase}
                    color={statusChipColor[cluster.phase]}
                    icon={<CloudQueueIcon />}
                  />
                  <Chip label={cluster.region} variant="outlined" />
                  <Chip label={`Project: ${cluster.projectId}`} variant="outlined" />
                  {cluster.costEstimate && (
                    <Chip
                      label={`${formatCurrency(cluster.costEstimate.hourly, cluster.costEstimate.currency || 'USD')}/hr`}
                      variant="default"
                    />
                  )}
                </Box>
              </CardContent>
            </Card>
            <Tabs
              value={tab}
              onChange={(_, value) => setTab(value as DetailTab)}
              indicatorColor="primary"
              textColor="primary"
            >
              <Tab label="Overview" />
              <Tab label={`Node pools (${totalNodePools})`} />
              <Tab label="Integrations" />
              <Tab label="Activity & logs" />
            </Tabs>
            <div className={classes.tabPanel}>
              {tab === 0 && (
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <Card className={classes.listCard}>
                      <CardContent>
                        <Typography variant="h6">Conditions</Typography>
                        {cluster.conditions && cluster.conditions.length > 0 ? (
                          <List dense>
                            {cluster.conditions.map((condition: ClusterJobCondition) => (
                              <ListItem key={condition.type}>
                                <ListItemIcon>
                                  {condition.status === 'True'
                                    ? statusIcon('success')
                                    : condition.status === 'False'
                                      ? statusIcon('error')
                                      : statusIcon('warning')}
                                </ListItemIcon>
                                <ListItemText
                                  primary={condition.type}
                                  secondary={condition.message || condition.reason || condition.status}
                                />
                              </ListItem>
                            ))}
                          </List>
                        ) : (
                          <Typography>No conditions reported yet.</Typography>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <InfoCard title="Access context" variant="gridItem">
                      <Typography variant="body1">Account: {cluster.accountId || 'Inherited'}</Typography>
                      <Typography variant="body1">
                        Assume role: {cluster.assumeRoleArn || 'Project default'}
                      </Typography>
                      <Typography variant="body1">
                        Last synced:{' '}
                        {cluster.lastSyncedAt ? new Date(cluster.lastSyncedAt).toLocaleString() : '—'}
                      </Typography>
                    </InfoCard>
                  </Grid>
                </Grid>
              )}
              {tab === 1 && (
                <Card className={classes.listCard}>
                  <CardContent>
                    <Typography variant="h6">Node pools</Typography>
                    <NodePoolTable nodePools={cluster.nodePools} />
                    {cluster.additionalClusters && cluster.additionalClusters.length > 0 && (
                      <>
                        <Divider style={{ margin: '16px 0' }} />
                        {cluster.additionalClusters.map(additional => (
                          <Box key={additional.clusterId} mt={2}>
                            <Typography variant="subtitle1">
                              {additional.name || additional.clusterId}
                            </Typography>
                            <NodePoolTable
                              nodePools={
                                additional.nodePools as ClusterNodePoolStatus[] | undefined
                              }
                            />
                          </Box>
                        ))}
                      </>
                    )}
                  </CardContent>
                </Card>
              )}
              {tab === 2 && (
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <InfoCard title="Helm integration" variant="gridItem">
                      <Typography variant="body1">
                        Namespace: {cluster.helm?.namespace || 'aegis-system'}
                      </Typography>
                      <Typography variant="body1">
                        Chart version: {cluster.helm?.chartVersion || 'latest'}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        Values stored with the provisioning manifest are surfaced here for review.
                      </Typography>
                    </InfoCard>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <InfoCard title="Platform endpoints" variant="gridItem">
                      <Typography variant="body1">
                        API server: {cluster.platformOverrides?.apiServer || 'default'}
                      </Typography>
                      <Typography variant="body1">
                        Metrics: {cluster.platformOverrides?.metricsEndpoint || 'default'}
                      </Typography>
                      <Typography variant="body1">
                        Logging: {cluster.platformOverrides?.loggingEndpoint || 'default'}
                      </Typography>
                    </InfoCard>
                  </Grid>
                  {cluster.kubeconfigSecrets && cluster.kubeconfigSecrets.length > 0 && (
                    <Grid item xs={12}>
                      <Card>
                        <CardContent>
                          <Typography variant="h6">Kubeconfig secrets</Typography>
                          {cluster.kubeconfigSecrets.map(secret => (
                            <Box
                              key={`${secret.namespace}-${secret.name}`}
                              display="flex"
                              alignItems="center"
                              justifyContent="space-between"
                              mt={2}
                            >
                              <div>
                                <Typography variant="subtitle1">{secret.name}</Typography>
                                <Typography variant="body2" color="textSecondary">
                                  Namespace: {secret.namespace || 'aegis-system'}
                                </Typography>
                                {secret.description && (
                                  <Typography variant="body2" color="textSecondary">
                                    {secret.description}
                                  </Typography>
                                )}
                              </div>
                              <Tooltip title="Copy secret name">
                                <span>
                                  <IconButton onClick={() => handleCopy(secret.name)}>
                                    <FileCopyIcon />
                                  </IconButton>
                                </span>
                              </Tooltip>
                            </Box>
                          ))}
                        </CardContent>
                      </Card>
                    </Grid>
                  )}
                </Grid>
              )}
              {tab === 3 && (
                <Card>
                  <CardContent>
                    <Typography variant="h6">Activity log</Typography>
                    <ActivityList activity={cluster.activity} />
                  </CardContent>
                </Card>
              )}
            </div>
          </>
        )}
      </Content>
    </Page>
  );
};
