import { useMemo, useState } from 'react';
import { Button, makeStyles, Paper, Typography } from '@material-ui/core';
import {
  Content,
  ContentHeader,
  HeaderLabel,
  Page,
  StatusError,
  StatusOK,
  StatusPending,
  Table,
  TableColumn,
} from '@backstage/core-components';
import { alertApiRef, useApi } from '@backstage/core-plugin-api';

type AlertRow = {
  id: string;
  title: string;
  severity: 'critical' | 'warning' | 'info';
  cluster: string;
  started: string;
  status: 'active' | 'acknowledged' | 'resolved';
};

const useStyles = makeStyles(theme => ({
  root: {
    paddingBottom: theme.spacing(6),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(4),
  },
  paper: {
    background: 'var(--aegis-card-surface)',
    border: '1px solid var(--aegis-card-border)',
    boxShadow: 'var(--aegis-card-shadow)',
    borderRadius: theme.shape.borderRadius * 2,
    padding: theme.spacing(3),
  },
  actionBar: {
    display: 'flex',
    gap: theme.spacing(1),
  },
}));

const alertStatus = (severity: AlertRow['severity']) => {
  switch (severity) {
    case 'critical':
      return <StatusError>Critical</StatusError>;
    case 'warning':
      return <StatusPending>Warning</StatusPending>;
    default:
      return <StatusOK>Info</StatusOK>;
  }
};

const initialAlerts: AlertRow[] = [
  {
    id: 'alert-1001',
    title: 'Failed Node: titan-apac/gpu-agent-1',
    severity: 'critical',
    cluster: 'Titan · ap-southeast-2',
    started: '2024-03-24 13:48 UTC',
    status: 'active',
  },
  {
    id: 'alert-1002',
    title: 'Quota Exhaustion: aurora-west-1 GPU pool',
    severity: 'warning',
    cluster: 'Aurora · us-gov-west-1',
    started: '2024-03-24 12:17 UTC',
    status: 'active',
  },
  {
    id: 'alert-1003',
    title: 'New IAM exception granted',
    severity: 'info',
    cluster: 'Sentinel · us-gov-east-2',
    started: '2024-03-24 11:05 UTC',
    status: 'acknowledged',
  },
];

export const AegisAlertsDashboardPage = () => {
  const classes = useStyles();
  const alertApi = useApi(alertApiRef);
  const [rows, setRows] = useState(initialAlerts);

  const updateStatus = (id: string, status: AlertRow['status'], verb: string) => {
    setRows(prev => prev.map(row => (row.id === id ? { ...row, status } : row)));
    alertApi.post({
      severity: 'info',
      message: `${verb} alert ${id}`,
    });
  };

  const columns = useMemo<TableColumn<AlertRow>[]>(
    () => [
      { title: 'Alert', field: 'title' },
      {
        title: 'Severity',
        field: 'severity',
        render: row => alertStatus(row.severity),
      },
      { title: 'Cluster', field: 'cluster' },
      { title: 'Started', field: 'started' },
      {
        title: 'Status',
        field: 'status',
        render: row => row.status,
      },
      {
        title: 'Actions',
        field: 'actions',
        sorting: false,
        render: row => (
          <div className={classes.actionBar}>
            <Button
              size="small"
              variant="outlined"
              onClick={() => updateStatus(row.id, 'acknowledged', 'Acknowledged')}
              disabled={row.status !== 'active'}
            >
              Acknowledge
            </Button>
            <Button
              size="small"
              color="primary"
              variant="contained"
              onClick={() => updateStatus(row.id, 'resolved', 'Resolved')}
              disabled={row.status === 'resolved'}
            >
              Resolve
            </Button>
          </div>
        ),
      },
    ],
    [classes.actionBar],
  );

  return (
    <Page themeId="tool">
      <Content className={classes.root}>
        <ContentHeader title="Alerts Dashboard">
          <HeaderLabel label="Open" value={rows.filter(r => r.status !== 'resolved').length.toString()} />
          <HeaderLabel label="Resolved" value={rows.filter(r => r.status === 'resolved').length.toString()} />
        </ContentHeader>

        <Paper className={classes.paper}>
          <Typography variant="h6" gutterBottom>
            Critical Alerts
          </Typography>
          <Table
            options={{ paging: false, search: false, padding: 'dense' }}
            columns={columns}
            data={rows}
          />
        </Paper>
      </Content>
    </Page>
  );
};
