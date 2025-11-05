import React, {
  ComponentType,
  FC,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Page,
  Content,
  ContentHeader,
  Progress,
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
  Card,
  CardContent,
  Divider,
  Grid,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  MenuItem,
  TextField,
  Typography,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { SvgIconProps } from '@material-ui/core/SvgIcon';
import Alert from '@material-ui/lab/Alert';
import AlertTitle from '@material-ui/lab/AlertTitle';
import AccountTreeIcon from '@material-ui/icons/AccountTree';
import AssessmentIcon from '@material-ui/icons/Assessment';
import BuildIcon from '@material-ui/icons/Build';
import CheckCircleOutlineIcon from '@material-ui/icons/CheckCircleOutline';
import CloudQueueIcon from '@material-ui/icons/CloudQueue';
import ErrorOutlineIcon from '@material-ui/icons/ErrorOutline';
import HourglassEmptyIcon from '@material-ui/icons/HourglassEmpty';
import PlaylistAddCheckIcon from '@material-ui/icons/PlaylistAddCheck';
import TimelineIcon from '@material-ui/icons/Timeline';
import { Link as RouterLink } from 'react-router-dom';
import {
  AuthenticationError,
  AuthorizationError,
  createCluster,
  getClusterJobStatus,
} from '../api/aegisClient';
import { keycloakAuthApiRef } from '../api/refs';
import {
  launchWorkspaceRouteRef,
  projectManagementRouteRef,
} from '../routes';

const useStyles = makeStyles(theme => ({
  pageSubtitle: {
    maxWidth: 720,
  },
  formCard: {
    height: '100%',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    marginTop: theme.spacing(2),
  },
  actionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
  },
  awsOnlyAlert: {
    marginTop: theme.spacing(2),
  },
  jobCard: {
    height: '100%',
  },
  statusHeader: {
    marginTop: theme.spacing(1),
  },
  statusHelper: {
    marginTop: theme.spacing(1),
  },
  statusMetadata: {
    marginTop: theme.spacing(0.5),
    color: theme.palette.text.secondary,
  },
  progressSection: {
    marginTop: theme.spacing(2),
  },
  progressLabel: {
    marginTop: theme.spacing(1),
  },
  jobHistory: {
    marginTop: theme.spacing(3),
  },
  historyList: {
    maxHeight: theme.spacing(24),
    overflowY: 'auto',
    marginTop: theme.spacing(1),
  },
  historyIcon: {
    minWidth: theme.spacing(4),
    color: theme.palette.primary.main,
  },
  checklistCard: {
    marginTop: theme.spacing(3),
  },
  stepIcon: {
    minWidth: theme.spacing(4),
    color: theme.palette.primary.main,
  },
  ctaRow: {
    marginTop: theme.spacing(2),
    display: 'flex',
    flexWrap: 'wrap',
    '& > *': {
      marginRight: theme.spacing(1.5),
      marginBottom: theme.spacing(1),
    },
    '& > *:last-child': {
      marginRight: 0,
    },
  },
  listDivider: {
    margin: theme.spacing(2, 0),
  },
}));

const JOB_STORAGE_KEY = 'aegis.clusterJobState';
const POLL_INTERVAL_MS = 5000;

const awsRegions: { value: string; label: string }[] = [
  { value: 'us-east-1', label: 'US East (N. Virginia)' },
  { value: 'us-west-2', label: 'US West (Oregon)' },
  { value: 'us-east-2', label: 'US East (Ohio)' },
  { value: 'us-gov-west-1', label: 'AWS GovCloud (US-West)' },
];

const statusDetails: Record<string, { label: string; helper?: string }> = {
  SUBMITTED: {
    label: 'Provisioning request submitted',
    helper: 'ÆGIS control plane accepted the cluster request.',
  },
  RESUMING: {
    label: 'Resuming provisioning job',
    helper: 'Restoring progress from a previous session.',
  },
  PENDING: {
    label: 'Pending infrastructure allocation',
    helper: 'Queued for Pulumi to begin creating resources.',
  },
  PROVISIONING: {
    label: 'Provisioning AWS infrastructure',
    helper: 'Pulumi is creating VPC, subnets, and core services.',
  },
  CONFIGURING_NETWORK: {
    label: 'Configuring networking and IAM',
    helper: 'Applying VPC routing, security groups, and IAM roles.',
  },
  APPLYING_PULUMI_STACK: {
    label: 'Applying IaC stack',
    helper: 'ÆGIS is applying the latest stack definition.',
  },
  BOOTSTRAPPING: {
    label: 'Bootstrapping control plane services',
  },
  SUCCEEDED: {
    label: 'Provisioning succeeded',
    helper: 'Cluster capacity is ready for workloads.',
  },
  SUCCESS: {
    label: 'Provisioning succeeded',
    helper: 'Cluster capacity is ready for workloads.',
  },
  COMPLETED: {
    label: 'Provisioning completed',
  },
  FAILED: {
    label: 'Provisioning failed',
    helper: 'Review the error details and adjust inputs.',
  },
  CANCELED: {
    label: 'Provisioning canceled',
  },
  CANCELLED: {
    label: 'Provisioning canceled',
  },
};

const normalizeStatus = (status?: string | null): string => {
  if (!status) {
    return 'UNKNOWN';
  }
  return status.toUpperCase();
};

const isTerminalStatus = (status?: string | null): boolean => {
  const normalized = normalizeStatus(status);
  return (
    normalized === 'SUCCEEDED' ||
    normalized === 'SUCCESS' ||
    normalized === 'COMPLETED' ||
    normalized === 'FAILED' ||
    normalized === 'CANCELLED' ||
    normalized === 'CANCELED'
  );
};

const clampProgress = (value?: number | null): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }
  return Math.min(100, Math.max(0, Math.round(value)));
};

const statusLabel = (status?: string | null): string => {
  const normalized = normalizeStatus(status);
  const detail = statusDetails[normalized];
  if (detail?.label) {
    return detail.label;
  }
  if (!status) {
    return 'Status unknown';
  }
  return normalized
    .toLowerCase()
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const statusHelper = (
  status?: string | null,
  message?: string | null,
): string | null => {
  const normalized = normalizeStatus(status);
  if (message) {
    return message;
  }
  return statusDetails[normalized]?.helper ?? null;
};

const statusIconFor = (
  status: string,
): ComponentType<SvgIconProps> => {
  const normalized = normalizeStatus(status);
  if (normalized === 'SUCCEEDED' || normalized === 'SUCCESS' || normalized === 'COMPLETED') {
    return CheckCircleOutlineIcon;
  }
  if (normalized === 'FAILED' || normalized === 'CANCELED' || normalized === 'CANCELLED') {
    return ErrorOutlineIcon;
  }
  if (
    normalized === 'PROVISIONING' ||
    normalized === 'CONFIGURING_NETWORK' ||
    normalized === 'APPLYING_PULUMI_STACK' ||
    normalized === 'BOOTSTRAPPING'
  ) {
    return BuildIcon;
  }
  if (normalized === 'PENDING' || normalized === 'SUBMITTED' || normalized === 'RESUMING') {
    return HourglassEmptyIcon;
  }
  return CloudQueueIcon;
};

const formatTimestamp = (timestamp?: number | null): string => {
  if (!timestamp) {
    return '—';
  }
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(timestamp));
  } catch (e) {
    return new Date(timestamp).toLocaleString();
  }
};

type StoredClusterJob = {
  jobId: string;
  projectId: string;
  clusterId: string;
  provider: string;
  region: string;
  submittedAt?: number;
};

type JobStatusEntry = {
  status: string;
  progress: number;
  timestamp: number;
  message?: string;
};

type WorkflowStep = {
  title: string;
  description: string;
  icon: ComponentType<SvgIconProps>;
};

const adminWorkflow: WorkflowStep[] = [
  {
    title: 'Establish a project',
    description:
      'Projects capture budgets, RBAC, and reporting. Create or choose the project that will own this capacity.',
    icon: AccountTreeIcon,
  },
  {
    title: 'Attach queues & flavors',
    description:
      'Queues map demand to guardrails while flavors define hardware SKUs. Lock these in before allocating spend.',
    icon: TimelineIcon,
  },
  {
    title: 'Provision AWS cluster capacity',
    description:
      'Use this form to launch the managed control plane and worker nodes in the approved region.',
    icon: BuildIcon,
  },
];

const userWorkflow: WorkflowStep[] = [
  {
    title: 'Select approved resources',
    description:
      'Daily users simply pick from the clusters, projects, and queues that admins have provisioned.',
    icon: PlaylistAddCheckIcon,
  },
  {
    title: 'Launch workspace',
    description:
      'The workspace wizard handles templates, ports, and credentials once capacity is available.',
    icon: AssessmentIcon,
  },
];

export const CreateClusterPage: FC = () => {
  const classes = useStyles();
  const fetchApi = useApi(fetchApiRef);
  const discoveryApi = useApi(discoveryApiRef);
  const identityApi = useApi(identityApiRef);
  const authApi = useApi(keycloakAuthApiRef);
  const alertApi = useApi(alertApiRef);
  const workspaceWizardLink = useRouteRef(launchWorkspaceRouteRef);
  const projectConsoleLink = useRouteRef(projectManagementRouteRef);

  const [form, setForm] = useState({
    projectId: '',
    clusterId: '',
    provider: 'aws',
    region: awsRegions[0]?.value ?? 'us-east-1',
  });
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusHistory, setStatusHistory] = useState<JobStatusEntry[]>([]);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pollingActive, setPollingActive] = useState(false);
  const pollerRef = useRef<ReturnType<typeof setInterval>>();
  const lastToastStatusRef = useRef<string | null>(null);

  const jobActive = Boolean(jobId && jobStatus && !isTerminalStatus(jobStatus));
  const canResumePolling = Boolean(jobId && !isTerminalStatus(jobStatus) && !pollingActive);
  const normalizedProgress = progress === null ? 0 : clampProgress(progress);
  const hasProgressValue = progress !== null && Number.isFinite(progress);

  const handleFormFieldChange =
    (field: keyof typeof form) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setForm(prev => ({ ...prev, [field]: event.target.value }));
    };

  const clearPoller = useCallback(() => {
    if (pollerRef.current) {
      clearInterval(pollerRef.current);
      pollerRef.current = undefined;
    }
    setPollingActive(false);
  }, []);

  const clearStoredJob = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(JOB_STORAGE_KEY);
    }
  }, []);

  const persistStoredJob = useCallback((state: StoredClusterJob) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(JOB_STORAGE_KEY, JSON.stringify(state));
    }
  }, []);

  const appendStatusEntry = useCallback((entry: JobStatusEntry) => {
    setStatusHistory(prev => {
      const last = prev[prev.length - 1];
      if (
        last &&
        last.status === entry.status &&
        last.progress === entry.progress &&
        (last.message ?? '') === (entry.message ?? '')
      ) {
        return prev;
      }
      const next = [...prev, entry];
      if (next.length > 20) {
        return next.slice(next.length - 20);
      }
      return next;
    });
  }, []);

  const handleTerminalJob = useCallback(
    (status?: string | null, errorMessage?: string | null) => {
      const normalized = normalizeStatus(status);
      if (!isTerminalStatus(normalized)) {
        return;
      }
      clearPoller();
      clearStoredJob();
      setLastUpdated(Date.now());
      if (normalized.startsWith('SUCC')) {
        alertApi.post({
          message: 'Cluster provisioning completed successfully.',
          severity: 'success',
        });
      }
      if (normalized.includes('FAIL')) {
        alertApi.post({
          message: errorMessage || 'Cluster provisioning failed.',
          severity: 'error',
        });
      }
      lastToastStatusRef.current = null;
    },
    [alertApi, clearPoller, clearStoredJob],
  );

  const fetchJobStatus = useCallback(
    async (id: string) => {
      try {
        const { job } = await getClusterJobStatus(
          fetchApi,
          discoveryApi,
          identityApi,
          authApi,
          id,
        );
        const normalizedStatus = normalizeStatus(job.status);
        const normalizedProgressValue = clampProgress(job.progress);
        setError(null);
        setJobStatus(normalizedStatus);
        setProgress(
          typeof job.progress === 'number' && Number.isFinite(job.progress)
            ? normalizedProgressValue
            : null,
        );
        const timestamp = Date.now();
        setLastUpdated(timestamp);
        appendStatusEntry({
          status: normalizedStatus,
          progress: normalizedProgressValue,
          timestamp,
          message: job.error ?? undefined,
        });
        if (normalizedStatus === 'FAILED') {
          setError(job.error || 'Cluster provisioning failed.');
        }
        handleTerminalJob(normalizedStatus, job.error);
        if (isTerminalStatus(normalizedStatus)) {
          clearPoller();
        }
      } catch (e: unknown) {
        let message = 'Unable to fetch cluster job status.';
        if (e instanceof AuthenticationError || e instanceof AuthorizationError) {
          message = e.message;
        } else if (e instanceof Error) {
          message = e.message || message;
        }
        setError(message);
        clearPoller();
        alertApi.post({ message, severity: 'warning' });
      }
    },
    [
      appendStatusEntry,
      authApi,
      clearPoller,
      discoveryApi,
      fetchApi,
      handleTerminalJob,
      identityApi,
      alertApi,
    ],
  );

  const startPolling = useCallback(
    (id: string) => {
      clearPoller();
      setPollingActive(true);
      fetchJobStatus(id);
      pollerRef.current = setInterval(() => {
        fetchJobStatus(id);
      }, POLL_INTERVAL_MS);
    },
    [clearPoller, fetchJobStatus],
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const { job } = await createCluster(
        fetchApi,
        discoveryApi,
        identityApi,
        authApi,
        form,
      );
      const normalizedStatus = normalizeStatus(job.status);
      const normalizedProgressValue = clampProgress(job.progress);
      const submittedAt = Date.now();
      setJobId(job.id);
      setJobStatus(normalizedStatus);
      setProgress(
        typeof job.progress === 'number' && Number.isFinite(job.progress)
          ? normalizedProgressValue
          : 0,
      );
      setLastUpdated(submittedAt);
      setStatusHistory([
        {
          status: normalizedStatus,
          progress: normalizedProgressValue,
          timestamp: submittedAt,
          message: job.error ?? undefined,
        },
      ]);
      persistStoredJob({
        jobId: job.id,
        projectId: form.projectId,
        clusterId: form.clusterId,
        provider: form.provider,
        region: form.region,
        submittedAt,
      });
      alertApi.post({
        message: `Cluster provisioning job ${job.id} submitted.`,
        severity: 'success',
      });
      lastToastStatusRef.current = normalizedStatus;
      startPolling(job.id);
    } catch (e: unknown) {
      let message = 'Failed to submit cluster provisioning request.';
      if (e instanceof AuthenticationError || e instanceof AuthorizationError) {
        message = e.message;
      } else if (e instanceof Error) {
        message = e.message || message;
      }
      setError(message);
      alertApi.post({ message, severity: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const raw = window.localStorage.getItem(JOB_STORAGE_KEY);
    if (!raw) {
      return;
    }
    try {
      const stored: StoredClusterJob = JSON.parse(raw);
      if (!stored?.jobId) {
        window.localStorage.removeItem(JOB_STORAGE_KEY);
        return;
      }
      setForm(prev => ({
        ...prev,
        projectId: stored.projectId ?? prev.projectId,
        clusterId: stored.clusterId ?? prev.clusterId,
        provider: stored.provider ?? prev.provider,
        region: stored.region ?? prev.region,
      }));
      setJobId(stored.jobId);
      setJobStatus('RESUMING');
      setProgress(0);
      const submittedAt = stored.submittedAt ?? Date.now();
      setLastUpdated(submittedAt);
      setStatusHistory([
        {
          status: 'RESUMING',
          progress: 0,
          timestamp: submittedAt,
        },
      ]);
      alertApi.post({
        message: `Resuming cluster provisioning job ${stored.jobId}.`,
        severity: 'info',
      });
      lastToastStatusRef.current = 'RESUMING';
      startPolling(stored.jobId);
    } catch (err) {
      window.localStorage.removeItem(JOB_STORAGE_KEY);
    }
  }, [alertApi, startPolling]);

  useEffect(() => clearPoller, [clearPoller]);

  useEffect(() => {
    if (!jobId || !jobStatus) {
      return;
    }
    if (isTerminalStatus(jobStatus)) {
      return;
    }
    const normalized = normalizeStatus(jobStatus);
    if (lastToastStatusRef.current === normalized) {
      return;
    }
    lastToastStatusRef.current = normalized;
    alertApi.post({
      message: `Cluster job ${jobId}: ${statusLabel(normalized)}.`,
      severity: 'info',
    });
  }, [alertApi, jobId, jobStatus]);

  const latestHistoryEntry = statusHistory[statusHistory.length - 1];
  const helperMessage = statusHelper(jobStatus, latestHistoryEntry?.message ?? null);

  return (
    <Page themeId="tool">
      <Content>
        <ContentHeader title="Provision AWS Cluster Capacity">
          <Typography variant="body1" color="textSecondary" className={classes.pageSubtitle}>
            Platform admins create the compute surface area here before daily users enter the workspace wizard.
            Provision clusters against approved projects and regions, then hand the environment off with
            confidence.
          </Typography>
          <Button
            component={RouterLink}
            to={workspaceWizardLink()}
            color="primary"
            variant="outlined"
          >
            Open workspace wizard
          </Button>
        </ContentHeader>
        <Grid container spacing={3}>
          <Grid item xs={12} lg={7}>
            <Card className={classes.formCard}>
              <CardContent>
                <Typography variant="h5">Create a managed cluster</Typography>
                <Typography variant="body2" color="textSecondary">
                  Provisioned clusters automatically register with the ÆGIS control plane once Pulumi finishes
                  standing up AWS resources.
                </Typography>
                <Alert severity="info" className={classes.awsOnlyAlert}>
                  <AlertTitle>AWS regions only</AlertTitle>
                  ÆGIS currently provisions clusters exclusively on AWS. Multi-cloud support is on the roadmap;
                  choose from the approved AWS regions below.
                </Alert>
                <form onSubmit={handleSubmit} className={classes.form}>
                  <TextField
                    label="Project ID"
                    value={form.projectId}
                    onChange={handleFormFieldChange('projectId')}
                    variant="outlined"
                    required
                    fullWidth
                    disabled={jobActive}
                    helperText="Project that will own this cluster’s spend and RBAC guardrails."
                  />
                  <TextField
                    label="Cluster ID"
                    value={form.clusterId}
                    onChange={handleFormFieldChange('clusterId')}
                    variant="outlined"
                    required
                    fullWidth
                    disabled={jobActive}
                    helperText="Lowercase slug used in ÆGIS APIs (letters, numbers, hyphens)."
                  />
                  <TextField
                    label="Cloud provider"
                    value={form.provider.toUpperCase()}
                    variant="outlined"
                    required
                    fullWidth
                    disabled
                    helperText="Currently locked to AWS for production environments."
                  />
                  <TextField
                    label="AWS region"
                    select
                    value={form.region}
                    onChange={handleFormFieldChange('region')}
                    variant="outlined"
                    required
                    fullWidth
                    disabled={jobActive}
                    helperText="Select the approved AWS (or GovCloud) region for this cluster."
                  >
                    {awsRegions.map(region => (
                      <MenuItem key={region.value} value={region.value}>
                        {region.label}
                      </MenuItem>
                    ))}
                  </TextField>
                  <div className={classes.actionRow}>
                    <Button
                      type="submit"
                      color="primary"
                      variant="contained"
                      disabled={submitting || jobActive}
                    >
                      Provision cluster
                    </Button>
                    {submitting && <Progress />}
                    {jobActive && !submitting && (
                      <Typography variant="body2" color="textSecondary">
                        Provisioning in progress…
                      </Typography>
                    )}
                  </div>
                </form>
              </CardContent>
            </Card>
            <Card className={classes.checklistCard}>
              <CardContent>
                <Typography variant="overline" color="textSecondary">
                  Operational playbook
                </Typography>
                <Typography variant="h6">Cluster & workspace workflow</Typography>
                <Typography variant="body2" color="textSecondary">
                  Align on this sequence so platform admins pave the road before data scientists arrive.
                </Typography>
                <List disablePadding>
                  {adminWorkflow.map(step => (
                    <ListItem key={step.title} alignItems="flex-start">
                      <ListItemIcon className={classes.stepIcon}>
                        <step.icon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary={step.title}
                        secondary={step.description}
                        primaryTypographyProps={{ variant: 'subtitle1' }}
                        secondaryTypographyProps={{ variant: 'body2', color: 'textSecondary' }}
                      />
                    </ListItem>
                  ))}
                </List>
                <Divider className={classes.listDivider} />
                <Typography variant="overline" color="textSecondary">
                  Daily user journey
                </Typography>
                <List disablePadding>
                  {userWorkflow.map(step => (
                    <ListItem key={step.title} alignItems="flex-start">
                      <ListItemIcon className={classes.stepIcon}>
                        <step.icon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary={step.title}
                        secondary={step.description}
                        primaryTypographyProps={{ variant: 'subtitle1' }}
                        secondaryTypographyProps={{ variant: 'body2', color: 'textSecondary' }}
                      />
                    </ListItem>
                  ))}
                </List>
                <div className={classes.ctaRow}>
                  <Button
                    component={RouterLink}
                    to={projectConsoleLink()}
                    variant="outlined"
                    color="primary"
                  >
                    Manage projects
                  </Button>
                  <Button
                    component={RouterLink}
                    to={workspaceWizardLink()}
                    variant="contained"
                    color="primary"
                  >
                    Workspace wizard
                  </Button>
                </div>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} lg={5}>
            <Card className={classes.jobCard}>
              <CardContent>
                <Typography variant="h6">Provisioning status</Typography>
                {!jobId ? (
                  <Typography variant="body2" color="textSecondary">
                    Submit the form to launch a provisioning job. Progress, history, and status updates will
                    appear here.
                  </Typography>
                ) : (
                  <>
                    <Typography variant="subtitle2" color="textSecondary" className={classes.statusHeader}>
                      Job ID: {jobId}
                    </Typography>
                    <Typography variant="h5">{statusLabel(jobStatus)}</Typography>
                    {helperMessage && (
                      <Typography variant="body2" color="textSecondary" className={classes.statusHelper}>
                        {helperMessage}
                      </Typography>
                    )}
                    {lastUpdated && (
                      <Typography variant="caption" className={classes.statusMetadata}>
                        Last updated {formatTimestamp(lastUpdated)}
                      </Typography>
                    )}
                    <div className={classes.progressSection}>
                      <LinearProgress
                        variant={hasProgressValue ? 'determinate' : 'indeterminate'}
                        value={hasProgressValue ? normalizedProgress : undefined}
                      />
                      <Typography variant="body2" color="textSecondary" className={classes.progressLabel}>
                        {hasProgressValue
                          ? `Progress: ${normalizedProgress}%`
                          : 'Waiting for detailed progress'}
                      </Typography>
                    </div>
                    {canResumePolling && (
                      <Box marginTop={2}>
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => jobId && startPolling(jobId)}
                        >
                          Resume status checks
                        </Button>
                      </Box>
                    )}
                    {statusHistory.length > 0 && (
                      <div className={classes.jobHistory}>
                        <Typography variant="subtitle2">Activity</Typography>
                        <List dense className={classes.historyList}>
                          {statusHistory.map(entry => {
                            const Icon = statusIconFor(entry.status);
                            const secondaryParts = [formatTimestamp(entry.timestamp)];
                            if (entry.message) {
                              secondaryParts.push(entry.message);
                            }
                            return (
                              <ListItem key={`${entry.status}-${entry.timestamp}`}>
                                <ListItemIcon className={classes.historyIcon}>
                                  <Icon fontSize="small" />
                                </ListItemIcon>
                                <ListItemText
                                  primary={`${statusLabel(entry.status)} — ${entry.progress}%`}
                                  secondary={secondaryParts.join(' • ')}
                                  primaryTypographyProps={{ variant: 'body2' }}
                                  secondaryTypographyProps={{ variant: 'caption', color: 'textSecondary' }}
                                />
                              </ListItem>
                            );
                          })}
                        </List>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
            {error && (
              <Box marginTop={3}>
                <WarningPanel severity="error" title="Cluster provisioning issue">
                  {error}
                </WarningPanel>
              </Box>
            )}
          </Grid>
        </Grid>
      </Content>
    </Page>
  );
};
