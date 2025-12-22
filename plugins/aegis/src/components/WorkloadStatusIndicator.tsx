import { FC, useMemo } from 'react';
import { Box, Typography } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { alpha } from '@material-ui/core/styles/colorManipulator';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import ErrorOutlineIcon from '@material-ui/icons/ErrorOutline';
import PauseCircleOutlineIcon from '@material-ui/icons/PauseCircleOutline';
import ScheduleIcon from '@material-ui/icons/Schedule';
import { mapDisplayStatus } from '../api/aegisClient';

export type WorkloadStatusTone =
  | 'provisioning'
  | 'ready'
  | 'failed'
  | 'stopping'
  | 'terminated';

type Props = {
  status?: string;
  label?: string;
};

const useStyles = makeStyles(theme => ({
  root: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(0.5, 1.5),
    borderRadius: 999,
    border: `1px solid ${alpha(theme.palette.text.primary, 0.12)}`,
    background: alpha(theme.palette.background.paper, 0.8),
    transition: 'all 180ms ease',
  },
  label: {
    fontWeight: 600,
  },
  spinner: {
    width: 16,
    height: 16,
    borderRadius: '50%',
    border: `2px solid ${alpha(theme.palette.primary.main, 0.2)}`,
    borderTopColor: theme.palette.primary.main,
    animation: '$spin 1s linear infinite',
  },
  ready: {
    borderColor: alpha(theme.palette.success.main, 0.6),
    boxShadow: `0 0 12px ${alpha(theme.palette.success.main, 0.35)}`,
  },
  readyPulse: {
    animation: '$pulse 1.8s ease-in-out infinite',
  },
  failed: {
    borderColor: alpha(theme.palette.error.main, 0.65),
    background: alpha(theme.palette.error.main, 0.12),
  },
  provisioning: {
    borderColor: alpha(theme.palette.primary.main, 0.4),
    background: alpha(theme.palette.primary.main, 0.12),
  },
  stopping: {
    borderColor: alpha(theme.palette.warning.main, 0.4),
    background: alpha(theme.palette.warning.main, 0.12),
  },
  terminated: {
    borderColor: alpha(theme.palette.text.secondary, 0.4),
    background: alpha(theme.palette.text.secondary, 0.12),
  },
  '@keyframes spin': {
    from: { transform: 'rotate(0deg)' },
    to: { transform: 'rotate(360deg)' },
  },
  '@keyframes pulse': {
    '0%': {
      transform: 'scale(1)',
      boxShadow: `0 0 0 ${alpha(theme.palette.success.main, 0.3)}`,
    },
    '50%': {
      transform: 'scale(1.02)',
      boxShadow: `0 0 16px ${alpha(theme.palette.success.main, 0.45)}`,
    },
    '100%': {
      transform: 'scale(1)',
      boxShadow: `0 0 0 ${alpha(theme.palette.success.main, 0.3)}`,
    },
  },
}));

const resolveTone = (status?: string): WorkloadStatusTone => {
  const normalized = status?.toUpperCase() ?? '';
  if (['RUNNING', 'READY'].includes(normalized)) {
    return 'ready';
  }
  if (['FAILED', 'ERROR'].includes(normalized)) {
    return 'failed';
  }
  if (['STOPPING', 'TERMINATING'].includes(normalized)) {
    return 'stopping';
  }
  if (['TERMINATED', 'STOPPED', 'SUCCEEDED'].includes(normalized)) {
    return 'terminated';
  }
  return 'provisioning';
};

const resolveIcon = (tone: WorkloadStatusTone) => {
  switch (tone) {
    case 'ready':
      return <CheckCircleIcon fontSize="small" />;
    case 'failed':
      return <ErrorOutlineIcon fontSize="small" />;
    case 'stopping':
    case 'terminated':
      return <PauseCircleOutlineIcon fontSize="small" />;
    case 'provisioning':
    default:
      return <ScheduleIcon fontSize="small" />;
  }
};

export const WorkloadStatusIndicator: FC<Props> = ({ status, label }) => {
  const classes = useStyles();
  const tone = useMemo(() => resolveTone(status), [status]);
  const displayLabel =
    label || mapDisplayStatus(status).label || status || 'Pending';

  return (
    <Box
      className={`${classes.root} ${classes[tone]} ${
        tone === 'ready' ? classes.readyPulse : ''
      }`}
    >
      {tone === 'provisioning' ? (
        <span className={classes.spinner} />
      ) : (
        resolveIcon(tone)
      )}
      <Typography variant="caption" className={classes.label}>
        {displayLabel}
      </Typography>
    </Box>
  );
};

export const getWorkloadStatusTone = (status?: string): WorkloadStatusTone =>
  resolveTone(status);
