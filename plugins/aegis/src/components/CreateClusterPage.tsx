import React, { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Page, Content, ContentHeader, Progress, WarningPanel } from '@backstage/core-components';
import {
  alertApiRef,
  discoveryApiRef,
  fetchApiRef,
  identityApiRef,
  useApi,
} from '@backstage/core-plugin-api';
import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import LaunchIcon from '@material-ui/icons/PlayCircleOutline';
import SecurityIcon from '@material-ui/icons/Security';
import SettingsIcon from '@material-ui/icons/Settings';
import TimelineIcon from '@material-ui/icons/Timeline';
import CloudIcon from '@material-ui/icons/CloudQueue';
import {
  AuthenticationError,
  AuthorizationError,
  createCluster,
  getClusterJobStatus,
} from '../api/aegisClient';
import { keycloakAuthApiRef } from '../api/refs';

const useStyles = makeStyles(theme => ({
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  },
  actionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
  },
  layout: {
    display: 'grid',
    gridTemplateColumns: 'minmax(360px, 1fr) minmax(420px, 1.2fr)',
    gap: theme.spacing(3),
    [theme.breakpoints.down('md')]: {
      gridTemplateColumns: '1fr',
    },
  },
  hero: {
    background: 'linear-gradient(135deg, rgba(59,130,246,0.18), rgba(129,140,248,0.2))',
    borderRadius: theme.shape.borderRadius * 1.5,
    border: `1px solid rgba(59,130,246,0.28)`,
    padding: theme.spacing(4),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  },
  heroTitle: {
    fontWeight: 700,
    fontSize: theme.typography.h4.fontSize,
    letterSpacing: '-0.01em',
  },
  section: {
    backgroundColor: 'var(--aegis-card-surface)',
    borderRadius: theme.shape.borderRadius,
    border: `1px solid var(--aegis-card-border)`,
    padding: theme.spacing(3),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2.5),
  },
  computeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: theme.spacing(2),
  },
  computeCard: {
    borderRadius: theme.shape.borderRadius,
    border: `1px solid var(--aegis-card-border)`,
    padding: theme.spacing(2),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    backgroundColor:
      theme.palette.type === 'dark' ? 'rgba(148, 163, 184, 0.08)' : 'rgba(79, 70, 229, 0.06)',
  },
  chipRow: {
    display: 'flex',
    gap: theme.spacing(1),
    flexWrap: 'wrap',
  },
  jobCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
  },
  progressSection: {
    marginTop: theme.spacing(2),
  },
  gridTwoColumn: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: theme.spacing(2),
  },
}));

const JOB_STORAGE_KEY = 'aegis.clusterJobState.v2';
const POLL_INTERVAL_MS = 5000;
const PLATFORM_CONTROL_PROJECT = 'platform-shared-services';

const isTerminalStatus = (status?: string | null): boolean => {
  if (!status) {
    return false;
  }
  const normalized = status.toUpperCase();
  return (
    normalized === 'SUCCEEDED' ||
    normalized === 'SUCCESS' ||
    normalized === 'COMPLETED' ||
    normalized === 'FAILED' ||
    normalized === 'CANCELLED' ||
    normalized === 'CANCELED'
  );
};

const providerRegions: Record<string, string[]> = {
  aws: ['us-east-1', 'us-west-2', 'eu-central-1'],
  azure: ['eastus', 'westus2', 'uksouth'],
  gcp: ['us-central1', 'us-east4', 'europe-west4'],
};

const complianceOptions = [
  { id: 'standard', label: 'Standard (IL4)' },
  { id: 'regulated', label: 'Regulated (IL5)' },
  { id: 'airgap', label: 'Dedicated Airgap' },
];

const computeProfileCatalog = [
  {
    id: 'gpu-a10-balanced',
    label: '1×A10 Balanced',
    summary: '1×A10 · 4 vCPU · 32 GiB RAM · 50 GiB NVMe',
    hourly: 2.4,
    recommended: 'Project quick-launch & dev workloads',
  },
  {
    id: 'gpu-a100-burst',
    label: '4×A100 Burst',
    summary: '4×A100 80GB · 64 vCPU · 512 GiB RAM',
    hourly: 18.75,
    recommended: 'Nightly retraining & mission rehearsal',
  },
  {
    id: 'gpu-l40s-sprint',
    label: '2×L40S Sprint',
    summary: '2×L40S · 24 vCPU · 192 GiB RAM',
    hourly: 6.9,
    recommended: 'Conversational fine-tuning queues',
  },
];

type ClusterFormState = {
  displayName: string;
  slug: string;
  provider: 'aws' | 'azure' | 'gcp';
  region: string;
  complianceTier: string;
  accessModel: 'shared' | 'dedicated';
  dedicatedProjectId: string;
  kubernetesVersion: string;
  networkZone: string;
  enableAutoscaling: boolean;
  enableObservability: boolean;
  computeProfiles: string[];
  notes: string;
};

type StoredClusterJob = {
  jobId: string;
  status?: string | null;
  progress?: number | null;
  form: ClusterFormState;
};

const defaultForm: ClusterFormState = {
  displayName: '',
  slug: '',
  provider: 'aws',
  region: providerRegions.aws[0],
  complianceTier: 'standard',
  accessModel: 'shared',
  dedicatedProjectId: '',
  kubernetesVersion: '1.27',
  networkZone: 'transit-gateway',
  enableAutoscaling: true,
  enableObservability: true,
  computeProfiles: ['gpu-a10-balanced'],
  notes: '',
};

export const CreateClusterPage: FC = () => {
  const classes = useStyles();
  const fetchApi = useApi(fetchApiRef);
  const discoveryApi = useApi(discoveryApiRef);
  const identityApi = useApi(identityApiRef);
  const authApi = useApi(keycloakAuthApiRef);
  const alertApi = useApi(alertApiRef);

  const [form, setForm] = useState<ClusterFormState>(defaultForm);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const pollerRef = useRef<ReturnType<typeof setInterval>>();

  const jobActive = Boolean(jobId && !isTerminalStatus(jobStatus));

  const providerRegionOptions = useMemo(() => providerRegions[form.provider] ?? providerRegions.aws, [form.provider]);

  useEffect(() => {
    if (!providerRegionOptions.includes(form.region)) {
      setForm(prev => ({ ...prev, region: providerRegionOptions[0] }));
    }
  }, [providerRegionOptions]);

  const handleFormFieldChange = <K extends keyof ClusterFormState>(field: K) =>
    (event: React.ChangeEvent<HTMLInputElement | { value: unknown }>) => {
      const value = event.target.value as ClusterFormState[K];
      setForm(prev => ({ ...prev, [field]: value }));
    };

  const handleCheckboxChange = (field: keyof ClusterFormState) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [field]: event.target.checked }));
  };

  const handleComputeProfileToggle = (profileId: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({
      ...prev,
      computeProfiles: event.target.checked
        ? Array.from(new Set([...prev.computeProfiles, profileId]))
        : prev.computeProfiles.filter(id => id !== profileId),
    }));
  };

  const clearPoller = useCallback(() => {
    if (pollerRef.current) {
      clearInterval(pollerRef.current);
      pollerRef.current = undefined;
    }
  }, []);

  const clearStoredJob = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(JOB_STORAGE_KEY);
    }
  }, []);

  const persistStoredJob = useCallback((state: StoredClusterJob) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(JOB_STORAGE_KEY, JSON.stringify(state));
    }
  }, []);

  const hydrateLegacyJob = (raw: unknown): StoredClusterJob | null => {
    if (!raw || typeof raw !== 'object') {
      return null;
    }
    const legacy = raw as { jobId?: string; projectId?: string; clusterId?: string; provider?: string; region?: string };
    if (!legacy.jobId) {
      return null;
    }
    return {
      jobId: legacy.jobId,
      form: {
        ...defaultForm,
        slug: legacy.clusterId ?? defaultForm.slug,
        provider: (legacy.provider as ClusterFormState['provider']) ?? defaultForm.provider,
        region: legacy.region ?? defaultForm.region,
        dedicatedProjectId: legacy.projectId ?? defaultForm.dedicatedProjectId,
        accessModel: legacy.projectId && legacy.projectId !== PLATFORM_CONTROL_PROJECT ? 'dedicated' : 'shared',
      },
    };
  };

  const handleTerminalJob = useCallback(
    (status: string | null | undefined, errorMessage?: string | null) => {
      if (isTerminalStatus(status)) {
        clearPoller();
        clearStoredJob();
        if (status && status.toUpperCase().startsWith('SUCC')) {
          alertApi.post({
            message: 'Cluster deployment completed successfully.',
            severity: 'success',
          });
        }
        if (status && status.toUpperCase().includes('FAIL')) {
          alertApi.post({
            message: errorMessage || 'Cluster deployment failed.',
            severity: 'error',
          });
        }
      }
    },
    [alertApi, clearPoller, clearStoredJob],
  );

  const fetchJobStatus = useCallback(
    async (id: string) => {
      try {
        const { job } = await getClusterJobStatus(fetchApi, discoveryApi, identityApi, authApi, id);
        setError(null);
        setJobStatus(job.status ?? null);
        setProgress(typeof job.progress === 'number' ? Math.max(0, job.progress) : 0);
        if (job.status === 'FAILED') {
          setError(job.error || 'Cluster deployment failed.');
        }
        handleTerminalJob(job.status, job.error);
        if (isTerminalStatus(job.status)) {
          pollerRef.current && clearPoller();
        }
      } catch (e: unknown) {
        let message = 'Unable to fetch cluster job status.';
        if (e instanceof AuthenticationError || e instanceof AuthorizationError) {
          message = e.message;
        } else if (e instanceof Error) {
          message = e.message || message;
        }
        setError(message);
        clearPoller();
      }
    },
    [authApi, clearPoller, discoveryApi, fetchApi, handleTerminalJob, identityApi],
  );

  const startPolling = useCallback(
    (id: string) => {
      clearPoller();
      fetchJobStatus(id);
      pollerRef.current = setInterval(() => {
        fetchJobStatus(id);
      }, POLL_INTERVAL_MS);
    },
    [clearPoller, fetchJobStatus],
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.slug) {
      setError('Cluster slug is required.');
      return;
    }
    const owningProjectId =
      form.accessModel === 'dedicated'
        ? form.dedicatedProjectId.trim()
        : PLATFORM_CONTROL_PROJECT;
    if (!owningProjectId) {
      setError('Select a project to dedicate this cluster to.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { job } = await createCluster(fetchApi, discoveryApi, identityApi, authApi, {
        projectId: owningProjectId,
        clusterId: form.slug,
        provider: form.provider,
        region: form.region,
      });
      setJobId(job.id);
      setJobStatus(job.status);
      setProgress(job.progress ?? 0);
      persistStoredJob({
        jobId: job.id,
        status: job.status,
        progress: job.progress,
        form,
      });
      alertApi.post({
        message: `Cluster creation job ${job.id} submitted.`,
        severity: 'success',
      });
      startPolling(job.id);
    } catch (e: unknown) {
      let message = 'Failed to submit cluster deployment.';
      if (e instanceof AuthenticationError || e instanceof AuthorizationError) {
        message = e.message;
      } else if (e instanceof Error) {
        message = e.message || message;
      }
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const raw = window.localStorage.getItem(JOB_STORAGE_KEY);
    if (!raw) {
      return;
    }
    try {
      const stored = JSON.parse(raw) as StoredClusterJob | null;
      const normalized = stored?.form ? stored : hydrateLegacyJob(stored ?? undefined);
      if (!normalized?.jobId) {
        window.localStorage.removeItem(JOB_STORAGE_KEY);
        return;
      }
      setForm(normalized.form);
      setJobId(normalized.jobId);
      setJobStatus(normalized.status ?? 'RESUMING');
      setProgress(normalized.progress ?? 0);
      startPolling(normalized.jobId);
    } catch (err) {
      window.localStorage.removeItem(JOB_STORAGE_KEY);
    }
  }, [startPolling]);

  useEffect(() => clearPoller, [clearPoller]);

  const normalizedProgress = Math.min(100, Math.max(0, progress ?? 0));

  return (
    <Page themeId="tool">
      <Content>
        <ContentHeader title="Create Cluster" subtitle="Curate compute queues once, share across projects, and keep budgets visible.">
          <Chip icon={<CloudIcon />} label={form.provider.toUpperCase()} />
        </ContentHeader>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card className={classes.hero}>
              <Typography className={classes.heroTitle}>Clusters publish compute profiles for projects.</Typography>
              <Typography variant="body1" color="textSecondary">
                Provision once, expose curated compute profiles, and let projects consume them through queues. Guardrails,
                budgets, and compliance follow automatically.
              </Typography>
              <div className={classes.chipRow}>
                <Chip icon={<SecurityIcon />} label={complianceOptions.find(opt => opt.id === form.complianceTier)?.label} size="small" />
                <Chip icon={<TimelineIcon />} label={`Autoscaling ${form.enableAutoscaling ? 'enabled' : 'disabled'}`} size="small" />
                <Chip icon={<SettingsIcon />} label={`Kubernetes ${form.kubernetesVersion}`} size="small" />
              </div>
            </Card>
          </Grid>
        </Grid>

        <form onSubmit={handleSubmit}>
          <div className={classes.layout}>
            <div className={classes.section}>
              <Typography variant="h6">Cluster metadata</Typography>
              <div className={classes.gridTwoColumn}>
                <TextField
                  label="Display name"
                  value={form.displayName}
                  onChange={handleFormFieldChange('displayName')}
                  fullWidth
                />
                <TextField
                  label="Cluster slug"
                  value={form.slug}
                  onChange={handleFormFieldChange('slug')}
                  helperText="kebab-case (e.g. eks-prod-1)"
                  required
                  fullWidth
                />
                <FormControl fullWidth>
                  <InputLabel id="provider-label">Provider</InputLabel>
                  <Select
                    labelId="provider-label"
                    value={form.provider}
                    label="Provider"
                    onChange={handleFormFieldChange('provider')}
                  >
                    <MenuItem value="aws">AWS EKS</MenuItem>
                    <MenuItem value="azure">Azure AKS</MenuItem>
                    <MenuItem value="gcp">GCP GKE</MenuItem>
                  </Select>
                </FormControl>
                <FormControl fullWidth>
                  <InputLabel id="region-label">Region</InputLabel>
                  <Select
                    labelId="region-label"
                    value={form.region}
                    label="Region"
                    onChange={handleFormFieldChange('region')}
                  >
                    {providerRegionOptions.map(region => (
                      <MenuItem key={region} value={region}>
                        {region}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl fullWidth>
                  <InputLabel id="compliance-label">Compliance tier</InputLabel>
                  <Select
                    labelId="compliance-label"
                    value={form.complianceTier}
                    label="Compliance tier"
                    onChange={handleFormFieldChange('complianceTier')}
                  >
                    {complianceOptions.map(option => (
                      <MenuItem key={option.id} value={option.id}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  label="Network zone"
                  value={form.networkZone}
                  onChange={handleFormFieldChange('networkZone')}
                  helperText="e.g. transit-gateway, enclave, private-subnet"
                  fullWidth
                />
                <TextField
                  label="Kubernetes version"
                  value={form.kubernetesVersion}
                  onChange={handleFormFieldChange('kubernetesVersion')}
                  fullWidth
                />
              </div>
              <Divider />
              <Typography variant="subtitle2">Access model</Typography>
              <FormControlLabel
                control={
                  <Checkbox
                    color="primary"
                    checked={form.accessModel === 'shared'}
                    onChange={event =>
                      setForm(prev => ({
                        ...prev,
                        accessModel: event.target.checked ? 'shared' : 'dedicated',
                        dedicatedProjectId: event.target.checked ? '' : prev.dedicatedProjectId,
                      }))
                    }
                  />
                }
                label="Shared across multiple projects"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    color="primary"
                    checked={form.accessModel === 'dedicated'}
                    onChange={event =>
                      setForm(prev => ({
                        ...prev,
                        accessModel: event.target.checked ? 'dedicated' : 'shared',
                      }))
                    }
                  />
                }
                label="Dedicated to a single project"
              />
              {form.accessModel === 'dedicated' && (
                <TextField
                  label="Owning project"
                  value={form.dedicatedProjectId}
                  onChange={handleFormFieldChange('dedicatedProjectId')}
                  helperText="org-proj-env slug for chargeback"
                  required
                  fullWidth
                />
              )}
              <Divider />
              <Typography variant="subtitle2">Guardrails</Typography>
              <FormControlLabel
                control={
                  <Checkbox
                    color="primary"
                    checked={form.enableAutoscaling}
                    onChange={handleCheckboxChange('enableAutoscaling')}
                  />
                }
                label="Enable autoscaling & burst protection"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    color="primary"
                    checked={form.enableObservability}
                    onChange={handleCheckboxChange('enableObservability')}
                  />
                }
                label="Enable observability bundle (logs, metrics, cost)"
              />
              <TextField
                label="Operational notes"
                value={form.notes}
                onChange={handleFormFieldChange('notes')}
                placeholder="Document ingress rules, firewall tags, etc."
                multiline
                minRows={3}
                fullWidth
              />
            </div>

            <div className={classes.section}>
              <Typography variant="h6">Compute profiles</Typography>
              <Typography variant="body2" color="textSecondary">
                Publish curated queues once. Projects consume them as friendly compute profiles without touching instance
                types or nodegroups.
              </Typography>
              <div className={classes.computeGrid}>
                {computeProfileCatalog.map(profile => {
                  const checked = form.computeProfiles.includes(profile.id);
                  return (
                    <Card key={profile.id} className={classes.computeCard}>
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Typography variant="subtitle1">{profile.label}</Typography>
                        <Chip label={`$${profile.hourly.toFixed(2)}/hr`} color="primary" size="small" />
                      </Box>
                      <Typography variant="body2" color="textSecondary">
                        {profile.summary}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {profile.recommended}
                      </Typography>
                      <FormControlLabel
                        control={
                          <Checkbox
                            color="primary"
                            checked={checked}
                            onChange={handleComputeProfileToggle(profile.id)}
                          />
                        }
                        label={checked ? 'Granted to projects' : 'Grant to projects'}
                      />
                    </Card>
                  );
                })}
              </div>
              <Divider />
              <Typography variant="subtitle2">Job status</Typography>
              {jobId ? (
                <Card className={classes.jobCard}>
                  <CardContent>
                    <Typography variant="h6">Deployment progress</Typography>
                    <Typography variant="body2">Job ID: {jobId}</Typography>
                    <Typography variant="body2">Status: {jobStatus ?? 'SUBMITTED'}</Typography>
                    <div className={classes.progressSection}>
                      <Progress value={normalizedProgress} variant="determinate" />
                      <Typography variant="body2" color="textSecondary">
                        Progress: {normalizedProgress}%
                      </Typography>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Typography variant="body2" color="textSecondary">
                  Submit the form to start a deployment job. Progress and errors will appear here.
                </Typography>
              )}
              {error && (
                <WarningPanel severity="error" title="Cluster creation failed">
                  {error}
                </WarningPanel>
              )}
              <Divider />
              <div className={classes.actionRow}>
                <Button
                  type="submit"
                  color="primary"
                  variant="contained"
                  size="large"
                  startIcon={<LaunchIcon />}
                  disabled={submitting || jobActive}
                >
                  {submitting ? 'Submitting…' : 'Create Cluster'}
                </Button>
                {submitting && <Progress />}
              </div>
            </div>
          </div>
        </form>
      </Content>
    </Page>
  );
};
