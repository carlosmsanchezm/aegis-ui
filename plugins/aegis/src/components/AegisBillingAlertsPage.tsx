import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Page,
  Content,
  ContentHeader,
  HeaderLabel,
  Progress,
  StatusError,
  StatusOK,
  StatusWarning,
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
  Chip,
  Paper,
  Typography,
  makeStyles,
} from '@material-ui/core';
import RefreshIcon from '@material-ui/icons/Refresh';
import NotificationsActiveIcon from '@material-ui/icons/NotificationsActive';

import {
  BudgetRecord,
  ProjectRecord,
  listBudgets,
  listProjects,
} from '../api/aegisClient';
import { keycloakAuthApiRef } from '../api/refs';

type AlertSeverity = 'critical' | 'warning' | 'info';

type FinOpsAlert = {
  id: string;
  message: string;
  severity: AlertSeverity;
  triggered: string;
  scope: string;
  owner: string;
};

const useStyles = makeStyles(theme => ({
  content: {
    paddingBottom: theme.spacing(5),
  },
  highlight: {
    backgroundColor: 'var(--aegis-card-surface)',
    border: '1px solid var(--aegis-card-border)',
    boxShadow: 'var(--aegis-card-shadow)',
    borderRadius: theme.shape.borderRadius * 2,
    padding: theme.spacing(3),
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2.5),
  },
  highlightIcon: {
    width: 52,
    height: 52,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background:
      'linear-gradient(135deg, rgba(255, 168, 0, 0.18) 0%, rgba(255, 64, 129, 0.28) 100%)',
    color: theme.palette.warning.main,
  },
  tableCard: {
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

const renderSeverity = (severity: AlertSeverity) => {
  switch (severity) {
    case 'critical':
      return <StatusError>Critical</StatusError>;
    case 'warning':
      return <StatusWarning>Warning</StatusWarning>;
    default:
      return <StatusOK>Informational</StatusOK>;
  }
};

/** Derive alerts from budget utilization thresholds. */
const deriveAlerts = (
  projects: ProjectRecord[],
  budgetsByProject: Map<string, BudgetRecord[]>,
): FinOpsAlert[] => {
  const alerts: FinOpsAlert[] = [];
  const projectMap = new Map(projects.map(p => [p.id, p]));

  for (const [projectId, budgets] of budgetsByProject.entries()) {
    const project = projectMap.get(projectId);
    const projectName = project?.displayName ?? projectId;

    for (const budget of budgets) {
      const spent = budget.spentUsd ?? 0;
      const limit = budget.limitUsd ?? 0;
      if (limit <= 0) {
        continue;
      }

      const utilization = (spent / limit) * 100;
      const queue = budget.queue ?? 'default';

      if (utilization >= 100) {
        alerts.push({
          id: `${projectId}-${queue}-over`,
          message: `Project '${projectName}' (queue: ${queue}) has exceeded its budget limit ($${spent.toLocaleString()} / $${limit.toLocaleString()})`,
          severity: 'critical',
          triggered: 'Current period',
          scope: 'Budget exceeded',
          owner: 'FinOps',
        });
      } else if (utilization >= 90) {
        alerts.push({
          id: `${projectId}-${queue}-90`,
          message: `Project '${projectName}' (queue: ${queue}) is at ${utilization.toFixed(0)}% of its budget`,
          severity: 'warning',
          triggered: 'Current period',
          scope: 'Budget threshold',
          owner: 'FinOps',
        });
      } else if (utilization >= 80) {
        alerts.push({
          id: `${projectId}-${queue}-80`,
          message: `Project '${projectName}' (queue: ${queue}) is approaching budget limit at ${utilization.toFixed(0)}%`,
          severity: 'info',
          triggered: 'Current period',
          scope: 'Budget threshold',
          owner: 'FinOps',
        });
      }
    }
  }

  // Sort by severity: critical first, then warning, then info
  const severityOrder: Record<AlertSeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
  };
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return alerts;
};

export const AegisBillingAlertsPage = () => {
  const classes = useStyles();
  const fetchApi = useApi(fetchApiRef);
  const discoveryApi = useApi(discoveryApiRef);
  const identityApi = useApi(identityApiRef);
  const authApi = useApi(keycloakAuthApiRef);
  const alertApi = useApi(alertApiRef);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [budgetsByProject, setBudgetsByProject] = useState<
    Map<string, BudgetRecord[]>
  >(new Map());

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
      const projectItems = projectsResponse?.items ?? [];
      setProjects(projectItems);

      const budgetsMap = new Map<string, BudgetRecord[]>();
      await Promise.all(
        projectItems.map(async project => {
          try {
            const budgets = await listBudgets(
              fetchApi,
              discoveryApi,
              identityApi,
              authApi,
              project.id,
            );
            if (budgets.length > 0) {
              budgetsMap.set(project.id, budgets);
            }
          } catch {
            // Project may not have budgets configured
          }
        }),
      );

      setBudgetsByProject(budgetsMap);
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      setError(msg);
      alertApi.post({
        message: `Failed to load billing alerts: ${msg}`,
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [fetchApi, discoveryApi, identityApi, authApi, alertApi]);

  useEffect(() => {
    load();
  }, [load]);

  const derivedAlerts = useMemo(
    () => deriveAlerts(projects, budgetsByProject),
    [projects, budgetsByProject],
  );

  const columns = useMemo<TableColumn<FinOpsAlert>[]>(
    () => [
      { title: 'Alert', field: 'message', width: '45%' },
      {
        title: 'Severity',
        field: 'severity',
        render: row => renderSeverity(row.severity),
      },
      { title: 'Triggered', field: 'triggered' },
      { title: 'Scope', field: 'scope' },
      {
        title: 'Owner',
        field: 'owner',
        render: row => <Chip label={row.owner} size="small" color="primary" />,
      },
    ],
    [],
  );

  if (loading) {
    return (
      <Page themeId="tool">
        <Content className={classes.content}>
          <ContentHeader title="Billing Alerts">
            <HeaderLabel label="Alert Routes" value="Slack · Email" />
            <HeaderLabel label="Auto Escalation" value="Enabled" />
          </ContentHeader>
          <Progress />
        </Content>
      </Page>
    );
  }

  if (error) {
    return (
      <Page themeId="tool">
        <Content className={classes.content}>
          <ContentHeader title="Billing Alerts">
            <HeaderLabel label="Alert Routes" value="Slack · Email" />
            <HeaderLabel label="Auto Escalation" value="Enabled" />
          </ContentHeader>
          <WarningPanel title="Failed to load billing alerts" severity="error">
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
      <Content className={classes.content}>
        <ContentHeader title="Billing Alerts">
          <HeaderLabel label="Alert Routes" value="Slack · Email" />
          <HeaderLabel label="Auto Escalation" value="Enabled" />
          <Button
            variant="outlined"
            size="small"
            startIcon={<RefreshIcon />}
            onClick={load}
          >
            Refresh
          </Button>
        </ContentHeader>

        <Paper elevation={0} className={classes.highlight}>
          <div className={classes.highlightIcon}>
            <NotificationsActiveIcon fontSize="large" />
          </div>
          <Box>
            <Typography variant="h5" gutterBottom>
              FinOps guardrails keep teams within budget
            </Typography>
            <Typography variant="body1" color="textSecondary">
              Alerts are derived from project budget utilization. Projects
              exceeding 80% of their budget limit will trigger threshold alerts.
              Custom alert rules are coming in a future release.
            </Typography>
          </Box>
        </Paper>

        {derivedAlerts.length === 0 ? (
          <Box className={classes.emptyState}>
            <Typography variant="h6" gutterBottom>
              No active alerts
            </Typography>
            <Typography variant="body2" color="textSecondary">
              All projects are within their budget thresholds, or no budgets have
              been configured yet. Alerts will appear here when project spending
              approaches or exceeds budget limits.
            </Typography>
          </Box>
        ) : (
          <Paper elevation={0} className={classes.tableCard}>
            <Typography variant="h6" gutterBottom>
              Active Alerts ({derivedAlerts.length})
            </Typography>
            <Table
              options={{
                paging: false,
                search: false,
                padding: 'dense',
              }}
              data={derivedAlerts}
              columns={columns}
            />
          </Paper>
        )}
      </Content>
    </Page>
  );
};

export default AegisBillingAlertsPage;
