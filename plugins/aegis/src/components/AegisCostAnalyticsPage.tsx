import { useMemo } from 'react';
import {
  Content,
  ContentHeader,
  HeaderLabel,
  Page,
  Table,
  TableColumn,
} from '@backstage/core-components';
import {
  Box,
  Chip,
  Grid,
  Paper,
  Typography,
} from '@material-ui/core';
import { makeStyles, Theme } from '@material-ui/core/styles';

type ProjectUsage = {
  project: string;
  month: string;
  gpuHours: number;
  budget: number;
  spend: number;
  quotaAlert?: 'ok' | 'warning' | 'critical';
};

type SpendSummaryRow = {
  project: string;
  fyBudget: string;
  fySpend: string;
  burnRate: string;
};

const useStyles = makeStyles((theme: Theme) => ({
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(4),
  },
  grid: {
    marginTop: theme.spacing(1),
  },
  card: {
    backgroundColor: 'var(--aegis-card-surface)',
    border: '1px solid var(--aegis-card-border)',
    borderRadius: theme.shape.borderRadius,
    boxShadow: 'var(--aegis-card-shadow)',
    padding: theme.spacing(3),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    height: '100%',
  },
  placeholder: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.shape.borderRadius,
    border: `1px dashed ${theme.palette.divider}`,
    color: theme.palette.text.secondary,
    padding: theme.spacing(3),
    backgroundColor: theme.palette.action.hover,
    textAlign: 'center',
  },
  statRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(2.5),
  },
  stat: {
    minWidth: 180,
    padding: theme.spacing(1.5, 2),
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.default,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
  },
  statLabel: {
    fontSize: theme.typography.pxToRem(13),
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: theme.palette.text.secondary,
  },
  statValue: {
    fontWeight: 600,
    fontSize: theme.typography.pxToRem(20),
  },
}));

const usageData: ProjectUsage[] = [
  {
    project: 'Aegis Core',
    month: 'Aug 2023',
    gpuHours: 428,
    budget: 12000,
    spend: 10840,
  },
  {
    project: 'Inference Ops',
    month: 'Aug 2023',
    gpuHours: 612,
    budget: 15000,
    spend: 16980,
    quotaAlert: 'warning',
  },
  {
    project: 'RL Research',
    month: 'Aug 2023',
    gpuHours: 884,
    budget: 22000,
    spend: 21440,
  },
  {
    project: 'Edge Deployments',
    month: 'Aug 2023',
    gpuHours: 205,
    budget: 8000,
    spend: 6420,
  },
];

const spendSummary: SpendSummaryRow[] = usageData.map(project => {
  const burn = project.budget > 0 ? project.spend / project.budget : 0;
  return {
    project: project.project,
    fyBudget: `$${(project.budget * 12).toLocaleString()}`,
    fySpend: `$${(project.spend * 12).toLocaleString()}`,
    burnRate: `${(burn * 100).toFixed(0)}%`,
  };
});

export const AegisCostAnalyticsPage = () => {
  const classes = useStyles();

  const spendColumns = useMemo<TableColumn<SpendSummaryRow>[]>(
    () => [
      { title: 'Project', field: 'project' },
      { title: 'FY Budget', field: 'fyBudget' },
      { title: 'Projected FY Spend', field: 'fySpend' },
      { title: 'Budget Burn Rate', field: 'burnRate' },
    ],
    [],
  );

  return (
    <Page themeId="tool">
      <Content>
        <ContentHeader title="Usage & Cost Analytics">
          <HeaderLabel label="Persona" value="Program Admin" />
          <HeaderLabel label="Last Updated" value="5 minutes ago" />
        </ContentHeader>
        <div className={classes.content}>
          <Grid container spacing={3} className={classes.grid}>
            <Grid item xs={12} md={6}>
              <Paper className={classes.card}>
                <Typography variant="h6">Spend Over Time</Typography>
                <Typography variant="body2" color="textSecondary">
                  Month-over-month spend trends against allocated budget.
                </Typography>
                <div className={classes.placeholder}>Budget vs Actual Spend Chart</div>
              </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
              <Paper className={classes.card}>
                <Typography variant="h6">GPU Hours Consumed</Typography>
                <Typography variant="body2" color="textSecondary">
                  Rolling 30-day GPU utilization by project.
                </Typography>
                <div className={classes.placeholder}>GPU Hours Trend Chart</div>
              </Paper>
            </Grid>
            <Grid item xs={12}>
              <Paper className={classes.card}>
                <Typography variant="h6">Active Budget Alerts</Typography>
                <Box className={classes.statRow}>
                  {usageData.map(project => {
                    const quotaState = project.quotaAlert ?? 'ok';
                    const alertLabel =
                      quotaState === 'critical'
                        ? 'Critical'
                        : quotaState === 'warning'
                        ? 'Warning'
                        : 'On Track';
                    const chipColor =
                      quotaState === 'critical'
                        ? 'secondary'
                        : quotaState === 'ok'
                        ? 'primary'
                        : 'default';
                    const chipVariant = quotaState === 'ok' ? 'outlined' : 'default';
                    return (
                      <Box key={project.project} className={classes.stat}>
                        <div className={classes.statLabel}>{project.project}</div>
                        <div className={classes.statValue}>
                          {project.gpuHours.toLocaleString()} GPU hrs
                        </div>
                        <Chip
                          label={`${alertLabel} – ${(
                            project.budget > 0
                              ? (project.spend / project.budget) * 100
                              : 0
                          ).toFixed(1)}% of budget`}
                          color={chipColor as 'default' | 'primary' | 'secondary'}
                          variant={chipVariant as 'default' | 'outlined'}
                        />
                      </Box>
                    );
                  })}
                </Box>
              </Paper>
            </Grid>
            <Grid item xs={12}>
              <Paper className={classes.card}>
                <Typography variant="h6">Projected Fiscal Spend</Typography>
                <Table
                  options={{ paging: false, search: false, toolbar: false }}
                  data={spendSummary}
                  columns={spendColumns}
                />
              </Paper>
            </Grid>
          </Grid>
        </div>
      </Content>
    </Page>
  );
};

