import { Link as RouterLink } from 'react-router-dom';
import {
  Grid,
  Paper,
  Typography,
  makeStyles,
  Box,
  Divider,
  Chip,
  Link,
} from '@material-ui/core';
import {
  Content,
  ContentHeader,
  HeaderLabel,
  Page,
} from '@backstage/core-components';
import { useRouteRef } from '@backstage/core-plugin-api';
import { resilienceOverviewRouteRef } from '../routes';

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
    fontSize: theme.typography.pxToRem(15),
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
    height: '100%',
  },
  chartPlaceholder: {
    borderRadius: 20,
    border: '1px dashed rgba(148, 163, 184, 0.35)',
    background:
      'linear-gradient(135deg, rgba(56,189,248,0.12), rgba(45,212,191,0.08))',
    color: theme.palette.text.secondary,
    padding: theme.spacing(6, 3),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: theme.typography.pxToRem(16),
    fontWeight: 500,
    textAlign: 'center',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(2),
  },
  chip: {
    fontWeight: 600,
    letterSpacing: '0.06em',
  },
  insightList: {
    marginTop: theme.spacing(2.5),
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: theme.spacing(2),
  },
  insightItem: {
    padding: theme.spacing(2.5),
    borderRadius: 20,
    background: 'rgba(148, 163, 184, 0.08)',
    border: '1px solid rgba(148, 163, 184, 0.18)',
  },
  insightTitle: {
    fontWeight: 600,
    marginBottom: theme.spacing(0.75),
    fontSize: theme.typography.pxToRem(15.5),
  },
  insightValue: {
    fontSize: theme.typography.pxToRem(13),
    color: theme.palette.text.secondary,
    lineHeight: 1.6,
  },
}));

const kpiMetrics = [
  {
    label: 'Total MTD Spend',
    value: '$12.4M',
    delta: '+3.8% vs last month',
  },
  {
    label: 'Forecasted Quarterly Spend',
    value: '$36.9M',
    delta: '2.1% under approved plan',
  },
  {
    label: 'Platform Uptime (SLA)',
    value: '99.982%',
    delta: '4m cumulative downtime',
    link: true,
  },
  {
    label: 'Active Missions/Projects',
    value: '27',
    delta: '6 new launches this quarter',
  },
];

const strategicInsights = [
  {
    title: 'FinOps Action',
    description:
      'Reserved capacity activation trimmed projected GPU overages by $1.7M.',
  },
  {
    title: 'Mission Velocity',
    description:
      'Average workspace provisioning time is holding at 2m 12s with zero escalations.',
  },
  {
    title: 'Security Auto-Remediation',
    description:
      '11 policy drifts resolved autonomously in the last 7 days; no customer impact.',
  },
];

export const AegisStrategicOverviewPage = () => {
  const classes = useStyles();
  const resilienceLink = useRouteRef(resilienceOverviewRouteRef);

  return (
    <Page themeId="home">
      <Content className={classes.content}>
        <ContentHeader title="Strategic Overview">
          <HeaderLabel label="Audience" value="Executive" />
          <HeaderLabel label="Focus" value="Spend · Governance · Resilience" />
        </ContentHeader>

        <Grid container spacing={4}>
          {kpiMetrics.map(metric => (
            <Grid item xs={12} sm={6} lg={3} key={metric.label}>
              <Paper className={classes.metricCard} elevation={0}>
                <Typography variant="overline" className={classes.metricLabel}>
                  {metric.label}
                </Typography>
                {metric.link ? (
                  <Link
                    component={RouterLink}
                    to={resilienceLink()}
                    color="primary"
                    underline="hover"
                    className={classes.metricValue}
                  >
                    {metric.value}
                  </Link>
                ) : (
                  <Typography variant="h3" className={classes.metricValue}>
                    {metric.value}
                  </Typography>
                )}
                <Typography variant="body2" className={classes.metricDelta}>
                  {metric.delta}
                </Typography>
                {metric.link && (
                  <Typography variant="body2" color="textSecondary">
                    View detailed resilience proof points →
                  </Typography>
                )}
              </Paper>
            </Grid>
          ))}
        </Grid>

        <Box mt={5}>
          <Grid container spacing={4}>
            <Grid item xs={12} md={7}>
              <Paper className={classes.chartCard} elevation={0}>
                <div className={classes.sectionHeader}>
                  <div>
                    <Typography variant="h6">Spend vs. Forecast</Typography>
                    <Typography variant="body2" color="textSecondary">
                      Executing 102% of mission funding while maintaining 7% buffer.
                    </Typography>
                  </div>
                  <Chip label="FinOps" color="primary" className={classes.chip} />
                </div>
                <Divider />
                <div className={classes.chartPlaceholder}>
                  Executive preview chart placeholder — variance trendline with
                  forecast cone.
                </div>
              </Paper>
            </Grid>
            <Grid item xs={12} md={5}>
              <Paper className={classes.chartCard} elevation={0}>
                <div className={classes.sectionHeader}>
                  <div>
                    <Typography variant="h6">
                      Resource Utilization by Mission Area
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Balanced allocation across Recon, Cyber, R&D, and Training.
                    </Typography>
                  </div>
                  <Chip label="Capacity" color="secondary" className={classes.chip} />
                </div>
                <Divider />
                <div className={classes.chartPlaceholder}>
                  Heatmap placeholder — GPU hours, storage, and bandwidth by mission.
                </div>
              </Paper>
            </Grid>
          </Grid>
        </Box>

        <Box mt={6}>
          <Typography variant="h5" gutterBottom>
            Executive Highlights
          </Typography>
          <div className={classes.insightList}>
            {strategicInsights.map(insight => (
              <div key={insight.title} className={classes.insightItem}>
                <Typography className={classes.insightTitle}>
                  {insight.title}
                </Typography>
                <Typography className={classes.insightValue}>
                  {insight.description}
                </Typography>
              </div>
            ))}
          </div>
        </Box>
      </Content>
    </Page>
  );
};
