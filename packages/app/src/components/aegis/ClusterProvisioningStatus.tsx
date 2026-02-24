import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  makeStyles,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Button,
  Tooltip,
  CircularProgress,
} from '@material-ui/core';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import ErrorIcon from '@material-ui/icons/Error';
import RadioButtonUncheckedIcon from '@material-ui/icons/RadioButtonUnchecked';
import LaunchIcon from '@material-ui/icons/Launch';
import FileCopyIcon from '@material-ui/icons/FileCopy';
import ArrowBackIcon from '@material-ui/icons/ArrowBack';
import { useApi, fetchApiRef, discoveryApiRef, identityApiRef } from '@backstage/core-plugin-api';
import { keycloakAuthApiRef } from '../../apis';
import {
  Job,
  getClusterJobStatus,
  isTerminalStatus,
} from '../../../../../plugins/aegis/src/api/aegisClient';

// --- TYPES & MOCK DATA ---

type LogLine = {
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'debug';
  message: string;
};

type ProvisioningStep = {
  id: string;
  label: string;
  description: string;
  status: 'idle' | 'loading' | 'success' | 'error';
  duration?: string;
  logs: LogLine[];
};

const SYNTHETIC_LOGS_INFRA: LogLine[] = [
  { timestamp: '14:02:01', level: 'info', message: 'pulumi:pulumi:Stack (aegis-gpu-cluster-dev): creating' },
  { timestamp: '14:02:03', level: 'info', message: 'aws:ec2:Vpc (aegis-vpc): creating...' },
  { timestamp: '14:02:05', level: 'info', message: 'aws:ec2:Vpc (aegis-vpc): created (id: vpc-xxxxxxxxxx)' },
  { timestamp: '14:02:06', level: 'info', message: 'aws:ec2:Subnet (private-subnet-1): creating...' },
  { timestamp: '14:02:08', level: 'info', message: 'aws:ec2:Subnet (private-subnet-1): created (id: subnet-12345)' },
  { timestamp: '14:02:09', level: 'debug', message: 'aws:ec2:NatGateway: Waiting for EIP allocation...' },
];

const SYNTHETIC_LOGS_COMPUTE: LogLine[] = [
  { timestamp: '14:02:22', level: 'info', message: 'aws:eks:Cluster (aegis-ml-cluster): creating...' },
  { timestamp: '14:02:45', level: 'info', message: 'aws:eks:NodeGroup (gpu-node-group): creating...' },
  { timestamp: '14:02:46', level: 'warning', message: 'AWS: Requesting g5.4xlarge instances in us-east-1a...' },
  { timestamp: '14:03:10', level: 'info', message: 'aws:autoscaling:Group: Scaling up to 4 nodes.' },
  { timestamp: '14:03:15', level: 'info', message: '[Pulumi] Diagnostics: 4 resources created.' },
];

const SYNTHETIC_LOGS_SOFTWARE: LogLine[] = [
  { timestamp: '14:03:30', level: 'info', message: 'k8s:helm:Release (nvidia-device-plugin): installing...' },
  { timestamp: '14:03:35', level: 'info', message: 'k8s:core:Pod (nvidia-daemonset): Pulling image "nvcr.io/nvidia/k8s-device-plugin:v0.12.0"' },
  { timestamp: '14:03:42', level: 'info', message: 'k8s:helm:Release (jupyterhub): installing...' },
  { timestamp: '14:03:45', level: 'info', message: 'LoadBalancer: Waiting for external IP...' },
  { timestamp: '14:03:50', level: 'info', message: 'Endpoint available: https://hub.aegis.internal' },
];

// --- STYLES ---

const useStyles = makeStyles(theme => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    maxWidth: 1000,
    margin: '0 auto',
    paddingBottom: theme.spacing(4),
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing(1),
  },
  headerTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
  },
  statusBadge: {
    height: 8,
    width: 8,
    borderRadius: '50%',
    backgroundColor: theme.palette.status.running,
    boxShadow: `0 0 8px ${theme.palette.status.running}`,
    animation: '$pulse 2s infinite',
  },
  '@keyframes pulse': {
    '0%': { boxShadow: `0 0 0 0 ${theme.palette.status.running}66` },
    '70%': { boxShadow: `0 0 0 6px ${theme.palette.status.running}00` },
    '100%': { boxShadow: `0 0 0 0 ${theme.palette.status.running}00` },
  },
  card: {
    background: 'var(--aegis-card-surface)',
    border: '1px solid var(--aegis-card-border)',
    borderRadius: theme.shape.borderRadius,
    overflow: 'hidden',
  },
  accordion: {
    background: 'transparent',
    boxShadow: 'none',
    borderBottom: `1px solid ${theme.palette.divider}`,
    '&:before': { display: 'none' },
    '&.Mui-expanded': { margin: 0 },
  },
  accordionSummary: {
    minHeight: 56,
    '& .MuiAccordionSummary-content': {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      margin: '12px 0',
    },
  },
  stepLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
  },
  stepIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    height: 24,
  },
  // The Vercel-like Terminal
  terminal: {
    backgroundColor: '#000', // Deep black for terminal feel
    fontFamily: "'Fira Code', 'Consolas', 'Monaco', monospace",
    fontSize: '0.85rem',
    padding: theme.spacing(2),
    borderRadius: theme.shape.borderRadius,
    color: '#EDEDED',
    maxHeight: 300,
    overflowY: 'auto',
    border: `1px solid ${theme.palette.divider}`,
  },
  logLine: {
    display: 'block',
    lineHeight: 1.6,
    borderLeft: '2px solid transparent',
    paddingLeft: theme.spacing(1),
    '&:hover': {
      background: 'rgba(255,255,255,0.05)',
      borderLeft: `2px solid ${theme.palette.primary.main}`,
    },
  },
  logTimestamp: {
    color: theme.palette.text.secondary,
    marginRight: theme.spacing(2),
    userSelect: 'none',
  },
  logInfo: { color: '#A5B4FC' }, // Light Indigo
  logWarning: { color: '#FCD34D' }, // Amber
  logError: { color: '#F87171' }, // Red
  logDebug: { color: theme.palette.text.secondary },
}));

// --- SUB-COMPONENTS ---

const StatusIcon = ({ status }: { status: ProvisioningStep['status'] }) => {
  switch (status) {
    case 'loading':
      // Use a custom spinner or Material UI CircularProgress
      return (
        <div style={{
          width: 18,
          height: 18,
          border: '2px solid rgba(139, 92, 246, 0.2)',
          borderTop: '2px solid #8B5CF6',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
      );
    case 'success':
      return <CheckCircleIcon style={{ color: '#10B981', fontSize: 20 }} />;
    case 'error':
      return <ErrorIcon style={{ color: '#EF4444', fontSize: 20 }} />;
    default:
      return <RadioButtonUncheckedIcon color="disabled" style={{ fontSize: 20 }} />;
  }
};

export const ClusterProvisioningStatus = () => {
  const classes = useStyles();
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();

  // API hooks
  const fetchApi = useApi(fetchApiRef);
  const discoveryApi = useApi(discoveryApiRef);
  const identityApi = useApi(identityApiRef);
  const authApi = useApi(keycloakAuthApiRef);

  // State
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [steps, setSteps] = useState<ProvisioningStep[]>([]);
  const [expanded, setExpanded] = useState<string | false>(false);

  // Fetch job data
  useEffect(() => {
    if (!jobId) {
      setError('No job ID provided');
      setLoading(false);
      return;
    }

    const fetchJobData = async () => {
      try {
        const response = await getClusterJobStatus(
          fetchApi,
          discoveryApi,
          identityApi,
          authApi,
          jobId,
        );
        setJob(response.job);
        setError(null);
      } catch (err: any) {
        setError(err?.message || 'Failed to fetch job status');
      } finally {
        setLoading(false);
      }
    };

    fetchJobData();
  }, [jobId, fetchApi, discoveryApi, identityApi, authApi]);

  // Poll for updates
  useEffect(() => {
    if (!job || !jobId || isTerminalStatus(job.status)) {
      return;
    }

    const intervalId = setInterval(async () => {
      try {
        const response = await getClusterJobStatus(
          fetchApi,
          discoveryApi,
          identityApi,
          authApi,
          jobId,
        );
        setJob(response.job);
      } catch (err: any) {
        console.error('Failed to poll job status:', err);
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(intervalId);
  }, [job, jobId, fetchApi, discoveryApi, identityApi, authApi]);

  // Map job data to steps
  useEffect(() => {
    if (!job) {
      return;
    }

    const jobStatus = job.status?.toUpperCase();
    const progressPercent = job.progress || 0;

    // Calculate which step should be active based on progress
    const getStepStatus = (stepIndex: number, totalSteps: number): ProvisioningStep['status'] => {
      const stepProgress = (stepIndex / totalSteps) * 100;

      if (jobStatus === 'FAILED') {
        return stepProgress <= progressPercent ? 'error' : 'idle';
      }
      if (jobStatus === 'SUCCEEDED') {
        return 'success';
      }
      if (progressPercent > stepProgress + (100 / totalSteps)) {
        return 'success';
      }
      if (progressPercent >= stepProgress) {
        return 'loading';
      }
      return 'idle';
    };

    const totalSteps = 5;
    const baseSteps: ProvisioningStep[] = [
      {
        id: 'init',
        label: 'Initialization',
        description: 'Job submission & validation',
        status: getStepStatus(0, totalSteps),
        duration: progressPercent > 20 ? '2s' : undefined,
        logs: [
          { timestamp: new Date().toLocaleTimeString(), level: 'info', message: `Job ${job.id} created` },
          { timestamp: new Date().toLocaleTimeString(), level: 'info', message: 'Validating cluster configuration' },
        ]
      },
      {
        id: 'infra',
        label: 'Infrastructure Provisioning',
        description: 'VPC, Subnets, Security Groups',
        status: getStepStatus(1, totalSteps),
        duration: progressPercent > 40 ? '18s' : undefined,
        logs: progressPercent >= 20 ? SYNTHETIC_LOGS_INFRA : [],
      },
      {
        id: 'compute',
        label: 'Compute Resources',
        description: 'EKS Control Plane & Node Groups',
        status: getStepStatus(2, totalSteps),
        duration: progressPercent > 60 ? '45s' : undefined,
        logs: progressPercent >= 40 ? SYNTHETIC_LOGS_COMPUTE : [],
      },
      {
        id: 'software',
        label: 'Cluster Software',
        description: 'Add-ons and configurations',
        status: getStepStatus(3, totalSteps),
        duration: progressPercent > 80 ? '22s' : undefined,
        logs: progressPercent >= 60 ? SYNTHETIC_LOGS_SOFTWARE : [],
      },
      {
        id: 'final',
        label: 'Finalization',
        description: 'Output variables & health checks',
        status: getStepStatus(4, totalSteps),
        duration: progressPercent === 100 ? '8s' : undefined,
        logs: progressPercent >= 80 ? [
          { timestamp: new Date().toLocaleTimeString(), level: 'info', message: 'Generating kubeconfig' },
          { timestamp: new Date().toLocaleTimeString(), level: 'info', message: 'Cluster provisioning complete' },
        ] : [],
      }
    ];

    setSteps(baseSteps);

    // Auto-expand the currently running step
    const activeStep = baseSteps.find(s => s.status === 'loading');
    if (activeStep) {
      setExpanded(activeStep.id);
    }
  }, [job]);

  const handleChange = (panel: string) => (_event: React.ChangeEvent<{}>, isExpanded: boolean) => {
    setExpanded(isExpanded ? panel : false);
  };

  const getLogStyle = (level: string) => {
    switch(level) {
      case 'warning': return classes.logWarning;
      case 'error': return classes.logError;
      case 'debug': return classes.logDebug;
      default: return classes.logInfo;
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className={classes.root}>
        <Box
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          minHeight="50vh"
          style={{ gap: 16 }}
        >
          <CircularProgress size={48} />
          <Typography variant="h6" color="textSecondary">
            Loading job status...
          </Typography>
        </Box>
      </div>
    );
  }

  // Error state
  if (error || !job) {
    return (
      <div className={classes.root}>
        <Box
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          minHeight="50vh"
          style={{ gap: 24 }}
        >
          <ErrorIcon style={{ fontSize: 64, color: '#EF4444' }} />
          <Typography variant="h5" style={{ fontWeight: 600 }}>
            {error || 'Job not found'}
          </Typography>
          <Button
            variant="contained"
            color="primary"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/aegis/create/clusters')}
          >
            Back to Cluster Creation
          </Button>
        </Box>
      </div>
    );
  }

  const jobStatus = job.status?.toUpperCase();
  const isRunning = jobStatus === 'PENDING' || jobStatus === 'RUNNING';
  const isComplete = jobStatus === 'SUCCEEDED';
  const isFailed = jobStatus === 'FAILED';

  return (
    <div className={classes.root}>
      {/* Header Section */}
      <div className={classes.header}>
        <div className={classes.headerTitle}>
          <Button
            variant="text"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/aegis/create/clusters')}
            style={{ marginRight: 16 }}
          >
            Back
          </Button>
          {isRunning && <div className={classes.statusBadge} />}
          <div>
            <Typography variant="h5" style={{ fontWeight: 600 }}>
              {isRunning ? 'Provisioning Cluster' : isComplete ? 'Cluster Ready' : 'Provisioning Failed'}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Job ID: <span style={{ fontFamily: 'monospace' }}>{job.id}</span>
              {job.progress !== undefined && (
                <> • Progress: {job.progress}%</>
              )}
            </Typography>
          </div>
        </div>
        <Box display="flex" style={{ gap: 16 }}>
            <Button
              variant="outlined"
              startIcon={<FileCopyIcon />}
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
              }}
            >
                Copy Link
            </Button>
            <Button
                variant="contained"
                color="primary"
                disabled={!isComplete}
                startIcon={<LaunchIcon />}
                onClick={() => navigate('/aegis/dashboard')}
            >
                {isComplete ? 'View Cluster' : 'View Cluster (Pending)'}
            </Button>
        </Box>
      </div>

      {/* Main Card */}
      <Paper className={classes.card} elevation={0}>
        <style>{`
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        `}</style>

        {steps.map((step, index) => {
            const isLast = index === steps.length - 1;

            return (
            <Accordion
                key={step.id}
                expanded={expanded === step.id}
                onChange={handleChange(step.id)}
                className={classes.accordion}
                disabled={step.status === 'idle'}
                style={{ borderBottom: isLast ? 'none' : undefined }}
            >
                <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    className={classes.accordionSummary}
                >
                    <div className={classes.stepLabel}>
                        <div className={classes.stepIcon}>
                            <StatusIcon status={step.status} />
                        </div>
                        <Box>
                            <Typography variant="subtitle1" style={{ fontWeight: step.status === 'loading' ? 700 : 500 }}>
                                {step.label}
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                                {step.description}
                            </Typography>
                        </Box>
                    </div>
                    <Box display="flex" alignItems="center" style={{ gap: 16 }}>
                        {step.status === 'loading' && (
                             <Typography variant="caption" color="primary" style={{ fontWeight: 600 }}>
                                Building...
                             </Typography>
                        )}
                        {step.duration && (
                            <Typography variant="caption" style={{ fontFamily: 'monospace' }}>
                                {step.duration}
                            </Typography>
                        )}
                    </Box>
                </AccordionSummary>

                <AccordionDetails style={{ display: 'block', paddingTop: 0 }}>
                    {/* The "Terminal" View */}
                    <div className={classes.terminal}>
                        {step.logs.length === 0 ? (
                             <Typography variant="caption" color="textSecondary">Initializing logs...</Typography>
                        ) : (
                            step.logs.map((log, i) => (
                                <span key={i} className={classes.logLine}>
                                    <span className={classes.logTimestamp}>{log.timestamp}</span>
                                    <span className={getLogStyle(log.level)}>{log.message}</span>
                                </span>
                            ))
                        )}
                        {/* Blinking Cursor for active step */}
                        {step.status === 'loading' && (
                            <span style={{
                                display: 'inline-block',
                                width: 8,
                                height: 14,
                                background: '#8B5CF6',
                                marginLeft: 8,
                                animation: 'blink 1s step-end infinite'
                            }} />
                        )}
                        <style>{`@keyframes blink { 50% { opacity: 0; } }`}</style>
                    </div>
                </AccordionDetails>
            </Accordion>
            );
        })}
      </Paper>

      {/* Contextual Info for DevOps (Footer) */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mt={1}>
          <Box>
            <Chip
              label={`Status: ${job.status}`}
              variant="outlined"
              size="small"
              style={{
                marginRight: 8,
                backgroundColor: isComplete ? '#10B98144' : isFailed ? '#EF444444' : '#60A5FA44',
                color: isComplete ? '#10B981' : isFailed ? '#EF4444' : '#60A5FA',
                borderColor: isComplete ? '#10B981' : isFailed ? '#EF4444' : '#60A5FA',
              }}
            />
            {job.progress !== undefined && (
              <Chip
                label={`Progress: ${job.progress}%`}
                variant="outlined"
                size="small"
                style={{ marginRight: 8 }}
              />
            )}
            {job.error && (
              <Chip
                label={`Error: ${job.error}`}
                variant="outlined"
                size="small"
                style={{
                  backgroundColor: '#EF444444',
                  color: '#EF4444',
                  borderColor: '#EF4444',
                }}
              />
            )}
          </Box>
          <Box>
            <Tooltip title="Provisioned via Pulumi automation API">
              <Chip
                  label="Provider: AWS"
                  variant="outlined"
                  size="small"
                  style={{ marginRight: 8 }}
              />
            </Tooltip>
            <Chip
              label="Region: us-east-1"
              variant="outlined"
              size="small"
            />
          </Box>
      </Box>
    </div>
  );
};
