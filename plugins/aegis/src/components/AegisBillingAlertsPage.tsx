import { useMemo } from 'react';
import {
  Page,
  Content,
  ContentHeader,
  HeaderLabel,
  StatusError,
  StatusOK,
  StatusWarning,
  Table,
  TableColumn,
} from '@backstage/core-components';
import { Box, Chip, Paper, Typography, makeStyles } from '@material-ui/core';

import NotificationsActiveIcon from '@material-ui/icons/NotificationsActive';

type AlertSeverity = 'critical' | 'warning' | 'info';

type FinOpsAlert = {
  id: string;
  message: string;
  severity: AlertSeverity;
  triggered: string;
  scope: string;
  owner: string;
};

const mockAlerts: FinOpsAlert[] = [
  {
    id: 'alert-001',
    message: "Project 'p-demo' is at 90% of its monthly budget",
    severity: 'warning',
    triggered: '5 minutes ago',
    scope: 'Budget threshold',
    owner: 'FinOps',
  },
  {
    id: 'alert-002',
    message: "User 'jkim' exceeded their weekly GPU quota",
    severity: 'critical',
    triggered: '18 minutes ago',
    scope: 'User quota',
    owner: 'Platform',
  },
  {
    id: 'alert-003',
    message: "Workspace 'aurora-ml-lab' forecast exceeds budget by 12%",
    severity: 'warning',
    triggered: '1 hour ago',
    scope: 'Forecasting',
    owner: 'FinOps',
  },
  {
    id: 'alert-004',
    message: "Project 'p-atlas' spend dropped 30% vs. plan",
    severity: 'info',
    triggered: '2 hours ago',
    scope: 'Variance',
    owner: 'Insights',
  },
];

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

export const AegisBillingAlertsPage = () => {
  const classes = useStyles();

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

  return (
    <Page themeId="tool">
      <Content className={classes.content}>
        <ContentHeader title="Billing Alerts">
          <HeaderLabel label="Alert Routes" value="Slack · Email" />
          <HeaderLabel label="Auto Escalation" value="Enabled" />
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
              Review and acknowledge the latest cost, quota, and forecast alerts
              to stay ahead of spend anomalies before they impact commitments.
            </Typography>
          </Box>
        </Paper>

        <Paper elevation={0} className={classes.tableCard}>
          <Typography variant="h6" gutterBottom>
            Active Alerts
          </Typography>
          <Table
            options={{
              paging: false,
              search: false,
              padding: 'dense',
            }}
            data={mockAlerts}
            columns={columns}
          />
        </Paper>
      </Content>
    </Page>
  );
};

export default AegisBillingAlertsPage;
