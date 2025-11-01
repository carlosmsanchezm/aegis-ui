import { useState } from 'react';
import {
  Grid,
  Paper,
  Typography,
  makeStyles,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Box,
} from '@material-ui/core';
import {
  Content,
  ContentHeader,
  HeaderLabel,
  Page,
  Table,
  TableColumn,
} from '@backstage/core-components';
import { alertApiRef, useApi } from '@backstage/core-plugin-api';

type AuditRow = {
  id: string;
  event: string;
  actor: string;
  impact: string;
  timestamp: string;
};

const useStyles = makeStyles(theme => ({
  content: {
    paddingBottom: theme.spacing(6),
  },
  controls: {
    marginBottom: theme.spacing(3),
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(3),
  },
  formControl: {
    minWidth: 220,
  },
  summaryCard: {
    background: 'var(--aegis-card-surface)',
    border: '1px solid var(--aegis-card-border)',
    boxShadow: 'var(--aegis-card-shadow)',
    borderRadius: 24,
    padding: theme.spacing(3),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
  },
  summaryLabel: {
    fontSize: theme.typography.pxToRem(13),
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: theme.palette.text.secondary,
  },
  summaryValue: {
    fontSize: '1.75rem',
    fontWeight: 600,
  },
  summaryContext: {
    color: theme.palette.text.secondary,
  },
  exportButton: {
    alignSelf: 'flex-start',
    marginTop: theme.spacing(2),
  },
}));

const auditRows: AuditRow[] = [
  {
    id: 'AUD-4921',
    event: 'Policy Change',
    actor: 'Gen. Harper · CTO',
    impact: 'Approved new GPU burst tier',
    timestamp: '2024-07-12 10:18 UTC',
  },
  {
    id: 'AUD-4912',
    event: 'Security Event',
    actor: 'Automation',
    impact: 'Blocked anomalous credential usage',
    timestamp: '2024-07-11 21:03 UTC',
  },
  {
    id: 'AUD-4898',
    event: 'User Access',
    actor: 'Col. Ruiz · Mission Lead',
    impact: 'Granted temporary workspace access (24h)',
    timestamp: '2024-07-09 14:47 UTC',
  },
  {
    id: 'AUD-4883',
    event: 'Policy Change',
    actor: 'Automation',
    impact: 'Reverted drift on network micro-segmentation',
    timestamp: '2024-07-08 06:11 UTC',
  },
  {
    id: 'AUD-4865',
    event: 'Security Event',
    actor: 'SOC Analyst',
    impact: 'Logged investigative query into mission telemetry',
    timestamp: '2024-07-05 19:33 UTC',
  },
];

const columns: TableColumn<AuditRow>[] = [
  { title: 'Record', field: 'id', highlight: true },
  { title: 'Event Type', field: 'event' },
  { title: 'Actor', field: 'actor' },
  { title: 'Summary', field: 'impact' },
  { title: 'Timestamp (UTC)', field: 'timestamp' },
];

export const AegisAuditReportPage = () => {
  const classes = useStyles();
  const alertApi = useApi(alertApiRef);
  const [dateRange, setDateRange] = useState('Last 30 Days');
  const [eventType, setEventType] = useState('All Events');

  const handleDownload = () => {
    alertApi.post({
      message: `Generating executive audit export for ${dateRange} · ${eventType}`,
      severity: 'info',
    });
  };

  return (
    <Page themeId="tool">
      <Content className={classes.content}>
        <ContentHeader title="Audit &amp; Reporting">
          <HeaderLabel label="Assurance" value="Full Traceability" />
          <HeaderLabel label="Export" value="CSV · SIEM" />
        </ContentHeader>

        <div className={classes.controls}>
          <FormControl variant="outlined" className={classes.formControl}>
            <InputLabel id="date-range-label">Date Range</InputLabel>
            <Select
              labelId="date-range-label"
              value={dateRange}
              onChange={event => setDateRange(event.target.value as string)}
              label="Date Range"
            >
              <MenuItem value="Last 7 Days">Last 7 Days</MenuItem>
              <MenuItem value="Last 30 Days">Last 30 Days</MenuItem>
              <MenuItem value="Quarter to Date">Quarter to Date</MenuItem>
              <MenuItem value="Year to Date">Year to Date</MenuItem>
            </Select>
          </FormControl>

          <FormControl variant="outlined" className={classes.formControl}>
            <InputLabel id="event-type-label">Event Type</InputLabel>
            <Select
              labelId="event-type-label"
              value={eventType}
              onChange={event => setEventType(event.target.value as string)}
              label="Event Type"
            >
              <MenuItem value="All Events">All Events</MenuItem>
              <MenuItem value="Policy Change">Policy Change</MenuItem>
              <MenuItem value="Security Event">Security Event</MenuItem>
              <MenuItem value="User Access">User Access</MenuItem>
            </Select>
          </FormControl>

          <Button
            variant="contained"
            color="primary"
            className={classes.exportButton}
            onClick={handleDownload}
          >
            Download Report (CSV)
          </Button>
        </div>

        <Grid container spacing={4}>
          <Grid item xs={12} md={4}>
            <Paper className={classes.summaryCard} elevation={0}>
              <Typography variant="overline" className={classes.summaryLabel}>
                Reviewed Events
              </Typography>
              <Typography className={classes.summaryValue}>312</Typography>
              <Typography variant="body2" className={classes.summaryContext}>
                Automated compliance checks triaged 87% with zero escalation.
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper className={classes.summaryCard} elevation={0}>
              <Typography variant="overline" className={classes.summaryLabel}>
                Audit Findings
              </Typography>
              <Typography className={classes.summaryValue}>0 Critical</Typography>
              <Typography variant="body2" className={classes.summaryContext}>
                External auditors verified alignment to RMF and FedRAMP High.
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper className={classes.summaryCard} elevation={0}>
              <Typography variant="overline" className={classes.summaryLabel}>
                Export Destinations
              </Typography>
              <Typography className={classes.summaryValue}>SIEM · CSV</Typography>
              <Typography variant="body2" className={classes.summaryContext}>
                Scheduled delivery to Joint Cyber Defense Collaborative vault.
              </Typography>
            </Paper>
          </Grid>
        </Grid>

        <Box mt={5}>
          <Table
            title="Audit Log Overview"
            options={{ paging: false, search: false, padding: 'dense' }}
            columns={columns}
            data={auditRows}
          />
        </Box>
      </Content>
    </Page>
  );
};
