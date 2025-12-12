import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, CircularProgress, Typography, Button } from '@material-ui/core';
import ErrorIcon from '@material-ui/icons/Error';
import ArrowBackIcon from '@material-ui/icons/ArrowBack';
import { useApi, fetchApiRef, discoveryApiRef, identityApiRef } from '@backstage/core-plugin-api';
import { keycloakAuthApiRef } from '../../apis';
import {
  Job,
  getClusterJobStatus,
  isTerminalStatus,
  streamProvisioningLogs,
  ProvisioningLogView,
} from '../../../../../plugins/aegis/src/api/aegisClient';
import {
  ClusterProvisioningDetails,
  LogEntry,
  ProvisioningStage,
} from './ClusterProvisioningDetails';

const generateProvisioningStages = (jobStatus?: string, progress?: number): ProvisioningStage[] => {
  const statusUpper = jobStatus?.toUpperCase();
  const isBuilding = !statusUpper || statusUpper === 'RUNNING' || statusUpper === 'PENDING';
  const isFailed = statusUpper === 'FAILED';
  const progressPercent = Math.max(
    0,
    Math.min(
      100,
      typeof progress === 'number' ? progress : statusUpper === 'SUCCEEDED' ? 100 : 0,
    ),
  );

  const stages: ProvisioningStage[] = [
    {
      id: 'networking',
      label: 'Networking & IAM Infrastructure',
      status: progressPercent >= 20 ? 'ready' : isBuilding ? 'creating' : 'pending',
      totalResources: 15,
      readyResources: progressPercent >= 20 ? 15 : Math.floor((progressPercent / 20) * 15),
      duration: progressPercent >= 20 ? '6m 10s' : undefined,
      resources: [
        { name: 'VPC (aegis-dev-vpc)', id: 'vpc-0a1b2c3d4e5f67890', status: progressPercent >= 15 ? 'ready' : 'creating' },
        { name: 'Private Subnets (3)', status: progressPercent >= 18 ? 'ready' : progressPercent >= 15 ? 'creating' : 'pending' },
        { name: 'EKS IAM Role', id: 'eks-cluster-role', status: progressPercent >= 20 ? 'ready' : progressPercent >= 18 ? 'creating' : 'pending' },
      ],
    },
    {
      id: 'controlplane',
      label: 'EKS Control Plane',
      status: progressPercent >= 60 ? 'ready' : progressPercent >= 20 ? 'creating' : isBuilding ? 'pending' : 'pending',
      totalResources: 1,
      readyResources: progressPercent >= 60 ? 1 : 0,
      duration: progressPercent >= 60 ? '9m 15s' : undefined,
      resources: [
        { name: 'EKS Cluster (aegis-eks-dev)', id: 'K8s v1.29', status: progressPercent >= 60 ? 'ready' : progressPercent >= 20 ? 'creating' : 'pending' },
      ],
    },
    {
      id: 'compute',
      label: 'Compute Node Groups',
      status: progressPercent === 100 ? 'ready' : progressPercent >= 60 ? 'creating' : isBuilding ? 'pending' : 'pending',
      totalResources: 3,
      readyResources: progressPercent === 100 ? 3 : 0,
      resources: [
        {
          name: 'GPU Nodes A100 (gpu-nodes-a100)',
          id: `p4d.24xlarge (${progressPercent >= 80 ? '5/5' : progressPercent >= 60 ? '1/5' : '0/5'} Nodes Ready)`,
          status: progressPercent === 100 ? 'ready' : progressPercent >= 60 ? 'creating' : 'pending'
        },
        {
          name: 'GPU Nodes V100 (gpu-nodes-v100)',
          id: `p3.8xlarge (${progressPercent >= 90 ? '5/5' : progressPercent >= 70 ? '1/5' : '0/5'} Nodes Ready)`,
          status: progressPercent === 100 ? 'ready' : progressPercent >= 70 ? 'creating' : 'pending'
        },
        { name: 'Utility Nodes (utility-pool)', id: 'm5.large', status: progressPercent === 100 ? 'ready' : 'pending' },
      ],
    },
    {
      id: 'addons',
      label: 'Cluster Add-ons & Configuration',
      status: progressPercent === 100 ? 'ready' : 'pending',
      totalResources: 5,
      readyResources: progressPercent === 100 ? 5 : 0,
      resources: [
        { name: 'NVIDIA Device Plugin', status: progressPercent === 100 ? 'ready' : 'pending' },
        { name: 'Karpenter Autoscaler', status: progressPercent === 100 ? 'ready' : 'pending' },
        { name: 'Monitoring Stack (Prometheus)', status: progressPercent === 100 ? 'ready' : 'pending' },
        { name: 'MLOps Tools (Kubeflow)', status: progressPercent === 100 ? 'ready' : 'pending' },
      ],
    },
    {
      id: 'validation',
      label: 'Validation & Health Checks',
      status: progressPercent === 100 ? 'ready' : 'pending',
      totalResources: 3,
      readyResources: progressPercent === 100 ? 3 : 0,
      resources: [
        { name: 'API Server Health Check', status: progressPercent === 100 ? 'ready' : 'pending' },
        { name: 'Node GPU Verification (NVIDIA SMI)', status: progressPercent === 100 ? 'ready' : 'pending' },
        { name: 'Security Policy Conformance', status: progressPercent === 100 ? 'ready' : 'pending' },
      ],
    },
  ];

  return stages.map(stage => {
    if (!isFailed) {
      return stage;
    }

    const readyResources = Math.max(
      0,
      Math.min(stage.readyResources ?? 0, Math.max(0, stage.totalResources - 1)),
    );
    const stageStatus = readyResources === stage.totalResources ? 'ready' : 'failed';

    return {
      ...stage,
      status: stageStatus,
      readyResources,
      resources: stage.resources.map(resource => ({
        ...resource,
        status: stageStatus === 'failed' ? 'failed' : resource.status,
      })),
    };
  });
};

export const ClusterProvisioningDetailsPage = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();

  // API hooks
  const fetchApi = useApi(fetchApiRef);
  const discoveryApi = useApi(discoveryApiRef);
  const identityApi = useApi(identityApiRef);
  const authApi = useApi(keycloakAuthApiRef);

  // State
  const [job, setJob] = useState<Job | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initiatedBy, setInitiatedBy] = useState<string>('—');
  const [provisioningMeta, setProvisioningMeta] = useState<{
    projectId?: string;
    clusterId?: string;
    phase?: string;
    startedAt?: string;
    completedAt?: string;
  }>({});
  const logCursorRef = useRef<string>('');

  // Reset log stream when switching jobs
  useEffect(() => {
    setLogs([]);
    logCursorRef.current = '';
    setProvisioningMeta({});
  }, [jobId]);

  useEffect(() => {
    let active = true;
    identityApi
      .getBackstageIdentity()
      .then(identity => {
        if (active) {
          setInitiatedBy(identity?.userEntityRef ?? '—');
        }
      })
      .catch(() => {
        if (active) {
          setInitiatedBy('—');
        }
      });
    return () => {
      active = false;
    };
  }, [identityApi]);

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

  const mapProvisioningLogLevel = (entry: ProvisioningLogView): LogEntry['level'] => {
    const raw = `${entry.type ?? ''} ${entry.message ?? ''}`.toLowerCase();
    if (raw.includes('error') || raw.includes('failed') || raw.includes('fatal')) {
      return 'error';
    }
    if (raw.includes('warn')) {
      return 'warning';
    }
    if (raw.includes('debug')) {
      return 'debug';
    }
    if (raw.includes('create')) {
      return 'resource-create';
    }
    if (raw.includes('update') || raw.includes('refresh')) {
      return 'resource-update';
    }
    return 'info';
  };

  const formatLogTimestamp = (raw: string): string => {
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      return raw;
    }
    const iso = parsed.toISOString();
    return `${iso.slice(11, 23)}Z`;
  };

  const mapProvisioningLog = (entry: ProvisioningLogView): LogEntry => ({
    timestamp: formatLogTimestamp(entry.timestamp),
    message: entry.message,
    level: mapProvisioningLogLevel(entry),
  });

  // Stream provisioning logs from backend (long-poll)
  useEffect(() => {
    if (!jobId) {
      return;
    }

    let cancelled = false;

    const run = async () => {
      while (!cancelled) {
        try {
          const response = await streamProvisioningLogs(
            fetchApi,
            discoveryApi,
            identityApi,
            authApi,
            jobId,
            { since: logCursorRef.current, limit: 200 },
          );
          if (cancelled) {
            return;
          }

          setProvisioningMeta({
            projectId: response.projectId,
            clusterId: response.clusterId,
            phase: response.phase,
            startedAt: response.startedAt,
            completedAt: response.completedAt,
          });

          if (response.logs && response.logs.length > 0) {
            const mapped = response.logs.map(mapProvisioningLog);
            setLogs(current => {
              const merged = [...current, ...mapped];
              return merged.slice(-2000);
            });
          }

          if (response.nextCursor) {
            logCursorRef.current = response.nextCursor;
          }

          if (response.completedAt) {
            return;
          }
        } catch (err: any) {
          if (cancelled) {
            return;
          }

          const now = new Date();
          const timestamp = `${now.toTimeString().split(' ')[0]}.${now
            .getMilliseconds()
            .toString()
            .padStart(3, '0')}`;
          const message =
            typeof err?.message === 'string'
              ? err.message
              : 'Unable to stream provisioning logs. Retrying...';

          setLogs(current => {
            const warningEntry: LogEntry = {
              timestamp,
              message,
              level: 'warning',
            };
            const last = current[current.length - 1];
            if (last?.message === warningEntry.message) {
              return current;
            }
            return [...current, warningEntry].slice(-2000);
          });

          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [jobId, fetchApi, discoveryApi, identityApi, authApi]);

  // Calculate duration (must be above early returns; hooks can't be conditional)
  const duration = useMemo(() => {
    const startedAt = provisioningMeta?.startedAt;
    if (!startedAt) {
      return '—';
    }
    const start = new Date(startedAt);
    const end = provisioningMeta?.completedAt
      ? new Date(provisioningMeta.completedAt)
      : new Date();
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return '—';
    }
    const totalSeconds = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  }, [provisioningMeta?.startedAt, provisioningMeta?.completedAt]);

  // Loading state
  if (loading) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        minHeight="100vh"
        style={{ gap: 16 }}
      >
        <CircularProgress size={48} />
        <Typography variant="h6" color="textSecondary">
          Loading job status...
        </Typography>
      </Box>
    );
  }

  // Error state
  if (error || !job) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        minHeight="100vh"
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
    );
  }

  // Map job status to ClusterProvisioningDetails status
  const getStatus = (): 'Building' | 'Ready' | 'Error' | 'Canceled' => {
    const phase = provisioningMeta?.phase?.toLowerCase();
    if (phase === 'ready') return 'Ready';
    if (phase === 'error') return 'Error';

    const status = job.status?.toUpperCase();
    if (status === 'SUCCEEDED') return 'Ready';
    if (status === 'FAILED') return 'Error';
    if (status === 'CANCELED') return 'Canceled';
    return 'Building';
  };

  const displayProgress = (() => {
    if (typeof job.progress !== 'number' || Number.isNaN(job.progress)) {
      return undefined;
    }
    const statusUpper = job.status?.toUpperCase();
    if (statusUpper === 'FAILED') {
      return Math.min(job.progress, 99);
    }
    if (statusUpper === 'SUCCEEDED') {
      return 100;
    }
    return job.progress;
  })();

  return (
    <ClusterProvisioningDetails
      clusterName={provisioningMeta?.clusterId || jobId || 'unknown-cluster'}
      status={getStatus()}
      duration={duration}
      phase={provisioningMeta?.phase}
      startedAt={provisioningMeta?.startedAt}
      completedAt={provisioningMeta?.completedAt}
      initiatedBy={initiatedBy}
      environment="Development"
      region="AWS (us-east-1)"
      commitHash="—"
      commitMessage="—"
      branch="—"
      k8sVersion="1.29"
      primaryGpuNodes="p4d.24xlarge (8x A100 GPUs)"
      secondaryGpuNodes="p3.8xlarge (4x V100 GPUs)"
      totalNodeCount={10}
      autoscaling={true}
      logs={logs}
      progress={displayProgress}
      jobError={job.error}
      stages={generateProvisioningStages(job.status, job.progress)}
      onViewPulumiConsole={() => {
        window.open('https://app.pulumi.com', '_blank');
      }}
      onConnectToCluster={() => {
        if (job.status === 'SUCCEEDED') {
          navigate('/aegis/dashboard');
        }
      }}
    />
  );
};
