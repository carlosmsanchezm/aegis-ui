import React, { FC, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Button,
  Chip,
  Collapse,
  IconButton,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { alpha } from '@material-ui/core/styles/colorManipulator';
import CodeIcon from '@material-ui/icons/Code';
import MoreVertIcon from '@material-ui/icons/MoreVert';
import StorageIcon from '@material-ui/icons/Storage';
import TerminalIcon from '@material-ui/icons/DeveloperMode';
import MemoryIcon from '@material-ui/icons/Memory';
import LaunchIcon from '@material-ui/icons/Launch';
import ErrorOutlineIcon from '@material-ui/icons/ErrorOutline';
import TimelineIcon from '@material-ui/icons/Timeline';
import { alertApiRef, useApi } from '@backstage/core-plugin-api';
import { CopyTextButton } from '@backstage/core-components';
import { WorkloadDTO, getFlavor } from '../api/aegisClient';
import {
  WorkloadStatusIndicator,
  getWorkloadStatusDescription,
  getWorkloadStatusTone,
  isRunningStatus,
} from './WorkloadStatusIndicator';

type WorkloadCardProps = {
  workload: WorkloadDTO & { displayStatus?: string };
  highlight?: boolean;
};

type WorkspaceKind = 'vscode' | 'jupyter' | 'cli';

type ConnectionInfo = {
  sshUser?: string;
  user?: string;
  sshHost?: string;
  host?: string;
  hostname?: string;
  workspacePath?: string;
  path?: string;
  vscodeUri?: string;
  jupyterUrl?: string;
  terminalUrl?: string;
};

const useStyles = makeStyles(theme => ({
  card: {
    position: 'relative',
    borderRadius: theme.shape.borderRadius * 2,
    padding: theme.spacing(3),
    background: 'var(--aegis-card-surface)',
    border: '1px solid var(--aegis-card-border)',
    boxShadow: 'var(--aegis-card-shadow)',
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    transition: 'transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease',
    overflow: 'hidden',
    scrollMarginTop: theme.spacing(12),
  },
  highlight: {
    borderColor: theme.palette.primary.main,
    boxShadow: `0 0 0 1px ${alpha(theme.palette.primary.main, 0.6)}, 0 20px 50px rgba(15, 23, 42, 0.2)`,
  },
  activeGlow: {
    '&::before': {
      content: '""',
      position: 'absolute',
      inset: 0,
      background:
        'radial-gradient(ellipse at top right, rgba(139,92,246,0.18), rgba(124,58,237,0.08) 50%, transparent 70%)',
      animation: '$pulse 3s ease-in-out infinite',
      pointerEvents: 'none',
    },
  },
  muted: {
    opacity: 0.72,
    filter: 'grayscale(0.35)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(2),
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    flexWrap: 'wrap',
  },
  title: {
    fontWeight: 600,
  },
  statusRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1.5),
    alignItems: 'center',
  },
  detailsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: theme.spacing(2),
  },
  detailItem: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  detailLabel: {
    fontSize: theme.typography.pxToRem(12),
    color: theme.palette.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  detailValue: {
    fontWeight: 600,
  },
  chip: {
    background: alpha(theme.palette.primary.main, 0.1),
    color: theme.palette.primary.main,
    fontWeight: 600,
  },
  message: {
    padding: theme.spacing(1.5),
    borderRadius: theme.shape.borderRadius,
    background: alpha(theme.palette.primary.main, 0.08),
    color: theme.palette.text.secondary,
  },
  progressTrack: {
    marginTop: theme.spacing(1),
    height: 6,
    borderRadius: 999,
    background: alpha(theme.palette.primary.main, 0.2),
    overflow: 'hidden',
  },
  progressBar: {
    width: '40%',
    height: '100%',
    borderRadius: 999,
    background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.primary.light})`,
    animation: '$progressSlide 2s linear infinite',
  },
  errorBox: {
    padding: theme.spacing(1.5),
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${alpha(theme.palette.error.main, 0.3)}`,
    background: alpha(theme.palette.error.main, 0.08),
  },
  actionRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1.5),
    alignItems: 'center',
  },
  connectButton: {
    background: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    boxShadow: `0 0 16px ${alpha(theme.palette.primary.main, 0.4)}`,
    '&:hover': {
      background: theme.palette.primary.dark,
      boxShadow: `0 0 24px ${alpha(theme.palette.primary.main, 0.5)}`,
    },
  },
  description: {
    color: theme.palette.text.secondary,
  },
  iconRound: {
    width: 44,
    height: 44,
    borderRadius: 16,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: alpha(theme.palette.primary.main, 0.15),
    color: theme.palette.primary.main,
  },
  errorToggle: {
    marginTop: theme.spacing(1),
  },
  '@keyframes pulse': {
    '0%, 100%': { opacity: 0.6 },
    '50%': { opacity: 1 },
  },
  '@keyframes progressSlide': {
    '0%': { transform: 'translateX(-100%)' },
    '100%': { transform: 'translateX(250%)' },
  },
}));

const getWorkspaceKind = (workload: WorkloadDTO): WorkspaceKind => {
  const image = workload.workspace?.image?.toLowerCase() ?? '';
  if (image.includes('jupyter')) {
    return 'jupyter';
  }
  if (image.includes('vscode') || image.includes('code')) {
    return 'vscode';
  }
  return 'cli';
};

const getWorkspaceIcon = (kind: WorkspaceKind) => {
  switch (kind) {
    case 'jupyter':
      return <StorageIcon />;
    case 'vscode':
      return <CodeIcon />;
    case 'cli':
    default:
      return <TerminalIcon />;
  }
};

const getGpuLabel = (flavor: string) => {
  const normalized = flavor.toLowerCase();
  if (normalized.includes('a10')) {
    return 'NVIDIA A10G';
  }
  if (normalized.includes('a100')) {
    return 'NVIDIA A100';
  }
  if (normalized.includes('h100')) {
    return 'NVIDIA H100';
  }
  if (normalized.includes('gpu')) {
    return 'GPU-enabled';
  }
  return 'CPU Workspace';
};

const getConnectionInfo = (workload: WorkloadDTO): ConnectionInfo => {
  const raw = (workload as { connectionInfo?: ConnectionInfo }).connectionInfo;
  return raw ?? {};
};

const formatElapsed = (value?: string): string => {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  const diff = Date.now() - date.getTime();
  const seconds = Math.max(0, Math.floor(diff / 1000));
  if (seconds < 60) {
    return `${seconds}s ago`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

export const WorkloadCard: FC<WorkloadCardProps> = ({
  workload,
  highlight = false,
}) => {
  const classes = useStyles();
  const alertApi = useApi(alertApiRef);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [showError, setShowError] = useState(false);

  const statusTone = getWorkloadStatusTone(workload.status ?? workload.uiStatus);
  const statusDescription = getWorkloadStatusDescription(
    workload.status ?? workload.uiStatus,
  );
  const isRunning = isRunningStatus(workload.status ?? workload.uiStatus);
  const isFailed = statusTone === 'failed';
  const isMuted = statusTone === 'stopping' || statusTone === 'terminated';
  const workspaceKind = getWorkspaceKind(workload);
  const flavor = getFlavor(workload) || '—';
  const connectionInfo = getConnectionInfo(workload);
  const sshUser = connectionInfo.sshUser ?? connectionInfo.user;
  const sshHost =
    connectionInfo.sshHost ?? connectionInfo.host ?? connectionInfo.hostname;
  const workspacePath =
    connectionInfo.workspacePath ?? connectionInfo.path ?? (sshUser ? `/home/${sshUser}` : undefined);
  const vscodeUri =
    connectionInfo.vscodeUri ??
    (sshUser && sshHost && workspacePath
      ? `vscode://vscode-remote/ssh-remote+${sshUser}@${sshHost}/${workspacePath.replace(
          /^\/+/,
          '',
        )}`
      : undefined);
  const sshCommand = sshUser && sshHost ? `ssh ${sshUser}@${sshHost}` : undefined;
  const jupyterUrl = connectionInfo.jupyterUrl;
  const terminalUrl = connectionInfo.terminalUrl;

  const createdAt = useMemo(() => {
    const payload = workload as { createdAt?: string; createdAtUtc?: string };
    return payload.createdAt ?? payload.createdAtUtc;
  }, [workload]);

  const handleCopySsh = async () => {
    if (!sshCommand) {
      return;
    }
    try {
      await navigator.clipboard.writeText(sshCommand);
      alertApi.post({ message: 'SSH command copied to clipboard.', severity: 'success' });
    } catch (err) {
      alertApi.post({ message: 'Unable to copy SSH command.', severity: 'error' });
    }
  };

  const actionsAvailable = Boolean(jupyterUrl || sshCommand || terminalUrl);

  return (
    <Box
      id={workload.id ? `workload-card-${workload.id}` : undefined}
      className={`${classes.card} ${
        highlight ? classes.highlight : ''
      } ${isRunning ? classes.activeGlow : ''} ${
        isMuted ? classes.muted : ''
      }`}
    >
      <Box className={classes.header}>
        <Box className={classes.titleRow}>
          <Box className={classes.iconRound}>{getWorkspaceIcon(workspaceKind)}</Box>
          <Box>
            <Typography variant="h6" className={classes.title}>
              {workload.id ?? 'Untitled workspace'}
            </Typography>
            <Typography variant="body2" className={classes.description}>
              {workload.projectId ? `Project: ${workload.projectId}` : 'Project not set'}
            </Typography>
          </Box>
        </Box>
        <Box display="flex" alignItems="center" gridGap={8}>
          {workload.id ? <CopyTextButton text={workload.id} /> : null}
          {actionsAvailable ? (
            <>
              <IconButton
                size="small"
                onClick={event => setMenuAnchor(event.currentTarget)}
                aria-label="more actions"
              >
                <MoreVertIcon fontSize="small" />
              </IconButton>
              <Menu
                anchorEl={menuAnchor}
                open={Boolean(menuAnchor)}
                onClose={() => setMenuAnchor(null)}
                keepMounted
              >
                {workspaceKind === 'jupyter' && jupyterUrl ? (
                  <MenuItem
                    onClick={() => {
                      window.open(jupyterUrl, '_blank', 'noopener');
                      setMenuAnchor(null);
                    }}
                  >
                    <LaunchIcon fontSize="small" style={{ marginRight: 8 }} />
                    Open JupyterLab
                  </MenuItem>
                ) : null}
                {sshCommand ? (
                  <MenuItem
                    onClick={() => {
                      handleCopySsh();
                      setMenuAnchor(null);
                    }}
                  >
                    <TerminalIcon fontSize="small" style={{ marginRight: 8 }} />
                    Copy SSH Command
                  </MenuItem>
                ) : null}
                {terminalUrl ? (
                  <MenuItem
                    onClick={() => {
                      window.open(terminalUrl, '_blank', 'noopener');
                      setMenuAnchor(null);
                    }}
                  >
                    <LaunchIcon fontSize="small" style={{ marginRight: 8 }} />
                    Open Terminal
                  </MenuItem>
                ) : null}
              </Menu>
            </>
          ) : null}
        </Box>
      </Box>

      <Box className={classes.statusRow}>
        <WorkloadStatusIndicator status={workload.status ?? workload.uiStatus} />
        <Chip label={flavor} className={classes.chip} />
        <Typography variant="body2" className={classes.description}>
          {statusDescription}
        </Typography>
      </Box>

      <Box className={classes.detailsGrid}>
        <Box className={classes.detailItem}>
          <MemoryIcon fontSize="small" color="action" />
          <Box>
            <Typography className={classes.detailLabel}>GPU</Typography>
            <Typography className={classes.detailValue}>{getGpuLabel(flavor)}</Typography>
          </Box>
        </Box>
        <Box className={classes.detailItem}>
          <StorageIcon fontSize="small" color="action" />
          <Box>
            <Typography className={classes.detailLabel}>Flavor</Typography>
            <Typography className={classes.detailValue}>{flavor}</Typography>
          </Box>
        </Box>
        <Box className={classes.detailItem}>
          <TerminalIcon fontSize="small" color="action" />
          <Box>
            <Typography className={classes.detailLabel}>Workspace Type</Typography>
            <Typography className={classes.detailValue}>
              {workspaceKind === 'vscode'
                ? 'VS Code'
                : workspaceKind === 'jupyter'
                ? 'JupyterLab'
                : 'CLI'}
            </Typography>
          </Box>
        </Box>
        <Box className={classes.detailItem}>
          <TimelineIcon fontSize="small" color="action" />
          <Box>
            <Typography className={classes.detailLabel}>Created</Typography>
            <Typography className={classes.detailValue}>{formatElapsed(createdAt)}</Typography>
          </Box>
        </Box>
      </Box>

      {statusTone === 'provisioning' ? (
        <Box className={classes.message}>
          <Typography variant="body2">
            Starting your GPU workspace. Provisioning typically completes in 3-6 minutes.
          </Typography>
          <Box className={classes.progressTrack}>
            <Box className={classes.progressBar} />
          </Box>
        </Box>
      ) : null}

      {isFailed && workload.message ? (
        <Box className={classes.errorBox}>
          <Box display="flex" alignItems="center" gridGap={8}>
            <ErrorOutlineIcon color="error" fontSize="small" />
            <Typography variant="subtitle2">Provisioning error</Typography>
          </Box>
          <Button
            size="small"
            color="secondary"
            className={classes.errorToggle}
            onClick={() => setShowError(prev => !prev)}
          >
            {showError ? 'Hide details' : 'View details'}
          </Button>
          <Collapse in={showError}>
            <Typography variant="body2">{workload.message}</Typography>
          </Collapse>
        </Box>
      ) : null}

      <Box className={classes.actionRow}>
        {isRunning && vscodeUri ? (
          <Tooltip title="Open VS Code locally using a secure remote SSH connection">
            <Button
              variant="contained"
              className={classes.connectButton}
              component="a"
              href={vscodeUri}
              startIcon={<LaunchIcon />}
            >
              Connect
            </Button>
          </Tooltip>
        ) : null}
        <Button
          variant="outlined"
          component={RouterLink}
          to={workload.id ? `/aegis/workloads/${workload.id}` : '#'}
          disabled={!workload.id}
        >
          Details
        </Button>
      </Box>
    </Box>
  );
};
