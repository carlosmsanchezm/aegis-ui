import { FC, useMemo } from 'react';
import { Box, makeStyles, Paper, Typography } from '@material-ui/core';
import {
  Content,
  ContentHeader,
  HeaderLabel,
  Page,
  StatusError,
  StatusOK,
  StatusWarning,
  Table,
  TableColumn,
} from '@backstage/core-components';

type AlertRow = {
  alert: string;
  severity: 'critical' | 'warning' | 'ok';
  triggered: string;
  action: string;
};

const alerts: AlertRow[] = [
  {
    alert: "Project 'p-demo' is at 90% of its budget",
    severity: 'warning',
    triggered: '2024-05-18 08:32Z',
    action: 'Increase budget or pause non-critical jobs',
  },
  {
    alert: "User 'analyst-42' exceeded weekly GPU quota",
    severity: 'critical',
    triggered: '2024-05-18 06:14Z',
    action: 'Notify manager and issue temporary suspension',
  },
  {
    alert: 'Workspace atlas-notebook-47 projected to overspend by 12%',
    severity: 'warning',
    triggered: '2024-05-17 22:41Z',
    action: 'Review workload schedule and optimize runtime',
  },
  {
    alert: 'All FinOps guardrails operating nominally',
    severity: 'ok',
    triggered: '2024-05-17 12:00Z',
    action: 'No action required',
  },
];

const useStyles = makeStyles(theme => ({
  content: {
    paddingBottom: theme.spacing(6),
  },
  card: {
    backgroundColor: 'var(--aegis-card-surface)',
    border: '1px solid var(--aegis-card-border)',
    boxShadow: 'var(--aegis-card-shadow)',
    borderRadius: theme.shape.borderRadius * 2,
    padding: theme.spacing(3),
  },
  headerHint: {
    color: theme.palette.text.secondary,
  },
}));

export const AegisBillingAlertsPage: FC = () => {
  const classes = useStyles();

  const columns = useMemo<TableColumn<AlertRow>[]>(
    () => [
      { title: 'Alert', field: 'alert', width: '40%' },
      {
        title: 'Severity',
        field: 'severity',
        sorting: false,
        render: row => {
          if (row.severity === 'critical') {
            return <StatusError>Critical</StatusError>;
          }
          if (row.severity === 'warning') {
            return <StatusWarning>Warning</StatusWarning>;
          }
          return <StatusOK>Normal</StatusOK>;
        },
      },
      { title: 'Triggered', field: 'triggered' },
      { title: 'Recommended Action', field: 'action' },
    ],
    [],
  );

  return (
    <Page themeId="tool">
      <Content className={classes.content}>
        <ContentHeader title="Billing Alerts">
          <HeaderLabel label="Signal" value="Real-time" />
        </ContentHeader>
        <Box mb={3}>
          <Typography variant="body2" className={classes.headerHint}>
            Alerts surface impending budget breaches and quota violations so
            FinOps admins can intervene before spend exceeds guardrails.
          </Typography>
        </Box>
        <Paper className={classes.card}>
          <Table
            title="Active Alerts"
            options={{ paging: false, search: false, padding: 'dense' }}
            columns={columns}
            data={alerts}
          />
        </Paper>
      </Content>
    </Page>
  );
};
