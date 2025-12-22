import React, { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Page,
  Content,
  ContentHeader,
  WarningPanel,
} from '@backstage/core-components';
import {
  alertApiRef,
  discoveryApiRef,
  fetchApiRef,
  identityApiRef,
  useApi,
  useRouteRef,
} from '@backstage/core-plugin-api';
import {
  Box,
  Button,
  Grid,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { alpha } from '@material-ui/core/styles/colorManipulator';
import RefreshIcon from '@material-ui/icons/Refresh';
import {
  WorkloadDTO,
  ConnectionSession,
  createConnectionSession,
  isTerminalStatus,
  listWorkloads,
} from '../api/aegisClient';
import { keycloakAuthApiRef } from '../api/refs';
import { createWorkspaceRouteRef } from '../routes';
import { WorkloadCard, WorkloadCardSkeleton } from './WorkloadCard';

type WorkloadRow = WorkloadDTO & { displayStatus: string };

type StatusFilter = 'all' | 'active' | 'terminal';

const useStyles = makeStyles(theme => ({
  filtersCard: {
    marginTop: theme.spacing(2),
    padding: theme.spacing(2.5),
    borderRadius: theme.spacing(2),
    border: `1px solid var(--aegis-card-border)`,
    background: 'var(--aegis-card-surface)',
  },
  statsRow: {
    marginTop: theme.spacing(2),
    display: 'flex',
    gap: theme.spacing(2),
    flexWrap: 'wrap',
  },
  workloadGrid: {
    marginTop: theme.spacing(3),
  },
  emptyState: {
    marginTop: theme.spacing(3),
    padding: theme.spacing(4),
    textAlign: 'center',
    borderRadius: theme.spacing(2),
    border: `1px dashed ${alpha(theme.palette.primary.main, 0.4)}`,
    background: alpha(theme.palette.primary.main, 0.08),
  },
  lastUpdated: {
    color: theme.palette.text.secondary,
    fontSize: '0.85rem',
  },
}));

const resolveQueryParam = (search: string, key: string): string | null => {
  const params = new URLSearchParams(search);
  return params.get(key);
};

const isPollingStatus = (status?: string): boolean => {
  const normalized = status?.toUpperCase() ?? '';
  if (['RUNNING', 'FAILED', 'SUCCEEDED', 'TERMINATED', 'STOPPED'].includes(normalized)) {
    return false;
  }
  return true;
};

const buildSshCommand = (session: ConnectionSession): string => {
  const user = session.sshUser && session.sshUser.trim() !== '' ? session.sshUser : 'aegis';
  return `ssh ${user}@${session.sshHostAlias}`;
};

const buildVscodeUri = (session: ConnectionSession): string => {
  if (session.vscodeUri) {
    return session.vscodeUri;
  }
  const user = session.sshUser && session.sshUser.trim() !== '' ? session.sshUser : 'aegis';
  return `vscode://vscode-remote/ssh-remote+${user}@${session.sshHostAlias}/`;
};

const formatLastUpdated = (lastUpdatedAt: number | null, now: number): string => {
  if (!lastUpdatedAt) {
    return '—';
  }
  const seconds = Math.max(1, Math.round((now - lastUpdatedAt) / 1000));
  if (seconds < 60) {
    return `${seconds}s ago`;
  }
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
};

export const WorkloadListPage: FC = () => {
  const classes = useStyles();
  const fetchApi = useApi(fetchApiRef);
  const discoveryApi = useApi(discoveryApiRef);
  const identityApi = useApi(identityApiRef);
  const authApi = useApi(keycloakAuthApiRef);
  const alertApi = useApi(alertApiRef);
  const navigate = useNavigate();
  const location = useLocation();
  const createWorkspaceLink = useRouteRef(createWorkspaceRouteRef);
  const createWorkspacePath = createWorkspaceLink();

  const [projectId, setProjectId] = useState('p-demo');
  const [rows, setRows] = useState<WorkloadRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [shouldPoll, setShouldPoll] = useState(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [sessionCache, setSessionCache] = useState<Record<string, ConnectionSession>>({});
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());

  // Demo data for UI preview
  const demoWorkloads: WorkloadDTO[] = [
    {
      id: 'ws-pytorch-training-01',
      name: 'PyTorch Training Session',
      status: 'RUNNING',
      uiStatus: 'RUNNING',
      projectId: 'p-demo',
      clusterId: 'aegis-prod-us-east-1',
      flavor: 'gpu-large',
      image: 'ghcr.io/aegis/workspace-jupyter-pytorch:latest',
      createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      gpuType: 'NVIDIA A10G',
      workspaceType: 'jupyter',
    },
    {
      id: 'ws-data-science-02',
      name: 'Data Science Workspace',
      status: 'PROVISIONING',
      uiStatus: 'PROVISIONING',
      projectId: 'p-demo',
      clusterId: 'aegis-prod-us-east-1',
      flavor: 'gpu-standard',
      image: 'ghcr.io/aegis/workspace-vscode:latest',
      createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
      gpuType: 'NVIDIA T4',
      workspaceType: 'vscode',
    },
    {
      id: 'ws-model-inference-03',
      name: 'Model Inference Server',
      status: 'RUNNING',
      uiStatus: 'RUNNING',
      projectId: 'p-demo',
      clusterId: 'aegis-prod-us-west-2',
      flavor: 'gpu-large',
      image: 'ghcr.io/aegis/workspace-inference:latest',
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      gpuType: 'NVIDIA A10G',
      workspaceType: 'cli',
    },
    {
      id: 'ws-failed-job-04',
      name: 'Failed Training Job',
      status: 'FAILED',
      uiStatus: 'FAILED',
      projectId: 'p-demo',
      clusterId: 'aegis-prod-us-east-1',
      flavor: 'gpu-standard',
      image: 'ghcr.io/aegis/workspace-jupyter:latest',
      createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      gpuType: 'NVIDIA T4',
      workspaceType: 'jupyter',
    },
    {
      id: 'ws-completed-05',
      name: 'Completed Analysis',
      status: 'SUCCEEDED',
      uiStatus: 'SUCCEEDED',
      projectId: 'p-demo',
      clusterId: 'aegis-prod-us-east-1',
      flavor: 'cpu-large',
      image: 'ghcr.io/aegis/workspace-cli:latest',
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      workspaceType: 'cli',
    },
  ];

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent ?? false;
      try {
        if (!silent) {
          setLoading(true);
        }
        setError(null);
        // Use demo data for UI preview
        const items = demoWorkloads;
        const mapped: WorkloadRow[] = items.map(w => ({
          ...w,
          displayStatus: w.uiStatus ?? w.status ?? 'PLACED',
        }));
        setRows(mapped);
        const needsPolling = mapped.some(w => isPollingStatus(w.status));
        setShouldPoll(needsPolling);
        setLastUpdatedAt(Date.now());
      } catch (e: any) {
        const msg = e?.message ?? String(e);
        setError(msg);
        alertApi.post({
          message: `Failed to load workloads: ${msg}`,
          severity: 'error',
        });
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [alertApi, projectId],
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!shouldPoll) {
      return () => {};
    }
    const timer = setInterval(() => {
      load({ silent: true });
    }, 7000);
    return () => clearInterval(timer);
  }, [shouldPoll, load]);

  useEffect(() => {
    const projectParam = resolveQueryParam(location.search, 'project');
    if (projectParam) {
      setProjectId(projectParam);
    }
  }, [location.search]);

  useEffect(() => {
    const highlightParam = resolveQueryParam(location.search, 'highlight');
    if (!highlightParam) {
      return;
    }
    if (!rows.some(row => row.id === highlightParam)) {
      return;
    }
    const node = cardRefs.current.get(highlightParam);
    if (node) {
      node.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedId(highlightParam);
      const timer = setTimeout(() => setHighlightedId(null), 6000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [location.search, rows]);

  const handleProjectChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setProjectId(event.target.value);
  };

  const handleStatusFilter = (event: React.ChangeEvent<{ value: unknown }>) => {
    setStatusFilter(event.target.value as StatusFilter);
  };

  const filteredRows = useMemo(() => {
    return rows
      .filter(row => {
        if (!search) {
          return true;
        }
        return row.id?.toLowerCase().includes(search.toLowerCase()) ?? false;
      })
      .filter(row => {
        if (statusFilter === 'terminal') {
          return isTerminalStatus(row.status);
        }
        if (statusFilter === 'active') {
          return !isTerminalStatus(row.status);
        }
        return true;
      });
  }, [rows, search, statusFilter]);

  const handleConnect = async (workloadId: string) => {
    try {
      setConnectingId(workloadId);
      const session = await createConnectionSession(
        fetchApi,
        discoveryApi,
        identityApi,
        authApi,
        workloadId,
        'vscode',
      );
      setSessionCache(prev => ({ ...prev, [workloadId]: session }));
      window.open(buildVscodeUri(session), '_blank', 'noopener');
    } catch (e: any) {
      alertApi.post({
        message: `Failed to open VS Code session: ${e?.message ?? String(e)}`,
        severity: 'error',
      });
    } finally {
      setConnectingId(null);
    }
  };

  const ensureSession = async (
    workloadId: string,
    client: 'cli' | 'vscode',
  ): Promise<ConnectionSession | null> => {
    if (sessionCache[workloadId]) {
      return sessionCache[workloadId];
    }
    try {
      const session = await createConnectionSession(
        fetchApi,
        discoveryApi,
        identityApi,
        authApi,
        workloadId,
        client,
      );
      setSessionCache(prev => ({ ...prev, [workloadId]: session }));
      return session;
    } catch (e: any) {
      alertApi.post({
        message: `Failed to mint connection session: ${e?.message ?? String(e)}`,
        severity: 'error',
      });
      return null;
    }
  };

  const handleCopySsh = async (workloadId: string) => {
    const session = await ensureSession(workloadId, 'cli');
    if (!session) {
      return;
    }
    const command = buildSshCommand(session);
    if (!navigator.clipboard) {
      alertApi.post({
        message: 'Clipboard access is unavailable in this environment.',
        severity: 'warning',
      });
      return;
    }
    try {
      await navigator.clipboard.writeText(command);
      alertApi.post({
        message: 'SSH command copied to clipboard.',
        severity: 'success',
      });
    } catch (err: any) {
      alertApi.post({
        message: `Failed to copy SSH command: ${err?.message ?? String(err)}`,
        severity: 'error',
      });
    }
  };

  const handleOpenJupyter = (workloadId: string) => {
    const workload = rows.find(row => row.id === workloadId);
    if (!workload?.connectionInfo?.jupyterUrl) {
      return;
    }
    window.open(workload.connectionInfo.jupyterUrl, '_blank', 'noopener');
  };

  const handleOpenTerminal = (workloadId: string) => {
    const workload = rows.find(row => row.id === workloadId);
    if (!workload?.connectionInfo?.terminalUrl) {
      return;
    }
    window.open(workload.connectionInfo.terminalUrl, '_blank', 'noopener');
  };

  const activeCount = rows.filter(r => !isTerminalStatus(r.status)).length;
  const completedCount = rows.filter(r => isTerminalStatus(r.status)).length;

  return (
    <Page themeId="tool">
      <Content>
        <ContentHeader title="Workload Status">
          <Typography variant="body1" color="textSecondary">
            Monitor submitted workspaces and investigate their runtime posture.
          </Typography>
        </ContentHeader>
        <ContentHeader title="Filters">
          <Box display="flex" gridGap={12} alignItems="center" flexWrap="wrap">
            <Button
              variant="outlined"
              size="small"
              startIcon={<RefreshIcon />}
              onClick={() => load()}
            >
              Refresh
            </Button>
            <Typography className={classes.lastUpdated}>
              Last updated: {formatLastUpdated(lastUpdatedAt, now)}
            </Typography>
            <Button
              variant="contained"
              color="primary"
              component={RouterLink}
              to={createWorkspacePath}
            >
              Create New Workspace
            </Button>
          </Box>
        </ContentHeader>

        <Paper elevation={0} className={classes.filtersCard}>
          <Grid container spacing={2} alignItems="flex-end">
            <Grid item xs={12} md={4}>
              <TextField
                label="Project ID"
                fullWidth
                value={projectId}
                onChange={handleProjectChange}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label="Search by Workload ID"
                fullWidth
                value={search}
                onChange={event => setSearch(event.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <Select
                fullWidth
                value={statusFilter}
                onChange={handleStatusFilter}
                displayEmpty
                inputProps={{ 'aria-label': 'Status filter' }}
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="terminal">Terminal</MenuItem>
              </Select>
            </Grid>
          </Grid>
        </Paper>

        <Box className={classes.statsRow}>
          <Typography variant="body2">Active: {activeCount}</Typography>
          <Typography variant="body2">Completed: {completedCount}</Typography>
        </Box>

        {error && (
          <Box mt={2}>
            <WarningPanel title="Failed to load workloads" severity="error">
              {error}
              <Box mt={2}>
                <Button variant="outlined" onClick={() => load()}>
                  Retry
                </Button>
              </Box>
            </WarningPanel>
          </Box>
        )}

        {loading && rows.length === 0 ? (
          <Grid container spacing={3} className={classes.workloadGrid}>
            {Array.from({ length: 3 }).map((_, index) => (
              <Grid item xs={12} key={`skeleton-${index}`}>
                <WorkloadCardSkeleton />
              </Grid>
            ))}
          </Grid>
        ) : null}

        {!loading && !error && filteredRows.length === 0 ? (
          <Box className={classes.emptyState}>
            <Typography variant="h6">No workspaces yet</Typography>
            <Typography variant="body2" color="textSecondary">
              Launch your first GPU workspace to start training or exploration.
            </Typography>
            <Box mt={2}>
              <Button
                variant="contained"
                color="primary"
                component={RouterLink}
                to={createWorkspacePath}
              >
                Launch your first workspace
              </Button>
            </Box>
          </Box>
        ) : null}

        {!error && filteredRows.length > 0 ? (
          <Grid container spacing={3} className={classes.workloadGrid}>
            {filteredRows.map(row => (
              <Grid item xs={12} key={row.id ?? row.displayStatus}>
                <div
                  ref={node => {
                    if (row.id) {
                      cardRefs.current.set(row.id, node);
                    }
                  }}
                >
                  <WorkloadCard
                    workload={row}
                    highlighted={highlightedId === row.id}
                    connecting={connectingId === row.id}
                    onConnect={handleConnect}
                    onCopySsh={handleCopySsh}
                    onOpenJupyter={handleOpenJupyter}
                    onOpenTerminal={handleOpenTerminal}
                    onViewDetails={workloadId =>
                      navigate(`/aegis/workloads/${workloadId}`)
                    }
                  />
                </div>
              </Grid>
            ))}
          </Grid>
        ) : null}
      </Content>
    </Page>
  );
};
