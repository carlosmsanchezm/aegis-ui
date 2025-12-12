import { useEffect, useMemo, useState } from 'react';
import {
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  makeStyles,
  Paper,
  Typography,
} from '@material-ui/core';
import {
  Content,
  ContentHeader,
  HeaderLabel,
  Page,
  Progress,
  StatusError,
  StatusOK,
  StatusPending,
  Table,
  TableColumn,
  WarningPanel,
} from '@backstage/core-components';
import {
  alertApiRef,
  discoveryApiRef,
  fetchApiRef,
  identityApiRef,
  useApi,
} from '@backstage/core-plugin-api';
import { keycloakAuthApiRef } from '../api/refs';
import { AlertView, ClusterSummary, getAlerts, listClusters } from '../api/aegisClient';

type AlertRow = {
  id: string;
  title: string;
  severity: 'critical' | 'warning' | 'info';
  cluster: string;
  started: string;
  state: string;
};

const useStyles = makeStyles(theme => ({
  root: {
    paddingBottom: theme.spacing(6),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(4),
  },
  paper: {
    background: 'var(--aegis-card-surface)',
    border: '1px solid var(--aegis-card-border)',
    boxShadow: 'var(--aegis-card-shadow)',
    borderRadius: theme.shape.borderRadius * 2,
    padding: theme.spacing(3),
  },
}));

const alertStatus = (severity: AlertRow['severity']) => {
  switch (severity) {
    case 'critical':
      return <StatusError>Critical</StatusError>;
    case 'warning':
      return <StatusPending>Warning</StatusPending>;
    default:
      return <StatusOK>Info</StatusOK>;
  }
};

const resolveSeverity = (alert: AlertView): AlertRow['severity'] => {
  const raw = (alert.labels?.severity ?? alert.labels?.priority ?? '').toLowerCase();
  if (raw.includes('critical') || raw.includes('high') || raw.includes('sev1')) {
    return 'critical';
  }
  if (raw.includes('warning') || raw.includes('medium') || raw.includes('sev2')) {
    return 'warning';
  }
  return 'info';
};

const formatAlertTimestamp = (raw?: string): string => {
  if (!raw) {
    return '—';
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return raw;
  }
  return parsed.toISOString().replace('T', ' ').replace('Z', ' UTC');
};

export const AegisAlertsDashboardPage = () => {
  const classes = useStyles();
  const alertApi = useApi(alertApiRef);
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

  const [rows, setRows] = useState<AlertRow[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [alertsError, setAlertsError] = useState<string | null>(null);

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
      setRows([]);
      setAlertsError(null);
      return;
    }

    let active = true;
    const loadAlerts = async () => {
      setLoadingAlerts(true);
      setAlertsError(null);
      try {
        const response = await getAlerts(
          fetchApi,
          discoveryApi,
          identityApi,
          authApi,
          selectedCluster.projectId,
          selectedCluster.id,
        );
        if (!active) {
          return;
        }
        const items = response.alerts ?? [];
        const mapped: AlertRow[] = items.map(alert => ({
          id: alert.fingerprint || `${alert.labels?.alertname ?? 'alert'}-${alert.startsAt ?? ''}`,
          title:
            alert.annotations?.summary ||
            alert.annotations?.description ||
            alert.labels?.alertname ||
            'Alert',
          severity: resolveSeverity(alert),
          cluster: selectedCluster.name || selectedCluster.id,
          started: formatAlertTimestamp(alert.startsAt),
          state: alert.state || 'unknown',
        }));
        setRows(mapped);
      } catch (err: any) {
        if (active) {
          setRows([]);
          const message = err?.message || 'Unable to load alerts.';
          setAlertsError(message);
          alertApi.post({ severity: 'error', message });
        }
      } finally {
        if (active) {
          setLoadingAlerts(false);
        }
      }
    };

    loadAlerts();
    const interval = setInterval(loadAlerts, 30_000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [selectedCluster, fetchApi, discoveryApi, identityApi, authApi, alertApi]);

  const columns = useMemo<TableColumn<AlertRow>[]>(
    () => [
      { title: 'Alert', field: 'title' },
      {
        title: 'Severity',
        field: 'severity',
        render: row => alertStatus(row.severity),
      },
      { title: 'Cluster', field: 'cluster' },
      { title: 'Started', field: 'started' },
      {
        title: 'State',
        field: 'state',
      },
    ],
    [],
  );

  return (
    <Page themeId="tool">
      <Content className={classes.root}>
        <ContentHeader title="Alerts Dashboard">
          <HeaderLabel label="Cluster" value={selectedCluster?.name || selectedCluster?.id || '—'} />
          <HeaderLabel label="Active" value={rows.length.toString()} />
        </ContentHeader>

        {clusterError && (
          <WarningPanel title="Unable to load clusters">{clusterError}</WarningPanel>
        )}
        {loadingClusters && <Progress />}

        <Paper className={classes.paper}>
          <FormControl variant="outlined" size="small" fullWidth>
            <InputLabel id="alerts-cluster-select-label">Cluster</InputLabel>
            <Select
              labelId="alerts-cluster-select-label"
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
        </Paper>

        {alertsError && (
          <WarningPanel title="Alerts unavailable">{alertsError}</WarningPanel>
        )}
        {loadingAlerts && <Progress />}

        <Paper className={classes.paper}>
          <Typography variant="h6" gutterBottom>
            Active Alerts
          </Typography>
          <Table
            options={{ paging: false, search: false, padding: 'dense' }}
            columns={columns}
            data={rows}
          />
        </Paper>
      </Content>
    </Page>
  );
};
