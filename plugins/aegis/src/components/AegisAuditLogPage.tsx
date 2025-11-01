import { useMemo, useState } from 'react';
import {
  Content,
  ContentHeader,
  HeaderLabel,
  Page,
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
} from '@material-ui/core';
import { makeStyles, Theme, useTheme } from '@material-ui/core/styles';

type AuditEvent = {
  id: string;
  timestamp: string;
  actor: string;
  project: string;
  event: string;
  details: string;
  severity: 'info' | 'warning' | 'critical';
};

const mockEvents: AuditEvent[] = [
  {
    id: 'EVT-5001',
    timestamp: '2023-08-16 09:42 UTC',
    actor: 'aflores',
    project: 'Inference Ops',
    event: 'Workspace scaled',
    details: 'Scaled from 4x A100 to 8x A100 nodes',
    severity: 'info',
  },
  {
    id: 'EVT-5002',
    timestamp: '2023-08-16 10:08 UTC',
    actor: 'system',
    project: 'RL Research',
    event: 'Quota threshold reached',
    details: '80% of GPU quota consumed for billing cycle',
    severity: 'warning',
  },
  {
    id: 'EVT-5003',
    timestamp: '2023-08-16 10:40 UTC',
    actor: 'lwalters',
    project: 'Security',
    event: 'Workspace terminated',
    details: 'Terminated session after inactivity threshold',
    severity: 'info',
  },
  {
    id: 'EVT-5004',
    timestamp: '2023-08-16 11:02 UTC',
    actor: 'prao',
    project: 'Platform',
    event: 'Policy updated',
    details: 'Adjusted default GPU cap from 2 to 4',
    severity: 'info',
  },
  {
    id: 'EVT-5005',
    timestamp: '2023-08-16 11:15 UTC',
    actor: 'system',
    project: 'Inference Ops',
    event: 'Security alert',
    details: 'Workspace attempted egress to blocked region',
    severity: 'critical',
  },
];

const useStyles = makeStyles((theme: Theme) => ({
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(4),
  },
  card: {
    backgroundColor: 'var(--aegis-card-surface)',
    border: '1px solid var(--aegis-card-border)',
    borderRadius: theme.shape.borderRadius,
    boxShadow: 'var(--aegis-card-shadow)',
    padding: theme.spacing(3),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2.5),
  },
  filterRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: theme.spacing(2),
  },
  severity: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    fontSize: theme.typography.pxToRem(12),
  },
  severityDot: {
    width: 12,
    height: 12,
    borderRadius: '50%',
  },
}));

const severityColor = (theme: Theme, level: AuditEvent['severity']) => {
  switch (level) {
    case 'critical':
      return theme.palette.error.main;
    case 'warning':
      return theme.palette.secondary.main;
    default:
      return theme.palette.primary.main;
  }
};

export const AegisAuditLogPage = () => {
  const classes = useStyles();
  const theme = useTheme<Theme>();
  const [filters, setFilters] = useState({
    search: '',
    severity: 'all',
    project: 'all',
  });

  const projectOptions = Array.from(new Set(mockEvents.map(event => event.project)));

  const filteredEvents = useMemo(() => {
    return mockEvents.filter(event => {
      const query = filters.search.trim().toLowerCase();
      const matchesQuery =
        !query ||
        event.id.toLowerCase().includes(query) ||
        event.actor.toLowerCase().includes(query) ||
        event.details.toLowerCase().includes(query);
      const matchesSeverity =
        filters.severity === 'all' || event.severity === filters.severity;
      const matchesProject =
        filters.project === 'all' || event.project === filters.project;
      return matchesQuery && matchesSeverity && matchesProject;
    });
  }, [filters]);

  const columns = useMemo<TableColumn<AuditEvent>[]>(
    () => [
      { title: 'Event ID', field: 'id' },
      { title: 'Timestamp', field: 'timestamp' },
      { title: 'Actor', field: 'actor' },
      { title: 'Project', field: 'project' },
      { title: 'Event', field: 'event' },
      {
        title: 'Details',
        field: 'details',
        width: '40%',
      },
      {
        title: 'Severity',
        field: 'severity',
        render: row => (
          <Box className={classes.severity}>
            <span
              className={classes.severityDot}
              style={{ backgroundColor: severityColor(theme, row.severity) }}
            />
            {row.severity.toUpperCase()}
          </Box>
        ),
      },
    ],
    [classes, theme],
  );

  return (
    <Page themeId="tool">
      <Content>
        <ContentHeader title="Audit Logs">
          <HeaderLabel label="Persona" value="Program Admin" />
          <HeaderLabel label="Retention" value="90 days" />
        </ContentHeader>
        <div className={classes.content}>
          <Paper className={classes.card}>
            <Typography variant="h6">Filter Events</Typography>
            <div className={classes.filterRow}>
              <TextField
                label="Search"
                placeholder="Event, actor, or detail"
                value={filters.search}
                onChange={event =>
                  setFilters(current => ({ ...current, search: event.target.value }))
                }
                variant="outlined"
                size="small"
              />
              <Select
                value={filters.severity}
                onChange={event =>
                  setFilters(current => ({ ...current, severity: event.target.value as string }))
                }
                variant="outlined"
              >
                <MenuItem value="all">All severities</MenuItem>
                <MenuItem value="critical">Critical</MenuItem>
                <MenuItem value="warning">Warning</MenuItem>
                <MenuItem value="info">Info</MenuItem>
              </Select>
              <Select
                value={filters.project}
                onChange={event =>
                  setFilters(current => ({ ...current, project: event.target.value as string }))
                }
                variant="outlined"
              >
                <MenuItem value="all">All projects</MenuItem>
                {projectOptions.map(project => (
                  <MenuItem key={project} value={project}>
                    {project}
                  </MenuItem>
                ))}
              </Select>
            </div>
          </Paper>

          <Paper className={classes.card}>
            <Typography variant="h6">Workspace Activity Trail</Typography>
            <Table
              options={{ paging: false, search: false, toolbar: false }}
              data={filteredEvents}
              columns={columns}
            />
          </Paper>
        </div>
      </Content>
    </Page>
  );
};

