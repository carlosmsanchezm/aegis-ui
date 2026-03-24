import { useCallback, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  MenuItem,
  Paper,
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
  Tooltip,
  Typography,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import AddIcon from '@material-ui/icons/Add';
import CloseIcon from '@material-ui/icons/Close';
import FileCopyIcon from '@material-ui/icons/FileCopy';
import PublishIcon from '@material-ui/icons/Publish';
import {
  Content,
  ContentHeader,
  Page,
  WarningPanel,
} from '@backstage/core-components';
import {
  AegisRole,
  ClusterProfile,
  ClusterProfileParameter,
  ClusterProfileStatus,
  ComplianceLevel,
  FedrampLevel,
} from '../types/clusters';

const useStyles = makeStyles(theme => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(4),
    paddingBottom: theme.spacing(6),
  },
  tablePaper: {
    borderRadius: theme.shape.borderRadius * 2,
    border: '1px solid var(--aegis-card-border, rgba(148, 163, 184, 0.18))',
    boxShadow: 'var(--aegis-card-shadow, rgba(15, 23, 42, 0.12) 0px 18px 32px -18px)',
    overflow: 'hidden',
  },
  tableToolbar: {
    display: 'flex',
    alignItems: 'center',
    padding: theme.spacing(2),
    gap: theme.spacing(2),
  },
  actionsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(2),
    alignItems: 'center',
  },
  wizardContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(3),
    minHeight: 460,
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  },
  pillGroup: {
    display: 'flex',
    gap: theme.spacing(1),
    flexWrap: 'wrap',
  },
  paramGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: theme.spacing(2),
  },
  paramRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  },
  codeBlock: {
    fontFamily: 'var(--aegis-font-mono, "Source Code Pro", monospace)',
    background:
      theme.palette.type === 'dark'
        ? 'rgba(15, 23, 42, 0.8)'
        : 'rgba(241, 245, 249, 0.9)',
    padding: theme.spacing(2),
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${theme.palette.divider}`,
    overflow: 'auto',
    maxHeight: 280,
  },
  stickyStepper: {
    position: 'sticky',
    top: 0,
    backgroundColor: theme.palette.background.paper,
    zIndex: 2,
    paddingBottom: theme.spacing(2),
  },
}));

type ProfileDraft = ClusterProfile & { isNew?: boolean };

const emptyDraft = (): ProfileDraft => ({
  id: 'draft-profile',
  isNew: true,
  name: '',
  description: '',
  version: '0.1.0',
  provider: 'aws-eks',
  ilLevel: 'IL-5',
  fedramp: 'High',
  gpuSupport: true,
  parameterCount: 0,
  costBaselinePerHour: 42,
  status: 'Draft',
  lastUpdated: new Date().toISOString(),
  policyPackIds: ['il5-baseline'],
  complianceBoundary: 'AWS GovCloud (US-East)',
  projects: [],
  groups: [],
  topologyDefaults: {
    controlPlaneVersion: '1.34',
    nodePools: [
      {
        id: 'cpu-standard',
        name: 'Control & CPU',
        instanceType: 'm6i.4xlarge',
        minSize: 3,
        maxSize: 30,
        perNodeHourlyCost: 1.2,
      },
    ],
    networking: {
      vpcId: '',
      subnets: ['subnet-a', 'subnet-b', 'subnet-c'],
    },
    storageClasses: ['gp3-encrypted', 'fsx-lustre'],
    irsaEnabled: true,
    autoscalerEnabled: true,
  },
  addons: ['aegis-agent', 'opa-gatekeeper'],
  guardrails: ['pss-restricted', 'audit-logs'],
    parameters: [
      {
        key: 'gpu.count',
        title: 'GPU node count',
        description: 'Requested number of GPU worker nodes',
      type: 'integer',
      default: 4,
      minimum: 0,
      maximum: 32,
      required: true,
      visibility: ['platform-admin', 'cluster-creator'],
      editableBy: ['platform-admin', 'cluster-creator'],
      featured: true,
    },
      {
        key: 'k8s.version',
        title: 'Kubernetes version',
        type: 'enum',
        enum: ['1.34', '1.33', '1.32', '1.31', '1.30', '1.29'],
        default: '1.34',
        required: true,
        visibility: ['platform-admin', 'cluster-creator', 'auditor'],
        editableBy: ['platform-admin'],
      },
    ],
});

type ValidationErrors = {
  name?: string;
  vpcId?: string;
  nodePools?: Record<number, string>;
};

const PROFILE_NAME_PATTERN = /^[a-zA-Z0-9-]+$/;
const VPC_ID_PATTERN = /^vpc-[a-z0-9]+$/;

const validateDraft = (profile: ProfileDraft): ValidationErrors => {
  const errors: ValidationErrors = {};

  if (!profile.name || profile.name.trim().length === 0) {
    errors.name = 'Profile name is required';
  } else if (profile.name.trim().length < 3) {
    errors.name = 'Profile name must be at least 3 characters';
  } else if (!PROFILE_NAME_PATTERN.test(profile.name.trim())) {
    errors.name = 'Profile name must contain only letters, numbers, and hyphens';
  }

  const vpcId = profile.topologyDefaults.networking.vpcId;
  if (vpcId && vpcId.trim().length > 0 && !VPC_ID_PATTERN.test(vpcId.trim())) {
    errors.vpcId = 'VPC ID must match pattern vpc-[a-z0-9]+ (e.g. vpc-abc123)';
  }

  const nodePoolErrors: Record<number, string> = {};
  profile.topologyDefaults.nodePools.forEach((pool, index) => {
    if (pool.minSize > pool.maxSize) {
      nodePoolErrors[index] = `Min nodes (${pool.minSize}) must be less than or equal to max nodes (${pool.maxSize})`;
    }
  });
  if (Object.keys(nodePoolErrors).length > 0) {
    errors.nodePools = nodePoolErrors;
  }

  return errors;
};

const hasValidationErrors = (errors: ValidationErrors): boolean => {
  return Boolean(errors.name || errors.vpcId || (errors.nodePools && Object.keys(errors.nodePools).length > 0));
};

/** No backend endpoint for cluster profiles yet - initialize with empty data. */
const initialProfiles: ClusterProfile[] = [];

const statusColor = (status: ClusterProfileStatus): 'default' | 'primary' | 'secondary' => {
  if (status === 'Published') {
    return 'primary';
  }
  if (status === 'Deprecated') {
    return 'secondary';
  }
  return 'default';
};

const roleLabel: Record<AegisRole, string> = {
  'platform-admin': 'Platform Admin',
  'platform-engineer': 'Platform Engineer',
  'cluster-creator': 'Cluster Creator',
  'ml-engineer': 'ML/DS Engineer',
  auditor: 'Auditor',
};

const complianceLabel: Record<ComplianceLevel, string> = {
  'IL-4': 'Impact Level 4',
  'IL-5': 'Impact Level 5',
  'IL-6': 'Impact Level 6',
};

const fedrampLabel: Record<FedrampLevel, string> = {
  Moderate: 'FedRAMP Moderate',
  High: 'FedRAMP High',
};

export const ClusterProfilesAdminPage = () => {
  const classes = useStyles();
  const [profiles, _setProfiles] = useState(initialProfiles);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<ProfileDraft | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});

  const filteredProfiles = useMemo(() => {
    if (!search) {
      return profiles;
    }
    const needle = search.toLowerCase();
    return profiles.filter(profile =>
      [
        profile.name,
        profile.provider,
        profile.ilLevel,
        profile.fedramp,
        profile.status,
      ]
        .map(value => value.toLowerCase())
        .some(value => value.includes(needle)),
    );
  }, [profiles, search]);

  const handleOpenDraft = (profile?: ClusterProfile) => {
    setDraft(profile ? { ...profile, isNew: false } : emptyDraft());
    setActiveStep(0);
    setValidationErrors({});
  };

  const handleCloseDraft = () => {
    setDraft(null);
    setActiveStep(0);
    setValidationErrors({});
  };

  const validateCurrentStep = useCallback((): boolean => {
    if (!draft) return true;
    const errors = validateDraft(draft);
    setValidationErrors(errors);

    if (activeStep === 0 && errors.name) {
      return false;
    }
    if (activeStep === 1 && (errors.vpcId || (errors.nodePools && Object.keys(errors.nodePools).length > 0))) {
      return false;
    }
    return true;
  }, [draft, activeStep]);

  const handleDraftChange = <K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) => {
    setDraft(prev => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleParameterChange = (index: number, patch: Partial<ClusterProfileParameter>) => {
    if (!draft) {
      return;
    }
    const nextParameters = draft.parameters.map((param, idx) =>
      idx === index ? { ...param, ...patch } : param,
    );
    setDraft({ ...draft, parameters: nextParameters, parameterCount: nextParameters.length });
  };

  const handleAddParameter = () => {
    if (!draft) {
      return;
    }
    const newParam: ClusterProfileParameter = {
      key: `param_${draft.parameters.length + 1}`,
      title: 'New parameter',
      type: 'string',
      default: '',
      visibility: ['platform-admin', 'platform-engineer'],
      required: false,
    };
    const parameters = [...draft.parameters, newParam];
    setDraft({ ...draft, parameters, parameterCount: parameters.length });
  };

  const handleRemoveParameter = (index: number) => {
    if (!draft) {
      return;
    }
    const parameters = draft.parameters.filter((_, idx) => idx !== index);
    setDraft({ ...draft, parameters, parameterCount: parameters.length });
  };

  /** Publish is disabled until the cluster profiles API is available. */
  const handlePublish = () => {
    if (!draft) return;
    const errors = validateDraft(draft);
    setValidationErrors(errors);
    if (hasValidationErrors(errors)) {
      return;
    }
    // API not yet connected - no-op
  };

  const renderedSpec = useMemo(() => {
    if (!draft) {
      return '';
    }
    const { isNew, ...rest } = draft;
    return JSON.stringify(rest, null, 2);
  }, [draft]);

  return (
    <Page themeId="tool">
      <Content className={classes.root}>
        <ContentHeader title="Cluster Profiles">
          <Chip label="Platform-only" color="secondary" variant="outlined" />
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDraft()}
          >
            New profile
          </Button>
        </ContentHeader>

        <Paper className={classes.tablePaper}>
          <div className={classes.tableToolbar}>
            <TextField
              label="Search profiles"
              variant="outlined"
              value={search}
              onChange={event => setSearch(event.target.value)}
              fullWidth
            />
          </div>
          <Divider />
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Version</TableCell>
                <TableCell>Provider</TableCell>
                <TableCell>IL level</TableCell>
                <TableCell>FedRAMP</TableCell>
                <TableCell>GPU support</TableCell>
                <TableCell>Params</TableCell>
                <TableCell>Cost baseline $/hr</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Last updated</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredProfiles.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11} align="center">
                    <Box py={6}>
                      <Typography variant="h6" color="textSecondary">
                        No cluster profiles available
                      </Typography>
                      <Typography variant="body2" color="textSecondary" style={{ marginTop: 8 }}>
                        Cluster profiles will be manageable once the profile API is available.
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              )}
              {filteredProfiles.map(profile => (
                <TableRow key={profile.id} hover>
                  <TableCell>
                    <Typography variant="subtitle1">{profile.name}</Typography>
                    <Typography variant="body2" color="textSecondary">
                      {profile.description}
                    </Typography>
                  </TableCell>
                  <TableCell>{profile.version}</TableCell>
                  <TableCell>{profile.provider.toUpperCase()}</TableCell>
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
                  <TableCell>{profile.parameterCount}</TableCell>
                  <TableCell>${profile.costBaselinePerHour.toFixed(2)}</TableCell>
                  <TableCell>
                    <Chip
                      label={profile.status}
                      color={statusColor(profile.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {new Date(profile.lastUpdated).toLocaleString()}
                  </TableCell>
                  <TableCell align="right">
                    <div className={classes.actionsRow}>
                      <Button size="small" onClick={() => handleOpenDraft(profile)}>
                        Edit
                      </Button>
                      <Tooltip title="API not yet connected">
                        <span>
                          <Button size="small" startIcon={<FileCopyIcon />} disabled>
                            Duplicate
                          </Button>
                        </span>
                      </Tooltip>
                      <Tooltip title="API not yet connected">
                        <span>
                          <Button size="small" startIcon={<PublishIcon />} disabled>
                            Publish
                          </Button>
                        </span>
                      </Tooltip>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>

        <WarningPanel severity="info" title="API integration pending">
          The cluster profiles API (<code>/v1/cluster-profiles</code>) is not yet available in the
          backend. Profile creation and publishing will be enabled once the API endpoint is deployed.
          The form editor above can be used to preview the profile schema.
        </WarningPanel>
      </Content>

      <Dialog open={Boolean(draft)} onClose={handleCloseDraft} maxWidth="md" fullWidth>
        {draft ? (
          <>
            <DialogTitle disableTypography>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <div>
                  <Typography variant="h6">{draft.isNew ? 'New profile' : 'Edit profile'}</Typography>
                  <Typography variant="body2" color="textSecondary">
                    Govern compliant IaC blueprints and publish to projects.
                  </Typography>
                </div>
                <IconButton onClick={handleCloseDraft} aria-label="Close">
                  <CloseIcon />
                </IconButton>
              </Box>
              <div className={classes.stickyStepper}>
                <Stepper activeStep={activeStep} alternativeLabel>
                  {['Basics', 'Topology defaults', 'Add-ons & guardrails', 'Parameters', 'Review'].map(
                    label => (
                      <Step key={label}>
                        <StepLabel>{label}</StepLabel>
                      </Step>
                    ),
                  )}
                </Stepper>
              </div>
            </DialogTitle>
            <DialogContent dividers>
              <div className={classes.wizardContent}>
                {activeStep === 0 && (
                  <div className={classes.section}>
                    <TextField
                      label="Name"
                      value={draft.name}
                      onChange={event => {
                        handleDraftChange('name', event.target.value);
                        if (validationErrors.name) {
                          setValidationErrors(prev => ({ ...prev, name: undefined }));
                        }
                      }}
                      variant="outlined"
                      fullWidth
                      required
                      error={Boolean(validationErrors.name)}
                      helperText={validationErrors.name || 'Alphanumeric and hyphens only, min 3 characters'}
                    />
                    <TextField
                      label="Description"
                      value={draft.description}
                      onChange={event => handleDraftChange('description', event.target.value)}
                      variant="outlined"
                      fullWidth
                      multiline
                      minRows={3}
                    />
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          label="Provider"
                          select
                          variant="outlined"
                          fullWidth
                          value={draft.provider}
                          onChange={event =>
                            handleDraftChange('provider', event.target.value as ProfileDraft['provider'])
                          }
                        >
                          <MenuItem value="aws-eks">AWS EKS</MenuItem>
                          <MenuItem value="azure-aks">Azure AKS</MenuItem>
                          <MenuItem value="gcp-gke">GCP GKE</MenuItem>
                        </TextField>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          label="Compliance boundary"
                          value={draft.complianceBoundary}
                          variant="outlined"
                          fullWidth
                          onChange={event =>
                            handleDraftChange('complianceBoundary', event.target.value)
                          }
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          label="Impact level"
                          select
                          variant="outlined"
                          fullWidth
                          value={draft.ilLevel}
                          onChange={event =>
                            handleDraftChange('ilLevel', event.target.value as ComplianceLevel)
                          }
                        >
                          {(['IL-4', 'IL-5', 'IL-6'] as ComplianceLevel[]).map(level => (
                            <MenuItem key={level} value={level}>
                              {complianceLabel[level]}
                            </MenuItem>
                          ))}
                        </TextField>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          label="FedRAMP level"
                          select
                          variant="outlined"
                          fullWidth
                          value={draft.fedramp}
                          onChange={event =>
                            handleDraftChange('fedramp', event.target.value as FedrampLevel)
                          }
                        >
                          {(['Moderate', 'High'] as FedrampLevel[]).map(level => (
                            <MenuItem key={level} value={level}>
                              {fedrampLabel[level]}
                            </MenuItem>
                          ))}
                        </TextField>
                      </Grid>
                    </Grid>
                    <TextField
                      label="Projects (comma separated)"
                      variant="outlined"
                      fullWidth
                      value={draft.projects.join(', ')}
                      onChange={event =>
                        handleDraftChange(
                          'projects',
                          event.target.value
                            .split(',')
                            .map(item => item.trim())
                            .filter(Boolean),
                        )
                      }
                      helperText="Projects allowed to consume this profile"
                    />
                    <TextField
                      label="Groups (comma separated)"
                      variant="outlined"
                      fullWidth
                      value={draft.groups.join(', ')}
                      onChange={event =>
                        handleDraftChange(
                          'groups',
                          event.target.value
                            .split(',')
                            .map(item => item.trim())
                            .filter(Boolean),
                        )
                      }
                      helperText="Group scoping for RBAC targeting"
                    />
                  </div>
                )}

                {activeStep === 1 && (
                  <div className={classes.section}>
                    <Typography variant="h6">Networking</Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          label="VPC ID"
                          variant="outlined"
                          fullWidth
                          value={draft.topologyDefaults.networking.vpcId}
                          onChange={event => {
                            handleDraftChange('topologyDefaults', {
                              ...draft.topologyDefaults,
                              networking: {
                                ...draft.topologyDefaults.networking,
                                vpcId: event.target.value,
                              },
                            });
                            if (validationErrors.vpcId) {
                              setValidationErrors(prev => ({ ...prev, vpcId: undefined }));
                            }
                          }}
                          error={Boolean(validationErrors.vpcId)}
                          helperText={validationErrors.vpcId || 'Pre-approved VPC for control plane and node groups (e.g. vpc-abc123).'}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          label="Subnet IDs (comma separated)"
                          variant="outlined"
                          fullWidth
                          value={draft.topologyDefaults.networking.subnets.join(', ')}
                          onChange={event =>
                            handleDraftChange('topologyDefaults', {
                              ...draft.topologyDefaults,
                              networking: {
                                ...draft.topologyDefaults.networking,
                                subnets: event.target.value
                                  .split(',')
                                  .map(item => item.trim())
                                  .filter(Boolean),
                              },
                            })
                          }
                          helperText="Leave blank to fall back to the default VPC (unsupported AZs auto-filtered)."
                        />
                      </Grid>
                    </Grid>
                    <Typography variant="h6" style={{ marginTop: 16 }}>
                      Node pools
                    </Typography>
                    {draft.topologyDefaults.nodePools.map((pool, index) => (
                      <Paper key={pool.id} variant="outlined" style={{ padding: 16 }}>
                        <Grid container spacing={2}>
                          <Grid item xs={12} sm={6}>
                            <TextField
                              label="Name"
                              variant="outlined"
                              value={pool.name}
                              fullWidth
                              onChange={event => {
                                const nodePools = draft.topologyDefaults.nodePools.map((np, idx) =>
                                  idx === index ? { ...np, name: event.target.value } : np,
                                );
                                handleDraftChange('topologyDefaults', {
                                  ...draft.topologyDefaults,
                                  nodePools,
                                });
                              }}
                            />
                          </Grid>
                          <Grid item xs={12} sm={6}>
                            <TextField
                              label="Instance type"
                              variant="outlined"
                              value={pool.instanceType}
                              fullWidth
                              onChange={event => {
                                const nodePools = draft.topologyDefaults.nodePools.map((np, idx) =>
                                  idx === index ? { ...np, instanceType: event.target.value } : np,
                                );
                                handleDraftChange('topologyDefaults', {
                                  ...draft.topologyDefaults,
                                  nodePools,
                                });
                              }}
                            />
                          </Grid>
                          <Grid item xs={12} sm={4}>
                            <TextField
                              label="Min nodes"
                              type="number"
                              variant="outlined"
                              value={pool.minSize}
                              fullWidth
                              error={Boolean(validationErrors.nodePools?.[index])}
                              helperText={validationErrors.nodePools?.[index]}
                              inputProps={{ min: 0 }}
                              onChange={event => {
                                const nodePools = draft.topologyDefaults.nodePools.map((np, idx) =>
                                  idx === index
                                    ? { ...np, minSize: Number(event.target.value) || 0 }
                                    : np,
                                );
                                handleDraftChange('topologyDefaults', {
                                  ...draft.topologyDefaults,
                                  nodePools,
                                });
                                if (validationErrors.nodePools?.[index]) {
                                  setValidationErrors(prev => {
                                    const next = { ...prev };
                                    if (next.nodePools) {
                                      const { [index]: _, ...rest } = next.nodePools;
                                      next.nodePools = Object.keys(rest).length > 0 ? rest : undefined;
                                    }
                                    return next;
                                  });
                                }
                              }}
                            />
                          </Grid>
                          <Grid item xs={12} sm={4}>
                            <TextField
                              label="Max nodes"
                              type="number"
                              variant="outlined"
                              value={pool.maxSize}
                              fullWidth
                              error={Boolean(validationErrors.nodePools?.[index])}
                              inputProps={{ min: 0 }}
                              onChange={event => {
                                const nodePools = draft.topologyDefaults.nodePools.map((np, idx) =>
                                  idx === index
                                    ? { ...np, maxSize: Number(event.target.value) || 0 }
                                    : np,
                                );
                                handleDraftChange('topologyDefaults', {
                                  ...draft.topologyDefaults,
                                  nodePools,
                                });
                                if (validationErrors.nodePools?.[index]) {
                                  setValidationErrors(prev => {
                                    const next = { ...prev };
                                    if (next.nodePools) {
                                      const { [index]: _, ...rest } = next.nodePools;
                                      next.nodePools = Object.keys(rest).length > 0 ? rest : undefined;
                                    }
                                    return next;
                                  });
                                }
                              }}
                            />
                          </Grid>
                          <Grid item xs={12} sm={4}>
                            <TextField
                              label="Per-node $/hr"
                              type="number"
                              variant="outlined"
                              value={pool.perNodeHourlyCost}
                              fullWidth
                              onChange={event => {
                                const nodePools = draft.topologyDefaults.nodePools.map((np, idx) =>
                                  idx === index
                                    ? {
                                        ...np,
                                        perNodeHourlyCost: Number(event.target.value) || 0,
                                      }
                                    : np,
                                );
                                handleDraftChange('topologyDefaults', {
                                  ...draft.topologyDefaults,
                                  nodePools,
                                });
                              }}
                            />
                          </Grid>
                        </Grid>
                      </Paper>
                    ))}
                    <Button startIcon={<AddIcon />} onClick={() => {
                      const nodePools = [
                        ...draft.topologyDefaults.nodePools,
                        {
                          id: `pool-${draft.topologyDefaults.nodePools.length + 1}`,
                          name: 'New node pool',
                          instanceType: 'm6i.large',
                          minSize: 0,
                          maxSize: 10,
                          perNodeHourlyCost: 0.5,
                        },
                      ];
                      handleDraftChange('topologyDefaults', {
                        ...draft.topologyDefaults,
                        nodePools,
                      });
                    }}>
                      Add node pool
                    </Button>
                  </div>
                )}

                {activeStep === 2 && (
                  <div className={classes.section}>
                    <TextField
                      label="Add-ons (comma separated)"
                      variant="outlined"
                      fullWidth
                      value={draft.addons.join(', ')}
                      onChange={event =>
                        handleDraftChange(
                          'addons',
                          event.target.value
                            .split(',')
                            .map(value => value.trim())
                            .filter(Boolean),
                        )
                      }
                    />
                    <TextField
                      label="Guardrails & policies"
                      variant="outlined"
                      fullWidth
                      value={draft.guardrails.join(', ')}
                      onChange={event =>
                        handleDraftChange(
                          'guardrails',
                          event.target.value
                            .split(',')
                            .map(value => value.trim())
                            .filter(Boolean),
                        )
                      }
                    />
                    <TextField
                      label="Policy packs"
                      variant="outlined"
                      fullWidth
                      value={draft.policyPackIds.join(', ')}
                      onChange={event =>
                        handleDraftChange(
                          'policyPackIds',
                          event.target.value
                            .split(',')
                            .map(value => value.trim())
                            .filter(Boolean),
                        )
                      }
                    />
                    <Typography variant="body2" color="textSecondary">
                      Selecting policy packs links controls to IL/FedRAMP evidence automation.
                    </Typography>
                  </div>
                )}

                {activeStep === 3 && (
                  <div className={classes.section}>
                    <div className={classes.paramGrid}>
                      {draft.parameters.map((param, index) => (
                        <Paper key={param.key} variant="outlined" style={{ padding: 16 }}>
                          <div className={classes.paramRow}>
                            <TextField
                              label="Key"
                              variant="outlined"
                              value={param.key}
                              onChange={event =>
                                handleParameterChange(index, { key: event.target.value })
                              }
                            />
                            <TextField
                              label="Title"
                              variant="outlined"
                              value={param.title}
                              onChange={event =>
                                handleParameterChange(index, { title: event.target.value })
                              }
                            />
                            <TextField
                              label="Description"
                              variant="outlined"
                              value={param.description ?? ''}
                              multiline
                              minRows={2}
                              onChange={event =>
                                handleParameterChange(index, {
                                  description: event.target.value,
                                })
                              }
                            />
                            <TextField
                              label="Control type"
                              select
                              variant="outlined"
                              value={param.type}
                              onChange={event =>
                                handleParameterChange(index, {
                                  type: event.target.value as ClusterProfileParameter['type'],
                                })
                              }
                            >
                              {['string', 'integer', 'number', 'boolean', 'enum'].map(type => (
                                <MenuItem key={type} value={type}>
                                  {type}
                                </MenuItem>
                              ))}
                            </TextField>
                            {param.type === 'enum' ? (
                              <TextField
                                label="Enum values (comma separated)"
                                variant="outlined"
                                value={(param.enum ?? []).join(', ')}
                                onChange={event =>
                                  handleParameterChange(index, {
                                    enum: event.target.value
                                      .split(',')
                                      .map(value => value.trim())
                                      .filter(Boolean),
                                  })
                                }
                              />
                            ) : (
                              <TextField
                                label="Default"
                                variant="outlined"
                                value={String(param.default ?? '')}
                                onChange={event =>
                                  handleParameterChange(index, {
                                    default:
                                      param.type === 'integer' || param.type === 'number'
                                        ? Number(event.target.value)
                                        : param.type === 'boolean'
                                        ? event.target.value === 'true'
                                        : event.target.value,
                                  })
                                }
                              />
                            )}
                            <div>
                              <Typography variant="caption" color="textSecondary">
                                Visibility
                              </Typography>
                              <div className={classes.pillGroup}>
                                {(['platform-admin', 'platform-engineer', 'cluster-creator', 'ml-engineer', 'auditor'] as AegisRole[]).map(
                                  role => (
                                    <Chip
                                      key={role}
                                      label={roleLabel[role]}
                                      clickable
                                      color={param.visibility.includes(role) ? 'primary' : 'default'}
                                      onClick={() => {
                                        const nextVisibility = param.visibility.includes(role)
                                          ? param.visibility.filter(item => item !== role)
                                          : [...param.visibility, role];
                                        handleParameterChange(index, { visibility: nextVisibility });
                                      }}
                                    />
                                  ),
                                )}
                              </div>
                            </div>
                            <div>
                              <Typography variant="caption" color="textSecondary">
                                Required
                              </Typography>
                              <Switch
                                checked={Boolean(param.required)}
                                onChange={event =>
                                  handleParameterChange(index, { required: event.target.checked })
                                }
                                color="primary"
                              />
                            </div>
                            <Button color="secondary" onClick={() => handleRemoveParameter(index)}>
                              Remove parameter
                            </Button>
                          </div>
                        </Paper>
                      ))}
                    </div>
                    <Button startIcon={<AddIcon />} onClick={handleAddParameter}>
                      Add parameter
                    </Button>
                  </div>
                )}

                {activeStep === 4 && (
                  <div className={classes.section}>
                    <Typography variant="subtitle1">Rendered spec</Typography>
                    <pre className={classes.codeBlock}>{renderedSpec}</pre>
                    <Typography variant="subtitle1">Diff vs prior version</Typography>
                    <Typography variant="body2" color="textSecondary">
                      No previous version in the workspace. When editing an existing profile the
                      orchestrator should provide a <code>GET /diff</code> payload the UI renders
                      here.
                    </Typography>
                  </div>
                )}
              </div>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setActiveStep(step => Math.max(step - 1, 0))} disabled={activeStep === 0}>
                Back
              </Button>
              {activeStep < 4 ? (
                <Button color="primary" variant="contained" onClick={() => {
                  if (validateCurrentStep()) {
                    setActiveStep(step => Math.min(step + 1, 4));
                  }
                }}>
                  Continue
                </Button>
              ) : (
                <Tooltip title="API not yet connected">
                  <span>
                    <Button
                      color="primary"
                      variant="contained"
                      startIcon={<PublishIcon />}
                      onClick={handlePublish}
                      disabled
                    >
                      Publish profile
                    </Button>
                  </span>
                </Tooltip>
              )}
            </DialogActions>
          </>
        ) : null}
      </Dialog>
    </Page>
  );
};
