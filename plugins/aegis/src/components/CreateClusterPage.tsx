import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
} from '@backstage/core-plugin-api';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Collapse,
  Divider,
  FormControl,
  FormControlLabel,
  FormHelperText,
  Grid,
  IconButton,
  LinearProgress,
  MenuItem,
  Radio,
  RadioGroup,
  Step,
  StepLabel,
  Stepper,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import AddCircleOutlineIcon from '@material-ui/icons/AddCircleOutline';
import CloudDownloadIcon from '@material-ui/icons/CloudDownload';
import ContentCopyIcon from '@material-ui/icons/FileCopyOutlined';
import DeleteOutlineIcon from '@material-ui/icons/DeleteOutline';
import ExpandLessIcon from '@material-ui/icons/ExpandLess';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import LayersIcon from '@material-ui/icons/Layers';
import LaunchIcon from '@material-ui/icons/Launch';
import RefreshIcon from '@material-ui/icons/Refresh';
import SecurityIcon from '@material-ui/icons/Security';
import StorageIcon from '@material-ui/icons/Storage';
import TimelineIcon from '@material-ui/icons/Timeline';
import { useLocation } from 'react-router-dom';
import {
  AuthenticationError,
  AuthorizationError,
  ClusterJob,
  ClusterMode,
  ClusterTaint,
  CreateClusterRequest,
  createCluster,
  getClusterJobStatus,
} from '../api/aegisClient';
import { keycloakAuthApiRef } from '../api/refs';

type NodePoolInput = {
  id: string;
  name: string;
  instanceType: string;
  minSize: number;
  maxSize: number;
  desiredSize: number;
  gpu: boolean;
  spot: boolean;
  labelsText: string;
  taintsText: string;
  expanded: boolean;
};

type ClusterInput = {
  id: string;
  clusterId: string;
  displayName: string;
  kubernetesVersion: string;
  nodePools: NodePoolInput[];
  expanded: boolean;
};

type WizardState = {
  projectId: string;
  awsAccountId: string;
  assumeRoleArn: string;
  region: string;
  mode: ClusterMode;
  importSecretName: string;
  importSecretNamespace: string;
  importSecretKeys: string;
  clusters: ClusterInput[];
  helmNamespace: string;
  helmChartVersion: string;
  helmValues: string;
  platformApiEndpoint: string;
  platformMetricsEndpoint: string;
  platformLoggingEndpoint: string;
  showPlatformIntegration: boolean;
  showAdvancedTopology: boolean;
};

type StoredClusterJob = {
  jobId: string;
  projectId: string;
  clusterId?: string;
  mode?: ClusterMode;
  form?: Partial<WizardState>;
};

type TimelineStep = {
  id: string;
  label: string;
  defaultMessage: string;
};

type TimelineState = {
  id: string;
  status: 'pending' | 'active' | 'complete' | 'error';
  timestamp?: string;
  message?: string;
  reason?: string;
};

type LocationState = {
  projectId?: string;
  region?: string;
  clusterId?: string;
  mode?: ClusterMode;
};

const CLUSTER_JOB_STORAGE_KEY = 'aegis.clusterJobState.v2';
const POLL_INTERVAL_MS = 5000;
const DEFAULT_REGION = 'us-east-1';
const DEFAULT_VERSION = '1.29';

const STEPS = [
  'Context & Access',
  'Topology & Scaling',
  'Review & Launch',
];

const TIMELINE_STEPS: TimelineStep[] = [
  {
    id: 'SPEC_SUBMITTED',
    label: 'Spec submitted',
    defaultMessage:
      'Cluster definition accepted by the control plane and awaiting Pulumi automation.',
  },
  {
    id: 'PULUMI_REFRESH',
    label: 'Pulumi stack refresh',
    defaultMessage:
      'Reconciling the latest infrastructure state before applying desired changes.',
  },
  {
    id: 'PULUMI_APPLY',
    label: 'Pulumi apply',
    defaultMessage:
      'Provisioning or updating infrastructure resources via Pulumi automation.',
  },
  {
    id: 'KUBECONFIGS_SYNCED',
    label: 'Kubeconfigs synced',
    defaultMessage:
      'Kubeconfig secrets synced into the ÆGIS control plane for downstream access.',
  },
  {
    id: 'CLUSTERS_REGISTERED',
    label: 'Clusters registered',
    defaultMessage:
      'Clusters registered with the ÆGIS hub and ready for workspace routing.',
  },
];

const INSTANCE_COSTS: Record<string, number> = {
  'm5.large': 0.096,
  'm5.xlarge': 0.192,
  'm5.2xlarge': 0.384,
  'm5.4xlarge': 0.768,
  'm6i.xlarge': 0.226,
  'm6i.2xlarge': 0.452,
  'c6i.xlarge': 0.204,
  'c6i.2xlarge': 0.408,
  'g5.xlarge': 1.212,
  'g5.2xlarge': 1.58,
  'g5.12xlarge': 5.34,
};

const useStyles = makeStyles(theme => ({
  root: {
    paddingBottom: theme.spacing(6),
  },
  stepperCard: {
    padding: theme.spacing(3),
  },
  actionsRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: theme.spacing(3),
    gap: theme.spacing(2),
    flexWrap: 'wrap',
  },
  statusCard: {
    padding: theme.spacing(3),
  },
  timelineStepper: {
    backgroundColor: 'transparent',
  },
  timelineLabel: {
    display: 'flex',
    flexDirection: 'column',
  },
  nodePoolCard: {
    borderRadius: 16,
    border: `1px solid ${theme.palette.divider}`,
    padding: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
  clusterCard: {
    borderRadius: 18,
    border: `1px solid ${theme.palette.divider}`,
    marginBottom: theme.spacing(3),
  },
  cardHeader: {
    alignItems: 'flex-start',
  },
  optionalLabel: {
    marginLeft: theme.spacing(1),
    color: theme.palette.text.secondary,
  },
  chipGroup: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    marginTop: theme.spacing(1),
  },
  clusterHeaderActions: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  nodePoolButtons: {
    display: 'flex',
    gap: theme.spacing(1),
  },
  wizardButtonRow: {
    display: 'flex',
    gap: theme.spacing(1),
  },
  statusChipRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(2),
  },
  outputsList: {
    marginTop: theme.spacing(2),
    display: 'grid',
    gap: theme.spacing(2),
  },
  outputCard: {
    borderRadius: 12,
    border: `1px dashed ${theme.palette.divider}`,
    padding: theme.spacing(2),
  },
  quickActions: {
    display: 'flex',
    gap: theme.spacing(1.5),
    flexWrap: 'wrap',
  },
  emptyStatus: {
    padding: theme.spacing(2),
    borderRadius: 12,
    border: `1px dashed ${theme.palette.divider}`,
    color: theme.palette.text.secondary,
  },
  sectionTitle: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(1),
  },
  helperText: {
    marginTop: theme.spacing(1),
  },
  tableWrapper: {
    marginTop: theme.spacing(2),
    borderRadius: 12,
    border: `1px solid ${theme.palette.divider}`,
  },
  advancedToggle: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing(1),
  },
}));

const generateId = () => Math.random().toString(36).slice(2);

const defaultNodePools = (): NodePoolInput[] => [
  {
    id: generateId(),
    name: 'system-pool',
    instanceType: 'm5.large',
    minSize: 1,
    maxSize: 3,
    desiredSize: 1,
    gpu: false,
    spot: false,
    labelsText: 'node-role.kubernetes.io/control-plane=true',
    taintsText: 'node-role.kubernetes.io/control-plane=true:NoSchedule',
    expanded: false,
  },
  {
    id: generateId(),
    name: 'workload-pool',
    instanceType: 'm5.2xlarge',
    minSize: 2,
    maxSize: 10,
    desiredSize: 3,
    gpu: false,
    spot: true,
    labelsText: 'aegis.dev/workload=true',
    taintsText: '',
    expanded: false,
  },
];

const defaultCluster = (clusterId = 'primary'): ClusterInput => ({
  id: generateId(),
  clusterId,
  displayName: clusterId,
  kubernetesVersion: DEFAULT_VERSION,
  nodePools: defaultNodePools(),
  expanded: true,
});

const parseKeyValuePairs = (value: string): Record<string, string> | undefined => {
  const pairs: Record<string, string> = {};
  value
    .split(/\n|,/)
    .map(item => item.trim())
    .filter(item => item.length > 0)
    .forEach(item => {
      const [key, rawValue] = item.split('=').map(part => part?.trim());
      if (key) {
        pairs[key] = rawValue ?? '';
      }
    });

  return Object.keys(pairs).length > 0 ? pairs : undefined;
};

const parseTaints = (value: string): ClusterTaint[] | undefined => {
  const taints: ClusterTaint[] = [];
  value
    .split(/\n|,/)
    .map(item => item.trim())
    .filter(item => item.length > 0)
    .forEach(item => {
      const [pair, effect] = item.split(':').map(part => part?.trim());
      if (!pair) {
        return;
      }
      const [key, rawValue] = pair.split('=').map(part => part?.trim());
      if (!key) {
        return;
      }
      taints.push({ key, value: rawValue, effect });
    });

  return taints.length > 0 ? taints : undefined;
};

const parseList = (value: string): string[] | undefined => {
  const items = value
    .split(/\n|,/)
    .map(item => item.trim())
    .filter(item => item.length > 0);
  return items.length > 0 ? items : undefined;
};

const formatCurrency = (value: number, currency = 'USD'): string => {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(value);
  } catch (err) {
    return `$${value.toFixed(2)}`;
  }
};

const estimateHourlyCost = (form: WizardState): number => {
  if (form.mode === 'import') {
    return 0;
  }

  return form.clusters.reduce((clusterSum, cluster) => {
    const poolSum = cluster.nodePools.reduce((sum, pool) => {
      const rate = INSTANCE_COSTS[pool.instanceType] ?? (pool.gpu ? 4.5 : 0.25);
      return sum + rate * Math.max(pool.desiredSize, 0);
    }, 0);
    return clusterSum + poolSum;
  }, 0);
};

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
    normalized === 'ERROR' ||
    normalized === 'CANCELLED' ||
    normalized === 'CANCELED'
  );
};

export const CreateClusterPage = () => {
  const classes = useStyles();
  const fetchApi = useApi(fetchApiRef);
  const discoveryApi = useApi(discoveryApiRef);
  const identityApi = useApi(identityApiRef);
  const authApi = useApi(keycloakAuthApiRef);
  const alertApi = useApi(alertApiRef);
  const location = useLocation();

  const [activeStep, setActiveStep] = useState(0);
  const [form, setForm] = useState<WizardState>({
    projectId: '',
    awsAccountId: '',
    assumeRoleArn: '',
    region: DEFAULT_REGION,
    mode: 'provision',
    importSecretName: '',
    importSecretNamespace: 'aegis-clusters',
    importSecretKeys: '',
    clusters: [defaultCluster()],
    helmNamespace: 'aegis-system',
    helmChartVersion: '',
    helmValues: '',
    platformApiEndpoint: '',
    platformMetricsEndpoint: '',
    platformLoggingEndpoint: '',
    showPlatformIntegration: false,
    showAdvancedTopology: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [job, setJob] = useState<ClusterJob | null>(null);
  const [jobError, setJobError] = useState<string | null>(null);
  const pollerRef = useRef<ReturnType<typeof setInterval>>();

  const locationState = (location.state ?? undefined) as LocationState | undefined;

  useEffect(() => {
    if (!locationState) {
      return;
    }
    setForm(prev => ({
      ...prev,
      projectId: locationState.projectId ?? prev.projectId,
      region: locationState.region ?? prev.region,
      mode: locationState.mode ?? prev.mode,
      clusters: prev.clusters.map((cluster, index) =>
        index === 0 && locationState.clusterId
          ? {
              ...cluster,
              clusterId: locationState.clusterId,
              displayName: locationState.clusterId,
            }
          : cluster,
      ),
    }));
  }, [locationState]);

  const clearPoller = useCallback(() => {
    if (pollerRef.current) {
      clearInterval(pollerRef.current);
      pollerRef.current = undefined;
    }
  }, []);

  const persistJob = useCallback((stored: StoredClusterJob | null) => {
    if (typeof window === 'undefined') {
      return;
    }
    if (!stored) {
      window.localStorage.removeItem(CLUSTER_JOB_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(CLUSTER_JOB_STORAGE_KEY, JSON.stringify(stored));
  }, []);

  const jobActive = Boolean(job && !isTerminalStatus(job.status));

  const handleTerminalJob = useCallback(
    (state: ClusterJob | null) => {
      if (!state) {
        return;
      }
      if (isTerminalStatus(state.status)) {
        clearPoller();
        persistJob(null);
        if (state.status.toUpperCase().startsWith('SUCC')) {
          alertApi.post({
            message: 'Cluster provisioning completed successfully.',
            severity: 'success',
          });
        }
        if (state.status.toUpperCase().includes('FAIL') || state.status.toUpperCase() === 'ERROR') {
          alertApi.post({
            message: state.error || 'Cluster provisioning failed. Review conditions for details.',
            severity: 'error',
          });
        }
      }
    },
    [alertApi, clearPoller, persistJob],
  );

  const fetchJobStatus = useCallback(
    async (jobId: string) => {
      try {
        const { job: nextJob } = await getClusterJobStatus(
          fetchApi,
          discoveryApi,
          identityApi,
          authApi,
          jobId,
        );
        setJob(nextJob);
        setJobError(nextJob.error ?? null);
        handleTerminalJob(nextJob);
      } catch (err: unknown) {
        let message = 'Unable to fetch cluster job status.';
        if (err instanceof AuthenticationError || err instanceof AuthorizationError) {
          message = err.message;
        } else if (err instanceof Error) {
          message = err.message || message;
        }
        setJobError(message);
        clearPoller();
      }
    },
    [authApi, clearPoller, discoveryApi, fetchApi, handleTerminalJob, identityApi],
  );

  const startPolling = useCallback(
    (jobId: string) => {
      clearPoller();
      fetchJobStatus(jobId);
      pollerRef.current = setInterval(() => fetchJobStatus(jobId), POLL_INTERVAL_MS);
    },
    [clearPoller, fetchJobStatus],
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      const raw = window.localStorage.getItem(CLUSTER_JOB_STORAGE_KEY);
      if (!raw) {
        return;
      }
      const stored: StoredClusterJob = JSON.parse(raw);
      if (!stored?.jobId) {
        window.localStorage.removeItem(CLUSTER_JOB_STORAGE_KEY);
        return;
      }
      setForm(prev => ({
        ...prev,
        ...(stored.form ?? {}),
      }));
      startPolling(stored.jobId);
    } catch (err) {
      window.localStorage.removeItem(CLUSTER_JOB_STORAGE_KEY);
    }
  }, [startPolling]);

  useEffect(() => clearPoller, [clearPoller]);

  const estimatedCost = useMemo(() => estimateHourlyCost(form), [form]);
  const formattedCost = estimatedCost > 0 ? formatCurrency(estimatedCost) : 'Included';

  const step1Valid = useMemo(() => {
    const projectOk = form.projectId.trim().length > 0;
    const regionOk = form.region.trim().length > 0;
    const accountOk = form.awsAccountId.trim().length > 0 || form.assumeRoleArn.trim().length > 0;
    return projectOk && regionOk && accountOk;
  }, [form.projectId, form.region, form.awsAccountId, form.assumeRoleArn]);

  const step2Valid = useMemo(() => {
    if (form.mode === 'import') {
      return form.importSecretName.trim().length > 0;
    }
    return form.clusters.every(cluster => {
      if (!cluster.clusterId.trim()) {
        return false;
      }
      return cluster.nodePools.every(pool =>
        Boolean(pool.name.trim()) &&
        Boolean(pool.instanceType.trim()) &&
        pool.minSize >= 0 &&
        pool.maxSize >= pool.minSize &&
        pool.desiredSize >= pool.minSize,
      );
    });
  }, [form]);

  const activeStepValid = activeStep === 0 ? step1Valid : activeStep === 1 ? step2Valid : step1Valid && step2Valid;

  const updateForm = <T extends keyof WizardState>(field: T, value: WizardState[T]) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const updateCluster = (clusterId: string, updater: (cluster: ClusterInput) => ClusterInput) => {
    setForm(prev => ({
      ...prev,
      clusters: prev.clusters.map(cluster =>
        cluster.id === clusterId ? updater(cluster) : cluster,
      ),
    }));
  };

  const updateNodePool = (
    clusterId: string,
    poolId: string,
    updater: (pool: NodePoolInput) => NodePoolInput,
  ) => {
    updateCluster(clusterId, cluster => ({
      ...cluster,
      nodePools: cluster.nodePools.map(pool =>
        pool.id === poolId ? updater(pool) : pool,
      ),
    }));
  };

  const addNodePool = (clusterId: string, gpu = false) => {
    const newPool: NodePoolInput = {
      id: generateId(),
      name: gpu ? 'gpu-accelerator' : 'additional-pool',
      instanceType: gpu ? 'g5.12xlarge' : 'm6i.xlarge',
      minSize: 0,
      maxSize: gpu ? 4 : 6,
      desiredSize: gpu ? 1 : 2,
      gpu,
      spot: !gpu,
      labelsText: gpu ? 'aegis.dev/gpu=true' : '',
      taintsText: gpu ? 'nvidia.com/gpu=true:NoSchedule' : '',
      expanded: true,
    };
    updateCluster(clusterId, cluster => ({
      ...cluster,
      nodePools: [...cluster.nodePools, newPool],
    }));
  };

  const removeNodePool = (clusterId: string, poolId: string) => {
    updateCluster(clusterId, cluster => ({
      ...cluster,
      nodePools: cluster.nodePools.filter(pool => pool.id !== poolId),
    }));
  };

  const addAdditionalCluster = () => {
    setForm(prev => ({
      ...prev,
      clusters: [...prev.clusters, defaultCluster(`cluster-${prev.clusters.length + 1}`)],
    }));
  };

  const removeCluster = (clusterId: string) => {
    setForm(prev => ({
      ...prev,
      clusters: prev.clusters.length > 1 ? prev.clusters.filter(c => c.id !== clusterId) : prev.clusters,
    }));
  };

  const handleNext = () => {
    if (activeStep < STEPS.length - 1) {
      setActiveStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (activeStep > 0) {
      setActiveStep(prev => prev - 1);
    }
  };

  const buildRequest = (): CreateClusterRequest => {
    const topology =
      form.mode === 'provision'
        ? {
            clusters: form.clusters.map(cluster => ({
              clusterId: cluster.clusterId,
              name: cluster.displayName || cluster.clusterId,
              kubernetesVersion: cluster.kubernetesVersion,
              nodePools: cluster.nodePools.map(pool => ({
                name: pool.name,
                instanceType: pool.instanceType,
                minSize: pool.minSize,
                maxSize: pool.maxSize,
                desiredSize: pool.desiredSize,
                gpu: pool.gpu,
                spot: pool.spot,
                labels: parseKeyValuePairs(pool.labelsText),
                taints: parseTaints(pool.taintsText),
              })),
            })),
          }
        : undefined;

    const importSpec =
      form.mode === 'import'
        ? {
            kubeconfigSecret: {
              name: form.importSecretName,
              namespace: form.importSecretNamespace || undefined,
              keys: parseList(form.importSecretKeys),
            },
          }
        : undefined;

    const platform =
      form.showPlatformIntegration || form.helmChartVersion || form.helmNamespace
        ? {
            helm: form.helmNamespace
              ? {
                  namespace: form.helmNamespace,
                  chartVersion: form.helmChartVersion || undefined,
                  values: form.helmValues ? { raw: form.helmValues } : undefined,
                }
              : undefined,
            overrides:
              form.platformApiEndpoint || form.platformMetricsEndpoint || form.platformLoggingEndpoint
                ? {
                    apiServer: form.platformApiEndpoint || undefined,
                    metricsEndpoint: form.platformMetricsEndpoint || undefined,
                    loggingEndpoint: form.platformLoggingEndpoint || undefined,
                  }
                : undefined,
          }
        : undefined;

    return {
      projectId: form.projectId,
      mode: form.mode,
      aws: {
        region: form.region,
        accountId: form.awsAccountId || undefined,
        assumeRoleArn: form.assumeRoleArn || undefined,
      },
      topology,
      import: importSpec,
      platform,
      metadata:
        estimatedCost > 0
          ? {
              estimatedHourlyCost: Number(estimatedCost.toFixed(2)),
              currency: 'USD',
            }
          : undefined,
    };
  };

  const handleSubmit = async () => {
    const request = buildRequest();
    setSubmitting(true);
    setJobError(null);

    try {
      const response = await createCluster(
        fetchApi,
        discoveryApi,
        identityApi,
        authApi,
        request,
      );
      setJob(response.job);
      persistJob({
        jobId: response.job.id,
        projectId: form.projectId,
        clusterId: response.job.clusterId || form.clusters[0]?.clusterId,
        mode: form.mode,
        form,
      });
      alertApi.post({
        message: `Cluster job ${response.job.id} submitted.`,
        severity: 'success',
      });
      setActiveStep(2);
      startPolling(response.job.id);
    } catch (err: unknown) {
      let message = 'Failed to submit cluster provisioning request.';
      if (err instanceof AuthenticationError || err instanceof AuthorizationError) {
        message = err.message;
      } else if (err instanceof Error) {
        message = err.message || message;
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

  const deriveTimeline = useMemo((): TimelineState[] => {
    return TIMELINE_STEPS.map(step => {
      const milestone = job?.milestones?.find(m => m.id === step.id || m.label === step.label);
      const condition = job?.conditions?.find(c => c.type === step.id || c.type === step.label);
      let status: TimelineState['status'] = 'pending';
      let timestamp = milestone?.timestamp || condition?.lastTransitionTime;
      let message = milestone?.details || condition?.message || step.defaultMessage;
      let reason = condition?.reason;

      if (milestone) {
        switch (milestone.status) {
          case 'COMPLETE':
            status = 'complete';
            break;
          case 'IN_PROGRESS':
            status = 'active';
            break;
          case 'ERROR':
            status = 'error';
            break;
          default:
            status = 'pending';
        }
      } else if (condition) {
        if (condition.status === 'True') {
          status = 'complete';
        } else if (condition.status === 'False') {
          status = 'error';
        } else if (condition.status === 'Unknown') {
          status = 'active';
        }
      }

      if (job?.status?.toUpperCase() === 'FAILED' && status === 'active') {
        status = 'error';
      }

      return { id: step.id, status, timestamp, message, reason };
    });
  }, [job]);

  const activeTimelineIndex = useMemo(() => {
    const activeIndex = deriveTimeline.findIndex(step => step.status === 'active');
    if (activeIndex >= 0) {
      return activeIndex;
    }
    const lastComplete = [...deriveTimeline].reverse().find(step => step.status === 'complete');
    if (lastComplete) {
      return deriveTimeline.findIndex(step => step.id === lastComplete.id);
    }
    return 0;
  }, [deriveTimeline]);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alertApi.post({
        message: 'Value copied to clipboard.',
        severity: 'info',
      });
    } catch (err) {
      alertApi.post({
        message: 'Unable to copy to clipboard in this environment.',
        severity: 'warning',
      });
    }
  };

  const renderNodePool = (cluster: ClusterInput, pool: NodePoolInput) => (
    <div key={pool.id} className={classes.nodePoolCard}>
      <Grid container spacing={2} alignItems="center">
        <Grid item xs={12} sm={6} md={4}>
          <TextField
            label="Node pool name"
            value={pool.name}
            onChange={event =>
              updateNodePool(cluster.id, pool.id, prev => ({ ...prev, name: event.target.value }))
            }
            fullWidth
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <TextField
            select
            label="Instance type"
            value={pool.instanceType}
            onChange={event =>
              updateNodePool(cluster.id, pool.id, prev => ({
                ...prev,
                instanceType: event.target.value,
              }))
            }
            fullWidth
          >
            {Object.keys(INSTANCE_COSTS).map(type => (
              <MenuItem key={type} value={type}>
                {type}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid item xs={12} sm={12} md={4}>
          <FormControlLabel
            control={
              <Switch
                checked={pool.spot}
                onChange={event =>
                  updateNodePool(cluster.id, pool.id, prev => ({
                    ...prev,
                    spot: event.target.checked,
                  }))
                }
                color="primary"
              />
            }
            label="Use spot capacity"
          />
        </Grid>
        <Grid item xs={4}>
          <TextField
            type="number"
            label="Min nodes"
            value={pool.minSize}
            onChange={event =>
              updateNodePool(cluster.id, pool.id, prev => ({
                ...prev,
                minSize: Number(event.target.value ?? 0),
              }))
            }
            fullWidth
          />
        </Grid>
        <Grid item xs={4}>
          <TextField
            type="number"
            label="Desired nodes"
            value={pool.desiredSize}
            onChange={event =>
              updateNodePool(cluster.id, pool.id, prev => ({
                ...prev,
                desiredSize: Number(event.target.value ?? 0),
              }))
            }
            fullWidth
          />
        </Grid>
        <Grid item xs={4}>
          <TextField
            type="number"
            label="Max nodes"
            value={pool.maxSize}
            onChange={event =>
              updateNodePool(cluster.id, pool.id, prev => ({
                ...prev,
                maxSize: Number(event.target.value ?? 0),
              }))
            }
            fullWidth
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <FormControlLabel
            control={
              <Switch
                color="primary"
                checked={pool.gpu}
                onChange={event =>
                  updateNodePool(cluster.id, pool.id, prev => ({
                    ...prev,
                    gpu: event.target.checked,
                  }))
                }
              />
            }
            label="GPU accelerated"
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <Box display="flex" justifyContent="flex-end" alignItems="center">
            <Button
              startIcon={pool.expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              onClick={() =>
                updateNodePool(cluster.id, pool.id, prev => ({
                  ...prev,
                  expanded: !prev.expanded,
                }))
              }
            >
              Advanced labels & taints
            </Button>
            {cluster.nodePools.length > 1 && (
              <Tooltip title="Remove node pool">
                <IconButton onClick={() => removeNodePool(cluster.id, pool.id)}>
                  <DeleteOutlineIcon />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Grid>
      </Grid>
      <Collapse in={pool.expanded}>
        <Box mt={2}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Labels (key=value, comma separated)"
                value={pool.labelsText}
                onChange={event =>
                  updateNodePool(cluster.id, pool.id, prev => ({
                    ...prev,
                    labelsText: event.target.value,
                  }))
                }
                fullWidth
                multiline
                minRows={2}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Taints (key=value:effect)"
                value={pool.taintsText}
                onChange={event =>
                  updateNodePool(cluster.id, pool.id, prev => ({
                    ...prev,
                    taintsText: event.target.value,
                  }))
                }
                fullWidth
                multiline
                minRows={2}
              />
            </Grid>
          </Grid>
        </Box>
      </Collapse>
    </div>
  );

  const renderCluster = (cluster: ClusterInput, index: number) => (
    <Card key={cluster.id} className={classes.clusterCard} variant="outlined">
      <CardHeader
        className={classes.cardHeader}
        title={`Cluster ${index + 1}`}
        subheader="Customize cluster identity and default sizing."
        action={
          <Box className={classes.clusterHeaderActions}>
            {form.clusters.length > 1 && (
              <Tooltip title="Remove cluster">
                <IconButton onClick={() => removeCluster(cluster.id)}>
                  <DeleteOutlineIcon />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title={cluster.expanded ? 'Hide details' : 'Show details'}>
              <IconButton
                onClick={() =>
                  updateCluster(cluster.id, prev => ({
                    ...prev,
                    expanded: !prev.expanded,
                  }))
                }
              >
                {cluster.expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </Tooltip>
          </Box>
        }
      />
      <Collapse in={cluster.expanded} timeout="auto" unmountOnExit>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                label="Cluster ID"
                value={cluster.clusterId}
                onChange={event =>
                  updateCluster(cluster.id, prev => ({
                    ...prev,
                    clusterId: event.target.value,
                  }))
                }
                required
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Display name"
                value={cluster.displayName}
                onChange={event =>
                  updateCluster(cluster.id, prev => ({
                    ...prev,
                    displayName: event.target.value,
                  }))
                }
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Kubernetes version"
                value={cluster.kubernetesVersion}
                onChange={event =>
                  updateCluster(cluster.id, prev => ({
                    ...prev,
                    kubernetesVersion: event.target.value,
                  }))
                }
                helperText="Pulumi automation validates compatibility with managed node pools."
                fullWidth
              />
            </Grid>
          </Grid>
          <Divider className={classes.sectionTitle} />
          <Typography variant="subtitle1" gutterBottom>
            Node pools
          </Typography>
          {cluster.nodePools.map(pool => renderNodePool(cluster, pool))}
          <Box className={classes.nodePoolButtons}>
            <Button
              color="primary"
              startIcon={<AddCircleOutlineIcon />}
              onClick={() => addNodePool(cluster.id, false)}
            >
              Add node pool
            </Button>
            <Button
              startIcon={<LayersIcon />}
              onClick={() => addNodePool(cluster.id, true)}
            >
              Add GPU pool
            </Button>
          </Box>
        </CardContent>
      </Collapse>
    </Card>
  );

  const renderTopologyStep = () => {
    if (form.mode === 'import') {
      return (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Import existing cluster
            </Typography>
            <Typography variant="body2" color="textSecondary" paragraph>
              Point ÆGIS at an existing cluster by referencing the kubeconfig secret created
              in your workspace namespace. The controller validates the secret naming convention
              (<code>{'&lt;cluster&gt;.kubeconfig'}</code>) and syncs access policies automatically.
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Kubeconfig secret name"
                  value={form.importSecretName}
                  onChange={event => updateForm('importSecretName', event.target.value)}
                  required
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Secret namespace"
                  value={form.importSecretNamespace}
                  onChange={event => updateForm('importSecretNamespace', event.target.value)}
                  helperText="Defaults to aegis-clusters unless overridden."
                  fullWidth
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Kubeconfig keys (optional)"
                  value={form.importSecretKeys}
                  onChange={event => updateForm('importSecretKeys', event.target.value)}
                  helperText="Provide specific keys when the secret contains multiple kubeconfigs."
                  fullWidth
                  multiline
                  minRows={2}
                />
              </Grid>
            </Grid>
            <Box className={classes.helperText}>
              <WarningPanel severity="warning" title="Secret validation">
                ÆGIS will verify the secret contains valid kubeconfig data and surface remediation
                guidance inline if permissions or formats are incorrect.
              </WarningPanel>
            </Box>
          </CardContent>
        </Card>
      );
    }

    return (
      <>
        {form.clusters.map((cluster, index) => renderCluster(cluster, index))}
        <Button
          startIcon={<AddCircleOutlineIcon />}
          onClick={addAdditionalCluster}
        >
          Add additional cluster
        </Button>
        <Divider className={classes.sectionTitle} />
        <Box className={classes.advancedToggle}>
          <Typography variant="subtitle1">Platform integration</Typography>
          <FormControlLabel
            control={
              <Switch
                checked={form.showPlatformIntegration}
                onChange={event => updateForm('showPlatformIntegration', event.target.checked)}
                color="primary"
              />
            }
            label="Show advanced overrides"
          />
        </Box>
        <Collapse in={form.showPlatformIntegration} timeout="auto" unmountOnExit>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                label="Helm namespace"
                value={form.helmNamespace}
                onChange={event => updateForm('helmNamespace', event.target.value)}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Helm chart version"
                value={form.helmChartVersion}
                onChange={event => updateForm('helmChartVersion', event.target.value)}
                fullWidth
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Helm values overrides (YAML)"
                value={form.helmValues}
                onChange={event => updateForm('helmValues', event.target.value)}
                fullWidth
                multiline
                minRows={3}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label="API server override"
                value={form.platformApiEndpoint}
                onChange={event => updateForm('platformApiEndpoint', event.target.value)}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label="Metrics endpoint"
                value={form.platformMetricsEndpoint}
                onChange={event => updateForm('platformMetricsEndpoint', event.target.value)}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label="Logging endpoint"
                value={form.platformLoggingEndpoint}
                onChange={event => updateForm('platformLoggingEndpoint', event.target.value)}
                fullWidth
              />
            </Grid>
          </Grid>
        </Collapse>
      </>
    );
  };

  const renderReviewStep = () => (
    <Grid container spacing={2}>
      <Grid item xs={12}>
        <Card variant="outlined">
          <CardHeader title="Access" subheader="Context propagated to the ProjectInfra resource." />
          <CardContent>
            <Table size="small">
              <TableBody>
                <TableRow>
                  <TableCell>Project</TableCell>
                  <TableCell>{form.projectId || '—'}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>AWS account</TableCell>
                  <TableCell>{form.awsAccountId || 'Inherited via role'}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Assume role ARN</TableCell>
                  <TableCell>{form.assumeRoleArn || '—'}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Region</TableCell>
                  <TableCell>{form.region}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Mode</TableCell>
                  <TableCell>{form.mode === 'provision' ? 'Provision new' : 'Import existing'}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12}>
        <Card variant="outlined">
          <CardHeader
            title="Topology"
            subheader="Pulumi derived clusters, node pools, and scaling windows."
          />
          <CardContent>
            {form.mode === 'provision' ? (
              <div className={classes.tableWrapper}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Cluster</TableCell>
                      <TableCell>Version</TableCell>
                      <TableCell>Node pools</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {form.clusters.map(cluster => (
                      <TableRow key={cluster.id}>
                        <TableCell>
                          <Typography variant="subtitle2">{cluster.displayName}</Typography>
                          <Typography variant="caption" color="textSecondary">
                            {cluster.clusterId}
                          </Typography>
                        </TableCell>
                        <TableCell>{cluster.kubernetesVersion}</TableCell>
                        <TableCell>
                          <div className={classes.chipGroup}>
                            {cluster.nodePools.map(pool => (
                              <Chip
                                key={pool.id}
                                label={`${pool.name} · ${pool.desiredSize}x ${pool.instanceType}`}
                                variant="outlined"
                                icon={pool.gpu ? <SecurityIcon /> : <StorageIcon />}
                              />
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <Typography>
                Importing kubeconfig secret <strong>{form.importSecretName || '—'}</strong> from
                namespace <strong>{form.importSecretNamespace}</strong>.
              </Typography>
            )}
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12}>
        <Card variant="outlined">
          <CardHeader
            title="Platform integration"
            subheader="Derived Helm release and endpoint overrides."
          />
          <CardContent>
            <Table size="small">
              <TableBody>
                <TableRow>
                  <TableCell>Helm namespace</TableCell>
                  <TableCell>{form.helmNamespace || 'aegis-system'}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Chart version</TableCell>
                  <TableCell>{form.helmChartVersion || 'latest stable'}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>API endpoint override</TableCell>
                  <TableCell>{form.platformApiEndpoint || 'default'}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Metrics endpoint</TableCell>
                  <TableCell>{form.platformMetricsEndpoint || 'default'}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Logging endpoint</TableCell>
                  <TableCell>{form.platformLoggingEndpoint || 'default'}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12}>
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6">Projected hourly cost</Typography>
            <Typography variant="h3" component="div">
              {formattedCost}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Pulumi returns a real-time estimate after resolving AWS pricing. Expect the first
              provisioning run to take approximately 15 minutes while automation applies the
              Helm add-ons listed above.
            </Typography>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );

  return (
    <Page themeId="tool">
      <Content className={classes.root}>
        <ContentHeader title="Cluster Orchestration">
          <Typography variant="body2" color="textSecondary">
            Express ProjectInfra intents, provision managed clusters, or import existing footprints
            without leaving the ÆGIS control plane.
          </Typography>
        </ContentHeader>
        <Grid container spacing={3}>
          <Grid item xs={12} lg={7}>
            <Card className={classes.stepperCard} variant="outlined">
              <Stepper activeStep={activeStep} alternativeLabel>
                {STEPS.map(step => (
                  <Step key={step}>
                    <StepLabel>{step}</StepLabel>
                  </Step>
                ))}
              </Stepper>
              <Divider style={{ margin: '16px 0' }} />
              {activeStep === 0 && (
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      label="Project ID"
                      value={form.projectId}
                      onChange={event => updateForm('projectId', event.target.value)}
                      required
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      label="AWS account ID"
                      value={form.awsAccountId}
                      onChange={event => updateForm('awsAccountId', event.target.value)}
                      helperText="Optional when assuming an IAM role below."
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      label="Assume role ARN"
                      value={form.assumeRoleArn}
                      onChange={event => updateForm('assumeRoleArn', event.target.value)}
                      helperText="Pulumi uses this role for provisioning and secret sync."
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      label="AWS region"
                      value={form.region}
                      onChange={event => updateForm('region', event.target.value)}
                      required
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <FormControl component="fieldset">
                      <RadioGroup
                        row
                        value={form.mode}
                        onChange={event => updateForm('mode', event.target.value as ClusterMode)}
                      >
                        <FormControlLabel
                          value="provision"
                          control={<Radio color="primary" />}
                          label="Provision new"
                        />
                        <FormControlLabel
                          value="import"
                          control={<Radio color="primary" />}
                          label="Import existing"
                        />
                      </RadioGroup>
                      <FormHelperText>
                        Switching modes adjusts downstream steps to focus on provisioning inputs or
                        secret imports.
                      </FormHelperText>
                    </FormControl>
                  </Grid>
                </Grid>
              )}
              {activeStep === 1 && renderTopologyStep()}
              {activeStep === 2 && renderReviewStep()}
              <div className={classes.actionsRow}>
                <Box className={classes.wizardButtonRow}>
                  <Button onClick={handleBack} disabled={activeStep === 0}>
                    Back
                  </Button>
                  {activeStep < STEPS.length - 1 && (
                    <Button
                      color="primary"
                      variant="contained"
                      onClick={handleNext}
                      disabled={!activeStepValid}
                    >
                      Continue
                    </Button>
                  )}
                  {activeStep === STEPS.length - 1 && (
                    <Button
                      color="primary"
                      variant="contained"
                      onClick={handleSubmit}
                      disabled={submitting || jobActive || !activeStepValid}
                    >
                      Launch provisioning
                    </Button>
                  )}
                </Box>
                {submitting && <Progress />}
              </div>
            </Card>
          </Grid>
          <Grid item xs={12} lg={5}>
            <Card className={classes.statusCard} variant="outlined">
              <CardHeader
                title="Provisioning status"
                subheader="Follow Pulumi milestones and controller conditions in real time."
              />
              <CardContent>
                {job ? (
                  <>
                    <Box className={classes.statusChipRow}>
                      <Chip label={`Job ${job.id}`} icon={<TimelineIcon />} />
                      {job.phase && <Chip label={job.phase} color="primary" />}
                      <Chip
                        label={job.status}
                        color={job.status.toUpperCase().startsWith('FAIL') ? 'secondary' : 'default'}
                      />
                    </Box>
                    {job.progress !== undefined && !Number.isNaN(job.progress) && (
                      <Box mb={2}>
                        <LinearProgress variant="determinate" value={Math.min(Math.max(job.progress, 0), 100)} />
                        <Typography variant="caption" color="textSecondary">
                          {Math.round(job.progress)}% complete
                        </Typography>
                      </Box>
                    )}
                    <Stepper
                      orientation="vertical"
                      activeStep={activeTimelineIndex}
                      className={classes.timelineStepper}
                    >
                      {deriveTimeline.map((step, index) => {
                        const definition = TIMELINE_STEPS[index];
                        return (
                          <Step key={step.id} completed={step.status === 'complete'} active={step.status === 'active'}>
                            <StepLabel error={step.status === 'error'}>
                              <div className={classes.timelineLabel}>
                                <Typography variant="subtitle2">{definition.label}</Typography>
                                {step.timestamp && (
                                  <Typography variant="caption" color="textSecondary">
                                    {new Date(step.timestamp).toLocaleString()}
                                  </Typography>
                                )}
                              </div>
                            </StepLabel>
                            <Typography variant="body2" color="textSecondary" paragraph>
                              {step.message}
                              {step.reason && ` · ${step.reason}`}
                            </Typography>
                          </Step>
                        );
                      })}
                    </Stepper>
                    {job.outputs?.kubeconfigSecrets && job.outputs.kubeconfigSecrets.length > 0 && (
                      <div className={classes.outputsList}>
                        <Typography variant="subtitle1">Outputs</Typography>
                        {job.outputs.kubeconfigSecrets.map(secret => (
                          <Box key={secret.name} className={classes.outputCard}>
                            <Typography variant="subtitle2">Kubeconfig secret</Typography>
                            <Typography variant="body2">
                              {secret.name} · {secret.namespace || 'aegis-clusters'}
                            </Typography>
                            <Box mt={1}>
                              <Button
                                startIcon={<ContentCopyIcon />}
                                onClick={() => copyToClipboard(secret.name)}
                              >
                                Copy name
                              </Button>
                            </Box>
                          </Box>
                        ))}
                        {job.outputs.endpoints && job.outputs.endpoints.length > 0 && (
                          <Box className={classes.outputCard}>
                            <Typography variant="subtitle2">Endpoints</Typography>
                            {job.outputs.endpoints.map(endpoint => (
                              <Typography key={endpoint.label} variant="body2">
                                {endpoint.label}: {endpoint.url}
                              </Typography>
                            ))}
                          </Box>
                        )}
                      </div>
                    )}
                    <Divider className={classes.sectionTitle} />
                    <Box className={classes.quickActions}>
                      <Button
                        startIcon={<CloudDownloadIcon />}
                        onClick={() =>
                          alertApi.post({
                            message: 'Aegis will expose kubeconfig download once ready.',
                            severity: 'info',
                          })
                        }
                      >
                        Download kubeconfig
                      </Button>
                      <Button
                        startIcon={<LaunchIcon />}
                        onClick={() =>
                          alertApi.post({
                            message: 'Helm release status view opening soon.',
                            severity: 'info',
                          })
                        }
                      >
                        View Helm release
                      </Button>
                      <Button startIcon={<RefreshIcon />} onClick={() => job.id && fetchJobStatus(job.id)}>
                        Refresh
                      </Button>
                    </Box>
                  </>
                ) : (
                  <Box className={classes.emptyStatus}>
                    <Typography variant="subtitle1">No active provisioning run</Typography>
                    <Typography variant="body2">
                      Complete the wizard to submit a ProjectInfra resource. Status, conditions, and
                      Pulumi milestones will appear here automatically, keeping your team informed
                      during longer automation cycles.
                    </Typography>
                  </Box>
                )}
                {jobError && (
                  <Box mt={2}>
                    <WarningPanel severity="error" title="Provisioning issue">
                      {jobError}
                    </WarningPanel>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Content>
    </Page>
  );
};

