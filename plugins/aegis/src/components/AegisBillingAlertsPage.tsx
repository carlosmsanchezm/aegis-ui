import { FC, useMemo } from 'react';
import {
  Page,
  Content,
  ContentHeader,
  HeaderLabel,
  StatusError,
  StatusWarning,
  Table,
  TableColumn,
} from '@backstage/core-components';
import {
  Box,
  Grid,
  List,
  ListItem,
  ListItemText,
  makeStyles,
  Paper,
  Typography,
} from '@material-ui/core';

const useStyles = makeStyles(theme => ({
  pageContent: {
    paddingBottom: theme.spacing(6),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(3),
  },
  card: {
    padding: theme.spacing(3),
    background: 'var(--aegis-card-surface)',
    border: '1px solid var(--aegis-card-border)',
    boxShadow: 'var(--aegis-card-shadow)',
    borderRadius: theme.shape.borderRadius * 2,
  },
}));

type AlertRow = {
  id: string;
  alert: string;
  severity: 'warning' | 'error';
  detected: string;
  owner: string;
  nextStep: string;
};

const alerts: AlertRow[] = [
  {
    id: 'AL-451',
    alert: "Project 'p-demo' is at 90% of its budget",
    severity: 'warning',
    detected: '3 hours ago',
    owner: 'FinOps Team',
    nextStep: 'Review forecast and adjust guardrails',
  },
  {
    id: 'AL-452',
    alert: "User 'analyst-x' exceeded weekly GPU quota",
    severity: 'error',
    detected: '45 minutes ago',
    owner: 'Platform Ops',
    nextStep: 'Throttle workspace until next reset',
  },
  {
    id: 'AL-447',
    alert: "Workspace 'atlas-notebook-417' projected to overspend by 18%",
    severity: 'warning',
    detected: 'Yesterday',
    owner: 'Atlas-Discovery',
    nextStep: 'Increase budget or pause low-priority jobs',
  },
  {
    id: 'AL-438',
    alert: "Azure IL6 tenant cost anomaly detected (+32% day-over-day)",
    severity: 'error',
    detected: '2 days ago',
    owner: 'Cloud Governance',
    nextStep: 'Escalate to cost anomaly response playbook',
  },
];

const responsePlaybook = [
  'Escalate to cost anomaly response channel',
  'Validate spend spike with project leads',
  'Trigger GPU quota clamp if anomaly persists',
  'Document corrective action in FinOps journal',
];

export const AegisBillingAlertsPage: FC = () => {
  const classes = useStyles();

  const columns = useMemo<TableColumn<AlertRow>[]>(
    () => [
      { title: 'ID', field: 'id' },
      {
        title: 'Alert',
        field: 'alert',
        render: row => (
          <Typography variant="body2" color="textPrimary">
            {row.alert}
          </Typography>
        ),
      },
      {
        title: 'Severity',
        field: 'severity',
        render: row =>
          row.severity === 'error' ? (
            <StatusError>Critical</StatusError>
          ) : (
            <StatusWarning>Warning</StatusWarning>
          ),
      },
      { title: 'Detected', field: 'detected' },
      { title: 'Owner', field: 'owner' },
      {
        title: 'Recommended Action',
        field: 'nextStep',
        render: row => (
          <Typography variant="body2" color="textSecondary">
            {row.nextStep}
          </Typography>
        ),
      },
    ],
    [],
  );

  return (
    <Page themeId="tool">
      <Content className={classes.pageContent}>
        <ContentHeader title="Billing Alerts">
          <HeaderLabel label="Open Alerts" value={`${alerts.length}`} />
          <HeaderLabel label="Critical" value={`${alerts.filter(a => a.severity === 'error').length}`} />
        </ContentHeader>

        <Grid container spacing={3}>
          <Grid item xs={12} lg={7}>
            <Paper className={classes.card}>
              <Typography variant="h6" gutterBottom>
                FinOps Alert Feed
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Monitor high-signal alerts tied to budgets, quotas, and cost anomalies.
              </Typography>
              <Box mt={2}>
                <Table
                  title="Alerts"
                  options={{ paging: false, search: false, toolbar: false }}
                  columns={columns}
                  data={alerts}
                />
              </Box>
            </Paper>
          </Grid>
          <Grid item xs={12} lg={5}>
            <Paper className={classes.card}>
              <Typography variant="h6" gutterBottom>
                Response Playbook
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Ensure consistent remediation across FinOps and platform teams.
              </Typography>
              <List>
                {responsePlaybook.map(step => (
                  <ListItem key={step} divider>
                    <ListItemText primary={step} />
                  </ListItem>
                ))}
              </List>
            </Paper>
          </Grid>
        </Grid>
      </Content>
    </Page>
  );
};

export default AegisBillingAlertsPage;
