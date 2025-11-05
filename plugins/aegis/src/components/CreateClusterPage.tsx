import React, { FC, useCallback, useEffect, useRef, useState } from 'react';
import { Page, Content, ContentHeader, Progress, WarningPanel } from '@backstage/core-components';
import {
  alertApiRef,
  discoveryApiRef,
  fetchApiRef,
  identityApiRef,
  useApi,
  useRouteRef,
} from '@backstage/core-plugin-api';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
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
import Alert from '@material-ui/lab/Alert';
import InfoOutlinedIcon from '@material-ui/icons/InfoOutlined';
import {
  AuthenticationError,
  AuthorizationError,
  createCluster,
  getClusterJobStatus,
} from '../api/aegisClient';
import { keycloakAuthApiRef } from '../api/refs';
import { launchWorkspaceRouteRef, projectManagementRouteRef } from '../routes';

const useStyles = makeStyles(theme => ({
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  },
  formIntro: {
    marginBottom: theme.spacing(2),
  },
  actionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
  },
  helperCard: {
    height: '100%',
  },
  helperDivider: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
  helperActions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1.5),
    marginTop: theme.spacing(2),
  },
  progressSection: {
    marginTop: theme.spacing(2),
  },
  progressLabel: {
    marginTop: theme.spacing(1),
  },
  statusHeadline: {
    marginTop: theme.spacing(1),
  },
  statusMeta: {
    marginTop: theme.spacing(1),
    color: theme.palette.text.secondary,
  },
  statusActions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    marginTop: theme.spacing(2),
  },
  statusAlert: {
    marginTop: theme.spacing(2),
  },
  statusJobId: {
    marginTop: theme.spacing(1),
    fontFamily: 'monospace',
    wordBreak: 'break-all',
  },
}));

const JOB_STORAGE_KEY = 'aegis.clusterJobState';
const POLL_INTERVAL_MS = 5000;

const AWS_REGION_OPTIONS = [
  { value: 'us-east-1', label: 'US East (N. Virginia)' },
  { value: 'us-west-2', label: 'US West (Oregon)' },
  { value: 'us-gov-west-1', label: 'AWS GovCloud (US-West)' },
  { value: 'us-gov-east-1', label: 'AWS GovCloud (US-East)' },
] as const;

const isTerminalStatus = (status?: string | null): boolean => {
  if (!status) {
    return false;
  }
  const normalized = status.toUpperCase();
  return (
    normalized === 'SUCCEEDED' ||
    normalized === 'SUCCESS' ||
    normalized === 'COMPLETED' ||
    normalized === 'FAILED' ||
    normalized === 'CANCELLED' ||
    normalized === 'CANCELED'
  );
};

const normalizeJobProgress = (value?: number | null): number => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 0;
  }
  if (value >= 0 && value <= 1) {
    return Math.round(value * 100);
  }
  if (value < 0) {
    return 0;
  }
  if (value > 100) {
    return 100;
  }
  return Math.round(value);
};

const formatStatus = (status?: string | null): string => {
  if (!status) {
    return 'Awaiting status';
  }
  return status
    .split(/[_\s]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
};

type StoredClusterJob = {
  jobId: string;
  projectId: string;
  clusterId: string;
  provider: string;
  region: string;
};

export const CreateClusterPage: FC = () => {
  const classes = useStyles();
  const fetchApi = useApi(fetchApiRef);
  const discoveryApi = useApi(discoveryApiRef);
  const identityApi = useApi(identityApiRef);
  const authApi = useApi(keycloakAuthApiRef);
  const alertApi = useApi(alertApiRef);
  const navigate = useNavigate();
  const launchWorkspaceLink = useRouteRef(launchWorkspaceRouteRef);
  const projectManagementLink = useRouteRef(projectManagementRouteRef);

  const [form, setForm] = useState({
    projectId: '',
    clusterId: '',
    provider: 'aws',
    region: 'us-east-1',
  });
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [jobMessage, setJobMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resumeNotice, setResumeNotice] = useState(false);
  const [resumedJobId, setResumedJobId] = useState<string | null>(null);
  const pollerRef = useRef<ReturnType<typeof setInterval>>();

  const jobActive = Boolean(jobId && !isTerminalStatus(jobStatus));

  const handleFormFieldChange =
    (field: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) => {
      setForm(prev => ({ ...prev, [field]: event.target.value }));
    };

  const clearPoller = useCallback(() => {
    if (pollerRef.current) {
      clearInterval(pollerRef.current);
      pollerRef.current = undefined;
    }
  }, []);

  const clearStoredJob = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(JOB_STORAGE_KEY);
    }
    setResumeNotice(false);
    setResumedJobId(null);
  }, [setResumeNotice, setResumedJobId]);

  const persistStoredJob = useCallback((state: StoredClusterJob) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(JOB_STORAGE_KEY, JSON.stringify(state));
    }
  }, []);

  const handleTerminalJob = useCallback(
    (status: string | null | undefined, errorMessage?: string | null) => {
      if (isTerminalStatus(status)) {
        clearPoller();
        clearStoredJob();
        if (status && status.toUpperCase().startsWith('SUCC')) {
          alertApi.post({
            message: 'Cluster deployment completed successfully.',
            severity: 'success',
          });
        }
        if (status && status.toUpperCase().includes('FAIL')) {
          alertApi.post({
            message: errorMessage || 'Cluster deployment failed.',
            severity: 'error',
          });
        }
      }
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
        setJobStatus(job.status ?? null);
        setJobMessage(job.statusMessage ?? null);
        const nextProgress = normalizeJobProgress(
          typeof job.percentComplete === 'number'
            ? job.percentComplete
            : job.progress,
        );
        setProgress(nextProgress);
        setLastUpdated(Date.now());
        if (job.status === 'FAILED') {
          setError(job.error || 'Cluster deployment failed.');
        } else {
          setError(null);
        }
        handleTerminalJob(job.status, job.error);
        if (isTerminalStatus(job.status)) {
          pollerRef.current && clearPoller();
        }
      } catch (e: unknown) {
        let message = 'Unable to fetch cluster job status.';
        if (e instanceof AuthenticationError || e instanceof AuthorizationError) {
          message = e.message;
        } else if (e instanceof Error) {
          message = e.message || message;
        }
        setError(message);
        alertApi.post({ message, severity: 'error' });
        clearPoller();
      }
    },
    [
      alertApi,
      authApi,
      clearPoller,
      discoveryApi,
      fetchApi,
      handleTerminalJob,
      identityApi,
    ],
  );

  const startPolling = useCallback(
    (id: string) => {
      clearPoller();
      fetchJobStatus(id);
      pollerRef.current = setInterval(() => {
        fetchJobStatus(id);
      }, POLL_INTERVAL_MS);
    },
    [clearPoller, fetchJobStatus],
  );

  const handleRetry = useCallback(() => {
    if (jobId) {
      startPolling(jobId);
    }
  }, [jobId, startPolling]);

  const handleReset = useCallback(() => {
    clearPoller();
    clearStoredJob();
    setJobId(null);
    setJobStatus(null);
    setJobMessage(null);
    setProgress(0);
    setLastUpdated(null);
    setError(null);
  }, [clearPoller, clearStoredJob]);

  const handleNavigateToProjects = useCallback(() => {
    navigate(projectManagementLink());
  }, [navigate, projectManagementLink]);

  const handleNavigateToWizard = useCallback(() => {
    navigate(launchWorkspaceLink());
  }, [launchWorkspaceLink, navigate]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setResumeNotice(false);
    setResumedJobId(null);
    try {
      const payload = {
        projectId: form.projectId.trim(),
        clusterId: form.clusterId.trim(),
        provider: form.provider,
        region: form.region,
      };
      const { job } = await createCluster(
        fetchApi,
        discoveryApi,
        identityApi,
        authApi,
        payload,
      );
      const nextProgress = normalizeJobProgress(
        typeof job.percentComplete === 'number'
          ? job.percentComplete
          : job.progress,
      );
      setForm(prev => ({
        ...prev,
        projectId: payload.projectId,
        clusterId: payload.clusterId,
      }));
      setJobId(job.id);
      setJobStatus(job.status ?? null);
      setJobMessage(job.statusMessage ?? null);
      setProgress(nextProgress);
      setLastUpdated(Date.now());
      persistStoredJob({
        jobId: job.id,
        projectId: payload.projectId,
        clusterId: payload.clusterId,
        provider: payload.provider,
        region: payload.region,
      });
      alertApi.post({
        message: `Cluster creation job ${job.id} submitted.`,
        severity: 'success',
      });
      startPolling(job.id);
    } catch (e: unknown) {
      let message = 'Failed to submit cluster deployment.';
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
      setJobMessage('Reconnecting to deployment job…');
      setProgress(0);
      setResumeNotice(true);
      setResumedJobId(stored.jobId);
      setError(null);
      setLastUpdated(null);
      startPolling(stored.jobId);
    } catch (err) {
      window.localStorage.removeItem(JOB_STORAGE_KEY);
    }
  }, [startPolling]);

  useEffect(() => {
    if (resumedJobId) {
      alertApi.post({
        message: `Resumed monitoring cluster job ${resumedJobId}.`,
        severity: 'info',
      });
    }
  }, [alertApi, resumedJobId]);

  useEffect(() => clearPoller, [clearPoller]);

  const normalizedProgress = Math.min(100, Math.max(0, progress ?? 0));
  const statusTone = (() => {
    const normalized = jobStatus?.toUpperCase() ?? '';
    if (!normalized) {
      return 'idle';
    }
    if (normalized.startsWith('SUCC') || normalized === 'COMPLETED') {
      return 'success';
    }
    if (
      normalized.includes('FAIL') ||
      normalized === 'CANCELLED' ||
      normalized === 'CANCELED'
    ) {
      return 'failure';
    }
    return 'progress';
  })();
  const statusColor: 'primary' | 'error' | 'textSecondary' =
    statusTone === 'failure'
      ? 'error'
      : statusTone === 'success'
        ? 'primary'
        : 'textSecondary';
  const jobStatusLabel = formatStatus(jobStatus);
  const disableSubmit = submitting || jobActive;
  const lastUpdatedLabel =
    typeof lastUpdated === 'number'
      ? new Date(lastUpdated).toLocaleString()
      : undefined;
  const canRetry = Boolean(jobId);
  const canClear = Boolean(jobId && !jobActive);

  return (
    <Page themeId="tool">
      <Content>
        <ContentHeader
          title="Provision ÆGIS cluster"
          description="Stand up AWS infrastructure before assigning projects, queues, and flavors to your teams."
        />
        <Box mb={3}>
          <Alert severity="info">
            <strong>AWS only:</strong> Cluster automation currently targets AWS accounts (including GovCloud). Multi-cloud options are on the roadmap.
          </Alert>
        </Box>
        <Grid container spacing={3}>
          <Grid item xs={12} md={7}>
            <Card>
              <CardHeader title="Cluster parameters" />
              <CardContent>
                <Typography
                  variant="body2"
                  color="textSecondary"
                  className={classes.formIntro}
                >
                  Launch the Pulumi automation that creates a new ÆGIS control plane cluster. Link the deployment to an existing project so you can attach queues and flavors immediately after provisioning.
                </Typography>
                <form onSubmit={handleSubmit} className={classes.form}>
                  <TextField
                    label="Project ID"
                    value={form.projectId}
                    onChange={handleFormFieldChange('projectId')}
                    variant="outlined"
                    required
                    fullWidth
                    disabled={jobActive}
                    helperText="Provisioning links the cluster to this existing project."
                  />
                  <TextField
                    label="Cluster ID"
                    value={form.clusterId}
                    onChange={handleFormFieldChange('clusterId')}
                    variant="outlined"
                    required
                    fullWidth
                    disabled={jobActive}
                    helperText="Use lowercase letters, numbers, or dashes."
                  />
                  <TextField
                    label="Provider"
                    value="AWS"
                    variant="outlined"
                    required
                    fullWidth
                    disabled
                    helperText="AWS is the only supported provider today."
                  />
                  <TextField
                    label="AWS region"
                    value={form.region}
                    onChange={handleFormFieldChange('region')}
                    variant="outlined"
                    required
                    fullWidth
                    select
                    disabled={jobActive}
                    helperText="Select the region that matches your infrastructure account."
                  >
                    {AWS_REGION_OPTIONS.map(region => (
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
                      disabled={disableSubmit}
                    >
                      {jobActive
                        ? 'Cluster deployment in progress'
                        : 'Create cluster'}
                    </Button>
                    {submitting && <Progress />}
                  </div>
                </form>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={5}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Card className={classes.helperCard}>
                  <CardHeader title="Provisioning playbook" />
                  <CardContent>
                    <Typography variant="body2" color="textSecondary" paragraph>
                      Admins should prepare infrastructure before inviting daily users into the workspace wizard.
                    </Typography>
                    <List dense>
                      <ListItem>
                        <ListItemIcon>
                          <InfoOutlinedIcon color="primary" />
                        </ListItemIcon>
                        <ListItemText
                          primary="1. Stand up an AWS cluster"
                          secondary="Kick off Pulumi from this page to create networking, compute, and control-plane services."
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon>
                          <InfoOutlinedIcon color="primary" />
                        </ListItemIcon>
                        <ListItemText
                          primary="2. Register project, queue, and flavor guardrails"
                          secondary="Use the project console to add queues and flavors that route workloads onto the new cluster."
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon>
                          <InfoOutlinedIcon color="primary" />
                        </ListItemIcon>
                        <ListItemText
                          primary="3. Let daily users launch workspaces"
                          secondary="The workspace wizard automatically lists approved clusters and projects so daily users can launch without extra configuration."
                        />
                      </ListItem>
                    </List>
                    <Divider className={classes.helperDivider} />
                    <Typography variant="body2" color="textSecondary">
                      Have a cluster ready? Manage its projects or send teammates directly to the launch wizard.
                    </Typography>
                    <div className={classes.helperActions}>
                      <Button
                        variant="outlined"
                        color="primary"
                        onClick={handleNavigateToProjects}
                      >
                        Manage projects
                      </Button>
                      <Button
                        variant="outlined"
                        color="primary"
                        onClick={handleNavigateToWizard}
                      >
                        Open workspace wizard
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12}>
                <Card>
                  <CardHeader title="Deployment status" />
                  <CardContent>
                    {jobId ? (
                      <>
                        <Typography variant="body2" color="textSecondary">
                          Job ID
                        </Typography>
                        <Typography component="code" className={classes.statusJobId}>
                          {jobId}
                        </Typography>
                        <Typography
                          variant="subtitle1"
                          color={statusColor}
                          className={classes.statusHeadline}
                        >
                          {jobStatusLabel}
                        </Typography>
                        {jobMessage && (
                          <Typography variant="body2" className={classes.statusMeta}>
                            {jobMessage}
                          </Typography>
                        )}
                        {resumeNotice && (
                          <Alert severity="info" className={classes.statusAlert}>
                            We resumed monitoring this deployment after you returned to ÆGIS.
                          </Alert>
                        )}
                        <div className={classes.progressSection}>
                          <LinearProgress
                            variant="determinate"
                            value={normalizedProgress}
                          />
                          <Typography
                            className={classes.progressLabel}
                            variant="body2"
                            color="textSecondary"
                          >
                            Progress: {normalizedProgress}%
                          </Typography>
                        </div>
                        {lastUpdatedLabel && (
                          <Typography variant="caption" className={classes.statusMeta}>
                            Last updated: {lastUpdatedLabel}
                          </Typography>
                        )}
                        {error && (
                          <Box marginTop={2}>
                            <WarningPanel severity="error" title="Cluster deployment issue">
                              {error}
                            </WarningPanel>
                          </Box>
                        )}
                        <div className={classes.statusActions}>
                          <Button
                            variant="outlined"
                            color="primary"
                            onClick={handleRetry}
                            disabled={!canRetry || submitting}
                          >
                            Retry status check
                          </Button>
                          {canClear && (
                            <Button variant="outlined" onClick={handleReset}>
                              Clear status
                            </Button>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <Typography variant="body2" color="textSecondary">
                          Submit the form to launch a Pulumi deployment job. We poll every five seconds and keep the job ID in local storage so you can navigate elsewhere while the cluster comes online.
                        </Typography>
                        {error && (
                          <Box marginTop={2}>
                            <WarningPanel severity="error" title="Cluster deployment issue">
                              {error}
                            </WarningPanel>
                          </Box>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      </Content>
    </Page>
  );
};
