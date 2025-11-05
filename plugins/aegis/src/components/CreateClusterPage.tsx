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
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  LinearProgress,
  TextField,
  Typography,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { Link as RouterLink } from 'react-router-dom';
import {
  AuthenticationError,
  AuthorizationError,
  ApiError,
  createCluster,
  getClusterJobStatus,
} from '../api/aegisClient';
import { keycloakAuthApiRef } from '../api/refs';
import { launchWorkspaceRouteRef, projectManagementRouteRef } from '../routes';

const useStyles = makeStyles(theme => ({
  layout: {
    display: 'grid',
    gap: theme.spacing(3),
  },
  heroText: {
    marginTop: theme.spacing(1),
    maxWidth: 720,
  },
  contextCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2.5),
  },
  orderList: {
    paddingLeft: theme.spacing(3),
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
  },
  orderListItem: {
    fontWeight: 600,
  },
  orderListMeta: {
    color: theme.palette.text.secondary,
    marginTop: theme.spacing(0.5),
  },
  actionLinks: {
    display: 'flex',
    gap: theme.spacing(1.5),
    flexWrap: 'wrap',
  },
  formCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2.5),
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  },
  actionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
  },
  progressSection: {
    marginTop: theme.spacing(2),
  },
  progressLabel: {
    marginTop: theme.spacing(1),
  },
  statusSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
  },
  statusHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    flexWrap: 'wrap',
  },
  statusMeta: {
    display: 'grid',
    gap: theme.spacing(0.25),
    marginTop: theme.spacing(0.5),
  },
  callout: {
    marginTop: theme.spacing(1),
  },
  resumeNotice: {
    marginBottom: theme.spacing(1),
  },
}));

const JOB_STORAGE_KEY = 'aegis.clusterJobState';
const POLL_INTERVAL_MS = 5000;

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
  const projectManagementLink = useRouteRef(projectManagementRouteRef);
  const launchWorkspaceLink = useRouteRef(launchWorkspaceRouteRef);

  const [form, setForm] = useState({
    projectId: '',
    clusterId: '',
    provider: 'aws',
    region: 'us-east-1',
  });
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resuming, setResuming] = useState(false);
  const pollerRef = useRef<ReturnType<typeof setInterval>>();
  const statusErrorRef = useRef<string | null>(null);

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
  }, []);

  const persistStoredJob = useCallback((state: StoredClusterJob) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(JOB_STORAGE_KEY, JSON.stringify(state));
    }
  }, []);

  const handleTerminalJob = useCallback(
    (status: string | null | undefined, errorMessage?: string | null) => {
      if (!isTerminalStatus(status)) {
        return;
      }

      clearPoller();
      clearStoredJob();
      setResuming(false);
      statusErrorRef.current = null;

      const normalized = status ? status.toUpperCase() : '';

      if (normalized.startsWith('SUCC')) {
        setError(null);
        alertApi.post({
          message: 'Cluster deployment completed successfully.',
          severity: 'success',
        });
        return;
      }

      if (normalized.includes('FAIL')) {
        const failureMessage = errorMessage || 'Cluster deployment failed.';
        setError(failureMessage);
        alertApi.post({
          message: failureMessage,
          severity: 'error',
        });
        return;
      }

      if (normalized.includes('CANCEL')) {
        const cancelledMessage = errorMessage || 'Cluster deployment was cancelled.';
        setError(cancelledMessage);
        alertApi.post({
          message: cancelledMessage,
          severity: 'warning',
        });
      }
    },
    [alertApi, clearPoller, clearStoredJob, setResuming, setError],
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
        statusErrorRef.current = null;
        setError(null);
        setJobStatus(job.status ?? null);
        setProgress(
          typeof job.progress === 'number' ? Math.max(0, job.progress) : 0,
        );
        if (job.status === 'FAILED') {
          setError(job.error || 'Cluster deployment failed.');
        }
        handleTerminalJob(job.status, job.error);
      } catch (e: unknown) {
        let message = 'Unable to fetch cluster job status.';
        if (e instanceof AuthenticationError || e instanceof AuthorizationError) {
          message = e.message;
          setError(message);
          clearPoller();
          clearStoredJob();
          alertApi.post({ message, severity: 'error' });
          return;
        }
        if (e instanceof ApiError) {
          message = e.message || message;
        } else if (e instanceof Error) {
          message = e.message || message;
        }
        setError(message);
        if (statusErrorRef.current !== message) {
          statusErrorRef.current = message;
          alertApi.post({
            message,
            severity: 'warning',
          });
        }
      }
    },
    [
      alertApi,
      authApi,
      clearPoller,
      clearStoredJob,
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

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      setResuming(false);
      const { job } = await createCluster(
        fetchApi,
        discoveryApi,
        identityApi,
        authApi,
        form,
      );
      setJobId(job.id);
      setJobStatus(job.status);
      setProgress(job.progress ?? 0);
      statusErrorRef.current = null;
      persistStoredJob({
        jobId: job.id,
        projectId: form.projectId,
        clusterId: form.clusterId,
        provider: form.provider,
        region: form.region,
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
      } else if (e instanceof ApiError) {
        message = e.message || message;
      } else if (e instanceof Error) {
        message = e.message || message;
      }
      setError(message);
      alertApi.post({
        message,
        severity: 'error',
      });
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
      setResuming(true);
      statusErrorRef.current = null;
      alertApi.post({
        message: `Resuming cluster deployment job ${stored.jobId}.`,
        severity: 'info',
      });
      startPolling(stored.jobId);
    } catch (err) {
      window.localStorage.removeItem(JOB_STORAGE_KEY);
    }
  }, [alertApi, startPolling]);

  useEffect(() => clearPoller, [clearPoller]);

  const normalizedProgress = Math.min(100, Math.max(0, progress ?? 0));
  const progressVariant: 'determinate' | 'indeterminate' =
    jobActive && normalizedProgress <= 0 ? 'indeterminate' : 'determinate';
  const jobStatusLabel =
    jobStatus ?? (resuming ? 'RESUMING' : jobId ? 'QUEUED' : 'PENDING');
  const projectManagementPath = projectManagementLink();
  const launchWorkspacePath = launchWorkspaceLink();

  return (
    <Page themeId="tool">
      <Content>
        <ContentHeader title="Provision Cluster Capacity">
          <Typography variant="body1" color="textSecondary" className={classes.heroText}>
            Platform administrators create AWS clusters before opening the workspace
            wizard to daily users. Clusters host the queues and flavors that power
            every ÆGIS workspace.
          </Typography>
        </ContentHeader>
        <div className={classes.layout}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={5}>
              <Card className={classes.contextCard} elevation={0}>
                <CardContent>
                  <Chip label="Platform admin task" color="primary" variant="outlined" size="small" />
                  <Typography variant="h6">Provisioning order</Typography>
                  <Typography variant="body2" color="textSecondary">
                    Follow this sequence so operators only have to pick from
                    approved resources during launch.
                  </Typography>
                  <ol className={classes.orderList}>
                    <li>
                      <Typography className={classes.orderListItem}>
                        Provision AWS cluster capacity
                      </Typography>
                      <Typography className={classes.orderListMeta}>
                        Creates the VPC footprint, IAM roles, and worker pools
                        that projects will consume.
                      </Typography>
                    </li>
                    <li>
                      <Typography className={classes.orderListItem}>
                        Define projects, queues, and approved flavors
                      </Typography>
                      <Typography className={classes.orderListMeta}>
                        Map mission teams to dedicated queues so budgets and
                        guardrails stay enforceable.
                      </Typography>
                    </li>
                    <li>
                      <Typography className={classes.orderListItem}>
                        Hand off to the workspace launch wizard
                      </Typography>
                      <Typography className={classes.orderListMeta}>
                        Daily users simply choose an existing cluster project and
                        queue before launching their session.
                      </Typography>
                    </li>
                  </ol>
                  <WarningPanel
                    severity="warning"
                    title="AWS-only provisioning"
                    className={classes.callout}
                  >
                    ÆGIS currently provisions clusters on AWS. Multi-cloud
                    targets will roll out as additional providers are certified.
                  </WarningPanel>
                  <Divider />
                  <Typography variant="subtitle2">Next steps</Typography>
                  <div className={classes.actionLinks}>
                    <Button
                      component={RouterLink}
                      to={projectManagementPath}
                      variant="outlined"
                      color="primary"
                    >
                      Define projects & queues
                    </Button>
                    <Button
                      component={RouterLink}
                      to={launchWorkspacePath}
                      color="primary"
                    >
                      Open workspace wizard
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={7}>
              <Card className={classes.formCard} elevation={0}>
                <CardContent>
                  {resuming && jobId && (
                    <Typography
                      variant="body2"
                      color="textSecondary"
                      className={classes.resumeNotice}
                    >
                      Resuming provisioning job {jobId}. Progress polling will
                      continue until completion.
                    </Typography>
                  )}
                  <Typography variant="h6">Cluster request</Typography>
                  <Typography variant="body2" color="textSecondary">
                    Provide the project slug, cluster identifier, and target
                    region. The control plane submits a Pulumi deployment and
                    tracks status automatically.
                  </Typography>
                  <form onSubmit={handleSubmit} className={classes.form}>
                    <TextField
                      label="Project ID"
                      value={form.projectId}
                      onChange={handleFormFieldChange('projectId')}
                      variant="outlined"
                      required
                      fullWidth
                    />
                    <TextField
                      label="Cluster ID"
                      value={form.clusterId}
                      onChange={handleFormFieldChange('clusterId')}
                      variant="outlined"
                      required
                      fullWidth
                      helperText="Use lowercase with hyphens, e.g. prod-east"
                    />
                    <TextField
                      label="Provider"
                      value="Amazon Web Services"
                      variant="outlined"
                      required
                      fullWidth
                      disabled
                      helperText="Only AWS clusters are supported today"
                    />
                    <TextField
                      label="AWS region"
                      value={form.region}
                      onChange={handleFormFieldChange('region')}
                      variant="outlined"
                      required
                      fullWidth
                      helperText="Example: us-east-1"
                    />
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
                    </div>
                  </form>
                  {jobId && (
                    <div className={classes.statusSection}>
                      <Divider />
                      <div className={classes.statusHeader}>
                        <Typography variant="h6">Deployment status</Typography>
                        <Chip size="small" variant="outlined" label={jobStatusLabel} />
                      </div>
                      <div className={classes.statusMeta}>
                        <Typography variant="body2" color="textSecondary">
                          Job ID: {jobId}
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          Project: {form.projectId || '—'}
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          Cluster: {form.clusterId || '—'}
                        </Typography>
                      </div>
                      <div className={classes.progressSection}>
                        {progressVariant === 'determinate' ? (
                          <LinearProgress variant="determinate" value={normalizedProgress} />
                        ) : (
                          <LinearProgress variant="indeterminate" />
                        )}
                        <Typography
                          className={classes.progressLabel}
                          variant="body2"
                          color="textSecondary"
                        >
                          Progress: {normalizedProgress}%
                        </Typography>
                      </div>
                    </div>
                  )}
                  {error && (
                    <Box className={classes.callout}>
                      <WarningPanel severity="error" title="Cluster provisioning issue">
                        {error}
                      </WarningPanel>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </div>
      </Content>
    </Page>
  );
};
