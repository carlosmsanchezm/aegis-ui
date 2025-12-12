import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  InputLabel,
  FormControl,
  makeStyles,
  MenuItem,
  Paper,
  Select,
  TextField,
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
  StatusError,
  StatusOK,
  StatusPending,
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
  LogEntryDTO,
  listClusters,
  queryLogs,
} from '../api/aegisClient';

const useStyles = makeStyles(theme => ({
  root: {
    paddingBottom: theme.spacing(6),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(4),
  },
  filterBar: {
    display: 'grid',
    gap: theme.spacing(2),
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  },
  paper: {
    background: 'var(--aegis-card-surface)',
    border: '1px solid var(--aegis-card-border)',
    boxShadow: 'var(--aegis-card-shadow)',
    borderRadius: theme.shape.borderRadius * 2,
    padding: theme.spacing(3),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(3),
  },
}));

type LogSeverity = 'INFO' | 'WARN' | 'ERROR';

type LogRow = {
  timestamp: string;
  severity: LogSeverity;
  namespace?: string;
  pod?: string;
  container?: string;
  message: string;
  labels?: Record<string, string>;
};

const resolveSeverity = (entry: LogEntryDTO): LogSeverity => {
  const label = (
    entry.labels?.level ??
    entry.labels?.severity ??
    entry.labels?.lvl ??
    entry.labels?.log_level ??
    ''
  ).toLowerCase();
  if (label.includes('error') || label.includes('critical') || label === 'err') {
    return 'ERROR';
  }
  if (label.includes('warn')) {
    return 'WARN';
  }

  const msg = (entry.message ?? '').toLowerCase();
  if (msg.includes(' level=error') || msg.includes('\"level\":\"error\"') || msg.startsWith('error')) {
    return 'ERROR';
  }
  if (msg.includes(' level=warn') || msg.includes('\"level\":\"warn\"') || msg.startsWith('warn')) {
    return 'WARN';
  }
  return 'INFO';
};

const severityIndicator = (severity: LogRow['severity']) => {
  if (severity === 'ERROR') {
    return <StatusError>Critical</StatusError>;
  }
  if (severity === 'WARN') {
    return <StatusPending>Warn</StatusPending>;
  }
  return <StatusOK>Info</StatusOK>;
};

const timeWindowMinutes: Record<string, number> = {
  '15m': 15,
  '1h': 60,
  '24h': 24 * 60,
  '7d': 7 * 24 * 60,
};

export const AegisLogExplorerPage = () => {
  const classes = useStyles();
  const location = useLocation();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const initialWorkloadFilter = searchParams.get('workloadId') ?? '';

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

  const [search, setSearch] = useState(initialWorkloadFilter);
  const [severity, setSeverity] = useState<'all' | LogRow['severity']>('all');
  const [window, setWindow] = useState<keyof typeof timeWindowMinutes>('1h');
  const [namespace, setNamespace] = useState('');
  const [pod, setPod] = useState('');
  const [includeEvents, setIncludeEvents] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);
  const [entries, setEntries] = useState<LogRow[]>([]);

  useEffect(() => {
    if (initialWorkloadFilter) {
      setSearch(initialWorkloadFilter);
    }
  }, [initialWorkloadFilter]);

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
          setClusters([]);
          setClusterError(err?.message || 'Unable to load clusters.');
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
      setEntries([]);
      setLogError(null);
      return;
    }

    let active = true;
    const loadLogs = async () => {
      setLoadingLogs(true);
      setLogError(null);
      try {
        const end = new Date();
        const windowMinutes = timeWindowMinutes[window];
        const start = new Date(end.getTime() - windowMinutes * 60_000);

        const response = await queryLogs(fetchApi, discoveryApi, identityApi, authApi, {
          projectId: selectedCluster.projectId,
          clusterId: selectedCluster.id,
          namespace: namespace.trim(),
          pod: pod.trim(),
          substring: search.trim(),
          start: start.toISOString(),
          end: end.toISOString(),
          limit: 200,
          includeEvents,
        });

        if (!active) {
          return;
        }

        const rows: LogRow[] = (response.entries ?? []).map(entry => ({
          timestamp: entry.timestamp,
          severity: resolveSeverity(entry),
          namespace: entry.namespace,
          pod: entry.pod,
          container: entry.container,
          message: entry.message,
          labels: entry.labels,
        }));
        setEntries(rows);
      } catch (err: any) {
        if (active) {
          setEntries([]);
          setLogError(err?.message || 'Unable to query logs.');
        }
      } finally {
        if (active) {
          setLoadingLogs(false);
        }
      }
    };

    loadLogs();
    const interval = setInterval(loadLogs, 15_000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [
    selectedCluster,
    window,
    namespace,
    pod,
    search,
    includeEvents,
    fetchApi,
    discoveryApi,
    identityApi,
    authApi,
  ]);

  const filteredLogs = useMemo(() => {
    return entries.filter(entry => {
      if (severity !== 'all' && entry.severity !== severity) {
        return false;
      }
      return true;
    });
  }, [entries, severity]);

  const columns = useMemo<TableColumn<LogRow>[]>(
    () => [
      { title: 'Timestamp', field: 'timestamp' },
      {
        title: 'Severity',
        field: 'severity',
        render: row => severityIndicator(row.severity),
      },
      { title: 'Namespace', field: 'namespace' },
      { title: 'Pod', field: 'pod' },
      { title: 'Container', field: 'container' },
      { title: 'Message', field: 'message' },
    ],
    [],
  );

  return (
    <Page themeId="tool">
      <Content className={classes.root}>
        <ContentHeader title="Log Explorer">
          <HeaderLabel label="Cluster" value={selectedCluster?.name || selectedCluster?.id || '—'} />
          <HeaderLabel label="Time Window" value={window} />
          <HeaderLabel label="Events" value={includeEvents ? 'On' : 'Off'} />
        </ContentHeader>

        {clusterError && (
          <WarningPanel title="Unable to load clusters">{clusterError}</WarningPanel>
        )}
        {loadingClusters && <Progress />}

        <Paper className={classes.paper}>
          <Typography variant="h6">Filters</Typography>
          <div className={classes.filterBar}>
            <FormControl variant="outlined" fullWidth>
              <InputLabel id="log-cluster-select-label">Cluster</InputLabel>
              <Select
                labelId="log-cluster-select-label"
                value={clusterId}
                label="Cluster"
                onChange={event => setClusterId(event.target.value as string)}
              >
                {clusters.map(cluster => (
                  <MenuItem key={cluster.id} value={cluster.id}>
                    {cluster.projectId} · {cluster.name || cluster.id}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Search text or workload"
              variant="outlined"
              size="small"
              fullWidth
              value={search}
              onChange={event => setSearch(event.target.value)}
            />
            <TextField
              label="Namespace"
              variant="outlined"
              size="small"
              fullWidth
              value={namespace}
              onChange={event => setNamespace(event.target.value)}
            />
            <TextField
              label="Pod"
              variant="outlined"
              size="small"
              fullWidth
              value={pod}
              onChange={event => setPod(event.target.value)}
            />
            <div>
              <FormControl variant="outlined" fullWidth>
                <InputLabel id="log-severity-select-label">Severity</InputLabel>
                <Select
                  labelId="log-severity-select-label"
                  id="log-severity-select"
                  value={severity}
                  label="Severity"
                  onChange={event => setSeverity(event.target.value as typeof severity)}
                >
                  <MenuItem value="all">All severities</MenuItem>
                  <MenuItem value="ERROR">Errors only</MenuItem>
                  <MenuItem value="WARN">Warnings</MenuItem>
                  <MenuItem value="INFO">Info</MenuItem>
                </Select>
              </FormControl>
            </div>
            <div>
              <FormControl variant="outlined" fullWidth>
                <InputLabel id="log-window-select-label">Time range</InputLabel>
                <Select
                  labelId="log-window-select-label"
                  id="log-window-select"
                  value={window}
                  label="Time range"
                  onChange={event => setWindow(event.target.value as typeof window)}
                >
                  <MenuItem value="15m">Last 15 minutes</MenuItem>
                  <MenuItem value="1h">Last hour</MenuItem>
                  <MenuItem value="24h">Last 24 hours</MenuItem>
                  <MenuItem value="7d">Last 7 days</MenuItem>
                </Select>
              </FormControl>
            </div>
            <FormControl variant="outlined" fullWidth>
              <InputLabel id="log-events-toggle-label">Include events</InputLabel>
              <Select
                labelId="log-events-toggle-label"
                value={includeEvents ? 'on' : 'off'}
                label="Include events"
                onChange={event => setIncludeEvents(event.target.value === 'on')}
              >
                <MenuItem value="on">Include Kubernetes events</MenuItem>
                <MenuItem value="off">Logs only</MenuItem>
              </Select>
            </FormControl>
          </div>
        </Paper>

        {logError && (
          <WarningPanel title="Logs unavailable">{logError}</WarningPanel>
        )}
        {loadingLogs && <Progress />}

        <Paper className={classes.paper}>
          <Table
            options={{ paging: false, search: false, padding: 'dense' }}
            title={`Live log stream (${filteredLogs.length} entries)`}
            columns={columns}
            data={filteredLogs}
          />
        </Paper>
      </Content>
    </Page>
  );
};
