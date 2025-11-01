import { FC, useMemo } from 'react';
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
  Chip,
  Grid,
  Paper,
  Typography,
  makeStyles,
} from '@material-ui/core';

const useStyles = makeStyles(theme => ({
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(4),
  },
  card: {
    backgroundColor: 'var(--aegis-card-surface)',
    border: `1px solid var(--aegis-card-border)`,
    borderRadius: theme.shape.borderRadius,
    boxShadow: 'var(--aegis-card-shadow)',
    padding: theme.spacing(3),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  },
  cardTitle: {
    fontWeight: 600,
    letterSpacing: '-0.01em',
  },
  trendPlaceholder: {
    borderRadius: theme.shape.borderRadius,
    border: `1px dashed ${theme.palette.divider}`,
    background:
      theme.palette.type === 'dark'
        ? 'rgba(148, 163, 184, 0.08)'
        : 'rgba(79, 70, 229, 0.04)',
    minHeight: 220,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: theme.palette.text.secondary,
    fontSize: theme.typography.pxToRem(14),
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
  },
  metricsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: theme.spacing(2.5),
  },
  metricCard: {
    borderRadius: theme.shape.borderRadius,
    border: `1px solid var(--aegis-card-border)`,
    background:
      theme.palette.type === 'dark'
        ? 'rgba(88, 28, 135, 0.25)'
        : 'rgba(99, 102, 241, 0.08)',
    padding: theme.spacing(2.5),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  },
  metricLabel: {
    fontSize: theme.typography.pxToRem(13),
    letterSpacing: '0.08em',
    fontWeight: 600,
    textTransform: 'uppercase',
    color: theme.palette.text.secondary,
  },
  metricValue: {
    fontSize: theme.typography.h4.fontSize,
    fontWeight: 700,
    letterSpacing: '-0.02em',
  },
}));

type ProjectUsage = {
  project: string;
  gpuHours: number;
  monthOverMonth: number;
  budget: number;
  actual: number;
  forecast: number;
  quotaUtilization: number;
};

const projectUsageData: ProjectUsage[] = [
  {
    project: 'Atlas Vision Training',
    gpuHours: 482,
    monthOverMonth: 12,
    budget: 18000,
    actual: 16240,
    forecast: 17600,
    quotaUtilization: 0.83,
  },
  {
    project: 'Conversational R&D',
    gpuHours: 388,
    monthOverMonth: -6,
    budget: 15500,
    actual: 14980,
    forecast: 15120,
    quotaUtilization: 0.72,
  },
  {
    project: 'Edge Deployment Validation',
    gpuHours: 216,
    monthOverMonth: 8,
    budget: 9200,
    actual: 8740,
    forecast: 9100,
    quotaUtilization: 0.61,
  },
  {
    project: 'Model Compression Experiments',
    gpuHours: 126,
    monthOverMonth: 3,
    budget: 6400,
    actual: 6180,
    forecast: 6400,
    quotaUtilization: 0.49,
  },
];

const quotaAlerts = [
  {
    project: 'Atlas Vision Training',
    message: '83% of GPU hour quota consumed for April.',
    severity: 'warning' as const,
  },
  {
    project: 'Conversational R&D',
    message: 'Budget tracking indicates $520 under forecast.',
    severity: 'ok' as const,
  },
  {
    project: 'Edge Deployment Validation',
    message: 'Quota holding steady at 61% utilization.',
    severity: 'ok' as const,
  },
];

export const AegisCostAnalyticsPage: FC = () => {
  const classes = useStyles();

  const columns = useMemo<TableColumn<ProjectUsage>[]>(
    () => [
      { title: 'Project', field: 'project' },
      {
        title: 'GPU Hours (30d)',
        field: 'gpuHours',
        render: row => (
          <Typography variant="body2" component="span">
            {row.gpuHours.toLocaleString('en-US')} hrs
          </Typography>
        ),
      },
      {
        title: 'Trend',
        field: 'monthOverMonth',
        render: row => (
          <Chip
            label={`${row.monthOverMonth > 0 ? '+' : ''}${row.monthOverMonth}% MoM`}
            color={row.monthOverMonth >= 0 ? 'primary' : 'secondary'}
            size="small"
          />
        ),
      },
      {
        title: 'Budget vs. Actual',
        field: 'actual',
        render: row => (
          <Box display="flex" flexDirection="column">
            <Typography variant="body2">
              ${row.actual.toLocaleString('en-US')} / ${row.budget.toLocaleString('en-US')}
            </Typography>
            <Typography variant="caption" color="textSecondary">
              Forecast: ${row.forecast.toLocaleString('en-US')}
            </Typography>
          </Box>
        ),
      },
      {
        title: 'Quota Utilization',
        field: 'quotaUtilization',
        render: row => (
          <Chip
            label={`${Math.round(row.quotaUtilization * 100)}%`}
            size="small"
            color={row.quotaUtilization > 0.85 ? 'secondary' : 'primary'}
          />
        ),
      },
    ],
    [],
  );

  const totals = useMemo(() => {
    const spend = projectUsageData.reduce((sum, p) => sum + p.actual, 0);
    const budget = projectUsageData.reduce((sum, p) => sum + p.budget, 0);
    const forecast = projectUsageData.reduce((sum, p) => sum + p.forecast, 0);
    const utilization =
      projectUsageData.reduce((sum, p) => sum + p.quotaUtilization, 0) /
      projectUsageData.length;

    return {
      spend,
      budget,
      forecast,
      utilization,
    };
  }, []);

  return (
    <Page themeId="tool">
      <Content>
        <ContentHeader title="Usage & Cost Analytics">
          <HeaderLabel label="Reporting" value="30-day view" />
        </ContentHeader>
        <div className={classes.content}>
          <div className={classes.metricsRow}>
            <div className={classes.metricCard}>
              <div className={classes.metricLabel}>Actual Spend</div>
              <div className={classes.metricValue}>
                ${totals.spend.toLocaleString('en-US')}
              </div>
              <Typography variant="body2" color="textSecondary">
                Across all active Aegis projects (30 days)
              </Typography>
            </div>
            <div className={classes.metricCard}>
              <div className={classes.metricLabel}>Budget Remaining</div>
              <div className={classes.metricValue}>
                ${(totals.budget - totals.spend).toLocaleString('en-US')}
              </div>
              <Typography variant="body2" color="textSecondary">
                ${totals.budget.toLocaleString('en-US')} allocated
              </Typography>
            </div>
            <div className={classes.metricCard}>
              <div className={classes.metricLabel}>Forecasted Spend</div>
              <div className={classes.metricValue}>
                ${totals.forecast.toLocaleString('en-US')}
              </div>
              <Typography variant="body2" color="textSecondary">
                Based on rolling 7-day average
              </Typography>
            </div>
            <div className={classes.metricCard}>
              <div className={classes.metricLabel}>Quota Utilization</div>
              <div className={classes.metricValue}>
                {Math.round(totals.utilization * 100)}%
              </div>
              <Typography variant="body2" color="textSecondary">
                Aggregate GPU hour consumption
              </Typography>
            </div>
          </div>

          <Grid container spacing={3}>
            <Grid item xs={12} md={8}>
              <Paper className={classes.card}>
                <Typography variant="h6" className={classes.cardTitle}>
                  Spend Over Time
                </Typography>
                <div className={classes.trendPlaceholder}>Time-Series Chart Placeholder</div>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper className={classes.card}>
                <Typography variant="h6" className={classes.cardTitle}>
                  Quota Alerts
                </Typography>
                <Box display="flex" flexDirection="column" gridGap={16}>
                  {quotaAlerts.map(alert => (
                    <Box
                      key={alert.project}
                      display="flex"
                      flexDirection="column"
                      gridGap={4}
                    >
                      <Typography variant="subtitle1">{alert.project}</Typography>
                      <Typography variant="body2" color="textSecondary">
                        {alert.message}
                      </Typography>
                      <Chip
                        size="small"
                        label={alert.severity === 'warning' ? 'Monitor' : 'Healthy'}
                        color={alert.severity === 'warning' ? 'secondary' : 'primary'}
                      />
                    </Box>
                  ))}
                </Box>
              </Paper>
            </Grid>
          </Grid>

          <Paper className={classes.card}>
            <Typography variant="h6" className={classes.cardTitle}>
              Per-Project Usage
            </Typography>
            <Table
              options={{ paging: false, search: false, padding: 'dense' }}
              data={projectUsageData}
              columns={columns}
            />
          </Paper>
        </div>
      </Content>
    </Page>
  );
};
