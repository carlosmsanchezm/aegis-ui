import React, { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Page,
  Content,
  ContentHeader,
  WarningPanel,
} from '@backstage/core-components';
import {
  alertApiRef,
  discoveryApiRef,
  fetchApiRef,
  identityApiRef,
  useApi,
} from '@backstage/core-plugin-api';
import {
  Box,
  Button,
  Card,
  CardContent,
  Collapse,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Step,
  StepContent,
  StepLabel,
  Stepper,
  Switch,
  TextField,
  Typography,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import CloudDownloadIcon from '@material-ui/icons/CloudDownload';
import RefreshIcon from '@material-ui/icons/Refresh';
import ReplayIcon from '@material-ui/icons/Replay';
import LaunchIcon from '@material-ui/icons/Launch';
import AssessmentIcon from '@material-ui/icons/Assessment';
import {
  AuthenticationError,
  AuthorizationError,
  createCluster,
  getClusterJobStatus,
} from '../api/aegisClient';
import { keycloakAuthApiRef } from '../api/refs';

type ProvisioningMode = 'provision' | 'import';

type NodePool = {
  id: string;
  name: string;
  instanceType: string;
  minNodes: number;
  maxNodes: number;
  gpuProfile: string;
  taints?: string;
  labels?: string;
  estimatedHourly: number;
};

type AdditionalCluster = {
  id: string;
  region: string;
  purpose: string;
};

type ClusterFormState = {
  projectId: string;
  clusterId: string;
  awsAccountId: string;
  awsRoleArn: string;
  region: string;
  mode: ProvisioningMode;
  importSecretName: string;
  importSecretNamespace: string;
  helmNamespace: string;
  helmVersion: string;
  platformEndpoint: string;
};

type WizardStep = {
  id: string;
  title: string;
  description: string;
};

const useStyles = makeStyles(theme => ({
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(3),
    paddingBottom: theme.spacing(6),
  },
  wizardGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr)',
    gap: theme.spacing(3),
  },
  stepContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(3),
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: theme.spacing(2),
  },
  nodePoolCard: {
    borderRadius: theme.shape.borderRadius * 2,
    border: '1px solid rgba(148, 163, 184, 0.24)',
    background: 'var(--aegis-card-surface, rgba(15, 23, 42, 0.45))',
  },
  advancedActions: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
  },
  workflowToggle: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  },
  workflowButtons: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
  },
  nodePoolList: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  },
  nodePoolActions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(2),
    alignItems: 'center',
  },
  additionalClusterList: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  },
  importStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  },
  platformGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: theme.spacing(2),
  },
  reviewGroup: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: theme.spacing(2),
  },
  reviewCard: {
    padding: theme.spacing(3),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
    borderRadius: theme.shape.borderRadius * 2,
    border: '1px solid rgba(148, 163, 184, 0.2)',
  },
  statusPanel: {
    padding: theme.spacing(3),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    borderRadius: theme.shape.borderRadius * 2,
  },
  quickActions: {
    display: 'flex',
    gap: theme.spacing(1.5),
    flexWrap: 'wrap',
  },
  stepperRoot: {
    background: 'transparent',
    padding: 0,
  },
  helperText: {
    color: theme.palette.text.secondary,
  },
}));

const JOB_STORAGE_KEY = 'aegis.clusterJobState';
const POLL_INTERVAL_MS = 5000;

const defaultNodePools = (): NodePool[] => [
  {
    id: 'primary-gpu',
    name: 'mission-gpu',
    instanceType: 'm7g.2xlarge',
    minNodes: 3,
    maxNodes: 12,
    gpuProfile: 'NVIDIA H100 · 80GB',
    taints: 'nvidia.com/gpu:NoSchedule',
    labels: 'workload=mission,accelerator=gpu',
    estimatedHourly: 42,
  },
  {
    id: 'services',
    name: 'platform-services',
    instanceType: 'c6i.xlarge',
    minNodes: 2,
    maxNodes: 6,
    gpuProfile: 'CPU only',
    estimatedHourly: 7,
  },
];

const defaultAdditionalClusters = (): AdditionalCluster[] => [
  {
    id: 'mission-ops',
    region: 'us-gov-east-1',
    purpose: 'Disaster recovery window',
  },
];

const wizardSteps: WizardStep[] = [
  {
    id: 'context',
    title: 'Context & access',
    description:
      'Set the project, AWS role, and region. Import workflows can swap to secret selection.',
  },
  {
    id: 'topology',
    title: 'Topology & scaling',
    description:
      'Tune node pools or choose a secret to import. Advanced controls reveal taints, labels, and multi-cluster options.',
  },
  {
    id: 'review',
    title: 'Review & launch',
    description:
      'Confirm derived identifiers, estimated hourly spend, and integration outputs before launching.',
  },
];

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

type TimelineStatus = 'complete' | 'active' | 'pending' | 'error';

type TimelineItem = {
  label: string;
  helper?: string;
  status: TimelineStatus;
};

const buildJobTimeline = (
  status: string | null | undefined,
  error?: string | null,
): TimelineItem[] => {
  const normalized = status?.toUpperCase();

  const base: TimelineItem[] = [
    { label: 'Spec submitted', status: 'pending' },
    { label: 'Pulumi stack refresh', status: 'pending' },
    { label: 'Pulumi apply', status: 'pending' },
    { label: 'Kubeconfigs synced', status: 'pending' },
    { label: 'Clusters registered', status: 'pending' },
  ];

  if (!normalized) {
    return base;
  }

  switch (normalized) {
    case 'PENDING':
    case 'QUEUED':
      base[0].status = 'active';
      break;
    case 'INIT':
    case 'PREPARING':
      base[0].status = 'complete';
      base[1].status = 'active';
      break;
    case 'APPLYING':
    case 'RUNNING':
    case 'PROVISIONING':
      base[0].status = 'complete';
      base[1].status = 'complete';
      base[2].status = 'active';
      base[2].helper = 'Pulumi automation is converging the stack';
      break;
    case 'SYNCHRONIZING':
      base[0].status = 'complete';
      base[1].status = 'complete';
      base[2].status = 'complete';
      base[3].status = 'active';
      break;
    case 'SUCCEEDED':
    case 'SUCCESS':
    case 'COMPLETED':
      base.forEach(item => {
        item.status = 'complete';
      });
      base[4].helper = 'Kubeconfigs and add-ons available';
      break;
    case 'FAILED':
    case 'CANCELLED':
    case 'CANCELED':
      base[0].status = 'complete';
      base[1].status = 'complete';
      base[2].status = 'error';
      base[2].helper = error || 'Pulumi automation reported an error';
      break;
    default:
      base[0].status = 'complete';
      base[1].status = 'complete';
      base[2].status = 'active';
  }

  return base;
};

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

export const CreateClusterPage: FC = () => {
  const classes = useStyles();
  const fetchApi = useApi(fetchApiRef);
  const discoveryApi = useApi(discoveryApiRef);
  const identityApi = useApi(identityApiRef);
  const authApi = useApi(keycloakAuthApiRef);
  const alertApi = useApi(alertApiRef);

  const [form, setForm] = useState<ClusterFormState>({
    projectId: 'mission-x',
    clusterId: 'mission-x-cluster',
    awsAccountId: '123456789012',
    awsRoleArn: 'arn:aws-us-gov:iam::123456789012:role/AegisClusterProvisioner',
    region: 'us-gov-west-1',
    mode: 'provision',
    importSecretName: '',
    importSecretNamespace: 'aegis-secrets',
    helmNamespace: 'aegis-spoke',
    helmVersion: '1.6.0',
    platformEndpoint: '',
  });
  const [nodePools, setNodePools] = useState<NodePool[]>(() => defaultNodePools());
  const [additionalClusters, setAdditionalClusters] = useState<AdditionalCluster[]>(
    () => defaultAdditionalClusters(),
  );
  const [showAdvancedTopology, setShowAdvancedTopology] = useState(false);
  const [showPlatformIntegration, setShowPlatformIntegration] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [stepError, setStepError] = useState<string | null>(null);

  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [jobProgress, setJobProgress] = useState<number>(0);
  const [jobError, setJobError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const pollerRef = useRef<ReturnType<typeof setInterval>>();

  const jobActive = Boolean(jobId && !isTerminalStatus(jobStatus));

  const estimatedHourly = useMemo(() => {
    if (form.mode === 'import') {
      return 0;
    }
    return nodePools.reduce((sum, pool) => sum + pool.maxNodes * pool.estimatedHourly, 0);
  }, [form.mode, nodePools]);

  const derivedClusterCount = useMemo(() => {
    if (form.mode === 'import') {
      return 1;
    }
    const extra = showAdvancedTopology ? additionalClusters.length : 0;
    return 1 + extra;
  }, [additionalClusters.length, form.mode, showAdvancedTopology]);

  const totalMaxNodes = useMemo(() => {
    if (form.mode === 'import') {
      return 0;
    }
    return nodePools.reduce((sum, pool) => sum + pool.maxNodes, 0);
  }, [form.mode, nodePools]);

  const handleFormChange = <K extends keyof ClusterFormState>(
    key: K,
  ) => (event: React.ChangeEvent<HTMLInputElement | { value: unknown }>) => {
    const value = event.target.value as ClusterFormState[K];
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleModeToggle = (mode: ProvisioningMode) => {
    setForm(prev => ({ ...prev, mode }));
    if (mode === 'import') {
      setShowAdvancedTopology(false);
      setShowPlatformIntegration(false);
    }
  };

  const handleNodePoolChange = <K extends keyof NodePool>(
    index: number,
    key: K,
  ) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const value =
      event.target.type === 'number'
        ? Number(event.target.value)
        : (event.target.value as NodePool[K]);
    setNodePools(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [key]: value } as NodePool;
      return next;
    });
  };

  const addNodePool = () => {
    setNodePools(prev => [
      ...prev,
      {
        id: `pool-${prev.length + 1}`,
        name: `node-pool-${prev.length + 1}`,
        instanceType: 'm7g.large',
        minNodes: 1,
        maxNodes: 4,
        gpuProfile: 'CPU only',
        estimatedHourly: 5,
      },
    ]);
  };

  const removeNodePool = (index: number) => {
    setNodePools(prev => prev.filter((_, poolIndex) => poolIndex !== index));
  };

  const handleAdditionalClusterChange = (
    index: number,
    key: keyof AdditionalCluster,
  ) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setAdditionalClusters(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [key]: value };
      return next;
    });
  };

  const addAdditionalCluster = () => {
    setAdditionalClusters(prev => [
      ...prev,
      {
        id: `expansion-${prev.length + 1}`,
        region: form.region,
        purpose: 'Scale-out capacity',
      },
    ]);
  };

  const removeAdditionalCluster = (index: number) => {
    setAdditionalClusters(prev => prev.filter((_, idx) => idx !== index));
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
      if (isTerminalStatus(status)) {
        clearPoller();
        clearStoredJob();
        if (status && status.toUpperCase().startsWith('SUCC')) {
          alertApi.post({
            message: 'Cluster provisioning completed successfully.',
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
        setJobProgress(typeof job.progress === 'number' ? Math.max(0, job.progress) : 0);
        const message = job.error || null;
        setJobError(message);
        handleTerminalJob(job.status, message);
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
        setJobError(message);
        clearPoller();
      }
    },
    [authApi, clearPoller, discoveryApi, fetchApi, handleTerminalJob, identityApi],
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

  const validateStep = (stepIndex: number): string | null => {
    if (stepIndex === 0) {
      if (!form.projectId?.trim()) {
        return 'Project ID is required.';
      }
      if (!form.clusterId?.trim()) {
        return 'Cluster ID is required.';
      }
      if (!form.region?.trim()) {
        return 'Region is required.';
      }
      if (form.mode === 'provision') {
        if (!form.awsAccountId?.trim()) {
          return 'AWS account is required for provisioning.';
        }
        if (!form.awsRoleArn?.trim()) {
          return 'Provide the cross-account role ARN expected by the controller.';
        }
      }
      return null;
    }

    if (stepIndex === 1) {
      if (form.mode === 'provision') {
        if (nodePools.length === 0) {
          return 'At least one node pool is required.';
        }
        const hasInvalidPool = nodePools.some(
          pool => !pool.name?.trim() || !pool.instanceType?.trim(),
        );
        if (hasInvalidPool) {
          return 'All node pools must have a name and instance type.';
        }
        return null;
      }
      if (!form.importSecretName?.trim()) {
        return 'Choose a secret that contains the kubeconfig to import.';
      }
      return null;
    }

    if (stepIndex === 2) {
      if (form.mode === 'import' && !form.importSecretName?.trim()) {
        return 'Import workflows require a kubeconfig secret.';
      }
      return null;
    }
    return null;
  };

  const handleNext = () => {
    const error = validateStep(activeStep);
    if (error) {
      setStepError(error);
      return;
    }
    setStepError(null);
    setActiveStep(prev => Math.min(wizardSteps.length - 1, prev + 1));
  };

  const handleBack = () => {
    setStepError(null);
    setActiveStep(prev => Math.max(0, prev - 1));
  };

  const handleSubmit = async () => {
    const reviewError = validateStep(2);
    if (reviewError) {
      setStepError(reviewError);
      return;
    }
    setSubmitting(true);
    setStepError(null);
    setJobError(null);
    try {
      const { job } = await createCluster(
        fetchApi,
        discoveryApi,
        identityApi,
        authApi,
        {
          projectId: form.projectId,
          clusterId: form.clusterId,
          provider: 'aws',
          region: form.region,
        },
      );
      setJobId(job.id);
      setJobStatus(job.status);
      setJobProgress(job.progress ?? 0);
      persistStoredJob({
        jobId: job.id,
        projectId: form.projectId,
        clusterId: form.clusterId,
        provider: 'aws',
        region: form.region,
      });
      alertApi.post({
        message: `Cluster request ${job.id} submitted to the controller.`,
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
      setJobError(message);
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
        region: stored.region ?? prev.region,
      }));
      setJobId(stored.jobId);
      setJobStatus('RESUMING');
      setJobProgress(0);
      startPolling(stored.jobId);
    } catch (err) {
      window.localStorage.removeItem(JOB_STORAGE_KEY);
    }
  }, [startPolling]);

  useEffect(() => clearPoller, [clearPoller]);

  const normalizedProgress = Math.min(100, Math.max(0, jobProgress ?? 0));
  const timeline = buildJobTimeline(jobStatus, jobError);
  const jobStatusLabel = jobStatus ? jobStatus.toString() : 'Not started';

  return (
    <Page themeId="tool">
      <Content className={classes.content}>
        <ContentHeader title="Cluster wizard">
          <Typography variant="body2" className={classes.helperText}>
            Provision new clusters or import existing ones with progressive disclosure that mirrors the ProjectInfra schema.
          </Typography>
        </ContentHeader>

        <div className={classes.wizardGrid}>
          <Paper elevation={0} className={classes.statusPanel}>
            <Stepper
              activeStep={activeStep}
              alternativeLabel
              className={classes.stepperRoot}
            >
              {wizardSteps.map((step, index) => (
                <Step key={step.id} completed={activeStep > index}>
                  <StepLabel>{step.title}</StepLabel>
                </Step>
              ))}
            </Stepper>

            <Divider />

            <div className={classes.stepContent}>
              {wizardSteps.map((step, index) => (
                <Collapse key={step.id} in={activeStep === index} mountOnEnter unmountOnExit>
                  <Card elevation={0} className={classes.nodePoolCard}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        {step.title}
                      </Typography>
                      <Typography variant="body2" className={classes.helperText} gutterBottom>
                        {step.description}
                      </Typography>

                      {index === 0 && (
                        <div className={classes.formGrid}>
                          <TextField
                            label="Project ID"
                            variant="outlined"
                            value={form.projectId}
                            onChange={handleFormChange('projectId')}
                            required
                          />
                          <TextField
                            label="Cluster ID"
                            variant="outlined"
                            value={form.clusterId}
                            onChange={handleFormChange('clusterId')}
                            required
                            helperText="Must align with ProjectInfra metadata.name"
                          />
                          <TextField
                            label="AWS account"
                            variant="outlined"
                            value={form.awsAccountId}
                            onChange={handleFormChange('awsAccountId')}
                            required={form.mode === 'provision'}
                            helperText={
                              form.mode === 'provision'
                                ? 'Controller assumes this account owns the cluster resources.'
                                : 'Optional when importing via secret.'
                            }
                          />
                          <TextField
                            label="Role ARN"
                            variant="outlined"
                            value={form.awsRoleArn}
                            onChange={handleFormChange('awsRoleArn')}
                            required={form.mode === 'provision'}
                            helperText="Pulumi automation will assume this role"
                          />
                          <FormControl variant="outlined">
                            <InputLabel id="region-select">Region</InputLabel>
                            <Select
                              labelId="region-select"
                              value={form.region}
                              onChange={handleFormChange('region')}
                              label="Region"
                            >
                              <MenuItem value="us-gov-west-1">us-gov-west-1</MenuItem>
                              <MenuItem value="us-gov-east-1">us-gov-east-1</MenuItem>
                              <MenuItem value="us-east-1">us-east-1</MenuItem>
                              <MenuItem value="eu-central-1">eu-central-1</MenuItem>
                            </Select>
                          </FormControl>
                          <div className={classes.workflowToggle} style={{ gridColumn: 'span 2' }}>
                            <Typography variant="subtitle2">Workflow</Typography>
                            <div className={classes.workflowButtons}>
                              <Button
                                variant={form.mode === 'provision' ? 'contained' : 'outlined'}
                                color="primary"
                                onClick={() => handleModeToggle('provision')}
                              >
                                Provision new
                              </Button>
                              <Button
                                variant={form.mode === 'import' ? 'contained' : 'outlined'}
                                color="primary"
                                onClick={() => handleModeToggle('import')}
                              >
                                Import existing
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}

                      {index === 1 && (
                        <>
                          {form.mode === 'provision' ? (
                            <>
                              <Typography variant="subtitle1" gutterBottom>
                                Node pools
                              </Typography>
                              <Typography variant="body2" className={classes.helperText}>
                                Defaults mirror Pulumi’s <code>defaultNodePools()</code> helper. Toggle advanced knobs to expose taints, labels, and additional clusters.
                              </Typography>
                              <div className={classes.nodePoolList}>
                                {nodePools.map((pool, indexPool) => (
                                  <Card key={pool.id} elevation={0} className={classes.nodePoolCard}>
                                    <CardContent>
                                      <Grid container spacing={2}>
                                        <Grid item xs={12} sm={6} md={4}>
                                          <TextField
                                            label="Node pool name"
                                            variant="outlined"
                                            fullWidth
                                            value={pool.name}
                                            onChange={handleNodePoolChange(indexPool, 'name')}
                                          />
                                        </Grid>
                                        <Grid item xs={12} sm={6} md={4}>
                                          <TextField
                                            label="Instance type"
                                            variant="outlined"
                                            fullWidth
                                            value={pool.instanceType}
                                            onChange={handleNodePoolChange(indexPool, 'instanceType')}
                                          />
                                        </Grid>
                                        <Grid item xs={6} sm={3} md={2}>
                                          <TextField
                                            label="Min nodes"
                                            variant="outlined"
                                            type="number"
                                            fullWidth
                                            value={pool.minNodes}
                                            onChange={handleNodePoolChange(indexPool, 'minNodes')}
                                          />
                                        </Grid>
                                        <Grid item xs={6} sm={3} md={2}>
                                          <TextField
                                            label="Max nodes"
                                            variant="outlined"
                                            type="number"
                                            fullWidth
                                            value={pool.maxNodes}
                                            onChange={handleNodePoolChange(indexPool, 'maxNodes')}
                                          />
                                        </Grid>
                                        <Grid item xs={12} sm={6} md={4}>
                                          <TextField
                                            label="GPU profile"
                                            variant="outlined"
                                            fullWidth
                                            value={pool.gpuProfile}
                                            onChange={handleNodePoolChange(indexPool, 'gpuProfile')}
                                          />
                                        </Grid>
                                        {showAdvancedTopology && (
                                          <>
                                            <Grid item xs={12} md={4}>
                                              <TextField
                                                label="Labels"
                                                variant="outlined"
                                                fullWidth
                                                value={pool.labels ?? ''}
                                                onChange={handleNodePoolChange(indexPool, 'labels')}
                                                placeholder="key=value,key2=value2"
                                              />
                                            </Grid>
                                            <Grid item xs={12} md={4}>
                                              <TextField
                                                label="Taints"
                                                variant="outlined"
                                                fullWidth
                                                value={pool.taints ?? ''}
                                                onChange={handleNodePoolChange(indexPool, 'taints')}
                                                placeholder="key=value:NoSchedule"
                                              />
                                            </Grid>
                                          </>
                                        )}
                                      </Grid>
                                      <Box marginTop={2} display="flex" justifyContent="space-between">
                                        <Typography variant="caption" color="textSecondary">
                                          Est. ${pool.estimatedHourly}/node hr
                                        </Typography>
                                        {nodePools.length > 1 && (
                                          <Button color="secondary" onClick={() => removeNodePool(indexPool)}>
                                            Remove pool
                                          </Button>
                                        )}
                                      </Box>
                                    </CardContent>
                                  </Card>
                                ))}
                              </div>
                              <div className={classes.nodePoolActions}>
                                <Button variant="outlined" color="primary" onClick={addNodePool}>
                                  Add node pool
                                </Button>
                                <div className={classes.advancedActions}>
                                  <FormControlLabel
                                    control={
                                      <Switch
                                        color="primary"
                                        checked={showAdvancedTopology}
                                        onChange={event => setShowAdvancedTopology(event.target.checked)}
                                      />
                                    }
                                    label="Show advanced topology"
                                  />
                                  {showAdvancedTopology && (
                                    <Button color="primary" onClick={addAdditionalCluster}>
                                      Add cluster
                                    </Button>
                                  )}
                                </div>
                              </div>

                              {showAdvancedTopology && (
                                <div className={classes.additionalClusterList}>
                                  <Typography variant="subtitle1">Additional clusters</Typography>
                                  {additionalClusters.map((cluster, idx) => (
                                    <Card key={cluster.id} elevation={0} className={classes.nodePoolCard}>
                                      <CardContent>
                                        <Grid container spacing={2}>
                                          <Grid item xs={12} sm={4}>
                                            <TextField
                                              label="Cluster ID"
                                              variant="outlined"
                                              fullWidth
                                              value={cluster.id}
                                              onChange={handleAdditionalClusterChange(idx, 'id')}
                                            />
                                          </Grid>
                                          <Grid item xs={12} sm={4}>
                                            <TextField
                                              label="Region"
                                              variant="outlined"
                                              fullWidth
                                              value={cluster.region}
                                              onChange={handleAdditionalClusterChange(idx, 'region')}
                                            />
                                          </Grid>
                                          <Grid item xs={12} sm={4}>
                                            <TextField
                                              label="Purpose"
                                              variant="outlined"
                                              fullWidth
                                              value={cluster.purpose}
                                              onChange={handleAdditionalClusterChange(idx, 'purpose')}
                                            />
                                          </Grid>
                                        </Grid>
                                        <Box marginTop={2} display="flex" justifyContent="flex-end">
                                          <Button color="secondary" onClick={() => removeAdditionalCluster(idx)}>
                                            Remove cluster
                                          </Button>
                                        </Box>
                                      </CardContent>
                                    </Card>
                                  ))}
                                </div>
                              )}

                              <Divider style={{ marginTop: 24, marginBottom: 16 }} />
                              <FormControlLabel
                                control={
                                  <Switch
                                    color="primary"
                                    checked={showPlatformIntegration}
                                    onChange={event => setShowPlatformIntegration(event.target.checked)}
                                  />
                                }
                                label="Platform integration"
                              />

                              <Collapse in={showPlatformIntegration}>
                                <div className={classes.platformGrid}>
                                  <TextField
                                    label="Helm namespace"
                                    variant="outlined"
                                    value={form.helmNamespace}
                                    onChange={handleFormChange('helmNamespace')}
                                  />
                                  <TextField
                                    label="Helm chart version"
                                    variant="outlined"
                                    value={form.helmVersion}
                                    onChange={handleFormChange('helmVersion')}
                                  />
                                  <TextField
                                    label="Platform API endpoint"
                                    variant="outlined"
                                    value={form.platformEndpoint}
                                    onChange={handleFormChange('platformEndpoint')}
                                    placeholder="https://platform.example.gov"
                                  />
                                </div>
                              </Collapse>
                            </>
                          ) : (
                            <div className={classes.importStack}>
                              <Typography variant="subtitle1">
                                Import secret
                              </Typography>
                              <Typography variant="body2" className={classes.helperText}>
                                Provide the secret that contains the kubeconfig payload. The controller expects keys like <code>{`${form.clusterId}.kubeconfig`}</code>.
                              </Typography>
                              <TextField
                                label="Secret name"
                                variant="outlined"
                                value={form.importSecretName}
                                onChange={handleFormChange('importSecretName')}
                                required
                              />
                              <TextField
                                label="Namespace"
                                variant="outlined"
                                value={form.importSecretNamespace}
                                onChange={handleFormChange('importSecretNamespace')}
                                helperText="Defaults to aegis-secrets"
                              />
                              <Card elevation={0} className={classes.nodePoolCard}>
                                <CardContent>
                                  <Typography variant="subtitle2">Expected keys</Typography>
                                  <Typography variant="body2" className={classes.helperText}>
                                    {`${form.clusterId}.kubeconfig`} · {`${form.clusterId}.ca`} · {`${form.clusterId}.token`}
                                  </Typography>
                                </CardContent>
                              </Card>
                            </div>
                          )}
                        </>
                      )}

                      {index === 2 && (
                        <>
                          <Typography variant="body1">
                            Double-check the derived configuration before handing control to Pulumi automation. Provisioning typically completes within ~15 minutes depending on AWS quotas.
                          </Typography>
                          <div className={classes.reviewGroup}>
                            <Paper elevation={0} className={classes.reviewCard}>
                              <Typography variant="subtitle2">Access</Typography>
                              <Typography variant="body2">
                                <strong>Project:</strong> {form.projectId}
                              </Typography>
                              <Typography variant="body2">
                                <strong>Region:</strong> {form.region}
                              </Typography>
                              <Typography variant="body2">
                                <strong>AWS account:</strong> {form.awsAccountId || 'n/a'}
                              </Typography>
                              <Typography variant="body2">
                                <strong>Role:</strong> {form.awsRoleArn || 'n/a'}
                              </Typography>
                            </Paper>

                            <Paper elevation={0} className={classes.reviewCard}>
                              <Typography variant="subtitle2">Topology</Typography>
                              {form.mode === 'import' ? (
                                <Typography variant="body2">
                                  Importing from secret <strong>{form.importSecretNamespace}/{form.importSecretName || '—'}</strong>
                                </Typography>
                              ) : (
                                <>
                                  <Typography variant="body2">
                                    {nodePools.length} node pool{nodePools.length === 1 ? '' : 's'} · up to {totalMaxNodes} nodes
                                  </Typography>
                                  <Typography variant="body2">
                                    {derivedClusterCount} cluster{derivedClusterCount === 1 ? '' : 's'} orchestrated via Pulumi
                                  </Typography>
                                </>
                              )}
                              <Typography variant="body2">
                                Helm namespace {form.helmNamespace} · chart {form.helmVersion}
                              </Typography>
                            </Paper>

                            <Paper elevation={0} className={classes.reviewCard}>
                              <Typography variant="subtitle2">Launch summary</Typography>
                              <Typography variant="body2">
                                <strong>Workflow:</strong> {form.mode === 'provision' ? 'Provision new infrastructure' : 'Import existing cluster'}
                              </Typography>
                              <Typography variant="body2">
                                <strong>Estimated hourly spend:</strong> {form.mode === 'import' ? '$0 (import only)' : formatCurrency(estimatedHourly)}
                              </Typography>
                              <Typography variant="body2">
                                Outputs: kubeconfig secrets, Helm release status, observability endpoints
                              </Typography>
                            </Paper>
                          </div>
                          <Typography variant="body2" color="textSecondary">
                            Provisioning typically takes ~12 minutes. Once ready, use the quick actions below to download kubeconfigs, copy API endpoints, or jump into diagnostics if something drifts.
                          </Typography>
                        </>
                      )}

                      {stepError && (
                        <Box marginTop={2}>
                          <WarningPanel severity="error" title="Cannot continue yet">
                            {stepError}
                          </WarningPanel>
                        </Box>
                      )}

                      <Box marginTop={3} display="flex" justifyContent="space-between">
                        <Button onClick={handleBack} disabled={index === 0}>
                          Back
                        </Button>
                        {index < wizardSteps.length - 1 ? (
                          <Button color="primary" variant="contained" onClick={handleNext}>
                            Continue
                          </Button>
                        ) : (
                          <Button
                            color="primary"
                            variant="contained"
                            onClick={handleSubmit}
                            disabled={submitting || jobActive}
                            startIcon={<LaunchIcon />}
                          >
                            {form.mode === 'provision' ? 'Launch provisioning' : 'Import cluster'}
                          </Button>
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                </Collapse>
              ))}
            </div>
          </Paper>

          <Paper elevation={0} className={classes.statusPanel}>
            <Typography variant="h6">Provisioning status</Typography>
            <Typography variant="body2" color="textSecondary">
              Track controller phases and Pulumi milestones as they stream back into the platform.
            </Typography>

            {jobId ? (
              <>
                <Typography variant="subtitle2">Job {jobId}</Typography>
                <Typography variant="body2">Status: {jobStatusLabel}</Typography>
                <LinearProgress variant="determinate" value={normalizedProgress} />
                <Stepper orientation="vertical">
                  {timeline.map(item => (
                    <Step
                      key={item.label}
                      active={item.status === 'active'}
                      completed={item.status === 'complete'}
                    >
                      <StepLabel error={item.status === 'error'}>{item.label}</StepLabel>
                      {item.helper && (
                        <StepContent>
                          <Typography variant="body2" color="textSecondary">
                            {item.helper}
                          </Typography>
                        </StepContent>
                      )}
                    </Step>
                  ))}
                </Stepper>

                {jobError && (
                  <WarningPanel severity="error" title="Remediation">
                    {jobError}
                  </WarningPanel>
                )}

                <div className={classes.quickActions}>
                  <Button
                    variant="outlined"
                    color="primary"
                    startIcon={<CloudDownloadIcon />}
                    disabled={!jobStatus?.toUpperCase().startsWith('SUCC')}
                  >
                    Download kubeconfig
                  </Button>
                  <Button
                    variant="outlined"
                    color="primary"
                    startIcon={<AssessmentIcon />}
                    disabled={!jobStatus?.toUpperCase().startsWith('SUCC')}
                  >
                    View Helm add-ons
                  </Button>
                  <Button variant="outlined" startIcon={<RefreshIcon />} disabled={jobActive} onClick={() => jobId && startPolling(jobId)}>
                    Refresh status
                  </Button>
                  <Button variant="outlined" startIcon={<ReplayIcon />} disabled={!jobError}>
                    Retry apply
                  </Button>
                </div>
              </>
            ) : (
              <Typography variant="body2" color="textSecondary">
                Submit the wizard to start provisioning. Status updates and Pulumi logs will appear here with remediation tips if anything fails.
              </Typography>
            )}
          </Paper>
        </div>
      </Content>
    </Page>
  );
};
