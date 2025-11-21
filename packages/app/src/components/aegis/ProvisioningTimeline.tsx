import React, { useState, useEffect, useRef } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Card,
  Chip,
  Divider,
  Link,
  Paper,
  Typography,
  makeStyles,
  useTheme,
} from '@material-ui/core';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import ErrorIcon from '@material-ui/icons/Error';
import PlayCircleOutlineIcon from '@material-ui/icons/PlayCircleOutline';
import ScheduleIcon from '@material-ui/icons/Schedule';
import GitHubIcon from '@material-ui/icons/GitHub';
import CallSplitIcon from '@material-ui/icons/CallSplit';
import ReceiptIcon from '@material-ui/icons/Receipt';
import DnsIcon from '@material-ui/icons/Dns';
import HourglassEmptyIcon from '@material-ui/icons/HourglassEmpty';

import { PULUMI_PREVIEW_LOGS, PULUMI_UP_LOGS, AWS_CLI_LOGS, HEALTH_CHECKS } from './mockData';

const useStyles = makeStyles(theme => ({
  root: {
    display: 'grid',
    gridTemplateColumns: '280px 1fr',
    gap: theme.spacing(3),
    alignItems: 'start',
    marginTop: theme.spacing(4),
  },
  sidebar: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    position: 'sticky',
    top: theme.spacing(2),
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  },
  statusCard: {
    padding: theme.spacing(2),
    border: `1px solid ${theme.palette.divider}`,
  },
  statusRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(1),
  },
  metaRow: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: theme.spacing(1),
  },
  accordion: {
    background: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    '&:before': {
      display: 'none',
    },
    '&$expanded': {
      margin: 0,
    },
  },
  expanded: {},
  summaryContent: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
    width: '100%',
  },
  logContainer: {
    background: theme.palette.type === 'dark' ? '#0d1117' : '#1a1b26',
    color: '#e6edf3',
    padding: theme.spacing(2),
    borderRadius: theme.shape.borderRadius,
    fontFamily: 'SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace',
    fontSize: '0.85rem',
    overflowX: 'auto',
    maxHeight: '400px',
    whiteSpace: 'pre',
    width: '100%',
  },
  logLine: {
    lineHeight: 1.5,
    minHeight: '1.5em',
  },
  checkGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
    gap: theme.spacing(2),
  },
  checkCard: {
    padding: theme.spacing(2),
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    border: `1px solid ${theme.palette.divider}`,
  },
  pulse: {
    animation: '$pulse 2s infinite',
  },
  '@keyframes pulse': {
    '0%': {
      opacity: 1,
    },
    '50%': {
      opacity: 0.5,
    },
    '100%': {
      opacity: 1,
    },
  },
}));

interface LogViewerProps {
  logs: string[];
  isRunning: boolean;
  speed?: number;
}

const LogViewer: React.FC<LogViewerProps> = ({ logs, isRunning, speed = 100 }) => {
  const classes = useStyles();
  const [visibleLines, setVisibleLines] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isRunning) {
      setVisibleLines(logs);
      return;
    }

    setVisibleLines([]);
    let currentIndex = 0;
    const interval = setInterval(() => {
      if (currentIndex >= logs.length) {
        clearInterval(interval);
        return;
      }
      setVisibleLines(prev => [...prev, logs[currentIndex]]);
      currentIndex++;
      if (bottomRef.current) {
        bottomRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }, speed);

    return () => clearInterval(interval);
  }, [isRunning, logs, speed]);

  return (
    <div className={classes.logContainer}>
      {visibleLines.map((line, i) => (
        <div key={i} className={classes.logLine}>
          {line}
        </div>
      ))}
      {isRunning && visibleLines.length < logs.length && (
        <div className={classes.logLine}>
          <span className={classes.pulse}>_</span>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
};

interface ProvisioningTimelineProps {
  status: 'pending' | 'running' | 'succeeded' | 'failed';
  jobId?: string;
  clusterName: string;
  gitInfo?: {
    repo: string;
    branch: string;
    commit?: string;
  };
  duration?: string;
}

export const ProvisioningTimeline: React.FC<ProvisioningTimelineProps> = ({
  status,
  jobId,
  clusterName,
  gitInfo = {
    repo: 'aegis/mission-iac',
    branch: 'feature/atlas-gpu',
    commit: '8f3a2b1'
  },
  duration = '2m 30s'
}) => {
  const classes = useStyles();
  const theme = useTheme();

  // Simulation states
  const [pulumiState, setPulumiState] = useState<'pending' | 'running' | 'done'>('pending');
  const [awsState, setAwsState] = useState<'pending' | 'running' | 'done'>('pending');
  const [checkState, setCheckState] = useState<'pending' | 'running' | 'done'>('pending');

  useEffect(() => {
    if (status === 'running') {
      // Start sequence
      setPulumiState('running');

      const t1 = setTimeout(() => {
        setPulumiState('done');
        setAwsState('running');
      }, 4000); // Shortened for demo

      const t2 = setTimeout(() => {
        setAwsState('done');
        setCheckState('running');
      }, 7000);

      const t3 = setTimeout(() => {
        setCheckState('done');
      }, 9000);

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    } else if (status === 'succeeded') {
      setPulumiState('done');
      setAwsState('done');
      setCheckState('done');
    } else {
      setPulumiState('pending');
      setAwsState('pending');
      setCheckState('pending');
    }
    return undefined;
  }, [status]);

  const getStatusIcon = (state: 'pending' | 'running' | 'done' | 'failed') => {
    switch (state) {
      case 'running': return <HourglassEmptyIcon className={classes.pulse} style={{ color: theme.palette.info.main }} />;
      case 'done': return <CheckCircleIcon style={{ color: theme.palette.success.main }} />;
      case 'failed': return <ErrorIcon color="error" />;
      default: return <PlayCircleOutlineIcon color="disabled" />;
    }
  };

  const getStatusColor = (state: 'pending' | 'running' | 'done' | 'failed') => {
    switch (state) {
      case 'running': return theme.palette.info.main;
      case 'done': return theme.palette.success.main;
      case 'failed': return theme.palette.error.main;
      default: return theme.palette.text.secondary;
    }
  };

  return (
    <div className={classes.root}>
      {/* Sidebar */}
      <div className={classes.sidebar}>
        <Paper className={classes.statusCard}>
          <Typography variant="subtitle2" color="textSecondary" gutterBottom>
            STATUS
          </Typography>
          <div className={classes.statusRow}>
            {status === 'running' ? (
              <HourglassEmptyIcon className={classes.pulse} color="primary" />
            ) : status === 'succeeded' ? (
              <CheckCircleIcon style={{ color: theme.palette.success.main }} />
            ) : (
              <PlayCircleOutlineIcon color="disabled" />
            )}
            <Typography variant="h6" style={{ textTransform: 'capitalize' }}>
              {status === 'succeeded' ? 'Ready' : status === 'running' ? 'Building' : status}
            </Typography>
          </div>
          {status === 'succeeded' && (
             <Typography variant="body2" style={{ color: theme.palette.success.main }}>
               The cluster is live and reachable.
             </Typography>
          )}
          {status === 'running' && (
             <Typography variant="body2" color="textSecondary">
               Provisioning resources...
             </Typography>
          )}
        </Paper>

        <Paper className={classes.statusCard}>
          <div className={classes.metaRow}>
            <Typography variant="body2" color="textSecondary">Duration</Typography>
            <Typography variant="body2">{status === 'pending' ? '--' : duration}</Typography>
          </div>
          <div className={classes.metaRow}>
            <Typography variant="body2" color="textSecondary">Created</Typography>
            <Typography variant="body2">Just now</Typography>
          </div>
          <Divider style={{ margin: '12px 0' }} />
          <Typography variant="subtitle2" color="textSecondary" gutterBottom>
            SOURCE
          </Typography>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <GitHubIcon fontSize="small" />
            <Typography variant="body2" style={{ fontFamily: 'monospace' }}>{gitInfo.repo}</Typography>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 2 }}>
            <CallSplitIcon fontSize="small" style={{ transform: 'scale(0.8)' }} />
            <Typography variant="body2" style={{ fontFamily: 'monospace' }}>{gitInfo.branch}</Typography>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 2, marginTop: 4 }}>
             <Chip size="small" label={gitInfo.commit} variant="outlined" style={{ fontFamily: 'monospace', height: 20 }} />
          </div>
        </Paper>
      </div>

      {/* Main Content */}
      <div className={classes.content}>
        {/* Step 1: Pulumi */}
        <Accordion
          classes={{ root: classes.accordion, expanded: classes.expanded }}
          defaultExpanded={status !== 'pending'}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <div className={classes.summaryContent}>
              {getStatusIcon(pulumiState)}
              <Typography variant="subtitle1">Infrastructure Provisioning</Typography>
              <Chip label="Pulumi" size="small" variant="outlined" />
              <Box flexGrow={1} />
              <Typography variant="caption" color="textSecondary">
                 {pulumiState === 'running' ? 'Running...' : pulumiState === 'done' ? '10s' : ''}
              </Typography>
            </div>
          </AccordionSummary>
          <AccordionDetails>
            <LogViewer
              logs={[...PULUMI_PREVIEW_LOGS, ...PULUMI_UP_LOGS]}
              isRunning={pulumiState === 'running'}
              speed={50}
            />
          </AccordionDetails>
        </Accordion>

        {/* Step 2: AWS CLI */}
        <Accordion
          classes={{ root: classes.accordion, expanded: classes.expanded }}
          defaultExpanded={awsState === 'running' || awsState === 'done'}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <div className={classes.summaryContent}>
              {getStatusIcon(awsState)}
              <Typography variant="subtitle1">Cluster Configuration</Typography>
              <Chip label="AWS CLI" size="small" variant="outlined" />
              <Box flexGrow={1} />
              <Typography variant="caption" color="textSecondary">
                 {awsState === 'running' ? 'Running...' : awsState === 'done' ? '5s' : ''}
              </Typography>
            </div>
          </AccordionSummary>
          <AccordionDetails>
             <LogViewer
              logs={AWS_CLI_LOGS}
              isRunning={awsState === 'running'}
              speed={80}
            />
          </AccordionDetails>
        </Accordion>

        {/* Step 3: Checks */}
        <Accordion
          classes={{ root: classes.accordion, expanded: classes.expanded }}
          defaultExpanded={checkState === 'done'}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <div className={classes.summaryContent}>
              {getStatusIcon(checkState)}
              <Typography variant="subtitle1">Health Checks</Typography>
              <Box flexGrow={1} />
              {checkState === 'done' && <Chip label="4/4 Passed" size="small" style={{ background: theme.palette.success.main, color: '#fff' }} />}
            </div>
          </AccordionSummary>
          <AccordionDetails>
            <Box width="100%">
               <div className={classes.checkGrid}>
                 {HEALTH_CHECKS.map(check => (
                   <Paper key={check.id} className={classes.checkCard} variant="outlined">
                     <CheckCircleIcon style={{ color: checkState === 'done' ? theme.palette.success.main : theme.palette.action.disabled }} />
                     <Box>
                       <Typography variant="subtitle2">{check.label}</Typography>
                       <Typography variant="caption" color="textSecondary">{check.detail}</Typography>
                     </Box>
                   </Paper>
                 ))}
               </div>
            </Box>
          </AccordionDetails>
        </Accordion>
      </div>
    </div>
  );
};
