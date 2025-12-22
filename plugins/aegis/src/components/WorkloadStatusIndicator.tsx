import React, { FC } from 'react';
import { Box, Typography } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import ErrorOutlineIcon from '@material-ui/icons/ErrorOutline';
import PauseCircleOutlineIcon from '@material-ui/icons/PauseCircleOutline';

const useStyles = makeStyles(theme => ({
  root: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(0.5, 1.5),
    borderRadius: theme.shape.borderRadius * 2,
    fontWeight: 600,
    transition: 'transform 180ms ease, box-shadow 180ms ease, opacity 180ms ease',
  },
  label: {
    fontSize: theme.typography.pxToRem(12),
    letterSpacing: '0.02em',
    textTransform: 'uppercase',
  },
  spinner: {
    width: 14,
    height: 14,
    borderRadius: '50%',
    border: `2px solid ${theme.palette.primary.main}`,
    borderTopColor: 'transparent',
    animation: '$spin 0.9s linear infinite',
  },
  ready: {
    background: 'rgba(34, 197, 94, 0.12)',
    color: theme.palette.success.main,
    boxShadow: `0 0 12px rgba(34, 197, 94, 0.4)`,
    animation: '$pulse 3s ease-in-out infinite',
  },
  provisioning: {
    background: 'rgba(139, 92, 246, 0.16)',
    color: theme.palette.primary.main,
  },
  failed: {
    background: 'rgba(248, 113, 113, 0.16)',
    color: theme.palette.error.main,
  },
  stopping: {
    background: 'rgba(148, 163, 184, 0.18)',
    color: theme.palette.text.secondary,
  },
  terminated: {
    background: 'rgba(148, 163, 184, 0.22)',
    color: theme.palette.text.secondary,
  },
  '@keyframes spin': {
    to: { transform: 'rotate(360deg)' },
  },
  '@keyframes pulse': {
    '0%, 100%': { boxShadow: '0 0 8px rgba(34, 197, 94, 0.3)' },
    '50%': { boxShadow: '0 0 20px rgba(34, 197, 94, 0.6)' },
  },
}));

type StatusTone = 'provisioning' | 'ready' | 'failed' | 'stopping' | 'terminated';

type StatusMeta = {
  tone: StatusTone;
  label: string;
};

const getStatusMeta = (status?: string): StatusMeta => {
  const normalized = status?.toUpperCase() ?? 'UNKNOWN';
  if (normalized === 'RUNNING' || normalized === 'READY') {
    return { tone: 'ready', label: 'Ready' };
  }
  if (normalized === 'FAILED') {
    return { tone: 'failed', label: 'Failed' };
  }
  if (
    normalized === 'STOPPING' ||
    normalized === 'STOPPED' ||
    normalized === 'TERMINATING'
  ) {
    return { tone: 'stopping', label: 'Stopping' };
  }
  if (normalized === 'SUCCEEDED' || normalized === 'TERMINATED') {
    return { tone: 'terminated', label: 'Terminated' };
  }
  return { tone: 'provisioning', label: 'Provisioning' };
};

type WorkloadStatusIndicatorProps = {
  status?: string;
};

export const WorkloadStatusIndicator: FC<WorkloadStatusIndicatorProps> = ({
  status,
}) => {
  const classes = useStyles();
  const meta = getStatusMeta(status);

  const icon = (() => {
    switch (meta.tone) {
      case 'ready':
        return <CheckCircleIcon fontSize="small" />;
      case 'failed':
        return <ErrorOutlineIcon fontSize="small" />;
      case 'stopping':
      case 'terminated':
        return <PauseCircleOutlineIcon fontSize="small" />;
      case 'provisioning':
      default:
        return <span className={classes.spinner} />;
    }
  })();

  return (
    <Box className={`${classes.root} ${classes[meta.tone]}`}>
      {icon}
      <Typography variant="subtitle2" className={classes.label}>
        {meta.label}
      </Typography>
    </Box>
  );
};

export const getWorkloadStatusTone = (status?: string): StatusTone =>
  getStatusMeta(status).tone;

export const getWorkloadStatusLabel = (status?: string): string =>
  getStatusMeta(status).label;

export const getWorkloadStatusDescription = (status?: string): string => {
  const normalized = status?.toUpperCase() ?? '';
  if (normalized === 'RUNNING' || normalized === 'READY') {
    return 'Workspace is ready for connections.';
  }
  if (normalized === 'FAILED') {
    return 'Workspace provisioning failed.';
  }
  if (
    normalized === 'STOPPING' ||
    normalized === 'STOPPED' ||
    normalized === 'TERMINATING'
  ) {
    return 'Workspace is shutting down.';
  }
  if (normalized === 'SUCCEEDED' || normalized === 'TERMINATED') {
    return 'Workspace has terminated.';
  }
  return 'Starting your GPU workspace...';
};

export const isProvisioningStatus = (status?: string): boolean =>
  getStatusMeta(status).tone === 'provisioning';

export const isRunningStatus = (status?: string): boolean =>
  getStatusMeta(status).tone === 'ready';
