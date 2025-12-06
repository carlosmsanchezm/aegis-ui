import React, { useState, useEffect, useRef } from 'react';
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
  const lastJobRef = useRef<Job | null>(null);

  // Reset log stream when switching jobs
  useEffect(() => {
    setLogs([]);
    lastJobRef.current = null;
  }, [jobId]);

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

  // Build a minimal live log stream from backend job status/progress
  useEffect(() => {
    if (!job) {
      return;
    }

    const prev = lastJobRef.current;
    const now = new Date();
    const timestamp = `${now.toTimeString().split(' ')[0]}.${now
      .getMilliseconds()
      .toString()
      .padStart(3, '0')}`;

    const newEntries: LogEntry[] = [];
    const statusLabel = job.status || 'unknown';
    const progressLabel =
      typeof job.progress === 'number' && !Number.isNaN(job.progress)
        ? `${job.progress}%`
        : '—';

    if (!prev) {
      newEntries.push({
        timestamp,
        message: `Job ${job.id} status: ${statusLabel} (${progressLabel})`,
        level: 'highlight',
      });
      if (job.error) {
        newEntries.push({
          timestamp,
          message: job.error,
          level: 'error',
        });
      }
    } else {
      if (job.status !== prev.status) {
        const upper = (job.status || '').toUpperCase();
        newEntries.push({
          timestamp,
          message: `Status ${prev.status || 'unknown'} → ${job.status || 'unknown'}`,
          level: upper === 'FAILED' ? 'error' : upper === 'SUCCEEDED' ? 'resource-create' : 'highlight',
        });
      }
      if (typeof job.progress === 'number' && job.progress !== prev.progress) {
        newEntries.push({
          timestamp,
          message: `Progress updated: ${job.progress}%`,
          level: 'info',
        });
      }
      if (job.error && job.error !== prev.error) {
        newEntries.push({
          timestamp,
          message: job.error,
          level: 'error',
        });
      }
    }

    if (newEntries.length > 0) {
      setLogs(current => {
        const merged = [...current, ...newEntries];
        return merged.slice(-200);
      });
    }

    lastJobRef.current = job;
  }, [job]);

  // Loading state
  if (loading) {
    return (
      <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" minHeight="100vh" gap={2}>
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
      <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" minHeight="100vh" gap={3}>
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

  // Calculate duration
  const duration = '0m 0s'; // TODO: Calculate from job timestamps when available

  // Map job status to ClusterProvisioningDetails status
  const getStatus = (): 'Building' | 'Ready' | 'Error' | 'Canceled' => {
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
      clusterName={jobId || 'unknown-cluster'}
      status={getStatus()}
      duration={duration}
      initiatedBy="user@aegis.com"
      environment="Development"
      region="AWS (us-east-1)"
      commitHash="f8a9c2d"
      commitMessage="chore: cluster provisioning"
      branch="main"
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
