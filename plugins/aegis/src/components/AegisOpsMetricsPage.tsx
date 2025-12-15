import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  FormControl,
  Grid,
  InputLabel,
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
  Progress,
  Table,
  TableColumn,
  WarningPanel,
} from '@backstage/core-components';
import {
  discoveryApiRef,
  fetchApiRef,
  identityApiRef,
  useApi,
} from '@backstage/core-plugin-api';
import { keycloakAuthApiRef } from '../api/refs';
import {
  ClusterSummary,
  PrometheusMetricSeries,
  listClusters,
  queryMetrics,
} from '../api/aegisClient';

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

export const AegisOpsMetricsPage = () => {
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
    const load = async () => {
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
          setClusters([]);
          setClusterError(err?.message || 'Unable to load clusters.');
        }
      } finally {
        if (active) {
          setLoadingClusters(false);
        }
      }
    };
    load();
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
        const [cpuRes, memRes, podsRes] = await Promise.all([
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
        setMemorySeries(memRes.series);
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
          setMetricsError(err?.message || 'Unable to load metrics.');
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

  const columns = useMemo<TableColumn<ClusterSummary>[]>(
    () => [
      {
        title: 'Cluster / Node',
        field: 'name',
        highlight: true,
        render: row => (
          <RouterLink to={`/aegis/operations/resources/${row.id}`} style={{ textDecoration: 'none' }}>
            <Typography color="primary" variant="body2">
              {row.name || row.id}
            </Typography>
          </RouterLink>
        ),
      },
      { title: 'Project', field: 'projectId' },
      { title: 'Phase', field: 'phase' },
      { title: 'Provider', field: 'provider' },
      { title: 'Region', field: 'region' },
    ],
    [],
  );

  const cpu = lastSampleValue(cpuSeries);
  const memory = lastSampleValue(memorySeries);
  const pods = lastSampleValue(podSeries);

  return (
    <Page themeId="tool">
      <Content className={classes.root}>
        <ContentHeader title="Operational Metrics">
          <HeaderLabel label="Clusters" value={clusters.length.toString()} />
          {selectedCluster && (
            <>
              <HeaderLabel label="Project" value={selectedCluster.projectId} />
              <HeaderLabel label="Region" value={selectedCluster.region} />
              <HeaderLabel label="Phase" value={selectedCluster.phase} />
            </>
          )}
        </ContentHeader>

        {clusterError && (
          <WarningPanel title="Unable to load clusters">{clusterError}</WarningPanel>
        )}
        {loadingClusters && <Progress />}

        {!loadingClusters && clusters.length > 0 && (
          <Box mb={3}>
            <FormControl variant="outlined" size="small">
              <InputLabel id="aegis-ops-metrics-cluster-select-label">
                Cluster
              </InputLabel>
              <Select
                labelId="aegis-ops-metrics-cluster-select-label"
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
          </Box>
        )}

        {metricsError && (
          <WarningPanel title="Metrics unavailable">{metricsError}</WarningPanel>
        )}
        {loadingMetrics && <Progress />}

        <Grid container spacing={3}>
          {[
            {
              title: 'CPU Usage (cores)',
              subtitle: 'Rolling 5m rate across cluster',
              metric: formatNumber(cpu),
              trend: cpu !== undefined ? 'Prometheus query_range' : 'No data',
            },
            {
              title: 'Memory Working Set',
              subtitle: 'Container working set bytes',
              metric: formatBytes(memory),
              trend: memory !== undefined ? 'Prometheus query_range' : 'No data',
            },
            {
              title: 'Pod Count',
              subtitle: 'kube-state-metrics count(kube_pod_info)',
              metric: pods !== undefined ? Math.round(pods).toString() : '—',
              trend: pods !== undefined ? 'Prometheus query_range' : 'No data',
            },
          ].map(card => (
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
                  GPU Utilization
                </Typography>
                <Typography variant="body2" className={classes.chartSubtitle}>
                  Average across detected GPUs
                </Typography>
                <Typography variant="h4">
                  {typeof gpuUtilization === 'number'
                    ? `${gpuUtilization.toFixed(1)}%`
                    : '—'}
                </Typography>
                <div className={classes.chartPlaceholder}>
                  {typeof gpuUtilization === 'number'
                    ? 'GPU series available'
                    : 'No GPU metrics detected'}
                </div>
              </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
              <Paper className={classes.chartPaper}>
                <Typography variant="h6" className={classes.chartTitle}>
                  Pod Inventory
                </Typography>
                <Typography variant="body2" className={classes.chartSubtitle}>
                  Drill down via log explorer for pod-level views
                </Typography>
                <div className={classes.chartPlaceholder}>Heatmap placeholder</div>
              </Paper>
            </Grid>
          </Grid>
        </Box>

        <div className={classes.tableWrapper}>
          <Table
            options={{ paging: false, search: false, sorting: false, padding: 'dense' }}
            title="Clusters"
            columns={columns}
            data={clusters}
          />
        </div>
      </Content>
    </Page>
  );
};
