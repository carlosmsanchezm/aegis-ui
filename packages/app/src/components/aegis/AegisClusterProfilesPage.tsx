import { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormHelperText,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Step,
  StepLabel,
  Stepper,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  makeStyles,
} from '@material-ui/core';
import AddIcon from '@material-ui/icons/Add';
import FileCopyIcon from '@material-ui/icons/FileCopy';
import PublishIcon from '@material-ui/icons/Publish';
import GetAppIcon from '@material-ui/icons/GetApp';
import VerifiedUserIcon from '@material-ui/icons/VerifiedUser';
import LayersIcon from '@material-ui/icons/Layers';
import { Page, Content, ContentHeader, InfoCard } from '@backstage/core-components';

const primitiveToString = (value: unknown): string => {
  if (value === null || value === undefined) {
    return 'null';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
};

const toYaml = (value: unknown, indent = 0): string => {
  const pad = '  '.repeat(indent);
  if (Array.isArray(value)) {
    return value
      .map(item => {
        if (typeof item === 'object' && item !== null) {
          const nested = toYaml(item, indent + 1);
          return `${pad}-\n${nested}`;
        }
        return `${pad}- ${primitiveToString(item)}`;
      })
      .join('\n');
  }
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, val]) => {
        if (typeof val === 'object' && val !== null) {
          const nested = toYaml(val, indent + 1);
          return `${pad}${key}:\n${nested}`;
        }
        return `${pad}${key}: ${primitiveToString(val)}`;
      })
      .join('\n');
  }
  return `${pad}${primitiveToString(value)}`;
};

type ProfileStatus = 'Draft' | 'Published' | 'Deprecated';

type Profile = {
  name: string;
  version: string;
  provider: string;
  ilLevel: 'IL-4' | 'IL-5';
  fedramp: 'Moderate' | 'High';
  gpuSupport: boolean;
  params: number;
  cost: number;
  status: ProfileStatus;
  lastUpdated: string;
};

const profiles: Profile[] = [
  {
    name: 'atlas-gpu-train',
    version: '1.4.0',
    provider: 'AWS EKS',
    ilLevel: 'IL-5',
    fedramp: 'High',
    gpuSupport: true,
    params: 7,
    cost: 320,
    status: 'Published',
    lastUpdated: '3 days ago',
  },
  {
    name: 'sentinel-general',
    version: '2.1.1',
    provider: 'AWS EKS',
    ilLevel: 'IL-4',
    fedramp: 'Moderate',
    gpuSupport: false,
    params: 5,
    cost: 180,
    status: 'Published',
    lastUpdated: '6 days ago',
  },
  {
    name: 'atlas-secure',
    version: '3.0.0',
    provider: 'AWS EKS',
    ilLevel: 'IL-5',
    fedramp: 'High',
    gpuSupport: true,
    params: 8,
    cost: 360,
    status: 'Draft',
    lastUpdated: 'Today',
  },
];

type ParameterDefinition = {
  name: string;
  type: 'string' | 'number' | 'boolean';
  description: string;
  visibility: ('platform-admin' | 'cluster-creator')[];
  required: boolean;
  defaultValue: string | number | boolean;
  constraint?: string;
};

const defaultParameters: ParameterDefinition[] = [
  {
    name: 'project',
    type: 'string',
    description: 'Target mission project (auto-filled via RBAC).',
    visibility: ['platform-admin', 'cluster-creator'],
    required: true,
    defaultValue: 'project-aurora',
  },
  {
    name: 'gpu.count',
    type: 'number',
    description: 'GPUs per node pool (0-8).',
    visibility: ['platform-admin', 'cluster-creator'],
    required: true,
    defaultValue: 4,
    constraint: 'min:0, max:8',
  },
  {
    name: 'nodePool.spotAllowed',
    type: 'boolean',
    description: 'Permit burst capacity via spot.',
    visibility: ['platform-admin'],
    required: false,
    defaultValue: false,
  },
];

const useStyles = makeStyles(theme => ({
  layout: {
    paddingBottom: theme.spacing(6),
  },
  tableCard: {
    padding: theme.spacing(3),
  },
  badgeRow: {
    display: 'flex',
    gap: theme.spacing(1),
  },
  schemaCard: {
    padding: theme.spacing(3),
    display: 'grid',
    gap: theme.spacing(1.5),
  },
  codeBlock: {
    whiteSpace: 'pre-wrap',
    fontFamily: 'Source Code Pro, monospace',
    background: theme.palette.type === 'dark' ? '#0B1120' : '#F8FAFC',
    borderRadius: theme.shape.borderRadius * 2,
    padding: theme.spacing(2.5),
    border: `1px solid ${theme.palette.divider}`,
  },
  parameterList: {
    display: 'grid',
    gap: theme.spacing(1.25),
  },
  tabContent: {
    marginTop: theme.spacing(3),
    display: 'grid',
    gap: theme.spacing(3),
  },
}));

type WizardState = {
  name: string;
  description: string;
  provider: string;
  ilLevel: 'IL-4' | 'IL-5';
  fedramp: 'Moderate' | 'High';
  projects: string[];
  topology: {
    cpuNodePools: number;
    gpuNodePools: number;
    k8sVersion: string;
    vpc: string;
  };
  addons: {
    aegisAgent: boolean;
    gatekeeper: boolean;
    podSecurity: 'baseline' | 'restricted';
    auditLog: boolean;
  };
  parameters: ParameterDefinition[];
};

const initialWizardState: WizardState = {
  name: 'atlas-gpu-train',
  description: 'GPU-accelerated EKS with IL-5 guardrails and FedRAMP High attestation.',
  provider: 'AWS EKS',
  ilLevel: 'IL-5',
  fedramp: 'High',
  projects: ['Project Aurora', 'Atlas'],
  topology: {
    cpuNodePools: 2,
    gpuNodePools: 2,
    k8sVersion: '1.28',
    vpc: 'vpc-aurora-gov',
  },
  addons: {
    aegisAgent: true,
    gatekeeper: true,
    podSecurity: 'restricted',
    auditLog: true,
  },
  parameters: defaultParameters,
};

const steps = ['Basics', 'Topology defaults', 'Add-ons & guardrails', 'Parameterization', 'Review'];

export const AegisClusterProfilesPage = () => {
  const classes = useStyles();
  const [editorOpen, setEditorOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [state, setState] = useState(initialWizardState);
  const [policyPacks, setPolicyPacks] = useState<string[]>(['FedRAMP-High', 'IL5-core']);

  const renderedSpec = useMemo(() => {
    const spec = {
      apiVersion: 'aegis/v1alpha1',
      kind: 'ClusterProfile',
      metadata: {
        name: state.name,
        annotations: {
          'aegis.ai/il-level': state.ilLevel,
          'aegis.ai/fedramp': state.fedramp,
        },
      },
      spec: {
        description: state.description,
        provider: state.provider,
        projects: state.projects,
        topology: state.topology,
        addons: state.addons,
        policyPacks,
        parameters: state.parameters.map(param => ({
          name: param.name,
          type: param.type,
          default: param.defaultValue,
          required: param.required,
          visibility: param.visibility,
          description: param.description,
        })),
      },
    };
    return toYaml(spec);
  }, [state, policyPacks]);

  const resetEditor = () => {
    setStep(0);
    setState(initialWizardState);
    setPolicyPacks(['FedRAMP-High', 'IL5-core']);
  };

  const handleParameterToggle = (index: number, key: keyof ParameterDefinition) => {
    setState(prev => {
      const params = [...prev.parameters];
      const param = { ...params[index] };
      if (key === 'required' && typeof param.required === 'boolean') {
        param.required = !param.required;
      }
      if (key === 'defaultValue') {
        param.defaultValue = param.type === 'boolean' ? !param.defaultValue : param.defaultValue;
      }
      params[index] = param;
      return { ...prev, parameters: params };
    });
  };

  const diffPreview = `- policyPacks: [FedRAMP-Moderate]\n+ policyPacks: [FedRAMP-High, IL5-core]\n- addons.podSecurity: baseline\n+ addons.podSecurity: restricted\n`;

  return (
    <Page themeId="admin">
      <Content className={classes.layout}>
        <ContentHeader title="Cluster profiles">
          <Chip label="Productized IaC" color="primary" />
          <Chip label="Guardrails" variant="outlined" />
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={() => {
              resetEditor();
              setEditorOpen(true);
            }}
          >
            New profile
          </Button>
        </ContentHeader>

        <Paper className={classes.tableCard} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Version</TableCell>
                <TableCell>Provider</TableCell>
                <TableCell>IL level</TableCell>
                <TableCell>FedRAMP</TableCell>
                <TableCell>GPU</TableCell>
                <TableCell>Params</TableCell>
                <TableCell>Cost $/hr</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Last updated</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {profiles.map(profile => (
                <TableRow key={profile.name} hover>
                  <TableCell>
                    <Typography variant="subtitle1">{profile.name}</Typography>
                    <Typography variant="caption" color="textSecondary">
                      Blueprint for {profile.provider}
                    </Typography>
                  </TableCell>
                  <TableCell>{profile.version}</TableCell>
                  <TableCell>{profile.provider}</TableCell>
                  <TableCell>
                    <Chip label={profile.ilLevel} color="primary" size="small" />
                  </TableCell>
                  <TableCell>
                    <Chip label={profile.fedramp} size="small" />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={profile.gpuSupport ? 'GPU ready' : 'CPU only'}
                      color={profile.gpuSupport ? 'primary' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{profile.params}</TableCell>
                  <TableCell>${profile.cost}</TableCell>
                  <TableCell>
                    <Chip
                      label={profile.status}
                      color={profile.status === 'Published' ? 'primary' : 'default'}
                    />
                  </TableCell>
                  <TableCell>{profile.lastUpdated}</TableCell>
                  <TableCell align="right">
                    <Button size="small" startIcon={<FileCopyIcon />}>Duplicate</Button>
                    <Button size="small" startIcon={<PublishIcon />}>Publish</Button>
                    <Button size="small" startIcon={<GetAppIcon />}>Export</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>

        <Box
          display="grid"
          gridTemplateColumns="repeat(auto-fit, minmax(280px, 1fr))"
          style={{ gap: 16 }}
        >
          <InfoCard title="RBAC targeting" subheader="Projects & groups">
            <Typography variant="body2">Published profiles scoped to:</Typography>
            <ul>
              <li>Project Aurora (Platform, Cluster creators)</li>
              <li>Atlas – GPU training squad</li>
            </ul>
          </InfoCard>
          <InfoCard title="Compliance mapping" subheader="Policy packs">
            <Typography variant="body2">FedRAMP High · IL-5 core controls enforced.</Typography>
            <div className={classes.badgeRow}>
              <Chip icon={<VerifiedUserIcon />} label="NIST 800-53" color="primary" />
              <Chip icon={<LayersIcon />} label="Policy pack v12" variant="outlined" />
            </div>
          </InfoCard>
        </Box>

        <Dialog open={editorOpen} onClose={() => setEditorOpen(false)} maxWidth="lg" fullWidth>
          <DialogTitle>Profile editor</DialogTitle>
          <DialogContent dividers>
            <Stepper activeStep={step} alternativeLabel>
              {steps.map(label => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>

            {step === 0 && (
              <Box className={classes.tabContent}>
                <TextField
                  label="Name"
                  value={state.name}
                  onChange={event => setState(prev => ({ ...prev, name: event.target.value }))}
                />
                <TextField
                  label="Description"
                  multiline
                  minRows={3}
                  value={state.description}
                  onChange={event =>
                    setState(prev => ({ ...prev, description: event.target.value }))
                  }
                />
                <FormControl>
                  <InputLabel>Provider</InputLabel>
                  <Select
                    value={state.provider}
                    onChange={event =>
                      setState(prev => ({ ...prev, provider: event.target.value as string }))
                    }
                  >
                    <MenuItem value="AWS EKS">AWS / EKS</MenuItem>
                    <MenuItem value="Azure AKS">Azure / AKS</MenuItem>
                  </Select>
                </FormControl>
                <FormControl>
                  <InputLabel>IL level</InputLabel>
                  <Select
                    value={state.ilLevel}
                    onChange={event =>
                      setState(prev => ({ ...prev, ilLevel: event.target.value as 'IL-4' | 'IL-5' }))
                    }
                  >
                    <MenuItem value="IL-4">IL-4</MenuItem>
                    <MenuItem value="IL-5">IL-5</MenuItem>
                  </Select>
                </FormControl>
                <FormControl>
                  <InputLabel>FedRAMP</InputLabel>
                  <Select
                    value={state.fedramp}
                    onChange={event =>
                      setState(prev => ({
                        ...prev,
                        fedramp: event.target.value as 'Moderate' | 'High',
                      }))
                    }
                  >
                    <MenuItem value="Moderate">Moderate</MenuItem>
                    <MenuItem value="High">High</MenuItem>
                  </Select>
                </FormControl>
              </Box>
            )}

            {step === 1 && (
              <Box className={classes.tabContent}>
                <TextField
                  label="CPU node pools"
                  type="number"
                  value={state.topology.cpuNodePools}
                  onChange={event =>
                    setState(prev => ({
                      ...prev,
                      topology: {
                        ...prev.topology,
                        cpuNodePools: Number(event.target.value),
                      },
                    }))
                  }
                />
                <TextField
                  label="GPU node pools"
                  type="number"
                  value={state.topology.gpuNodePools}
                  onChange={event =>
                    setState(prev => ({
                      ...prev,
                      topology: {
                        ...prev.topology,
                        gpuNodePools: Number(event.target.value),
                      },
                    }))
                  }
                />
                <FormControl>
                  <InputLabel>Kubernetes version</InputLabel>
                  <Select
                    value={state.topology.k8sVersion}
                    onChange={event =>
                      setState(prev => ({
                        ...prev,
                        topology: {
                          ...prev.topology,
                          k8sVersion: event.target.value as string,
                        },
                      }))
                    }
                  >
                    <MenuItem value="1.27">1.27</MenuItem>
                    <MenuItem value="1.28">1.28</MenuItem>
                    <MenuItem value="1.29">1.29</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  label="VPC"
                  value={state.topology.vpc}
                  onChange={event =>
                    setState(prev => ({
                      ...prev,
                      topology: { ...prev.topology, vpc: event.target.value },
                    }))
                  }
                />
              </Box>
            )}

            {step === 2 && (
              <Box className={classes.tabContent}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={state.addons.aegisAgent}
                      onChange={event =>
                        setState(prev => ({
                          ...prev,
                          addons: { ...prev.addons, aegisAgent: event.target.checked },
                        }))
                      }
                      color="primary"
                    />
                  }
                  label="Install Aegis agent"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={state.addons.gatekeeper}
                      onChange={event =>
                        setState(prev => ({
                          ...prev,
                          addons: { ...prev.addons, gatekeeper: event.target.checked },
                        }))
                      }
                      color="primary"
                    />
                  }
                  label="Gatekeeper policy pack"
                />
                <FormControl>
                  <InputLabel>Pod security standard</InputLabel>
                  <Select
                    value={state.addons.podSecurity}
                    onChange={event =>
                      setState(prev => ({
                        ...prev,
                        addons: {
                          ...prev.addons,
                          podSecurity: event.target.value as 'baseline' | 'restricted',
                        },
                      }))
                    }
                  >
                    <MenuItem value="baseline">Baseline</MenuItem>
                    <MenuItem value="restricted">Restricted</MenuItem>
                  </Select>
                </FormControl>
                <FormControlLabel
                  control={
                    <Switch
                      checked={state.addons.auditLog}
                      onChange={event =>
                        setState(prev => ({
                          ...prev,
                          addons: { ...prev.addons, auditLog: event.target.checked },
                        }))
                      }
                      color="primary"
                    />
                  }
                  label="Enable audit & flow logs"
                />
                <FormControl>
                  <InputLabel>Policy packs</InputLabel>
                  <Select
                    multiple
                    value={policyPacks}
                    onChange={event => setPolicyPacks(event.target.value as string[])}
                    renderValue={selected => (selected as string[]).join(', ')}
                  >
                    <MenuItem value="FedRAMP-High">FedRAMP High</MenuItem>
                    <MenuItem value="FedRAMP-Moderate">FedRAMP Moderate</MenuItem>
                    <MenuItem value="IL5-core">IL5 Core Controls</MenuItem>
                    <MenuItem value="ZeroTrust">Zero-trust extensions</MenuItem>
                  </Select>
                  <FormHelperText>Maps profile to compliance guardrails.</FormHelperText>
                </FormControl>
              </Box>
            )}

            {step === 3 && (
              <Box className={classes.schemaCard}>
                <Typography variant="subtitle1">Allowed parameters</Typography>
                <div className={classes.parameterList}>
                  {state.parameters.map((param, index) => (
                    <Paper key={param.name} variant="outlined" className={classes.schemaCard}>
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Typography variant="subtitle1">{param.name}</Typography>
                        <Chip label={param.type} size="small" />
                      </Box>
                      <Typography variant="body2" color="textSecondary">
                        {param.description}
                      </Typography>
                      <Typography variant="caption">
                        Visibility: {param.visibility.join(', ')}
                      </Typography>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={param.required}
                            onChange={() => handleParameterToggle(index, 'required')}
                            color="primary"
                          />
                        }
                        label="Required"
                      />
                      <FormControlLabel
                        control={
                          <Switch
                            checked={Boolean(param.defaultValue)}
                            onChange={() => handleParameterToggle(index, 'defaultValue')}
                            color="primary"
                          />
                        }
                        label={`Default: ${String(param.defaultValue)}`}
                      />
                      {param.constraint && (
                        <Typography variant="caption" color="textSecondary">
                          Constraint: {param.constraint}
                        </Typography>
                      )}
                    </Paper>
                  ))}
                </div>
              </Box>
            )}

            {step === 4 && (
              <Box className={classes.tabContent}>
                <InfoCard title="Rendered spec" subheader="YAML preview">
                  <pre className={classes.codeBlock}>{renderedSpec}</pre>
                </InfoCard>
                <InfoCard title="Diff vs previous" subheader="Pending publication">
                  <pre className={classes.codeBlock}>{diffPreview}</pre>
                </InfoCard>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditorOpen(false)}>Cancel</Button>
            <Button
              onClick={() => setStep(prev => Math.max(0, prev - 1))}
              disabled={step === 0}
            >
              Back
            </Button>
            <Button
              color="primary"
              variant="contained"
              onClick={() => {
                if (step === steps.length - 1) {
                  setEditorOpen(false);
                } else {
                  setStep(prev => prev + 1);
                }
              }}
            >
              {step === steps.length - 1 ? 'Publish' : 'Continue'}
            </Button>
          </DialogActions>
        </Dialog>
      </Content>
    </Page>
  );
};

export default AegisClusterProfilesPage;
