import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
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
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import CloudQueueIcon from '@material-ui/icons/CloudQueue';
import StorageIcon from '@material-ui/icons/Storage';
import GitHubIcon from '@material-ui/icons/GitHub';
import PublishIcon from '@material-ui/icons/Publish';
import DescriptionIcon from '@material-ui/icons/Description';
import GetAppIcon from '@material-ui/icons/GetApp';
import PlaylistAddCheckIcon from '@material-ui/icons/PlaylistAddCheck';
import { Content, ContentHeader, Page, Progress, WarningPanel, CodeSnippet } from '@backstage/core-components';
import {
  ClusterProfile,
  ClusterProfileParameter,
  ClusterTimelineEvent,
} from './types/clusters';

const useStyles = makeStyles(theme => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(4),
    paddingBottom: theme.spacing(6),
  },
  tabPanel: {
    marginTop: theme.spacing(2),
  },
  profileGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: theme.spacing(2.5),
  },
  profileCard: {
    borderRadius: theme.shape.borderRadius * 2,
    border: `1px solid ${theme.palette.divider}`,
    transition: theme.transitions.create(['border-color', 'box-shadow']),
    '&.selected': {
      borderColor: theme.palette.primary.main,
      boxShadow: `${theme.palette.primary.main}40 0px 0px 0px 2px`,
    },
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: theme.spacing(2),
  },
  readinessList: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    marginTop: theme.spacing(2),
  },
  timeline: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
    marginTop: theme.spacing(2),
  },
  timelineItem: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
  },
  yamlPreview: {
    fontFamily: 'var(--aegis-font-mono, "Source Code Pro", monospace)',
    background:
      theme.palette.type === 'dark'
        ? 'rgba(15, 23, 42, 0.8)'
        : 'rgba(241, 245, 249, 0.9)',
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    padding: theme.spacing(2),
    maxHeight: 320,
    overflow: 'auto',
  },
  cardActions: {
    justifyContent: 'space-between',
  },
  costSummary: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(2),
    marginTop: theme.spacing(2),
  },
  chipGroup: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    marginTop: theme.spacing(1.5),
  },
  buttonRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1.5),
    marginTop: theme.spacing(2),
  },
  gitForm: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: theme.spacing(2),
  },
  importGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: theme.spacing(2),
  },
}));

type ParameterValues = Record<string, string | number | boolean | null>;

const baseProfile: ClusterProfile = {
  id: 'il5-hardened',
  name: 'IL5 – GovCloud Hardened',
  description: 'Mission-ready blueprint with IL5 controls and GPU node pools.',
    version: '2.3.1',
    provider: 'aws-eks',
    ilLevel: 'IL-5',
    fedramp: 'High',
    gpuSupport: true,
    parameterCount: 6,
    costBaselinePerHour: 58.4,
    status: 'Published',
    lastUpdated: '2024-05-17T12:35:00Z',
    policyPackIds: ['il5-baseline', 'fedramp-high'],
    complianceBoundary: 'AWS GovCloud (US-East)',
    projects: ['Project Aurora'],
    groups: ['Mission Platform'],
    topologyDefaults: {
      controlPlaneVersion: '1.28',
      nodePools: [
        {
          id: 'cpu',
          name: 'CPU control plane',
          instanceType: 'm6i.4xlarge',
          minSize: 3,
          maxSize: 12,
          perNodeHourlyCost: 1.24,
        },
        {
          id: 'gpu',
          name: 'GPU training',
          instanceType: 'p5.48xlarge',
          gpu: 'NVIDIA H100',
          minSize: 0,
          maxSize: 8,
          perNodeHourlyCost: 32.5,
        },
      ],
      networking: {
        vpcId: 'vpc-0fedbeef',
        subnets: ['subnet-a', 'subnet-b', 'subnet-c'],
      },
      storageClasses: ['gp3-encrypted', 'fsx-lustre'],
      irsaEnabled: true,
      autoscalerEnabled: true,
    },
    addons: ['aegis-agent', 'opa-gatekeeper', 'fsx-csi', 'flow-logs'],
    guardrails: ['pss-restricted', 'audit-logs', 'fips-endpoints'],
    parameters: [
      {
        key: 'projectId',
        title: 'Project',
        description: 'Project workspace that owns the cluster.',
        type: 'enum',
        enum: ['Project Aurora', 'Project Atlas'],
        default: 'Project Aurora',
        required: true,
        visibility: ['platform-admin', 'cluster-creator'],
        editableBy: ['platform-admin', 'cluster-creator'],
      },
      {
        key: 'region',
        title: 'Region',
        type: 'enum',
        enum: ['us-gov-east-1', 'us-gov-west-1'],
        default: 'us-gov-east-1',
        required: true,
        visibility: ['platform-admin', 'cluster-creator'],
      },
      {
        key: 'gpu.count',
        title: 'GPU node count',
        description: 'Requested number of GPU worker nodes.',
        type: 'integer',
        default: 4,
        minimum: 0,
        maximum: 8,
        required: true,
        visibility: ['platform-admin', 'cluster-creator'],
        featured: true,
      },
      {
        key: 'gpu.enableSpot',
        title: 'Enable spot capacity',
        type: 'boolean',
        default: false,
        visibility: ['platform-admin'],
      },
      {
        key: 'k8s.version',
        title: 'Kubernetes version',
        type: 'enum',
        enum: ['1.27', '1.28', '1.29'],
        default: '1.28',
        required: true,
        visibility: ['platform-admin', 'cluster-creator', 'auditor'],
      },
      {
        key: 'addons.dcgmon',
        title: 'Enable DCGM telemetry',
        type: 'boolean',
        default: true,
        visibility: ['platform-admin', 'cluster-creator'],
      },
    ],
};

const profileSeed: ClusterProfile[] = [
  baseProfile,
  {
    ...baseProfile,
    id: 'il4-exploration',
    name: 'IL4 – Exploration',
    description: 'Lightweight IL4 profile with spot-enabled GPU pools.',
    version: '1.4.0',
    ilLevel: 'IL-4',
    fedramp: 'Moderate',
    costBaselinePerHour: 18.7,
    parameterCount: 4,
    policyPackIds: ['il4-baseline'],
    complianceBoundary: 'AWS Commercial',
    projects: ['Project Borealis'],
    groups: ['Experimentation'],
    addons: ['aegis-agent', 'gpu-operator'],
    guardrails: ['pss-baseline', 'audit-logs'],
  },
];

const profileCostEstimate = (profile: ClusterProfile, values: ParameterValues) => {
  let cost = profile.costBaselinePerHour;
  const gpuCount = Number(values['gpu.count'] ?? profile.parameters.find(p => p.key === 'gpu.count')?.default ?? 0);
  const baselineGpu = Number(profile.parameters.find(p => p.key === 'gpu.count')?.default ?? gpuCount);
  cost += Math.max(0, gpuCount - baselineGpu) * 32.5;
  if (values['gpu.enableSpot']) {
    cost *= 0.82;
  }
  return Number(cost.toFixed(2));
};

const parameterDefaultValues = (profile: ClusterProfile) =>
  profile.parameters.reduce<ParameterValues>((acc, param) => {
    acc[param.key] = param.default ?? null;
    return acc;
  }, {});

const readinessFromParameters = (
  profile: ClusterProfile | null,
  values: ParameterValues,
): string[] => {
  if (!profile) {
    return ['Select a cluster profile'];
  }
  const issues: string[] = [];
  profile.parameters.forEach(param => {
    const value = values[param.key];
    if (param.required && (value === null || value === undefined || value === '')) {
      issues.push(`${param.title} is required.`);
    }
    if (
      param.type === 'integer' ||
      param.type === 'number'
    ) {
      const numeric = Number(value);
      if (param.minimum !== undefined && numeric < param.minimum) {
        issues.push(`${param.title} must be ≥ ${param.minimum}`);
      }
      if (param.maximum !== undefined && numeric > param.maximum) {
        issues.push(`${param.title} must be ≤ ${param.maximum}`);
      }
    }
  });
  return issues;
};

const renderParameterField = (
  param: ClusterProfileParameter,
  value: string | number | boolean | null,
  onChange: (next: string | number | boolean) => void,
) => {
  switch (param.type) {
    case 'enum':
      return (
        <TextField
          select
          label={param.title}
          variant="outlined"
          value={value ?? ''}
          onChange={event => onChange(event.target.value)}
          helperText={param.description}
        >
          {(param.enum ?? []).map(option => (
            <MenuItem key={option} value={option}>
              {option}
            </MenuItem>
          ))}
        </TextField>
      );
    case 'boolean':
      return (
        <FormControlLabel
          control={
            <Switch
              color="primary"
              checked={Boolean(value)}
              onChange={event => onChange(event.target.checked)}
            />
          }
          label={param.title}
        />
      );
    case 'integer':
    case 'number':
      return (
        <TextField
          type="number"
          label={param.title}
          variant="outlined"
          value={value ?? ''}
          onChange={event => onChange(Number(event.target.value))}
          helperText={param.description}
        />
      );
    default:
      return (
        <TextField
          label={param.title}
          variant="outlined"
          value={value ?? ''}
          onChange={event => onChange(event.target.value)}
          helperText={param.description}
        />
      );
  }
};

const baseTimeline: ClusterTimelineEvent[] = [
  { id: 'submitted', label: 'Spec accepted', status: 'success' },
  { id: 'plan', label: 'Plan running', status: 'running' },
  { id: 'apply', label: 'Apply running', status: 'pending' },
  { id: 'register', label: 'Registration', status: 'pending' },
];

export const CreateClusterPage = () => {
  const classes = useStyles();
  const [tab, setTab] = useState(0);
  const [step, setStep] = useState(0);
  const [selectedProfile, setSelectedProfile] = useState<ClusterProfile | null>(profileSeed[0]);
  const [values, setValues] = useState<ParameterValues>(parameterDefaultValues(profileSeed[0]));
  const [readiness, setReadiness] = useState<string[]>(readinessFromParameters(profileSeed[0], values));
  const [showSpec, setShowSpec] = useState(false);
  const [timeline, setTimeline] = useState<ClusterTimelineEvent[]>(baseTimeline);
  const [launching, setLaunching] = useState(false);
  const [planResult, setPlanResult] = useState<string | null>(null);
  const [gitForm, setGitForm] = useState({
    repository: 'https://github.com/aegis/infra.git',
    branch: 'main',
    path: 'clusters/aurora/eks.yaml',
    engine: 'pulumi',
    mode: 'plan-apply',
    requireApproval: true,
  });
  const [importMethod, setImportMethod] = useState<'assume-role' | 'kubeconfig'>('assume-role');
  const [importLabels, setImportLabels] = useState('profileRef=il5-hardened@2.3.1, compliance=IL-5');

  useEffect(() => {
    setReadiness(readinessFromParameters(selectedProfile, values));
  }, [selectedProfile, values]);

  const costEstimate = useMemo(() => {
    if (!selectedProfile) {
      return 0;
    }
    return profileCostEstimate(selectedProfile, values);
  }, [selectedProfile, values]);

  const handleProfileSelect = (profile: ClusterProfile) => {
    setSelectedProfile(profile);
    const defaults = parameterDefaultValues(profile);
    setValues(defaults);
    setStep(1);
  };

  const handleValueChange = (key: string, newValue: string | number | boolean) => {
    setValues(prev => ({ ...prev, [key]: newValue }));
  };

  const handleLaunch = () => {
    setLaunching(true);
    setTimeline([
      { id: 'submitted', label: 'Spec accepted', status: 'success' },
      { id: 'plan', label: 'Plan running', status: 'running' },
      { id: 'apply', label: 'Apply running', status: 'pending' },
      { id: 'register', label: 'Registration', status: 'pending' },
    ]);
    const events: Array<[number, Partial<ClusterTimelineEvent>]> = [
      [1500, { id: 'plan', label: 'Plan complete', status: 'success' }],
      [3000, { id: 'apply', label: 'Apply running', status: 'running' }],
      [5200, { id: 'apply', label: 'Apply complete', status: 'success' }],
      [6400, { id: 'register', label: 'Kubeconfig synced', status: 'success' }],
    ];
    events.forEach(([delay, update]) => {
      setTimeout(() => {
        setTimeline(prev => prev.map(item => (item.id === update.id ? { ...item, ...update } : item)));
      }, delay);
    });
    setTimeout(() => setLaunching(false), 6800);
  };

  const renderedSpec = useMemo(() => {
    if (!selectedProfile) {
      return '';
    }
    const spec = {
      apiVersion: 'aegis/v1alpha1',
      kind: 'ClusterRequest',
      metadata: {
        name: `${values['projectId'] ?? 'project'}-${selectedProfile.id}`,
      },
      spec: {
        profile: {
          id: selectedProfile.id,
          version: selectedProfile.version,
        },
        parameters: values,
      },
    };
    return JSON.stringify(spec, null, 2);
  }, [selectedProfile, values]);

  return (
    <Page themeId="tool">
      <Content className={classes.root}>
        <ContentHeader title="Create cluster">
          <Chip icon={<CloudQueueIcon />} label="Declarative + click" color="primary" />
          <Chip icon={<StorageIcon />} label="IaC driven" variant="outlined" />
        </ContentHeader>

        <Tabs value={tab} onChange={(_, value) => setTab(value)} indicatorColor="primary">
          <Tab label="From profile" />
          <Tab label="Declarative (Git)" />
          <Tab label="Import existing" />
        </Tabs>

        {tab === 0 && (
          <div className={classes.tabPanel}>
            <Stepper activeStep={step} alternativeLabel>
              {['Select profile', 'Parameters', 'Review & launch'].map(label => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>

            {step === 0 && (
              <div className={classes.profileGrid}>
                {profileSeed.map(profile => (
                  <Card
                    key={profile.id}
                    className={`${classes.profileCard} ${selectedProfile?.id === profile.id ? 'selected' : ''}`.trim()}
                  >
                    <CardContent>
                      <Typography variant="h6">{profile.name}</Typography>
                      <Typography variant="body2" color="textSecondary">
                        {profile.description}
                      </Typography>
                      <div className={classes.chipGroup}>
                        <Chip label={profile.ilLevel} size="small" color="primary" />
                        <Chip label={`FedRAMP ${profile.fedramp}`} size="small" />
                        <Chip label={`$${profile.costBaselinePerHour.toFixed(2)}/hr`} size="small" />
                        {profile.gpuSupport && <Chip label="GPU" size="small" color="secondary" />}
                      </div>
                    </CardContent>
                    <CardActions className={classes.cardActions}>
                      <Button color="primary" onClick={() => handleProfileSelect(profile)}>
                        Use profile
                      </Button>
                      <Button size="small" startIcon={<DescriptionIcon />} onClick={() => setShowSpec(true)}>
                        View spec
                      </Button>
                    </CardActions>
                  </Card>
                ))}
              </div>
            )}

            {step === 1 && selectedProfile && (
              <>
                <div className={classes.formGrid}>
                  {selectedProfile.parameters.map(param => (
                    <div key={param.key}>
                      {renderParameterField(param, values[param.key], newValue =>
                        handleValueChange(param.key, newValue),
                      )}
                    </div>
                  ))}
                </div>
                <div className={classes.costSummary}>
                  <Chip label={`Cost estimate: $${costEstimate}/hr`} color="primary" />
                  <Chip label={`Readiness: ${readiness.length ? 'Issues' : 'Ready'}`} color={readiness.length ? 'secondary' : 'primary'} />
                </div>
                {readiness.length ? (
                  <div className={classes.readinessList}>
                    {readiness.map(issue => (
                      <WarningPanel severity="warning" title="Readiness check" key={issue}>
                        {issue}
                      </WarningPanel>
                    ))}
                  </div>
                ) : null}
                <div className={classes.buttonRow}>
                  <Button variant="outlined" onClick={() => setStep(0)}>
                    Back
                  </Button>
                  <Button
                    color="primary"
                    variant="contained"
                    onClick={() => setStep(2)}
                    disabled={Boolean(readiness.length)}
                  >
                    Continue
                  </Button>
                </div>
              </>
            )}

            {step === 2 && selectedProfile && (
              <>
                <Typography variant="h6">Review summary</Typography>
                <Typography variant="body2" color="textSecondary">
                  Project: {values['projectId'] as string} · Region: {values['region'] as string}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Profile {selectedProfile.name}@{selectedProfile.version}
                </Typography>
                <div className={classes.costSummary}>
                  <Chip label={`Cost estimate $${costEstimate}/hr`} color="primary" />
                  <Chip label={`${selectedProfile.policyPackIds.join(', ')}`} variant="outlined" />
                </div>
                <pre className={classes.yamlPreview}>{renderedSpec}</pre>
                <div className={classes.buttonRow}>
                  <Button variant="outlined" onClick={() => setStep(1)}>
                    Back
                  </Button>
                  <Button startIcon={<GetAppIcon />} variant="outlined">
                    Export spec
                  </Button>
                  <Button startIcon={<GitHubIcon />} variant="outlined">
                    Open as PR
                  </Button>
                  <Button
                    startIcon={<PublishIcon />}
                    variant="contained"
                    color="primary"
                    onClick={handleLaunch}
                    disabled={launching}
                  >
                    Launch
                  </Button>
                </div>
                <div className={classes.timeline}>
                  {timeline.map(item => (
                    <div key={item.id} className={classes.timelineItem}>
                      <PlaylistAddCheckIcon color={item.status === 'success' ? 'primary' : item.status === 'running' ? 'action' : 'disabled'} />
                      <div>
                        <Typography variant="body2">{item.label}</Typography>
                        {item.timestamp && (
                          <Typography variant="caption" color="textSecondary">
                            {new Date(item.timestamp).toLocaleString()}
                          </Typography>
                        )}
                      </div>
                    </div>
                  ))}
                  {launching && <Progress />}
                </div>
              </>
            )}
          </div>
        )}

        {tab === 1 && (
          <div className={classes.tabPanel}>
            <Typography variant="h6">Git-backed IaC run</Typography>
            <Typography variant="body2" color="textSecondary">
              Connect repositories that hold Pulumi/Terraform/GitOps specs. Aegis orchestrator will
              trigger plan/apply jobs and surface the timeline here.
            </Typography>
            <div className={classes.gitForm}>
              <TextField
                label="Repository"
                variant="outlined"
                value={gitForm.repository}
                onChange={event => setGitForm(prev => ({ ...prev, repository: event.target.value }))}
              />
              <TextField
                label="Branch"
                variant="outlined"
                value={gitForm.branch}
                onChange={event => setGitForm(prev => ({ ...prev, branch: event.target.value }))}
              />
              <TextField
                label="Path"
                variant="outlined"
                value={gitForm.path}
                onChange={event => setGitForm(prev => ({ ...prev, path: event.target.value }))}
              />
              <FormControl variant="outlined">
                <InputLabel id="engine-select-label">Engine</InputLabel>
                <Select
                  labelId="engine-select-label"
                  label="Engine"
                  value={gitForm.engine}
                  onChange={event => setGitForm(prev => ({ ...prev, engine: event.target.value as string }))}
                >
                  <MenuItem value="pulumi">Pulumi</MenuItem>
                  <MenuItem value="terraform">Terraform</MenuItem>
                  <MenuItem value="gitops">GitOps</MenuItem>
                </Select>
              </FormControl>
              <FormControl variant="outlined">
                <InputLabel id="mode-select-label">Execution mode</InputLabel>
                <Select
                  labelId="mode-select-label"
                  label="Execution mode"
                  value={gitForm.mode}
                  onChange={event => setGitForm(prev => ({ ...prev, mode: event.target.value as string }))}
                >
                  <MenuItem value="plan-only">Plan only</MenuItem>
                  <MenuItem value="plan-apply">Plan + Apply</MenuItem>
                </Select>
              </FormControl>
              <FormControlLabel
                control={
                  <Switch
                    checked={gitForm.requireApproval}
                    onChange={event =>
                      setGitForm(prev => ({ ...prev, requireApproval: event.target.checked }))
                    }
                    color="primary"
                  />
                }
                label="Require approval before apply"
              />
            </div>
            <div className={classes.buttonRow}>
              <Button
                color="primary"
                variant="contained"
                onClick={() =>
                  setPlanResult(
                    `Plan summary\n• Engine: ${gitForm.engine}\n• Targets: ${gitForm.path}\n• Mode: ${gitForm.mode}\n• Approvals required: ${gitForm.requireApproval}`,
                  )
                }
              >
                Validate & plan
              </Button>
              <Button variant="outlined">Save run configuration</Button>
            </div>
            {planResult && (
              <Box marginTop={2}>
                <CodeSnippet text={planResult} language="text" showCopyButton />
              </Box>
            )}
          </div>
        )}

        {tab === 2 && (
          <div className={classes.tabPanel}>
            <Typography variant="h6">Import existing cluster</Typography>
            <Typography variant="body2" color="textSecondary">
              Attach an already running Kubernetes cluster to Aegis. An attach script installs the
              agent and triggers an initial posture scan to highlight drift vs a chosen profile.
            </Typography>
            <RadioGroup
              row
              value={importMethod}
              onChange={event => setImportMethod(event.target.value as typeof importMethod)}
            >
              <FormControlLabel value="assume-role" control={<Radio color="primary" />} label="AWS AssumeRole" />
              <FormControlLabel value="kubeconfig" control={<Radio color="primary" />} label="Upload kubeconfig" />
            </RadioGroup>
            <div className={classes.importGrid}>
              {importMethod === 'assume-role' ? (
                <TextField label="Role ARN" variant="outlined" fullWidth placeholder="arn:aws-us-gov:iam::123456789:role/AegisAttach" />
              ) : (
                <TextField label="Kubeconfig" variant="outlined" multiline minRows={4} placeholder="Paste sanitized kubeconfig..." />
              )}
              <TextField
                label="Labels"
                variant="outlined"
                value={importLabels}
                onChange={event => setImportLabels(event.target.value)}
                helperText="Use key=value pairs, comma separated"
              />
            </div>
            <Box marginTop={2}>
              <Typography variant="subtitle1">Attach script</Typography>
              <CodeSnippet
                language="bash"
                text={`curl -fsSL https://aegis.example.com/install-agent.sh | bash -s -- --cluster legacy-a100 --token <short-lived> --sha256 <hash>`}
                showCopyButton
              />
            </Box>
            <Box marginTop={2}>
              <Typography variant="subtitle1">Posture scan preview</Typography>
              <WarningPanel severity="info" title="Compliance deltas">
                • Security groups differ from profile il5-hardened (ingress widened) <br />• Add-on
                DCGM missing – recommended for GPU telemetry
              </WarningPanel>
              <WarningPanel severity="warning" title="Drift detected">
                {`Profile drift identified. Choose "Reconcile" or "Accept drift" after import.`}
              </WarningPanel>
            </Box>
            <div className={classes.buttonRow}>
              <Button color="primary" variant="contained">
                Register cluster
              </Button>
              <Button variant="outlined">Download agent manifest</Button>
            </div>
          </div>
        )}
      </Content>

      <Dialog open={showSpec && Boolean(selectedProfile)} onClose={() => setShowSpec(false)} maxWidth="md" fullWidth>
        <DialogTitle>{selectedProfile?.name}</DialogTitle>
        <DialogContent dividers>
          <CodeSnippet language="json" text={renderedSpec} showCopyButton />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSpec(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Page>
  );
};

