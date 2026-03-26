import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  makeStyles,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Button,
  TextField,
  Chip,
  CircularProgress,
  LinearProgress,
} from '@material-ui/core';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import ErrorIcon from '@material-ui/icons/Error';
import ScheduleIcon from '@material-ui/icons/Schedule';
import LaunchIcon from '@material-ui/icons/Launch';

// --- TYPES ---

export type LogLevel = 'info' | 'warning' | 'error' | 'debug' | 'resource-create' | 'resource-update' | 'highlight';

export interface LogEntry {
  timestamp: string;
  message: string;
  level: LogLevel;
}

export type ResourceStatus = 'pending' | 'creating' | 'ready' | 'failed';

export interface Resource {
  name: string;
  id?: string;
  status: ResourceStatus;
  details?: string;
}

export interface ProvisioningStage {
  id: string;
  label: string;
  status: ResourceStatus;
  resources: Resource[];
  duration?: string;
  totalResources: number;
  readyResources: number;
}

export interface ClusterProvisioningDetailsProps {
  clusterName: string;
  status: 'Building' | 'Ready' | 'Error' | 'Canceled';
  phase?: string;
  startedAt?: string;
  completedAt?: string;
  duration: string;
  initiatedBy: string;
  environment: string;
  region: string;
  commitHash: string;
  commitMessage: string;
  branch: string;
  k8sVersion: string;
  primaryGpuNodes: string;
  secondaryGpuNodes?: string;
  totalNodeCount: number;
  autoscaling: boolean;
  logs: LogEntry[];
  stages: ProvisioningStage[];
  progress?: number;
  jobError?: string | null;
  onViewPulumiConsole?: () => void;
  onConnectToCluster?: () => void;
}

// --- STYLES ---

const useStyles = makeStyles(theme => ({
  root: {
    backgroundColor: '#000000',
    minHeight: '100vh',
    color: '#ffffff',
    padding: theme.spacing(4),
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing(4),
    paddingBottom: theme.spacing(3),
    borderBottom: '1px solid #333333',
  },
  headerActions: {
    display: 'flex',
    gap: theme.spacing(2),
  },
  mainGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(320px, 1fr) minmax(0, 2fr)',
    gap: theme.spacing(4),
    alignItems: 'start',
    [theme.breakpoints.down('md')]: {
      gridTemplateColumns: '1fr',
    },
  },
  sidebarPanel: {
    position: 'sticky',
    top: theme.spacing(2),
    alignSelf: 'start',
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(3),
    zIndex: 1,
    [theme.breakpoints.down('md')]: {
      position: 'static',
      top: 'auto',
      zIndex: 'auto',
    },
  },
  card: {
    backgroundColor: '#111111',
    border: '1px solid #333333',
    borderRadius: theme.shape.borderRadius,
    padding: theme.spacing(3),
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
  },
  cardTitle: {
    fontSize: '1.125rem',
    fontWeight: 600,
    marginBottom: theme.spacing(2.5),
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing(2),
    fontSize: '0.875rem',
  },
  detailLabel: {
    color: '#9CA3AF',
  },
  detailValue: {
    fontWeight: 500,
    color: '#F9FAFB',
  },
  statusBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  logConsole: {
    backgroundColor: '#000000',
    fontFamily: "'Fira Code', 'Consolas', 'Monaco', monospace",
    fontSize: '0.85rem',
    padding: theme.spacing(2),
    borderRadius: theme.shape.borderRadius,
    border: '1px solid #333333',
    maxHeight: 600,
    overflowY: 'auto',
    overflowX: 'hidden',
    marginTop: theme.spacing(2),
    '&::-webkit-scrollbar': {
      width: 8,
    },
    '&::-webkit-scrollbar-track': {
      background: '#111111',
    },
    '&::-webkit-scrollbar-thumb': {
      background: '#333333',
      borderRadius: 4,
    },
  },
  logLine: {
    display: 'block',
    lineHeight: 1.6,
    paddingLeft: theme.spacing(1),
    borderLeft: '2px solid transparent',
    wordBreak: 'break-word',
    overflowWrap: 'break-word',
    whiteSpace: 'pre-wrap',
    '&:hover': {
      backgroundColor: '#1a1a1a',
      borderLeft: '2px solid #8B5CF6',
    },
  },
  logTimestamp: {
    color: '#888888',
    marginRight: theme.spacing(2),
    userSelect: 'none',
  },
  logInfo: { color: '#9CA3AF' },
  logResourceCreate: { color: '#4ADE80' },
  logResourceUpdate: { color: '#FBBF24' },
  logWarning: { color: '#FBBF24' },
  logError: { color: '#F87171' },
  logHighlight: { color: '#60A5FA' },
  logDebug: { color: '#888888' },
  accordion: {
    backgroundColor: '#111111',
    color: '#ffffff',
    borderTop: '1px solid #333333',
    boxShadow: 'none',
    '&:before': { display: 'none' },
    '&:hover': {
      backgroundColor: '#1c1c1c',
    },
  },
  accordionSummary: {
    minHeight: 56,
    '& .MuiAccordionSummary-content': {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      margin: '12px 0',
    },
  },
  accordionDetails: {
    backgroundColor: '#0a0a0a',
    display: 'block',
    padding: theme.spacing(2),
  },
  stageHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
  },
  stageInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
    color: '#9CA3AF',
    fontSize: '0.875rem',
  },
  resourceRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing(1.5),
    fontSize: '0.875rem',
    color: '#D1D5DB',
  },
  resourceId: {
    fontFamily: 'monospace',
    fontSize: '0.75rem',
    color: '#888888',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing(2),
  },
  logSearch: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
  },
  searchInput: {
    '& .MuiInputBase-root': {
      backgroundColor: '#111111',
      color: '#ffffff',
      fontSize: '0.875rem',
    },
    '& .MuiOutlinedInput-notchedOutline': {
      borderColor: '#333333',
    },
    '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
      borderColor: '#60A5FA',
    },
  },
  progressWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    minWidth: 160,
  },
  progressBar: {
    width: 140,
    backgroundColor: '#1f2937',
    '& .MuiLinearProgress-barColorPrimary': {
      backgroundColor: '#60A5FA',
    },
  },
  errorText: {
    color: '#F87171',
    fontWeight: 500,
    textAlign: 'right',
    maxWidth: '65%',
    wordBreak: 'break-word',
    overflowWrap: 'break-word',
    whiteSpace: 'pre-wrap',
  },
  logPlaceholder: {
    color: '#9CA3AF',
    display: 'block',
  },
}));

// --- COMPONENT ---

export const ClusterProvisioningDetails: React.FC<ClusterProvisioningDetailsProps> = ({
  clusterName,
  status,
  phase,
  startedAt,
  completedAt,
  duration,
  initiatedBy,
  environment,
  region,
  commitHash,
  commitMessage,
  branch,
  k8sVersion,
  primaryGpuNodes,
  secondaryGpuNodes,
  totalNodeCount,
  autoscaling,
  logs,
  stages,
  progress,
  jobError,
  onViewPulumiConsole,
  onConnectToCluster,
}) => {
  const classes = useStyles();
  const [expandedStage, setExpandedStage] = useState<string | false>('compute');
  const logConsoleRef = useRef<HTMLDivElement>(null);
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  const lastScrollTime = useRef<number>(0);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Track if user has scrolled up (away from bottom) with debouncing
  const handleScroll = () => {
    if (logConsoleRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = logConsoleRef.current;
      // Consider "at bottom" if within 100px of the bottom
      const atBottom = scrollHeight - scrollTop - clientHeight < 100;

      // Only update state if it changed to prevent re-renders
      if (atBottom && userScrolledUp) {
        setUserScrolledUp(false);
      } else if (!atBottom && !userScrolledUp) {
        setUserScrolledUp(true);
      }
    }
  };

  // Smart auto-scroll: only scroll if user hasn't scrolled up, with throttling
  useEffect(() => {
    const now = Date.now();
    // Throttle auto-scrolls to max once per 500ms to prevent jumpiness
    if (logConsoleRef.current && !userScrolledUp && now - lastScrollTime.current > 500) {
      // Clear any pending scroll
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      // Delay scroll slightly to let DOM settle
      scrollTimeoutRef.current = setTimeout(() => {
        if (logConsoleRef.current && !userScrolledUp) {
          logConsoleRef.current.scrollTop = logConsoleRef.current.scrollHeight;
          lastScrollTime.current = Date.now();
        }
      }, 100);
    }
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [logs, userScrolledUp]);

  const getLogStyle = (level: LogLevel) => {
    switch (level) {
      case 'resource-create': return classes.logResourceCreate;
      case 'resource-update': return classes.logResourceUpdate;
      case 'warning': return classes.logWarning;
      case 'error': return classes.logError;
      case 'highlight': return classes.logHighlight;
      case 'debug': return classes.logDebug;
      default: return classes.logInfo;
    }
  };

  const getStatusIcon = (status: ResourceStatus) => {
    switch (status) {
      case 'ready':
        return <CheckCircleIcon style={{ color: '#10B981', fontSize: 20 }} />;
      case 'failed':
        return <ErrorIcon style={{ color: '#EF4444', fontSize: 20 }} />;
      case 'creating':
        return <CircularProgress size={20} style={{ color: '#60A5FA' }} />;
      default:
        return <ScheduleIcon style={{ color: '#9CA3AF', fontSize: 20 }} />;
    }
  };

  const getResourceStatusColor = (status: ResourceStatus) => {
    switch (status) {
      case 'ready': return '#10B981';
      case 'failed': return '#EF4444';
      case 'creating': return '#60A5FA';
      default: return '#9CA3AF';
    }
  };

  const getResourceStatusLabel = (status: ResourceStatus) => {
    switch (status) {
      case 'ready': return 'Created';
      case 'failed': return 'Failed';
      case 'creating': return 'Provisioning...';
      default: return 'Queued';
    }
  };

  const formatTimestamp = (raw?: string): string => {
    if (!raw) {
      return '—';
    }
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      return raw;
    }
    return parsed.toISOString().replace('T', ' ').replace('Z', ' UTC');
  };

  return (
    <div className={classes.root}>
      {/* Header */}
      <div className={classes.header}>
        <div>
          <Typography variant="h4" style={{ fontWeight: 700 }}>
            Deployment Details
          </Typography>
          <Typography variant="body2" style={{ color: '#9CA3AF', marginTop: 4 }}>
            Cluster: <span style={{ fontWeight: 600, color: '#ffffff' }}>{clusterName}</span>
          </Typography>
        </div>
        <div className={classes.headerActions}>
          <Button
            variant="outlined"
            onClick={onViewPulumiConsole}
            style={{
              borderColor: '#333333',
              color: '#ffffff',
              backgroundColor: '#111111',
            }}
          >
            View Pulumi Console
          </Button>
          <span title={status !== 'Ready' ? 'Available when cluster reaches Running state' : ''}>
            <Button
              variant="contained"
              onClick={onConnectToCluster}
              disabled={status !== 'Ready'}
              style={{
                backgroundColor: status === 'Ready' ? '#ffffff' : '#333333',
                color: status === 'Ready' ? '#000000' : '#666666',
              }}
              startIcon={<LaunchIcon />}
            >
              Connect to Cluster
            </Button>
          </span>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className={classes.mainGrid}>
        {/* Sidebar - Summary and Configuration */}
        <div className={classes.sidebarPanel}>
          {/* Provisioning Summary */}
          <Paper className={classes.card} elevation={0}>
            <Typography className={classes.cardTitle}>Provisioning Summary</Typography>
            <div>
              <div className={classes.detailRow}>
                <span className={classes.detailLabel}>Status</span>
                <span className={classes.statusBadge}>
                  {status === 'Building' && (
                    <>
                      <CircularProgress size={16} style={{ color: '#60A5FA' }} />
                      <span style={{ color: '#60A5FA', fontWeight: 500 }}>In Progress</span>
                    </>
                  )}
                  {status === 'Ready' && (
                    <>
                      <CheckCircleIcon style={{ color: '#10B981', fontSize: 16 }} />
                      <span style={{ color: '#10B981', fontWeight: 500 }}>Ready</span>
                    </>
                  )}
                  {status === 'Error' && (
                    <>
                      <ErrorIcon style={{ color: '#EF4444', fontSize: 16 }} />
                      <span style={{ color: '#EF4444', fontWeight: 500 }}>Error</span>
                    </>
                  )}
                </span>
              </div>
              {phase && (
                <div className={classes.detailRow}>
                  <span className={classes.detailLabel}>Phase</span>
                  <span className={classes.detailValue}>{phase}</span>
                </div>
              )}
              <div className={classes.detailRow}>
                <span className={classes.detailLabel}>Started</span>
                <span className={classes.detailValue}>
                  {formatTimestamp(startedAt)}
                </span>
              </div>
              <div className={classes.detailRow}>
                <span className={classes.detailLabel}>Completed</span>
                <span className={classes.detailValue}>
                  {formatTimestamp(completedAt)}
                </span>
              </div>
              <div className={classes.detailRow}>
                <span className={classes.detailLabel}>Duration</span>
                <span className={classes.detailValue}>{duration}</span>
              </div>
              {typeof progress === 'number' && !Number.isNaN(progress) && (
                <div className={classes.detailRow}>
                  <span className={classes.detailLabel}>Progress</span>
                  <div className={classes.progressWrapper}>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min(100, Math.max(0, progress))}
                      className={classes.progressBar}
                    />
                    <span className={classes.detailValue}>{Math.round(progress)}%</span>
                  </div>
                </div>
              )}
              <div className={classes.detailRow}>
                <span className={classes.detailLabel}>Initiated By</span>
                <span className={classes.detailValue}>{initiatedBy}</span>
              </div>
              <div className={classes.detailRow}>
                <span className={classes.detailLabel}>Environment</span>
                <Chip
                  label={environment}
                  size="small"
                  style={{ backgroundColor: '#374151', color: '#ffffff' }}
                />
              </div>
              <div className={classes.detailRow}>
                <span className={classes.detailLabel}>Cloud/Region</span>
                <span className={classes.detailValue}>{region}</span>
              </div>
              {jobError && (
                <div className={classes.detailRow} style={{ alignItems: 'flex-start' }}>
                  <span className={classes.detailLabel}>Error</span>
                  <span className={classes.errorText}>{jobError}</span>
                </div>
              )}
              {branch && branch !== '—' && commitHash && commitHash !== '—' && (
                <Box mt={2} pt={2} style={{ borderTop: '1px solid #333333' }}>
                  <Typography variant="caption" style={{ color: '#9CA3AF', marginBottom: 8, display: 'block' }}>
                    Source
                  </Typography>
                  <Typography variant="body2" className={classes.detailValue}>
                    <Chip
                      label={branch}
                      size="small"
                      style={{
                        backgroundColor: '#374151',
                        color: '#ffffff',
                        fontFamily: 'monospace',
                        fontSize: '0.75rem',
                        marginRight: 8,
                      }}
                    />
                    @{' '}
                    <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#60A5FA' }}>
                      {commitHash}
                    </span>
                  </Typography>
                  <Typography variant="caption" style={{ color: '#D1D5DB', marginTop: 4, display: 'block' }}>
                    {commitMessage}
                  </Typography>
                </Box>
              )}
            </div>
          </Paper>

          {/* Cluster Configuration - only show when we have real data */}
          {(k8sVersion !== '—' || primaryGpuNodes !== '—' || totalNodeCount > 0) && (
            <Paper className={classes.card} elevation={0}>
              <Typography className={classes.cardTitle}>Cluster Configuration</Typography>
              <div>
                <div className={classes.detailRow}>
                  <span className={classes.detailLabel}>Kubernetes Version</span>
                  <span className={classes.detailValue}>{k8sVersion}</span>
                </div>
                <div className={classes.detailRow}>
                  <span className={classes.detailLabel}>Primary GPU Nodes</span>
                  <span className={classes.detailValue}>{primaryGpuNodes}</span>
                </div>
                {secondaryGpuNodes && secondaryGpuNodes !== '—' && (
                  <div className={classes.detailRow}>
                    <span className={classes.detailLabel}>Secondary GPU Nodes</span>
                    <span className={classes.detailValue}>{secondaryGpuNodes}</span>
                  </div>
                )}
                <div className={classes.detailRow}>
                  <span className={classes.detailLabel}>Total Node Count (Min)</span>
                  <span className={classes.detailValue}>{totalNodeCount}</span>
                </div>
                <div className={classes.detailRow}>
                  <span className={classes.detailLabel}>Autoscaling</span>
                  <span style={{ color: autoscaling ? '#10B981' : '#9CA3AF', fontWeight: 500 }}>
                    {autoscaling ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>
            </Paper>
          )}
        </div>

        {/* Main Content - Logs and Resources */}
        <div>
          {/* Provisioning Logs */}
          <Box mb={4}>
            <div className={classes.sectionHeader}>
              <Typography variant="h6" style={{ fontWeight: 600 }}>
                Provisioning Logs (Pulumi Output)
              </Typography>
              <div className={classes.logSearch}>
                <TextField
                  placeholder="Search logs (Ctrl+F)..."
                  variant="outlined"
                  size="small"
                  className={classes.searchInput}
                />
                <Typography variant="caption" style={{ color: '#6B7280' }}>
                  {logs.length} lines
                </Typography>
              </div>
            </div>
            <div className={classes.logConsole} ref={logConsoleRef} onScroll={handleScroll}>
              {logs.length === 0 ? (
                <Typography variant="caption" className={classes.logPlaceholder}>
                  Awaiting live updates from the control plane. Status and errors will appear here as they arrive.
                </Typography>
              ) : (
                logs.map((log, index) => (
                  <span key={index} className={classes.logLine}>
                    <span className={classes.logTimestamp}>{log.timestamp}</span>
                    <span className={getLogStyle(log.level)}>{log.message}</span>
                  </span>
                ))
              )}
            </div>
          </Box>

          {/* Resource Status */}
          <Box>
            <Typography variant="h6" style={{ fontWeight: 600, marginBottom: 16 }}>
              Resource Status
            </Typography>
            <Paper style={{ backgroundColor: 'transparent', border: '1px solid #333333', borderRadius: 8 }}>
              {stages.map((stage, index) => (
                <Accordion
                  key={stage.id}
                  expanded={expandedStage === stage.id}
                  onChange={(_, isExpanded) => setExpandedStage(isExpanded ? stage.id : false)}
                  className={classes.accordion}
                >
                  <AccordionSummary
                    expandIcon={<ExpandMoreIcon style={{ color: '#9CA3AF' }} />}
                    className={classes.accordionSummary}
                  >
                    <div className={classes.stageHeader}>
                      {getStatusIcon(stage.status)}
                      <Typography variant="body1" style={{ fontWeight: 500 }}>
                        {index + 1}. {stage.label}
                      </Typography>
                    </div>
                    <div className={classes.stageInfo}>
                      <span>
                        {stage.readyResources}/{stage.totalResources} {stage.status === 'ready' ? 'Ready' : 'Resources Ready'}
                      </span>
                      {stage.duration && <span>({stage.duration})</span>}
                    </div>
                  </AccordionSummary>
                  <AccordionDetails className={classes.accordionDetails}>
                    {stage.resources.map((resource, idx) => (
                      <div key={idx} className={classes.resourceRow}>
                        <span>{resource.name}</span>
                        {resource.id && <span className={classes.resourceId}>{resource.id}</span>}
                        <span style={{ color: getResourceStatusColor(resource.status) }}>
                          {getResourceStatusLabel(resource.status)}
                        </span>
                      </div>
                    ))}
                  </AccordionDetails>
                </Accordion>
              ))}
            </Paper>
          </Box>
        </div>
      </div>
    </div>
  );
};
