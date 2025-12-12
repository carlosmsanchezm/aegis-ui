import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Chip,
  FormControl,
  Grid,
  InputLabel,
  LinearProgress,
  List,
  ListItem,
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
  Page,
  Progress,
  WarningPanel,
} from '@backstage/core-components';
import { discoveryApiRef, fetchApiRef, identityApiRef, useApi } from '@backstage/core-plugin-api';
import { keycloakAuthApiRef } from '../../apis';
import {
  ClusterSummary,
  PrometheusMetricSeries,
  listClusters,
  queryMetrics,
} from '../../../../../plugins/aegis/src/api/aegisClient';

const useStyles = makeStyles(theme => {
  const isDark = theme.palette.type === 'dark';
  const cardBorder = isDark
    ? '1px solid rgba(148, 163, 184, 0.18)'
    : '1px solid rgba(15, 23, 42, 0.08)';
  const cardBackground = isDark
    ? 'linear-gradient(160deg, rgba(15,23,42,0.88) 0%, rgba(15,23,42,0.55) 100%)'
    : 'linear-gradient(160deg, rgba(246,248,252,0.96) 0%, rgba(229,235,247,0.88) 100%)';
  const progressBackground = isDark
    ? 'rgba(148, 163, 184, 0.15)'
    : 'rgba(15, 23, 42, 0.08)';
  const sparkGradient = isDark
    ? 'linear-gradient(180deg, rgba(16,185,129,0.9) 0%, rgba(56,189,248,0.9) 100%)'
    : 'linear-gradient(180deg, rgba(99,102,241,0.75) 0%, rgba(59,130,246,0.75) 100%)';

  return {
    pageContent: {
      paddingBottom: theme.spacing(6),
    },
    metricCard: {
      padding: theme.spacing(3),
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(2),
      border: cardBorder,
      background: cardBackground,
      borderRadius: 24,
    },
    metricHeader: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    metricValue: {
      fontSize: '2rem',
      fontWeight: 600,
      letterSpacing: '-0.02em',
    },
    metricTrend: {
      color: isDark ? theme.palette.success.main : theme.palette.primary.main,
    },
    graph: {
      height: 8,
      borderRadius: 999,
      backgroundColor: progressBackground,
      '& .MuiLinearProgress-barColorPrimary': {
        borderRadius: 999,
        background:
          'linear-gradient(135deg, rgba(14,165,233,0.85), rgba(99,102,241,0.95))',
      },
    },
    listItem: {
      padding: theme.spacing(2, 0),
      '&:not(:last-child)': {
        borderBottom: isDark
          ? '1px solid rgba(148, 163, 184, 0.08)'
          : '1px solid rgba(15, 23, 42, 0.06)',
      },
    },
    subtle: {
      color: theme.palette.text.secondary,
    },
    sparklines: {
      display: 'flex',
      gap: 4,
      alignItems: 'flex-end',
      height: 36,
    },
    sparkBar: {
      width: 6,
      borderRadius: 8,
      background: sparkGradient,
    },
  };
});

const cpuQuery =
  'sum(rate(container_cpu_usage_seconds_total{container!=\"\",container!=\"POD\"}[5m]))';
const memoryQuery =
  'sum(container_memory_working_set_bytes{container!=\"\",container!=\"POD\"})';
const podCountQuery = 'count(kube_pod_info)';
const gpuUtilizationQueryCandidates = [
  'DCGM_FI_DEV_GPU_UTIL',
  'nvidia_gpu_duty_cycle',
];

const lastSampleValue = (series?: PrometheusMetricSeries[]): number | undefined => {
  const samples = series?.[0]?.samples;
  if (!samples || samples.length === 0) {
    return undefined;
  }
  return samples[samples.length - 1]?.value;
};

const averageLastSampleValue = (
  series?: PrometheusMetricSeries[],
): number | undefined => {
  const values = (series ?? [])
    .map(item => {
      const samples = item.samples;
      if (!samples || samples.length === 0) {
        return undefined;
      }
      const value = samples[samples.length - 1]?.value;
      return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
    })
    .filter((value): value is number => typeof value === 'number');

  if (values.length === 0) {
    return undefined;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const normalizePercent = (value?: number): number | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }
  let normalized = value;
  if (normalized > 0 && normalized <= 1) {
    normalized *= 100;
  }
  return Math.min(100, Math.max(0, normalized));
};

const sparkHeightsFromSeries = (
  series?: PrometheusMetricSeries[],
  count = 10,
  minHeight = 12,
  maxHeight = 34,
): number[] => {
  const samples = series?.[0]?.samples ?? [];
  const values = samples
    .slice(-count)
    .map(sample => sample?.value)
    .filter(value => typeof value === 'number' && Number.isFinite(value)) as number[];
  if (values.length === 0) {
    return Array.from({ length: count }, () => minHeight);
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
    const mid = Math.round((minHeight + maxHeight) / 2);
    return Array.from({ length: count }, () => mid);
  }
  return values.map(value => {
    const ratio = (value - min) / (max - min);
    return Math.round(minHeight + ratio * (maxHeight - minHeight));
  });
};

const formatNumber = (value?: number, suffix = ''): string =>
  typeof value === 'number' && Number.isFinite(value)
    ? `${value.toFixed(2)}${suffix}`
    : '—';

const formatBytes = (value?: number): string => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '—';
  }
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  let bytes = Math.max(0, value);
  let unit = 0;
  while (bytes >= 1024 && unit < units.length - 1) {
    bytes /= 1024;
    unit += 1;
  }
  return `${bytes.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
};

export const AegisTelemetryPage = () => {
  const classes = useStyles();
  const fetchApi = useApi(fetchApiRef);
  const discoveryApi = useApi(discoveryApiRef);
  const identityApi = useApi(identityApiRef);
  const authApi = useApi(keycloakAuthApiRef);

  const [clusters, setClusters] = useState<ClusterSummary[]>([]);
  const [clusterId, setClusterId] = useState('');
  const [loadingClusters, setLoadingClusters] = useState(false);
  const [clusterError, setClusterError] = useState<string | null>(null);

  const selectedCluster = useMemo(
    () => clusters.find(cluster => cluster.id === clusterId) ?? null,
    [clusters, clusterId],
  );

  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [cpuSeries, setCpuSeries] = useState<PrometheusMetricSeries[] | undefined>();
  const [memorySeries, setMemorySeries] = useState<PrometheusMetricSeries[] | undefined>();
  const [podSeries, setPodSeries] = useState<PrometheusMetricSeries[] | undefined>();
  const [gpuUtilization, setGpuUtilization] = useState<number | undefined>();

  useEffect(() => {
    let active = true;
    const loadClusters = async () => {
      setLoadingClusters(true);
      setClusterError(null);
      try {
        const items = await listClusters(fetchApi, discoveryApi, identityApi, authApi);
        if (!active) {
          return;
        }
        setClusters(items);
        if (items.length > 0) {
          setClusterId(prev => prev || items[0].id);
        }
      } catch (err: any) {
        if (active) {
          setClusterError(err?.message || 'Unable to load clusters.');
          setClusters([]);
        }
      } finally {
        if (active) {
          setLoadingClusters(false);
        }
      }
    };
    loadClusters();
    return () => {
      active = false;
    };
  }, [fetchApi, discoveryApi, identityApi, authApi]);

  useEffect(() => {
    if (!selectedCluster) {
      setCpuSeries(undefined);
      setMemorySeries(undefined);
      setPodSeries(undefined);
      setGpuUtilization(undefined);
      setMetricsError(null);
      return;
    }

    let active = true;
    const loadMetrics = async () => {
      setLoadingMetrics(true);
      setMetricsError(null);
      try {
        const [cpuRes, memoryRes, podsRes] = await Promise.all([
          queryMetrics(fetchApi, discoveryApi, identityApi, authApi, {
            projectId: selectedCluster.projectId,
            clusterId: selectedCluster.id,
            query: cpuQuery,
            rangeSeconds: 15 * 60,
            stepSeconds: 30,
          }),
          queryMetrics(fetchApi, discoveryApi, identityApi, authApi, {
            projectId: selectedCluster.projectId,
            clusterId: selectedCluster.id,
            query: memoryQuery,
            rangeSeconds: 15 * 60,
            stepSeconds: 30,
          }),
          queryMetrics(fetchApi, discoveryApi, identityApi, authApi, {
            projectId: selectedCluster.projectId,
            clusterId: selectedCluster.id,
            query: podCountQuery,
            rangeSeconds: 15 * 60,
            stepSeconds: 60,
          }),
        ]);

        if (!active) {
          return;
        }

        setCpuSeries(cpuRes.series);
        setMemorySeries(memoryRes.series);
        setPodSeries(podsRes.series);

        let gpuAvg: number | undefined;
        for (const query of gpuUtilizationQueryCandidates) {
          try {
            const gpuRes = await queryMetrics(fetchApi, discoveryApi, identityApi, authApi, {
              projectId: selectedCluster.projectId,
              clusterId: selectedCluster.id,
              query,
              rangeSeconds: 15 * 60,
              stepSeconds: 30,
            });
            gpuAvg = normalizePercent(averageLastSampleValue(gpuRes.series));
            if (gpuAvg !== undefined) {
              break;
            }
          } catch {
            // Ignore GPU query failures; some clusters won't expose GPU metrics.
          }
        }
        setGpuUtilization(gpuAvg);
      } catch (err: any) {
        if (active) {
          setMetricsError(err?.message || 'Unable to load telemetry metrics.');
          setCpuSeries(undefined);
          setMemorySeries(undefined);
          setPodSeries(undefined);
          setGpuUtilization(undefined);
        }
      } finally {
        if (active) {
          setLoadingMetrics(false);
        }
      }
    };

    loadMetrics();
    const interval = setInterval(loadMetrics, 30_000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [selectedCluster, fetchApi, discoveryApi, identityApi, authApi]);

  const analytics = useMemo(() => {
    const cpu = lastSampleValue(cpuSeries);
    const memory = lastSampleValue(memorySeries);
    const pods = lastSampleValue(podSeries);

    return [
      {
        label: 'CPU Usage (cores)',
        value: formatNumber(cpu, ''),
        trend: cpu !== undefined ? 'Live' : 'No data',
        progress: 100,
        status: cpu !== undefined ? 'Live' : 'Unavailable',
        sparkline: sparkHeightsFromSeries(cpuSeries),
      },
      {
        label: 'Memory Working Set',
        value: formatBytes(memory),
        trend: memory !== undefined ? 'Live' : 'No data',
        progress: 100,
        status: memory !== undefined ? 'Live' : 'Unavailable',
        sparkline: sparkHeightsFromSeries(memorySeries),
      },
      {
        label: 'Pod Count',
        value: pods !== undefined ? Math.round(pods).toString() : '—',
        trend: pods !== undefined ? 'Live' : 'No data',
        progress: 100,
        status: pods !== undefined ? 'Live' : 'Unavailable',
        sparkline: sparkHeightsFromSeries(podSeries),
      },
    ];
  }, [cpuSeries, memorySeries, podSeries]);

  const observability = useMemo(() => {
    const clusterLabel = selectedCluster
      ? `${selectedCluster.projectId} · ${selectedCluster.name || selectedCluster.id}`
      : '—';

    return [
      {
        name: `Selected cluster · ${clusterLabel}`,
        summary: selectedCluster
          ? 'Metrics, logs, alerts, and traces are queried via the control plane proxy.'
          : 'Select a cluster to query observability endpoints.',
        status: selectedCluster ? 'Active' : 'Idle',
      },
      {
        name: 'Prometheus',
        summary: cpuSeries ? 'Query OK' : 'Not available',
        status: cpuSeries ? 'Operational' : 'Unavailable',
      },
      {
        name: 'GPU telemetry',
        summary:
          typeof gpuUtilization === 'number'
            ? `Avg utilization ${gpuUtilization.toFixed(1)}%`
            : 'No GPU series detected',
        status: typeof gpuUtilization === 'number' ? 'Operational' : 'Unavailable',
      },
    ];
  }, [selectedCluster, cpuSeries, gpuUtilization]);

  return (
    <Page themeId="tool">
      <Content className={classes.pageContent}>
        <ContentHeader title="Telemetry Pulse">
          <Chip label="Cluster-scoped" color="primary" />
          <Chip label="Powered by Prometheus/Loki" variant="outlined" />
        </ContentHeader>
        <Box px={4} pb={6}>
          {clusterError && (
            <WarningPanel title="Unable to load clusters">
              {clusterError}
            </WarningPanel>
          )}
          {loadingClusters && <Progress />}

          {!loadingClusters && clusters.length > 0 && (
            <Box mb={3} display="flex" style={{ gap: 16 }} flexWrap="wrap">
              <FormControl variant="outlined" size="small">
                <InputLabel id="aegis-telemetry-cluster-select-label">
                  Cluster
                </InputLabel>
                <Select
                  labelId="aegis-telemetry-cluster-select-label"
                  value={clusterId}
                  onChange={event => setClusterId(event.target.value as string)}
                  label="Cluster"
                >
                  {clusters.map(cluster => (
                    <MenuItem key={cluster.id} value={cluster.id}>
                      {cluster.projectId} · {cluster.name || cluster.id}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              {selectedCluster && (
                <>
                  <Chip label={`Provider: ${selectedCluster.provider}`} variant="outlined" />
                  <Chip label={`Region: ${selectedCluster.region}`} variant="outlined" />
                </>
              )}
            </Box>
          )}

          {metricsError && (
            <WarningPanel title="Telemetry unavailable">{metricsError}</WarningPanel>
          )}
          {loadingMetrics && <Progress />}

          <Grid container spacing={4}>
            {analytics.map(metric => (
              <Grid item xs={12} md={4} key={metric.label}>
                <Paper className={classes.metricCard} elevation={0}>
                  <div className={classes.metricHeader}>
                    <Typography variant="subtitle1">{metric.label}</Typography>
                    <Chip label={metric.status} color="secondary" size="small" />
                  </div>
                  <Typography className={classes.metricValue}>
                    {metric.value}
                  </Typography>
                  <Typography variant="body2" className={classes.metricTrend}>
                    {metric.trend}
                  </Typography>
                  <div className={classes.sparklines}>
                    {metric.sparkline.map((height, index) => (
                      <span
                        key={`${metric.label}-spark-${index}`}
                        className={classes.sparkBar}
                        style={{ height }}
                      />
                    ))}
                  </div>
                  <LinearProgress
                    variant="determinate"
                    value={metric.progress}
                    className={classes.graph}
                  />
                </Paper>
              </Grid>
            ))}
            <Grid item xs={12} md={5}>
              <Paper className={classes.metricCard} elevation={0}>
                <Typography variant="h5">Signal Stream</Typography>
                <Typography variant="body2" className={classes.subtle}>
                  Live cluster telemetry sourced from the in-cluster observability stack.
                </Typography>
                <List disablePadding>
                  {observability.map(item => (
                    <ListItem key={item.name} className={classes.listItem}>
                      <ListItemText
                        primary={item.name}
                        secondary={item.summary}
                      />
                      <Chip label={item.status} variant="default" />
                    </ListItem>
                  ))}
                </List>
              </Paper>
            </Grid>
            <Grid item xs={12} md={7}>
              <Paper className={classes.metricCard} elevation={0}>
                <Typography variant="h5">Streaming Analytics</Typography>
                <Typography variant="body2" className={classes.subtle}>
                  GPU health derived from Prometheus scrapes (when available).
                </Typography>
                <Box mt={2}>
                  <Grid container spacing={2}>
                    {[
                      typeof gpuUtilization === 'number'
                        ? Math.round(gpuUtilization)
                        : undefined,
                    ]
                      .filter(value => typeof value === 'number')
                      .map((value, index) => (
                      <Grid item xs={12} md={4} key={`segment-${index}`}>
                        <Paper elevation={0} className={classes.metricCard}>
                          <Typography variant="subtitle2">
                            Segment {index + 1}
                          </Typography>
                          <Typography className={classes.metricValue}>
                            {value}%
                          </Typography>
                          <LinearProgress
                            variant="determinate"
                            value={value}
                            className={classes.graph}
                          />
                        </Paper>
                      </Grid>
                    ))}
                    {typeof gpuUtilization !== 'number' && (
                      <Grid item xs={12}>
                        <WarningPanel title="GPU telemetry not detected">
                          The selected cluster did not return GPU utilization metrics. This is expected for CPU-only clusters.
                        </WarningPanel>
                      </Grid>
                    )}
                  </Grid>
                </Box>
              </Paper>
            </Grid>
          </Grid>
        </Box>
      </Content>
    </Page>
  );
};

export default AegisTelemetryPage;
