import { FC, useEffect, useMemo, useState } from 'react';
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
  discoveryApiRef,
  fetchApiRef,
  identityApiRef,
  useApi,
} from '@backstage/core-plugin-api';
import { keycloakAuthApiRef } from '../api/refs';
import {
  BudgetRecord,
  listBudgets,
  listProjects,
  ProjectRecord,
} from '../api/aegisClient';
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

type ProjectBudgetRow = {
  project: string;
  projectId: string;
  budget: number;
  spent: number;
  utilization: number;
};

export const AegisCostAnalyticsPage: FC = () => {
  const classes = useStyles();
  const fetchApi = useApi(fetchApiRef);
  const discoveryApi = useApi(discoveryApiRef);
  const identityApi = useApi(identityApiRef);
  const authApi = useApi(keycloakAuthApiRef);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ProjectBudgetRow[]>([]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const projectsRes = await listProjects(fetchApi, discoveryApi, identityApi, authApi);
        const projects: ProjectRecord[] = projectsRes.items ?? [];

        const budgetRows: ProjectBudgetRow[] = [];
        for (const project of projects) {
          try {
            const budgets: BudgetRecord[] = await listBudgets(
              fetchApi, discoveryApi, identityApi, authApi, project.id,
            );
            const totalLimit = budgets.reduce((s, b) => s + (b.limitUsd ?? 0), 0);
            const totalSpent = budgets.reduce((s, b) => s + (b.spentUsd ?? 0), 0);
            budgetRows.push({
              project: project.displayName || project.id,
              projectId: project.id,
              budget: totalLimit,
              spent: totalSpent,
              utilization: totalLimit > 0 ? totalSpent / totalLimit : 0,
            });
          } catch {
            budgetRows.push({
              project: project.displayName || project.id,
              projectId: project.id,
              budget: 0,
              spent: 0,
              utilization: 0,
            });
          }
        }
        if (active) {
          setRows(budgetRows);
          setError(null);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Failed to load analytics data');
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [fetchApi, discoveryApi, identityApi, authApi]);

  const columns = useMemo<TableColumn<ProjectBudgetRow>[]>(
    () => [
      { title: 'Project', field: 'project' },
      {
        title: 'Budget',
        field: 'budget',
        render: row => (
          <Typography variant="body2" component="span">
            ${row.budget.toLocaleString('en-US')}
          </Typography>
        ),
      },
      {
        title: 'Spent',
        field: 'spent',
        render: row => (
          <Typography variant="body2" component="span">
            ${row.spent.toLocaleString('en-US')}
          </Typography>
        ),
      },
      {
        title: 'Utilization',
        field: 'utilization',
        render: row => (
          <Chip
            label={`${Math.round(row.utilization * 100)}%`}
            size="small"
            color={row.utilization > 0.85 ? 'secondary' : 'primary'}
          />
        ),
      },
    ],
    [],
  );

  const totals = useMemo(() => {
    const spend = rows.reduce((sum, r) => sum + r.spent, 0);
    const budget = rows.reduce((sum, r) => sum + r.budget, 0);
    return { spend, budget };
  }, [rows]);

  return (
    <Page themeId="tool">
      <Content>
        <ContentHeader title="Usage & Cost Analytics">
          <HeaderLabel label="Reporting" value="Budget overview" />
        </ContentHeader>
        {loading && <Progress />}
        {error && (
          <WarningPanel severity="warning" title="Failed to load analytics">
            {error}
          </WarningPanel>
        )}
        <div className={classes.content}>
          <div className={classes.metricsRow}>
            <div className={classes.metricCard}>
              <div className={classes.metricLabel}>Total Budget</div>
              <div className={classes.metricValue}>
                ${totals.budget.toLocaleString('en-US')}
              </div>
              <Typography variant="body2" color="textSecondary">
                Allocated across {rows.length} project{rows.length !== 1 ? 's' : ''}
              </Typography>
            </div>
            <div className={classes.metricCard}>
              <div className={classes.metricLabel}>Total Spent</div>
              <div className={classes.metricValue}>
                ${totals.spend.toLocaleString('en-US')}
              </div>
              <Typography variant="body2" color="textSecondary">
                Reported by Platform API
              </Typography>
            </div>
            <div className={classes.metricCard}>
              <div className={classes.metricLabel}>Budget Remaining</div>
              <div className={classes.metricValue}>
                ${(totals.budget - totals.spend).toLocaleString('en-US')}
              </div>
              <Typography variant="body2" color="textSecondary">
                Across all active projects
              </Typography>
            </div>
            <div className={classes.metricCard}>
              <div className={classes.metricLabel}>GPU Hours</div>
              <div className={classes.metricValue}>—</div>
              <Typography variant="body2" color="textSecondary">
                Requires metering infrastructure
              </Typography>
            </div>
          </div>

          <Grid container spacing={3}>
            <Grid item xs={12} md={8}>
              <Paper className={classes.card}>
                <Typography variant="h6" className={classes.cardTitle}>
                  Spend Over Time
                </Typography>
                <div className={classes.trendPlaceholder}>
                  Requires Prometheus metering integration
                </div>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper className={classes.card}>
                <Typography variant="h6" className={classes.cardTitle}>
                  Budget Alerts
                </Typography>
                <Box display="flex" flexDirection="column" gridGap={16}>
                  {rows.filter(r => r.utilization > 0.8).length === 0 ? (
                    <Typography variant="body2" color="textSecondary">
                      No budget alerts. All projects are within thresholds.
                    </Typography>
                  ) : (
                    rows
                      .filter(r => r.utilization > 0.8)
                      .map(r => (
                        <Box key={r.projectId} display="flex" flexDirection="column" gridGap={4}>
                          <Typography variant="subtitle1">{r.project}</Typography>
                          <Typography variant="body2" color="textSecondary">
                            {Math.round(r.utilization * 100)}% of budget consumed (${r.spent.toLocaleString('en-US')} / ${r.budget.toLocaleString('en-US')})
                          </Typography>
                          <Chip
                            size="small"
                            label={r.utilization > 0.9 ? 'Critical' : 'Monitor'}
                            color="secondary"
                          />
                        </Box>
                      ))
                  )}
                </Box>
              </Paper>
            </Grid>
          </Grid>

          <Paper className={classes.card}>
            <Typography variant="h6" className={classes.cardTitle}>
              Per-Project Budget
            </Typography>
            <Table
              options={{ paging: false, search: false, padding: 'dense' }}
              data={rows}
              columns={columns}
            />
          </Paper>
        </div>
      </Content>
    </Page>
  );
};
