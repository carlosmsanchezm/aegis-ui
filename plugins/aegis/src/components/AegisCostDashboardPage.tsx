import { FC, useMemo, useState } from 'react';
import {
  Box,
  Grid,
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

type BreakdownRow = {
  project: string;
  workspace: string;
  owner: string;
  spend: string;
  gpuHours: string;
  trend: string;
};

const breakdownData: BreakdownRow[] = [
  {
    project: 'p-atlas',
    workspace: 'atlas-notebook-47',
    owner: 'Lt. Vega',
    spend: '$42,180',
    gpuHours: '812',
    trend: '+6.4% vs last period',
  },
  {
    project: 'p-orion',
    workspace: 'orion-sim-12',
    owner: 'Maj. Chen',
    spend: '$31,950',
    gpuHours: '654',
    trend: '+2.1% vs last period',
  },
  {
    project: 'p-trident',
    workspace: 'trident-batch-91',
    owner: 'Dr. Walsh',
    spend: '$27,430',
    gpuHours: '488',
    trend: '-3.8% vs last period',
  },
  {
    project: 'p-sentinel',
    workspace: 'sentinel-recon-05',
    owner: 'Capt. Ruiz',
    spend: '$18,760',
    gpuHours: '352',
    trend: '+1.2% vs last period',
  },
];

const useStyles = makeStyles(theme => ({
  content: {
    paddingBottom: theme.spacing(6),
  },
  controlBar: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginBottom: theme.spacing(3),
  },
  card: {
    backgroundColor: 'var(--aegis-card-surface)',
    border: '1px solid var(--aegis-card-border)',
    boxShadow: 'var(--aegis-card-shadow)',
    borderRadius: theme.shape.borderRadius * 2,
    padding: theme.spacing(3),
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  },
  metricLabel: {
    color: theme.palette.text.secondary,
    fontSize: theme.typography.pxToRem(12),
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
  },
  metricValue: {
    fontSize: theme.typography.pxToRem(32),
    fontWeight: 600,
    letterSpacing: '-0.02em',
  },
  metricSubtext: {
    color: theme.palette.success.main,
    fontWeight: 500,
  },
  chartPaper: {
    backgroundColor: 'var(--aegis-card-surface)',
    border: '1px solid var(--aegis-card-border)',
    boxShadow: 'var(--aegis-card-shadow)',
    borderRadius: theme.shape.borderRadius * 2,
    padding: theme.spacing(3),
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
  },
  chartPlaceholder: {
    flex: 1,
    borderRadius: theme.shape.borderRadius,
    border: `1px dashed ${theme.palette.divider}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: theme.palette.text.secondary,
    fontStyle: 'italic',
  },
  tablePaper: {
    backgroundColor: 'var(--aegis-card-surface)',
    border: '1px solid var(--aegis-card-border)',
    boxShadow: 'var(--aegis-card-shadow)',
    borderRadius: theme.shape.borderRadius * 2,
    padding: theme.spacing(2.5),
  },
}));

export const AegisCostDashboardPage: FC = () => {
  const classes = useStyles();
  const [timeframe, setTimeframe] = useState('30');

  const columns = useMemo<TableColumn<BreakdownRow>[]>(
    () => [
      { title: 'Project', field: 'project' },
      { title: 'Workspace', field: 'workspace' },
      { title: 'Owner', field: 'owner' },
      { title: 'Spend ($)', field: 'spend' },
      { title: 'GPU Hours', field: 'gpuHours' },
      { title: 'Trend', field: 'trend' },
    ],
    [],
  );

  return (
    <Page themeId="tool">
      <Content className={classes.content}>
        <ContentHeader title="Cost Analytics Dashboard">
          <HeaderLabel label="Scope" value="Enterprise FinOps" />
          <HeaderLabel label="Updated" value="5 minutes ago" />
        </ContentHeader>

        <Box className={classes.controlBar}>
          <Select
            value={timeframe}
            onChange={event => setTimeframe(event.target.value as string)}
            variant="outlined"
            size="small"
          >
            <MenuItem value="7">Last 7 Days</MenuItem>
            <MenuItem value="30">Last 30 Days</MenuItem>
            <MenuItem value="90">Last 90 Days</MenuItem>
            <MenuItem value="custom">Custom Range…</MenuItem>
          </Select>
        </Box>

        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Paper className={classes.card}>
              <Typography className={classes.metricLabel}>
                Month-to-Date (MTD) Spend
              </Typography>
              <Typography className={classes.metricValue}>$1.28M</Typography>
              <Typography className={classes.metricSubtext}>
                +4.2% vs last month
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper className={classes.card}>
              <Typography className={classes.metricLabel}>
                Forecasted Month-End Spend
              </Typography>
              <Typography className={classes.metricValue}>$1.96M</Typography>
              <Typography color="textSecondary">
                Confidence interval ±$120k
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper className={classes.card}>
              <Typography className={classes.metricLabel}>Active Workspaces</Typography>
              <Typography className={classes.metricValue}>187</Typography>
              <Typography color="textSecondary">
                23 running in high-priority queues
              </Typography>
            </Paper>
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper className={classes.chartPaper}>
              <Typography variant="h6">Historical Spend Over Time</Typography>
              <Typography variant="body2" color="textSecondary">
                Line chart of total spend by day
              </Typography>
              <div className={classes.chartPlaceholder}>Line chart placeholder</div>
            </Paper>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper className={classes.chartPaper}>
              <Typography variant="h6">Spend by Project</Typography>
              <Typography variant="body2" color="textSecondary">
                Distribution of current month costs by project
              </Typography>
              <div className={classes.chartPlaceholder}>Bar / Donut chart placeholder</div>
            </Paper>
          </Grid>

          <Grid item xs={12}>
            <Paper className={classes.tablePaper}>
              <Table
                title="Detailed Cost Breakdown"
                options={{ paging: false, search: false, padding: 'dense' }}
                columns={columns}
                data={breakdownData}
              />
            </Paper>
          </Grid>
        </Grid>
      </Content>
    </Page>
  );
};
