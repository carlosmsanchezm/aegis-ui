import {
  FC,
  useMemo,
  useState,
  MouseEvent,
} from 'react';
import {
  Box,
  Button,
  Chip,
  Collapse,
  Divider,
  IconButton,
  LinearProgress,
  Menu,
  MenuItem,
  Paper,
  Tooltip,
  Typography,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { alpha } from '@material-ui/core/styles/colorManipulator';
import CodeIcon from '@material-ui/icons/Code';
import DescriptionIcon from '@material-ui/icons/Description';
import DeveloperModeIcon from '@material-ui/icons/DeveloperMode';
import ErrorOutlineIcon from '@material-ui/icons/ErrorOutline';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import LaunchIcon from '@material-ui/icons/Launch';
import MemoryIcon from '@material-ui/icons/Memory';
import MoreVertIcon from '@material-ui/icons/MoreVert';
import TerminalIcon from '@material-ui/icons/Computer';
import FileCopyIcon from '@material-ui/icons/FileCopy';
import { WorkloadDTO, getFlavor } from '../api/aegisClient';
import { WorkloadStatusIndicator, getWorkloadStatusTone } from './WorkloadStatusIndicator';

export type WorkloadCardProps = {
  workload: WorkloadDTO & { displayStatus: string };
  highlighted?: boolean;
  connecting?: boolean;
  onConnect?: (id: string) => void;
  onOpenJupyter?: (id: string) => void;
  onCopySsh?: (id: string) => void;
  onOpenTerminal?: (id: string) => void;
  onViewDetails?: (id: string) => void;
};

type WorkspaceType = 'vscode' | 'jupyter' | 'cli';

const flavorHints: Record<string, string> = {
  'cpu-small': '2 vCPU • 4 GiB RAM',
  'cpu-medium': '4 vCPU • 16 GiB RAM',
  'cpu-large': '8 vCPU • 32 GiB RAM',
  'gpu-standard': '1× T4 • 4 vCPU • 32 GiB RAM',
  'gpu-large': '1× A10 • 8 vCPU • 64 GiB RAM',
};

const useStyles = makeStyles(theme => ({
  card: {
    position: 'relative',
    padding: theme.spacing(3),
    borderRadius: theme.spacing(2),
    border: `1px solid var(--aegis-card-border)`,
    background: 'var(--aegis-card-surface)',
    boxShadow: 'var(--aegis-card-shadow)',
    overflow: 'hidden',
    transition: 'transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease',
  },
  highlight: {
    borderColor: theme.palette.primary.main,
    boxShadow: `0 0 0 1px ${alpha(theme.palette.primary.main, 0.5)}, var(--aegis-card-shadow)`,
  },
  activeGlow: {
    '&::after': {
      content: '""',
      position: 'absolute',
      inset: 0,
      background: `radial-gradient(circle at top right, ${alpha(
        theme.palette.primary.main,
        0.16,
      )}, transparent 55%)`,
      opacity: 0.9,
      pointerEvents: 'none',
    },
  },
  inactive: {
    opacity: 0.72,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: theme.spacing(2),
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    flexWrap: 'wrap',
  },
  workspaceIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    display: 'grid',
    placeItems: 'center',
    background: alpha(theme.palette.primary.main, 0.12),
    color: theme.palette.primary.main,
  },
  metaRow: {
    display: 'flex',
    gap: theme.spacing(2),
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  metaLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  metaText: {
    color: theme.palette.text.secondary,
  },
  flavorChip: {
    background: alpha(theme.palette.primary.main, 0.12),
    color: theme.palette.primary.main,
    fontWeight: 600,
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    flexWrap: 'wrap',
  },
  connectButton: {
    boxShadow: `0 0 12px ${alpha(theme.palette.primary.main, 0.35)}`,
  },
  provisioningMessage: {
    marginTop: theme.spacing(1.5),
    color: theme.palette.text.secondary,
  },
  progressTrack: {
    marginTop: theme.spacing(1.5),
    height: 6,
    borderRadius: 999,
    backgroundColor: alpha(theme.palette.primary.main, 0.15),
    '& .MuiLinearProgress-bar': {
      borderRadius: 999,
      background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.primary.light})`,
    },
  },
  errorDetails: {
    marginTop: theme.spacing(2),
    padding: theme.spacing(1.5),
    borderRadius: theme.spacing(1.5),
    background: alpha(theme.palette.error.main, 0.08),
    border: `1px solid ${alpha(theme.palette.error.main, 0.3)}`,
  },
  errorToggle: {
    marginTop: theme.spacing(1),
    alignSelf: 'flex-start',
  },
}));

const resolveWorkspaceType = (workload: WorkloadDTO): WorkspaceType => {
  const image = workload.workspace?.image?.toLowerCase() ?? '';
  if (image.includes('jupyter') || image.includes('notebook') || image.includes('lab')) {
    return 'jupyter';
  }
  if (image.includes('code') || image.includes('vscode')) {
    return 'vscode';
  }
  return 'cli';
};

const resolveGpuLabel = (flavor?: string): string => {
  if (!flavor) {
    return 'GPU detected';
  }
  const normalized = flavor.toLowerCase();
  if (normalized.includes('a10')) {
    return 'NVIDIA A10G';
  }
  if (normalized.includes('t4')) {
    return 'NVIDIA T4';
  }
  return 'NVIDIA GPU';
};

const formatElapsed = (createdAt?: string): string => {
  if (!createdAt) {
    return '—';
  }
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) {
    return createdAt;
  }
  const seconds = Math.max(1, Math.round((Date.now() - created.getTime()) / 1000));
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

const formatEta = (etaSeconds?: number): string | null => {
  if (!etaSeconds || etaSeconds <= 0) {
    return null;
  }
  if (etaSeconds < 60) {
    return `${etaSeconds}s`;
  }
  const minutes = Math.round(etaSeconds / 60);
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.round(minutes / 60);
  return `${hours}h`;
};

export const WorkloadCard: FC<WorkloadCardProps> = ({
  workload,
  highlighted,
  connecting,
  onConnect,
  onOpenJupyter,
  onCopySsh,
  onOpenTerminal,
  onViewDetails,
}) => {
  const classes = useStyles();
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [showErrorDetails, setShowErrorDetails] = useState(false);

  const workloadType = useMemo(() => resolveWorkspaceType(workload), [workload]);
  const tone = getWorkloadStatusTone(workload.status);
  const isReady = tone === 'ready';
  const isFailed = tone === 'failed';
  const isProvisioning = tone === 'provisioning';
  const isInactive = tone === 'terminated' || tone === 'stopping';
  const flavor = getFlavor(workload) || 'custom';
  const flavorHint = flavorHints[flavor];
  const eta = formatEta(workload.etaSeconds);
  const createdLabel = formatElapsed(workload.createdAt);

  const handleMenuOpen = (event: MouseEvent<HTMLButtonElement>) => {
    setMenuAnchor(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
  };

  const handleMenuAction = (action?: (id: string) => void) => {
    if (workload.id && action) {
      action(workload.id);
    }
    setMenuAnchor(null);
  };

  const WorkspaceIcon =
    workloadType === 'jupyter'
      ? DescriptionIcon
      : workloadType === 'vscode'
        ? CodeIcon
        : DeveloperModeIcon;

  return (
    <Paper
      elevation={0}
      className={`${classes.card} ${
        highlighted ? classes.highlight : ''
      } ${isReady ? classes.activeGlow : ''} ${
        isInactive ? classes.inactive : ''
      }`}
    >
      <Box className={classes.header}>
        <Box className={classes.titleRow}>
          <Box className={classes.workspaceIcon}>
            <WorkspaceIcon />
          </Box>
          <Box>
            <Typography variant="h6">
              {workload.id ?? 'Unnamed workspace'}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Project: {workload.projectId ?? '—'}
            </Typography>
          </Box>
        </Box>
        <WorkloadStatusIndicator
          status={workload.status}
          label={workload.displayStatus}
        />
      </Box>

      <Divider style={{ margin: '16px 0' }} />

      <Box className={classes.metaRow}>
        <Box className={classes.metaLabel}>
          <MemoryIcon color="action" />
          <Typography variant="body2">GPU: {resolveGpuLabel(flavor)}</Typography>
        </Box>
        <Chip
          label={flavorHint ? `${flavor} · ${flavorHint}` : flavor}
          size="small"
          className={classes.flavorChip}
        />
        <Typography variant="body2" className={classes.metaText}>
          Created: {createdLabel}
        </Typography>
        {eta ? (
          <Typography variant="body2" className={classes.metaText}>
            ETA: {eta}
          </Typography>
        ) : null}
      </Box>

      {isProvisioning && (
        <>
          <Typography variant="body2" className={classes.provisioningMessage}>
            Starting your GPU workspace... provisioning resources and staging
            your environment.
          </Typography>
          <LinearProgress className={classes.progressTrack} />
        </>
      )}

      {isFailed && workload.message && (
        <Box display="flex" flexDirection="column" alignItems="flex-start">
          <Button
            size="small"
            startIcon={<ErrorOutlineIcon />}
            className={classes.errorToggle}
            onClick={() => setShowErrorDetails(prev => !prev)}
          >
            {showErrorDetails ? 'Hide error details' : 'View error details'}
          </Button>
          <Collapse in={showErrorDetails}>
            <Box className={classes.errorDetails}>
              <Typography variant="body2">{workload.message}</Typography>
            </Box>
          </Collapse>
        </Box>
      )}

      <Box mt={3} className={classes.actions}>
        {isReady && workload.id && onConnect ? (
          <Tooltip title="Open VS Code locally using a secure remote SSH URI">
            <span>
              <Button
                variant="contained"
                color="primary"
                className={classes.connectButton}
                onClick={() => onConnect(workload.id!)}
                disabled={connecting}
                startIcon={<LaunchIcon />}
              >
                Connect
              </Button>
            </span>
          </Tooltip>
        ) : null}
        {workload.id && onViewDetails ? (
          <Button
            variant="outlined"
            onClick={() => onViewDetails(workload.id!)}
          >
            Details
          </Button>
        ) : null}
        <Tooltip title="More actions">
          <IconButton onClick={handleMenuOpen}>
            <MoreVertIcon />
          </IconButton>
        </Tooltip>
        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={handleMenuClose}
        >
          {workloadType === 'jupyter' ? (
            <MenuItem
              onClick={() => handleMenuAction(onOpenJupyter)}
              disabled={!workload.connectionInfo?.jupyterUrl}
            >
              <LaunchIcon fontSize="small" style={{ marginRight: 8 }} />
              Open JupyterLab
            </MenuItem>
          ) : null}
          <MenuItem
            onClick={() => handleMenuAction(onCopySsh)}
            disabled={!workload.id}
          >
            <FileCopyIcon fontSize="small" style={{ marginRight: 8 }} />
            Copy SSH Command
          </MenuItem>
          <MenuItem
            onClick={() => handleMenuAction(onOpenTerminal)}
            disabled={!workload.connectionInfo?.terminalUrl}
          >
            <TerminalIcon fontSize="small" style={{ marginRight: 8 }} />
            Open Terminal
          </MenuItem>
        </Menu>
      </Box>
    </Paper>
  );
};

export const WorkloadCardSkeleton: FC = () => {
  const classes = useStyles();
  return (
    <Paper elevation={0} className={classes.card}>
      <Box className={classes.header}>
        <Box className={classes.titleRow}>
          <Box className={classes.workspaceIcon} />
          <Box>
            <Box width={180} height={18} style={{ background: 'var(--aegis-muted)', borderRadius: 8 }} />
            <Box mt={1} width={140} height={14} style={{ background: 'var(--aegis-muted)', borderRadius: 8 }} />
          </Box>
        </Box>
        <Box width={120} height={24} style={{ background: 'var(--aegis-muted)', borderRadius: 999 }} />
      </Box>
      <Divider style={{ margin: '16px 0' }} />
      <Box className={classes.metaRow}>
        <Box width={160} height={18} style={{ background: 'var(--aegis-muted)', borderRadius: 8 }} />
        <Box width={200} height={22} style={{ background: 'var(--aegis-muted)', borderRadius: 999 }} />
        <Box width={120} height={18} style={{ background: 'var(--aegis-muted)', borderRadius: 8 }} />
      </Box>
      <Box mt={3} className={classes.actions}>
        <Box width={120} height={32} style={{ background: 'var(--aegis-muted)', borderRadius: 16 }} />
        <Box width={80} height={32} style={{ background: 'var(--aegis-muted)', borderRadius: 16 }} />
      </Box>
    </Paper>
  );
};
