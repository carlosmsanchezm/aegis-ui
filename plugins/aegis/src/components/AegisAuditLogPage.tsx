import { FC, useMemo, useState } from 'react';
import {
  Page,
  Content,
  ContentHeader,
  HeaderLabel,
  Table,
  TableColumn,
} from '@backstage/core-components';
import {
  Box,
  MenuItem,
  Paper,
  TextField,
  Typography,
  makeStyles,
} from '@material-ui/core';

const useStyles = makeStyles(theme => ({
  layout: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(3.5),
  },
  controls: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(2),
  },
  card: {
    backgroundColor: 'var(--aegis-card-surface)',
    border: `1px solid var(--aegis-card-border)`,
    borderRadius: theme.shape.borderRadius,
    boxShadow: 'var(--aegis-card-shadow)',
    padding: theme.spacing(3),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2.5),
  },
}));

type AuditRow = {
  id: string;
  event: string;
  target: string;
  actor: string;
  timestamp: string;
  ip: string;
  outcome: 'success' | 'failure';
};

const auditLog: AuditRow[] = [
  {
    id: 'LOG-21931',
    event: 'workspace.create',
    target: 'atlas-train-4821',
    actor: 'nina.alvarez',
    timestamp: '2024-04-12 09:10 UTC',
    ip: '10.48.12.16',
    outcome: 'success',
  },
  {
    id: 'LOG-21928',
    event: 'quota.override-request',
    target: 'REQ-10421',
    actor: 'nina.alvarez',
    timestamp: '2024-04-12 09:06 UTC',
    ip: '10.48.12.16',
    outcome: 'success',
  },
  {
    id: 'LOG-21911',
    event: 'workspace.terminate',
    target: 'convai-eval-2338',
    actor: 'jacob.singh',
    timestamp: '2024-04-11 23:18 UTC',
    ip: '10.56.31.44',
    outcome: 'success',
  },
  {
    id: 'LOG-21907',
    event: 'policy.update',
    target: 'TEAM-LABS-T4',
    actor: 'maya.chen',
    timestamp: '2024-04-11 22:01 UTC',
    ip: '10.39.08.57',
    outcome: 'success',
  },
  {
    id: 'LOG-21898',
    event: 'workspace.create',
    target: 'edge-val-0441',
    actor: 'ravi.patel',
    timestamp: '2024-04-11 18:34 UTC',
    ip: '10.61.14.03',
    outcome: 'failure',
  },
];

export const AegisAuditLogPage: FC = () => {
  const classes = useStyles();
  const [search, setSearch] = useState('');
  const [eventFilter, setEventFilter] = useState<'all' | string>('all');
  const [outcomeFilter, setOutcomeFilter] = useState<'all' | 'success' | 'failure'>(
    'all',
  );

  const columns = useMemo<TableColumn<AuditRow>[]>(
    () => [
      { title: 'Event ID', field: 'id' },
      { title: 'Event', field: 'event' },
      { title: 'Target', field: 'target' },
      { title: 'Actor', field: 'actor' },
      { title: 'Timestamp', field: 'timestamp' },
      { title: 'Source IP', field: 'ip' },
      { title: 'Outcome', field: 'outcome' },
    ],
    [],
  );

  const filtered = useMemo(() => {
    return auditLog.filter(row => {
      const matchesSearch =
        !search ||
        row.id.toLowerCase().includes(search.toLowerCase()) ||
        row.target.toLowerCase().includes(search.toLowerCase()) ||
        row.actor.toLowerCase().includes(search.toLowerCase());
      const matchesEvent = eventFilter === 'all' || row.event === eventFilter;
      const matchesOutcome = outcomeFilter === 'all' || row.outcome === outcomeFilter;
      return matchesSearch && matchesEvent && matchesOutcome;
    });
  }, [search, eventFilter, outcomeFilter]);

  const uniqueEvents = useMemo(() => {
    return Array.from(new Set(auditLog.map(row => row.event)));
  }, []);

  return (
    <Page themeId="tool">
      <Content>
        <ContentHeader title="Audit Logs">
          <HeaderLabel label="Compliance" value="Workspace events" />
        </ContentHeader>
        <div className={classes.layout}>
          <Paper className={classes.card}>
            <Typography variant="h6">Filters</Typography>
            <div className={classes.controls}>
              <TextField
                variant="outlined"
                label="Search logs"
                placeholder="Search by ID, actor, or target"
                value={search}
                onChange={event => setSearch(event.target.value)}
                style={{ minWidth: 260 }}
              />
              <TextField
                select
                variant="outlined"
                label="Event type"
                value={eventFilter}
                onChange={event => setEventFilter(event.target.value as 'all' | string)}
                style={{ width: 220 }}
              >
                <MenuItem value="all">All events</MenuItem>
                {uniqueEvents.map(event => (
                  <MenuItem key={event} value={event}>
                    {event}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                variant="outlined"
                label="Outcome"
                value={outcomeFilter}
                onChange={event =>
                  setOutcomeFilter(event.target.value as 'all' | 'success' | 'failure')
                }
                style={{ width: 180 }}
              >
                <MenuItem value="all">All outcomes</MenuItem>
                <MenuItem value="success">Success</MenuItem>
                <MenuItem value="failure">Failure</MenuItem>
              </TextField>
            </div>
          </Paper>

          <Paper className={classes.card}>
            <Typography variant="h6">Workspace audit trail</Typography>
            <Table
              options={{ paging: false, search: false, padding: 'dense' }}
              data={filtered}
              columns={columns}
            />
            <Box>
              <Typography variant="caption" color="textSecondary">
                Showing {filtered.length} of {auditLog.length} events
              </Typography>
            </Box>
          </Paper>
        </div>
      </Content>
    </Page>
  );
};
