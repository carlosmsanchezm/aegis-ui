import { FC, useMemo, useState } from 'react';
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
  FormControl,
  Grid,
  InputLabel,
  makeStyles,
  MenuItem,
  Paper,
  Select,
  Typography,
} from '@material-ui/core';

const useStyles = makeStyles(theme => ({
  pageContent: {
    paddingBottom: theme.spacing(6),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(3),
  },
  section: {
    padding: theme.spacing(3),
    background: 'var(--aegis-card-surface)',
    border: '1px solid var(--aegis-card-border)',
    boxShadow: 'var(--aegis-card-shadow)',
    borderRadius: theme.shape.borderRadius * 2,
  },
  metricCard: {
    padding: theme.spacing(3),
    background: 'var(--aegis-card-surface)',
    border: '1px solid var(--aegis-card-border)',
    boxShadow: 'var(--aegis-card-shadow)',
    borderRadius: theme.shape.borderRadius * 2,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
    height: '100%',
  },
  metricLabel: {
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    fontSize: theme.typography.pxToRem(12),
    color: theme.palette.text.secondary,
  },
  metricValue: {
    fontSize: theme.typography.pxToRem(32),
    fontWeight: 600,
    letterSpacing: '-0.03em',
  },
  chartPaper: {
    padding: theme.spacing(3),
    background: 'var(--aegis-card-surface)',
    border: '1px solid var(--aegis-card-border)',
    boxShadow: 'var(--aegis-card-shadow)',
    borderRadius: theme.shape.borderRadius * 2,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    textAlign: 'center',
    gap: theme.spacing(1),
  },
  tableWrapper: {
    marginTop: theme.spacing(2),
  },
  selectControl: {
    minWidth: 220,
  },
  placeholderChart: {
    width: '100%',
    height: 160,
    borderRadius: theme.shape.borderRadius * 1.5,
    border: `1px dashed ${theme.palette.divider}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: theme.palette.text.secondary,
    fontSize: theme.typography.pxToRem(14),
  },
}));

type CostBreakdownRow = {
  project: string;
  workspace: string;
  spend: string;
  gpuHours: string;
  budget: string;
  variance: string;
};

const kpiMetrics = [
  {
    label: 'Month-to-Date Spend',
    value: '$482,190',
    delta: '+6.4% vs prior month',
  },
  {
    label: 'Forecasted Month-End Spend',
    value: '$712,450',
    delta: 'Tracking +3.2% above target',
  },
  {
    label: 'Active Workspaces',
    value: '184',
    delta: '47 running GPU workloads',
  },
];

const breakdownRows: CostBreakdownRow[] = [
  {
    project: 'Atlas-Discovery',
    workspace: 'atlas-notebook-417',
    spend: '$64,820',
    gpuHours: '3,140',
    budget: '$72,000',
    variance: '-10%',
  },
  {
    project: 'Sentinel-Intel',
    workspace: 'sentinel-train-19',
    spend: '$58,240',
    gpuHours: '2,980',
    budget: '$54,000',
    variance: '+8%',
  },
  {
    project: 'Trident-Recon',
    workspace: 'trident-lab-05',
    spend: '$44,610',
    gpuHours: '2,140',
    budget: '$50,000',
    variance: '-11%',
  },
  {
    project: 'Helios-Analytics',
    workspace: 'helios-batch-12',
    spend: '$36,420',
    gpuHours: '1,640',
    budget: '$38,500',
    variance: '-5%',
  },
  {
    project: 'Bastion-Lab',
    workspace: 'bastion-rnd-03',
    spend: '$32,910',
    gpuHours: '1,280',
    budget: '$29,500',
    variance: '+12%',
  },
];

export const AegisCostDashboardPage: FC = () => {
  const classes = useStyles();
  const [period, setPeriod] = useState('30');

  const columns = useMemo<TableColumn<CostBreakdownRow>[]>(
    () => [
      { title: 'Project', field: 'project' },
      { title: 'Workspace', field: 'workspace' },
      { title: 'Spend ($)', field: 'spend' },
      { title: 'GPU Hours', field: 'gpuHours' },
      { title: 'Budget ($)', field: 'budget' },
      { title: 'Variance', field: 'variance' },
    ],
    [],
  );

  return (
    <Page themeId="tool">
      <Content className={classes.pageContent}>
        <ContentHeader title="Cost Analytics Dashboard">
          <HeaderLabel label="MTD Spend" value="$482K" />
          <HeaderLabel label="Forecast" value="$712K" />
          <HeaderLabel label="Active Workspaces" value="184" />
        </ContentHeader>

        <Box display="flex" justifyContent="flex-end">
          <FormControl variant="outlined" size="small" className={classes.selectControl}>
            <InputLabel id="cost-dashboard-period">Time Range</InputLabel>
            <Select
              labelId="cost-dashboard-period"
              value={period}
              onChange={event => setPeriod(String(event.target.value))}
              label="Time Range"
            >
              <MenuItem value="7">Last 7 Days</MenuItem>
              <MenuItem value="30">Last 30 Days</MenuItem>
              <MenuItem value="90">Last 90 Days</MenuItem>
              <MenuItem value="custom">Custom Range…</MenuItem>
            </Select>
          </FormControl>
        </Box>

        <Grid container spacing={3}>
          {kpiMetrics.map(metric => (
            <Grid item xs={12} md={4} key={metric.label}>
              <Paper className={classes.metricCard}>
                <Typography variant="caption" className={classes.metricLabel}>
                  {metric.label}
                </Typography>
                <Typography variant="h3" className={classes.metricValue}>
                  {metric.value}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  {metric.delta}
                </Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>

        <Grid container spacing={3}>
          <Grid item xs={12} lg={6}>
            <Paper className={classes.chartPaper}>
              <Typography variant="h6">Historical Spend Over Time</Typography>
              <Typography variant="body2" color="textSecondary">
                Line chart placeholder — aggregate cloud cost trends.
              </Typography>
              <div className={classes.placeholderChart}>MTD vs Prior Baseline</div>
            </Paper>
          </Grid>
          <Grid item xs={12} lg={6}>
            <Paper className={classes.chartPaper}>
              <Typography variant="h6">Spend by Project</Typography>
              <Typography variant="body2" color="textSecondary">
                Bar or donut chart placeholder summarizing top spenders.
              </Typography>
              <div className={classes.placeholderChart}>Top 5 Cost Drivers</div>
            </Paper>
          </Grid>
        </Grid>

        <Paper className={classes.section}>
          <Typography variant="h6" gutterBottom>
            Detailed Project & Workspace Breakdown
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Track project allocations and GPU utilization to maintain budget guardrails.
          </Typography>
          <div className={classes.tableWrapper}>
            <Table
              title="Cost Breakdown"
              options={{ paging: false, search: false, toolbar: false }}
              columns={columns}
              data={breakdownRows}
            />
          </div>
        </Paper>
      </Content>
    </Page>
  );
};

export default AegisCostDashboardPage;
