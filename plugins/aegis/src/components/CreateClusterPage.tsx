import React, { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Page,
  Content,
  ContentHeader,
  HeaderLabel,
  Progress,
  WarningPanel,
} from '@backstage/core-components';
import {
  alertApiRef,
  discoveryApiRef,
  fetchApiRef,
  identityApiRef,
  useApi,
} from '@backstage/core-plugin-api';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Divider,
  FormControlLabel,
  Grid,
  LinearProgress,
  MenuItem,
  TextField,
  Typography,
  makeStyles,
} from '@material-ui/core';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import { AuthenticationError, AuthorizationError, createCluster, getClusterJobStatus } from '../api/aegisClient';
import { keycloakAuthApiRef } from '../api/refs';
import {
  ComputeProfileDefinition,
  environmentsCopy,
  projectCatalog,
} from './projects/projectCatalog';

const useStyles = makeStyles(theme => ({
  layout: {
    display: 'grid',
    gridTemplateColumns: 'minmax(480px, 1.4fr) minmax(320px, 0.8fr)',
    gap: theme.spacing(3),
    [theme.breakpoints.down('lg')]: {
      gridTemplateColumns: '1fr',
    },
  },
  card: {
    borderRadius: theme.shape.borderRadius,
    border: `1px solid var(--aegis-card-border)`,
    backgroundColor: 'var(--aegis-card-surface)',
  },
  cardContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2.5),
  },
  sectionTitle: {
    fontWeight: 600,
    letterSpacing: '-0.01em',
  },
  chipRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
  },
  jobCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    padding: theme.spacing(3),
  },
  summaryList: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.25),
  },
  inlineRow: {
    display: 'flex',
    flexWrap: 'wrap',
    columnGap: theme.spacing(2),
    rowGap: theme.spacing(1.5),
  },
  actionsRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    columnGap: theme.spacing(2),
    marginTop: theme.spacing(3),
  },
}));

const JOB_STORAGE_KEY = 'aegis.clusterJobState';
const POLL_INTERVAL_MS = 5000;

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

type StoredClusterJob = {
  jobId: string;
  projectId: string;
  clusterId: string;
  provider: string;
  region: string;
};

const clusterProfileCatalog: ComputeProfileDefinition[] = Array.from(
  new Map(
    projectCatalog
      .flatMap(project => project.computeProfiles)
      .map(profile => [profile.id, profile]),
  ).values(),
);

const providerOptions = [
  { id: 'aws', label: 'AWS EKS' },
  { id: 'azure', label: 'Azure AKS' },
  { id: 'gcp', label: 'GCP GKE' },
];

const complianceTiers = ['IL2', 'IL4', 'IL5', 'IL6'];

const formatCurrency = (value: number) =>
  `$${value.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

export const CreateClusterPage: FC = () => {
  const classes = useStyles();
  const fetchApi = useApi(fetchApiRef);
  const discoveryApi = useApi(discoveryApiRef);
  const identityApi = useApi(identityApiRef);
  const authApi = useApi(keycloakAuthApiRef);
  const alertApi = useApi(alertApiRef);

  const [form, setForm] = useState({
    displayName: '',
    clusterId: '',
    provider: 'aws',
    region: 'us-west-2',
    complianceTier: 'IL5',
    owningProject: projectCatalog[0]?.id ?? '',
    grantedProjects: projectCatalog.map(project => project.id),
    dedicatedCluster: false,
    selectedProfiles: clusterProfileCatalog.slice(0, 2).map(profile => profile.id),
    notes: '',
  });
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const pollerRef = useRef<ReturnType<typeof setInterval>>();

  const jobActive = Boolean(jobId && !isTerminalStatus(jobStatus));

  const handleProviderChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    setForm(prev => ({ ...prev, provider: event.target.value as string }));
  };

  const handleRegionChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, region: event.target.value }));
  };

  const handleComplianceChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    setForm(prev => ({ ...prev, complianceTier: event.target.value as string }));
  };

  const handleOwningProjectChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    setForm(prev => ({ ...prev, owningProject: event.target.value as string }));
  };

  const handleGrantedProjectsChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    const value = event.target.value;
    setForm(prev => ({
      ...prev,
      grantedProjects: Array.isArray(value)
        ? (value as string[])
        : value
        ? [value as string]
        : [],
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
        const { job } = await getClusterJobStatus(
          fetchApi,
          discoveryApi,
          identityApi,
          authApi,
          id,
        );
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
    if (!form.clusterId.trim() || !form.owningProject.trim()) {
      setError('Cluster ID and owning project are required.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { job } = await createCluster(
        fetchApi,
        discoveryApi,
        identityApi,
        authApi,
        {
          projectId: form.owningProject,
          clusterId: form.clusterId.trim(),
          provider: form.provider,
          region: form.region,
        },
      );
      setJobId(job.id);
      setJobStatus(job.status);
      setProgress(job.progress ?? 0);
      persistStoredJob({
        jobId: job.id,
        projectId: form.owningProject,
        clusterId: form.clusterId,
        provider: form.provider,
        region: form.region,
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
      const stored: StoredClusterJob = JSON.parse(raw);
      if (!stored?.jobId) {
        window.localStorage.removeItem(JOB_STORAGE_KEY);
        return;
      }
      setForm(prev => ({
        ...prev,
        owningProject: stored.projectId ?? prev.owningProject,
        clusterId: stored.clusterId ?? prev.clusterId,
        provider: stored.provider ?? prev.provider,
        region: stored.region ?? prev.region,
      }));
      setJobId(stored.jobId);
      setJobStatus('RESUMING');
      setProgress(0);
      startPolling(stored.jobId);
    } catch (err) {
      window.localStorage.removeItem(JOB_STORAGE_KEY);
    }
  }, [startPolling]);

  useEffect(() => clearPoller, [clearPoller]);

  const normalizedProgress = Math.min(100, Math.max(0, progress ?? 0));

  const selectedProfiles = useMemo(
    () =>
      clusterProfileCatalog.filter(profile => form.selectedProfiles.includes(profile.id)),
    [form.selectedProfiles],
  );

  const owningProject = useMemo(
    () => projectCatalog.find(project => project.id === form.owningProject),
    [form.owningProject],
  );

  return (
    <Page themeId="tool">
      <Content>
        <ContentHeader title="Onboard Cluster">
          <HeaderLabel label="Guardrails" value="Compute · Compliance · Budgets" />
        </ContentHeader>
        <form onSubmit={handleSubmit}>
          <div className={classes.layout}>
            <div>
              <Card elevation={0} className={classes.card}>
                <CardContent className={classes.cardContent}>
                  <div>
                    <Typography variant="h6" className={classes.sectionTitle}>
                      Cluster metadata
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Provide a human-friendly name and a slug. ÆGIS will provision the
                      control plane and baseline networking.
                    </Typography>
                  </div>
                  <TextField
                    label="Cluster display name"
                    value={form.displayName}
                    onChange={event => setForm(prev => ({ ...prev, displayName: event.target.value }))}
                    placeholder="EKS Vision Prod"
                    variant="outlined"
                    fullWidth
                  />
                  <TextField
                    label="Cluster slug"
                    value={form.clusterId}
                    onChange={event =>
                      setForm(prev => ({ ...prev, clusterId: event.target.value.toLowerCase() }))
                    }
                    helperText="Used for namespaces and tagging (e.g. eks-prod-1)."
                    variant="outlined"
                    fullWidth
                    required
                  />
                  <Box className={classes.inlineRow}>
                    <TextField
                      select
                      label="Provider"
                      value={form.provider}
                      onChange={handleProviderChange}
                      variant="outlined"
                    >
                      {providerOptions.map(option => (
                        <MenuItem key={option.id} value={option.id}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </TextField>
                    <TextField
                      label="Region"
                      value={form.region}
                      onChange={handleRegionChange}
                      variant="outlined"
                    />
                    <TextField
                      select
                      label="Compliance tier"
                      value={form.complianceTier}
                      onChange={handleComplianceChange}
                      variant="outlined"
                    >
                      {complianceTiers.map(tier => (
                        <MenuItem key={tier} value={tier}>
                          {tier}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Box>
                  <FormControlLabel
                    control={
                      <Checkbox
                        color="primary"
                        checked={form.dedicatedCluster}
                        onChange={(_, checked) =>
                          setForm(prev => ({ ...prev, dedicatedCluster: checked }))
                        }
                      />
                    }
                    label="Dedicated cluster for this project"
                  />
                </CardContent>
              </Card>

              <Card elevation={0} className={classes.card}>
                <CardContent className={classes.cardContent}>
                  <Typography variant="h6" className={classes.sectionTitle}>
                    Projects & access
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Pick the owning project and any additional projects to grant compute
                    access once the cluster is online.
                  </Typography>
                  <TextField
                    select
                    label="Owning project"
                    value={form.owningProject}
                    onChange={handleOwningProjectChange}
                    variant="outlined"
                    fullWidth
                  >
                    {projectCatalog.map(project => (
                      <MenuItem key={project.id} value={project.id}>
                        {project.displayName} — {environmentsCopy[project.environment].label}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    select
                    label="Grant access to"
                    value={form.grantedProjects}
                    onChange={handleGrantedProjectsChange}
                    variant="outlined"
                    fullWidth
                    SelectProps={{
                      multiple: true,
                      renderValue: (selected: unknown) =>
                        (selected as string[])
                          .map(id => projectCatalog.find(project => project.id === id)?.displayName)
                          .filter(Boolean)
                          .join(', '),
                    }}
                  >
                    {projectCatalog.map(project => (
                      <MenuItem key={project.id} value={project.id}>
                        {project.displayName}
                      </MenuItem>
                    ))}
                  </TextField>
                </CardContent>
              </Card>

              <Card elevation={0} className={classes.card}>
                <CardContent className={classes.cardContent}>
                  <Typography variant="h6" className={classes.sectionTitle}>
                    Compute profiles to publish
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Select which curated compute profiles this cluster will expose. These
                    can be tuned later in Compute Profiles.
                  </Typography>
                  <div className={classes.summaryList}>
                    {clusterProfileCatalog.map(profile => {
                      const checked = form.selectedProfiles.includes(profile.id);
                      return (
                        <FormControlLabel
                          key={profile.id}
                          control={
                            <Checkbox
                              color="primary"
                              checked={checked}
                              onChange={(_, isChecked) =>
                                setForm(prev => ({
                                  ...prev,
                                  selectedProfiles: isChecked
                                    ? [...prev.selectedProfiles, profile.id]
                                    : prev.selectedProfiles.filter(id => id !== profile.id),
                                }))
                              }
                            />
                          }
                          label={
                            <Box display="flex" flexDirection="column">
                              <Typography variant="body1">{profile.label}</Typography>
                              <Typography variant="caption" color="textSecondary">
                                {formatCurrency(profile.hourlyRate)}/hr · {profile.cluster.name}
                              </Typography>
                            </Box>
                          }
                        />
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Accordion elevation={0}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle1" className={classes.sectionTitle}>
                    Advanced networking & observability
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <TextField
                        label="Control plane CIDR"
                        placeholder="10.32.0.0/16"
                        variant="outlined"
                        fullWidth
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        label="Observability sink"
                        placeholder="CloudWatch / Log Analytics workspace"
                        variant="outlined"
                        fullWidth
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        label="Notes"
                        value={form.notes}
                        onChange={event => setForm(prev => ({ ...prev, notes: event.target.value }))}
                        placeholder="Anything the platform team should know"
                        variant="outlined"
                        fullWidth
                        multiline
                        minRows={3}
                      />
                    </Grid>
                  </Grid>
                </AccordionDetails>
              </Accordion>

              {error && (
                <Box marginTop={2}>
                  <WarningPanel severity="error" title="Cluster creation failed">
                    {error}
                  </WarningPanel>
                </Box>
              )}

              <Box className={classes.actionsRow}>
                <Button type="submit" color="primary" variant="contained" disabled={submitting || jobActive}>
                  Launch cluster
                </Button>
                {submitting && <Progress />}
              </Box>
            </div>

            <Card elevation={0} className={`${classes.card} ${classes.jobCard}`}>
              <Typography variant="h6" className={classes.sectionTitle}>
                Launch summary
              </Typography>
              <div className={classes.summaryList}>
                <div>
                  <Typography variant="caption" color="textSecondary">
                    Owning project
                  </Typography>
                  <Typography variant="body1">{owningProject?.displayName ?? 'Select a project'}</Typography>
                </div>
                <div>
                  <Typography variant="caption" color="textSecondary">
                    Compute profiles
                  </Typography>
                  <Typography variant="body1">
                    {selectedProfiles.map(profile => profile.label).join(', ') || 'None selected'}
                  </Typography>
                </div>
                <div>
                  <Typography variant="caption" color="textSecondary">
                    Compliance tier
                  </Typography>
                  <Typography variant="body1">{form.complianceTier}</Typography>
                </div>
              </div>
              <Divider />
              {jobId ? (
                <div>
                  <Typography variant="body2">Job ID: {jobId}</Typography>
                  <Typography variant="body2">Status: {jobStatus}</Typography>
                  <Box marginTop={2}>
                    <LinearProgress variant="determinate" value={normalizedProgress} />
                    <Typography variant="caption" color="textSecondary">
                      Progress: {normalizedProgress}%
                    </Typography>
                  </Box>
                </div>
              ) : (
                <Typography variant="body2" color="textSecondary">
                  Submit the form to start provisioning the cluster. Status updates will
                  appear here in real-time.
                </Typography>
              )}
            </Card>
          </div>
        </form>
      </Content>
    </Page>
  );
};
