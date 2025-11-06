import React, { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Page,
  Content,
  ContentHeader,
  Progress,
  WarningPanel,
  InfoCard,
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
  Collapse,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
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
import DeleteOutlineIcon from '@material-ui/icons/DeleteOutline';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import LaunchIcon from '@material-ui/icons/Launch';
import clsx from 'clsx';
import {
  AuthenticationError,
  AuthorizationError,
  ClusterNodePoolSpec,
  ClusterSpec,
  CreateClusterRequest,
  createCluster,
  getClusterJobStatus,
} from '../api/aegisClient';
import { keycloakAuthApiRef } from '../api/refs';
import { useLocation } from 'react-router-dom';

const useStyles = makeStyles(theme => ({
  root: {
    paddingBottom: theme.spacing(6),
  },
  stepContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(3),
  },
  actionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
  },
  wizardActions: {
    marginTop: theme.spacing(2),
    display: 'flex',
    justifyContent: 'space-between',
  },
  nodePoolTable: {
    marginTop: theme.spacing(1),
  },
  advancedToggle: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: theme.spacing(1),
  },
  expandIcon: {
    transform: 'rotate(0deg)',
    transition: theme.transitions.create('transform', {
      duration: theme.transitions.duration.shortest,
    }),
  },
  expandOpen: {
    transform: 'rotate(180deg)',
  },
  progressSection: {
    marginTop: theme.spacing(2),
  },
  progressLabel: {
    marginTop: theme.spacing(1),
  },
  summaryGrid: {
    display: 'grid',
    gap: theme.spacing(2),
  },
  summaryCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
  },
  timeline: {
    display: 'grid',
    gap: theme.spacing(1),
  },
  inlineHelp: {
    color: theme.palette.text.secondary,
  },
}));

type ClusterNodePoolForm = {
  id: string;
  name: string;
  instanceType: string;
  minSize: number;
  maxSize: number;
  labels: string;
  taints: string;
  showAdvanced: boolean;
};

type ClusterTopologyForm = {
  id: string;
  name: string;
  version: string;
  nodePools: ClusterNodePoolForm[];
};

type ClusterProvisioningForm = {
  projectId: string;
  region: string;
  awsAccountId: string;
  provisioningMode: 'new' | 'import';
  assumeRole: boolean;
  roleArn: string;
  externalId: string;
  existingVpcId: string;
  primaryCluster: ClusterTopologyForm;
  additionalClusters: ClusterTopologyForm[];
  platformEndpoint: string;
  caBundle: string;
  customSpokeImage: string;
  valuesFile: string;
};

type StoredClusterJob = {
  jobId: string;
  projectId: string;
  clusterId: string;
  region: string;
  stack?: string;
};

const JOB_STORAGE_KEY = 'aegis.clusterJobState';
const POLL_INTERVAL_MS = 5000;

const steps = [
  'Foundations',
  'Cluster topology',
  'Platform & observability',
  'Review & submit',
];

const INSTANCE_COST_HINTS: Record<string, number> = {
  'm6i.large': 0.096,
  'm6i.xlarge': 0.192,
  'm6i.2xlarge': 0.384,
  'm6i.4xlarge': 0.768,
  'g5.2xlarge': 0.752,
  'g5.4xlarge': 1.504,
  'g5.8xlarge': 3.008,
};

const createId = () => Math.random().toString(36).slice(2, 10);

const defaultNodePool = (): ClusterNodePoolForm => ({
  id: createId(),
  name: 'default',
  instanceType: 'm6i.large',
  minSize: 1,
  maxSize: 3,
  labels: '',
  taints: '',
  showAdvanced: false,
});

const defaultCluster = (name = 'primary', version = '1.29'): ClusterTopologyForm => ({
  id: createId(),
  name,
  version,
  nodePools: [defaultNodePool()],
});

const initialFormState: ClusterProvisioningForm = {
  projectId: '',
  region: '',
  awsAccountId: '',
  provisioningMode: 'new',
  assumeRole: false,
  roleArn: '',
  externalId: '',
  existingVpcId: '',
  primaryCluster: defaultCluster('mission-core'),
  additionalClusters: [],
  platformEndpoint: '',
  caBundle: '',
  customSpokeImage: '',
  valuesFile: '',
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
    normalized === 'CANCELLED' ||
    normalized === 'CANCELED'
  );
};

const parseKeyValuePairs = (text: string): Record<string, string> | undefined => {
  const entries: Record<string, string> = {};
  text
    .split(/\r?\n|,/)
    .map(item => item.trim())
    .filter(Boolean)
    .forEach(item => {
      const [rawKey, rawValue] = item.split('=');
      const key = rawKey?.trim();
      const value = rawValue?.trim();
      if (key && value) {
        entries[key] = value;
      }
    });
  return Object.keys(entries).length > 0 ? entries : undefined;
};

const parseDelimitedList = (text: string): string[] | undefined => {
  const values = text
    .split(/\r?\n|,/)
    .map(item => item.trim())
    .filter(Boolean);
  return values.length > 0 ? values : undefined;
};

const buildClusterSpec = (cluster: ClusterTopologyForm): ClusterSpec => ({
  name: cluster.name.trim(),
  version: cluster.version.trim(),
  nodePools: cluster.nodePools.map<ClusterNodePoolSpec>(pool => ({
    name: pool.name.trim(),
    instanceType: pool.instanceType.trim(),
    minSize: Number.isFinite(pool.minSize) ? pool.minSize : 0,
    maxSize: Number.isFinite(pool.maxSize) ? pool.maxSize : 0,
    labels: parseKeyValuePairs(pool.labels),
    taints: parseDelimitedList(pool.taints),
  })),
});

const computeStackName = (projectId: string, region: string): string | undefined => {
  const normalizedProject = projectId.trim();
  const normalizedRegion = region.trim();
  if (!normalizedProject || !normalizedRegion) {
    return undefined;
  }
  return `${normalizedProject}-${normalizedRegion}`;
};

const computeCostEstimate = (form: ClusterProvisioningForm): number => {
  const clusters = [form.primaryCluster, ...form.additionalClusters];
  const total = clusters.reduce((clusterAcc, cluster) => {
    const clusterTotal = cluster.nodePools.reduce((poolAcc, pool) => {
      const cost = INSTANCE_COST_HINTS[pool.instanceType] ?? 0;
      const averageCapacity = (pool.minSize + pool.maxSize) / 2;
      return poolAcc + cost * averageCapacity;
    }, 0);
    return clusterAcc + clusterTotal;
  }, 0);
  return Number.isFinite(total) ? Number(total) : 0;
};

export const CreateClusterPage: FC = () => {
  const classes = useStyles();
  const fetchApi = useApi(fetchApiRef);
  const discoveryApi = useApi(discoveryApiRef);
  const identityApi = useApi(identityApiRef);
  const authApi = useApi(keycloakAuthApiRef);
  const alertApi = useApi(alertApiRef);
  const location = useLocation();

  const [form, setForm] = useState<ClusterProvisioningForm>(initialFormState);
  const [foundationErrors, setFoundationErrors] = useState<Record<string, string>>({});
  const [topologyErrors, setTopologyErrors] = useState<Record<string, string>>({});
  const [activeStep, setActiveStep] = useState(0);
  const [showAwsAdvanced, setShowAwsAdvanced] = useState(false);
  const [showPlatformAdvanced, setShowPlatformAdvanced] = useState(false);

  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const pollerRef = useRef<ReturnType<typeof setInterval>>();

  const jobActive = Boolean(jobId && !isTerminalStatus(jobStatus));

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const project = params.get('projectId');
    if (project) {
      setForm(prev => ({ ...prev, projectId: project }));
    }
  }, [location.search]);

  const handleFoundationChange = (
    field: keyof Pick<
      ClusterProvisioningForm,
      'projectId' | 'region' | 'awsAccountId' | 'roleArn' | 'externalId' | 'existingVpcId'
    >,
  ) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleProvisioningModeChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    setForm(prev => ({
      ...prev,
      provisioningMode: event.target.value as ClusterProvisioningForm['provisioningMode'],
    }));
  };

  const handleAssumeRoleToggle = (
    event: React.ChangeEvent<HTMLInputElement>,
    checked: boolean,
  ) => {
    setForm(prev => ({ ...prev, assumeRole: checked }));
    if (!checked) {
      setForm(prev => ({ ...prev, roleArn: '', externalId: '' }));
    }
  };

  const handlePrimaryClusterChange = (
    field: keyof Pick<ClusterTopologyForm, 'name' | 'version'>,
  ) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setForm(prev => ({
      ...prev,
      primaryCluster: { ...prev.primaryCluster, [field]: value },
    }));
  };

  const handleAdditionalClusterChange = (
    clusterId: string,
    field: keyof Pick<ClusterTopologyForm, 'name' | 'version'>,
  ) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setForm(prev => ({
      ...prev,
      additionalClusters: prev.additionalClusters.map(cluster =>
        cluster.id === clusterId ? { ...cluster, [field]: value } : cluster,
      ),
    }));
  };

  const handleNodePoolChange = (
    clusterId: string,
    poolId: string,
    field: keyof Pick<ClusterNodePoolForm, 'name' | 'instanceType' | 'labels' | 'taints'>,
  ) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setForm(prev => ({
      ...prev,
      primaryCluster:
        prev.primaryCluster.id === clusterId
          ? {
              ...prev.primaryCluster,
              nodePools: prev.primaryCluster.nodePools.map(pool =>
                pool.id === poolId ? { ...pool, [field]: value } : pool,
              ),
            }
          : prev.primaryCluster,
      additionalClusters: prev.additionalClusters.map(cluster =>
        cluster.id === clusterId
          ? {
              ...cluster,
              nodePools: cluster.nodePools.map(pool =>
                pool.id === poolId ? { ...pool, [field]: value } : pool,
              ),
            }
          : cluster,
      ),
    }));
  };

  const handleNodePoolNumberChange = (
    clusterId: string,
    poolId: string,
    field: keyof Pick<ClusterNodePoolForm, 'minSize' | 'maxSize'>,
  ) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(event.target.value);
    setForm(prev => ({
      ...prev,
      primaryCluster:
        prev.primaryCluster.id === clusterId
          ? {
              ...prev.primaryCluster,
              nodePools: prev.primaryCluster.nodePools.map(pool =>
                pool.id === poolId ? { ...pool, [field]: Number.isFinite(value) ? value : 0 } : pool,
              ),
            }
          : prev.primaryCluster,
      additionalClusters: prev.additionalClusters.map(cluster =>
        cluster.id === clusterId
          ? {
              ...cluster,
              nodePools: cluster.nodePools.map(pool =>
                pool.id === poolId ? { ...pool, [field]: Number.isFinite(value) ? value : 0 } : pool,
              ),
            }
          : cluster,
      ),
    }));
  };

  const toggleNodePoolAdvanced = (clusterId: string, poolId: string) => () => {
    setForm(prev => ({
      ...prev,
      primaryCluster:
        prev.primaryCluster.id === clusterId
          ? {
              ...prev.primaryCluster,
              nodePools: prev.primaryCluster.nodePools.map(pool =>
                pool.id === poolId ? { ...pool, showAdvanced: !pool.showAdvanced } : pool,
              ),
            }
          : prev.primaryCluster,
      additionalClusters: prev.additionalClusters.map(cluster =>
        cluster.id === clusterId
          ? {
              ...cluster,
              nodePools: cluster.nodePools.map(pool =>
                pool.id === poolId ? { ...pool, showAdvanced: !pool.showAdvanced } : pool,
              ),
            }
          : cluster,
      ),
    }));
  };

  const addNodePool = (clusterId: string) => () => {
    setForm(prev => ({
      ...prev,
      primaryCluster:
        prev.primaryCluster.id === clusterId
          ? {
              ...prev.primaryCluster,
              nodePools: [...prev.primaryCluster.nodePools, defaultNodePool()],
            }
          : prev.primaryCluster,
      additionalClusters: prev.additionalClusters.map(cluster =>
        cluster.id === clusterId
          ? {
              ...cluster,
              nodePools: [...cluster.nodePools, defaultNodePool()],
            }
          : cluster,
      ),
    }));
  };

  const removeNodePool = (clusterId: string, poolId: string) => () => {
    setForm(prev => ({
      ...prev,
      primaryCluster:
        prev.primaryCluster.id === clusterId
          ? {
              ...prev.primaryCluster,
              nodePools: prev.primaryCluster.nodePools.filter(pool => pool.id !== poolId),
            }
          : prev.primaryCluster,
      additionalClusters: prev.additionalClusters.map(cluster =>
        cluster.id === clusterId
          ? {
              ...cluster,
              nodePools: cluster.nodePools.filter(pool => pool.id !== poolId),
            }
          : cluster,
      ),
    }));
  };

  const addSecondaryCluster = () => {
    setForm(prev => ({
      ...prev,
      additionalClusters: [
        ...prev.additionalClusters,
        defaultCluster(`additional-${prev.additionalClusters.length + 1}`),
      ],
    }));
  };

  const removeSecondaryCluster = (clusterId: string) => () => {
    setForm(prev => ({
      ...prev,
      additionalClusters: prev.additionalClusters.filter(cluster => cluster.id !== clusterId),
    }));
  };

  const handlePlatformChange = (
    field: keyof Pick<
      ClusterProvisioningForm,
      'platformEndpoint' | 'caBundle' | 'customSpokeImage' | 'valuesFile'
    >,
  ) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setForm(prev => ({ ...prev, [field]: value }));
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
        setError(null);
        setJobStatus(job.status ?? null);
        setProgress(typeof job.progress === 'number' ? Math.max(0, job.progress) : 0);
        if (job.status === 'FAILED') {
          setError(job.error || 'Cluster deployment failed.');
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

  const validateFoundation = useCallback(() => {
    const errors: Record<string, string> = {};
    if (!form.projectId.trim()) {
      errors.projectId = 'Project ID is required';
    }
    if (!form.region.trim()) {
      errors.region = 'Region is required';
    }
    if (form.assumeRole) {
      if (!form.roleArn.trim()) {
        errors.roleArn = 'Role ARN required when assuming role';
      }
      if (!form.externalId.trim()) {
        errors.externalId = 'External ID required when assuming role';
      }
    }
    setFoundationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [form.externalId, form.projectId, form.region, form.roleArn, form.assumeRole]);

  const validateTopology = useCallback(() => {
    const errors: Record<string, string> = {};
    if (!form.primaryCluster.name.trim()) {
      errors['primaryCluster.name'] = 'Cluster name is required';
    }
    if (!form.primaryCluster.version.trim()) {
      errors['primaryCluster.version'] = 'Cluster version is required';
    }
    if (form.primaryCluster.nodePools.length === 0) {
      errors['primaryCluster.nodePools'] = 'At least one node pool is required';
    }
    form.primaryCluster.nodePools.forEach(pool => {
      if (!pool.name.trim()) {
        errors[`pool.${pool.id}.name`] = 'Name is required';
      }
      if (!pool.instanceType.trim()) {
        errors[`pool.${pool.id}.instanceType`] = 'Instance type required';
      }
      if (pool.minSize < 0) {
        errors[`pool.${pool.id}.minSize`] = 'Minimum must be >= 0';
      }
      if (pool.maxSize < pool.minSize) {
        errors[`pool.${pool.id}.maxSize`] = 'Maximum must be >= minimum';
      }
    });
    form.additionalClusters.forEach(cluster => {
      if (!cluster.name.trim()) {
        errors[`cluster.${cluster.id}.name`] = 'Cluster name is required';
      }
      if (!cluster.version.trim()) {
        errors[`cluster.${cluster.id}.version`] = 'Version required';
      }
      if (cluster.nodePools.length === 0) {
        errors[`cluster.${cluster.id}.nodePools`] = 'At least one node pool is required';
      }
      cluster.nodePools.forEach(pool => {
        if (!pool.name.trim()) {
          errors[`pool.${cluster.id}.${pool.id}.name`] = 'Name is required';
        }
        if (!pool.instanceType.trim()) {
          errors[`pool.${cluster.id}.${pool.id}.instanceType`] = 'Instance type required';
        }
        if (pool.maxSize < pool.minSize) {
          errors[`pool.${cluster.id}.${pool.id}.maxSize`] = 'Maximum must be >= minimum';
        }
      });
    });
    setTopologyErrors(errors);
    return Object.keys(errors).length === 0;
  }, [form.additionalClusters, form.primaryCluster]);

  const handleStepAdvance = async () => {
    if (activeStep === 0) {
      if (validateFoundation()) {
        setActiveStep(step => step + 1);
      }
      return;
    }
    if (activeStep === 1) {
      if (validateTopology()) {
        setActiveStep(step => step + 1);
      }
      return;
    }
    if (activeStep === 2) {
      setActiveStep(step => step + 1);
      return;
    }
    if (activeStep === steps.length - 1) {
      await handleSubmit();
    }
  };

  const handleBack = () => {
    setActiveStep(step => Math.max(step - 1, 0));
  };

  const costEstimate = useMemo(() => computeCostEstimate(form), [form]);
  const pulumiStackName = useMemo(
    () => computeStackName(form.projectId, form.region),
    [form.projectId, form.region],
  );
  const foundationReady = useMemo(() => {
    if (!form.projectId.trim()) {
      return false;
    }
    if (!form.region.trim()) {
      return false;
    }
    if (form.assumeRole) {
      if (!form.roleArn.trim()) {
        return false;
      }
      if (!form.externalId.trim()) {
        return false;
      }
    }
    return true;
  }, [form.assumeRole, form.externalId, form.projectId, form.region, form.roleArn]);
  const topologyReady = useMemo(() => {
    const primary = form.primaryCluster;
    if (!primary.name.trim() || !primary.version.trim()) {
      return false;
    }
    if (primary.nodePools.length === 0) {
      return false;
    }
    if (
      primary.nodePools.some(
        pool =>
          !pool.name.trim() ||
          !pool.instanceType.trim() ||
          pool.maxSize < pool.minSize ||
          pool.minSize < 0,
      )
    ) {
      return false;
    }
    if (
      form.additionalClusters.some(cluster => {
        if (!cluster.name.trim() || !cluster.version.trim()) {
          return true;
        }
        if (cluster.nodePools.length === 0) {
          return true;
        }
        return cluster.nodePools.some(
          pool =>
            !pool.name.trim() ||
            !pool.instanceType.trim() ||
            pool.maxSize < pool.minSize ||
            pool.minSize < 0,
        );
      })
    ) {
      return false;
    }
    return true;
  }, [form.additionalClusters, form.primaryCluster]);

  const buildRequest = (): CreateClusterRequest => {
    const primaryCluster = buildClusterSpec(form.primaryCluster);
    const additional = form.additionalClusters
      .map(buildClusterSpec)
      .filter(cluster => cluster.name);

    return {
      projectId: form.projectId.trim(),
      clusterId: primaryCluster.name,
      provider: 'aws',
      region: form.region.trim(),
      awsAccountId: form.awsAccountId.trim() || undefined,
      roleArn: form.assumeRole ? form.roleArn.trim() || undefined : undefined,
      externalId: form.assumeRole ? form.externalId.trim() || undefined : undefined,
      existingVpcId: form.existingVpcId.trim() || undefined,
      provisioningMode: form.provisioningMode,
      primaryCluster,
      additionalClusters: additional.length > 0 ? additional : undefined,
      platform: {
        platformEndpoint: form.platformEndpoint.trim() || undefined,
        caBundle: form.caBundle.trim() || undefined,
        customSpokeImage: form.customSpokeImage.trim() || undefined,
        valuesFile: form.valuesFile.trim() || undefined,
      },
      pulumiStackName,
      costEstimateUsdPerHour:
        Number.isFinite(costEstimate) && costEstimate > 0 ? Number(costEstimate.toFixed(2)) : undefined,
    };
  };

  const handleSubmit = async () => {
    if (!validateFoundation() || !validateTopology()) {
      setActiveStep(0);
      return;
    }
    const requestBody = buildRequest();
    setSubmitting(true);
    setError(null);
    try {
      const { job } = await createCluster(
        fetchApi,
        discoveryApi,
        identityApi,
        authApi,
        requestBody,
      );
      setJobId(job.id);
      setJobStatus(job.status);
      setProgress(job.progress ?? 0);
      persistStoredJob({
        jobId: job.id,
        projectId: requestBody.projectId,
        clusterId: requestBody.clusterId,
        region: requestBody.region,
        stack: requestBody.pulumiStackName,
      });
      alertApi.post({
        message: `Cluster provisioning job ${job.id} submitted.`,
        severity: 'success',
      });
      startPolling(job.id);
    } catch (e: unknown) {
      let message = 'Failed to submit cluster provisioning.';
      if (e instanceof AuthenticationError || e instanceof AuthorizationError) {
        message = e.message;
      } else if (e instanceof Error) {
        message = e.message || message;
      }
      setError(message);
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
        region: stored.region ?? prev.region,
      }));
      setJobId(stored.jobId);
      setJobStatus('RESUMING');
      setProgress(0);
      startPolling(stored.jobId);
    } catch (err) {
      window.localStorage.removeItem(JOB_STORAGE_KEY);
    }
  }, [startPolling]);

  useEffect(() => clearPoller, [clearPoller]);

  const normalizedProgress = Math.min(100, Math.max(0, progress ?? 0));

  const renderNodePoolRow = (cluster: ClusterTopologyForm, pool: ClusterNodePoolForm) => {
    const nameError =
      topologyErrors[`pool.${pool.id}.name`] ||
      topologyErrors[`pool.${cluster.id}.${pool.id}.name`];
    const instanceTypeError =
      topologyErrors[`pool.${pool.id}.instanceType`] ||
      topologyErrors[`pool.${cluster.id}.${pool.id}.instanceType`];
    const minError = topologyErrors[`pool.${pool.id}.minSize`];
    const maxError =
      topologyErrors[`pool.${pool.id}.maxSize`] ||
      topologyErrors[`pool.${cluster.id}.${pool.id}.maxSize`];

    return (
      <React.Fragment key={pool.id}>
        <TableRow>
          <TableCell>
            <TextField
              label="Pool name"
              value={pool.name}
              onChange={handleNodePoolChange(cluster.id, pool.id, 'name')}
              variant="outlined"
              fullWidth
              error={Boolean(nameError)}
              helperText={nameError}
            />
          </TableCell>
          <TableCell>
            <TextField
              label="Instance type"
              value={pool.instanceType}
              onChange={handleNodePoolChange(cluster.id, pool.id, 'instanceType')}
              variant="outlined"
              fullWidth
              error={Boolean(instanceTypeError)}
              helperText={instanceTypeError || 'Maps to the managed node group size'}
            />
          </TableCell>
          <TableCell>
            <TextField
              label="Min nodes"
              type="number"
              value={pool.minSize}
              onChange={handleNodePoolNumberChange(cluster.id, pool.id, 'minSize')}
              variant="outlined"
              fullWidth
              error={Boolean(minError)}
              helperText={minError || 'Baseline capacity'}
            />
          </TableCell>
          <TableCell>
            <TextField
              label="Max nodes"
              type="number"
              value={pool.maxSize}
              onChange={handleNodePoolNumberChange(cluster.id, pool.id, 'maxSize')}
              variant="outlined"
              fullWidth
              error={Boolean(maxError)}
              helperText={maxError || 'Autoscaling ceiling'}
            />
          </TableCell>
          <TableCell align="right">
            <Tooltip title="Remove node pool">
              <span>
                <IconButton
                  onClick={removeNodePool(cluster.id, pool.id)}
                  disabled={cluster.nodePools.length === 1}
                >
                  <DeleteOutlineIcon />
                </IconButton>
              </span>
            </Tooltip>
          </TableCell>
        </TableRow>
        <TableRow>
          <TableCell colSpan={5}>
            <div className={classes.advancedToggle}>
              <Typography variant="body2" color="textSecondary">
                Managed node group overrides
              </Typography>
              <IconButton
                onClick={toggleNodePoolAdvanced(cluster.id, pool.id)}
                aria-label="Toggle advanced node pool settings"
                className={clsx(classes.expandIcon, {
                  [classes.expandOpen]: pool.showAdvanced,
                })}
              >
                <ExpandMoreIcon />
              </IconButton>
            </div>
            <Collapse in={pool.showAdvanced} timeout="auto" unmountOnExit>
              <Box mt={2} display="grid" gridGap={16} gridTemplateColumns="repeat(auto-fit, minmax(220px, 1fr))">
                <TextField
                  label="Labels (key=value)"
                  value={pool.labels}
                  onChange={handleNodePoolChange(cluster.id, pool.id, 'labels')}
                  variant="outlined"
                  multiline
                  rows={2}
                  helperText="Applied to the node group"
                />
                <TextField
                  label="Taints (key=value:effect)"
                  value={pool.taints}
                  onChange={handleNodePoolChange(cluster.id, pool.id, 'taints')}
                  variant="outlined"
                  multiline
                  rows={2}
                  helperText="Hidden until advanced is opened"
                />
              </Box>
            </Collapse>
          </TableCell>
        </TableRow>
      </React.Fragment>
    );
  };

  const renderClusterCard = (cluster: ClusterTopologyForm, isPrimary: boolean) => {
    const nameError = isPrimary
      ? topologyErrors['primaryCluster.name']
      : topologyErrors[`cluster.${cluster.id}.name`];
    const versionError = isPrimary
      ? topologyErrors['primaryCluster.version']
      : topologyErrors[`cluster.${cluster.id}.version`];
    const poolError = isPrimary
      ? topologyErrors['primaryCluster.nodePools']
      : topologyErrors[`cluster.${cluster.id}.nodePools`];

    return (
      <Card key={cluster.id} variant="outlined">
        <CardHeader
          title={isPrimary ? 'Primary EKS cluster' : 'Additional cluster'}
          subheader={
            isPrimary
              ? 'Primary cluster drives Pulumi stack naming and Helm linkage.'
              : 'Optional clusters share the same project and region context.'
          }
          action={
            !isPrimary && (
              <Tooltip title="Remove cluster">
                <IconButton onClick={removeSecondaryCluster(cluster.id)}>
                  <DeleteOutlineIcon />
                </IconButton>
              </Tooltip>
            )
          }
        />
        <Divider />
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                label="Cluster name"
                value={cluster.name}
                onChange={
                  isPrimary
                    ? handlePrimaryClusterChange('name')
                    : handleAdditionalClusterChange(cluster.id, 'name')
                }
                variant="outlined"
                fullWidth
                required
                error={Boolean(nameError)}
                helperText={
                  nameError ||
                  'Cluster names map to ClusterName and AdditionalClusters in provisioning.'
                }
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Kubernetes version"
                value={cluster.version}
                onChange={
                  isPrimary
                    ? handlePrimaryClusterChange('version')
                    : handleAdditionalClusterChange(cluster.id, 'version')
                }
                variant="outlined"
                fullWidth
                required
                error={Boolean(versionError)}
                helperText={versionError || 'Pulumi validates versions with EKS API.'}
              />
            </Grid>
          </Grid>
          {poolError && (
            <Box mt={2}>
              <WarningPanel title="Node pool required" severity="warning">
                {poolError}
              </WarningPanel>
            </Box>
          )}
          <Table size="small" className={classes.nodePoolTable}>
            <TableHead>
              <TableRow>
                <TableCell>Node pool</TableCell>
                <TableCell>Instance</TableCell>
                <TableCell>Min</TableCell>
                <TableCell>Max</TableCell>
                <TableCell align="right">
                  <Tooltip title="Add node pool">
                    <IconButton onClick={addNodePool(cluster.id)}>
                      <AddCircleOutlineIcon />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {cluster.nodePools.map(pool => renderNodePoolRow(cluster, pool))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  };

  const stepValidationMessages = useMemo(() => {
    const warnings: string[] = [];
    if (form.additionalClusters.some(cluster => cluster.nodePools.length === 0)) {
      warnings.push('Additional clusters must define at least one node pool.');
    }
    if (form.provisioningMode === 'import' && !form.platformEndpoint.trim()) {
      warnings.push('Import mode requires an existing kubeconfig secret and platform endpoint.');
    }
    return warnings;
  }, [form.additionalClusters, form.platformEndpoint, form.provisioningMode]);

  const renderFoundations = () => (
    <div className={classes.stepContent}>
      <Card variant="outlined">
        <CardHeader
          title="Project & access"
          subheader="Project ID and region determine the Pulumi stack name."
        />
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                label="Project ID"
                value={form.projectId}
                onChange={handleFoundationChange('projectId')}
                variant="outlined"
                required
                fullWidth
                error={Boolean(foundationErrors.projectId)}
                helperText={
                  foundationErrors.projectId ||
                  'Must match the projectId used by the provisioning controller.'
                }
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="AWS region"
                value={form.region}
                onChange={handleFoundationChange('region')}
                variant="outlined"
                required
                fullWidth
                error={Boolean(foundationErrors.region)}
                helperText={
                  foundationErrors.region ||
                  'Region is validated before provisioning to avoid backend retries.'
                }
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="AWS account (optional)"
                value={form.awsAccountId}
                onChange={handleFoundationChange('awsAccountId')}
                variant="outlined"
                fullWidth
                helperText="Documented for operators when reviewing Pulumi stacks."
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl variant="outlined" fullWidth>
                <InputLabel id="provisioning-mode-label">Provisioning mode</InputLabel>
                <Select
                  labelId="provisioning-mode-label"
                  value={form.provisioningMode}
                  onChange={handleProvisioningModeChange}
                  label="Provisioning mode"
                >
                  <MenuItem value="new">Provision new infrastructure</MenuItem>
                  <MenuItem value="import">Import existing cluster</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
          <Box mt={3}>
            <FormControlLabel
              control={<Switch checked={showAwsAdvanced} onChange={() => setShowAwsAdvanced(v => !v)} />}
              label="Show advanced AWS settings"
            />
          </Box>
          <Collapse in={showAwsAdvanced} timeout="auto" unmountOnExit>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Existing VPC ID"
                  value={form.existingVpcId}
                  onChange={handleFoundationChange('existingVpcId')}
                  variant="outlined"
                  fullWidth
                  helperText="Optional. Mirrors VPC import expectations for Pulumi."
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControlLabel
                  control={<Switch checked={form.assumeRole} onChange={handleAssumeRoleToggle} />}
                  label="Assume IAM role"
                />
              </Grid>
              {form.assumeRole && (
                <>
                  <Grid item xs={12} md={6}>
                    <TextField
                      label="Role ARN"
                      value={form.roleArn}
                      onChange={handleFoundationChange('roleArn')}
                      variant="outlined"
                      fullWidth
                      required
                      error={Boolean(foundationErrors.roleArn)}
                      helperText={
                        foundationErrors.roleArn ||
                        'Used by the backend to assume access for Pulumi. '
                      }
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      label="External ID"
                      value={form.externalId}
                      onChange={handleFoundationChange('externalId')}
                      variant="outlined"
                      fullWidth
                      required
                      error={Boolean(foundationErrors.externalId)}
                      helperText={
                        foundationErrors.externalId ||
                        'Keeps role assumption aligned with controller validation.'
                      }
                    />
                  </Grid>
                </>
              )}
            </Grid>
          </Collapse>
          {pulumiStackName && (
            <Box mt={3}>
              <InfoCard title="Pulumi stack preview" variant="gridItem">
                <Typography variant="body1">{pulumiStackName}</Typography>
                <Typography variant="body2" className={classes.inlineHelp}>
                  Derived from projectId and region. Matches the backend naming convention.
                </Typography>
              </InfoCard>
            </Box>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const renderTopology = () => (
    <div className={classes.stepContent}>
      {renderClusterCard(form.primaryCluster, true)}
      {form.additionalClusters.map(cluster => renderClusterCard(cluster, false))}
      <Button
        variant="outlined"
        color="primary"
        startIcon={<AddCircleOutlineIcon />}
        onClick={addSecondaryCluster}
      >
        Add additional cluster
      </Button>
      <Typography variant="body2" className={classes.inlineHelp}>
        Additional clusters mirror the AdditionalClusters list consumed by provisioning.
      </Typography>
      {stepValidationMessages.length > 0 && (
        <Box mt={2}>
          {stepValidationMessages.map(message => (
            <Box key={message} mb={1}>
              <WarningPanel severity="warning" title="Topology warning">
                {message}
              </WarningPanel>
            </Box>
          ))}
        </Box>
      )}
    </div>
  );

  const renderPlatform = () => (
    <div className={classes.stepContent}>
      <Card variant="outlined">
        <CardHeader
          title="Platform integration"
          subheader="Optional settings become Helm values when the cluster boots."
        />
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                label="Platform endpoint"
                value={form.platformEndpoint}
                onChange={handlePlatformChange('platformEndpoint')}
                variant="outlined"
                fullWidth
                helperText="Overrides the default Aegis control plane endpoint."
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="CA bundle (base64)"
                value={form.caBundle}
                onChange={handlePlatformChange('caBundle')}
                variant="outlined"
                fullWidth
                helperText="Provide when the spoke needs a custom trust store."
              />
            </Grid>
          </Grid>
          <Box mt={2}>
            <FormControlLabel
              control={<Switch checked={showPlatformAdvanced} onChange={() => setShowPlatformAdvanced(v => !v)} />}
              label="Show Helm advanced fields"
            />
          </Box>
          <Collapse in={showPlatformAdvanced} timeout="auto" unmountOnExit>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Custom spoke image"
                  value={form.customSpokeImage}
                  onChange={handlePlatformChange('customSpokeImage')}
                  variant="outlined"
                  fullWidth
                  helperText="Pulumi defaults to the platform-managed image when left empty."
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Values file reference"
                  value={form.valuesFile}
                  onChange={handlePlatformChange('valuesFile')}
                  variant="outlined"
                  fullWidth
                  helperText="Document the Helm overrides tracked with the release."
                />
              </Grid>
            </Grid>
          </Collapse>
          <Box mt={3}>
            <InfoCard title="Estimated hourly cost" variant="gridItem">
              <Typography variant="h5">${costEstimate.toFixed(2)} / hour</Typography>
              <Typography variant="body2" className={classes.inlineHelp}>
                Based on Pulumi cost hints for selected node pools. Actual billing may vary.
              </Typography>
            </InfoCard>
          </Box>
        </CardContent>
      </Card>
    </div>
  );

  const renderReview = () => {
    const requestBody = buildRequest();
    return (
      <div className={classes.stepContent}>
        <Card variant="outlined">
          <CardHeader
            title="Provisioning summary"
            subheader="Review the orchestration plan before launching."
          />
          <CardContent className={classes.summaryGrid}>
            <div className={classes.summaryCard}>
              <Typography variant="subtitle2">Pulumi stack</Typography>
              <Typography variant="body1">{requestBody.pulumiStackName ?? 'Derived on submit'}</Typography>
              <Typography variant="body2" className={classes.inlineHelp}>
                Provisioning runs asynchronously; expect several minutes for EKS and Helm releases.
              </Typography>
            </div>
            <Divider />
            <div className={classes.summaryCard}>
              <Typography variant="subtitle2">Clusters</Typography>
              <Typography variant="body1">Primary: {requestBody.primaryCluster.name}</Typography>
              {requestBody.additionalClusters?.map(cluster => (
                <Typography key={cluster.name} variant="body1">
                  Additional: {cluster.name}
                </Typography>
              ))}
              <Typography variant="body2" className={classes.inlineHelp}>
                Node pools translate directly to managed node groups per cluster.
              </Typography>
            </div>
            <Divider />
            <div className={classes.summaryCard}>
              <Typography variant="subtitle2">Node pools</Typography>
              {[requestBody.primaryCluster, ...(requestBody.additionalClusters ?? [])].map(cluster => (
                <Box key={cluster.name}>
                  <Typography variant="body2" color="textSecondary">
                    {cluster.name}
                  </Typography>
                  {cluster.nodePools.map(pool => (
                    <Typography key={pool.name} variant="body1">
                      {pool.name}: {pool.instanceType} ({pool.minSize}-{pool.maxSize})
                    </Typography>
                  ))}
                </Box>
              ))}
            </div>
            <Divider />
            <div className={classes.summaryCard}>
              <Typography variant="subtitle2">Helm values</Typography>
              <Typography variant="body1">
                Endpoint: {requestBody.platform?.platformEndpoint ?? 'default'}
              </Typography>
              <Typography variant="body1">
                Custom image: {requestBody.platform?.customSpokeImage ?? 'default'}
              </Typography>
              <Typography variant="body1">
                Values file: {requestBody.platform?.valuesFile ?? 'default'}
              </Typography>
            </div>
          </CardContent>
        </Card>
        <InfoCard title="What happens next?" variant="gridItem">
          <Typography variant="body2">
            Provisioning kicks off a Pulumi deployment followed by Helm chart installation. The
            controller streams status updates so you can monitor progress without re-submitting.
          </Typography>
        </InfoCard>
        {stepValidationMessages.length > 0 && (
          <WarningPanel severity="warning" title="Review warnings">
            <ul>
              {stepValidationMessages.map(message => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </WarningPanel>
        )}
      </div>
    );
  };

  return (
    <Page themeId="tool">
      <Content className={classes.root}>
        <ContentHeader
          title="Cluster provisioning wizard"
          description="Guide teams through Pulumi-backed EKS orchestration with clear guardrails."
        />
        <Stepper activeStep={activeStep} alternativeLabel>
          {steps.map(label => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
        <Box mt={4}>
          {activeStep === 0 && renderFoundations()}
          {activeStep === 1 && renderTopology()}
          {activeStep === 2 && renderPlatform()}
          {activeStep === 3 && renderReview()}
        </Box>
        <div className={classes.wizardActions}>
          <Button onClick={handleBack} disabled={activeStep === 0 || submitting || jobActive}>
            Back
          </Button>
          <div className={classes.actionRow}>
            {submitting && <Progress />}
            <Button
              color="primary"
              variant="contained"
              onClick={handleStepAdvance}
              disabled={submitting || jobActive}
            >
              {activeStep === steps.length - 1 ? 'Submit provisioning request' : 'Next'}
            </Button>
          </div>
        </div>
        <Box mt={4}>
          <Typography variant="h6">Provisioning readiness checklist</Typography>
          <Typography variant="body2" className={classes.inlineHelp}>
            Validate inputs now to avoid backend retries later. Errors shown here mirror controller
            validation.
          </Typography>
          {!foundationReady && (
            <Box mt={2}>
              <WarningPanel title="Foundations incomplete" severity="warning">
                Ensure project and region are populated before submitting.
              </WarningPanel>
            </Box>
          )}
          {!topologyReady && (
            <Box mt={2}>
              <WarningPanel title="Topology incomplete" severity="warning">
                Check cluster names and node pools for missing fields.
              </WarningPanel>
            </Box>
          )}
        </Box>
        <Grid container spacing={3}>
          <Grid item xs={12} md={7}>
            {jobId && (
              <Card>
                <CardContent>
                  <Typography variant="h6">Provisioning job status</Typography>
                  <Typography>Job ID: {jobId}</Typography>
                  <Typography>Status: {jobStatus}</Typography>
                  <Typography>
                    Stack:{' '}
                    {pulumiStackName ? (
                      <>
                        {pulumiStackName}{' '}
                        <Tooltip title="Open Pulumi documentation">
                          <IconButton
                            component="a"
                            href="https://www.pulumi.com/docs/"
                            target="_blank"
                            rel="noopener"
                          >
                            <LaunchIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </>
                    ) : (
                      'Pending'
                    )}
                  </Typography>
                  <div className={classes.progressSection}>
                    <LinearProgress variant="determinate" value={normalizedProgress} />
                    <Typography className={classes.progressLabel} variant="body2" color="textSecondary">
                      Progress: {normalizedProgress}%
                    </Typography>
                  </div>
                </CardContent>
              </Card>
            )}
          </Grid>
          <Grid item xs={12} md={5}>
            {error && (
              <WarningPanel severity="error" title="Cluster provisioning error">
                {error}
              </WarningPanel>
            )}
          </Grid>
        </Grid>
      </Content>
    </Page>
  );
};
