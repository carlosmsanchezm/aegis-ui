import { ChangeEvent, FC, useMemo, useState } from 'react';
import {
  Page,
  Content,
  ContentHeader,
  Table,
  TableColumn,
} from '@backstage/core-components';
import {
  Box,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
  makeStyles,
} from '@material-ui/core';
import { useLocation } from 'react-router-dom';

const useStyles = makeStyles(theme => ({
  filters: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(2),
    marginBottom: theme.spacing(3),
  },
  filterField: {
    minWidth: 220,
  },
  streamWrapper: {
    backgroundColor: 'var(--aegis-card-surface)',
    border: '1px solid var(--aegis-card-border)',
    boxShadow: 'var(--aegis-card-shadow)',
    padding: theme.spacing(2),
  },
  tableWrapper: {
    marginTop: theme.spacing(1),
  },
}));

type LogEntry = {
  id: string;
  timestamp: string;
  minutesAgo: number;
  severity: 'INFO' | 'WARN' | 'ERROR';
  workloadId: string;
  service: string;
  message: string;
};

const logEntries: LogEntry[] = [
  {
    id: '1',
    timestamp: '2024-05-05T12:31:04Z',
    minutesAgo: 4,
    severity: 'ERROR',
    workloadId: 'workload-telemetry-01',
    service: 'ingress-gateway',
    message:
      '503 upstream_error route=svc-trainer-01 span=4a6 latency=412ms retries=2',
  },
  {
    id: '2',
    timestamp: '2024-05-05T12:29:54Z',
    minutesAgo: 6,
    severity: 'WARN',
    workloadId: 'workload-telemetry-02',
    service: 'scheduler-controller',
    message: 'Eviction pressure rising: node=compute-cluster-b score=0.81',
  },
  {
    id: '3',
    timestamp: '2024-05-05T12:28:12Z',
    minutesAgo: 8,
    severity: 'INFO',
    workloadId: 'workload-telemetry-01',
    service: 'node-exporter',
    message: 'GPU temperature normalized to 64C after throttling event',
  },
  {
    id: '4',
    timestamp: '2024-05-05T12:24:40Z',
    minutesAgo: 12,
    severity: 'ERROR',
    workloadId: 'ml-training-east',
    service: 'job-runner',
    message: 'Failed pod restart: CrashLoopBackOff container=trainer iteration=27',
  },
  {
    id: '5',
    timestamp: '2024-05-05T11:59:31Z',
    minutesAgo: 36,
    severity: 'WARN',
    workloadId: 'edge-fleet-eu',
    service: 'edge-agent',
    message: 'Packet loss 3.2% detected on link=eth1 remote=fra-gw-3',
  },
  {
    id: '6',
    timestamp: '2024-05-05T11:15:18Z',
    minutesAgo: 80,
    severity: 'INFO',
    workloadId: 'compute-cluster-a',
    service: 'cluster-autoscaler',
    message: 'Scale out decision: target_nodes=128 reason=GPUQueueDepth>25',
  },
];

type SeverityFilter = 'ALL' | 'INFO' | 'WARN' | 'ERROR';
type TimeRangeFilter = '15' | '60' | '360' | 'ALL';

const parseQuery = (search: string) => {
  const params = new URLSearchParams(search);
  const workload = params.get('workloadId');
  return workload ?? '';
};

export const AegisLogExplorerPage: FC = () => {
  const classes = useStyles();
  const location = useLocation();

  const defaultWorkload = useMemo(() => parseQuery(location.search), [location.search]);

  const [searchText, setSearchText] = useState(defaultWorkload);
  const [severity, setSeverity] = useState<SeverityFilter>('ALL');
  const [timeRange, setTimeRange] = useState<TimeRangeFilter>('60');

  const columns = useMemo<TableColumn<LogEntry>[]>(
    () => [
      { title: 'Timestamp', field: 'timestamp', defaultSort: 'desc' },
      { title: 'Severity', field: 'severity' },
      { title: 'Workload', field: 'workloadId' },
      { title: 'Service', field: 'service' },
      { title: 'Message', field: 'message', width: '50%' },
    ],
    [],
  );

  const filteredLogs = useMemo(() => {
    return logEntries.filter(entry => {
      if (severity !== 'ALL' && entry.severity !== severity) {
        return false;
      }
      if (timeRange !== 'ALL' && entry.minutesAgo > Number(timeRange)) {
        return false;
      }
      if (!searchText) {
        return true;
      }
      const lower = searchText.toLowerCase();
      return (
        entry.message.toLowerCase().includes(lower) ||
        entry.workloadId.toLowerCase().includes(lower) ||
        entry.service.toLowerCase().includes(lower)
      );
    });
  }, [severity, timeRange, searchText]);

  const handleSearch = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchText(event.target.value);
  };

  return (
    <Page themeId="tool">
      <Content>
        <ContentHeader title="Log Explorer">
          <Typography variant="body1" color="textSecondary">
            Query aggregated control-plane and workload logs with rapid contextual filters.
          </Typography>
        </ContentHeader>

        <Paper className={classes.streamWrapper}>
          <Box className={classes.filters}>
            <TextField
              className={classes.filterField}
              label="Search"
              variant="outlined"
              size="small"
              value={searchText}
              onChange={handleSearch}
              placeholder="Workload, service, or message"
            />
            <Select
              className={classes.filterField}
              value={severity}
              onChange={event => setSeverity(event.target.value as SeverityFilter)}
              variant="outlined"
              displayEmpty
            >
              <MenuItem value="ALL">Severity: All</MenuItem>
              <MenuItem value="ERROR">Errors</MenuItem>
              <MenuItem value="WARN">Warnings</MenuItem>
              <MenuItem value="INFO">Info</MenuItem>
            </Select>
            <Select
              className={classes.filterField}
              value={timeRange}
              onChange={event => setTimeRange(event.target.value as TimeRangeFilter)}
              variant="outlined"
              displayEmpty
            >
              <MenuItem value="15">Last 15 minutes</MenuItem>
              <MenuItem value="60">Last 60 minutes</MenuItem>
              <MenuItem value="360">Last 6 hours</MenuItem>
              <MenuItem value="ALL">Entire retention</MenuItem>
            </Select>
          </Box>

          <div className={classes.tableWrapper}>
            <Table
              options={{ paging: false, padding: 'dense', sorting: true }}
              title="Live Log Stream"
              data={filteredLogs}
              columns={columns}
            />
          </div>
        </Paper>
      </Content>
    </Page>
  );
};

