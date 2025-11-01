import { ChangeEvent, useMemo, useState } from 'react';
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
  MenuItem,
  Paper,
  Select,
  Typography,
  makeStyles,
} from '@material-ui/core';

type CostBreakdownRow = {
  project: string;
  workspace: string;
  spend: string;
  gpuHours: string;
  owner: string;
  variance: string;
};

const useStyles = makeStyles(theme => ({
  pageContent: {
    paddingBottom: theme.spacing(6),
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
  },
  selectControl: {
    minWidth: 200,
  },
  card: {
    backgroundColor: 'var(--aegis-card-surface)',
    border: '1px solid var(--aegis-card-border)',
    boxShadow: 'var(--aegis-card-shadow)',
    borderRadius: theme.shape.borderRadius * 2,
    padding: theme.spacing(3),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
    height: '100%',
  },
  kpiLabel: {
    fontSize: theme.typography.pxToRem(13),
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: theme.palette.text.secondary,
  },
  kpiValue: {
    fontSize: theme.typography.pxToRem(32),
    fontWeight: 700,
  },
  kpiSubtext: {
    color: theme.palette.success.main,
    fontWeight: 600,
  },
  chartCard: {
    backgroundColor: 'var(--aegis-card-surface)',
    border: '1px solid var(--aegis-card-border)',
    boxShadow: 'var(--aegis-card-shadow)',
    borderRadius: theme.shape.borderRadius * 2,
    padding: theme.spacing(3),
    minHeight: 260,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  },
  chartPlaceholder: {
    flex: 1,
    borderRadius: theme.shape.borderRadius * 1.5,
    border: `1px dashed ${theme.palette.divider}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: theme.palette.text.secondary,
    fontStyle: 'italic',
  },
  tableWrapper: {
    marginTop: theme.spacing(4),
    backgroundColor: 'var(--aegis-card-surface)',
    border: '1px solid var(--aegis-card-border)',
    boxShadow: 'var(--aegis-card-shadow)',
    borderRadius: theme.shape.borderRadius * 2,
    padding: theme.spacing(2.5, 3, 3),
  },
}));

const kpiMetrics = [
  {
    label: 'Month-to-Date (MTD) Spend',
    value: '$248,900',
    delta: '↑ 12.4% vs. last month',
  },
  {
    label: 'Forecasted Month-End Spend',
    value: '$372,450',
    delta: 'Projected +6.8%',
  },
  {
    label: 'Active Workspaces',
    value: '146',
    delta: '19 pending renewals',
  },
];

const costBreakdown: CostBreakdownRow[] = [
  {
    project: 'p-aurora',
    workspace: 'aurora-ml-lab',
    spend: '$32,180',
    gpuHours: '1,820',
    owner: 'Dr. Patel',
    variance: '+8% vs. budget',
  },
  {
    project: 'p-atlas',
    workspace: 'atlas-synthetic',
    spend: '$27,940',
    gpuHours: '1,540',
    owner: 'M. Gomez',
    variance: '+3% vs. budget',
  },
  {
    project: 'p-demo',
    workspace: 'demo-benchmarking',
    spend: '$18,420',
    gpuHours: '940',
    owner: 'S. Ali',
    variance: '-5% vs. budget',
  },
  {
    project: 'p-vanguard',
    workspace: 'vanguard-risk-sim',
    spend: '$41,110',
    gpuHours: '2,260',
    owner: 'A. Chen',
    variance: '+12% vs. budget',
  },
  {
    project: 'p-observatory',
    workspace: 'orbital-tracking',
    spend: '$22,005',
    gpuHours: '1,120',
    owner: 'J. Kim',
    variance: '+1% vs. budget',
  },
];

export const AegisCostDashboardPage = () => {
  const classes = useStyles();
  const [timeframe, setTimeframe] = useState('30');

  const columns = useMemo<TableColumn<CostBreakdownRow>[]>(
    () => [
      { title: 'Project', field: 'project', defaultSort: 'asc' },
      { title: 'Workspace', field: 'workspace' },
      { title: 'Spend ($)', field: 'spend', sorting: false },
      { title: 'GPU Hours', field: 'gpuHours', sorting: false },
      { title: 'Owner', field: 'owner', sorting: false },
      { title: 'Variance', field: 'variance', sorting: false },
    ],
    [],
  );

  const handleTimeframeChange = (event: ChangeEvent<{ value: unknown }>) => {
    setTimeframe(event.target.value as string);
  };

  return (
    <Page themeId="tool">
      <Content className={classes.pageContent}>
        <ContentHeader title="Cost Analytics Dashboard">
          <HeaderLabel label="Perspective" value="FinOps" />
          <HeaderLabel label="Currency" value="USD" />
          <div className={classes.headerActions}>
            <FormControl variant="outlined" size="small" className={classes.selectControl}>
              <InputLabel id="aegis-cost-timeframe-label">Timeframe</InputLabel>
              <Select
                labelId="aegis-cost-timeframe-label"
                value={timeframe}
                onChange={handleTimeframeChange}
                label="Timeframe"
              >
                <MenuItem value="7">Last 7 Days</MenuItem>
                <MenuItem value="30">Last 30 Days</MenuItem>
                <MenuItem value="90">Last 90 Days</MenuItem>
                <MenuItem value="custom">Custom Range</MenuItem>
              </Select>
            </FormControl>
          </div>
        </ContentHeader>

        <Box px={4} pb={4}>
          <Grid container spacing={3}>
            {kpiMetrics.map(metric => (
              <Grid item xs={12} md={4} key={metric.label}>
                <Paper elevation={0} className={classes.card}>
                  <Typography className={classes.kpiLabel}>{metric.label}</Typography>
                  <Typography className={classes.kpiValue}>{metric.value}</Typography>
                  <Typography variant="body2" className={classes.kpiSubtext}>
                    {metric.delta}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Box>

        <Box px={4}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={7}>
              <Paper elevation={0} className={classes.chartCard}>
                <Typography variant="h5">Historical Spend Over Time</Typography>
                <Box className={classes.chartPlaceholder}>Line chart placeholder</Box>
              </Paper>
            </Grid>
            <Grid item xs={12} md={5}>
              <Paper elevation={0} className={classes.chartCard}>
                <Typography variant="h5">Spend by Project</Typography>
                <Box className={classes.chartPlaceholder}>Bar / Donut chart placeholder</Box>
              </Paper>
            </Grid>
          </Grid>

          <Box className={classes.tableWrapper} mt={4}>
            <Typography variant="h6" gutterBottom>
              Detailed Project & Workspace Spend
            </Typography>
            <Table
              options={{
                paging: false,
                search: false,
                padding: 'dense',
              }}
              data={costBreakdown}
              columns={columns}
            />
          </Box>
        </Box>
      </Content>
    </Page>
  );
};

export default AegisCostDashboardPage;
