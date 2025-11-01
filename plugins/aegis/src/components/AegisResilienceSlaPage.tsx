import {
  Box,
  Grid,
  makeStyles,
  Paper,
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
    gap: theme.spacing(2),
    height: '100%',
  },
  chartBody: {
    flex: 1,
    borderRadius: theme.spacing(2),
    border: '1px dashed rgba(148, 163, 184, 0.4)',
    background:
      'repeating-linear-gradient(135deg, rgba(148,163,184,0.12), rgba(148,163,184,0.12) 12px, transparent 12px, transparent 24px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: theme.palette.text.secondary,
    fontWeight: 500,
  },
}));

type ResilienceEvent = {
  event: string;
  detected: string;
  remediated: string;
};

const events: ResilienceEvent[] = [
  {
    event: 'Cluster Failover (US-EAST-IL6)',
    detected: '2024-04-11 03:12Z',
    remediated: '2024-04-11 03:18Z',
  },
  {
    event: 'Policy Drift Auto-Corrected',
    detected: '2024-04-09 19:27Z',
    remediated: '2024-04-09 19:28Z',
  },
  {
    event: 'GPU Fabric Rebalance',
    detected: '2024-04-07 10:06Z',
    remediated: '2024-04-07 10:10Z',
  },
  {
    event: 'Zero-Trust Gateway Patch',
    detected: '2024-04-02 14:55Z',
    remediated: '2024-04-02 15:03Z',
  },
];

const columns: TableColumn<ResilienceEvent>[] = [
  { title: 'Event', field: 'event' },
  { title: 'Time Detected', field: 'detected' },
  { title: 'Time Remediated', field: 'remediated' },
];

export const AegisResilienceSlaPage = () => {
  const classes = useStyles();

  return (
    <Page themeId="tool">
      <Content className={classes.root} noPadding>
        <ContentHeader title="Resilience & SLA Report">
          <HeaderLabel label="SLA" value="99.982%" />
          <HeaderLabel label="MTTR" value="5m 12s" />
          <HeaderLabel label="Automation" value="87% Self-Healed" />
        </ContentHeader>
        <Box px={4} pb={6}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Paper className={classes.card}>
                <Typography variant="subtitle2" color="textSecondary">
                  Overall Uptime (Last 90 Days)
                </Typography>
                <Typography variant="h3" component="div">
                  99.982%
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  12 minutes total downtime · 6 regions monitored
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
              <Paper className={classes.card}>
                <Typography variant="subtitle2" color="textSecondary">
                  Mean Time to Remediation (MTTR)
                </Typography>
                <Typography variant="h3" component="div">
                  5m 12s
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  87% auto-remediated via policy guardrails
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12}>
              <Paper className={classes.card}>
                <Typography variant="h6">Historical Uptime (SLO vs. Actual)</Typography>
                <div className={classes.chartBody}>Availability trend visualization placeholder</div>
              </Paper>
            </Grid>
            <Grid item xs={12}>
              <Paper className={classes.card}>
                <Typography variant="h6">Recent Resilience Events</Typography>
                <Table
                  options={{ paging: false, search: false, padding: 'dense' }}
                  data={events}
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
