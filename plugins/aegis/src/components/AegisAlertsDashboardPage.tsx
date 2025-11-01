import { FC, useMemo } from 'react';
import {
  Page,
  Content,
  ContentHeader,
  Table,
  TableColumn,
  StatusError,
  StatusWarning,
  StatusPending,
} from '@backstage/core-components';
import { Button, Typography, makeStyles } from '@material-ui/core';
import { alertApiRef, useApi } from '@backstage/core-plugin-api';

const useStyles = makeStyles(theme => ({
  tableWrapper: {
    backgroundColor: 'var(--aegis-card-surface)',
    border: '1px solid var(--aegis-card-border)',
    boxShadow: 'var(--aegis-card-shadow)',
    padding: theme.spacing(1, 0),
  },
  actionButtons: {
    display: 'flex',
    gap: theme.spacing(1),
  },
}));

type AlertRow = {
  id: string;
  severity: 'Critical' | 'Warning' | 'Info';
  title: string;
  detectedAt: string;
  runbook: string;
  status: 'Firing' | 'Acknowledged' | 'Silenced';
};

const alerts: AlertRow[] = [
  {
    id: 'AE-245',
    severity: 'Critical',
    title: 'Node failure: ml-training-east-17',
    detectedAt: '5 minutes ago',
    runbook: 'Runbook: GPU node failure',
    status: 'Firing',
  },
  {
    id: 'AE-238',
    severity: 'Warning',
    title: 'Quota exhaustion approaching for project quantum-labs',
    detectedAt: '18 minutes ago',
    runbook: 'Playbook: Request burst capacity',
    status: 'Acknowledged',
  },
  {
    id: 'AE-229',
    severity: 'Critical',
    title: 'High error rate on ingress-gateway',
    detectedAt: '32 minutes ago',
    runbook: 'Playbook: Ingress saturation',
    status: 'Firing',
  },
  {
    id: 'AE-221',
    severity: 'Info',
    title: 'Maintenance window starting for edge-fleet-eu',
    detectedAt: 'Scheduled for 02:00 UTC',
    runbook: 'Checklist: Edge maintenance',
    status: 'Silenced',
  },
];

const severityChip = (severity: AlertRow['severity']) => {
  switch (severity) {
    case 'Critical':
      return <StatusError>Critical</StatusError>;
    case 'Warning':
      return <StatusWarning>Warning</StatusWarning>;
    default:
      return <StatusPending>Info</StatusPending>;
  }
};

export const AegisAlertsDashboardPage: FC = () => {
  const classes = useStyles();
  const alertApi = useApi(alertApiRef);

  const handleAction = (id: string, action: 'ack' | 'resolve') => {
    const verb = action === 'ack' ? 'Acknowledged' : 'Resolved';
    alertApi.post({
      message: `${verb} alert ${id}`,
      severity: 'info',
    });
  };

  const columns = useMemo<TableColumn<AlertRow>[]>(
    () => [
      { title: 'Alert ID', field: 'id' },
      {
        title: 'Severity',
        field: 'severity',
        render: row => severityChip(row.severity),
      },
      { title: 'Title', field: 'title', width: '35%' },
      { title: 'Detected', field: 'detectedAt' },
      { title: 'Runbook', field: 'runbook' },
      { title: 'Status', field: 'status' },
      {
        title: 'Actions',
        field: 'actions',
        render: row => (
          <div className={classes.actionButtons}>
            <Button
              variant="outlined"
              size="small"
              onClick={() => handleAction(row.id, 'ack')}
            >
              Acknowledge
            </Button>
            <Button
              variant="contained"
              color="secondary"
              size="small"
              onClick={() => handleAction(row.id, 'resolve')}
            >
              Resolve
            </Button>
          </div>
        ),
      },
    ],
    [classes.actionButtons],
  );

  return (
    <Page themeId="tool">
      <Content>
        <ContentHeader title="Alerts Dashboard">
          <Typography variant="body1" color="textSecondary">
            Active incidents and operational signals prioritized for rapid acknowledgement.
          </Typography>
        </ContentHeader>

        <div className={classes.tableWrapper}>
          <Table
            options={{ paging: false, search: false, padding: 'dense' }}
            data={alerts}
            columns={columns}
            title="Active Alerts"
          />
        </div>
      </Content>
    </Page>
  );
};

