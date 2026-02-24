import { ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Page,
  Content,
  ContentHeader,
  HeaderLabel,
  Progress,
  Table,
  TableColumn,
  WarningPanel,
} from '@backstage/core-components';
import {
  alertApiRef,
  discoveryApiRef,
  fetchApiRef,
  identityApiRef,
  useApi,
} from '@backstage/core-plugin-api';
import {
  Box,
  Button,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Typography,
  makeStyles,
} from '@material-ui/core';
import RefreshIcon from '@material-ui/icons/Refresh';

import {
  BudgetRecord,
  ProjectRecord,
  listBudgets,
  listProjects,
} from '../api/aegisClient';
import { keycloakAuthApiRef } from '../api/refs';

type CostBreakdownRow = {
  project: string;
  queue: string;
  spend: string;
  budget: string;
  utilization: string;
  policy: string;
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
  emptyState: {
    marginTop: theme.spacing(4),
    borderRadius: theme.shape.borderRadius * 2,
    border: '1px dashed var(--aegis-card-border)',
    padding: theme.spacing(6, 3),
    background: 'var(--aegis-card-surface)',
    textAlign: 'center',
  },
}));

const formatUsd = (value: number): string =>
  `$${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

type ProjectBudgets = {
  project: ProjectRecord;
  budgets: BudgetRecord[];
};

export const AegisCostDashboardPage = () => {
  const classes = useStyles();
  const fetchApi = useApi(fetchApiRef);
  const discoveryApi = useApi(discoveryApiRef);
  const identityApi = useApi(identityApiRef);
  const authApi = useApi(keycloakAuthApiRef);
  const alertApi = useApi(alertApiRef);

  const [timeframe, setTimeframe] = useState('30');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projectBudgets, setProjectBudgets] = useState<ProjectBudgets[]>([]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const projectsResponse = await listProjects(
        fetchApi,
        discoveryApi,
        identityApi,
        authApi,
      );
      const projects = projectsResponse?.items ?? [];

      const results: ProjectBudgets[] = await Promise.all(
        projects.map(async project => {
          try {
            const budgets = await listBudgets(
              fetchApi,
              discoveryApi,
              identityApi,
              authApi,
              project.id,
            );
            return { project, budgets };
          } catch {
            return { project, budgets: [] };
          }
        }),
      );

      setProjectBudgets(results);
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      setError(msg);
      alertApi.post({
        message: `Failed to load cost data: ${msg}`,
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [fetchApi, discoveryApi, identityApi, authApi, alertApi]);

  useEffect(() => {
    load();
  }, [load]);

  const allBudgets = useMemo(
    () => projectBudgets.flatMap(pb => pb.budgets),
    [projectBudgets],
  );

  const kpiMetrics = useMemo(() => {
    const totalSpend = allBudgets.reduce((sum, b) => sum + (b.spentUsd ?? 0), 0);
    const totalBudget = allBudgets.reduce((sum, b) => sum + (b.limitUsd ?? 0), 0);
    const utilization =
      totalBudget > 0 ? ((totalSpend / totalBudget) * 100).toFixed(1) : '0.0';

    return [
      {
        label: 'Total Spend (All Projects)',
        value: formatUsd(totalSpend),
        delta: `${allBudgets.length} budget(s) tracked`,
      },
      {
        label: 'Total Budget Allocated',
        value: formatUsd(totalBudget),
        delta: `${projectBudgets.length} project(s)`,
      },
      {
        label: 'Budget Utilization',
        value: `${utilization}%`,
        delta:
          Number(utilization) > 80
            ? 'Approaching budget limit'
            : 'Within budget',
      },
    ];
  }, [allBudgets, projectBudgets]);

  const costBreakdown = useMemo<CostBreakdownRow[]>(() => {
    return projectBudgets.flatMap(pb =>
      pb.budgets.map(b => {
        const spent = b.spentUsd ?? 0;
        const limit = b.limitUsd ?? 0;
        const pct = limit > 0 ? ((spent / limit) * 100).toFixed(1) : 'N/A';
        return {
          project: pb.project.displayName ?? pb.project.id,
          queue: b.queue ?? 'default',
          spend: formatUsd(spent),
          budget: formatUsd(limit),
          utilization: pct === 'N/A' ? pct : `${pct}%`,
          policy: b.policyMode ?? 'monitor',
        };
      }),
    );
  }, [projectBudgets]);

  const columns = useMemo<TableColumn<CostBreakdownRow>[]>(
    () => [
      { title: 'Project', field: 'project', defaultSort: 'asc' },
      { title: 'Queue', field: 'queue' },
      { title: 'Spend ($)', field: 'spend', sorting: false },
      { title: 'Budget ($)', field: 'budget', sorting: false },
      { title: 'Utilization', field: 'utilization', sorting: false },
      { title: 'Policy', field: 'policy', sorting: false },
    ],
    [],
  );

  const handleTimeframeChange = (event: ChangeEvent<{ value: unknown }>) => {
    setTimeframe(event.target.value as string);
  };

  if (loading) {
    return (
      <Page themeId="tool">
        <Content className={classes.pageContent}>
          <ContentHeader title="Cost Analytics Dashboard">
            <HeaderLabel label="Perspective" value="FinOps" />
            <HeaderLabel label="Currency" value="USD" />
          </ContentHeader>
          <Progress />
        </Content>
      </Page>
    );
  }

  if (error) {
    return (
      <Page themeId="tool">
        <Content className={classes.pageContent}>
          <ContentHeader title="Cost Analytics Dashboard">
            <HeaderLabel label="Perspective" value="FinOps" />
            <HeaderLabel label="Currency" value="USD" />
          </ContentHeader>
          <WarningPanel title="Failed to load cost data" severity="error">
            {error}
            <Box mt={2}>
              <Button variant="outlined" onClick={load}>
                Retry
              </Button>
            </Box>
          </WarningPanel>
        </Content>
      </Page>
    );
  }

  return (
    <Page themeId="tool">
      <Content className={classes.pageContent}>
        <ContentHeader title="Cost Analytics Dashboard">
          <HeaderLabel label="Perspective" value="FinOps" />
          <HeaderLabel label="Currency" value="USD" />
          <div className={classes.headerActions}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<RefreshIcon />}
              onClick={load}
            >
              Refresh
            </Button>
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
                <Box className={classes.chartPlaceholder}>
                  Chart visualization coming soon
                </Box>
              </Paper>
            </Grid>
            <Grid item xs={12} md={5}>
              <Paper elevation={0} className={classes.chartCard}>
                <Typography variant="h5">Spend by Project</Typography>
                <Box className={classes.chartPlaceholder}>
                  Chart visualization coming soon
                </Box>
              </Paper>
            </Grid>
          </Grid>

          {costBreakdown.length === 0 ? (
            <Box className={classes.emptyState}>
              <Typography variant="h6" gutterBottom>
                No budget data available
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Configure budgets for your projects in Quota Management to see
                cost analytics here.
              </Typography>
            </Box>
          ) : (
            <Box className={classes.tableWrapper} mt={4}>
              <Typography variant="h6" gutterBottom>
                Detailed Project Budget & Spend
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
          )}
        </Box>
      </Content>
    </Page>
  );
};

export default AegisCostDashboardPage;
