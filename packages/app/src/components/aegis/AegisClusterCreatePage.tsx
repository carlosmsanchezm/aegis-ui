import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  CardHeader,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormHelperText,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Select,
  Step,
  StepLabel,
  Stepper,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
  makeStyles,
} from '@material-ui/core';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import GitHubIcon from '@material-ui/icons/GitHub';
import DescriptionIcon from '@material-ui/icons/Description';
import CodeIcon from '@material-ui/icons/Code';
import CloudDownloadIcon from '@material-ui/icons/CloudDownload';
import DoneIcon from '@material-ui/icons/Done';
import ErrorOutlineIcon from '@material-ui/icons/ErrorOutline';
import LaunchIcon from '@material-ui/icons/Launch';
import {
  Content,
  ContentHeader,
  InfoCard,
  Page,
  WarningPanel,
} from '@backstage/core-components';
import {
  alertApiRef,
  discoveryApiRef,
  fetchApiRef,
  identityApiRef,
  useApi,
} from '@backstage/core-plugin-api';
import { keycloakAuthApiRef } from '../../apis';
import {
  ApiError,
  ImportClusterMethod,
  ImportClusterProvider,
  ImportClusterResponse,
  Job,
  ProjectRecord,
  createCluster,
  getClusterJobStatus,
  importCluster,
  isTerminalStatus,
  listClusters,
  listProjects,
} from '../../../../../plugins/aegis/src/api/aegisClient';

const parseLooseYaml = (input: string): Record<string, unknown> => {
  const result: Record<string, any> = {};
  const stack: { indent: number; target: Record<string, any> }[] = [
    { indent: -1, target: result },
  ];
  const lines = input.split(/\r?\n/);

  lines.forEach(rawLine => {
    const line = rawLine.replace(/\t/g, '  ');
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      return;
    }
    const indent = line.search(/\S|$/);
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }
    const parent = stack[stack.length - 1].target;
    if (trimmed.endsWith(':')) {
      const key = trimmed.slice(0, -1).trim();
      if (!key) {
        throw new Error('Invalid key definition');
      }
      const node: Record<string, any> = {};
      parent[key] = node;
      stack.push({ indent, target: node });
      return;
    }
    const [keyPart, ...valueParts] = trimmed.split(':');
    const key = keyPart.trim();
    if (!key) {
      throw new Error('Invalid key definition');
    }
    const rawValue = valueParts.join(':').trim();
    let value: any = rawValue;
    if (rawValue === 'true' || rawValue === 'false') {
      value = rawValue === 'true';
    } else if (rawValue === 'null' || rawValue === '~' || rawValue === '') {
      value = null;
    } else {
      const numeric = Number(rawValue);
      if (!Number.isNaN(numeric)) {
        value = numeric;
      }
    }
    parent[key] = value;
  });

  return result;
};

const readFileAsBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => {
      reject(reader.error ?? new Error('Unable to read file'));
    };
    reader.onload = () => {
      if (!(reader.result instanceof ArrayBuffer)) {
        reject(new Error('Unable to read file'));
        return;
      }
      const bytes = new Uint8Array(reader.result);
      let binary = '';
      for (let i = 0; i < bytes.length; i += 1) {
        binary += String.fromCharCode(bytes[i]);
      }
      resolve(window.btoa(binary));
    };
    reader.readAsArrayBuffer(file);
  });

type Persona = 'platform-admin' | 'cluster-creator' | 'ml-engineer';

type ProfileCard = {
  id: string;
  name: string;
  version: string;
  provider: 'aws';
  description: string;
  ilLevel: 'IL-4' | 'IL-5';
  fedramp: 'Moderate' | 'High';
  gpu: string;
  cost: number;
  useCase: string;
  baseline: number;
};

const profileCards: ProfileCard[] = [
  {
    id: 'eks-train',
    name: 'Atlas GPU Training',
    version: '1.5.0',
    provider: 'aws',
    description: 'EKS-based GPU-accelerated cluster with on-demand GPU scaling and autoscaler support.',
    ilLevel: 'IL-5',
    fedramp: 'High',
    gpu: 'NVIDIA T4 (on-demand)',
    cost: 12.5,
    useCase: 'Deep learning training & fine-tuning',
    baseline: 45,
  },
  {
    id: 'eks-general',
    name: 'Sentinel General Purpose',
    version: '2.0.0',
    provider: 'aws',
    description: 'Optimized for notebooks, inference, and mixed workloads.',
    ilLevel: 'IL-4',
    fedramp: 'Moderate',
    gpu: 'CPU / optional A10G burst',
    cost: 46.2,
    useCase: 'Interactive notebooks, APIs',
    baseline: 120,
  },
  {
    id: 'eks-secure',
    name: 'Redshift Mission Critical',
    version: '1.2.0',
    provider: 'aws',
    description: 'GovCloud-only deployment with zero-trust guardrails.',
    ilLevel: 'IL-5',
    fedramp: 'High',
    gpu: 'NVIDIA A100',
    cost: 98.4,
    useCase: 'R&D workloads requiring SCIF boundaries',
    baseline: 260,
  },
];

type SchemaField = {
  path: string;
  title: string;
  type: 'string' | 'number' | 'boolean';
  enum?: string[];
  min?: number;
  max?: number;
  description?: string;
  roleVisibility?: Persona[];
  required?: boolean;
  defaultValue?: string | number | boolean;
};

const schemaFields: SchemaField[] = [
  {
    path: 'project',
    title: 'Project',
    type: 'string',
    description: 'Target project within the mission space.',
    required: true,
    defaultValue: 'mission-alpha',
    roleVisibility: ['platform-admin', 'cluster-creator', 'ml-engineer'],
  },
  {
    path: 'cluster.id',
    title: 'Cluster name',
    type: 'string',
    description: 'Unique name for your cluster.',
    required: true,
    defaultValue: 'atlas-train-govcloud',
    roleVisibility: ['platform-admin', 'cluster-creator', 'ml-engineer'],
  },
  {
    path: 'region',
    title: 'Region',
    type: 'string',
    enum: ['us-east-1', 'us-east-2', 'us-west-1', 'us-west-2'],
    description: 'AWS region for cluster deployment.',
    required: true,
    defaultValue: 'us-east-1',
    roleVisibility: ['platform-admin', 'cluster-creator', 'ml-engineer'],
  },
  {
    path: 'gpu.count',
    title: 'GPU Count',
    type: 'number',
    min: 0,
    max: 16,
    defaultValue: 0,
    description: 'Number of GPUs per node pool. Set to 0 for CPU-only clusters.',
    required: true,
    roleVisibility: ['platform-admin', 'cluster-creator'],
  },
  {
    path: 'gpu.type',
    title: 'GPU Type Override',
    type: 'string',
    enum: ['T4', 'A10G', 'A100', 'H100', 'None'],
    // No defaultValue - uses profile default (T4/g4dn.xlarge for eks-train)
    roleVisibility: ['platform-admin'],
    description: 'Override the profile GPU type. Leave empty to use profile default. T4 is most cost-effective.',
  },
  {
    path: 'k8s.version',
    title: 'Kubernetes Version',
    type: 'string',
    enum: ['1.34', '1.33', '1.32', '1.31', '1.30', '1.29'],
    defaultValue: '1.34',
    required: true,
    roleVisibility: ['platform-admin', 'cluster-creator'],
  },
  {
    path: 'nodePool.spotAllowed',
    title: 'Allow Spot Instances',
    type: 'boolean',
    defaultValue: false,
    roleVisibility: ['platform-admin'],
  },
];

const readinessChecks = [
  {
    id: 'quota',
    label: 'GPU quota available',
  },
  {
    id: 'region',
    label: 'Region aligned with profile boundary',
  },
  {
    id: 'policy',
    label: 'Policy pack validation',
  },
  {
    id: 'cost',
    label: 'Cost impact within guardrails',
  },
];

const jobStorageKey = 'aegis.cluster.job';

const useStyles = makeStyles(theme => ({
  layout: {
    paddingBottom: theme.spacing(6),
  },
  tabWrapper: {
    padding: theme.spacing(0, 3, 4),
  },
  cardsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: theme.spacing(2.5),
    marginTop: theme.spacing(2),
  },
  cardSelected: {
    border: `2px solid ${theme.palette.primary.main}`,
    boxShadow: `0 0 0 4px ${theme.palette.primary.main}20`,
  },
  personaToggle: {
    display: 'flex',
    gap: theme.spacing(1),
    alignItems: 'center',
  },
  sectionTitle: {
    marginTop: theme.spacing(3),
    marginBottom: theme.spacing(1.5),
    fontWeight: 600,
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: theme.spacing(2),
  },
  checklist: {
    marginTop: theme.spacing(3),
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: theme.spacing(1.5),
  },
  summaryBox: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: theme.spacing(2),
    marginBottom: theme.spacing(3),
  },
  timelineBox: {
    marginTop: theme.spacing(4),
  },
  terminal: {
    fontFamily: 'Source Code Pro, monospace',
    background: theme.palette.type === 'dark' ? '#05070E' : '#0F172A',
    color: theme.palette.type === 'dark' ? '#E2E8F0' : '#E2E8F0',
    padding: theme.spacing(2),
    borderRadius: theme.shape.borderRadius * 2,
    minHeight: 160,
    overflow: 'auto',
  },
  yamlEditor: {
    fontFamily: 'Source Code Pro, monospace',
    minHeight: 200,
  },
  helperCard: {
    padding: theme.spacing(2.5),
  },
  radioOption: {
    display: 'flex',
    gap: theme.spacing(1.5),
    alignItems: 'center',
  },
}));

type FormState = Record<string, string | number | boolean>;

type TimelineStep = {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'done' | 'error';
  hint?: string;
};

type AgentConnectionStatus = 'idle' | 'waiting' | 'connected' | 'timed_out' | 'failed';

const baseTimeline = (): TimelineStep[] => [
  { id: 'submit', label: 'Submit spec', status: 'pending' },
  { id: 'pulumi', label: 'Pulumi apply', status: 'pending' },
  { id: 'ready', label: 'Cluster ready', status: 'pending' },
];

const buildTimeline = (status?: string): TimelineStep[] => {
  const normalized = status?.toUpperCase();
  const steps = baseTimeline().map(step => ({ ...step }));
  switch (normalized) {
    case 'PENDING':
      steps[0].status = 'running';
      break;
    case 'RUNNING':
      steps[0].status = 'done';
      steps[1].status = 'running';
      break;
    case 'SUCCEEDED':
      return steps.map(step => ({ ...step, status: 'done' as TimelineStep['status'] }));
    case 'FAILED':
      steps[0].status = steps[0].status === 'pending' ? 'done' : steps[0].status;
      steps[1].status = 'error';
      steps[2].status = 'error';
      break;
    default:
      break;
  }
  return steps;
};

const sanitizeClusterId = (value: string): string => {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return slug || `cluster-${Date.now().toString(36)}`;
};

const clusterIdIsValid = (value: string): boolean =>
  /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(value);

const parseLabelLines = (
  raw: string,
): { labels: Record<string, string>; error?: string } => {
  const labels: Record<string, string> = {};
  const lines = raw
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const idx = line.indexOf('=');
    if (idx <= 0) {
      return {
        labels: {},
        error: `Invalid label "${line}". Use key=value (one per line).`,
      };
    }
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (!key || !value) {
      return {
        labels: {},
        error: `Invalid label "${line}". Use key=value (one per line).`,
      };
    }
    labels[key] = value;
  }

  return { labels };
};

const renderHelmValuesYaml = (result: ImportClusterResponse | null): string => {
  const env = result?.helmValues?.k8sAgent?.env ?? {};
  const keys = Object.keys(env).sort((a, b) => a.localeCompare(b));
  if (keys.length === 0) {
    return '# No helm values returned.';
  }
  const lines = ['k8sAgent:', '  env:'];
  keys.forEach(key => {
    lines.push(`    ${key}: ${JSON.stringify(env[key] ?? '')}`);
  });
  return lines.join('\n');
};

const buildProfileParameters = (
  formState: FormState,
): Record<string, string | number | boolean> | undefined => {
  const params: Record<string, string | number | boolean> = {};
  if (typeof formState['k8s.version'] === 'string' && formState['k8s.version']) {
    params['k8s.version'] = formState['k8s.version'];
  }
  if (typeof formState['gpu.count'] === 'number' && !Number.isNaN(formState['gpu.count'])) {
    params['gpu.count'] = formState['gpu.count'];
  }
  if (typeof formState['gpu.type'] === 'string' && formState['gpu.type']) {
    params['gpu.type'] = formState['gpu.type'];
  }
  if (typeof formState['nodePool.spotAllowed'] === 'boolean') {
    params['nodePool.spotAllowed'] = formState['nodePool.spotAllowed'];
  }
  return Object.keys(params).length > 0 ? params : undefined;
};

export const AegisClusterCreatePage = () => {
  const classes = useStyles();
  const navigate = useNavigate();
  const alertApi = useApi(alertApiRef);
  const fetchApi = useApi(fetchApiRef);
  const discoveryApi = useApi(discoveryApiRef);
  const identityApi = useApi(identityApiRef);
  const authApi = useApi(keycloakAuthApiRef);
  const [tab, setTab] = useState(0);
  const [persona] = useState<Persona>('ml-engineer');
  const [activeProfileId, setActiveProfileId] = useState<string | null>(
    profileCards[0].id,
  );
  const [fromProfileStep, setFromProfileStep] = useState(0);
  const [formState, setFormState] = useState<FormState>(() => {
    const defaults: FormState = {};
    schemaFields.forEach(field => {
      if (field.defaultValue !== undefined) {
        defaults[field.path] = field.defaultValue;
      }
    });
    return defaults;
  });
  const [, setTimeline] = useState<TimelineStep[]>(() => buildTimeline());
  const [isLaunching, setIsLaunching] = useState(false);
  const [gitMode, setGitMode] = useState<'plan' | 'apply'>('plan');
  const [gitEngine, setGitEngine] = useState<'pulumi' | 'terraform'>(
    'pulumi',
  );
  const [gitApprovalRequired, setGitApprovalRequired] = useState(true);
  const [gitRepo, setGitRepo] = useState('github.com/aegis/mission-iac');
  const [gitPath, setGitPath] = useState('clusters/atlas');
  const [gitBranch, setGitBranch] = useState('main');
  const [yamlSpec, setYamlSpec] = useState(
    `name: atlas-train-govcloud\nprofileRef: eks-train@1.5.0\nregion: us-east-1\nparameters:\n  gpu:\n    count: 0\n  nodePool:\n    spotAllowed: false\n`);
  const [yamlError, setYamlError] = useState<string | null>(null);
  const [planOutput, setPlanOutput] = useState<string>('');
  const [importStep, setImportStep] = useState(0);
  const [importValidationEnabled, setImportValidationEnabled] = useState(false);
  const [importMethod, setImportMethod] =
    useState<ImportClusterMethod>('agent_only');
  const [importProvider, setImportProvider] =
    useState<ImportClusterProvider>('local');
  const [importRegion, setImportRegion] = useState('local');
  const [importClusterId, setImportClusterId] = useState('dev-local');
  const [importClusterName, setImportClusterName] = useState(
    'Local Development Cluster',
  );
  const [importLabels, setImportLabels] = useState('');
  const [importAssumeRoleArn, setImportAssumeRoleArn] = useState('');
  const [importKubeconfigFile, setImportKubeconfigFile] = useState<File | null>(
    null,
  );
  const [importResult, setImportResult] =
    useState<ImportClusterResponse | null>(null);
  const [importingCluster, setImportingCluster] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSubmittedProjectId, setImportSubmittedProjectId] = useState<string | null>(null);
  const [agentConnectionStatus, setAgentConnectionStatus] =
    useState<AgentConnectionStatus>('idle');
  const [agentConnectionError, setAgentConnectionError] = useState<string | null>(null);
  const [agentConnectionAttempt, setAgentConnectionAttempt] = useState(0);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [jobContext, setJobContext] = useState<{ projectId: string; clusterId: string } | null>(null);
  const jobStatusNotifiedRef = useRef<string | null>(null);
  const importNavigateRef = useRef(false);
  const projectHasAwsCredentials = (project?: ProjectRecord | null) =>
    Boolean(project?.aws?.accountId);

  const selectedProfile = useMemo(
    () => profileCards.find(card => card.id === activeProfileId) ?? null,
    [activeProfileId],
  );
  const selectedProjectId = String(formState['project'] ?? '');
  const selectedProjectRecord = useMemo(
    () => projects.find(project => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );
  const selectedProjectHasAws = projectHasAwsCredentials(selectedProjectRecord);


  useEffect(() => {
    let active = true;
    const loadProjects = async () => {
      setLoadingProjects(true);
      try {
        const response = await listProjects(fetchApi, discoveryApi, identityApi, authApi);
        if (!active) {
          return;
        }
        const items = response.items ?? [];
        setProjects(items);
        if (items.length > 0) {
          setFormState(prev => {
            if (prev['project']) {
              return prev;
            }
            return { ...prev, project: items[0].id };
          });
        }
        setProjectError(null);
      } catch (err) {
        if (!active) {
          return;
        }
        const message =
          err instanceof ApiError
            ? err.message
            : 'Unable to load projects from the platform API.';
        setProjectError(message);
      } finally {
        if (active) {
          setLoadingProjects(false);
        }
      }
    };
    loadProjects();
    return () => {
      active = false;
    };
  }, [fetchApi, discoveryApi, identityApi, authApi]);

  useEffect(() => {
    const raw = sessionStorage.getItem(jobStorageKey);
    if (!raw) {
      return;
    }
    try {
      const parsed = JSON.parse(raw) as {
        projectId?: string;
        clusterId?: string;
        job?: Job;
      };
      if (!parsed?.job) {
        return;
      }
      setJob(parsed.job);
      if (parsed.projectId) {
        setFormState(prev => ({ ...prev, project: prev['project'] ?? parsed.projectId }));
      }
      if (parsed.projectId && parsed.clusterId) {
        setJobContext({ projectId: parsed.projectId, clusterId: parsed.clusterId });
      }
      setFromProfileStep(2);
      setTimeline(buildTimeline(parsed.job.status));
      setIsLaunching(!isTerminalStatus(parsed.job.status));
    } catch {
      sessionStorage.removeItem(jobStorageKey);
    }
  }, []);

  useEffect(() => {
    if (!job || !jobContext) {
      sessionStorage.removeItem(jobStorageKey);
      return;
    }
    sessionStorage.setItem(
      jobStorageKey,
      JSON.stringify({ projectId: jobContext.projectId, clusterId: jobContext.clusterId, job }),
    );
    if (isTerminalStatus(job.status)) {
      sessionStorage.removeItem(jobStorageKey);
      setJobContext(null);
    }
  }, [job, jobContext]);

  useEffect(() => {
    if (!job) {
      setTimeline(buildTimeline());
      return;
    }
    setTimeline(buildTimeline(job.status));
    if (isTerminalStatus(job.status)) {
      setIsLaunching(false);
      if (jobStatusNotifiedRef.current !== job.status) {
        jobStatusNotifiedRef.current = job.status;
        if (job.status === 'SUCCEEDED') {
          alertApi.post({
            severity: 'success',
            message: `Cluster job ${job.id} completed successfully`,
          });
        } else if (job.status === 'FAILED') {
          alertApi.post({
            severity: 'error',
            message: job.error
              ? `Cluster job ${job.id} failed: ${job.error}`
              : `Cluster job ${job.id} failed`,
          });
        }
      }
    }
  }, [job, alertApi]);

  useEffect(() => {
    if (!job || isTerminalStatus(job.status)) {
      return undefined;
    }
    const timeout = setTimeout(async () => {
      try {
        const response = await getClusterJobStatus(
          fetchApi,
          discoveryApi,
          identityApi,
          authApi,
          job.id,
        );
        setJob(response.job);
      } catch (error) {
        setIsLaunching(false);
        const message =
          error instanceof ApiError
            ? error.message
            : 'Unable to refresh cluster job status';
        alertApi.post({ severity: 'error', message });
      }
    }, 5000);
    return () => clearTimeout(timeout);
  }, [job, fetchApi, discoveryApi, identityApi, authApi, alertApi]);

  const importProjectId = selectedProjectId.trim();
  const importClusterIdTrimmed = importClusterId.trim();
  const importClusterIdSuggestion = sanitizeClusterId(importClusterIdTrimmed);
  const importClusterNameTrimmed = importClusterName.trim();
  const importRegionTrimmed = importRegion.trim();
  const importAssumeRoleArnTrimmed = importAssumeRoleArn.trim();
  const importLabelsParsed = useMemo(() => parseLabelLines(importLabels), [importLabels]);

  const importClusterIdError = useMemo(() => {
    if (!importValidationEnabled && !importClusterIdTrimmed) {
      return null;
    }
    if (!importClusterIdTrimmed) {
      return 'Cluster ID is required.';
    }
    if (importClusterIdTrimmed !== importClusterIdSuggestion) {
      return `Use lowercase letters, numbers, and hyphens (suggested: ${importClusterIdSuggestion}).`;
    }
    if (!clusterIdIsValid(importClusterIdTrimmed)) {
      return 'Cluster ID must start and end with a letter or number and may contain hyphens.';
    }
    return null;
  }, [importValidationEnabled, importClusterIdSuggestion, importClusterIdTrimmed]);

  const importDetailsValid =
    Boolean(importProjectId) &&
    Boolean(importClusterNameTrimmed) &&
    Boolean(importRegionTrimmed) &&
    Boolean(importClusterIdTrimmed) &&
    !importClusterIdError &&
    !importLabelsParsed.error;

  const importCredentialsValid =
    importDetailsValid &&
    (importMethod === 'assume_role'
      ? importProvider === 'existing-aws' && Boolean(importAssumeRoleArnTrimmed)
      : importMethod === 'kubeconfig'
        ? Boolean(importKubeconfigFile)
        : true);

  useEffect(() => {
    if (importProvider !== 'existing-aws' && importMethod === 'assume_role') {
      setImportMethod('agent_only');
      setImportAssumeRoleArn('');
    }
  }, [importMethod, importProvider]);

  useEffect(() => {
    if (importMethod !== 'kubeconfig' && importKubeconfigFile) {
      setImportKubeconfigFile(null);
    }
    if (importMethod !== 'assume_role' && importAssumeRoleArn) {
      setImportAssumeRoleArn('');
    }
  }, [importAssumeRoleArn, importKubeconfigFile, importMethod]);

  useEffect(() => {
    if (importStep !== 2 || !importResult || !importSubmittedProjectId) {
      setAgentConnectionStatus('idle');
      setAgentConnectionError(null);
      importNavigateRef.current = false;
      return;
    }

    if (importResult.status === 'active') {
      setAgentConnectionStatus('connected');
      setAgentConnectionError(null);
      return;
    }

    setAgentConnectionStatus('waiting');
    setAgentConnectionError(null);

    let cancelled = false;
    let intervalId: number | undefined;
    let timeoutId: number | undefined;

    const stop = () => {
      if (intervalId) {
        window.clearInterval(intervalId);
      }
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };

    const check = async () => {
      if (cancelled) {
        return;
      }
      try {
        const clusters = await listClusters(
          fetchApi,
          discoveryApi,
          identityApi,
          authApi,
          { projectId: importSubmittedProjectId },
        );
        if (cancelled) {
          return;
        }
        const cluster = clusters.find(item => item.id === importResult.clusterId);
        if (!cluster) {
          return;
        }
        const phase = (cluster.phase ?? '').toLowerCase();
        if (phase.includes('ready') || Boolean(cluster.lastHeartbeat)) {
          if (cancelled) {
            return;
          }
          setAgentConnectionStatus('connected');
          setAgentConnectionError(null);
          stop();
          return;
        }
        if (phase.includes('unhealthy')) {
          if (cancelled) {
            return;
          }
          setAgentConnectionStatus('failed');
          setAgentConnectionError('Agent connected but the cluster is reporting unhealthy.');
          stop();
          return;
        }
        if (phase.includes('error') || phase.includes('degraded')) {
          if (cancelled) {
            return;
          }
          setAgentConnectionStatus('failed');
          setAgentConnectionError(
            `Cluster is reporting ${cluster.phase || 'an error'} while waiting for agent connection.`,
          );
          stop();
        }
      } catch (err) {
        if (cancelled) {
          return;
        }
        const message =
          err instanceof ApiError ? err.message : 'Unable to check agent connection status.';
        setAgentConnectionStatus('failed');
        setAgentConnectionError(message);
        stop();
      }
    };

    void check();
    intervalId = window.setInterval(check, 5000);
    timeoutId = window.setTimeout(() => {
      if (cancelled) {
        return;
      }
      setAgentConnectionStatus('timed_out');
      setAgentConnectionError(
        'Cluster import succeeded, but no agent heartbeat was observed within 3 minutes. If Aegis is installing the spoke agent automatically, this may take a few more moments. Click "Retry status check" to continue polling.',
      );
      stop();
    }, 180000);

    return () => {
      cancelled = true;
      stop();
    };
  }, [
    agentConnectionAttempt,
    authApi,
    discoveryApi,
    fetchApi,
    identityApi,
    importResult,
    importStep,
    importSubmittedProjectId,
  ]);

  useEffect(() => {
    if (agentConnectionStatus !== 'connected' || !importResult) {
      return undefined;
    }
    if (importNavigateRef.current) {
      return undefined;
    }
    importNavigateRef.current = true;
    const timeoutId = window.setTimeout(() => {
      navigate(`/aegis/clusters/${encodeURIComponent(importResult.clusterId)}`);
    }, 1000);
    return () => window.clearTimeout(timeoutId);
  }, [agentConnectionStatus, importResult, navigate]);

  const readinessState = useMemo(() => {
    return readinessChecks.map(check => {
      if (check.id === 'quota') {
        const gpuCount = Number(formState['gpu.count'] ?? 0);
        return {
          ...check,
          status: gpuCount <= 8 ? 'pass' : 'warn',
          detail:
            gpuCount <= 8
              ? 'Within reserved GPU allotment'
              : 'Request triggers quota approval',
        };
      }
      if (check.id === 'cost') {
        const cost = selectedProfile ? selectedProfile.cost : 0;
        const adjustment = Number(formState['gpu.count'] ?? 0) * 8;
        const total = cost + adjustment;
        const withinGuardrail = total < 220;
        return {
          ...check,
          status: withinGuardrail ? 'pass' : 'warn',
          detail: withinGuardrail
            ? `Projected $${total.toFixed(1)} / hr`
            : `Projected $${total.toFixed(1)} / hr exceeds guardrail`,
        };
      }
      if (check.id === 'region') {
        const region = formState['region'];
        return {
          ...check,
          status: region === 'us-gov-west-1' ? 'pass' : 'warn',
          detail:
            region === 'us-gov-west-1'
              ? 'Aligned with GovCloud boundary'
              : 'Region change requires approval',
        };
      }
      return {
        ...check,
        status: 'pass',
        detail: 'OPA policy bundle validated',
      };
    });
  }, [formState, selectedProfile]);

  const renderedParameters = useMemo(() => {
    return schemaFields.filter(field => {
      if (!field.roleVisibility) {
        return true;
      }
      return field.roleVisibility.includes(persona);
    });
  }, [persona]);

  const handleFieldChange = (path: string, value: string | number | boolean) => {
    setFormState(prev => ({ ...prev, [path]: value }));
  };

  const estimatedCost = useMemo(() => {
    const base = selectedProfile?.cost ?? 0;
    const gpuCount = Number(formState['gpu.count'] ?? 0);
    const addOn = gpuCount * 8;
    const spotAllowed = Boolean(formState['nodePool.spotAllowed']);
    const spotDiscount = spotAllowed ? 0.2 * (base + addOn) : 0;
    return base + addOn - spotDiscount;
  }, [selectedProfile, formState]);

  const onValidateYaml = () => {
    try {
      const parsed = parseLooseYaml(yamlSpec);
      if (!parsed || typeof parsed !== 'object' || Object.keys(parsed).length === 0) {
        throw new Error('Spec must contain at least one key');
      }
      setYamlError(null);
      setPlanOutput(
        `✅ Parsed manifest with ${Object.keys(parsed).length} top-level keys.\n` +
          `ℹ️ Ready to ${gitMode === 'plan' ? 'generate plan' : 'plan & apply'} using ${gitEngine}.`,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to interpret declarative spec';
      setYamlError(message);
      setPlanOutput('');
    }
  };

  const onRunPlan = () => {
    if (yamlError) {
      return;
    }
    setPlanOutput(prev =>
      prev +
      `\n--- Plan execution @ ${new Date().toLocaleTimeString()} ---\n` +
        `• Repo: ${gitRepo}\n• Branch: ${gitBranch}\n• Path: ${gitPath}\n• Engine: ${gitEngine}\n• Mode: ${gitMode === 'plan' ? 'Plan only' : 'Plan + Apply'}\n` +
        `→ Result: ${gitMode === 'plan' ? 'Change set pending approval' : 'Apply requires 1 approver'}\n`,
    );
  };

  const handleLaunch = async () => {
    const profile = selectedProfile;
    if (!profile) {
      alertApi.post({ severity: 'error', message: 'Select a cluster profile before launching.' });
      return;
    }
    const projectId = String(formState['project'] ?? '').trim();
    if (!projectId) {
      alertApi.post({ severity: 'error', message: 'Project ID is required.' });
      return;
    }
    const region = String(formState['region'] ?? '').trim();
    if (!region) {
      alertApi.post({ severity: 'error', message: 'Region is required.' });
      return;
    }
    const clusterInput = String(formState['cluster.id'] ?? '').trim();
    const clusterId = sanitizeClusterId(clusterInput || `${profile.id}-${Date.now().toString(36)}`);

    const profileParameters = buildProfileParameters(formState);
    const profilePayload = {
      id: profile.id,
      version: profile.version,
      ...(profileParameters ? { parameters: profileParameters } : {}),
    };
    const launchProject = projects.find(project => project.id === projectId);
    if (launchProject && !projectHasAwsCredentials(launchProject)) {
      alertApi.post({
        severity: 'error',
        message: 'Selected project is missing AWS credentials. Update the project in the admin page before launching.',
      });
      return;
    }

    jobStatusNotifiedRef.current = null;
    setJob(null);
    setTimeline(buildTimeline());
    setIsLaunching(true);

    try {
      const response = await createCluster(
        fetchApi,
        discoveryApi,
        identityApi,
        authApi,
        {
          projectId,
          clusterId,
          provider: profile.provider,
          region,
          profile: profilePayload,
        },
      );
      setJob(response.job);
      setJobContext({ projectId, clusterId });
      alertApi.post({
        severity: 'info',
        message: `Cluster job ${response.job.id} submitted - redirecting to status page...`,
      });

      // Navigate to standalone status page
      setTimeout(() => {
        navigate(`/aegis/provisioning/status/${response.job.id}`);
      }, 1000); // Small delay to show the alert
    } catch (error) {
      setIsLaunching(false);
      setJobContext(null);
      sessionStorage.removeItem(jobStorageKey);
      const message =
        error instanceof ApiError
          ? error.message
          : 'Failed to submit cluster launch request';
      alertApi.post({ severity: 'error', message });
    }
  };

  const handleImportExisting = async () => {
    setImportValidationEnabled(true);
    if (!importCredentialsValid) {
      alertApi.post({
        severity: 'error',
        message: 'Fix the highlighted fields before importing.',
      });
      return;
    }

    setImportingCluster(true);
    setImportError(null);
    setImportResult(null);
    setImportSubmittedProjectId(importProjectId);
    setAgentConnectionStatus('idle');
    setAgentConnectionError(null);
    importNavigateRef.current = false;

    try {
      const kubeconfig =
        importMethod === 'kubeconfig' && importKubeconfigFile
          ? await readFileAsBase64(importKubeconfigFile)
          : undefined;
      const labelsRecord = importLabelsParsed.labels;
      const labels =
        labelsRecord && Object.keys(labelsRecord).length > 0 ? labelsRecord : undefined;
      const response = await importCluster(
        fetchApi,
        discoveryApi,
        identityApi,
        authApi,
        {
          projectId: importProjectId,
          clusterId: importClusterIdTrimmed,
          provider: importProvider,
          region: importRegionTrimmed,
          name: importClusterNameTrimmed,
          ...(labels ? { labels } : {}),
          importMethod,
          ...(kubeconfig ? { kubeconfig } : {}),
          ...(importMethod === 'assume_role' && importAssumeRoleArnTrimmed
            ? { assumeRoleArn: importAssumeRoleArnTrimmed }
            : {}),
        },
      );
      setImportResult(response);
      setImportStep(2);
      if (response.warnings?.length) {
        alertApi.post({
          severity: 'warning',
          message: response.warnings.join(' • '),
        });
      } else {
        alertApi.post({
          severity: 'success',
          message:
            response.status === 'active'
              ? `Cluster ${response.clusterId} is connected - redirecting to details...`
              : response.status === 'installing'
                ? `Cluster ${response.clusterId} importing - installing spoke agent automatically...`
                : `Cluster ${response.clusterId} imported - waiting for agent connection...`,
        });
      }
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : 'Failed to import cluster.';
      setImportError(message);
      alertApi.post({ severity: 'error', message });
    } finally {
      setImportingCluster(false);
    }
  };

  const resetImportFlow = () => {
    setImportValidationEnabled(false);
    setImportStep(0);
    setImportError(null);
    setImportResult(null);
    setImportingCluster(false);
    setImportSubmittedProjectId(null);
    setAgentConnectionStatus('idle');
    setAgentConnectionError(null);
    setAgentConnectionAttempt(0);
    importNavigateRef.current = false;
  };

  const handleImportContinue = async () => {
    setImportValidationEnabled(true);
    if (importStep === 0) {
      if (!importDetailsValid) {
        alertApi.post({
          severity: 'error',
          message: 'Fix the highlighted fields to continue.',
        });
        return;
      }
      setImportStep(1);
      return;
    }

    if (importStep === 1) {
      await handleImportExisting();
    }
  };

  const attachCommand = useMemo(() => {
    if (!importResult) {
      return 'Submit an import request to generate an install command.';
    }
    const lines: string[] = [];
    if (importResult.agentScriptUrl) {
      lines.push(`curl -fsSL ${importResult.agentScriptUrl} | bash`);
    }
    if (importResult.installCommand) {
      if (lines.length > 0) {
        lines.push('# OR');
      }
      lines.push(importResult.installCommand);
    }
    return lines.join('\n');
  }, [importResult]);

  const renderFromProfile = () => (
    <Box>
      <Stepper alternativeLabel activeStep={fromProfileStep}>
        {['Select profile', 'Parameters', 'Review & launch'].map(label => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {fromProfileStep === 0 && (
        <Box mt={3}>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Select a cluster profile</Typography>
          </Box>
          {projectError && (
            <WarningPanel severity="warning" title="Projects unavailable">
              {projectError}
            </WarningPanel>
          )}
          {loadingProjects && !projectError && (
            <Typography variant="body2" color="textSecondary" style={{ marginTop: 16 }}>
              Loading projects…
            </Typography>
          )}
          {projects.length > 0 ? (
            <FormControl variant="outlined" fullWidth style={{ marginTop: 16 }}>
              <InputLabel id="cluster-project-select">Project</InputLabel>
              <Select
                labelId="cluster-project-select"
                value={selectedProjectId}
                onChange={event =>
                  setFormState(prev => ({ ...prev, project: event.target.value as string }))
                }
                label="Project"
              >
                {projects.map(project => (
                  <MenuItem key={project.id} value={project.id}>
                    {project.displayName || project.id}
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>Choose the owning project to enforce guardrails.</FormHelperText>
            </FormControl>
          ) : (
            <TextField
              label="Project ID"
              value={selectedProjectId}
              onChange={event => setFormState(prev => ({ ...prev, project: event.target.value }))}
              helperText="Enter the project slug while backend projects are unavailable."
              variant="outlined"
              fullWidth
              style={{ marginTop: 16 }}
            />
          )}
          {selectedProjectRecord && selectedProjectHasAws && (
            <Box mt={2}>
              <Typography variant="body2" color="textSecondary">
                Deployments will assume {selectedProjectRecord.aws?.roleArn}
              </Typography>
              <Typography variant="caption" color="textSecondary">
                Account {selectedProjectRecord.aws?.accountId} · External ID {selectedProjectRecord.aws?.externalId}
              </Typography>
            </Box>
          )}
          {selectedProjectRecord && !selectedProjectHasAws && (
            <Box mt={2}>
              <WarningPanel severity="warning" title="Project missing AWS credentials">
                Update the project in the admin portal with the AWS account ID before launching
                clusters.
              </WarningPanel>
            </Box>
          )}
          <div className={classes.cardsGrid}>
            {profileCards.map(card => {
              const isSelected = card.id === activeProfileId;
              return (
                <Card
                  key={card.id}
                  className={isSelected ? classes.cardSelected : undefined}
                  variant="outlined"
                >
                  <CardActionArea onClick={() => setActiveProfileId(card.id)}>
                    <CardHeader
                      title={card.name}
                      subheader={card.useCase}
                      action={<Chip label={`${card.ilLevel} · FedRAMP ${card.fedramp}`} />}
                    />
                    <CardContent>
                      <Typography variant="body2" color="textSecondary">
                        {card.description}
                      </Typography>
                      <Divider style={{ margin: '16px 0' }} />
                      <Typography variant="body2">
                        GPU: {card.gpu}
                      </Typography>
                      <Typography variant="body2">
                        Baseline cost: ${card.cost.toFixed(1)} / hr
                      </Typography>
                    </CardContent>
                  </CardActionArea>
                </Card>
              );
            })}
          </div>
        </Box>
      )}

      {fromProfileStep === 1 && (
        <Box mt={3}>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Parameters</Typography>
          </Box>
          <Typography variant="body2" color="textSecondary" paragraph>
            Configure your {selectedProfile?.name || 'cluster'} settings.
          </Typography>
          <div className={classes.formGrid}>
            {renderedParameters.map(field => {
              const value = formState[field.path] ?? '';
              const disabled =
                field.roleVisibility != null && !field.roleVisibility.includes(persona);

              if (field.type === 'boolean') {
                return (
                  <FormGroup key={field.path}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={Boolean(value)}
                          onChange={event =>
                            handleFieldChange(field.path, event.target.checked)
                          }
                          color="primary"
                          disabled={disabled}
                        />
                      }
                      label={field.title}
                    />
                    <FormHelperText>{field.description}</FormHelperText>
                  </FormGroup>
                );
              }

              if (field.enum) {
                return (
                  <FormControl key={field.path} disabled={disabled}>
                    <InputLabel>{field.title}</InputLabel>
                    <Select
                      value={value || ''}
                      onChange={event =>
                        handleFieldChange(field.path, event.target.value as string)
                      }
                    >
                      {field.enum.map(option => (
                        <MenuItem key={option} value={option}>
                          {option}
                        </MenuItem>
                      ))}
                    </Select>
                    <FormHelperText>{field.description}</FormHelperText>
                  </FormControl>
                );
              }

              return (
                <TextField
                  key={field.path}
                  type={field.type === 'number' ? 'number' : 'text'}
                  label={field.title}
                  value={value}
                  onChange={event => {
                    const val = field.type === 'number'
                      ? Number(event.target.value)
                      : event.target.value;
                    handleFieldChange(field.path, val);
                  }}
                  inputProps={{ min: field.min, max: field.max }}
                  helperText={field.description}
                  disabled={disabled}
                />
              );
            })}
          </div>

          <Typography className={classes.sectionTitle} variant="subtitle1">
            Cost preview
          </Typography>
          <InfoCard title="Estimated hourly cost" subheader="All node pools">
            <Typography variant="h4" component="div">
              ${estimatedCost.toFixed(1)} / hr
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Baseline includes platform agent, audit log ingestion, and IL/FedRAMP guardrails.
            </Typography>
          </InfoCard>

          <Typography className={classes.sectionTitle} variant="subtitle1">
            Readiness checklist
          </Typography>
          <div className={classes.checklist}>
            {readinessState.map(check => (
              <Paper key={check.id} className={classes.helperCard} variant="outlined">
                <Box
                  display="flex"
                  alignItems="center"
                  style={{ gap: 8 }}
                >
                  {check.status === 'pass' ? (
                    <DoneIcon color="primary" />
                  ) : (
                    <ErrorOutlineIcon color="secondary" />
                  )}
                  <Typography variant="subtitle2">{check.label}</Typography>
                </Box>
                <Typography variant="body2" color="textSecondary">
                  {check.detail}
                </Typography>
              </Paper>
            ))}
          </div>
        </Box>
      )}

      {fromProfileStep === 2 && selectedProfile && (
        <Box mt={3}>
          <div className={classes.summaryBox}>
            <InfoCard title="Profile" subheader="Selected blueprint">
              <Typography variant="h6">{selectedProfile.name}</Typography>
              <Typography variant="body2" color="textSecondary">
                {selectedProfile.ilLevel} · FedRAMP {selectedProfile.fedramp}
              </Typography>
            </InfoCard>
            <InfoCard title="Parameters" subheader="Launch configuration">
              <Typography variant="body2" component="div">
                <div><strong>Project:</strong> {selectedProjectId || '—'}</div>
                <div><strong>Cluster:</strong> {String(formState['cluster.id'] || '—')}</div>
                <div><strong>Region:</strong> {String(formState['region'] || '—')}</div>
                {renderedParameters
                  .filter(field => !['project', 'cluster.id', 'region'].includes(field.path))
                  .map(field => (
                    <div key={field.path}>
                      <strong>{field.title}:</strong> {String(formState[field.path] ?? '—')}
                    </div>
                  ))}
                <Divider style={{ margin: '12px 0' }} />
                <div>
                  <strong>Estimated cost:</strong> ${estimatedCost.toFixed(1)} / hr
                </div>
              </Typography>
            </InfoCard>
            <Accordion elevation={0} defaultExpanded={false}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle2">Technical details (IaC payload)</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography
                  variant="body2"
                  component="pre"
                  style={{
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'Source Code Pro, monospace',
                    width: '100%',
                  }}
                >
                  {`profileRef: ${selectedProfile.id}@${selectedProfile.version}\nregion: ${formState['region']}\nparameters:\n  gpu:\n    count: ${formState['gpu.count'] ?? 0}\n    type: ${formState['gpu.type'] ?? '(profile default)'}\n  nodePool:\n    spotAllowed: ${Boolean(formState['nodePool.spotAllowed'])}\n`}
                </Typography>
              </AccordionDetails>
            </Accordion>
          </div>
          <Box display="flex" style={{ gap: 8 }}>
            {isLaunching || (!!job && !isTerminalStatus(job.status)) ? (
              <Button
                variant="outlined"
                color="secondary"
                onClick={() => {
                  sessionStorage.removeItem(jobStorageKey);
                  setJob(null);
                  setJobContext(null);
                  setIsLaunching(false);
                  setTimeline(buildTimeline());
                }}
              >
                Start New Cluster
              </Button>
            ) : null}
            <Button
              variant="contained"
              color="primary"
              onClick={handleLaunch}
              startIcon={<LaunchIcon />}
              disabled={
                isLaunching || (!!job && !isTerminalStatus(job.status)) || !selectedProjectId
              }
            >
              Launch
            </Button>
            <Button variant="outlined" startIcon={<CloudDownloadIcon />}>
              Export spec
            </Button>
            <Button variant="outlined" startIcon={<CodeIcon />}>
              Open as PR
            </Button>
          </Box>

          {/* Inline provisioning UI removed - now redirects to standalone page */}
          {/* Users will be redirected to /aegis/provisioning/status/:jobId after launch */}
        </Box>
      )}

      <Box mt={3} display="flex" justifyContent="space-between">
        {fromProfileStep === 0 ? (
          <Button component={RouterLink} to="/aegis/clusters">
            Cancel
          </Button>
        ) : (
          <Button
            onClick={() => setFromProfileStep(step => Math.max(0, step - 1))}
          >
            Back
          </Button>
        )}
        {fromProfileStep < 2 && (
          <Button
            color="primary"
            variant="contained"
            disabled={fromProfileStep === 0 && !activeProfileId}
            onClick={() =>
              setFromProfileStep(step => Math.min(2, step + 1))
            }
          >
            Continue
          </Button>
        )}
      </Box>
    </Box>
  );

  const renderDeclarative = () => (
    <Box
      mt={2}
      display="grid"
      gridTemplateColumns="2fr 1fr"
      style={{ gap: 24 }}
    >
      <div>
        <Typography variant="h6">Git-backed workflow</Typography>
        <Typography variant="body2" color="textSecondary" paragraph>
          Wire Aegis into your Pulumi or Terraform pipelines. Configure how runs are
          initiated and whether plan results require approval before apply.
        </Typography>
        <Box
          display="grid"
          gridTemplateColumns="repeat(auto-fit, minmax(220px, 1fr))"
          style={{ gap: 16 }}
        >
          <TextField
            label="Repository"
            value={gitRepo}
            onChange={event => setGitRepo(event.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><GitHubIcon /></InputAdornment> }}
          />
          <TextField
            label="Branch"
            value={gitBranch}
            onChange={event => setGitBranch(event.target.value)}
          />
          <TextField
            label="Path"
            value={gitPath}
            onChange={event => setGitPath(event.target.value)}
            helperText="Relative to repo root"
          />
          <FormControl>
            <InputLabel>Engine</InputLabel>
            <Select
              value={gitEngine}
              onChange={event => setGitEngine(event.target.value as 'pulumi' | 'terraform')}
            >
              <MenuItem value="pulumi">Pulumi</MenuItem>
              <MenuItem value="terraform">Terraform</MenuItem>
            </Select>
          </FormControl>
          <FormControl>
            <InputLabel>Execution mode</InputLabel>
            <Select
              value={gitMode}
              onChange={event => setGitMode(event.target.value as 'plan' | 'apply')}
            >
              <MenuItem value="plan">Plan only</MenuItem>
              <MenuItem value="apply">Plan + Apply</MenuItem>
            </Select>
          </FormControl>
          <FormControlLabel
            control={
              <Switch
                checked={gitApprovalRequired}
                onChange={event => setGitApprovalRequired(event.target.checked)}
                color="primary"
              />
            }
            label="Require approval before apply"
          />
        </Box>

        <Typography variant="h6" style={{ marginTop: 24 }}>
          Declarative spec
        </Typography>
        <TextField
          multiline
          fullWidth
          minRows={12}
          value={yamlSpec}
          onChange={event => setYamlSpec(event.target.value)}
          className={classes.yamlEditor}
          variant="outlined"
        />
        {yamlError && (
          <Typography color="error" variant="body2">
            {yamlError}
          </Typography>
        )}
        <Box mt={2} display="flex" style={{ gap: 8 }}>
          <Button variant="contained" color="primary" onClick={onValidateYaml} startIcon={<DescriptionIcon />}>
            Validate
          </Button>
          <Button variant="outlined" onClick={onRunPlan} startIcon={<CodeIcon />}>
            {gitMode === 'plan' ? 'Generate plan' : 'Plan & apply'}
          </Button>
        </Box>
        <Box mt={2}>
          <Typography variant="subtitle1">Run metadata</Typography>
          <Typography variant="body2" color="textSecondary">
            Approval required: {gitApprovalRequired ? 'Yes · Platform Admin' : 'No'}. Results
            will link back to your PR with status checks updated in real time.
          </Typography>
        </Box>
      </div>
      <div>
        <InfoCard title="Dry-run output" variant="gridItem">
          <pre className={classes.terminal}>{planOutput || 'Run a validation to see plan output.'}</pre>
        </InfoCard>
      </div>
    </Box>
  );

  const renderImportExisting = () => {
    const assumeRoleSupported = importProvider === 'existing-aws';

    const stepLabel =
      importStep === 0
        ? 'Continue'
        : importStep === 1
          ? importingCluster
            ? 'Importing…'
            : 'Import cluster'
          : 'Done';

    const stepDisabled =
      importingCluster ||
      (importStep === 0 ? !importDetailsValid : importStep === 1 ? !importCredentialsValid : true);

    return (
      <Box mt={2}>
        <Typography variant="h6">Import an existing cluster</Typography>
        <Typography variant="body2" color="textSecondary" paragraph>
          Local clusters run on your development machine (kind, minikube, Docker Desktop). Deploy the Aegis agent to register
          your cluster and start streaming telemetry.
        </Typography>

        {importError && (
          <WarningPanel severity="warning" title="Import failed">
            {importError}
          </WarningPanel>
        )}

        <Stepper alternativeLabel activeStep={importStep}>
          {['Cluster details', 'Connection method', 'Install & status'].map(label => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {importStep === 0 && (
          <Box mt={3}>
            <Typography variant="subtitle1">Cluster details</Typography>
            <Typography variant="body2" color="textSecondary" paragraph>
              Choose a project and provide a stable cluster identifier. The cluster ID will be used for RBAC, audit logs, and agent
              registration.
            </Typography>
            <Box
              display="grid"
              gridTemplateColumns="repeat(auto-fit, minmax(220px, 1fr))"
              style={{ gap: 16 }}
            >
              {projects.length > 0 ? (
                <FormControl variant="outlined" fullWidth error={importValidationEnabled && !importProjectId}>
                  <InputLabel id="import-project-select">Project</InputLabel>
                  <Select
                    labelId="import-project-select"
                    value={selectedProjectId}
                    onChange={event =>
                      setFormState(prev => ({
                        ...prev,
                        project: event.target.value as string,
                      }))
                    }
                    label="Project"
                  >
                    {projects.map(project => (
                      <MenuItem key={project.id} value={project.id}>
                        {project.displayName || project.id}
                      </MenuItem>
                    ))}
                  </Select>
                  <FormHelperText>Owning project for RBAC and guardrails.</FormHelperText>
                </FormControl>
              ) : (
                <TextField
                  label="Project ID"
                  value={selectedProjectId}
                  onChange={event =>
                    setFormState(prev => ({ ...prev, project: event.target.value }))
                  }
                  error={importValidationEnabled && !importProjectId}
                  helperText={loadingProjects ? 'Loading projects…' : 'Enter project slug.'}
                />
              )}
              <TextField
                label="Cluster ID"
                value={importClusterId}
                onChange={event => setImportClusterId(event.target.value)}
                onBlur={() => {
                  if (importClusterIdTrimmed && !importClusterIdError) {
                    setImportClusterId(importClusterIdTrimmed);
                  } else if (importClusterIdTrimmed) {
                    setImportClusterId(importClusterIdSuggestion);
                  }
                }}
                error={Boolean(importClusterIdError)}
                helperText={importClusterIdError ?? 'Unique identifier (e.g. dev-local).'}
              />
              <TextField
                label="Cluster name"
                value={importClusterName}
                onChange={event => setImportClusterName(event.target.value)}
                error={importValidationEnabled && !importClusterNameTrimmed}
                helperText="Friendly display name."
              />
              <FormControl variant="outlined" fullWidth>
                <InputLabel id="import-provider-select">Provider</InputLabel>
                <Select
                  labelId="import-provider-select"
                  value={importProvider}
                  onChange={event =>
                    setImportProvider(event.target.value as ImportClusterProvider)
                  }
                  label="Provider"
                >
                  {(
                    [
                      'local',
                      'baremetal',
                      'existing-aws',
                      'existing-gcp',
                      'existing-azure',
                      'airgapped',
                    ] as ImportClusterProvider[]
                  ).map(value => (
                    <MenuItem key={value} value={value}>
                      {value}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Region"
                value={importRegion}
                onChange={event => setImportRegion(event.target.value)}
                error={importValidationEnabled && !importRegionTrimmed}
                helperText="Use local for kind/minikube."
              />
              <TextField
                label="Labels (optional)"
                value={importLabels}
                onChange={event => setImportLabels(event.target.value)}
                error={Boolean(importLabelsParsed.error)}
                helperText={importLabelsParsed.error ?? 'One per line: key=value'}
                multiline
                minRows={3}
              />
            </Box>
          </Box>
        )}

        {importStep === 1 && (
          <Box mt={3}>
            <Typography variant="subtitle1">Connection method</Typography>
            <Typography variant="body2" color="textSecondary" paragraph>
              Agent Only is recommended for air-gapped environments — no credentials leave your network.
            </Typography>

            <RadioGroup
              row
              value={importMethod}
              onChange={event =>
                setImportMethod(event.target.value as ImportClusterMethod)
              }
            >
              <FormControlLabel
                value="agent_only"
                control={<Radio color="primary" />}
                label={
                  <div className={classes.radioOption}>
                    <DoneIcon /> <span>Agent only</span>
                  </div>
                }
              />
              <FormControlLabel
                value="assume_role"
                disabled={!assumeRoleSupported}
                control={<Radio color="primary" />}
                label={
                  <div className={classes.radioOption}>
                    <CodeIcon /> <span>AssumeRole ARN</span>
                  </div>
                }
              />
              <FormControlLabel
                value="kubeconfig"
                control={<Radio color="primary" />}
                label={
                  <div className={classes.radioOption}>
                    <CloudDownloadIcon /> <span>Kubeconfig upload</span>
                  </div>
                }
              />
            </RadioGroup>

            {!assumeRoleSupported && (
              <FormHelperText>
                AssumeRole imports are only supported for provider=existing-aws.
              </FormHelperText>
            )}

            {importMethod === 'assume_role' && (
              <Box mt={2}>
                <TextField
                  label="AssumeRole ARN"
                  fullWidth
                  value={importAssumeRoleArn}
                  onChange={event => setImportAssumeRoleArn(event.target.value)}
                  error={importValidationEnabled && !importAssumeRoleArnTrimmed}
                  helperText="Required for existing-aws clusters."
                />
              </Box>
            )}

            {importMethod === 'kubeconfig' && (
              <Box mt={2} display="flex" alignItems="center" style={{ gap: 12 }}>
                <Button
                  variant="outlined"
                  component="label"
                  startIcon={<CloudDownloadIcon />}
                >
                  Upload kubeconfig
                  <input
                    type="file"
                    hidden
                    accept=".yaml,.yml,.kubeconfig,.conf"
                    onChange={event => {
                      const file = event.target.files?.[0] ?? null;
                      setImportKubeconfigFile(file);
                    }}
                  />
                </Button>
                <Typography variant="body2" color="textSecondary">
                  {importKubeconfigFile ? importKubeconfigFile.name : 'No file selected'}
                </Typography>
                {importValidationEnabled && !importKubeconfigFile ? (
                  <Typography variant="body2" color="error">
                    Kubeconfig file required.
                  </Typography>
                ) : null}
              </Box>
            )}
          </Box>
        )}

        {importStep === 2 && (
          <Box mt={3}>
            <Typography variant="subtitle1">Install & status</Typography>
            <Typography variant="body2" color="textSecondary" paragraph>
              Deploy the agent using the generated values and install command. The agent will attempt to connect within 60 seconds of
              deployment.
            </Typography>

            <Paper className={classes.helperCard} variant="outlined">
              <Typography variant="subtitle2">Install command</Typography>
              <Typography component="pre" className={classes.terminal}>
                {attachCommand}
              </Typography>
            </Paper>

            <Paper className={classes.helperCard} variant="outlined" style={{ marginTop: 16 }}>
              <Typography variant="subtitle2">Helm values (values.yaml)</Typography>
              <Typography component="pre" className={classes.terminal}>
                {renderHelmValuesYaml(importResult)}
              </Typography>
            </Paper>

            <Paper className={classes.helperCard} variant="outlined" style={{ marginTop: 16 }}>
              <Typography variant="subtitle2">Agent status</Typography>
              <Box mt={1} display="flex" alignItems="center" style={{ gap: 12 }}>
                {agentConnectionStatus === 'waiting' ? (
                  <CircularProgress size={18} />
                ) : agentConnectionStatus === 'connected' ? (
                  <DoneIcon color="primary" />
                ) : agentConnectionStatus === 'timed_out' || agentConnectionStatus === 'failed' ? (
                  <ErrorOutlineIcon color="secondary" />
                ) : null}
                <Typography variant="body2">
                  {agentConnectionStatus === 'waiting'
                    ? importResult?.status === 'installing'
                      ? 'Installing spoke agent on remote cluster...'
                      : 'Waiting for agent connection...'
                    : agentConnectionStatus === 'connected'
                      ? 'Agent connected. Redirecting to cluster details...'
                      : agentConnectionStatus === 'timed_out'
                        ? 'Still waiting for first agent heartbeat.'
                      : agentConnectionStatus === 'failed'
                        ? 'Connection failed.'
                        : 'Status check pending.'}
                </Typography>
              </Box>
              {agentConnectionError ? (
                <Typography variant="body2" color="textSecondary" style={{ marginTop: 8 }}>
                  {agentConnectionError}
                </Typography>
              ) : null}
              <Box mt={2} display="flex" style={{ gap: 8, flexWrap: 'wrap' }}>
                {agentConnectionStatus === 'timed_out' || agentConnectionStatus === 'failed' ? (
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={() => setAgentConnectionAttempt(value => value + 1)}
                  >
                    Retry status check
                  </Button>
                ) : null}
                {importResult ? (
                  <Button
                    variant="outlined"
                    onClick={() =>
                      navigate(`/aegis/clusters/${encodeURIComponent(importResult.clusterId)}`)
                    }
                  >
                    Open cluster details
                  </Button>
                ) : null}
                <Button variant="outlined" onClick={resetImportFlow}>
                  Start new import
                </Button>
              </Box>
            </Paper>
          </Box>
        )}

        <Box mt={3} display="flex" justifyContent="space-between">
          <Button
            disabled={importStep === 0 || importingCluster || importStep === 2}
            onClick={() => setImportStep(step => Math.max(0, step - 1))}
          >
            Back
          </Button>
          {importStep < 2 ? (
            <Button
              color="primary"
              variant="contained"
              disabled={stepDisabled}
              onClick={handleImportContinue}
            >
              {stepLabel}
            </Button>
          ) : (
            <span />
          )}
        </Box>
      </Box>
    );
  };

  return (
    <Page themeId="tool">
      <Content className={classes.layout}>
        <ContentHeader title="Create clusters">
          <Chip label="Profiles" color="primary" />
          <Chip label="IaC aware" variant="outlined" />
        </ContentHeader>
        <div className={classes.tabWrapper}>
          <Tabs
            value={tab}
            onChange={(_, newValue) => setTab(newValue)}
            indicatorColor="primary"
            textColor="primary"
          >
            <Tab label="From profile" />
            <Tab label="Declarative (Git)" />
            <Tab label="Import existing" />
          </Tabs>
          <Divider />
          <Box mt={3}>
            {tab === 0 && renderFromProfile()}
            {tab === 1 && renderDeclarative()}
            {tab === 2 && renderImportExisting()}
          </Box>
        </div>
      </Content>
    </Page>
  );
};

export default AegisClusterCreatePage;
