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
  Table,
  TableColumn,
  StatusError,
  StatusOK,
  StatusPending,
} from '@backstage/core-components';

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

type LogRow = {
  timestamp: string;
  severity: 'INFO' | 'WARN' | 'ERROR';
  component: string;
  workloadId?: string;
  message: string;
};

const logs: LogRow[] = [
  {
    timestamp: '2024-03-24T14:01:12Z',
    severity: 'ERROR',
    component: 'sentinel-east-2/node-manager-1',
    workloadId: 'wrk-2087a',
    message: 'GPU heartbeat missed for 3 intervals; scheduling drain.',
  },
  {
    timestamp: '2024-03-24T13:58:06Z',
    severity: 'WARN',
    component: 'aurora-west-1/scheduler',
    workloadId: 'wrk-3011z',
    message: 'Queue depth exceeded policy threshold, triggering autoscale.',
  },
  {
    timestamp: '2024-03-24T13:52:44Z',
    severity: 'INFO',
    component: 'atlas-eu-central/ingress',
    message: 'Successfully rotated TLS bundle for edge endpoints.',
  },
  {
    timestamp: '2024-03-24T13:49:02Z',
    severity: 'ERROR',
    component: 'titan-apac/gpu-agent-1',
    workloadId: 'wrk-2087a',
    message: 'CUDA driver reset failed; node marked degraded.',
  },
  {
    timestamp: '2024-03-24T13:42:19Z',
    severity: 'INFO',
    component: 'sentinel-east-2/node-manager-0',
    workloadId: 'wrk-1174b',
    message: 'Node drain completed and returned to pool.',
  },
  {
    timestamp: '2024-03-24T13:39:55Z',
    severity: 'WARN',
    component: 'aurora-west-1/etcd',
    message: 'Leader election latency exceeded 250ms.',
  },
  {
    timestamp: '2024-03-24T13:34:27Z',
    severity: 'INFO',
    component: 'atlas-eu-central/ingress',
    workloadId: 'wrk-5520q',
    message: 'Applied rate-limiting policy for partner tenant.',
  },
];

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

  const [search, setSearch] = useState(initialWorkloadFilter);
  const [severity, setSeverity] = useState<'all' | LogRow['severity']>('all');
  const [window, setWindow] = useState<keyof typeof timeWindowMinutes>('1h');

  useEffect(() => {
    if (initialWorkloadFilter) {
      setSearch(initialWorkloadFilter);
    }
  }, [initialWorkloadFilter]);

  const filteredLogs = useMemo(() => {
    const now = Date.now();
    const windowMinutes = timeWindowMinutes[window];

    return logs.filter(log => {
      const timestamp = new Date(log.timestamp).getTime();
      if (Number.isFinite(windowMinutes) && windowMinutes > 0) {
        const deltaMinutes = (now - timestamp) / 60000;
        if (deltaMinutes > windowMinutes) {
          return false;
        }
      }
      if (severity !== 'all' && log.severity !== severity) {
        return false;
      }
      if (search) {
        const lower = search.toLowerCase();
        const target = `${log.component} ${log.message} ${log.workloadId ?? ''}`.toLowerCase();
        if (!target.includes(lower)) {
          return false;
        }
      }
      return true;
    });
  }, [search, severity, window]);

  const columns = useMemo<TableColumn<LogRow>[]>(
    () => [
      { title: 'Timestamp', field: 'timestamp' },
      {
        title: 'Severity',
        field: 'severity',
        render: row => severityIndicator(row.severity),
      },
      { title: 'Component', field: 'component' },
      {
        title: 'Workload',
        field: 'workloadId',
        render: row => row.workloadId ?? '—',
      },
      { title: 'Message', field: 'message' },
    ],
    [],
  );

  return (
    <Page themeId="tool">
      <Content className={classes.root}>
        <ContentHeader title="Log Explorer">
          <HeaderLabel label="Streams" value="Control plane" />
          <HeaderLabel label="Last Sync" value="Seconds ago" />
        </ContentHeader>

        <Paper className={classes.paper}>
          <Typography variant="h6">Filters</Typography>
          <div className={classes.filterBar}>
            <TextField
              label="Search text or workload"
              variant="outlined"
              size="small"
              fullWidth
              value={search}
              onChange={event => setSearch(event.target.value)}
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
          </div>
        </Paper>

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
