import { FC, useMemo, useState } from 'react';
import {
  Page,
  Content,
  ContentHeader,
  HeaderLabel,
  Table,
  TableColumn,
} from '@backstage/core-components';
import {
  Box,
  Button,
  Grid,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
  makeStyles,
} from '@material-ui/core';

const useStyles = makeStyles(theme => ({
  layout: {
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
    gap: theme.spacing(3),
  },
  formRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(2),
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: theme.spacing(1.5),
  },
}));

type PolicyRow = {
  id: string;
  scope: string;
  constraint: string;
  value: string;
  enforcement: 'soft' | 'hard';
};

type RequestRow = {
  id: string;
  requester: string;
  project: string;
  requestedAt: string;
  resources: string;
  status: 'pending' | 'approved' | 'denied';
};

const policyData: PolicyRow[] = [
  {
    id: 'GPU-GLOBAL-MAX',
    scope: 'Global',
    constraint: 'Concurrent GPU Workspaces',
    value: '32',
    enforcement: 'hard',
  },
  {
    id: 'TEAM-LABS-T4',
    scope: 'Team — Labs',
    constraint: 'Daily GPU Hours',
    value: '400',
    enforcement: 'soft',
  },
  {
    id: 'TEAM-ATLAS-A100',
    scope: 'Team — Atlas',
    constraint: 'Per-user A100 count',
    value: '2',
    enforcement: 'hard',
  },
];

const requestQueue: RequestRow[] = [
  {
    id: 'REQ-10421',
    requester: 'Nina Alvarez',
    project: 'Atlas Vision Training',
    requestedAt: '2024-04-12 09:14 UTC',
    resources: 'A100 • 2x • 16h',
    status: 'pending',
  },
  {
    id: 'REQ-10418',
    requester: 'Jacob Singh',
    project: 'Conversational R&D',
    requestedAt: '2024-04-11 18:02 UTC',
    resources: 'T4 • 4x • 24h',
    status: 'approved',
  },
  {
    id: 'REQ-10416',
    requester: 'Maya Chen',
    project: 'Model Compression Experiments',
    requestedAt: '2024-04-10 22:40 UTC',
    resources: 'A10 • 1x • 8h',
    status: 'denied',
  },
];

export const AegisPolicyManagementPage: FC = () => {
  const classes = useStyles();
  const [policyValue, setPolicyValue] = useState('32');
  const [selectedScope, setSelectedScope] = useState('Global');
  const [constraint, setConstraint] = useState('Concurrent GPU Workspaces');

  const policyColumns = useMemo<TableColumn<PolicyRow>[]>(
    () => [
      { title: 'Policy ID', field: 'id' },
      { title: 'Scope', field: 'scope' },
      { title: 'Constraint', field: 'constraint' },
      { title: 'Value', field: 'value' },
      {
        title: 'Enforcement',
        field: 'enforcement',
        render: row => (
          <Typography
            variant="body2"
            color={row.enforcement === 'hard' ? 'error' : 'textPrimary'}
          >
            {row.enforcement === 'hard' ? 'Hard stop' : 'Advisory'}
          </Typography>
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
      { title: 'Resources', field: 'resources' },
      { title: 'Requested', field: 'requestedAt' },
      {
        title: 'Status',
        field: 'status',
        render: row => (
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Typography variant="body2" color="textPrimary">
              {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
            </Typography>
            <Box display="flex" gap={8}>
              <Button
                variant="outlined"
                color="primary"
                size="small"
                disabled={row.status === 'approved'}
              >
                Approve
              </Button>
              <Button
                variant="outlined"
                color="secondary"
                size="small"
                disabled={row.status === 'denied'}
              >
                Deny
              </Button>
            </Box>
          </Box>
        ),
      },
    ],
    [],
  );

  return (
    <Page themeId="tool">
      <Content>
        <ContentHeader title="Quota & Policy Management">
          <HeaderLabel label="Administration" value="Workspace governance" />
        </ContentHeader>
        <div className={classes.layout}>
          <Paper className={classes.card}>
            <Typography variant="h6">Set policy guardrails</Typography>
            <div className={classes.formRow}>
              <TextField
                label="Scope"
                select
                variant="outlined"
                value={selectedScope}
                onChange={event => setSelectedScope(event.target.value)}
                style={{ minWidth: 200 }}
              >
                <MenuItem value="Global">Global</MenuItem>
                <MenuItem value="Team — Labs">Team — Labs</MenuItem>
                <MenuItem value="Team — Atlas">Team — Atlas</MenuItem>
              </TextField>
              <TextField
                label="Constraint"
                select
                variant="outlined"
                value={constraint}
                onChange={event => setConstraint(event.target.value)}
                style={{ minWidth: 220 }}
              >
                <MenuItem value="Concurrent GPU Workspaces">
                  Concurrent GPU Workspaces
                </MenuItem>
                <MenuItem value="Daily GPU Hours">Daily GPU Hours</MenuItem>
                <MenuItem value="Per-user A100 count">Per-user A100 count</MenuItem>
              </TextField>
              <TextField
                label="Value"
                variant="outlined"
                value={policyValue}
                onChange={event => setPolicyValue(event.target.value)}
                style={{ width: 160 }}
              />
              <Select value="hard" variant="outlined" style={{ width: 160 }}>
                <MenuItem value="hard">Hard stop</MenuItem>
                <MenuItem value="soft">Advisory</MenuItem>
              </Select>
            </div>
            <div className={classes.actions}>
              <Button variant="outlined" color="secondary">
                Reset
              </Button>
              <Button color="primary" variant="contained">
                Update Policy
              </Button>
            </div>
          </Paper>

          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Paper className={classes.card}>
                <Typography variant="h6">Active policies</Typography>
                <Table
                  options={{ paging: false, search: false, padding: 'dense' }}
                  data={policyData}
                  columns={policyColumns}
                />
              </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
              <Paper className={classes.card}>
                <Typography variant="h6">Workspace requests</Typography>
                <Table
                  options={{ paging: false, search: false, padding: 'dense' }}
                  data={requestQueue}
                  columns={requestColumns}
                />
              </Paper>
            </Grid>
          </Grid>
        </div>
      </Content>
    </Page>
  );
};
