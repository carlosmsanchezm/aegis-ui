import { FC, useMemo, useState } from 'react';
import {
  Page,
  Content,
  ContentHeader,
  HeaderLabel,
  Table,
  TableColumn,
  WarningPanel,
} from '@backstage/core-components';
import {
  Box,
  MenuItem,
  Paper,
  TextField,
  Typography,
  makeStyles,
} from '@material-ui/core';
import EventNoteIcon from '@material-ui/icons/EventNote';

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
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: theme.spacing(2),
    padding: theme.spacing(6, 2),
    textAlign: 'center',
  },
  iconWrapper: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 64,
    height: 64,
    borderRadius: '50%',
    backgroundColor:
      theme.palette.type === 'dark'
        ? 'rgba(96, 165, 250, 0.15)'
        : 'rgba(79, 70, 229, 0.1)',
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

/**
 * No backend ListAuditEvents RPC is exposed yet.
 * Audit events are being collected by the backend (P0-2), but there is no
 * REST endpoint to query them. Initialize with empty data.
 */
const auditEvents: AuditRow[] = [];

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
    return auditEvents.filter(row => {
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
            {filtered.length === 0 ? (
              <div className={classes.emptyState}>
                <div className={classes.iconWrapper}>
                  <EventNoteIcon color="primary" style={{ fontSize: 32 }} />
                </div>
                <Typography variant="h6" color="textSecondary">
                  Audit events are being collected
                </Typography>
                <Typography variant="body2" color="textSecondary" style={{ maxWidth: 480 }}>
                  The backend is recording audit events for all platform operations.
                  A log viewer will be available once the ListAuditEvents API endpoint
                  is deployed in the next release.
                </Typography>
              </div>
            ) : (
              <>
                <Table
                  options={{ paging: false, search: false, padding: 'dense' }}
                  data={filtered}
                  columns={columns}
                />
                <Box>
                  <Typography variant="caption" color="textSecondary">
                    Showing {filtered.length} of {auditEvents.length} events
                  </Typography>
                </Box>
              </>
            )}
          </Paper>

          <WarningPanel severity="info" title="API integration pending">
            The audit log listing API (<code>ListAuditEvents</code>) is not yet exposed via the
            REST gateway. Audit events are being stored by the backend and will be queryable once
            the endpoint is available.
          </WarningPanel>
        </div>
      </Content>
    </Page>
  );
};
