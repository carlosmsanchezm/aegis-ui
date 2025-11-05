import {
  ChangeEvent,
  ComponentType,
  FC,
  FormEvent,
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
  ButtonBase,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Collapse,
  Divider,
  FormControlLabel,
  Grid,
  MenuItem,
  Paper,
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
import { workloadsRouteRef } from '../routes';
import {
  findProjectById,
  projectProfiles,
  projectVisibilityDescriptions,
  projectVisibilityLabels,
  resolveDefaultQueueId,
} from './projectCatalog';

import type { Theme } from '@material-ui/core/styles/createMuiTheme';

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
    projectSurface: {
      backgroundColor: isDark ? alpha('#111827', 0.7) : '#FFFFFF',
      borderRadius: theme.shape.borderRadius,
      border: `1px solid ${borderColor}`,
      padding: theme.spacing(3),
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(2),
    },
    projectHeader: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: theme.spacing(1),
    },
    visibilityChip: {
      backgroundColor: alpha(accent, isDark ? 0.2 : 0.12),
      color: accent,
      fontWeight: 600,
      letterSpacing: '0.05em',
      textTransform: 'uppercase',
    },
    budgetGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
      gap: theme.spacing(2),
    },
    budgetStat: {
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.5),
    },
    budgetLabel: {
      fontSize: '0.75rem',
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: theme.palette.text.secondary,
    },
    budgetValue: {
      fontWeight: 600,
    },
    manageButton: {
      alignSelf: 'flex-start',
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
    queueList: {
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1.5),
      marginTop: theme.spacing(1),
    },
    queueCard: {
      borderRadius: theme.shape.borderRadius,
      border: `1px solid ${borderColor}`,
      padding: theme.spacing(2),
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: theme.spacing(2),
      transition: 'border-color 160ms ease, background-color 160ms ease',
      cursor: 'pointer',
    },
    queueCardActive: {
      borderColor: accent,
      backgroundColor: alpha(accent, isDark ? 0.16 : 0.12),
    },
    queueCardTitle: {
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.5),
    },
    queueMeta: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      gap: theme.spacing(0.75),
    },
    queueBadge: {
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
    },
    queueChipRow: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: theme.spacing(1),
      marginTop: theme.spacing(1),
    },
    queueChip: {
      fontWeight: 600,
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      color: theme.palette.text.secondary,
      borderColor: alpha(theme.palette.text.secondary, 0.3),
    },
    queueChipSelected: {
      color: accent,
      borderColor: alpha(accent, 0.8),
      backgroundColor: alpha(accent, isDark ? 0.18 : 0.1),
    },
    queueHelper: {
      color: theme.palette.text.secondary,
      marginTop: theme.spacing(1),
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
  const fetchApi = useApi(fetchApiRef);
  const discoveryApi = useApi(discoveryApiRef);
  const identityApi = useApi(identityApiRef);
  const authApi = useApi(keycloakAuthApiRef);
  const alertApi = useApi(alertApiRef);
  const workloadsLink = useRouteRef(workloadsRouteRef);
  const navigate = useNavigate();

  const [activeStep, setActiveStep] = useState(0);
  const [workspaceTypeId, setWorkspaceTypeId] =
    useState<WorkspaceTypeId | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [forceAdvancedOpen, setForceAdvancedOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [form, setForm] = useState(() => {
    const defaultProject = projectProfiles[0];
    const defaultQueue = resolveDefaultQueueId(defaultProject);

    return {
      workloadId: randomId(),
      projectId: defaultProject?.id ?? '',
      queue: defaultQueue,
      flavor: '',
      image: '',
      ports: '22',
      env: '',
    };
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedProject = useMemo(
    () => findProjectById(form.projectId) ?? projectProfiles[0] ?? null,
    [form.projectId],
  );

  const projectDefaultQueue = useMemo(
    () => resolveDefaultQueueId(selectedProject ?? undefined),
    [selectedProject],
  );

  const availableQueues = selectedProject?.queues ?? [];

  const projectDefaultQueueName = useMemo(() => {
    if (!selectedProject) {
      return '';
    }

    const fallback = selectedProject.queues.find(
      queue => queue.id === projectDefaultQueue,
    );
    return fallback ? fallback.name : '';
  }, [projectDefaultQueue, selectedProject]);

  const queueDisplayName = useMemo(() => {
    const trimmed = form.queue.trim();
    if (!trimmed) {
      if (!selectedProject) {
        return 'Project default';
      }

      const fallback = selectedProject.queues.find(
        queue => queue.id === projectDefaultQueue,
      );

      return fallback
        ? `${fallback.name} (${fallback.id})`
        : 'Project default';
    }

    const match = availableQueues.find(queue => queue.id === trimmed);
    return match ? `${match.name} (${match.id})` : trimmed;
  }, [availableQueues, form.queue, projectDefaultQueue, selectedProject]);

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

  const handleProjectSelect = (event: ChangeEvent<{ value: unknown }>) => {
    const nextProjectId = event.target.value as string;

    setForm(prev => {
      const nextProject = findProjectById(nextProjectId);
      const nextDefaultQueue = resolveDefaultQueueId(nextProject);
      const canKeepQueue =
        nextProject?.queues.some(queue => queue.id === prev.queue) ?? false;

      return {
        ...prev,
        projectId: nextProjectId,
        queue: canKeepQueue ? prev.queue : nextDefaultQueue,
      };
    });
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
          : prev.queue || projectDefaultQueue,
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

  const handleQueueQuickSelect = (queueId: string) => {
    setForm(prev => ({ ...prev, queue: queueId }));
  };

  const handleQueueReset = () => {
    setForm(prev => ({ ...prev, queue: projectDefaultQueue }));
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
                      label="Project"
                      value={form.projectId}
                      onChange={handleProjectSelect}
                      variant="outlined"
                      required
                      fullWidth
                      helperText={
                        selectedProject
                          ? projectVisibilityDescriptions[selectedProject.visibility]
                          : 'Projects govern access and billing budgets'
                      }
                    >
                      {projectProfiles.map(project => (
                        <MenuItem key={project.id} value={project.id}>
                          <Box display="flex" flexDirection="column" width="100%">
                            <Box display="flex" alignItems="center" justifyContent="space-between">
                              <Typography variant="body1" component="span">
                                {project.name}
                              </Typography>
                              <Chip
                                size="small"
                                label={projectVisibilityLabels[project.visibility]}
                                className={classes.visibilityChip}
                              />
                            </Box>
                            <Typography variant="caption" color="textSecondary">
                              {project.description}
                            </Typography>
                          </Box>
                        </MenuItem>
                      ))}
                    </TextField>
                    {selectedProject && (
                      <div className={classes.projectSurface}>
                        <div className={classes.projectHeader}>
                          <div>
                            <Typography variant="h6">{selectedProject.name}</Typography>
                            <Typography variant="body2" color="textSecondary">
                              Sponsored by {selectedProject.sponsor}
                            </Typography>
                          </div>
                          <Chip
                            size="small"
                            label={`${projectVisibilityLabels[selectedProject.visibility]} Project`}
                            className={classes.visibilityChip}
                          />
                        </div>
                        <Typography variant="body2" color="textSecondary">
                          {selectedProject.description}
                        </Typography>
                        <div className={classes.budgetGrid}>
                          <div className={classes.budgetStat}>
                            <span className={classes.budgetLabel}>Budget used</span>
                            <span className={classes.budgetValue}>{selectedProject.budget.used}</span>
                          </div>
                          <div className={classes.budgetStat}>
                            <span className={classes.budgetLabel}>Budget committed</span>
                            <span className={classes.budgetValue}>{selectedProject.budget.committed}</span>
                          </div>
                          <div className={classes.budgetStat}>
                            <span className={classes.budgetLabel}>Renews</span>
                            <span className={classes.budgetValue}>{selectedProject.budget.renews}</span>
                          </div>
                        </div>
                        <Typography variant="caption" color="textSecondary">
                          Queues prepared for this project are listed below. Defaults are
                          auto-provisioned so most launches can skip manual overrides.
                        </Typography>
                        <div className={classes.queueList}>
                          {availableQueues.map(queue => {
                            const isActive = form.queue === queue.id;
                            const chipLabel =
                              queue.kind === 'gpu'
                                ? 'GPU'
                                : queue.kind === 'mixed'
                                ? 'Hybrid'
                                : 'CPU';

                            return (
                              <ButtonBase
                                key={queue.id}
                                onClick={() => handleQueueQuickSelect(queue.id)}
                                focusRipple
                                className={`${classes.queueCard} ${
                                  isActive ? classes.queueCardActive : ''
                                }`.trim()}
                              >
                                <div className={classes.queueCardTitle}>
                                  <Typography variant="subtitle1">{queue.name}</Typography>
                                  <Typography variant="body2" color="textSecondary">
                                    {queue.description}
                                  </Typography>
                                  <div className={classes.queueChipRow}>
                                    <Chip
                                      size="small"
                                      variant="outlined"
                                      label={chipLabel}
                                      className={`${classes.queueChip} ${
                                        isActive ? classes.queueChipSelected : ''
                                      }`.trim()}
                                    />
                                    <Chip
                                      size="small"
                                      variant="outlined"
                                      label={`${queue.backlogMinutes} min backlog`}
                                      className={classes.queueChip}
                                    />
                                  </div>
                                </div>
                                <div className={classes.queueMeta}>
                                  <Typography variant="caption" color="textSecondary">
                                    {queue.capacity}
                                  </Typography>
                                  <Typography variant="caption" color="textSecondary">
                                    {queue.policy}
                                  </Typography>
                                </div>
                              </ButtonBase>
                            );
                          })}
                        </div>
                        <Button
                          component={RouterLink}
                          to="/aegis/admin/projects"
                          variant="outlined"
                          color="primary"
                          size="small"
                          className={classes.manageButton}
                        >
                          Manage projects & queues
                        </Button>
                      </div>
                    )}
                    <TextField
                      label="Workspace ID"
                      value={form.workloadId}
                      onChange={handleFormFieldChange('workloadId')}
                      variant="outlined"
                      required
                      fullWidth
                      helperText="Identifier visible to mission operators"
                    />
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
                      label="Queue"
                      value={form.queue}
                      onChange={handleFormFieldChange('queue')}
                      variant="outlined"
                      fullWidth
                      helperText={
                        selectedProject
                          ? projectDefaultQueue
                            ? `Default queue: ${projectDefaultQueueName} (${projectDefaultQueue}). Override only when missions require a specific lane.`
                            : 'Override the queue if a different mission lane is required.'
                          : 'Override default queue for launch scheduling'
                      }
                    />
                    {availableQueues.length > 0 && (
                      <>
                        <Typography variant="caption" className={classes.queueHelper}>
                          Quick select from queues already approved for{' '}
                          {selectedProject?.name ?? 'this project'}.
                        </Typography>
                        <div className={classes.queueChipRow}>
                          {availableQueues.map(queue => (
                            <Chip
                              key={queue.id}
                              size="small"
                              variant="outlined"
                              clickable
                              onClick={() => handleQueueQuickSelect(queue.id)}
                              label={`${queue.name}`}
                              className={`${classes.queueChip} ${
                                form.queue === queue.id ? classes.queueChipSelected : ''
                              }`.trim()}
                            />
                          ))}
                          {projectDefaultQueue && (
                            <Chip
                              key="project-default-queue"
                              size="small"
                              variant="outlined"
                              clickable
                              onClick={handleQueueReset}
                              label={`Use project default${
                                projectDefaultQueueName
                                  ? ` (${projectDefaultQueueName})`
                                  : ''
                              }`}
                              className={`${classes.queueChip} ${
                                !form.queue.trim() || form.queue === projectDefaultQueue
                                  ? classes.queueChipSelected
                                  : ''
                              }`.trim()}
                            />
                          )}
                        </div>
                      </>
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
                      <span className={classes.reviewValue}>{queueDisplayName}</span>
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
