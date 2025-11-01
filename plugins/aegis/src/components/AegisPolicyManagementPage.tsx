import { useMemo, useState } from 'react';
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
  Button,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
} from '@material-ui/core';
import { makeStyles, Theme } from '@material-ui/core/styles';

const useStyles = makeStyles((theme: Theme) => ({
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(4),
  },
  card: {
    backgroundColor: 'var(--aegis-card-surface)',
    border: '1px solid var(--aegis-card-border)',
    borderRadius: theme.shape.borderRadius,
    boxShadow: 'var(--aegis-card-shadow)',
    padding: theme.spacing(3),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2.5),
  },
  formRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: theme.spacing(2),
  },
  actions: {
    display: 'flex',
    gap: theme.spacing(1),
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
}));

type PolicyRow = {
  scope: string;
  gpuCap: string;
  maxDuration: string;
  approval: 'auto' | 'manual';
};

type RequestRow = {
  id: string;
  requester: string;
  project: string;
  gpuRequest: string;
  duration: string;
  justification: string;
  submittedAt: string;
};

const initialPolicies: PolicyRow[] = [
  {
    scope: 'Default Workspace Policy',
    gpuCap: '4 GPUs',
    maxDuration: '12 hours',
    approval: 'auto',
  },
  {
    scope: 'RL Research Team',
    gpuCap: '16 GPUs',
    maxDuration: '48 hours',
    approval: 'manual',
  },
];

const workspaceRequests: RequestRow[] = [
  {
    id: 'REQ-9012',
    requester: 'Evelyn Shaw',
    project: 'RL Research',
    gpuRequest: '8 A100',
    duration: '36 hours',
    justification: 'Hyperparameter sweep for curriculum update',
    submittedAt: 'Aug 16, 09:12',
  },
  {
    id: 'REQ-9013',
    requester: 'Noah Patel',
    project: 'Inference Ops',
    gpuRequest: '4 L4',
    duration: '12 hours',
    justification: 'Load testing streaming endpoints',
    submittedAt: 'Aug 16, 10:45',
  },
];

export const AegisPolicyManagementPage = () => {
  const classes = useStyles();
  const [policyForm, setPolicyForm] = useState({
    scope: '',
    gpuCap: '',
    maxDuration: '',
    approval: 'manual',
  });

  const policyColumns = useMemo<TableColumn<PolicyRow>[]>(
    () => [
      { title: 'Scope', field: 'scope' },
      { title: 'GPU Cap', field: 'gpuCap' },
      { title: 'Max Duration', field: 'maxDuration' },
      {
        title: 'Approval Mode',
        field: 'approval',
        render: row =>
          row.approval === 'auto' ? (
            <Typography color="primary">Automatic</Typography>
          ) : (
            <Typography color="textPrimary">Manual</Typography>
          ),
      },
    ],
    [],
  );

  const requestColumns = useMemo<TableColumn<RequestRow>[]>(
    () => [
      { title: 'Request ID', field: 'id' },
      { title: 'Requester', field: 'requester' },
      { title: 'Project', field: 'project' },
      { title: 'GPU Request', field: 'gpuRequest' },
      { title: 'Duration', field: 'duration' },
      { title: 'Submitted', field: 'submittedAt' },
      {
        title: 'Actions',
        field: 'actions',
        render: () => (
          <Box className={classes.actions}>
            <Button variant="outlined" color="primary" size="small">
              Approve
            </Button>
            <Button variant="outlined" color="secondary" size="small">
              Deny
            </Button>
          </Box>
        ),
      },
    ],
    [classes.actions],
  );

  return (
    <Page themeId="tool">
      <Content>
        <ContentHeader title="Quota & Policy Management">
          <HeaderLabel label="Persona" value="Program Admin" />
          <HeaderLabel label="Escalation SLA" value="24 hours" />
        </ContentHeader>
        <div className={classes.content}>
          <Paper className={classes.card}>
            <div className={classes.sectionHeader}>
              <Typography variant="h6">Set Workspace Guardrails</Typography>
              <Button variant="contained" color="primary">
                Save Policy
              </Button>
            </div>
            <Typography variant="body2" color="textSecondary">
              Define default limits for new workspace requests or override per team.
            </Typography>
            <div className={classes.formRow}>
              <TextField
                label="Policy Scope"
                placeholder="e.g. Inference Ops"
                value={policyForm.scope}
                onChange={event =>
                  setPolicyForm(current => ({ ...current, scope: event.target.value }))
                }
                variant="outlined"
                size="small"
              />
              <TextField
                label="Max GPUs"
                placeholder="e.g. 8 A100"
                value={policyForm.gpuCap}
                onChange={event =>
                  setPolicyForm(current => ({ ...current, gpuCap: event.target.value }))
                }
                variant="outlined"
                size="small"
              />
              <TextField
                label="Max Duration"
                placeholder="e.g. 24 hours"
                value={policyForm.maxDuration}
                onChange={event =>
                  setPolicyForm(current => ({
                    ...current,
                    maxDuration: event.target.value,
                  }))
                }
                variant="outlined"
                size="small"
              />
              <Select
                value={policyForm.approval}
                onChange={event =>
                  setPolicyForm(current => ({
                    ...current,
                    approval: event.target.value as 'auto' | 'manual',
                  }))
                }
                variant="outlined"
                displayEmpty
              >
                <MenuItem value="auto">Automatic approval</MenuItem>
                <MenuItem value="manual">Requires admin review</MenuItem>
              </Select>
            </div>
          </Paper>

          <Paper className={classes.card}>
            <Typography variant="h6">Active Policies</Typography>
            <Table
              options={{ paging: false, search: false, toolbar: false }}
              data={initialPolicies}
              columns={policyColumns}
            />
          </Paper>

          <Paper className={classes.card}>
            <Typography variant="h6">Pending Workspace Requests</Typography>
            <Typography variant="body2" color="textSecondary">
              Review and triage queued requests that exceed default guardrails.
            </Typography>
            <Table
              options={{ paging: false, search: false, toolbar: false }}
              data={workspaceRequests}
              columns={requestColumns}
            />
          </Paper>
        </div>
      </Content>
    </Page>
  );
};

