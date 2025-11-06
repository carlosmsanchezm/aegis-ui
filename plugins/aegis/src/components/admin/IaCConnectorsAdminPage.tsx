import React, { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import AddIcon from '@material-ui/icons/Add';
import CloseIcon from '@material-ui/icons/Close';
import RefreshIcon from '@material-ui/icons/Refresh';
import { Content, ContentHeader, Page } from '@backstage/core-components';

type ConnectorProvider = 'github' | 'gitlab' | 'bitbucket' | 'codecommit';

type IaCConnector = {
  id: string;
  provider: ConnectorProvider;
  name: string;
  project: string;
  status: 'Connected' | 'Error' | 'Pending Approval';
  lastSync: string;
  repositories: number;
  enforcement: 'PlanOnly' | 'PlanAndApply';
  approvalsRequired: boolean;
};

const useStyles = makeStyles(theme => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(4),
    paddingBottom: theme.spacing(6),
  },
  tablePaper: {
    borderRadius: theme.shape.borderRadius * 2,
    border: '1px solid var(--aegis-card-border, rgba(148, 163, 184, 0.18))',
    boxShadow: 'var(--aegis-card-shadow, rgba(15, 23, 42, 0.12) 0px 18px 32px -18px)',
    overflow: 'hidden',
  },
  tableToolbar: {
    display: 'flex',
    alignItems: 'center',
    padding: theme.spacing(2),
    gap: theme.spacing(2),
  },
  providerChip: {
    textTransform: 'capitalize',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: theme.spacing(2.5),
  },
  summaryCard: {
    borderRadius: theme.shape.borderRadius * 2,
    border: `1px solid ${theme.palette.divider}`,
    background:
      theme.palette.type === 'dark'
        ? 'rgba(15, 23, 42, 0.8)'
        : 'linear-gradient(145deg, rgba(248, 250, 255, 0.95), rgba(231, 236, 247, 0.85))',
  },
  modalGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: theme.spacing(2),
  },
}));

const connectorsSeed: IaCConnector[] = [
  {
    id: 'gh-platform',
    provider: 'github',
    name: 'GitHub – Platform Blueprints',
    project: 'Platform Engineering',
    status: 'Connected',
    lastSync: '2024-05-18T13:45:00Z',
    repositories: 6,
    enforcement: 'PlanAndApply',
    approvalsRequired: true,
  },
  {
    id: 'gl-data-science',
    provider: 'gitlab',
    name: 'GitLab – ML Infra',
    project: 'Mission Analytics',
    status: 'Pending Approval',
    lastSync: '2024-05-18T10:10:00Z',
    repositories: 3,
    enforcement: 'PlanOnly',
    approvalsRequired: true,
  },
  {
    id: 'bb-shared-services',
    provider: 'bitbucket',
    name: 'Bitbucket – Shared Services',
    project: 'Shared Services',
    status: 'Error',
    lastSync: '2024-05-17T22:02:00Z',
    repositories: 4,
    enforcement: 'PlanAndApply',
    approvalsRequired: false,
  },
];

const providerLabel: Record<ConnectorProvider, string> = {
  github: 'GitHub',
  gitlab: 'GitLab',
  bitbucket: 'Bitbucket',
  codecommit: 'CodeCommit',
};

const statusColor = (status: IaCConnector['status']): 'default' | 'primary' | 'secondary' => {
  if (status === 'Connected') {
    return 'primary';
  }
  if (status === 'Error') {
    return 'secondary';
  }
  return 'default';
};

export const IaCConnectorsAdminPage = () => {
  const classes = useStyles();
  const [connectors, setConnectors] = useState(connectorsSeed);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<IaCConnector | null>(null);

  const filtered = useMemo(() => {
    if (!search) {
      return connectors;
    }
    const value = search.toLowerCase();
    return connectors.filter(connector =>
      [connector.name, connector.project, connector.provider, connector.status]
        .map(item => item.toLowerCase())
        .some(item => item.includes(value)),
    );
  }, [connectors, search]);

  const summary = useMemo(
    () => ({
      connected: connectors.filter(connector => connector.status === 'Connected').length,
      pending: connectors.filter(connector => connector.status !== 'Connected').length,
      approvals: connectors.filter(connector => connector.approvalsRequired).length,
      repositories: connectors.reduce((acc, connector) => acc + connector.repositories, 0),
    }),
    [connectors],
  );

  return (
    <Page themeId="tool">
      <Content className={classes.root}>
        <ContentHeader title="IaC Connectors">
          <Chip label="Pulumi / Terraform / GitOps" color="secondary" variant="outlined" />
          <Button startIcon={<AddIcon />} color="primary" variant="contained" onClick={() => setDraft({
            id: 'new-connector',
            provider: 'github',
            name: '',
            project: '',
            status: 'Pending Approval',
            lastSync: new Date().toISOString(),
            repositories: 0,
            enforcement: 'PlanOnly',
            approvalsRequired: true,
          })}>
            Register connector
          </Button>
        </ContentHeader>

        <div className={classes.summaryGrid}>
          <Card className={classes.summaryCard}>
            <CardContent>
              <Typography color="textSecondary">Connected</Typography>
              <Typography variant="h4">{summary.connected}</Typography>
            </CardContent>
          </Card>
          <Card className={classes.summaryCard}>
            <CardContent>
              <Typography color="textSecondary">Pending / Error</Typography>
              <Typography variant="h4">{summary.pending}</Typography>
            </CardContent>
          </Card>
          <Card className={classes.summaryCard}>
            <CardContent>
              <Typography color="textSecondary">Approvals enforced</Typography>
              <Typography variant="h4">{summary.approvals}</Typography>
            </CardContent>
          </Card>
          <Card className={classes.summaryCard}>
            <CardContent>
              <Typography color="textSecondary">Repos tracked</Typography>
              <Typography variant="h4">{summary.repositories}</Typography>
            </CardContent>
          </Card>
        </div>

        <Paper className={classes.tablePaper}>
          <div className={classes.tableToolbar}>
            <TextField
              label="Search connectors"
              variant="outlined"
              value={search}
              onChange={event => setSearch(event.target.value)}
              fullWidth
            />
          </div>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Provider</TableCell>
                <TableCell>Project</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Repositories</TableCell>
                <TableCell>Execution mode</TableCell>
                <TableCell>Approvals</TableCell>
                <TableCell>Last sync</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map(connector => (
                <TableRow key={connector.id} hover>
                  <TableCell>
                    <Typography variant="subtitle1">{connector.name}</Typography>
                    <Typography variant="body2" color="textSecondary">
                      {connector.id}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={providerLabel[connector.provider]}
                      className={classes.providerChip}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{connector.project}</TableCell>
                  <TableCell>
                    <Chip label={connector.status} color={statusColor(connector.status)} size="small" />
                  </TableCell>
                  <TableCell>{connector.repositories}</TableCell>
                  <TableCell>
                    {connector.enforcement === 'PlanAndApply' ? 'Plan + Apply' : 'Plan only'}
                  </TableCell>
                  <TableCell>{connector.approvalsRequired ? 'Required' : 'Optional'}</TableCell>
                  <TableCell>{new Date(connector.lastSync).toLocaleString()}</TableCell>
                  <TableCell align="right">
                    <Button size="small" startIcon={<RefreshIcon />}>
                      Sync
                    </Button>
                    <Button size="small" onClick={() => setDraft(connector)}>
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      </Content>

      <Dialog open={Boolean(draft)} onClose={() => setDraft(null)} maxWidth="sm" fullWidth>
        {draft ? (
          <>
            <DialogTitle disableTypography>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <div>
                  <Typography variant="h6">
                    {draft.id === 'new-connector' ? 'Register connector' : 'Edit connector'}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Map IaC providers so Aegis can launch declarative workflows.
                  </Typography>
                </div>
                <IconButton onClick={() => setDraft(null)} aria-label="Close">
                  <CloseIcon />
                </IconButton>
              </Box>
            </DialogTitle>
            <DialogContent dividers>
              <div className={classes.modalGrid}>
                <FormControl variant="outlined">
                  <InputLabel id="iac-provider-label">Provider</InputLabel>
                  <Select
                    labelId="iac-provider-label"
                    label="Provider"
                    value={draft.provider}
                    onChange={event =>
                      setDraft(prev =>
                        prev ? { ...prev, provider: event.target.value as ConnectorProvider } : prev,
                      )
                    }
                  >
                    {(['github', 'gitlab', 'bitbucket', 'codecommit'] as ConnectorProvider[]).map(
                      provider => (
                        <MenuItem key={provider} value={provider}>
                          {providerLabel[provider]}
                        </MenuItem>
                      ),
                    )}
                  </Select>
                </FormControl>
                <TextField
                  label="Display name"
                  variant="outlined"
                  value={draft.name}
                  onChange={event =>
                    setDraft(prev => (prev ? { ...prev, name: event.target.value } : prev))
                  }
                />
                <TextField
                  label="Project"
                  variant="outlined"
                  value={draft.project}
                  onChange={event =>
                    setDraft(prev => (prev ? { ...prev, project: event.target.value } : prev))
                  }
                />
                <TextField
                  label="Installation ID / App ID"
                  variant="outlined"
                  helperText="Used by orchestrator to fetch IaC plans"
                />
                <TextField
                  label="Webhook secret"
                  variant="outlined"
                  type="password"
                />
                <FormControl variant="outlined">
                  <InputLabel id="iac-enforcement-label">Execution mode</InputLabel>
                  <Select
                    labelId="iac-enforcement-label"
                    label="Execution mode"
                    value={draft.enforcement}
                    onChange={event =>
                      setDraft(prev =>
                        prev
                          ? {
                              ...prev,
                              enforcement: event.target.value as IaCConnector['enforcement'],
                            }
                          : prev,
                      )
                    }
                  >
                    <MenuItem value="PlanOnly">Plan only</MenuItem>
                    <MenuItem value="PlanAndApply">Plan + Apply</MenuItem>
                  </Select>
                </FormControl>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Typography variant="body2">Require approval before apply</Typography>
                  <Switch
                    color="primary"
                    checked={draft.approvalsRequired}
                    onChange={event =>
                      setDraft(prev =>
                        prev ? { ...prev, approvalsRequired: event.target.checked } : prev,
                      )
                    }
                  />
                </Box>
                <TextField
                  label="Allowed repositories (glob)"
                  variant="outlined"
                  helperText="Example: mission/*-infra"
                />
              </div>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDraft(null)}>Cancel</Button>
              <Button color="primary" variant="contained" onClick={() => {
                if (draft.id === 'new-connector') {
                  setConnectors(prev => [
                    ...prev,
                    {
                      ...draft,
                      id: `${draft.provider}-${Date.now()}`,
                      status: 'Pending Approval',
                    },
                  ]);
                } else {
                  setConnectors(prev => prev.map(item => (item.id === draft.id ? draft : item)));
                }
                setDraft(null);
              }}>
                Save connector
              </Button>
            </DialogActions>
          </>
        ) : null}
      </Dialog>
    </Page>
  );
};

