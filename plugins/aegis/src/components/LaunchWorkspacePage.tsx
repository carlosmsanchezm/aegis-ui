import {
  ChangeEvent,
  ComponentType,
  FC,
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Page,
  Content,
  ContentHeader,
  EmptyState,
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
import { useNavigate } from 'react-router-dom';
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
  createWorkspace,
} from '../api/aegisClient';
import { keycloakAuthApiRef } from '../api/refs';
import { parseEnvInput, parsePortsInput } from './workspaceFormUtils';
import {
  projectManagementRouteRef,
  workloadsRouteRef,
  createClusterRouteRef,
} from '../routes';
import {
  ProjectDefinition,
  ProjectVisibility,
  QueueDefinition,
  visibilityCopy,
} from './projects/projectCatalog';
import { useProvisioningCatalog } from '../hooks/useProvisioningCatalog';
import { useIsAegisAdmin } from '../hooks/useIsAegisAdmin';

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

type FlavorOption = {
  id: string;
  title: string;
  description: string;
  flavor: string;
  resources: string;
};

// Workspace types remain static while provisioning data (projects, queues, clusters, flavors)
// is fetched from the ÆGIS control plane.
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

const defaultFlavorCatalog: FlavorOption[] = [
  {
    id: 'cpu-small',
    title: 'Small',
    description: '2 vCPU, 4 GiB RAM — great for quick CLI sessions.',
    flavor: 'cpu-small',
    resources: '2 vCPU • 4 GiB RAM',
  },
  {
    id: 'cpu-medium',
    title: 'Medium',
    description: '4 vCPU, 16 GiB RAM — balanced choice for most notebooks.',
    flavor: 'cpu-medium',
    resources: '4 vCPU • 16 GiB RAM',
  },
  {
    id: 'cpu-large',
    title: 'Large',
    description: '8 vCPU, 32 GiB RAM — heavier IDE workloads and data prep.',
    flavor: 'cpu-large',
    resources: '8 vCPU • 32 GiB RAM',
  },
  {
    id: 'gpu-standard',
    title: 'GPU Standard',
    description: '1× NVIDIA T4, 4 vCPU, 32 GiB RAM — training and inference.',
    flavor: 'gpu-standard',
    resources: '1× T4 • 4 vCPU • 32 GiB RAM',
  },
  {
    id: 'gpu-large',
    title: 'GPU Large',
    description: '1× NVIDIA A10, 8 vCPU, 64 GiB RAM — larger GPU workloads.',
    flavor: 'gpu-large',
    resources: '1× A10 • 8 vCPU • 64 GiB RAM',
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
    ? '0 16px 48px rgba(139, 92, 246, 0.32)'
    : '0 24px 60px rgba(109, 40, 217, 0.25)';

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
      maxWidth: 560,
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
      backgroundColor: alpha(accent, isDark ? 0.16 : 0.1),
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
      backgroundColor: isDark ? alpha('#111827', 0.7) : '#FFFFFF',
      borderRadius: theme.shape.borderRadius,
      border: `1px solid ${borderColor}`,
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(2),
      padding: theme.spacing(3),
    },
    projectOverview: {
      borderRadius: theme.shape.borderRadius,
      border: `1px solid ${borderColor}`,
      backgroundColor: isDark ? alpha('#0F172A', 0.7) : 'var(--aegis-card-surface)',
      padding: theme.spacing(2.5),
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1.5),
    },
    projectHeader: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing(1.5),
    },
    projectMeta: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
      gap: theme.spacing(1.5),
    },
    projectMetaLabel: {
      fontSize: theme.typography.pxToRem(12),
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: theme.palette.text.secondary,
      fontWeight: 600,
    },
    projectMetaValue: {
      fontWeight: 600,
      letterSpacing: '-0.01em',
    },
    projectActions: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: theme.spacing(1.5),
    },
    selectMenuContent: {
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.5),
    },
    queueSummaryCard: {
      borderRadius: theme.shape.borderRadius,
      border: `1px solid ${borderColor}`,
      backgroundColor: isDark ? alpha('#111827', 0.7) : '#F6F6FB',
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
    queueSummaryMetrics: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
      gap: theme.spacing(1.25),
    },
    queueSummaryMetricLabel: {
      fontSize: theme.typography.pxToRem(12),
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      color: theme.palette.text.secondary,
      fontWeight: 600,
    },
    queueSummaryMetricValue: {
      fontWeight: 600,
    },
    sectionDivider: {
      backgroundColor: 'var(--aegis-muted)',
      margin: theme.spacing(3, 0),
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

const getFlavorIcon = (flavorId: string) =>
  flavorId.startsWith('gpu') ? MemoryIcon : StorageIcon;

const normalizeVisibility = (value?: string | null): ProjectVisibility => {
  if (value === 'restricted' || value === 'internal' || value === 'public') {
    return value;
  }
  return 'internal';
};

const formatBudget = (budget?: { monthlyLimit: number; monthlyUsed: number }) => {
  if (!budget) {
    return '—';
  }
  const { monthlyLimit, monthlyUsed } = budget;
  if (!monthlyLimit && !monthlyUsed) {
    return '—';
  }
  return `$${monthlyUsed.toLocaleString('en-US')} / $${monthlyLimit.toLocaleString('en-US')}`;
};

export const LaunchWorkspacePage: FC = () => {
  const classes = useStyles();
  const fetchApi = useApi(fetchApiRef);
  const discoveryApi = useApi(discoveryApiRef);
  const identityApi = useApi(identityApiRef);
  const authApi = useApi(keycloakAuthApiRef);
  const alertApi = useApi(alertApiRef);
  const workloadsLink = useRouteRef(workloadsRouteRef);
  const projectManagementLink = useRouteRef(projectManagementRouteRef);
  const createClusterLink = useRouteRef(createClusterRouteRef);
  const navigate = useNavigate();

  const projectConsolePath = projectManagementLink();
  const clusterProvisioningPath = createClusterLink();

  const {
    value: provisioningCatalog,
    loading: catalogLoading,
    error: catalogError,
    retry: reloadCatalog,
  } = useProvisioningCatalog();
  const { value: isAdmin } = useIsAegisAdmin();

  const [activeStep, setActiveStep] = useState(0);
  const [workspaceTypeId, setWorkspaceTypeId] =
    useState<WorkspaceTypeId | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [forceAdvancedOpen, setForceAdvancedOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
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

  const projectOptions = useMemo<ProjectDefinition[]>(() => {
    if (!provisioningCatalog) {
      return [];
    }

    const queuesByProject = new Map<string, QueueDefinition[]>();

    provisioningCatalog.queues.forEach(queue => {
      const list = queuesByProject.get(queue.projectId) ?? [];
      list.push({
        id: queue.id,
        name: queue.name ?? queue.id,
        description: queue.description ?? 'No queue description provided.',
        visibility: normalizeVisibility(queue.visibility),
        gpuClass: queue.gpuClass ?? 'Unspecified',
        maxRuntimeHours: queue.maxRuntimeHours ?? 0,
        activeWorkspaces: queue.activeWorkspaces ?? 0,
        budget: {
          monthlyLimit: queue.budget?.monthlyLimit ?? 0,
          monthlyUsed: queue.budget?.monthlyUsed ?? 0,
        },
        clusterId: queue.clusterId,
      });
      queuesByProject.set(queue.projectId, list);
    });

    return provisioningCatalog.projects.map(project => {
      const queues = queuesByProject.get(project.id) ?? [];
      const defaultQueue = project.defaultQueueId ?? queues[0]?.id ?? '';
      return {
        id: project.id,
        name: project.name ?? project.id,
        visibility: normalizeVisibility(project.visibility),
        description: project.description ?? 'No project description provided.',
        lead: project.lead ?? 'Unassigned',
        budget: {
          monthlyLimit: project.budget?.monthlyLimit ?? 0,
          monthlyUsed: project.budget?.monthlyUsed ?? 0,
        },
        defaultQueue,
        queues,
      };
    });
  }, [provisioningCatalog]);

  const clusterMap = useMemo(() => {
    const map = new Map<string, { id: string; status?: string; provider?: string; region?: string; displayName?: string; createdAt?: string; projectId: string }>();
    (provisioningCatalog?.clusters ?? []).forEach(cluster => {
      map.set(cluster.id, {
        id: cluster.id,
        status: cluster.status,
        provider: cluster.provider,
        region: cluster.region,
        displayName: cluster.displayName,
        createdAt: cluster.createdAt,
        projectId: cluster.projectId,
      });
    });
    return map;
  }, [provisioningCatalog]);

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

  useEffect(() => {
    if (projectOptions.length === 0) {
      return;
    }
    setForm(prev => {
      if (prev.projectId) {
        return prev;
      }
      const first = projectOptions[0];
      const queueId = first.defaultQueue || first.queues?.[0]?.id || '';
      return { ...prev, projectId: first.id, queue: queueId };
    });
  }, [projectOptions]);

  const selectedProject = useMemo<ProjectDefinition | null>(
    () => projectOptions.find(project => project.id === form.projectId) ?? null,
    [projectOptions, form.projectId],
  );

  const queueOptions = useMemo<QueueDefinition[]>(
    () => selectedProject?.queues ?? [],
    [selectedProject],
  );

  const selectedQueue = useMemo<QueueDefinition | null>(
    () => queueOptions.find(queue => queue.id === form.queue) ?? null,
    [queueOptions, form.queue],
  );

  const projectClusters = useMemo(
    () =>
      (provisioningCatalog?.clusters ?? []).filter(
        cluster => cluster.projectId === form.projectId,
      ),
    [form.projectId, provisioningCatalog],
  );

  const selectedCluster = useMemo(() => {
    if (!selectedQueue?.clusterId) {
      return null;
    }
    return clusterMap.get(selectedQueue.clusterId) ?? null;
  }, [clusterMap, selectedQueue]);

  const noProjectsAvailable = !catalogLoading && projectOptions.length === 0;
  const noQueuesForProject =
    Boolean(selectedProject) && !catalogLoading && queueOptions.length === 0;
  const noClustersForProject =
    Boolean(selectedProject) && !catalogLoading && projectClusters.length === 0;

  const dynamicFlavorOptions = useMemo<FlavorOption[]>(() => {
    const flavors = provisioningCatalog?.flavors ?? [];
    if (flavors.length === 0) {
      return [];
    }
    return flavors.map(flavor => {
      const parts: string[] = [];
      if (flavor.gpu) {
        parts.push(flavor.gpu);
      }
      if (flavor.cpu) {
        parts.push(flavor.cpu);
      }
      if (flavor.memory) {
        parts.push(flavor.memory);
      }
      const resources = parts.length > 0 ? parts.join(' • ') : 'Custom configuration';
      return {
        id: flavor.id,
        title: flavor.name ?? flavor.id,
        description: flavor.description ?? 'Provisioned flavor',
        flavor: flavor.id,
        resources,
      };
    });
  }, [provisioningCatalog]);

  const flavorOptions = dynamicFlavorOptions.length > 0 ? dynamicFlavorOptions : defaultFlavorCatalog;

  useEffect(() => {
    if (flavorOptions.length === 0) {
      return;
    }
    setForm(prev => {
      if (prev.flavor && flavorOptions.some(option => option.flavor === prev.flavor)) {
        return prev;
      }
      return { ...prev, flavor: flavorOptions[0].flavor };
    });
  }, [flavorOptions]);

  useEffect(() => {
    if (!selectedProject) {
      return;
    }
    const allowedQueueIds = selectedProject.queues.map(queue => queue.id);
    const fallbackQueueId =
      selectedProject.defaultQueue || allowedQueueIds[0] || '';
    if (!allowedQueueIds.includes(form.queue) && fallbackQueueId !== form.queue) {
      setForm(prev => ({ ...prev, queue: fallbackQueueId }));
    }
  }, [form.queue, selectedProject]);

  const handleFormFieldChange =
    (field: keyof typeof form) => (event: ChangeEvent<HTMLInputElement>) => {
      setForm(prev => ({ ...prev, [field]: event.target.value }));
    };

  const applyTemplate = (template: TemplateOption) => {
    setTemplateId(template.id);
    setForceAdvancedOpen(Boolean(template.autoShowAdvanced));
    setAdvancedOpen(prev => prev || Boolean(template.autoShowAdvanced));

    const templateFlavor = template.defaults.flavor;
    const hasTemplateFlavor =
      templateFlavor &&
      flavorOptions.some(option => option.flavor === templateFlavor);

    setForm(prev => ({
      ...prev,
      flavor: hasTemplateFlavor ? templateFlavor : prev.flavor,
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
    const nextProject = projectOptions.find(project => project.id === projectId);
    const nextQueue =
      nextProject?.defaultQueue || nextProject?.queues?.[0]?.id || '';
    setForm(prev => ({ ...prev, projectId, queue: nextQueue }));
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
    Boolean(form.workloadId.trim()) &&
    queueOptions.length > 0;

  const canProceedFromResources =
    Boolean(form.flavor.trim()) && Boolean(form.image.trim());

  const isSubmitDisabled =
    submitting ||
    !form.projectId.trim() ||
    !form.flavor.trim() ||
    !form.image.trim() ||
    !form.workloadId.trim() ||
    queueOptions.length === 0;

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
      {flavorOptions.map(option => {
        const selected = option.flavor === form.flavor;
        const FlavorIcon = getFlavorIcon(option.flavor);
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
                  <Typography variant="subtitle2" color="textSecondary">
                    {option.resources}
                  </Typography>
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

  return (
    <Page themeId="tool">
      <Content>
        <ContentHeader title="Launch Interactive Workspace">
          <Typography variant="body1" className={classes.hero}>
            Compose DoD/IC-grade workspaces with the same minimal flow your
            operators expect from modern tooling. Choose a template, tune
            compute, then launch to ÆGIS clusters in a few decisive steps.
          </Typography>
        </ContentHeader>
        <form onSubmit={handleSubmit} className={classes.content}>
          <Paper elevation={0} className={classes.wizardShell}>
            <Stepper activeStep={activeStep} alternativeLabel className={classes.stepper}>
              {steps.map(step => (
                <Step key={step}>
                  <StepLabel StepIconComponent={StepIconComponent} classes={{ label: classes.stepLabel }}>
                    {step}
                  </StepLabel>
                </Step>
              ))}
            </Stepper>

            {catalogLoading && (
              <Box display="flex" justifyContent="center" paddingY={2}>
                <Progress />
              </Box>
            )}

            {!catalogLoading && catalogError && (
              <Box marginBottom={3}>
                <WarningPanel severity="error" title="Failed to load provisioning data">
                  Unable to retrieve projects, queues, or clusters. Please try again.
                  <Box marginTop={1}>
                    <Button color="primary" variant="outlined" onClick={() => reloadCatalog()}>
                      Retry load
                    </Button>
                  </Box>
                </WarningPanel>
              </Box>
            )}

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
                      disabled={catalogLoading || projectOptions.length === 0}
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
                            <div className={classes.selectMenuContent}>
                              <Typography variant="subtitle1">{project.name}</Typography>
                              <Typography variant="body2" color="textSecondary">
                                {project.description}
                              </Typography>
                            </div>
                          </MenuItem>
                        ))}
                        {projectOptions.length === 0 && !catalogLoading && (
                          <MenuItem value="" disabled>
                            No provisioned projects found
                          </MenuItem>
                        )}
                      </Select>
                      <FormHelperText>
                        Projects are provisioned by platform admins. Select one to inherit the
                        correct visibility and guardrails.
                      </FormHelperText>
                    </FormControl>
                    <TextField
                      label="Workspace ID"
                      value={form.workloadId}
                      onChange={handleFormFieldChange('workloadId')}
                      variant="outlined"
                      required
                      fullWidth
                      helperText="Identifier visible to mission operators"
                    />
                    {noProjectsAvailable && (
                      <Box marginTop={2}>
                        <EmptyState
                          title="No projects available"
                          missing="data"
                          description="An administrator must provision a project, queue, and cluster before new workspaces can launch."
                          action={
                            isAdmin ? (
                              <Button
                                variant="contained"
                                color="primary"
                                onClick={() => navigate(projectConsolePath)}
                              >
                                Open project console
                              </Button>
                            ) : undefined
                          }
                        />
                      </Box>
                    )}
                    {selectedProject && (
                      <div className={classes.projectOverview}>
                        <div className={classes.projectHeader}>
                          <Typography variant="subtitle1" component="span">
                            {selectedProject.name}
                          </Typography>
                          <Chip
                            label={visibilityCopy[selectedProject.visibility].label}
                            color={
                              visibilityCopy[selectedProject.visibility].tone === 'default'
                                ? 'default'
                                : visibilityCopy[selectedProject.visibility].tone
                            }
                            size="small"
                          />
                        </div>
                        <Typography variant="body2" color="textSecondary">
                          {selectedProject.description}
                        </Typography>
                        <div className={classes.projectMeta}>
                          <div>
                            <div className={classes.projectMetaLabel}>Project lead</div>
                            <div className={classes.projectMetaValue}>{selectedProject.lead}</div>
                          </div>
                          <div>
                            <div className={classes.projectMetaLabel}>Monthly burn</div>
                            <div className={classes.projectMetaValue}>
                              {formatBudget(selectedProject.budget)}
                            </div>
                          </div>
                          <div>
                            <div className={classes.projectMetaLabel}>Default queue</div>
                            <div className={classes.projectMetaValue}>
                              {selectedProject.defaultQueue}
                            </div>
                          </div>
                        </div>
                        <div className={classes.projectActions}>
                          <Typography variant="caption" color="textSecondary">
                            Need deeper control? Review queue guardrails or shift budgets from the
                            project console.
                          </Typography>
                          <Button
                            variant="outlined"
                            color="primary"
                            onClick={() => navigate(projectConsolePath)}
                          >
                            Manage projects
                          </Button>
                        </div>
                      </div>
                    )}
                    {selectedProject && (noQueuesForProject || noClustersForProject) && (
                      <Box marginTop={2}>
                        <EmptyState
                          title={
                            noClustersForProject
                              ? 'No clusters provisioned'
                              : 'No queues available'
                          }
                          missing="data"
                          description={
                            noClustersForProject
                              ? 'Provision a cluster for this project before launching workspaces.'
                              : 'Queues define guardrails for compute access. Ask an administrator to configure one for this project.'
                          }
                          action={
                            isAdmin ? (
                              <Button
                                variant="contained"
                                color="primary"
                                onClick={() => navigate(clusterProvisioningPath)}
                              >
                                Create cluster
                              </Button>
                            ) : undefined
                          }
                        />
                      </Box>
                    )}
                    <Divider className={classes.sectionDivider} />
                    <Typography variant="overline" color="textSecondary">
                      Workspace type
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Select the interactive surface to pre-wire tooling and UX
                      expectations.
                    </Typography>
                  </div>
                </Grid>
                <Grid item xs={12} md={7}>
                  {renderWorkspaceTypeCards()}
                  <Divider className={classes.sectionDivider} />
                  <Typography variant="overline" color="textSecondary">
                    Template presets
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Start from a mission-ready template or bring your own
                    container profile.
                  </Typography>
                  {renderTemplateCards()}
                </Grid>
              </Grid>
            )}

            {activeStep === 1 && (
              <Grid container spacing={3}>
                <Grid item xs={12} md={7}>
                  <Typography variant="overline" color="textSecondary">
                    Compute flavors
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Match GPU, CPU, and memory to mission objectives. ÆGIS
                    enforces guardrails based on queue policy.
                  </Typography>
                  {renderFlavorCards()}
                </Grid>
                <Grid item xs={12} md={5}>
                  <div className={classes.formSection}>
                    <Typography variant="overline" color="textSecondary">
                      Runtime configuration
                    </Typography>
                    <TextField
                      label="Container image"
                      value={form.image}
                      onChange={handleFormFieldChange('image')}
                      variant="outlined"
                      required
                      fullWidth
                      helperText="OCI image with your workspace runtime"
                    />
                    <FormControl
                      variant="outlined"
                      fullWidth
                      disabled={queueOptions.length === 0}
                    >
                      <InputLabel id="launch-workspace-queue">
                        Execution queue
                      </InputLabel>
                      <Select
                        labelId="launch-workspace-queue"
                        label="Execution queue"
                        value={form.queue}
                        onChange={handleQueueSelect}
                      >
                        {queueOptions.map(queue => (
                          <MenuItem key={queue.id} value={queue.id}>
                            <div className={classes.selectMenuContent}>
                              <Typography variant="subtitle2">{queue.name}</Typography>
                              <Typography variant="body2" color="textSecondary">
                                {queue.description}
                              </Typography>
                            </div>
                          </MenuItem>
                        ))}
                      </Select>
                      <FormHelperText>
                        {queueOptions.length === 0
                          ? 'No queues are assigned to this project yet.'
                          : 'Stay on the default queue or opt into another guardrail managed by this project.'}
                      </FormHelperText>
                    </FormControl>
                      {selectedQueue && (
                        <div className={classes.queueSummaryCard}>
                          <div className={classes.queueSummaryHeader}>
                            <Typography variant="subtitle1" component="span">
                              {selectedQueue.name}
                          </Typography>
                          <Chip
                            label={visibilityCopy[selectedQueue.visibility].label}
                            color={
                              visibilityCopy[selectedQueue.visibility].tone === 'default'
                                ? 'default'
                                : visibilityCopy[selectedQueue.visibility].tone
                            }
                            size="small"
                          />
                        </div>
                        <Typography variant="body2" color="textSecondary">
                          {selectedQueue.description}
                        </Typography>
                          <div className={classes.queueSummaryMetrics}>
                            <div>
                              <div className={classes.queueSummaryMetricLabel}>GPU class</div>
                              <div className={classes.queueSummaryMetricValue}>
                                {selectedQueue.gpuClass}
                              </div>
                            </div>
                            <div>
                              <div className={classes.queueSummaryMetricLabel}>Max runtime</div>
                              <div className={classes.queueSummaryMetricValue}>
                                {selectedQueue.maxRuntimeHours} hrs
                              </div>
                            </div>
                            <div>
                              <div className={classes.queueSummaryMetricLabel}>Active workspaces</div>
                              <div className={classes.queueSummaryMetricValue}>
                                {selectedQueue.activeWorkspaces}
                              </div>
                            </div>
                            <div>
                              <div className={classes.queueSummaryMetricLabel}>Monthly burn</div>
                              <div className={classes.queueSummaryMetricValue}>
                                {formatBudget(selectedQueue.budget)}
                              </div>
                            </div>
                            {selectedCluster && (
                              <>
                                <div>
                                  <div className={classes.queueSummaryMetricLabel}>Cluster</div>
                                  <div className={classes.queueSummaryMetricValue}>
                                    {selectedCluster.displayName ?? selectedCluster.id}
                                  </div>
                                </div>
                                <div>
                                  <div className={classes.queueSummaryMetricLabel}>Region</div>
                                  <div className={classes.queueSummaryMetricValue}>
                                    {selectedCluster.region ?? '—'}
                                  </div>
                                </div>
                                <div>
                                  <div className={classes.queueSummaryMetricLabel}>Provider</div>
                                  <div className={classes.queueSummaryMetricValue}>
                                    {selectedCluster.provider ?? '—'}
                                  </div>
                                </div>
                                <div>
                                  <div className={classes.queueSummaryMetricLabel}>Status</div>
                                  <div className={classes.queueSummaryMetricValue}>
                                    {selectedCluster.status ?? 'Unknown'}
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                          {!selectedCluster && (
                            <Typography variant="body2" color="textSecondary">
                              This queue is not yet linked to a running cluster.
                            </Typography>
                          )}
                          </div>
                        </div>
                      )}
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
                      <span className={classes.reviewLabel}>Flavor</span>
                      <span className={classes.reviewValue}>
                        {form.flavor || '—'}
                      </span>
                    </div>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <div className={classes.reviewRow}>
                      <span className={classes.reviewLabel}>Queue</span>
                      <span className={classes.reviewValue}>
                        {selectedQueue?.name ??
                          (selectedProject?.defaultQueue
                            ? `${selectedProject.defaultQueue} (default)`
                            : 'Project default')}
                      </span>
                    </div>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <div className={classes.reviewRow}>
                      <span className={classes.reviewLabel}>Cluster</span>
                      <span className={classes.reviewValue}>
                        {selectedCluster
                          ? selectedCluster.displayName ?? selectedCluster.id
                          : '—'}
                      </span>
                    </div>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <div className={classes.reviewRow}>
                      <span className={classes.reviewLabel}>Container image</span>
                      <span className={classes.reviewValue}>{form.image || '—'}</span>
                    </div>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <div className={classes.reviewRow}>
                      <span className={classes.reviewLabel}>Ports</span>
                      <span className={classes.reviewValue}>
                        {form.ports || 'Default (22, 11111)'}
                      </span>
                    </div>
                  </Grid>
                  <Grid item xs={12}>
                    <div className={classes.reviewRow}>
                      <span className={classes.reviewLabel}>Environment variables</span>
                      <span className={classes.reviewValue}>
                        {form.env || 'Inherited defaults'}
                      </span>
                    </div>
                  </Grid>
                </Grid>
              </Paper>
            )}

            <div className={classes.actionRow}>
              <Box display="flex" style={{ gap: 16 }}>
                <Button
                  type="button"
                  variant="outlined"
                  disabled={activeStep === 0 || submitting}
                  onClick={goPreviousStep}
                >
                  Back
                </Button>
                {activeStep < steps.length - 1 && (
                  <Button
                    type="button"
                    color="primary"
                    variant="contained"
                    disabled={
                      submitting ||
                      (activeStep === 0 && !canProceedFromBasics) ||
                      (activeStep === 1 && !canProceedFromResources)
                    }
                    onClick={goNextStep}
                  >
                    Next
                  </Button>
                )}
              </Box>
              {activeStep === steps.length - 1 && (
                <Box
                  display="flex"
                  alignItems="center"
                  style={{ gap: 16 }}
                >
                  <Button
                    type="submit"
                    color="primary"
                    variant="contained"
                    disabled={isSubmitDisabled}
                    startIcon={<TimelineIcon />}
                  >
                    Launch workspace
                  </Button>
                  {submitting && <Progress />}
                </Box>
              )}
            </div>
          </Paper>
        </form>

        {error && (
          <Box marginTop={3}>
            <WarningPanel severity="error" title="Workspace submission failed">
              {error}
            </WarningPanel>
          </Box>
        )}
      </Content>
    </Page>
  );
};
