import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Grid,
  makeStyles,
  Paper,
  Typography,
  Button,
  Chip,
} from '@material-ui/core';
import {
  Content,
  ContentHeader,
  HeaderLabel,
  Page,
} from '@backstage/core-components';

const useStyles = makeStyles(theme => ({
  root: {
    paddingBottom: theme.spacing(6),
  },
  kpiCard: {
    padding: theme.spacing(3),
    backgroundColor: 'var(--aegis-card-surface)',
    border: '1px solid var(--aegis-card-border)',
    boxShadow: 'var(--aegis-card-shadow)',
    borderRadius: theme.spacing(2.5),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
    height: '100%',
  },
  kpiLabel: {
    fontSize: theme.typography.pxToRem(12),
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: theme.palette.text.secondary,
  },
  kpiValue: {
    fontSize: theme.typography.pxToRem(30),
    fontWeight: 600,
    letterSpacing: '-0.03em',
  },
  kpiDelta: {
    color: theme.palette.success.main,
    fontWeight: 500,
  },
  chartCard: {
    padding: theme.spacing(3),
    backgroundColor: 'var(--aegis-card-surface)',
    border: '1px solid var(--aegis-card-border)',
    boxShadow: 'var(--aegis-card-shadow)',
    borderRadius: theme.spacing(2.5),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    minHeight: 320,
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
  linkButton: {
    alignSelf: 'flex-start',
  },
  missionHighlights: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(2),
  },
  missionCard: {
    display: 'flex',
    flexDirection: 'column',
    padding: theme.spacing(2),
    borderRadius: theme.spacing(2),
    border: '1px solid rgba(148, 163, 184, 0.25)',
    minWidth: 220,
    gap: theme.spacing(0.5),
  },
}));

const kpiMetrics = [
  {
    label: 'Total MTD Spend',
    value: '$8.4M',
    delta: '+4.1% vs. prior month',
  },
  {
    label: 'Forecasted Quarterly Spend',
    value: '$25.6M',
    delta: 'On track (±1.2%)',
  },
  {
    label: 'Platform Uptime (SLA)',
    value: '99.982%',
    delta: 'Linked report',
    cta: {
      label: 'View Resilience Report',
      to: '/aegis/executive/resilience',
    },
  },
  {
    label: 'Active Missions/Projects',
    value: '47',
    delta: '12 scaling this week',
  },
];

const missionHighlights = [
  {
    name: 'Sentinel ISR Mesh',
    status: 'On plan',
  },
  {
    name: 'Artemis Cyber Defense',
    status: 'Cost reduced 6%',
  },
  {
    name: 'Trident Recon AI',
    status: 'SLA elevated',
  },
];

export const AegisStrategicOverviewPage = () => {
  const classes = useStyles();

  return (
    <Page themeId="tool">
      <Content className={classes.root} noPadding>
        <ContentHeader title="Strategic Overview">
          <HeaderLabel label="Focus" value="Executive Readiness" />
          <HeaderLabel label="Updated" value="Last sync · 2m ago" />
          <HeaderLabel label="Confidence" value="High" />
        </ContentHeader>
        <Box px={4} pb={6}>
          <Grid container spacing={3}>
            {kpiMetrics.map(metric => (
              <Grid item xs={12} md={6} lg={3} key={metric.label}>
                <Paper className={classes.kpiCard}>
                  <Typography className={classes.kpiLabel}>
                    {metric.label}
                  </Typography>
                  <Typography className={classes.kpiValue}>
                    {metric.value}
                  </Typography>
                  <Typography className={classes.kpiDelta}>
                    {metric.delta}
                  </Typography>
                  {metric.cta ? (
                    <Button
                      className={classes.linkButton}
                      variant="outlined"
                      color="primary"
                      size="small"
                      component={RouterLink}
                      to={metric.cta.to}
                    >
                      {metric.cta.label}
                    </Button>
                  ) : null}
                </Paper>
              </Grid>
            ))}

            <Grid item xs={12} md={7}>
              <Paper className={classes.chartCard}>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Typography variant="h6">Spend vs. Forecast</Typography>
                  <Chip color="primary" label="MTD" size="small" />
                </Box>
                <div className={classes.chartBody}>Executive trend visualization placeholder</div>
              </Paper>
            </Grid>
            <Grid item xs={12} md={5}>
              <Paper className={classes.chartCard}>
                <Typography variant="h6">
                  Resource Utilization by Mission Area
                </Typography>
                <div className={classes.chartBody}>Utilization heatmap placeholder</div>
              </Paper>
            </Grid>

            <Grid item xs={12}>
              <Paper className={classes.chartCard}>
                <Typography variant="h6">Mission Highlights</Typography>
                <Box className={classes.missionHighlights}>
                  {missionHighlights.map(mission => (
                    <Box key={mission.name} className={classes.missionCard}>
                      <Typography variant="subtitle1">{mission.name}</Typography>
                      <Typography variant="body2" color="textSecondary">
                        {mission.status}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Paper>
            </Grid>
          </Grid>
        </Box>
      </Content>
    </Page>
  );
};
