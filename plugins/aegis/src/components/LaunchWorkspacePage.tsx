import {
  ChangeEvent,
  ComponentType,
  FC,
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Page, Content, ContentHeader, Progress, WarningPanel } from '@backstage/core-components';
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
  FormControlLabel,
  Grid,
  LinearProgress,
  MenuItem,
  Paper,
  Step,
  StepLabel,
  Stepper,
  Switch,
  TextField,
  Typography,
} from '@material-ui/core';
import { makeStyles, useTheme } from '@material-ui/core/styles';
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
import { projectManagementRouteRef, workloadsRouteRef } from '../routes';
import {
  getDefaultProject,
  getProjectById,
  getQueueFromProject,
  getVisibilityColor,
  projectCatalog,
} from './projectCatalog';

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

// TODO: Replace static catalogs with workspace profiles served by the ÆGIS control plane API.
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
      queue: 'gpu-strike',
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
      queue: 'gpu-exploratory',
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

const flavorCatalog: FlavorOption[] = [
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
    projectHeader: {
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
    },
    projectMetadata: {
      display: 'flex',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: theme.spacing(1),
    },
    projectVisibilityChip: {
      fontWeight: 600,
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
    },
    projectTagChip: {
      backgroundColor: alpha(accent, isDark ? 0.14 : 0.09),
      color: accent,
      fontWeight: 600,
    },
    budgetMeter: {
      marginTop: theme.spacing(1),
    },
    budgetProgress: {
      height: 8,
      borderRadius: theme.shape.borderRadius,
    },
    budgetLegend: {
      display: 'flex',
      justifyContent: 'space-between',
      color: theme.palette.text.secondary,
      fontSize: '0.85rem',
    },
    selectorMenuItem: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      gap: theme.spacing(0.5),
    },
    selectorMenuPrimary: {
      fontWeight: 600,
    },
    selectorMenuSecondary: {
      fontSize: '0.8rem',
      color: theme.palette.text.secondary,
    },
    selectorMenuBadge: {
      fontSize: '0.7rem',
      fontWeight: 700,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      marginLeft: theme.spacing(1),
      padding: theme.spacing(0.25, 0.75),
      borderRadius: 999,
      border: `1px solid ${alpha(accent, isDark ? 0.5 : 0.35)}`,
      color: accent,
    },
    queueSummary: {
      backgroundColor: isDark ? alpha('#0F172A', 0.65) : '#F7F7F9',
      borderRadius: theme.shape.borderRadius,
      border: `1px solid ${borderColor}`,
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1.5),
      padding: theme.spacing(2.5),
    },
    queueSummaryHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: theme.spacing(2),
    },
    queueBadgeRow: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: theme.spacing(1),
    },
    metricPill: {
      borderRadius: 999,
      padding: theme.spacing(0.5, 1.5),
      backgroundColor: isDark ? alpha('#1F2937', 0.9) : '#FFFFFF',
      border: `1px solid ${borderColor}`,
      fontSize: '0.8rem',
      fontWeight: 600,
      color: theme.palette.text.secondary,
    },
    projectActions: {
      marginTop: theme.spacing(1),
      display: 'flex',
      flexWrap: 'wrap',
      gap: theme.spacing(1.5),
      alignItems: 'center',
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

export const LaunchWorkspacePage: FC = () => {
  const classes = useStyles();
  const theme = useTheme();
  const fetchApi = useApi(fetchApiRef);
  const discoveryApi = useApi(discoveryApiRef);
  const identityApi = useApi(identityApiRef);
  const authApi = useApi(keycloakAuthApiRef);
  const alertApi = useApi(alertApiRef);
  const workloadsLink = useRouteRef(workloadsRouteRef);
  const projectAdminLink = useRouteRef(projectManagementRouteRef);
  const navigate = useNavigate();

  const [activeStep, setActiveStep] = useState(0);
  const [workspaceTypeId, setWorkspaceTypeId] =
    useState<WorkspaceTypeId | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [forceAdvancedOpen, setForceAdvancedOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [form, setForm] = useState(() => {
    const defaultProject = getDefaultProject();
    const fallbackQueue =
      defaultProject?.defaultQueueId || defaultProject?.queues[0]?.id || '';

    return {
      workloadId: randomId(),
      projectId: defaultProject?.id ?? '',
      queue: fallbackQueue,
      flavor: '',
      image: '',
      ports: '22',
      env: '',
    };
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedProject = useMemo(
    () => getProjectById(form.projectId),
    [form.projectId],
  );

  const availableQueues = selectedProject?.queues ?? [];

  const selectedQueue = useMemo(
    () => getQueueFromProject(selectedProject, form.queue),
    [selectedProject, form.queue],
  );

  const visibilityStyle = useMemo(() => {
    if (!selectedProject) {
      return null;
    }
    return getVisibilityColor(selectedProject.visibility, theme.palette);
  }, [
    selectedProject,
    theme.palette.info.main,
    theme.palette.primary.main,
    theme.palette.warning.main,
  ]);

  const budgetPercent = useMemo(() => {
    if (!selectedProject) {
      return 0;
    }
    const { allocated, consumed } = selectedProject.budget;
    if (!allocated) {
      return 0;
    }
    return Math.min(100, Math.round((consumed / allocated) * 100));
  }, [selectedProject]);

  const queueDisciplineStyle = useMemo(() => {
    if (!selectedQueue) {
      return null;
    }

    const palette = theme.palette;
    const baseColor = (() => {
      if (selectedQueue.discipline === 'gpu') {
        return palette.secondary?.main ?? palette.primary.main;
      }
      if (selectedQueue.discipline === 'burst') {
        return palette.warning.main;
      }
      return palette.success?.main ?? palette.primary.main;
    })();

    return {
      background: alpha(baseColor, palette.type === 'dark' ? 0.3 : 0.18),
      color: baseColor,
    };
  }, [
    selectedQueue,
    theme.palette.primary.main,
    theme.palette.secondary?.main,
    theme.palette.success?.main,
    theme.palette.warning.main,
    theme.palette.type,
  ]);

  useEffect(() => {
    if (!selectedProject) {
      return;
    }

    const queueIds = selectedProject.queues.map(queue => queue.id);
    const fallbackQueue =
      selectedProject.defaultQueueId || queueIds[0] || '';

    if (queueIds.length === 0) {
      if (form.queue !== '') {
        setForm(prev => ({ ...prev, queue: '' }));
      }
      return;
    }

    if (!queueIds.includes(form.queue)) {
      setForm(prev => ({ ...prev, queue: fallbackQueue }));
    }
  }, [form.queue, selectedProject]);

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
      flavor: template.defaults.flavor ?? prev.flavor,
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

  const handleProjectSelect = (
    event: ChangeEvent<{ value: unknown }>,
  ) => {
    const nextProjectId = event.target.value as string;
    const nextProject = getProjectById(nextProjectId);
    setForm(prev => {
      const queueIds = nextProject?.queues.map(queue => queue.id) ?? [];
      const fallbackQueue =
        nextProject?.defaultQueueId || queueIds[0] || '';
      const nextQueue = queueIds.includes(prev.queue)
        ? prev.queue
        : fallbackQueue;

      return {
        ...prev,
        projectId: nextProjectId,
        queue: nextQueue,
      };
    });
  };

  const handleQueueSelect = (event: ChangeEvent<{ value: unknown }>) => {
    setForm(prev => ({ ...prev, queue: event.target.value as string }));
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
    Boolean(form.workloadId.trim());

  const canProceedFromResources =
    Boolean(form.flavor.trim()) && Boolean(form.image.trim());

  const isSubmitDisabled =
    submitting ||
    !form.projectId.trim() ||
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
      {flavorCatalog.map(option => {
        const selected = option.flavor === form.flavor;
        const FlavorIcon = getFlavorIcon(option.id);
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

            {activeStep === 0 && (
              <Grid container spacing={3}>
                <Grid item xs={12} md={5}>
                  <div className={classes.formSection}>
                    <Typography variant="overline" color="textSecondary">
                      Project context
                    </Typography>
                    <TextField
                      select
                      label="Launch under project"
                      value={form.projectId}
                      onChange={handleProjectSelect}
                      variant="outlined"
                      required
                      fullWidth
                      helperText="Projects drive visibility, billing, and guardrails"
                    >
                      {projectCatalog.map(project => (
                        <MenuItem key={project.id} value={project.id}>
                          <div className={classes.selectorMenuItem}>
                            <div>
                              <span className={classes.selectorMenuPrimary}>
                                {project.name}
                              </span>
                              {project.isDefault ? (
                                <span className={classes.selectorMenuBadge}>
                                  Auto
                                </span>
                              ) : null}
                            </div>
                            <span className={classes.selectorMenuSecondary}>
                              {project.visibility} • {project.id}
                            </span>
                          </div>
                        </MenuItem>
                      ))}
                    </TextField>

                    {selectedProject ? (
                      <>
                        <div className={classes.projectHeader}>
                          <Typography variant="h6">
                            {selectedProject.name}
                          </Typography>
                          <Typography variant="body2" color="textSecondary">
                            {selectedProject.description}
                          </Typography>
                        </div>
                        <div className={classes.projectMetadata}>
                          <Chip
                            size="small"
                            label={selectedProject.visibility}
                            className={classes.projectVisibilityChip}
                            style={visibilityStyle ?? undefined}
                          />
                          <Typography variant="caption" color="textSecondary">
                            Owner: {selectedProject.owner}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            Mission: {selectedProject.missionFocus}
                          </Typography>
                        </div>
                        {selectedProject.tags.length > 0 ? (
                          <div className={classes.projectMetadata}>
                            {selectedProject.tags.map(tag => (
                              <Chip
                                key={`${selectedProject.id}-${tag}`}
                                size="small"
                                label={tag}
                                className={classes.projectTagChip}
                              />
                            ))}
                          </div>
                        ) : null}
                        <div className={classes.budgetMeter}>
                          <LinearProgress
                            variant="determinate"
                            value={budgetPercent}
                            className={classes.budgetProgress}
                          />
                          <div className={classes.budgetLegend}>
                            <span>
                              ${selectedProject.budget.consumed.toLocaleString()} spent
                            </span>
                            <span>
                              ${selectedProject.budget.allocated.toLocaleString()} FY cap ({
                                budgetPercent
                              }
                              %)
                            </span>
                          </div>
                        </div>
                        <TextField
                          select
                          label="Launch queue"
                          value={form.queue}
                          onChange={handleQueueSelect}
                          variant="outlined"
                          fullWidth
                          helperText="Queues enforce scheduling, GPU access, and budget guardrails"
                        >
                          {availableQueues.map(queue => (
                            <MenuItem key={queue.id} value={queue.id}>
                              <div className={classes.selectorMenuItem}>
                                <span className={classes.selectorMenuPrimary}>
                                  {queue.name}
                                </span>
                                <span className={classes.selectorMenuSecondary}>
                                  {queue.id} • Concurrency {queue.concurrency}
                                </span>
                              </div>
                            </MenuItem>
                          ))}
                          {form.queue &&
                          !availableQueues.some(queue => queue.id === form.queue) ? (
                            <MenuItem value={form.queue}>
                              <div className={classes.selectorMenuItem}>
                                <span className={classes.selectorMenuPrimary}>
                                  {form.queue}
                                </span>
                                <span className={classes.selectorMenuSecondary}>
                                  Custom override
                                </span>
                              </div>
                            </MenuItem>
                          ) : null}
                        </TextField>
                        <div className={classes.queueSummary}>
                          <div className={classes.queueSummaryHeader}>
                            <Typography variant="subtitle1">
                              {selectedQueue?.name ?? 'Project default queue'}
                            </Typography>
                            <Chip
                              size="small"
                              label={(selectedQueue?.discipline ?? 'policy').toUpperCase()}
                              className={classes.projectVisibilityChip}
                              style={queueDisciplineStyle ?? undefined}
                            />
                          </div>
                          <Typography variant="body2" color="textSecondary">
                            {selectedQueue?.description ??
                              'Queue inherits from project guardrails with automatic capacity balancing.'}
                          </Typography>
                          <div className={classes.queueBadgeRow}>
                            <span className={classes.metricPill}>
                              Health: {selectedQueue?.health ?? 'Managed'}
                            </span>
                            <span className={classes.metricPill}>
                              Concurrency: {selectedQueue?.concurrency ?? '—'}
                            </span>
                            <span className={classes.metricPill}>
                              Utilization:{' '}
                              {selectedQueue
                                ? `${Math.round(selectedQueue.utilization * 100)}%`
                                : 'adaptive'}
                            </span>
                            {selectedQueue?.budgetGuardrail ? (
                              <span className={classes.metricPill}>
                                {selectedQueue.budgetGuardrail}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </>
                    ) : null}

                    <TextField
                      label="Workspace ID"
                      value={form.workloadId}
                      onChange={handleFormFieldChange('workloadId')}
                      variant="outlined"
                      required
                      fullWidth
                      helperText="Identifier visible to mission operators"
                    />

                    <div className={classes.projectActions}>
                      <Button
                        component={RouterLink}
                        to={projectAdminLink()}
                        variant="outlined"
                        color="primary"
                        size="small"
                      >
                        Manage projects & queues
                      </Button>
                      <Typography variant="caption" color="textSecondary">
                        Defaults auto-provisioned for fresh tenants; admins can
                        fine-tune from the management console.
                      </Typography>
                    </div>
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
                    <TextField
                      select
                      label="Launch queue"
                      value={form.queue}
                      onChange={handleQueueSelect}
                      variant="outlined"
                      fullWidth
                      helperText="Override the project default when coordinating special launches"
                    >
                      {availableQueues.map(queue => (
                        <MenuItem key={`resources-${queue.id}`} value={queue.id}>
                          <div className={classes.selectorMenuItem}>
                            <span className={classes.selectorMenuPrimary}>
                              {queue.name}
                            </span>
                            <span className={classes.selectorMenuSecondary}>
                              {queue.id} • Concurrency {queue.concurrency}
                            </span>
                          </div>
                        </MenuItem>
                      ))}
                      {form.queue &&
                      !availableQueues.some(queue => queue.id === form.queue) ? (
                        <MenuItem value={form.queue}>
                          <div className={classes.selectorMenuItem}>
                            <span className={classes.selectorMenuPrimary}>
                              {form.queue}
                            </span>
                            <span className={classes.selectorMenuSecondary}>
                              Custom override
                            </span>
                          </div>
                        </MenuItem>
                      ) : null}
                    </TextField>
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
                        {selectedProject
                          ? `${selectedProject.name} (${selectedProject.id})`
                          : form.projectId || '—'}
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
                        {selectedQueue
                          ? `${selectedQueue.name} (${selectedQueue.id})`
                          : form.queue || 'Project default'}
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
