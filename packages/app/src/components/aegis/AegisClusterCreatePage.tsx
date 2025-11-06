import { useEffect, useMemo, useState } from 'react';
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
import HourglassEmptyIcon from '@material-ui/icons/HourglassEmpty';
import ErrorOutlineIcon from '@material-ui/icons/ErrorOutline';
import ReplayIcon from '@material-ui/icons/Replay';
import LaunchIcon from '@material-ui/icons/Launch';
import {
  Content,
  ContentHeader,
  InfoCard,
  Page,
  Progress,
} from '@backstage/core-components';
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

type Persona = 'platform-admin' | 'cluster-creator' | 'ml-engineer';

type ProfileCard = {
  id: string;
  name: string;
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
    id: 'eks-gpu-train',
    name: 'Atlas GPU Training',
    description: 'EKS based GPU-accelerated cluster with hardened posture.',
    ilLevel: 'IL-5',
    fedramp: 'High',
    gpu: 'NVIDIA H100',
    cost: 124.8,
    useCase: 'Deep learning training & fine-tuning',
    baseline: 320,
  },
  {
    id: 'eks-general',
    name: 'Sentinel General Purpose',
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
    roleVisibility: ['platform-admin', 'cluster-creator'],
  },
  {
    path: 'region',
    title: 'Region',
    type: 'string',
    enum: ['us-gov-west-1', 'us-gov-east-1'],
    description: 'Must stay within approved compliance boundary.',
    required: true,
    roleVisibility: ['platform-admin', 'cluster-creator'],
  },
  {
    path: 'gpu.count',
    title: 'GPU Count',
    type: 'number',
    min: 0,
    max: 16,
    defaultValue: 4,
    description: 'Number of GPUs per node pool.',
    required: true,
    roleVisibility: ['platform-admin', 'cluster-creator'],
  },
  {
    path: 'gpu.type',
    title: 'GPU Type',
    type: 'string',
    enum: ['H100', 'A100', 'None'],
    defaultValue: 'H100',
    roleVisibility: ['platform-admin'],
    description: 'Platform may lock this for IL-5 workloads.',
  },
  {
    path: 'k8s.version',
    title: 'Kubernetes Version',
    type: 'string',
    enum: ['1.27', '1.28', '1.29'],
    defaultValue: '1.28',
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

export const AegisClusterCreatePage = () => {
  const classes = useStyles();
  const [tab, setTab] = useState(0);
  const [persona, setPersona] = useState<Persona>('cluster-creator');
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
  const [timeline, setTimeline] = useState<TimelineStep[]>([]);
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
    `name: atlas-train-govcloud\nprofileRef: atlas-gpu-train@1.4.0\nregion: us-gov-west-1\nparameters:\n  gpu:\n    count: 4\n    type: H100\n  nodePool:\n    spotAllowed: false\n`);
  const [yamlError, setYamlError] = useState<string | null>(null);
  const [planOutput, setPlanOutput] = useState<string>('');
  const [importMethod, setImportMethod] = useState<'arn' | 'kubeconfig'>('arn');
  const [attachVerified, setAttachVerified] = useState(false);

  const selectedProfile = useMemo(
    () => profileCards.find(card => card.id === activeProfileId) ?? null,
    [activeProfileId],
  );

  const personaLabel = useMemo(() => {
    switch (persona) {
      case 'platform-admin':
        return 'Platform Admin';
      case 'cluster-creator':
        return 'Cluster Creator';
      case 'ml-engineer':
        return 'ML / AI Engineer';
      default:
        return 'User';
    }
  }, [persona]);

  useEffect(() => {
    if (!isLaunching) {
      return;
    }

    const steps: TimelineStep[] = [
      { id: 'spec-accepted', label: 'Spec accepted', status: 'running' },
      { id: 'plan', label: 'Plan', status: 'pending' },
      { id: 'apply', label: 'Apply', status: 'pending' },
      {
        id: 'kubeconfig',
        label: 'Kubeconfig sync',
        status: 'pending',
      },
      {
        id: 'registration',
        label: 'Registration with Aegis',
        status: 'pending',
      },
    ];
    setTimeline(steps);

    const timeouts: NodeJS.Timeout[] = [];
    steps.forEach((step, index) => {
      const timeout = setTimeout(() => {
        setTimeline(current =>
          current.map(item => {
            if (item.id === step.id) {
              return { ...item, status: 'done' };
            }
            if (current[index + 1] && item.id === current[index + 1].id) {
              return { ...item, status: 'running' };
            }
            return item;
          }),
        );
      }, (index + 1) * 1800);
      timeouts.push(timeout);
    });

    const finish = setTimeout(() => {
      setIsLaunching(false);
    }, (steps.length + 1) * 1800);
    timeouts.push(finish);

    return () => {
      timeouts.forEach(clearTimeout);
    };
  }, [isLaunching]);

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

  const handleLaunch = () => {
    setIsLaunching(true);
  };

  const attachCommand =
    'curl -fsSL https://aegis.run/install-agent | sudo PROFILE=atlas-gpu bash -s -- --verify-hash';

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
            <Typography variant="h6">Select a published profile</Typography>
            <FormControl component="fieldset">
              <FormHelperText>Persona preview</FormHelperText>
              <RadioGroup
                row
                value={persona}
                onChange={event => setPersona(event.target.value as Persona)}
              >
                <FormControlLabel
                  value="platform-admin"
                  control={<Radio color="primary" />}
                  label="Platform Admin"
                />
                <FormControlLabel
                  value="cluster-creator"
                  control={<Radio color="primary" />}
                  label="Cluster Creator"
                />
                <FormControlLabel
                  value="ml-engineer"
                  control={<Radio color="primary" />}
                  label="ML/AI Engineer"
                />
              </RadioGroup>
            </FormControl>
          </Box>
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
            <Chip label={`Persona: ${personaLabel}`} color="primary" />
          </Box>
          <Typography variant="body2" color="textSecondary" paragraph>
            These inputs are generated from the profile JSONSchema. Disabled fields are
            hidden or locked for your role.
          </Typography>
          <div className={classes.formGrid}>
            {renderedParameters.map(field => {
              const value = formState[field.path] ?? '';
              const disabled =
                persona === 'ml-engineer' ||
                (field.roleVisibility && !field.roleVisibility.includes(persona));

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
                {renderedParameters.map(field => (
                  <div key={field.path}>
                    <strong>{field.title}:</strong> {String(formState[field.path] ?? '—')}
                  </div>
                ))}
              </Typography>
            </InfoCard>
            <InfoCard title="IaC payload" subheader="Generated inputs">
              <Typography
                variant="body2"
                component="pre"
                style={{
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'Source Code Pro, monospace',
                }}
              >
                {`profileRef: ${selectedProfile.id}@1.4.0\nregion: ${formState['region']}\nparameters:\n  gpu:\n    count: ${formState['gpu.count'] ?? '—'}\n    type: ${formState['gpu.type'] ?? 'H100'}\n  nodePool:\n    spotAllowed: ${Boolean(formState['nodePool.spotAllowed'])}\n`}
              </Typography>
            </InfoCard>
          </div>
          <Box display="flex" style={{ gap: 8 }}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleLaunch}
              startIcon={<LaunchIcon />}
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

          <div className={classes.timelineBox}>
            <Typography variant="h6" gutterBottom>
              Provisioning timeline
            </Typography>
            {isLaunching ? (
              <Progress />
            ) : (
              <Box display="grid" style={{ gap: 16 }}>
                {timeline.map(step => (
                  <Paper key={step.id} className={classes.helperCard} variant="outlined">
                    <Box display="flex" alignItems="center" justifyContent="space-between">
                      <Box
                        display="flex"
                        alignItems="center"
                        style={{ gap: 12 }}
                      >
                        {step.status === 'done' && <DoneIcon color="primary" />}
                        {step.status === 'running' && <HourglassEmptyIcon color="action" />}
                        {step.status === 'pending' && <ReplayIcon color="disabled" />}
                        <Typography variant="subtitle1">{step.label}</Typography>
                      </Box>
                      <Chip
                        size="small"
                        color={
                          step.status === 'done'
                            ? 'primary'
                            : step.status === 'running'
                            ? 'default'
                            : 'secondary'
                        }
                        label={step.status}
                      />
                    </Box>
                  </Paper>
                ))}
              </Box>
            )}
          </div>
        </Box>
      )}

      <Box mt={3} display="flex" justifyContent="space-between">
        <Button
          disabled={fromProfileStep === 0}
          onClick={() => setFromProfileStep(step => Math.max(0, step - 1))}
        >
          Back
        </Button>
        <Button
          color="primary"
          variant="contained"
          disabled={
            (fromProfileStep === 0 && !activeProfileId) ||
            (fromProfileStep === 1 && persona === 'ml-engineer')
          }
          onClick={() =>
            setFromProfileStep(step =>
              Math.min(2, step + (step === 2 ? 0 : 1)),
            )
          }
        >
          {fromProfileStep === 2 ? 'Ready' : 'Continue'}
        </Button>
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

  const renderImportExisting = () => (
    <Box mt={2}>
      <Typography variant="h6">Attach an existing cluster</Typography>
      <Typography variant="body2" color="textSecondary" paragraph>
        Install the Aegis agent to stream posture, compliance, and cost telemetry. We
        support role-based access via AssumeRole or short-lived kubeconfig uploads.
      </Typography>
      <RadioGroup
        row
        value={importMethod}
        onChange={event => setImportMethod(event.target.value as 'arn' | 'kubeconfig')}
      >
        <FormControlLabel
          value="arn"
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

      <Paper className={classes.helperCard} variant="outlined">
        <Typography variant="subtitle2">Attach command</Typography>
        <Typography component="pre" className={classes.terminal}>
          {attachCommand}
        </Typography>
        <FormControlLabel
          control={
            <Switch
              checked={attachVerified}
              onChange={event => setAttachVerified(event.target.checked)}
              color="primary"
            />
          }
          label="Agent hash verified"
        />
      </Paper>

      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>Posture & compliance scan</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box width="100%">
            <Typography variant="body2" color="textSecondary">
              Baseline profile: atlas-gpu-train@1.3.1 · Drift detected in networking policy and
              GPU driver version.
            </Typography>
            <Box mt={2}>
              <Paper variant="outlined" className={classes.helperCard}>
                <Typography variant="subtitle1">Compliance deltas</Typography>
                <Typography variant="body2" color="textSecondary">
                  • FedRAMP High control AC-6: Privileged session logging not enabled.\n                  • IL-5 boundary: Flow logs disabled in VPC.
                </Typography>
              </Paper>
            </Box>
            <Box mt={2}>
              <Typography variant="subtitle1">Labels to apply</Typography>
              <div className={classes.formGrid}>
                <TextField label="profileRef" value="atlas-gpu-train@1.3.1" />
                <TextField label="imported" value="true" />
                <TextField label="compliance" value="IL-5" />
              </div>
            </Box>
          </Box>
        </AccordionDetails>
      </Accordion>
    </Box>
  );

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
