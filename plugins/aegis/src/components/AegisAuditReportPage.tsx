import { useMemo, useState } from 'react';
import {
  Box,
  Button,
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
  Table,
  TableColumn,
} from '@backstage/core-components';
import { alertApiRef, useApi } from '@backstage/core-plugin-api';

type AuditRow = {
  id: string;
  timestamp: string;
  event: string;
  owner: string;
  impact: string;
};

const rows: AuditRow[] = [
  {
    id: 'AUD-54328',
    timestamp: '2024-04-11 02:14Z',
    event: 'Policy Change',
    owner: 'CTO Office',
    impact: 'Raised GPU quota for Sentinel ISR',
  },
  {
    id: 'AUD-54297',
    timestamp: '2024-04-10 18:02Z',
    event: 'Security Event',
    owner: 'Security Operations',
    impact: 'Credential rotation enforced (Atlas IL5)',
  },
  {
    id: 'AUD-54188',
    timestamp: '2024-04-10 07:56Z',
    event: 'User Access',
    owner: 'Mission Control',
    impact: 'Read-only briefing access granted to NGA partner',
  },
  {
    id: 'AUD-54091',
    timestamp: '2024-04-09 22:31Z',
    event: 'Policy Change',
    owner: 'FinOps',
    impact: 'Auto-shutdown window tightened for idle GPUs',
  },
];

const useStyles = makeStyles(theme => ({
  root: {
    paddingBottom: theme.spacing(6),
  },
  card: {
    padding: theme.spacing(3),
    backgroundColor: 'var(--aegis-card-surface)',
    border: '1px solid var(--aegis-card-border)',
    boxShadow: 'var(--aegis-card-shadow)',
    borderRadius: theme.spacing(2.5),
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    '& > *:not(:last-child)': {
      marginBottom: theme.spacing(2),
    },
  },
  filters: {
    display: 'flex',
    gap: theme.spacing(2),
    flexWrap: 'wrap',
  },
  formControl: {
    minWidth: 180,
  },
  cardHeader: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  },
}));

export const AegisAuditReportPage = () => {
  const classes = useStyles();
  const alertApi = useApi(alertApiRef);
  const [dateRange, setDateRange] = useState('last-7');
  const [eventType, setEventType] = useState('all');

  const columns = useMemo<TableColumn<AuditRow>[]>(
    () => [
      { title: 'Audit ID', field: 'id' },
      { title: 'Timestamp', field: 'timestamp' },
      { title: 'Event Type', field: 'event' },
      { title: 'Owner / Authority', field: 'owner' },
      { title: 'Executive Summary', field: 'impact' },
    ],
    [],
  );

  return (
    <Page themeId="tool">
      <Content className={classes.root} noPadding>
        <ContentHeader title="Audit & Compliance Reporting">
          <HeaderLabel label="Coverage" value="100%" />
          <HeaderLabel label="Export" value="CSV & PDF" />
          <HeaderLabel label="Last Audit" value="Passed · 5 days ago" />
        </ContentHeader>
        <Box px={4} pb={6}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Paper className={classes.card}>
                <Box className={classes.cardHeader}>
                  <Typography variant="h6">Filters</Typography>
                  <div className={classes.filters}>
                    <FormControl variant="outlined" size="small" className={classes.formControl}>
                      <InputLabel>Date Range</InputLabel>
                      <Select
                        label="Date Range"
                        value={dateRange}
                        onChange={event => setDateRange(event.target.value as string)}
                      >
                        <MenuItem value="last-7">Last 7 days</MenuItem>
                        <MenuItem value="last-30">Last 30 days</MenuItem>
                        <MenuItem value="quarter">Current quarter</MenuItem>
                        <MenuItem value="fy">Fiscal year to date</MenuItem>
                      </Select>
                    </FormControl>
                    <FormControl variant="outlined" size="small" className={classes.formControl}>
                      <InputLabel>Event Type</InputLabel>
                      <Select
                        label="Event Type"
                        value={eventType}
                        onChange={event => setEventType(event.target.value as string)}
                      >
                        <MenuItem value="all">All</MenuItem>
                        <MenuItem value="policy">Policy Change</MenuItem>
                        <MenuItem value="security">Security Event</MenuItem>
                        <MenuItem value="access">User Access</MenuItem>
                      </Select>
                    </FormControl>
                    <Box display="flex" alignItems="center">
                      <Button
                        variant="contained"
                        color="primary"
                        onClick={() =>
                          alertApi.post({
                            message: 'Audit export queued for executive download.',
                            severity: 'info',
                          })
                        }
                      >
                        Download Report (CSV)
                      </Button>
                    </Box>
                  </div>
                </Box>
              </Paper>
            </Grid>
            <Grid item xs={12}>
              <Paper className={classes.card}>
                <Typography variant="h6">Audit Activity Summary</Typography>
                <Typography variant="body2" color="textSecondary">
                  Showing {rows.length} high-confidence events · Filters applied: {dateRange} · {eventType}
                </Typography>
                <Table
                  options={{ paging: false, search: false, padding: 'dense' }}
                  data={rows}
                  columns={columns}
                />
              </Paper>
            </Grid>
          </Grid>
        </Box>
      </Content>
    </Page>
  );
};
