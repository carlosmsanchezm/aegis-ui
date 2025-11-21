import React, { useState, useEffect } from 'react';
import {
  makeStyles,
  Typography,
  Box,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  IconButton,
  Tooltip,
} from '@material-ui/core';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import CheckCircleOutlineIcon from '@material-ui/icons/CheckCircleOutline';
import ErrorOutlineIcon from '@material-ui/icons/ErrorOutline';
import RadioButtonUncheckedIcon from '@material-ui/icons/RadioButtonUnchecked';
import LoopIcon from '@material-ui/icons/Loop';
import FileCopyOutlinedIcon from '@material-ui/icons/FileCopyOutlined';

// --- Types for the Deployment Timeline ---

export type LogLevel = 'info' | 'warning' | 'error' | 'debug';

export interface LogEntry {
  timestamp: number;
  message: string;
  level?: LogLevel;
}

export type StepStatus = 'pending' | 'running' | 'success' | 'failed' | 'canceled';

export interface DeploymentStep {
  id: string;
  label: string;
  status: StepStatus;
  duration?: string;
  logs: LogEntry[];
  subSteps?: DeploymentStep[]; // For nested steps if needed
}

export interface DeploymentTimelineProps {
  steps: DeploymentStep[];
  totalDuration?: string;
  status: 'Ready' | 'Building' | 'Error' | 'Canceled';
}

// --- Styles ---

const useStyles = makeStyles(theme => ({
  root: {
    fontFamily: theme.typography.fontFamily,
    color: theme.palette.text.primary,
    marginTop: theme.spacing(2),
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing(2),
  },
  stepContainer: {
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    marginBottom: -1, // Overlap borders
    '&:first-child': {
      borderTopLeftRadius: theme.shape.borderRadius,
      borderTopRightRadius: theme.shape.borderRadius,
    },
    '&:last-child': {
      borderBottomLeftRadius: theme.shape.borderRadius,
      borderBottomRightRadius: theme.shape.borderRadius,
      marginBottom: 0,
    },
    backgroundColor: theme.palette.background.paper,
    overflow: 'hidden',
  },
  accordionSummary: {
    minHeight: 48,
    padding: theme.spacing(0, 2),
    '&.Mui-expanded': {
      minHeight: 48,
      borderBottom: `1px solid ${theme.palette.divider}`,
    },
    '& .MuiAccordionSummary-content': {
      margin: '10px 0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
    },
  },
  accordionDetails: {
    padding: 0,
    flexDirection: 'column',
    backgroundColor: '#000000', // Terminal background
    color: '#fff',
    fontFamily: 'Menlo, Monaco, Lucida Console, "Courier New", monospace',
    fontSize: '0.85rem',
    maxHeight: 400,
    overflowY: 'auto',
  },
  logLine: {
    padding: '2px 16px',
    display: 'flex',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    '&:hover': {
      backgroundColor: 'rgba(255,255,255,0.05)',
    },
  },
  logTimestamp: {
    color: '#666',
    marginRight: theme.spacing(2),
    minWidth: 80,
    userSelect: 'none',
  },
  logMessage: {
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    flexGrow: 1,
  },
  statusIcon: {
    marginRight: theme.spacing(1.5),
    display: 'flex',
  },
  stepLabel: {
    fontWeight: 500,
    flexGrow: 1,
  },
  stepDuration: {
    color: theme.palette.text.secondary,
    marginRight: theme.spacing(2),
    fontSize: '0.85rem',
  },
  terminalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing(1, 2),
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.02)',
    color: theme.palette.text.secondary,
    fontSize: '0.75rem',
  },
  copyButton: {
    padding: 4,
    color: theme.palette.text.secondary,
  },
  rotateIcon: {
    animation: '$spin 2s linear infinite',
  },
  '@keyframes spin': {
    '0%': {
      transform: 'rotate(0deg)',
    },
    '100%': {
      transform: 'rotate(360deg)',
    },
  },
}));

// --- Helper Components ---

const StatusIcon = ({ status, className }: { status: StepStatus; className?: string }) => {
  const classes = useStyles();
  switch (status) {
    case 'success':
      return <CheckCircleOutlineIcon className={className} style={{ color: '#0070f3' }} />; // Vercel Blue
    case 'failed':
      return <ErrorOutlineIcon className={className} style={{ color: '#e00' }} />;
    case 'running':
      return <LoopIcon className={`${className} ${classes.rotateIcon}`} style={{ color: '#0070f3' }} />;
    case 'pending':
    default:
      return <RadioButtonUncheckedIcon className={className} style={{ color: '#666' }} />;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'Ready': return '#0070f3';
    case 'Error': return '#e00';
    case 'Building': return '#f5a623';
    default: return undefined;
  }
};

const getLogColor = (level?: LogLevel) => {
  switch (level) {
    case 'error': return '#ff4d4f';
    case 'warning': return '#faad14';
    default: return 'inherit';
  }
};

// --- Main Component ---

export const DeploymentTimeline: React.FC<DeploymentTimelineProps> = ({ steps, totalDuration, status }) => {
  const classes = useStyles();
  const [expanded, setExpanded] = useState<string | false>(false);

  // Auto-expand the running step or the first failed step
  useEffect(() => {
    const runningStep = steps.find(s => s.status === 'running');
    if (runningStep) {
      setExpanded(runningStep.id);
      return;
    }
    const failedStep = steps.find(s => s.status === 'failed');
    if (failedStep) {
      setExpanded(failedStep.id);
    }
  }, [steps]);

  const handleExpand = (panel: string) => (_event: React.ChangeEvent<{}>, isExpanded: boolean) => {
    setExpanded(isExpanded ? panel : false);
  };

  return (
    <div className={classes.root}>
      <div className={classes.header}>
        <Typography variant="h6">Deployment Summary</Typography>
        <Box display="flex" alignItems="center" gap={1}>
             {totalDuration && <Chip label={totalDuration} variant="outlined" size="small" />}
            <Chip
                label={status}
                style={{
                    backgroundColor: getStatusColor(status),
                    color: '#fff'
                }}
                size="small"
            />
        </Box>
      </div>

      <div>
        {steps.map((step) => (
          <Accordion
            key={step.id}
            className={classes.stepContainer}
            expanded={expanded === step.id}
            onChange={handleExpand(step.id)}
            disabled={step.status === 'pending'}
            TransitionProps={{ unmountOnExit: true }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              aria-controls={`${step.id}-content`}
              id={`${step.id}-header`}
              className={classes.accordionSummary}
            >
              <Box display="flex" alignItems="center" width="100%">
                <StatusIcon status={step.status} className={classes.statusIcon} />
                <Typography className={classes.stepLabel}>{step.label}</Typography>
                {step.duration && (
                  <Typography className={classes.stepDuration}>{step.duration}</Typography>
                )}
              </Box>
            </AccordionSummary>
            <AccordionDetails className={classes.accordionDetails}>
              {step.logs.length > 0 ? (
                  <>
                    <div className={classes.terminalHeader}>
                        <span>Output</span>
                        <Tooltip title="Copy logs">
                            <IconButton size="small" className={classes.copyButton} onClick={(e) => {
                                e.stopPropagation();
                                const logText = step.logs.map(l => l.message).join('\n');
                                navigator.clipboard.writeText(logText);
                            }}>
                                <FileCopyOutlinedIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    </div>
                    {step.logs.map((log, index) => (
                        <div key={index} className={classes.logLine}>
                        <span className={classes.logTimestamp}>
                            {new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                        <span
                            className={classes.logMessage}
                            style={{ color: getLogColor(log.level) }}
                        >
                            {log.message}
                        </span>
                        </div>
                    ))}
                  </>
              ) : (
                  <Box p={2} display="flex" alignItems="center" justifyContent="center" color="rgba(255,255,255,0.5)">
                      <Typography variant="body2">No logs available</Typography>
                  </Box>
              )}
            </AccordionDetails>
          </Accordion>
        ))}
      </div>
    </div>
  );
};
