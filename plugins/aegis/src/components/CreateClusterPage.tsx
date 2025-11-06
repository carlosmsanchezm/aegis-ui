import React, {
  FC,
  useCallback,
  useEffect,
  useMemo,
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
} from '@backstage/core-plugin-api';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Collapse,
  Divider,
  FormControlLabel,
  Grid,
  IconButton,
  LinearProgress,
  MenuItem,
  Paper,
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
import InfoIcon from '@material-ui/icons/InfoOutlined';
import AddIcon from '@material-ui/icons/AddCircleOutline';
import DeleteIcon from '@material-ui/icons/DeleteOutline';
import ArrowForwardIcon from '@material-ui/icons/ArrowForward';
import ArrowBackIcon from '@material-ui/icons/ArrowBack';
import DescriptionIcon from '@material-ui/icons/Description';
import { Alert } from '@material-ui/lab';
import {
  AuthenticationError,
  AuthorizationError,
  CreateClusterRequest,
  createCluster,
  getClusterJobStatus,
} from '../api/aegisClient';
import { keycloakAuthApiRef } from '../api/refs';

const useStyles = makeStyles(theme => ({
  root: {
    paddingBottom: theme.spacing(6),
  },
  stepperCard: {
    marginBottom: theme.spacing(3),
  },
  wizardFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: theme.spacing(2),
    marginTop: theme.spacing(3),
  },
  actionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
  },
  cardSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2.5),
  },
  inlineField: {
    display: 'grid',
    gap: theme.spacing(2),
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  },
  clusterCard: {
    border: '1px solid var(--aegis-card-border, rgba(148, 163, 184, 0.18))',
    borderRadius: theme.shape.borderRadius * 2,
  },
  nodePoolRow: {
    '& td': {
      verticalAlign: 'top',
    },
  },
  warningBox: {
    marginTop: theme.spacing(2),
  },
  summaryCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  },
  reviewGrid: {
    display: 'grid',
    gap: theme.spacing(2),
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  },
  summaryBlock: {
    border: '1px solid rgba(148, 163, 184, 0.2)',
    borderRadius: theme.shape.borderRadius * 2,
    padding: theme.spacing(2),
    backgroundColor:
      theme.palette.type === 'dark'
        ? 'rgba(15, 23, 42, 0.6)'
        : 'rgba(246, 248, 252, 0.96)',
  },
}));

type ProvisioningMode = 'new' | 'import';

type FoundationState = {
  projectId: string;
  awsAccountId: string;
  region: string;
  provisioningMode: ProvisioningMode;
  useAdvancedAws: boolean;
  roleArn?: string;
  externalId?: string;
  vpcId?: string;
};

type NodePoolState = {
  id: string;
  name: string;
  instanceType: string;
  minSize: number;
  maxSize: number;
  labels?: string;
  taints?: string;
  showAdvanced: boolean;
};

type ClusterTopologyState = {
  id: string;
  name: string;
  version: string;
  nodePools: NodePoolState[];
};

type IntegrationState = {
  platformEndpoint?: string;
  caBundle?: string;
  spokeImage?: string;
  valuesFile?: string;
  showAdvanced: boolean;
};

type WizardState = {
  foundation: FoundationState;
  topology: ClusterTopologyState[];
  integrations: IntegrationState;
};

type StoredClusterJob = {
  jobId: string;
  projectId: string;
  clusterId: string;
  provider: string;
  region: string;
};

const JOB_STORAGE_KEY = 'aegis.clusterJobState';
const POLL_INTERVAL_MS = 5000;
const steps = ['Foundations', 'Cluster topology', 'Platform & observability', 'Review & submit'];

const INSTANCE_COST_MAP: Record<string, number> = {
  'm6i.large': 0.096,
  'm6i.xlarge': 0.192,
  'm6i.2xlarge': 0.384,
  'm6i.4xlarge': 0.768,
  'g5.2xlarge': 0.908,
  'g5.4xlarge': 1.64,
};

const buildDefaultNodePool = (idSuffix: number): NodePoolState => ({
  id: `pool-${idSuffix}`,
  name: 'default',
  instanceType: 'm6i.large',
  minSize: 1,
  maxSize: 3,
  showAdvanced: false,
});

const buildDefaultCluster = (idSuffix: number): ClusterTopologyState => ({
  id: `cluster-${idSuffix}`,
  name: idSuffix === 1 ? 'primary' : `cluster-${idSuffix}`,
  version: '1.29',
  nodePools: [buildDefaultNodePool(idSuffix)],
});

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

export const CreateClusterPage: FC = () => {
  const classes = useStyles();
  const fetchApi = useApi(fetchApiRef);
  const discoveryApi = useApi(discoveryApiRef);
  const identityApi = useApi(identityApiRef);
  const authApi = useApi(keycloakAuthApiRef);
  const alertApi = useApi(alertApiRef);

  const [activeStep, setActiveStep] = useState(0);
  const [wizardState, setWizardState] = useState<WizardState>({
    foundation: {
      projectId: '',
      awsAccountId: '',
      region: '',
      provisioningMode: 'new',
      useAdvancedAws: false,
      roleArn: '',
      externalId: '',
      vpcId: '',
    },
    topology: [buildDefaultCluster(1)],
    integrations: {
      showAdvanced: false,
      platformEndpoint: '',
      caBundle: '',
      spokeImage: '',
      valuesFile: '',
    },
  });
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const pollerRef = useRef<ReturnType<typeof setInterval>>();
  const clusterIdCounter = useRef(2);

  const jobActive = Boolean(jobId && !isTerminalStatus(jobStatus));

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const incomingProject = params.get('projectId');
    if (incomingProject) {
      setWizardState(prev => ({
        ...prev,
        foundation: {
          ...prev.foundation,
          projectId: incomingProject,
        },
      }));
    }
  }, []);

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
            message: 'Cluster provisioning finished successfully.',
            severity: 'success',
          });
        }
        if (status && status.toUpperCase().includes('FAIL')) {
          alertApi.post({
            message: errorMessage || 'Cluster provisioning failed.',
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
          setError(job.error || 'Cluster provisioning failed.');
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
    [clearPoller, discoveryApi, fetchApi, handleTerminalJob, identityApi, authApi],
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

  const handleWizardStateChange = <K extends keyof WizardState>(
    section: K,
    value: WizardState[K],
  ) => {
    setWizardState(prev => ({
      ...prev,
      [section]: value,
    }));
  };

  const foundationValid = useMemo(() => {
    const { projectId, region } = wizardState.foundation;
    return projectId.trim().length > 0 && region.trim().length > 0;
  }, [wizardState.foundation]);

  const topologyValid = useMemo(() => {
    if (!wizardState.topology.length) {
      return false;
    }
    return wizardState.topology.every(cluster => {
      if (!cluster.name.trim()) {
        return false;
      }
      if (!cluster.nodePools.length) {
        return false;
      }
      return cluster.nodePools.every(pool => {
        if (!pool.name.trim()) {
          return false;
        }
        if (!pool.instanceType.trim()) {
          return false;
        }
        if (pool.minSize < 0 || pool.maxSize < 0) {
          return false;
        }
        if (pool.minSize > pool.maxSize) {
          return false;
        }
        return true;
      });
    });
  }, [wizardState.topology]);

  const integrationValid = true;

  const canGoNext = () => {
    if (activeStep === 0) {
      return foundationValid;
    }
    if (activeStep === 1) {
      return topologyValid;
    }
    if (activeStep === 2) {
      return integrationValid;
    }
    return true;
  };

  const costEstimatePerHour = useMemo(() => {
    return wizardState.topology.reduce((clusterTotal, cluster) => {
      return (
        clusterTotal +
        cluster.nodePools.reduce((poolTotal, pool) => {
          const instanceRate = INSTANCE_COST_MAP[pool.instanceType] ?? 0.12;
          const averageSize = (Number(pool.minSize) + Number(pool.maxSize)) / 2 || 0;
          return poolTotal + averageSize * instanceRate;
        }, 0)
      );
    }, 0);
  }, [wizardState.topology]);

  const normalizedProgress = Math.min(100, Math.max(0, progress ?? 0));

  const handleSubmit = async () => {
    const payload: CreateClusterRequest = {
      projectId: wizardState.foundation.projectId.trim(),
      clusterId: wizardState.topology[0]?.name.trim() || 'primary',
      provider: 'aws',
      region: wizardState.foundation.region.trim(),
    };

    setSubmitting(true);
    setError(null);
    try {
      const { job } = await createCluster(
        fetchApi,
        discoveryApi,
        identityApi,
        authApi,
        payload,
      );
      setJobId(job.id);
      setJobStatus(job.status);
      setProgress(job.progress ?? 0);
      persistStoredJob({
        jobId: job.id,
        projectId: payload.projectId,
        clusterId: payload.clusterId,
        provider: payload.provider,
        region: payload.region,
      });
      alertApi.post({
        message: `Cluster provisioning job ${job.id} submitted.`,
        severity: 'success',
      });
      startPolling(job.id);
    } catch (e: unknown) {
      let message = 'Failed to submit cluster provisioning request.';
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
      setWizardState(prev => ({
        ...prev,
        foundation: {
          ...prev.foundation,
          projectId: stored.projectId ?? prev.foundation.projectId,
          region: stored.region ?? prev.foundation.region,
        },
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

  const renderFoundationStep = () => {
    const { foundation } = wizardState;
    const stackName = foundation.projectId && foundation.region
      ? `${foundation.projectId}-${foundation.region}`
      : 'project-region';

    return (
      <Card className={classes.clusterCard} variant="outlined">
        <CardHeader
          title="Foundations"
          subheader="Project, accounts, and access context drive Pulumi orchestration."
        />
        <CardContent className={classes.cardSection}>
          <Alert severity="info">
            Region and project are used to derive the Pulumi stack name ({stackName}).
            Provide optional AWS role assumptions to align with backend checks.
          </Alert>
          <div className={classes.inlineField}>
            <TextField
              label="Project ID"
              value={foundation.projectId}
              onChange={event =>
                handleWizardStateChange('foundation', {
                  ...foundation,
                  projectId: event.target.value,
                })
              }
              variant="outlined"
              required
              fullWidth
              error={!foundation.projectId.trim()}
              helperText={
                !foundation.projectId.trim()
                  ? 'Project ID is required to continue.'
                  : 'Pulumi validates this against project ownership.'
              }
            />
            <TextField
              label="AWS Account ID"
              value={foundation.awsAccountId}
              onChange={event =>
                handleWizardStateChange('foundation', {
                  ...foundation,
                  awsAccountId: event.target.value,
                })
              }
              variant="outlined"
              fullWidth
              helperText="Optional. Specify when assuming cross-account roles."
            />
            <TextField
              label="Region"
              value={foundation.region}
              onChange={event =>
                handleWizardStateChange('foundation', {
                  ...foundation,
                  region: event.target.value,
                })
              }
              variant="outlined"
              required
              fullWidth
              error={!foundation.region.trim()}
              helperText={
                !foundation.region.trim()
                  ? 'Region is required and must match controller expectations.'
                  : 'Matches the Pulumi stack target region (e.g., us-east-1).'
              }
            />
          </div>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box display="flex" alignItems="center" style={{ gap: 8 }}>
              <Typography variant="subtitle1">Provisioning mode</Typography>
              <Tooltip title="Import mode requires kubeconfig secrets to exist.">
                <InfoIcon fontSize="small" color="action" />
              </Tooltip>
            </Box>
            <Box display="flex" style={{ gap: 8 }}>
              <Button
                variant={foundation.provisioningMode === 'new' ? 'contained' : 'outlined'}
                color="primary"
                onClick={() =>
                  handleWizardStateChange('foundation', {
                    ...foundation,
                    provisioningMode: 'new',
                  })
                }
              >
                New provisioning
              </Button>
              <Button
                variant={foundation.provisioningMode === 'import' ? 'contained' : 'outlined'}
                color="primary"
                onClick={() =>
                  handleWizardStateChange('foundation', {
                    ...foundation,
                    provisioningMode: 'import',
                  })
                }
              >
                Import existing
              </Button>
            </Box>
          </Box>
          <Divider />
          <FormControlLabel
            control={
              <Switch
                color="primary"
                checked={foundation.useAdvancedAws}
                onChange={(_, checked) =>
                  handleWizardStateChange('foundation', {
                    ...foundation,
                    useAdvancedAws: checked,
                  })
                }
              />
            }
            label="Show advanced AWS assumptions"
          />
          <Collapse in={foundation.useAdvancedAws} timeout="auto" unmountOnExit>
            <div className={classes.inlineField}>
              <TextField
                label="Assume Role ARN"
                value={foundation.roleArn}
                onChange={event =>
                  handleWizardStateChange('foundation', {
                    ...foundation,
                    roleArn: event.target.value,
                  })
                }
                variant="outlined"
                fullWidth
                helperText="Optional role used by the controller when assuming access."
              />
              <TextField
                label="External ID"
                value={foundation.externalId}
                onChange={event =>
                  handleWizardStateChange('foundation', {
                    ...foundation,
                    externalId: event.target.value,
                  })
                }
                variant="outlined"
                fullWidth
                helperText="Aligns with RoleARN/ExternalID usage in backend provisioning."
              />
              <TextField
                label="Existing VPC ID"
                value={foundation.vpcId}
                onChange={event =>
                  handleWizardStateChange('foundation', {
                    ...foundation,
                    vpcId: event.target.value,
                  })
                }
                variant="outlined"
                fullWidth
                helperText="Optional. Provide to reuse networking during import."
              />
            </div>
          </Collapse>
        </CardContent>
      </Card>
    );
  };

  const handleClusterChange = (
    clusterId: string,
    patch: Partial<ClusterTopologyState>,
  ) => {
    const updated = wizardState.topology.map(cluster =>
      cluster.id === clusterId ? { ...cluster, ...patch } : cluster,
    );
    handleWizardStateChange('topology', updated);
  };

  const handleNodePoolChange = (
    clusterId: string,
    nodePoolId: string,
    patch: Partial<NodePoolState>,
  ) => {
    const updated = wizardState.topology.map(cluster => {
      if (cluster.id !== clusterId) {
        return cluster;
      }
      return {
        ...cluster,
        nodePools: cluster.nodePools.map(pool =>
          pool.id === nodePoolId ? { ...pool, ...patch } : pool,
        ),
      };
    });
    handleWizardStateChange('topology', updated);
  };

  const handleAddCluster = () => {
    const nextId = clusterIdCounter.current++;
    handleWizardStateChange('topology', [
      ...wizardState.topology,
      buildDefaultCluster(nextId),
    ]);
  };

  const handleRemoveCluster = (clusterId: string) => {
    if (wizardState.topology.length <= 1) {
      return;
    }
    handleWizardStateChange(
      'topology',
      wizardState.topology.filter(cluster => cluster.id !== clusterId),
    );
  };

  const handleAddNodePool = (clusterId: string) => {
    const nextId = clusterIdCounter.current++;
    const updated = wizardState.topology.map(cluster => {
      if (cluster.id !== clusterId) {
        return cluster;
      }
      return {
        ...cluster,
        nodePools: [...cluster.nodePools, buildDefaultNodePool(nextId)],
      };
    });
    handleWizardStateChange('topology', updated);
  };

  const handleRemoveNodePool = (clusterId: string, nodePoolId: string) => {
    const updated = wizardState.topology.map(cluster => {
      if (cluster.id !== clusterId) {
        return cluster;
      }
      if (cluster.nodePools.length <= 1) {
        return cluster;
      }
      return {
        ...cluster,
        nodePools: cluster.nodePools.filter(pool => pool.id !== nodePoolId),
      };
    });
    handleWizardStateChange('topology', updated);
  };

  const renderTopologyStep = () => (
    <Box
      display="flex"
      flexDirection="column"
      style={{ gap: 24 }}
    >
      {wizardState.topology.map((cluster, index) => {
        const missingNodePools = cluster.nodePools.length === 0;
        const hasSizingIssue = cluster.nodePools.some(
          pool => pool.minSize > pool.maxSize,
        );
        return (
          <Card key={cluster.id} className={classes.clusterCard} variant="outlined">
            <CardHeader
              title={
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Typography variant="h6">
                    {index === 0 ? 'Primary cluster' : `Additional cluster ${index}`}
                  </Typography>
                  {index > 0 && (
                    <IconButton
                      aria-label="remove cluster"
                      onClick={() => handleRemoveCluster(cluster.id)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  )}
                </Box>
              }
              subheader="Define cluster metadata and managed node groups."
            />
            <CardContent className={classes.cardSection}>
              <div className={classes.inlineField}>
                <TextField
                  label="Cluster name"
                  value={cluster.name}
                  onChange={event =>
                    handleClusterChange(cluster.id, {
                      name: event.target.value,
                    })
                  }
                  variant="outlined"
                  required
                  fullWidth
                  helperText="Becomes ClusterName in the provisioning payload."
                />
                <TextField
                  label="Kubernetes version"
                  value={cluster.version}
                  onChange={event =>
                    handleClusterChange(cluster.id, {
                      version: event.target.value,
                    })
                  }
                  variant="outlined"
                  fullWidth
                  select
                  helperText="Align with supported EKS versions."
                >
                  {['1.28', '1.29', '1.30'].map(version => (
                    <MenuItem key={version} value={version}>
                      {version}
                    </MenuItem>
                  ))}
                </TextField>
              </div>
              <Alert severity="info">
                Node pools map directly to managed node groups. Use the average of
                min/max to estimate footprint and ensure at least one pool is
                configured per cluster.
              </Alert>
              {missingNodePools && (
                <WarningPanel
                  className={classes.warningBox}
                  severity="warning"
                  title="Additional configuration required"
                >
                  Add at least one node pool to provision compute capacity for this
                  cluster.
                </WarningPanel>
              )}
              {hasSizingIssue && (
                <WarningPanel
                  className={classes.warningBox}
                  severity="warning"
                  title="Node pool sizing mismatch"
                >
                  Ensure minimum size is less than or equal to maximum size to satisfy
                  backend validation.
                </WarningPanel>
              )}
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Pool name</TableCell>
                    <TableCell>Instance type</TableCell>
                    <TableCell>Min size</TableCell>
                    <TableCell>Max size</TableCell>
                    <TableCell>Advanced labels & taints</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {cluster.nodePools.map(pool => (
                    <TableRow key={pool.id} className={classes.nodePoolRow}>
                      <TableCell>
                        <TextField
                          label="Name"
                          value={pool.name}
                          onChange={event =>
                            handleNodePoolChange(cluster.id, pool.id, {
                              name: event.target.value,
                            })
                          }
                          variant="outlined"
                          fullWidth
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          label="Instance type"
                          value={pool.instanceType}
                          onChange={event =>
                            handleNodePoolChange(cluster.id, pool.id, {
                              instanceType: event.target.value,
                            })
                          }
                          variant="outlined"
                          fullWidth
                          helperText="Defaults to m6i.large if unspecified."
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          label="Min"
                          type="number"
                          value={pool.minSize}
                          onChange={event =>
                            handleNodePoolChange(cluster.id, pool.id, {
                              minSize: Number(event.target.value) || 0,
                            })
                          }
                          variant="outlined"
                          fullWidth
                          error={pool.minSize > pool.maxSize}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          label="Max"
                          type="number"
                          value={pool.maxSize}
                          onChange={event =>
                            handleNodePoolChange(cluster.id, pool.id, {
                              maxSize: Number(event.target.value) || 0,
                            })
                          }
                          variant="outlined"
                          fullWidth
                          error={pool.minSize > pool.maxSize}
                          helperText={
                            pool.minSize > pool.maxSize
                              ? 'Max must be greater than or equal to min.'
                              : 'Pulumi applies managed node group scaling bounds.'
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={pool.showAdvanced}
                              color="primary"
                              onChange={(_, checked) =>
                                handleNodePoolChange(cluster.id, pool.id, {
                                  showAdvanced: checked,
                                })
                              }
                            />
                          }
                          label="Show advanced"
                        />
                        <Collapse in={pool.showAdvanced} timeout="auto">
                          <Box
                            mt={1}
                            display="flex"
                            flexDirection="column"
                            style={{ gap: 8 }}
                          >
                            <TextField
                              label="Labels (key=value, comma separated)"
                              value={pool.labels ?? ''}
                              onChange={event =>
                                handleNodePoolChange(cluster.id, pool.id, {
                                  labels: event.target.value,
                                })
                              }
                              variant="outlined"
                              fullWidth
                            />
                            <TextField
                              label="Taints (key=value:NoSchedule)"
                              value={pool.taints ?? ''}
                              onChange={event =>
                                handleNodePoolChange(cluster.id, pool.id, {
                                  taints: event.target.value,
                                })
                              }
                              variant="outlined"
                              fullWidth
                              helperText="Hidden until needed to keep the wizard approachable."
                            />
                          </Box>
                        </Collapse>
                      </TableCell>
                      <TableCell align="right">
                        {cluster.nodePools.length > 1 && (
                          <IconButton
                            aria-label="remove node pool"
                            onClick={() => handleRemoveNodePool(cluster.id, pool.id)}
                          >
                            <DeleteIcon />
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Box display="flex" justifyContent="flex-start">
                <Button
                  color="primary"
                  startIcon={<AddIcon />}
                  onClick={() => handleAddNodePool(cluster.id)}
                >
                  Add node pool
                </Button>
              </Box>
            </CardContent>
          </Card>
        );
      })}
      <Box>
        <Button color="primary" variant="outlined" onClick={handleAddCluster} startIcon={<AddIcon />}>
          Add secondary cluster
        </Button>
      </Box>
    </Box>
  );

  const renderIntegrationsStep = () => {
    const { integrations } = wizardState;
    return (
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card className={classes.clusterCard} variant="outlined">
            <CardHeader
              title="Platform & observability integration"
              subheader="Optional overrides map to Helm releases and controller environment variables."
            />
            <CardContent className={classes.cardSection}>
              <Alert severity="info">
                Leave these fields blank to fall back to Pulumi defaults. Provide
                overrides when coordinating bespoke environments or custom spokes.
              </Alert>
              <TextField
                label="Platform endpoint"
                value={integrations.platformEndpoint}
                onChange={event =>
                  handleWizardStateChange('integrations', {
                    ...integrations,
                    platformEndpoint: event.target.value,
                  })
                }
                variant="outlined"
                fullWidth
                helperText="Feeds into Helm chart values so the cluster reports back to Aegis."
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={integrations.showAdvanced}
                    onChange={(_, checked) =>
                      handleWizardStateChange('integrations', {
                        ...integrations,
                        showAdvanced: checked,
                      })
                    }
                    color="primary"
                  />
                }
                label="Show advanced Helm overrides"
              />
              <Collapse in={integrations.showAdvanced} timeout="auto">
                <div className={classes.inlineField}>
                  <TextField
                    label="CA bundle"
                    value={integrations.caBundle}
                    onChange={event =>
                      handleWizardStateChange('integrations', {
                        ...integrations,
                        caBundle: event.target.value,
                      })
                    }
                    variant="outlined"
                    fullWidth
                  />
                  <TextField
                    label="Custom spoke image"
                    value={integrations.spokeImage}
                    onChange={event =>
                      handleWizardStateChange('integrations', {
                        ...integrations,
                        spokeImage: event.target.value,
                      })
                    }
                    variant="outlined"
                    fullWidth
                  />
                  <TextField
                    label="Values file"
                    value={integrations.valuesFile}
                    onChange={event =>
                      handleWizardStateChange('integrations', {
                        ...integrations,
                        valuesFile: event.target.value,
                      })
                    }
                    variant="outlined"
                    fullWidth
                    helperText="Reference a Helm values file stored in source control or object storage."
                  />
                </div>
              </Collapse>
              <Alert severity="warning">
                Import mode requires kubeconfig secrets to be present. Confirm the
                KubeconfigSecretKey is accessible before continuing.
              </Alert>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card className={classes.summaryCard} variant="outlined">
            <CardHeader
              title="Cost preview"
              subheader="Derived from Pulumi CostHintUSDPerHour."
            />
            <CardContent className={classes.cardSection}>
              <Typography variant="h4">
                ${costEstimatePerHour.toFixed(2)} / hour
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Estimated monthly spend: ${(costEstimatePerHour * 24 * 30).toFixed(2)}
              </Typography>
              <Divider />
              <Typography variant="body2">
                Cost is calculated using the average desired capacity of each node pool.
                Adjust min/max bounds to understand price impact before provisioning.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    );
  };

  const renderReviewStep = () => {
    const { foundation, topology, integrations } = wizardState;
    const stackName = foundation.projectId && foundation.region
      ? `${foundation.projectId}-${foundation.region}`
      : 'project-region';

    return (
      <Card className={classes.summaryCard} variant="outlined">
        <CardHeader
          avatar={<DescriptionIcon color="primary" />}
          title="Review provisioning plan"
          subheader="Validate details before orchestrating Pulumi stacks and Helm releases."
        />
        <CardContent className={classes.cardSection}>
          <Alert severity="info">
            Provisioning can take several minutes. You will be redirected back to the
            cluster list while jobs run asynchronously.
          </Alert>
          <div className={classes.reviewGrid}>
            <div className={classes.summaryBlock}>
              <Typography variant="subtitle2" gutterBottom>
                Pulumi stacks
              </Typography>
              <Typography variant="body1">{stackName}</Typography>
              <Typography variant="body2" color="textSecondary">
                Mode: {foundation.provisioningMode === 'new' ? 'Create new' : 'Import existing'}
              </Typography>
              {foundation.vpcId && (
                <Typography variant="body2">Existing VPC: {foundation.vpcId}</Typography>
              )}
              {foundation.roleArn && (
                <Typography variant="body2">Role ARN: {foundation.roleArn}</Typography>
              )}
            </div>
            <div className={classes.summaryBlock}>
              <Typography variant="subtitle2" gutterBottom>
                Clusters & node pools
              </Typography>
              {topology.map(cluster => (
                <Box key={cluster.id} mb={1}>
                  <Typography variant="body1">
                    {cluster.name} · Kubernetes {cluster.version}
                  </Typography>
                  {cluster.nodePools.map(pool => (
                    <Typography key={pool.id} variant="body2" color="textSecondary">
                      {pool.name}: {pool.instanceType} · {pool.minSize} - {pool.maxSize}
                    </Typography>
                  ))}
                </Box>
              ))}
            </div>
            <div className={classes.summaryBlock}>
              <Typography variant="subtitle2" gutterBottom>
                Helm integration
              </Typography>
              <Typography variant="body2">
                Endpoint: {integrations.platformEndpoint || 'default'}
              </Typography>
              <Typography variant="body2">
                CA bundle: {integrations.caBundle ? 'provided' : 'Pulumi default'}
              </Typography>
              <Typography variant="body2">
                Custom image: {integrations.spokeImage || 'default'}
              </Typography>
              <Typography variant="body2">
                Values file: {integrations.valuesFile || 'default chart values'}
              </Typography>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderActiveStep = () => {
    if (activeStep === 0) {
      return renderFoundationStep();
    }
    if (activeStep === 1) {
      return renderTopologyStep();
    }
    if (activeStep === 2) {
      return renderIntegrationsStep();
    }
    return renderReviewStep();
  };

  return (
    <Page themeId="tool">
      <Content className={classes.root}>
        <ContentHeader title="Cluster creation wizard" />
        <Paper className={classes.stepperCard} elevation={0}>
          <Box p={3}>
            <Stepper activeStep={activeStep} alternativeLabel>
              {steps.map(label => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>
          </Box>
        </Paper>
        {renderActiveStep()}
        <div className={classes.wizardFooter}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => setActiveStep(prev => Math.max(0, prev - 1))}
            disabled={activeStep === 0 || submitting}
          >
            Back
          </Button>
          <div className={classes.actionRow}>
            {activeStep < steps.length - 1 ? (
              <Button
                color="primary"
                variant="contained"
                endIcon={<ArrowForwardIcon />}
                onClick={() => setActiveStep(prev => Math.min(steps.length - 1, prev + 1))}
                disabled={!canGoNext() || submitting}
              >
                Continue
              </Button>
            ) : (
              <Button
                color="primary"
                variant="contained"
                onClick={handleSubmit}
                disabled={submitting || jobActive}
              >
                Provision cluster
              </Button>
            )}
            {submitting && <Progress />}
          </div>
        </div>
        <Grid container spacing={3} style={{ marginTop: 16 }}>
          <Grid item xs={12} md={6}>
            {jobId && (
              <Card>
                <CardContent>
                  <Typography variant="h6">Provisioning job</Typography>
                  <Typography>Job ID: {jobId}</Typography>
                  <Typography>Status: {jobStatus}</Typography>
                  <Box mt={2}>
                    <LinearProgress variant="determinate" value={normalizedProgress} />
                    <Typography
                      variant="body2"
                      color="textSecondary"
                      style={{ marginTop: 8 }}
                    >
                      Progress: {normalizedProgress}%
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Pulumi stacks, EKS clusters, and Helm installs run asynchronously.
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            )}
          </Grid>
          <Grid item xs={12} md={6}>
            {error && (
              <Box>
                <WarningPanel severity="error" title="Cluster provisioning error">
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

export default CreateClusterPage;
