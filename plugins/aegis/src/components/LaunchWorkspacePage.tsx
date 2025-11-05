import {
  ChangeEvent,
  ComponentType,
  FC,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
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
  useRouteRef,
} from '@backstage/core-plugin-api';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Collapse,
  Divider,
  FormControl,
  FormControlLabel,
  FormHelperText,
  Grid,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Step,
  StepLabel,
  Stepper,
  Switch,
  TextField,
  Typography,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { alpha } from '@material-ui/core/styles/colorManipulator';
import { StepIconProps } from '@material-ui/core/StepIcon';
import CheckRoundedIcon from '@material-ui/icons/CheckRounded';
import CodeIcon from '@material-ui/icons/Code';
import DescriptionIcon from '@material-ui/icons/Description';
import DeveloperModeIcon from '@material-ui/icons/DeveloperMode';
import StorageIcon from '@material-ui/icons/Storage';
import MemoryIcon from '@material-ui/icons/Memory';
import TimelineIcon from '@material-ui/icons/Timeline';
import {
  AuthenticationError,
  AuthorizationError,
  CreateWorkspaceRequest,
  ProjectSummary,
  ClusterSummary,
  FlavorSummary,
  QueueVisibility,
  createWorkspace,
  listProjects,
  listClusters,
  listFlavors,
} from '../api/aegisClient';
import { keycloakAuthApiRef } from '../api/refs';
import { parseEnvInput, parsePortsInput } from './workspaceFormUtils';
import {
  createClusterRouteRef,
  projectManagementRouteRef,
  workloadsRouteRef,
} from '../routes';

import type { Theme } from '@material-ui/core/styles';

type WorkspaceTypeId = 'vscode' | 'jupyter' | 'cli';

type WorkspaceTypeOption = {
  id: WorkspaceTypeId;
  title: string;
  description: string;
};

type TemplateOption = {
  id: string;
  title: string;
  description: string;
  workspaceTypes: WorkspaceTypeId[];
  defaults: {
    flavor?: string;
    image?: string;
    queue?: string;
    ports?: number[];
    env?: Record<string, string>;
  };
  autoShowAdvanced?: boolean;
};

type ProjectOption = {
  id: string;
  name: string;
  description?: string;
  defaultQueueId?: string;
  queues: QueueOption[];
};

type QueueOption = {
  id: string;
  name: string;
  description?: string;
  visibility?: QueueVisibility;
  clusterId?: string;
  clusterName?: string;
  clusterStatus?: string;
  supportedFlavors?: string[];
  defaultFlavorId?: string;
};

type FlavorOption = {
  id: string;
  title: string;
  description?: string;
  flavor: string;
  resources?: string;
  category?: string;
};

const queueVisibilityCopy: Record<
  QueueVisibility,
  { label: string; tone: 'default' | 'primary' | 'secondary' }
> = {
  restricted: { label: 'Restricted', tone: 'secondary' },
  internal: { label: 'Internal', tone: 'primary' },
  public: { label: 'Public', tone: 'default' },
};

const workspaceTypeCatalog: WorkspaceTypeOption[] = [
  {
    id: 'vscode',
    title: 'VS Code',
    description: 'Full-featured IDE with terminal and debugging support.',
  },
  {
    id: 'jupyter',
    title: 'JupyterLab',
    description: 'Notebook-centric environment for data exploration.',
  },
  {
    id: 'cli',
    title: 'CLI Workspace',
    description: 'Lightweight shell session for quick administration tasks.',
  },
];

const templateCatalog: TemplateOption[] = [
  {
    id: 'vscode-python',
    title: 'Python Starter',
    description: 'VS Code image tuned for Python, linting, and testing.',
    workspaceTypes: ['vscode'],
    defaults: {
      flavor: 'cpu-medium',
      image: 'carlosmsanchez/aegis-workspace-vscode:latest',
      ports: [22, 11111],
    },
  },
  {
    id: 'vscode-data',
    title: 'Data Engineering',
    description: 'VS Code with dbt, SQL utilities, and data connectors.',
    workspaceTypes: ['vscode'],
    defaults: {
      flavor: 'cpu-large',
      image: 'ghcr.io/aegis/workspace-vscode-data:latest',
      ports: [22, 11111],
    },
  },
  {
    id: 'jupyter-pytorch',
    title: 'PyTorch GPU',
    description: 'JupyterLab with CUDA, PyTorch, and ML tooling pre-installed.',
    workspaceTypes: ['jupyter'],
    defaults: {
      flavor: 'gpu-standard',
      image: 'ghcr.io/aegis/workspace-jupyter-pytorch:latest',
      queue: 'gpu',
      ports: [22, 8888],
      env: {
        NOTEBOOK_TOKEN: 'aegis',
      },
    },
  },
  {
    id: 'jupyter-rapids',
    title: 'RAPIDS Accelerator',
    description: 'GPU-accelerated RAPIDS stack for large-scale analytics.',
    workspaceTypes: ['jupyter'],
    defaults: {
      flavor: 'gpu-large',
      image: 'ghcr.io/aegis/workspace-jupyter-rapids:latest',
      queue: 'gpu',
      ports: [22, 8888],
    },
  },
  {
    id: 'cli-ops',
    title: 'Operations Shell',
    description: 'Lean container with kubectl, helm, and cloud CLIs.',
    workspaceTypes: ['cli'],
    defaults: {
      flavor: 'cpu-small',
      image: 'ghcr.io/aegis/workspace-cli:latest',
      ports: [22],
    },
  },
  {
    id: 'custom',
    title: 'Custom Image',
    description: 'Bring your own container image and connection settings.',
    workspaceTypes: ['vscode', 'jupyter', 'cli'],
    defaults: {
      ports: [22],
    },
    autoShowAdvanced: true,
  },
];

const steps = ['Workspace basics', 'Resources & options', 'Review & launch'];

const workspaceTypeIcons: Record<WorkspaceTypeId, ComponentType<any>> = {
  vscode: CodeIcon,
  jupyter: DescriptionIcon,
  cli: DeveloperModeIcon,
};

const useStyles = makeStyles((theme: Theme) => {
  const isDark = theme.palette.type === 'dark';
  const borderColor = 'var(--aegis-card-border)';
  const surface = 'var(--aegis-card-surface)';
  const accent = theme.palette.primary.main;
  const selectedShadow = isDark
    ? '0 16px 48px rgba(99, 102, 241, 0.28)'
    : '0 24px 60px rgba(79, 70, 229, 0.18)';

  return {
    content: {
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(4),
    },
    wizardShell: {
      backgroundColor: surface,
      borderRadius: theme.shape.borderRadius,
      border: `1px solid ${borderColor}`,
      boxShadow: 'var(--aegis-card-shadow)',
      padding: theme.spacing(4),
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(3),
    },
    hero: {
      color: theme.palette.text.secondary,
      maxWidth: 620,
      marginTop: theme.spacing(1),
    },
    stepper: {
      background: 'transparent',
      padding: theme.spacing(0, 1),
    },
    stepLabel: {
      color: theme.palette.text.secondary,
      textTransform: 'uppercase',
      fontSize: '0.75rem',
      letterSpacing: '0.08em',
    },
    selectionGrid: {
      marginTop: theme.spacing(1),
    },
    selectionCard: {
      height: '100%',
      borderRadius: theme.shape.borderRadius,
      border: `1px solid ${borderColor}`,
      backgroundColor: surface,
      transition:
        'transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease, background-color 160ms ease',
    },
    selectionCardAction: {
      height: '100%',
      display: 'flex',
      alignItems: 'stretch',
    },
    selectionCardContent: {
      padding: theme.spacing(3),
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1.5),
      alignItems: 'flex-start',
    },
    selectionCardSelected: {
      borderColor: accent,
      backgroundColor: alpha(accent, isDark ? 0.18 : 0.12),
      boxShadow: selectedShadow,
      transform: 'translateY(-2px)',
    },
    selectionCardIcon: {
      width: 38,
      height: 38,
      color: accent,
    },
    selectionMeta: {
      color: theme.palette.text.secondary,
      fontSize: '0.9rem',
    },
    chipRow: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: theme.spacing(1),
    },
    chip: {
      backgroundColor: alpha(accent, isDark ? 0.16 : 0.12),
      color: accent,
      fontWeight: 600,
      letterSpacing: '0.03em',
      textTransform: 'uppercase',
    },
    formSection: {
      backgroundColor: surface,
      borderRadius: theme.shape.borderRadius,
      border: `1px solid ${borderColor}`,
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(2),
      padding: theme.spacing(3),
    },
    queueSummaryCard: {
      borderRadius: theme.shape.borderRadius,
      border: `1px solid ${borderColor}`,
      backgroundColor: isDark ? alpha('#0F172A', 0.65) : '#F7F8FE',
      padding: theme.spacing(2.5),
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1.5),
    },
    queueSummaryHeader: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing(1.5),
    },
    queueSummaryMeta: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
      gap: theme.spacing(1.25),
    },
    queueSummaryMetaLabel: {
      color: theme.palette.text.secondary,
      fontSize: theme.typography.pxToRem(12),
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      fontWeight: 600,
    },
    queueSummaryMetaValue: {
      fontWeight: 600,
    },
    toggleControl: {
      marginTop: theme.spacing(1),
      display: 'flex',
      alignItems: 'center',
    },
    advancedSurface: {
      backgroundColor: isDark ? alpha('#0F172A', 0.65) : '#F8F8F6',
      borderRadius: theme.shape.borderRadius,
      border: `1px solid ${borderColor}`,
      padding: theme.spacing(3),
      marginTop: theme.spacing(2),
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(2),
    },
    reviewPaper: {
      backgroundColor: surface,
      borderRadius: theme.shape.borderRadius,
      border: `1px solid ${borderColor}`,
      padding: theme.spacing(3),
    },
    reviewRow: {
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.5),
    },
    reviewLabel: {
      color: theme.palette.text.secondary,
      fontSize: '0.8rem',
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
    },
    reviewValue: {
      fontWeight: 600,
      wordBreak: 'break-word',
    },
    actionRow: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: theme.spacing(2),
      marginTop: theme.spacing(4),
    },
    emptyState: {
      backgroundColor: alpha(theme.palette.info.main, isDark ? 0.12 : 0.08),
      borderRadius: theme.shape.borderRadius,
      border: `1px dashed ${alpha(theme.palette.info.main, 0.6)}`,
      padding: theme.spacing(3),
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1.5),
    },
    emptyStateActions: {
      display: 'flex',
      gap: theme.spacing(1.5),
      flexWrap: 'wrap',
    },
    stepIcon: {
      width: 34,
      height: 34,
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: alpha(theme.palette.text.secondary, 0.16),
      color: theme.palette.text.secondary,
      fontWeight: 600,
      transition: 'all 150ms ease',
    },
    stepIconActive: {
      background: theme.palette.primary.main,
      color: theme.palette.type === 'dark' ? '#050505' : '#F9FAFB',
      boxShadow: `0 0 0 6px ${alpha(theme.palette.primary.main, 0.22)}`,
    },
    stepIconCompleted: {
      backgroundColor: alpha(theme.palette.primary.main, 0.18),
      color: theme.palette.primary.main,
    },
  };
});

const StepIconComponent = (props: StepIconProps) => {
  const { active, completed, icon } = props;
  const classes = useStyles();

  return (
    <div
      className={`${classes.stepIcon} ${active ? classes.stepIconActive : ''} ${
        completed ? classes.stepIconCompleted : ''
      }`}
    >
      {completed ? <CheckRoundedIcon fontSize="small" /> : icon}
    </div>
  );
};

const randomId = () => {
  if (typeof crypto?.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `workspace-${Math.random().toString(16).slice(2, 10)}`;
};

const templateEnvToText = (env?: Record<string, string>): string => {
  if (!env) {
    return '';
  }
  return Object.entries(env)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
};

const portsToText = (ports?: number[]): string => {
  if (!ports || ports.length === 0) {
    return '';
  }
  return ports.join(', ');
};

const getFlavorIcon = (flavor: FlavorOption) =>
  (flavor.category?.toLowerCase().startsWith('gpu') ? MemoryIcon : StorageIcon);

const normalizeVisibility = (visibility?: QueueVisibility): QueueVisibility => {
  if (visibility === 'restricted' || visibility === 'public') {
    return visibility;
  }
  return 'internal';
};

const supportedFlavorsForQueue = (
  queue: QueueOption | null,
  options: FlavorOption[],
): FlavorOption[] => {
  if (!queue) {
    return options;
  }
  const supported = queue.supportedFlavors?.filter(Boolean) ?? [];
  if (supported.length === 0) {
    return options;
  }
  const supportedSet = new Set(supported);
  return options.filter(option => supportedSet.has(option.flavor));
};

export const LaunchWorkspacePage: FC = () => {
  const classes = useStyles();
  const fetchApi = useApi(fetchApiRef);
  const discoveryApi = useApi(discoveryApiRef);
  const identityApi = useApi(identityApiRef);
  const authApi = useApi(keycloakAuthApiRef);
  const alertApi = useApi(alertApiRef);
  const workloadsLink = useRouteRef(workloadsRouteRef);
  const projectManagementLink = useRouteRef(projectManagementRouteRef, {
    optional: true,
  });
  const createClusterLink = useRouteRef(createClusterRouteRef, {
    optional: true,
  });
  const navigate = useNavigate();

  const [activeStep, setActiveStep] = useState(0);
  const [workspaceTypeId, setWorkspaceTypeId] =
    useState<WorkspaceTypeId | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [forceAdvancedOpen, setForceAdvancedOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [clusters, setClusters] = useState<ClusterSummary[]>([]);
  const [flavors, setFlavors] = useState<FlavorSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [form, setForm] = useState({
    workloadId: randomId(),
    projectId: '',
    queue: '',
    flavor: '',
    image: '',
    ports: '22',
    env: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProvisioning = useCallback(async () => {
    try {
      setLoadError(null);
      setLoading(true);
      const [projectItems, clusterItems, flavorItems] = await Promise.all([
        listProjects(fetchApi, discoveryApi, identityApi, authApi),
        listClusters(fetchApi, discoveryApi, identityApi, authApi),
        listFlavors(fetchApi, discoveryApi, identityApi, authApi),
      ]);
      setProjects(projectItems);
      setClusters(clusterItems);
      setFlavors(flavorItems);
    } catch (e: unknown) {
      let message = 'Failed to load workspace provisioning data.';
      if (e instanceof AuthenticationError || e instanceof AuthorizationError) {
        message = e.message;
      } else if (e instanceof Error) {
        message = e.message || message;
      }
      setLoadError(message);
    } finally {
      setLoading(false);
    }
  }, [fetchApi, discoveryApi, identityApi, authApi]);

  useEffect(() => {
    fetchProvisioning();
  }, [fetchProvisioning]);

  useEffect(() => {
    let mounted = true;
    identityApi
      .getBackstageIdentity()
      .then(identity => {
        if (!mounted) {
          return;
        }
        const ownership = identity?.ownershipEntityRefs ?? [];
        const normalized = ownership.map(ref => ref.toLowerCase());
        const adminGroups = [
          'group:default/aegis-admins',
          'group:default/platform-admins',
          'group:default/admins',
        ];
        setIsAdmin(normalized.some(ref => adminGroups.includes(ref)));
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, [identityApi]);

  const projectOptions = useMemo<ProjectOption[]>(() => {
    const clusterMap = new Map(clusters.map(cluster => [cluster.id, cluster]));
    return (projects ?? []).map(project => ({
      id: project.id,
      name: project.name || project.id,
      description: project.description,
      defaultQueueId: project.defaultQueueId,
      queues:
        (project.queues ?? []).map(queue => {
          const cluster = queue.clusterId
            ? clusterMap.get(queue.clusterId)
            : undefined;
          return {
            id: queue.id,
            name: queue.name || queue.id,
            description: queue.description,
            visibility: normalizeVisibility(queue.visibility),
            clusterId: queue.clusterId,
            clusterName:
              cluster?.displayName || cluster?.id || queue.clusterId || undefined,
            clusterStatus: cluster?.status,
            supportedFlavors: queue.supportedFlavors,
            defaultFlavorId: queue.defaultFlavorId,
          };
        }) ?? [],
    }));
  }, [projects, clusters]);

  const flavorOptions = useMemo<FlavorOption[]>(
    () =>
      (flavors ?? []).map(flavor => ({
        id: flavor.id,
        title: flavor.displayName || flavor.id,
        description: flavor.description,
        flavor: flavor.id,
        resources: flavor.resources,
        category: flavor.category,
      })),
    [flavors],
  );

  const selectedProject = useMemo<ProjectOption | null>(
    () => projectOptions.find(project => project.id === form.projectId) ?? null,
    [projectOptions, form.projectId],
  );

  const queueOptions = useMemo<QueueOption[]>(
    () => selectedProject?.queues ?? [],
    [selectedProject],
  );

  const selectedQueue = useMemo<QueueOption | null>(
    () => queueOptions.find(queue => queue.id === form.queue) ?? null,
    [queueOptions, form.queue],
  );

  const clusterMap = useMemo(
    () => new Map(clusters.map(cluster => [cluster.id, cluster])),
    [clusters],
  );

  const selectedCluster = useMemo<ClusterSummary | null>(() => {
    if (!selectedQueue?.clusterId) {
      return null;
    }
    return clusterMap.get(selectedQueue.clusterId) ?? null;
  }, [clusterMap, selectedQueue]);

  const templatesForType = useMemo(() => {
    if (!workspaceTypeId) {
      return templateCatalog;
    }
    return templateCatalog.filter(template =>
      template.workspaceTypes.includes(workspaceTypeId),
    );
  }, [workspaceTypeId]);

  const selectedTemplate = useMemo(
    () => templateCatalog.find(template => template.id === templateId) ?? null,
    [templateId],
  );

  const selectedWorkspaceType = useMemo(
    () =>
      workspaceTypeCatalog.find(option => option.id === workspaceTypeId) ??
      null,
    [workspaceTypeId],
  );

  const availableFlavorOptions = useMemo(
    () => supportedFlavorsForQueue(selectedQueue, flavorOptions),
    [selectedQueue, flavorOptions],
  );

  useEffect(() => {
    if (projectOptions.length === 0) {
      return;
    }

    setForm(prev => {
      const project =
        projectOptions.find(option => option.id === prev.projectId) ||
        projectOptions[0];
      const queueCandidates = project.queues ?? [];
      const fallbackQueueId =
        (project.defaultQueueId &&
        queueCandidates.some(queue => queue.id === project.defaultQueueId)
          ? project.defaultQueueId
          : queueCandidates[0]?.id) ?? '';
      const queue =
        queueCandidates.find(item => item.id === prev.queue) ||
        queueCandidates.find(item => item.id === fallbackQueueId);
      const flavorsForQueue = supportedFlavorsForQueue(
        queue ?? null,
        flavorOptions,
      );
      const fallbackFlavor =
        (queue?.defaultFlavorId &&
          flavorsForQueue.some(option => option.flavor === queue.defaultFlavorId)
          ? queue.defaultFlavorId
          : flavorsForQueue[0]?.flavor) ?? '';

      const nextProjectId = project.id;
      const nextQueueId = queue?.id ?? fallbackQueueId ?? '';
      const nextFlavorId = flavorsForQueue.some(
        option => option.flavor === prev.flavor,
      )
        ? prev.flavor
        : fallbackFlavor;

      if (
        nextProjectId === prev.projectId &&
        nextQueueId === prev.queue &&
        nextFlavorId === prev.flavor
      ) {
        return prev;
      }

      return {
        ...prev,
        projectId: nextProjectId,
        queue: nextQueueId,
        flavor: nextFlavorId,
      };
    });
  }, [projectOptions, flavorOptions]);

  const handleFormFieldChange =
    (field: keyof typeof form) => (event: ChangeEvent<HTMLInputElement>) => {
      setForm(prev => ({ ...prev, [field]: event.target.value }));
    };

  const applyTemplate = (template: TemplateOption) => {
    setTemplateId(template.id);
    setForceAdvancedOpen(Boolean(template.autoShowAdvanced));
    setAdvancedOpen(prev => prev || Boolean(template.autoShowAdvanced));

    setForm(prev => ({
      ...prev,
      flavor:
        template.defaults.flavor !== undefined
          ? template.defaults.flavor
          : prev.flavor,
      image:
        template.defaults.image !== undefined
          ? template.defaults.image
          : prev.image,
      queue:
        template.defaults.queue !== undefined
          ? template.defaults.queue
          : prev.queue,
      ports:
        template.defaults.ports !== undefined
          ? portsToText(template.defaults.ports)
          : prev.ports,
      env:
        template.defaults.env !== undefined
          ? templateEnvToText(template.defaults.env)
          : prev.env,
    }));
  };

  const handleWorkspaceTypeSelect = (option: WorkspaceTypeOption) => {
    const nextTypeId = option.id;
    setWorkspaceTypeId(nextTypeId);
    const matchingTemplates = templateCatalog.filter(template =>
      template.workspaceTypes.includes(nextTypeId),
    );
    if (matchingTemplates.length > 0) {
      applyTemplate(matchingTemplates[0]);
    } else {
      setTemplateId(null);
    }
  };

  const handleTemplateSelect = (template: TemplateOption) => {
    applyTemplate(template);
  };

  const handleFlavorSelect = (flavor: FlavorOption) => {
    setForm(prev => ({ ...prev, flavor: flavor.flavor }));
  };

  const handleProjectSelect = (event: ChangeEvent<{ value: unknown }>) => {
    const projectId = (event.target.value as string) ?? '';
    setForm(prev => ({ ...prev, projectId }));
  };

  const handleQueueSelect = (event: ChangeEvent<{ value: unknown }>) => {
    const queueId = (event.target.value as string) ?? '';
    setForm(prev => ({ ...prev, queue: queueId }));
  };

  const handleAdvancedToggle = (event: ChangeEvent<HTMLInputElement>) => {
    if (forceAdvancedOpen) {
      return;
    }
    setAdvancedOpen(event.target.checked);
  };

  const goNextStep = () => {
    setActiveStep(prev => Math.min(prev + 1, steps.length - 1));
  };

  const goPreviousStep = () => {
    setActiveStep(prev => Math.max(prev - 1, 0));
  };

  const canProceedFromBasics =
    Boolean(workspaceTypeId) &&
    Boolean(templateId) &&
    Boolean(form.projectId.trim()) &&
    Boolean(form.queue.trim()) &&
    Boolean(form.workloadId.trim());

  const canProceedFromResources =
    Boolean(form.flavor.trim()) &&
    Boolean(form.image.trim()) &&
    availableFlavorOptions.length > 0;

  const isSubmitDisabled =
    submitting ||
    !form.projectId.trim() ||
    !form.queue.trim() ||
    !form.flavor.trim() ||
    !form.image.trim() ||
    !form.workloadId.trim();

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (isSubmitDisabled) {
      return;
    }

    const ports = parsePortsInput(form.ports);
    const env = parseEnvInput(form.env);

    const projectId = form.projectId.trim();
    const workspaceId = form.workloadId.trim();
    const queue = form.queue.trim();

    const payload: CreateWorkspaceRequest = {
      projectId,
      workspaceId,
      ...(queue ? { queue } : {}),
      workspace: {
        flavor: form.flavor.trim() || undefined,
        image: form.image.trim() || undefined,
        interactive: true,
        ports: ports.length > 0 ? ports : undefined,
        env: Object.keys(env).length > 0 ? env : undefined,
      },
    };

    try {
      setSubmitting(true);
      setError(null);
      const response = await createWorkspace(
        fetchApi,
        discoveryApi,
        identityApi,
        authApi,
        payload,
      );
      const createdId = response?.workload?.id ?? workspaceId;
      alertApi.post({
        message: `Submitted interactive workspace ${createdId}`,
        severity: 'success',
      });
      if (workloadsLink) {
        navigate(workloadsLink());
      }
    } catch (e: unknown) {
      let msg = 'Failed to submit workspace.';
      let severity: 'error' | 'warning' = 'error';
      if (e instanceof AuthenticationError || e instanceof AuthorizationError) {
        msg = e.message;
        severity = 'warning';
      } else if (e instanceof Error) {
        msg = e.message || msg;
      }
      setError(msg);
      alertApi.post({
        message: msg,
        severity,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const renderWorkspaceTypeCards = () => (
    <Grid container spacing={2} className={classes.selectionGrid}>
      {workspaceTypeCatalog.map(option => {
        const selected = option.id === workspaceTypeId;
        const TypeIcon = workspaceTypeIcons[option.id];
        return (
          <Grid item xs={12} sm={6} key={option.id}>
            <Card
              elevation={0}
              className={`${classes.selectionCard} ${
                selected ? classes.selectionCardSelected : ''
              }`}
            >
              <CardActionArea
                className={classes.selectionCardAction}
                onClick={() => handleWorkspaceTypeSelect(option)}
              >
                <CardContent className={classes.selectionCardContent}>
                  <TypeIcon className={classes.selectionCardIcon} />
                  <Typography variant="h6">{option.title}</Typography>
                  <Typography className={classes.selectionMeta}>
                    {option.description}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        );
      })}
    </Grid>
  );

  const renderTemplateCards = () => (
    <Grid container spacing={2} className={classes.selectionGrid}>
      {templatesForType.length === 0 ? (
        <Grid item xs={12}>
          <Typography className={classes.selectionMeta}>
            No templates available for the selected workspace type.
          </Typography>
        </Grid>
      ) : (
        templatesForType.map(template => {
          const selected = template.id === templateId;
          return (
            <Grid item xs={12} md={6} key={template.id}>
              <Card
                elevation={0}
                className={`${classes.selectionCard} ${
                  selected ? classes.selectionCardSelected : ''
                }`}
              >
                <CardActionArea
                  className={classes.selectionCardAction}
                  onClick={() => handleTemplateSelect(template)}
                >
                  <CardContent className={classes.selectionCardContent}>
                    <Typography variant="h6">{template.title}</Typography>
                    <Typography className={classes.selectionMeta}>
                      {template.description}
                    </Typography>
                    <div className={classes.chipRow}>
                      {template.workspaceTypes.map(type => (
                        <Chip
                          size="small"
                          key={`${template.id}-${type}`}
                          label={type.toUpperCase()}
                          className={classes.chip}
                        />
                      ))}
                    </div>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          );
        })
      )}
    </Grid>
  );

  const renderFlavorCards = () => (
    <Grid container spacing={2} className={classes.selectionGrid}>
      {availableFlavorOptions.length === 0 ? (
        <Grid item xs={12}>
          <Box className={classes.emptyState}>
            <Typography variant="subtitle1">
              No flavors are available for the selected queue.
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Ask a platform administrator to provision flavors for this queue
              before launching a workspace.
            </Typography>
            {isAdmin && createClusterLink && (
              <div className={classes.emptyStateActions}>
                <Button
                  color="primary"
                  variant="contained"
                  component={RouterLink}
                  to={createClusterLink()}
                >
                  Provision flavors
                </Button>
              </div>
            )}
          </Box>
        </Grid>
      ) : (
        availableFlavorOptions.map(option => {
          const selected = option.flavor === form.flavor;
          const FlavorIcon = getFlavorIcon(option);
          return (
            <Grid item xs={12} sm={6} key={option.id}>
              <Card
                elevation={0}
                className={`${classes.selectionCard} ${
                  selected ? classes.selectionCardSelected : ''
                }`}
              >
                <CardActionArea
                  className={classes.selectionCardAction}
                  onClick={() => handleFlavorSelect(option)}
                >
                  <CardContent className={classes.selectionCardContent}>
                    <FlavorIcon className={classes.selectionCardIcon} />
                    <Typography variant="h6">{option.title}</Typography>
                    {option.resources && (
                      <Typography variant="subtitle2" color="textSecondary">
                        {option.resources}
                      </Typography>
                    )}
                    {option.description && (
                      <Typography className={classes.selectionMeta}>
                        {option.description}
                      </Typography>
                    )}
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          );
        })
      )}
    </Grid>
  );

  const selectedQueueMissingCluster = Boolean(
    selectedQueue && (!selectedQueue.clusterId || !selectedCluster),
  );

  const renderQueueEmptyState = () => (
    <Box className={classes.emptyState}>
      <Typography variant="subtitle1">
        No launchable queues are available for this project.
      </Typography>
      <Typography variant="body2" color="textSecondary">
        Ask a platform administrator to provision a queue backed by a cluster
        before launching workspaces.
      </Typography>
      {isAdmin && createClusterLink && (
        <div className={classes.emptyStateActions}>
          <Button
            color="primary"
            variant="contained"
            component={RouterLink}
            to={createClusterLink()}
          >
            Provision cluster or queue
          </Button>
          {projectManagementLink && (
            <Button
              color="primary"
              component={RouterLink}
              to={projectManagementLink()}
            >
              Manage projects
            </Button>
          )}
        </div>
      )}
    </Box>
  );

  return (
    <Page themeId="tool">
      <Content>
        <ContentHeader title="Launch Interactive Workspace">
          <Typography variant="body1" className={classes.hero}>
            Choose a template, align it with an ÆGIS project and queue, then
            launch to pre-provisioned clusters. Platform administrators curate
            these options so day-to-day builders can focus on shipping models.
          </Typography>
        </ContentHeader>
        {loading && (
          <Box mb={2}>
            <LinearProgress />
          </Box>
        )}
        {loadError && (
          <Box mb={2}>
            <WarningPanel severity="error" title="Provisioning data unavailable">
              {loadError}
            </WarningPanel>
          </Box>
        )}
        {projects.length === 0 && !loading ? (
          <Box className={classes.emptyState}>
            <Typography variant="subtitle1">
              No projects are available yet.
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Projects, queues, and flavors must be provisioned before workspaces
              can launch.
            </Typography>
            {isAdmin && createClusterLink && (
              <div className={classes.emptyStateActions}>
                <Button
                  color="primary"
                  variant="contained"
                  component={RouterLink}
                  to={createClusterLink()}
                >
                  Provision resources
                </Button>
              </div>
            )}
          </Box>
        ) : (
          <form onSubmit={handleSubmit} className={classes.content}>
            <Paper elevation={0} className={classes.wizardShell}>
              <Stepper
                activeStep={activeStep}
                alternativeLabel
                className={classes.stepper}
              >
                {steps.map(step => (
                  <Step key={step}>
                    <StepLabel
                      StepIconComponent={StepIconComponent}
                      classes={{ label: classes.stepLabel }}
                    >
                      {step}
                    </StepLabel>
                  </Step>
                ))}
              </Stepper>

              {activeStep === 0 && (
                <Grid container spacing={3}>
                  <Grid item xs={12} md={5}>
                    <div className={classes.formSection}>
                      <Typography variant="overline" color="textSecondary">
                        Project context
                      </Typography>
                      <FormControl
                        variant="outlined"
                        fullWidth
                        required
                        disabled={projectOptions.length === 0}
                      >
                        <InputLabel id="launch-workspace-project">
                          Project
                        </InputLabel>
                        <Select
                          labelId="launch-workspace-project"
                          label="Project"
                          value={form.projectId}
                          onChange={handleProjectSelect}
                        >
                          {projectOptions.map(project => (
                            <MenuItem key={project.id} value={project.id}>
                              <div>
                                <Typography variant="subtitle1">
                                  {project.name}
                                </Typography>
                                {project.description && (
                                  <Typography
                                    variant="body2"
                                    color="textSecondary"
                                  >
                                    {project.description}
                                  </Typography>
                                )}
                              </div>
                            </MenuItem>
                          ))}
                        </Select>
                        {projectOptions.length === 0 && (
                          <FormHelperText>
                            No projects provisioned yet.
                          </FormHelperText>
                        )}
                      </FormControl>
                      <FormControl
                        variant="outlined"
                        fullWidth
                        required
                        disabled={queueOptions.length === 0}
                      >
                        <InputLabel id="launch-workspace-queue">Queue</InputLabel>
                        <Select
                          labelId="launch-workspace-queue"
                          label="Queue"
                          value={form.queue}
                          onChange={handleQueueSelect}
                        >
                          {queueOptions.map(queue => (
                            <MenuItem key={queue.id} value={queue.id}>
                              <div>
                                <Typography variant="subtitle1">
                                  {queue.name}
                                </Typography>
                                {queue.description && (
                                  <Typography
                                    variant="body2"
                                    color="textSecondary"
                                  >
                                    {queue.description}
                                  </Typography>
                                )}
                                {queue.clusterName && (
                                  <Typography
                                    variant="caption"
                                    color="textSecondary"
                                  >
                                    Cluster: {queue.clusterName}
                                  </Typography>
                                )}
                              </div>
                            </MenuItem>
                          ))}
                        </Select>
                        {queueOptions.length === 0 && (
                          <FormHelperText>
                            No queues available in this project.
                          </FormHelperText>
                        )}
                      </FormControl>
                      <TextField
                        label="Workspace ID"
                        value={form.workloadId}
                        onChange={handleFormFieldChange('workloadId')}
                        variant="outlined"
                        required
                        fullWidth
                        helperText="Used to name the workload in the cluster"
                      />
                    </div>
                    {queueOptions.length === 0 && renderQueueEmptyState()}
                    {selectedQueue && (
                      <div className={classes.queueSummaryCard}>
                        <div className={classes.queueSummaryHeader}>
                          <Typography variant="subtitle1" component="span">
                            {selectedQueue.name}
                          </Typography>
                          <Chip
                            label={
                              queueVisibilityCopy[
                                normalizeVisibility(selectedQueue.visibility)
                              ].label
                            }
                            color={
                              queueVisibilityCopy[
                                normalizeVisibility(selectedQueue.visibility)
                              ].tone
                            }
                            size="small"
                          />
                        </div>
                        {selectedQueue.description && (
                          <Typography variant="body2" color="textSecondary">
                            {selectedQueue.description}
                          </Typography>
                        )}
                        <div className={classes.queueSummaryMeta}>
                          <div>
                            <div className={classes.queueSummaryMetaLabel}>
                              Cluster
                            </div>
                            <div className={classes.queueSummaryMetaValue}>
                              {selectedCluster?.displayName ||
                                selectedQueue.clusterName ||
                                '—'}
                            </div>
                          </div>
                          <div>
                            <div className={classes.queueSummaryMetaLabel}>
                              Provider / Region
                            </div>
                            <div className={classes.queueSummaryMetaValue}>
                              {selectedCluster
                                ? `${selectedCluster.provider ?? '—'} / ${
                                    selectedCluster.region ?? '—'
                                  }`
                                : '—'}
                            </div>
                          </div>
                          <div>
                            <div className={classes.queueSummaryMetaLabel}>
                              Cluster status
                            </div>
                            <div className={classes.queueSummaryMetaValue}>
                              {selectedCluster?.status ?? '—'}
                            </div>
                          </div>
                        </div>
                        {selectedQueueMissingCluster && (
                          <Typography variant="caption" color="textSecondary">
                            No clusters detected for this queue. Contact an
                            administrator before launching.
                          </Typography>
                        )}
                      </div>
                    )}
                  </Grid>
                  <Grid item xs={12} md={7}>
                    <div className={classes.formSection}>
                      <Typography variant="overline" color="textSecondary">
                        Workspace type
                      </Typography>
                      {renderWorkspaceTypeCards()}
                      <Divider />
                      <Typography variant="overline" color="textSecondary">
                        Templates
                      </Typography>
                      {renderTemplateCards()}
                    </div>
                  </Grid>
                </Grid>
              )}

              {activeStep === 1 && (
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <div className={classes.formSection}>
                      <Typography variant="overline" color="textSecondary">
                        Compute flavor
                      </Typography>
                      {renderFlavorCards()}
                    </div>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <div className={classes.formSection}>
                      <Typography variant="overline" color="textSecondary">
                        Image & runtime
                      </Typography>
                      <TextField
                        label="Container image"
                        value={form.image}
                        onChange={handleFormFieldChange('image')}
                        variant="outlined"
                        required
                        fullWidth
                        helperText="Container image reference, e.g. ghcr.io/aegis/workspace"
                      />
                      <FormControlLabel
                        className={classes.toggleControl}
                        control={
                          <Switch
                            color="primary"
                            checked={advancedOpen || forceAdvancedOpen}
                            onChange={handleAdvancedToggle}
                            disabled={forceAdvancedOpen}
                          />
                        }
                        label="Show advanced parameters"
                      />
                      <Collapse in={advancedOpen || forceAdvancedOpen}>
                        <div className={classes.advancedSurface}>
                          <TextField
                            label="Expose ports"
                            value={form.ports}
                            onChange={handleFormFieldChange('ports')}
                            variant="outlined"
                            fullWidth
                            helperText="Comma-separated port list (e.g. 22, 11111)"
                          />
                          <TextField
                            label="Environment variables"
                            value={form.env}
                            onChange={handleFormFieldChange('env')}
                            variant="outlined"
                            fullWidth
                            multiline
                            rows={4}
                            helperText="KEY=VALUE pairs, one per line"
                          />
                        </div>
                      </Collapse>
                    </div>
                  </Grid>
                </Grid>
              )}

              {activeStep === 2 && (
                <Paper elevation={0} className={classes.reviewPaper}>
                  <Typography variant="overline" color="textSecondary">
                    Launch summary
                  </Typography>
                  <Grid container spacing={3} className={classes.selectionGrid}>
                    <Grid item xs={12} md={6}>
                      <div className={classes.reviewRow}>
                        <span className={classes.reviewLabel}>Project</span>
                        <span className={classes.reviewValue}>
                          {selectedProject?.name ?? (form.projectId || '—')}
                        </span>
                      </div>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <div className={classes.reviewRow}>
                        <span className={classes.reviewLabel}>Workspace ID</span>
                        <span className={classes.reviewValue}>
                          {form.workloadId || '—'}
                        </span>
                      </div>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <div className={classes.reviewRow}>
                        <span className={classes.reviewLabel}>Workspace type</span>
                        <span className={classes.reviewValue}>
                          {selectedWorkspaceType?.title ?? '—'}
                        </span>
                      </div>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <div className={classes.reviewRow}>
                        <span className={classes.reviewLabel}>Template</span>
                        <span className={classes.reviewValue}>
                          {selectedTemplate?.title ?? '—'}
                        </span>
                      </div>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <div className={classes.reviewRow}>
                        <span className={classes.reviewLabel}>Queue</span>
                        <span className={classes.reviewValue}>
                          {selectedQueue?.name ?? (form.queue || '—')}
                        </span>
                      </div>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <div className={classes.reviewRow}>
                        <span className={classes.reviewLabel}>Cluster</span>
                        <span className={classes.reviewValue}>
                          {selectedCluster?.displayName ||
                            selectedQueue?.clusterName ||
                            '—'}
                        </span>
                      </div>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <div className={classes.reviewRow}>
                        <span className={classes.reviewLabel}>Flavor</span>
                        <span className={classes.reviewValue}>
                          {
                            availableFlavorOptions.find(
                              option => option.flavor === form.flavor,
                            )?.title ?? form.flavor || '—'
                          }
                        </span>
                      </div>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <div className={classes.reviewRow}>
                        <span className={classes.reviewLabel}>Container image</span>
                        <span className={classes.reviewValue}>
                          {form.image || '—'}
                        </span>
                      </div>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <div className={classes.reviewRow}>
                        <span className={classes.reviewLabel}>Ports</span>
                        <span className={classes.reviewValue}>
                          {form.ports || 'Default'}
                        </span>
                      </div>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <div className={classes.reviewRow}>
                        <span className={classes.reviewLabel}>Environment</span>
                        <span className={classes.reviewValue}>
                          {form.env ? form.env.split('\n').join(', ') : 'Default'}
                        </span>
                      </div>
                    </Grid>
                  </Grid>
                </Paper>
              )}

              {error && (
                <WarningPanel severity="error" title="Launch failed">
                  {error}
                </WarningPanel>
              )}

              <div className={classes.actionRow}>
                <div>
                  {activeStep > 0 && (
                    <Button
                      onClick={goPreviousStep}
                      color="default"
                      variant="text"
                    >
                      Back
                    </Button>
                  )}
                </div>
                <div>
                  {activeStep < steps.length - 1 && (
                    <Button
                      color="primary"
                      variant="contained"
                      onClick={goNextStep}
                      disabled={
                        (activeStep === 0 && !canProceedFromBasics) ||
                        (activeStep === 1 && !canProceedFromResources)
                      }
                    >
                      Continue
                    </Button>
                  )}
                  {activeStep === steps.length - 1 && (
                    <Button
                      type="submit"
                      color="primary"
                      variant="contained"
                      disabled={isSubmitDisabled}
                      startIcon={<TimelineIcon />}
                    >
                      Launch workspace
                    </Button>
                  )}
                </div>
              </div>
            </Paper>
          </form>
        )}
      </Content>
    </Page>
  );
};
