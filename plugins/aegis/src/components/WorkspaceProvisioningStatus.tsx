import { FC, useMemo, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Chip,
  Grid,
  LinearProgress,
  Paper,
  Typography,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import ArrowBackIcon from '@material-ui/icons/ArrowBack';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import ErrorIcon from '@material-ui/icons/Error';
import RadioButtonUncheckedIcon from '@material-ui/icons/RadioButtonUnchecked';

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

type MetricCard = {
  label: string;
  value: string;
  detail: string;
  chip?: string;
};

type WorkspaceProvisioningStatusProps = {
  workspaceId: string;
  projectName: string;
  clusterName: string;
  workspaceType: string;
  flavor: string;
  image: string;
  queue: string;
  onBackToCreate: () => void;
  onViewWorkloads: () => void;
};

const SYNTHETIC_LOGS_REQUEST: LogLine[] = [
  { timestamp: '15:10:04', level: 'info', message: 'Validating workspace request payload.' },
  { timestamp: '15:10:05', level: 'info', message: 'Assigned to queue: gpu (priority tier 2).' },
  { timestamp: '15:10:06', level: 'info', message: 'Resolving container image digest.' },
  { timestamp: '15:10:07', level: 'debug', message: 'Image digest resolved: sha256:f92c...7f2.' },
];

const SYNTHETIC_LOGS_GPU: LogLine[] = [
  { timestamp: '15:10:22', level: 'info', message: 'Scaling node group gpu-autoscale to 3 nodes.' },
  { timestamp: '15:10:30', level: 'warning', message: 'Waiting on g5.4xlarge capacity in us-east-1b.' },
  { timestamp: '15:10:37', level: 'info', message: 'Node i-07f3f2 ready with NVIDIA driver 535.129.' },
  { timestamp: '15:10:39', level: 'info', message: 'GPU devices registered: 1 x A10.' },
];

const SYNTHETIC_LOGS_WORKLOAD: LogLine[] = [
  { timestamp: '15:10:52', level: 'info', message: 'Scheduling workspace pod on node ip-10-1-42-91.' },
  { timestamp: '15:10:56', level: 'info', message: 'Pulling image ghcr.io/aegis/workspace-jupyter-pytorch:latest.' },
  { timestamp: '15:11:05', level: 'info', message: 'Mounting FSx cache and secrets volume.' },
  { timestamp: '15:11:12', level: 'info', message: 'Workspace pod is running.' },
];

const SYNTHETIC_LOGS_OBSERVABILITY: LogLine[] = [
  { timestamp: '15:11:20', level: 'info', message: 'Registering workspace telemetry stream.' },
  { timestamp: '15:11:25', level: 'info', message: 'GPU utilization exporter online (port 9400).' },
  { timestamp: '15:11:28', level: 'debug', message: 'Tracing sample rate set to 5% for warm-up.' },
  { timestamp: '15:11:32', level: 'info', message: 'Ingress endpoint created: https://ws.aegis.internal' },
];

const useStyles = makeStyles(theme => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    maxWidth: 1100,
    margin: '0 auto',
    paddingBottom: theme.spacing(4),
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing(2),
  },
  headerTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
  },
  statusBadge: {
    height: 10,
    width: 10,
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
  '@keyframes spin': {
    '0%': { transform: 'rotate(0deg)' },
    '100%': { transform: 'rotate(360deg)' },
  },
  card: {
    background: 'var(--aegis-card-surface)',
    border: '1px solid var(--aegis-card-border)',
    borderRadius: theme.shape.borderRadius,
    padding: theme.spacing(3),
  },
  summaryGrid: {
    marginTop: theme.spacing(2),
  },
  summaryItem: {
    borderRadius: theme.shape.borderRadius,
    padding: theme.spacing(2),
    background: theme.palette.type === 'dark' ? 'rgba(255,255,255,0.04)' : '#F7F8FC',
  },
  summaryLabel: {
    fontSize: '0.72rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: theme.palette.text.secondary,
  },
  summaryValue: {
    fontWeight: 600,
  },
  metricCard: {
    background: theme.palette.type === 'dark' ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    padding: theme.spacing(2),
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  },
  metricLabel: {
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: theme.palette.text.secondary,
    fontWeight: 600,
  },
  metricValue: {
    fontWeight: 600,
  },
  metricDetail: {
    color: theme.palette.text.secondary,
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
  terminal: {
    backgroundColor: '#000',
    fontFamily: "'Fira Code', 'Consolas', 'Monaco', monospace",
    fontSize: '0.85rem',
    padding: theme.spacing(2),
    borderRadius: theme.shape.borderRadius,
    color: '#EDEDED',
    maxHeight: 260,
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
  logInfo: { color: '#A5B4FC' },
  logWarning: { color: '#FCD34D' },
  logError: { color: '#F87171' },
  logDebug: { color: theme.palette.text.secondary },
  actionRow: {
    display: 'flex',
    gap: theme.spacing(2),
    flexWrap: 'wrap',
  },
}));

const StatusIcon = ({ status }: { status: ProvisioningStep['status'] }) => {
  switch (status) {
    case 'loading':
      return (
        <div
          style={{
            width: 18,
            height: 18,
            border: '2px solid rgba(139, 92, 246, 0.2)',
            borderTop: '2px solid #8B5CF6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        />
      );
    case 'success':
      return <CheckCircleIcon style={{ color: '#10B981', fontSize: 20 }} />;
    case 'error':
      return <ErrorIcon style={{ color: '#EF4444', fontSize: 20 }} />;
    default:
      return <RadioButtonUncheckedIcon color="disabled" style={{ fontSize: 20 }} />;
  }
};

export const WorkspaceProvisioningStatus: FC<WorkspaceProvisioningStatusProps> = ({
  workspaceId,
  projectName,
  clusterName,
  workspaceType,
  flavor,
  image,
  queue,
  onBackToCreate,
  onViewWorkloads,
}) => {
  const classes = useStyles();
  const [expanded, setExpanded] = useState<string | false>('request');

  const steps = useMemo<ProvisioningStep[]>(
    () => [
      {
        id: 'request',
        label: 'Request validation & queue placement',
        description: 'Confirming policy, resolving image, and reserving GPU quota.',
        status: 'success',
        duration: '18s',
        logs: SYNTHETIC_LOGS_REQUEST,
      },
      {
        id: 'gpu',
        label: 'GPU node group scale-out',
        description: 'Scaling the autoscaling node group and installing GPU drivers.',
        status: 'loading',
        duration: '2m 14s',
        logs: SYNTHETIC_LOGS_GPU,
      },
      {
        id: 'workload',
        label: 'Workspace pod scheduling',
        description: 'Pulling the image, mounting data, and starting the runtime.',
        status: 'idle',
        duration: '—',
        logs: SYNTHETIC_LOGS_WORKLOAD,
      },
      {
        id: 'observability',
        label: 'Observability & access endpoints',
        description: 'Wiring GPU telemetry, traces, and ingress endpoints.',
        status: 'idle',
        duration: '—',
        logs: SYNTHETIC_LOGS_OBSERVABILITY,
      },
    ],
    [],
  );

  const metrics = useMemo<MetricCard[]>(
    () => [
      {
        label: 'GPU allocation',
        value: '1 × NVIDIA A10',
        detail: 'Driver 535.129 • MIG disabled',
        chip: 'GPU ready',
      },
      {
        label: 'Node group scale',
        value: '2 / 4 nodes ready',
        detail: 'Target: 3 nodes • warm pool: 1',
        chip: 'Autoscaling',
      },
      {
        label: 'GPU utilization',
        value: '62%',
        detail: 'Streaming multiprocessor load',
      },
      {
        label: 'Queue position',
        value: '#2 of 6',
        detail: 'Estimated start: 3m',
      },
      {
        label: 'Storage & cache',
        value: '120 GiB attached',
        detail: 'FSx cache warm: 48%',
      },
      {
        label: 'Network fabric',
        value: '9.2 Gbps',
        detail: 'ENA + CNI IPs 18/30',
      },
    ],
    [],
  );

  const progressValue = 58;

  return (
    <div className={classes.root}>
      <Paper elevation={0} className={classes.card}>
        <div className={classes.header}>
          <div className={classes.headerTitle}>
            <div className={classes.statusBadge} />
            <div>
              <Typography variant="h5">Provisioning AI workspace</Typography>
              <Typography variant="body2" color="textSecondary">
                EKS GPU autoscaling node group • live demo telemetry
              </Typography>
            </div>
            <Chip label="Provisioning" color="primary" size="small" />
          </div>
          <div className={classes.actionRow}>
            <Button
              variant="outlined"
              color="primary"
              startIcon={<ArrowBackIcon />}
              onClick={onBackToCreate}
            >
              Create another workspace
            </Button>
            <Button variant="contained" color="primary" onClick={onViewWorkloads}>
              View workspaces
            </Button>
          </div>
        </div>
        <Box mt={2}>
          <Typography variant="body2" color="textSecondary">
            Tracking GPU capacity, autoscaling events, and container readiness while the
            workspace warms up. This preview shows the telemetry Aegis will stream once
            the workspace is live.
          </Typography>
        </Box>
        <Box mt={3}>
          <Typography variant="subtitle2" gutterBottom>
            Provisioning progress
          </Typography>
          <LinearProgress variant="determinate" value={progressValue} />
          <Box mt={1} display="flex" justifyContent="space-between">
            <Typography variant="caption" color="textSecondary">
              Stage 2 of 4 • GPU node group scaling
            </Typography>
            <Typography variant="caption" color="textSecondary">
              {progressValue}% complete
            </Typography>
          </Box>
        </Box>
        <Grid container spacing={2} className={classes.summaryGrid}>
          {[
            { label: 'Workspace ID', value: workspaceId },
            { label: 'Project', value: projectName },
            { label: 'Cluster', value: clusterName },
            { label: 'Workspace type', value: workspaceType },
            { label: 'Queue', value: queue },
            { label: 'Flavor', value: flavor },
            { label: 'Image', value: image },
          ].map(item => (
            <Grid item xs={12} sm={6} md={4} key={item.label}>
              <div className={classes.summaryItem}>
                <Typography className={classes.summaryLabel}>{item.label}</Typography>
                <Typography className={classes.summaryValue} variant="body1">
                  {item.value}
                </Typography>
              </div>
            </Grid>
          ))}
        </Grid>
      </Paper>

      <Paper elevation={0} className={classes.card}>
        <Typography variant="h6" gutterBottom>
          Provisioning telemetry
        </Typography>
        <Grid container spacing={2}>
          {metrics.map(metric => (
            <Grid item xs={12} sm={6} md={4} key={metric.label}>
              <div className={classes.metricCard}>
                <Typography className={classes.metricLabel}>{metric.label}</Typography>
                <Typography variant="h6" className={classes.metricValue}>
                  {metric.value}
                </Typography>
                <Typography variant="body2" className={classes.metricDetail}>
                  {metric.detail}
                </Typography>
                {metric.chip && <Chip label={metric.chip} size="small" color="primary" />}
              </div>
            </Grid>
          ))}
        </Grid>
      </Paper>

      <Paper elevation={0} className={classes.card}>
        <Typography variant="h6" gutterBottom>
          Provisioning timeline
        </Typography>
        {steps.map(step => (
          <Accordion
            key={step.id}
            className={classes.accordion}
            expanded={expanded === step.id}
            onChange={(_, isExpanded) => setExpanded(isExpanded ? step.id : false)}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              className={classes.accordionSummary}
            >
              <div className={classes.stepLabel}>
                <div className={classes.stepIcon}>
                  <StatusIcon status={step.status} />
                </div>
                <div>
                  <Typography variant="subtitle1">{step.label}</Typography>
                  <Typography variant="body2" color="textSecondary">
                    {step.description}
                  </Typography>
                </div>
              </div>
              <Chip
                label={step.duration ?? '—'}
                size="small"
                color={step.status === 'error' ? 'secondary' : 'default'}
              />
            </AccordionSummary>
            <AccordionDetails>
              <div className={classes.terminal}>
                {step.logs.map((log, idx) => (
                  <span key={`${step.id}-${idx}`} className={classes.logLine}>
                    <span className={classes.logTimestamp}>{log.timestamp}</span>
                    <span
                      className={
                        log.level === 'info'
                          ? classes.logInfo
                          : log.level === 'warning'
                          ? classes.logWarning
                          : log.level === 'error'
                          ? classes.logError
                          : classes.logDebug
                      }
                    >
                      {log.message}
                    </span>
                  </span>
                ))}
              </div>
            </AccordionDetails>
          </Accordion>
        ))}
      </Paper>
    </div>
  );
};
