import {
  Grid,
  Paper,
  Typography,
  makeStyles,
  Box,
  Divider,
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
  content: {
    paddingBottom: theme.spacing(6),
  },
  metricCard: {
    background: 'var(--aegis-card-surface)',
    border: '1px solid var(--aegis-card-border)',
    boxShadow: 'var(--aegis-card-shadow)',
    borderRadius: 24,
    padding: theme.spacing(3),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
    height: '100%',
  },
  metricLabel: {
    fontSize: theme.typography.pxToRem(13),
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: theme.palette.text.secondary,
  },
  metricValue: {
    fontSize: '2.25rem',
    fontWeight: 600,
    letterSpacing: '-0.02em',
  },
  metricDelta: {
    color: theme.palette.success.main,
    fontWeight: 500,
    fontSize: theme.typography.pxToRem(14),
  },
  chartCard: {
    background: 'var(--aegis-card-surface)',
    border: '1px solid var(--aegis-card-border)',
    boxShadow: 'var(--aegis-card-shadow)',
    borderRadius: 28,
    padding: theme.spacing(3.5),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2.5),
  },
  chartPlaceholder: {
    borderRadius: 20,
    border: '1px dashed rgba(148, 163, 184, 0.35)',
    background:
      'linear-gradient(120deg, rgba(45,212,191,0.18), rgba(14,165,233,0.12))',
    color: theme.palette.text.secondary,
    padding: theme.spacing(6, 3),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: theme.typography.pxToRem(16),
    fontWeight: 500,
    textAlign: 'center',
  },
}));

type ResilienceEvent = {
  event: string;
  detected: string;
  remediated: string;
};

const kpiMetrics = [
  {
    label: 'Overall Uptime (Last 90 Days)',
    value: '99.987%',
    delta: 'Only 6 minutes of impact across 3 clouds',
  },
  {
    label: 'Mean Time to Remediation (MTTR)',
    value: '3m 42s',
    delta: 'Auto-runbooks resolve 94% of incidents',
  },
];

const recentEvents: ResilienceEvent[] = [
  {
    event: 'Cluster failover executed to IL6 reserve',
    detected: '2024-07-12 03:42 UTC',
    remediated: '2024-07-12 03:44 UTC',
  },
  {
    event: 'Policy drift auto-corrected (GPU quota)',
    detected: '2024-07-09 17:08 UTC',
    remediated: '2024-07-09 17:10 UTC',
  },
  {
    event: 'S3 cross-region replication self-healed',
    detected: '2024-07-05 11:21 UTC',
    remediated: '2024-07-05 11:24 UTC',
  },
  {
    event: 'Service mesh cert rotation pre-emptive',
    detected: '2024-06-29 08:00 UTC',
    remediated: '2024-06-29 08:02 UTC',
  },
];

const columns: TableColumn<ResilienceEvent>[] = [
  {
    title: 'Event',
    field: 'event',
    highlight: true,
  },
  {
    title: 'Time Detected',
    field: 'detected',
  },
  {
    title: 'Time Remediated',
    field: 'remediated',
  },
];

export const AegisResilienceSlaPage = () => {
  const classes = useStyles();

  return (
    <Page themeId="tool">
      <Content className={classes.content}>
        <ContentHeader title="Resilience &amp; SLA Report">
          <HeaderLabel label="Availability" value="Proven" />
          <HeaderLabel label="Automation" value="Runbooks · Policy Guardrails" />
        </ContentHeader>

        <Grid container spacing={4}>
          {kpiMetrics.map(metric => (
            <Grid item xs={12} md={6} key={metric.label}>
              <Paper className={classes.metricCard} elevation={0}>
                <Typography variant="overline" className={classes.metricLabel}>
                  {metric.label}
                </Typography>
                <Typography variant="h3" className={classes.metricValue}>
                  {metric.value}
                </Typography>
                <Typography variant="body2" className={classes.metricDelta}>
                  {metric.delta}
                </Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>

        <Box mt={5}>
          <Paper className={classes.chartCard} elevation={0}>
            <Typography variant="h6">Historical Uptime (SLO vs. Actual)</Typography>
            <Divider />
            <div className={classes.chartPlaceholder}>
              Area chart placeholder — 12-month uptime trend with SLA bands.
            </div>
          </Paper>
        </Box>

        <Box mt={5}>
          <Table
            title="Recent Resilience Events"
            options={{ paging: false, search: false, padding: 'dense' }}
            columns={columns}
            data={recentEvents}
          />
        </Box>
      </Content>
    </Page>
  );
};
