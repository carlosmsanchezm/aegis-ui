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
  ClusterConfigResponse,
} from '../../../../../plugins/aegis/src/api/aegisClient';
import {
  ClusterProvisioningDetails,
  LogEntry,
  ProvisioningStage,
} from './ClusterProvisioningDetails';

// Resource type mappings for grouping Pulumi resources into stages
const RESOURCE_STAGE_MAP: Record<string, string> = {
  // Networking & IAM
  'aws:iam:Role': 'networking',
  'aws:iam/role:Role': 'networking',
  'aws:iam:RolePolicy': 'networking',
  'aws:iam/rolePolicy:RolePolicy': 'networking',
  'aws:iam:RolePolicyAttachment': 'networking',
  'aws:iam/rolePolicyAttachment:RolePolicyAttachment': 'networking',
  'aws:iam:OpenIdConnectProvider': 'networking',
  'aws:iam/openIdConnectProvider:OpenIdConnectProvider': 'networking',
  'aws:ec2:SecurityGroup': 'networking',
  'aws:ec2/securityGroup:SecurityGroup': 'networking',
  'aws:ec2:SecurityGroupRule': 'networking',
  'aws:ec2/securityGroupRule:SecurityGroupRule': 'networking',
  'aws:ec2:LaunchTemplate': 'networking',
  'aws:ec2/launchTemplate:LaunchTemplate': 'networking',
  'pulumi:providers:aws': 'networking',
  // Control Plane
  'aws:eks:Cluster': 'controlplane',
  'aws:eks/cluster:Cluster': 'controlplane',
  'pulumi:providers:kubernetes': 'controlplane',
  'kubernetes:core/v1:Namespace': 'controlplane',
  'kubernetes:core/v1:ConfigMap': 'controlplane',
  // Compute
  'aws:eks:NodeGroup': 'compute',
  'aws:eks/nodeGroup:NodeGroup': 'compute',
  // Add-ons
  'kubernetes:helm.sh/v3:Release': 'addons',
};

// Human-readable names for resource types
const RESOURCE_TYPE_NAMES: Record<string, string> = {
  'aws:iam:Role': 'IAM Role',
  'aws:iam/role:Role': 'IAM Role',
  'aws:iam:RolePolicy': 'IAM Role Policy',
  'aws:iam/rolePolicy:RolePolicy': 'IAM Role Policy',
  'aws:iam:RolePolicyAttachment': 'IAM Policy Attachment',
  'aws:iam/rolePolicyAttachment:RolePolicyAttachment': 'IAM Policy Attachment',
  'aws:iam:OpenIdConnectProvider': 'OIDC Provider',
  'aws:iam/openIdConnectProvider:OpenIdConnectProvider': 'OIDC Provider',
  'aws:ec2:SecurityGroup': 'Security Group',
  'aws:ec2/securityGroup:SecurityGroup': 'Security Group',
  'aws:ec2:SecurityGroupRule': 'Security Group Rule',
  'aws:ec2/securityGroupRule:SecurityGroupRule': 'Security Group Rule',
  'aws:ec2:LaunchTemplate': 'Launch Template',
  'aws:ec2/launchTemplate:LaunchTemplate': 'Launch Template',
  'aws:eks:Cluster': 'EKS Cluster',
  'aws:eks/cluster:Cluster': 'EKS Cluster',
  'aws:eks:NodeGroup': 'Node Group',
  'aws:eks/nodeGroup:NodeGroup': 'Node Group',
  'kubernetes:core/v1:Namespace': 'Kubernetes Namespace',
  'kubernetes:core/v1:ConfigMap': 'Kubernetes ConfigMap',
  'kubernetes:helm.sh/v3:Release': 'Helm Release',
  'pulumi:providers:aws': 'AWS Provider',
  'pulumi:providers:kubernetes': 'Kubernetes Provider',
};

interface ParsedResource {
  type: string;
  name: string;
  status: 'pending' | 'creating' | 'ready' | 'failed';
  startTime?: Date;
  endTime?: Date;
  duration?: string;
}

interface StageInfo {
  resources: Map<string, ParsedResource>;
  startTime?: Date;
  endTime?: Date;
}

const parseResourceFromLog = (message: string): { type: string; name: string; action: string; duration?: string } | null => {
  // Pulumi log formats (note: may have leading whitespace):
  // " + aws:iam:Role end-us-east-1-atlas-t-601fdfa1-cluster-role creating (0s)"
  // " + aws:iam:Role end-us-east-1-atlas-t-601fdfa1-cluster-role created (0.62s)"
  // "Create aws:iam/role:Role: end-us-east-1-atlas-t-601fdfa1-node-role"
  // "Completed create aws:iam/role:Role: end-us-east-1-atlas-t-601fdfa1-node-role"
  // " ~ aws:eks:NodeGroup gpu-nodegroup updated (0.87s) [diff: ~scalingConfig]"
  // "Refresh aws:eks/cluster:Cluster: end-us-east-1-atlas-t-98d5d916"

  const trimmed = message.trim();

  // Pattern 1: "[+~- ] type name status (duration)" - handles whitespace and symbols
  const symbolPattern = /^[+~-]\s*([\w:/.]+)\s+(\S+)\s+(creating|created|updating|updated|refreshing|deleted|deleting)/i;
  let match = trimmed.match(symbolPattern);
  if (match) {
    const durationMatch = message.match(/\((\d+(?:\.\d+)?s?)\)/);
    return {
      type: match[1],
      name: match[2],
      action: match[3].toLowerCase(),
      duration: durationMatch ? durationMatch[1] : undefined
    };
  }

  // Pattern 2: "Create/Completed create/Refresh/Update type: name"
  const verbosePattern = /^(Create|Completed create|Completed update|Refresh|Update)\s+([\w:/.]+):\s*(\S+)/i;
  match = trimmed.match(verbosePattern);
  if (match) {
    const actionMap: Record<string, string> = {
      'create': 'creating',
      'completed create': 'created',
      'refresh': 'ready',
      'update': 'updating',
      'completed update': 'updated',
    };
    const action = actionMap[match[1].toLowerCase()] || 'creating';
    return { type: match[2], name: match[3], action };
  }

  // Pattern 3: "type name" on standalone lines (e.g., " aws:iam:Role end-us-east-1...")
  const standalonePattern = /^\s*(aws:[\w/:]+|kubernetes:[\w/:]+|pulumi:[\w/:]+)\s+(\S+)\s*$/i;
  match = trimmed.match(standalonePattern);
  if (match) {
    return { type: match[1], name: match[2], action: 'ready' };
  }

  return null;
};

const formatDuration = (ms: number): string => {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${remainingSeconds}s`;
};

// Normalize resource type (e.g., aws:iam/role:Role -> aws:iam:Role for lookups)
const normalizeResourceType = (type: string): string => {
  // Handle formats like "aws:iam/role:Role" -> keep as-is for lookups (we have both in maps)
  return type;
};

const generateProvisioningStagesFromLogs = (
  logs: LogEntry[],
  jobStatus?: string,
  clusterConfig?: ClusterConfigResponse,
  currentTime?: Date,
): ProvisioningStage[] => {
  const statusUpper = jobStatus?.toUpperCase();
  const isFailed = statusUpper === 'FAILED';
  const isSucceeded = statusUpper === 'SUCCEEDED';

  // Parse logs to extract resource states
  const stageMap: Record<string, StageInfo> = {
    networking: { resources: new Map() },
    controlplane: { resources: new Map() },
    compute: { resources: new Map() },
    addons: { resources: new Map() },
  };

  // Track timestamps for each resource
  logs.forEach(log => {
    const parsed = parseResourceFromLog(log.message);
    if (!parsed) return;

    const normalizedType = normalizeResourceType(parsed.type);
    const stage = RESOURCE_STAGE_MAP[normalizedType] || RESOURCE_STAGE_MAP[parsed.type] || 'addons';
    const resourceKey = `${parsed.type}:${parsed.name}`;
    const stageInfo = stageMap[stage];
    if (!stageInfo) return;

    // Parse timestamp - handle various formats:
    // 1. Full ISO: "2025-12-16T05:06:23.000Z"
    // 2. Time only with Z: "05:06:23.000Z" (from formatLogTimestamp)
    // 3. Time only: "07:13:02.494"
    let logTime: Date;
    try {
      const ts = log.timestamp;
      if (ts.includes('T')) {
        // Full ISO format
        logTime = new Date(ts);
      } else {
        // Time-only format (with or without Z) - prepend today's date
        const today = new Date();
        const timeStr = ts.endsWith('Z') ? ts.slice(0, -1) : ts;
        logTime = new Date(`${today.toISOString().split('T')[0]}T${timeStr}Z`);
      }
      if (isNaN(logTime.getTime())) {
        logTime = new Date();
      }
    } catch {
      logTime = new Date();
    }

    const existing = stageInfo.resources.get(resourceKey);
    const isComplete = parsed.action.includes('created') || parsed.action.includes('updated') || parsed.action === 'ready';

    if (!existing) {
      stageInfo.resources.set(resourceKey, {
        type: parsed.type,
        name: parsed.name,
        status: isComplete ? 'ready' : 'creating',
        startTime: logTime,
        endTime: isComplete ? logTime : undefined,
        duration: parsed.duration,
      });
    } else {
      if (isComplete) {
        existing.status = 'ready';
        existing.endTime = logTime;
        existing.duration = parsed.duration || existing.duration;
      }
    }

    // Update stage timing
    if (!stageInfo.startTime || logTime < stageInfo.startTime) {
      stageInfo.startTime = logTime;
    }
    if (isComplete && (!stageInfo.endTime || logTime > stageInfo.endTime)) {
      stageInfo.endTime = logTime;
    }
  });

  // Build stages from parsed data - NO fallback mock data
  const buildStage = (
    id: string,
    label: string,
    stageInfo: StageInfo,
  ): ProvisioningStage => {
    const resources = Array.from(stageInfo.resources.values());
    const readyCount = resources.filter(r => r.status === 'ready').length;
    const totalCount = resources.length;

    let stageStatus: 'pending' | 'creating' | 'ready' | 'failed' = 'pending';
    if (isFailed && totalCount > 0) {
      stageStatus = readyCount === totalCount ? 'ready' : 'failed';
    } else if (isSucceeded) {
      stageStatus = 'ready';
    } else if (totalCount > 0 && readyCount === totalCount) {
      stageStatus = 'ready';
    } else if (totalCount > 0) {
      stageStatus = 'creating';
    }

    // Calculate stage duration
    let duration: string | undefined;
    if (stageInfo.startTime && stageInfo.endTime) {
      const ms = stageInfo.endTime.getTime() - stageInfo.startTime.getTime();
      duration = formatDuration(ms);
    }

    // Build resource list from actual parsed resources
    const resourceList = resources.map(r => {
      const typeName = RESOURCE_TYPE_NAMES[r.type] || RESOURCE_TYPE_NAMES[normalizeResourceType(r.type)] || r.type.split(':').pop() || r.type;
      // Extract a short identifier from the resource name
      const nameParts = r.name.split('-');
      const shortName = nameParts.length > 2 ? nameParts.slice(-2).join('-') : r.name;

      // Calculate duration: for in-progress resources, calculate real-time elapsed
      // For completed resources, use the final duration from Pulumi
      let displayDuration: string | undefined;
      if (r.status === 'creating' && r.startTime && currentTime) {
        // Calculate elapsed time for in-progress resources (real-time updates)
        const elapsedMs = currentTime.getTime() - r.startTime.getTime();
        if (elapsedMs >= 0) {
          displayDuration = formatDuration(elapsedMs);
        }
      } else {
        // Use final duration from Pulumi for completed resources
        displayDuration = r.duration;
      }

      return {
        name: `${typeName} (${shortName})`,
        id: displayDuration,
        status: isFailed && r.status !== 'ready' ? 'failed' as const : r.status,
      };
    });

    return {
      id,
      label,
      status: stageStatus,
      totalResources: totalCount,
      readyResources: readyCount,
      duration,
      resources: resourceList,
    };
  };

  return [
    buildStage('networking', 'Networking & IAM Infrastructure', stageMap.networking),
    buildStage('controlplane', 'EKS Control Plane', stageMap.controlplane),
    buildStage('compute', 'Compute Node Groups', stageMap.compute),
    buildStage('addons', 'Cluster Add-ons & Configuration', stageMap.addons),
  ];
};

// Resource weights based on expected duration (in relative units)
// EKS cluster takes ~10 min, node groups ~5 min, IAM/networking ~10 sec, helm ~30 sec
const RESOURCE_WEIGHTS: Record<string, number> = {
  'aws:eks:Cluster': 60,        // ~10 minutes
  'aws:eks/cluster:Cluster': 60,
  'aws:eks:NodeGroup': 30,       // ~5 minutes each
  'aws:eks/nodeGroup:NodeGroup': 30,
  'kubernetes:helm.sh/v3:Release': 5,  // ~30 seconds
  // Everything else defaults to 1
};

const getResourceWeight = (resourceType: string): number => {
  return RESOURCE_WEIGHTS[resourceType] || 1;
};

// Calculate progress based on weighted resource completion
// This gives more accurate progress as EKS cluster and node groups take much longer
const calculateProgressFromStages = (stages: ProvisioningStage[]): number => {
  let totalWeight = 0;
  let completedWeight = 0;

  stages.forEach(stage => {
    stage.resources?.forEach(resource => {
      // Extract resource type from the name (e.g., "EKS Cluster (test-3)" -> need original type)
      // Since we don't have the original type here, use stage-based weights
      let weight = 1;
      if (stage.id === 'controlplane' && resource.name.includes('EKS Cluster')) {
        weight = 60;
      } else if (stage.id === 'compute' && resource.name.includes('Node Group')) {
        weight = 30;
      } else if (stage.id === 'addons' && resource.name.includes('Helm')) {
        weight = 5;
      }

      totalWeight += weight;
      if (resource.status === 'ready') {
        completedWeight += weight;
      }
    });
  });

  if (totalWeight === 0) return 0;
  return Math.round((completedWeight / totalWeight) * 100);
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
  const [clusterConfig, setClusterConfig] = useState<ClusterConfigResponse | undefined>();
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const logCursorRef = useRef<string>('');

  // Reset log stream when switching jobs
  useEffect(() => {
    setLogs([]);
    logCursorRef.current = '';
    setProvisioningMeta({});
    setClusterConfig(undefined);
  }, [jobId]);

  // Update current time every second for real-time duration display
  useEffect(() => {
    // Only run timer if provisioning is in progress (no completedAt)
    if (provisioningMeta?.completedAt) {
      return;
    }
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, [provisioningMeta?.completedAt]);

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

  // Filter out sensitive data from log messages
  const filterSensitiveData = (message: string): string | null => {
    const trimmed = message.trim();

    // Skip progress indicator lines (dots, @ updating, etc.)
    if (
      trimmed === '.' ||
      trimmed === '..' ||
      trimmed === '...' ||
      /^@\s*(updating|refreshing|destroying)\.+$/i.test(trimmed) ||
      /^\.+$/.test(trimmed)
    ) {
      return null;
    }

    // Skip entirely if it's certificate/kubeconfig data
    if (
      message.includes('certificate-authority-data') ||
      message.includes('LS0tLS1CRUdJTi') || // Base64 cert prefix
      /[A-Za-z0-9+/=]{100,}/.test(message) || // Long base64 strings
      message.includes('apiVersion: "v1"') && message.includes('clusters:') ||
      message.includes('current-context:') ||
      message.includes('interactiveMode:')
    ) {
      return null;
    }
    return message;
  };

  const mapProvisioningLog = (entry: ProvisioningLogView): LogEntry | null => {
    const filtered = filterSensitiveData(entry.message);
    if (!filtered) return null;
    return {
      timestamp: formatLogTimestamp(entry.timestamp),
      message: filtered,
      level: mapProvisioningLogLevel(entry),
    };
  };

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

          // Detect if a new provisioning started (different startedAt) and clear logs
          setProvisioningMeta(prev => {
            const newStartedAt = response.startedAt;
            if (prev.startedAt && newStartedAt && prev.startedAt !== newStartedAt) {
              // New provisioning started - clear logs and reset cursor
              setLogs([]);
              logCursorRef.current = '';
            }
            return {
              projectId: response.projectId,
              clusterId: response.clusterId,
              phase: response.phase,
              startedAt: newStartedAt,
              completedAt: response.completedAt,
            };
          });

          // Update cluster config if available
          if (response.clusterConfig) {
            setClusterConfig(response.clusterConfig);
          }

          if (response.logs && response.logs.length > 0) {
            const mapped = response.logs
              .map(mapProvisioningLog)
              .filter((entry): entry is LogEntry => entry !== null);
            if (mapped.length > 0) {
              setLogs(current => {
                const merged = [...current, ...mapped];
                return merged.slice(-2000);
              });
            }
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
    // Use currentTime for real-time updates when provisioning is in progress
    const end = provisioningMeta?.completedAt
      ? new Date(provisioningMeta.completedAt)
      : currentTime;
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
  }, [provisioningMeta?.startedAt, provisioningMeta?.completedAt, currentTime]);

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

  // Generate stages from logs (pass currentTime for real-time elapsed duration)
  const stages = generateProvisioningStagesFromLogs(logs, job.status, clusterConfig, currentTime);

  // Calculate progress from actual resource completion instead of backend hardcoded value
  const calculatedProgress = calculateProgressFromStages(stages);
  const actualProgress = (() => {
    const statusUpper = job.status?.toUpperCase();
    if (statusUpper === 'SUCCEEDED') return 100;
    if (statusUpper === 'FAILED') return Math.min(calculatedProgress, 99);
    // Use calculated progress, but show at least 1% if we have any logs
    return logs.length > 0 ? Math.max(calculatedProgress, 1) : 0;
  })();

  // Build node pool display strings from cluster config - show actual data only
  const nodePools = clusterConfig?.nodePools || [];

  // Get node pool displays based on actual config
  const getNodePoolDisplay = (index: number): string => {
    const pool = nodePools[index];
    if (!pool) return '—';
    return `${pool.instanceType} (${pool.name}, ${pool.minSize}-${pool.maxSize} nodes)`;
  };

  const totalNodeCount = nodePools.length > 0
    ? nodePools.reduce((sum, np) => sum + (np.maxSize || np.minSize || 0), 0)
    : 0;

  // Region display - show actual or indicate loading
  const regionDisplay = clusterConfig?.region
    ? `AWS (${clusterConfig.region})`
    : provisioningMeta?.clusterId?.includes('us-east')
      ? 'AWS (us-east-1)'
      : '—';

  // K8s version - show actual only
  const k8sVersionDisplay = clusterConfig?.k8sVersion || '—';

  // Autoscaling - only show if we know from config
  const autoscalingEnabled = clusterConfig?.autoscaling ?? (nodePools.length > 0);

  return (
    <ClusterProvisioningDetails
      clusterName={clusterConfig?.clusterName || provisioningMeta?.clusterId || jobId || 'unknown-cluster'}
      status={getStatus()}
      duration={duration}
      phase={provisioningMeta?.phase}
      startedAt={provisioningMeta?.startedAt}
      completedAt={provisioningMeta?.completedAt}
      initiatedBy={initiatedBy}
      environment="Development"
      region={regionDisplay}
      commitHash="—"
      commitMessage="—"
      branch="—"
      k8sVersion={k8sVersionDisplay}
      primaryGpuNodes={getNodePoolDisplay(0)}
      secondaryGpuNodes={getNodePoolDisplay(1)}
      totalNodeCount={totalNodeCount}
      autoscaling={autoscalingEnabled}
      logs={logs}
      progress={actualProgress}
      jobError={job.error}
      stages={stages}
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
