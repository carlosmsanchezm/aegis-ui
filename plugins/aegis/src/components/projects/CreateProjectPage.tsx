import { ChangeEvent, FC, FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Content,
  ContentHeader,
  HeaderLabel,
  Page,
  WarningPanel,
} from '@backstage/core-components';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  TextField,
  Typography,
  makeStyles,
} from '@material-ui/core';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  alertApiRef,
  discoveryApiRef,
  fetchApiRef,
  identityApiRef,
  useApi,
} from '@backstage/core-plugin-api';
import { keycloakAuthApiRef } from '../../api/refs';
import {
  ApiError,
  PlatformConfig,
  createProject,
  getPlatformConfig,
  upsertBudget,
  upsertQueue,
} from '../../api/aegisClient';
import {
  ComputeProfileDefinition,
  ProjectEnvironment,
  environmentsCopy,
  projectCreationCatalog,
} from './projectCreationCatalog';

const useStyles = makeStyles(theme => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(3),
  },
  layout: {
    display: 'grid',
    gridTemplateColumns: 'minmax(420px, 1.15fr) minmax(320px, 0.85fr)',
    gap: theme.spacing(3),
    [theme.breakpoints.down('md')]: {
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
  gridRow: {
    display: 'grid',
    gap: theme.spacing(2),
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  },
  badgeRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
  },
  summaryCard: {
    padding: theme.spacing(3),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  },
  actionsRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    columnGap: theme.spacing(2),
  },
}));

const environments: ProjectEnvironment[] = ['dev', 'test', 'prod'];

const priorityTierByEnvironment: Record<ProjectEnvironment, string> = {
  dev: 'research',
  test: 'research',
  prod: 'prod',
};

const dataLevelByEnvironment: Record<ProjectEnvironment, string> = {
  dev: 'IL4',
  test: 'IL4',
  prod: 'IL5',
};

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const formatCurrency = (value: number) =>
  `$${value.toLocaleString('en-US', { minimumFractionDigits: 0 })}`;

const defaultProfiles: ComputeProfileDefinition[] =
  projectCreationCatalog[0]?.computeProfiles ?? [];

const serializeComputeProfileAnnotations = (
  profiles: ComputeProfileDefinition[],
): string =>
  JSON.stringify(
    profiles.map(profile => ({
      id: profile.id,
      label: profile.label,
      queueId: profile.queueId,
      flavorId: profile.flavor,
      hourlyRateUsd: profile.hourlyRate,
      region: profile.cluster.region,
      namespace: profile.namespace,
      storageClass: profile.storageClass,
      networkZone: profile.networkZone,
      badges: profile.badges,
    })),
  );

export const CreateProjectPage: FC = () => {
  const classes = useStyles();
  const alertApi = useApi(alertApiRef);
  const fetchApi = useApi(fetchApiRef);
  const discoveryApi = useApi(discoveryApiRef);
  const identityApi = useApi(identityApiRef);
  const authApi = useApi(keycloakAuthApiRef);
  const navigate = useNavigate();

  const [platformConfig, setPlatformConfig] = useState<PlatformConfig | null>(null);
  const devMode = platformConfig?.devMode ?? false;

  useEffect(() => {
    let cancelled = false;
    getPlatformConfig(fetchApi, discoveryApi, identityApi, authApi)
      .then(config => {
        if (cancelled) return;
        setPlatformConfig(config);
      })
      .catch(() => {
        // If the config endpoint is unavailable, assume production mode
        if (!cancelled) setPlatformConfig({ devMode: false });
      });
    return () => { cancelled = true; };
  }, [fetchApi, discoveryApi, identityApi, authApi]);

  // Pre-fill AWS fields from platform defaults
  useEffect(() => {
    if (!platformConfig?.awsDefaults) return;
    const defaults = platformConfig.awsDefaults;
    setForm(prev => ({
      ...prev,
      ...(defaults.accountId && !prev.awsAccountId ? { awsAccountId: defaults.accountId } : {}),
      ...(defaults.roleArn && !prev.awsRoleArn ? { awsRoleArn: defaults.roleArn } : {}),
      ...(defaults.externalId && !prev.awsExternalId ? { awsExternalId: defaults.externalId } : {}),
    }));
  }, [platformConfig]);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    displayName: '',
    slug: '',
    environment: 'dev' as ProjectEnvironment,
    monthlyBudget: 7500,
    monthlyAlertPercent: 70,
    owners: '',
    dataConnections: [] as string[],
    secretScopes: [] as string[],
    computeProfiles: defaultProfiles.map(profile => profile.id),
    enableFips: true,
    enforceNetworkIsolation: true,
    awsAccountId: '',
    awsRoleArn: '',
    awsExternalId: '',
  });

  const availableProfiles = useMemo(
    () =>
      Array.from(
        new Map<string, ComputeProfileDefinition>(
          projectCreationCatalog
            .flatMap(project => project.computeProfiles)
            .map(profile => [profile.id, profile]),
        ).values(),
      ),
    [],
  );

  const availableDataConnections = useMemo(
    () =>
      Array.from(
        new Map(
          projectCreationCatalog
            .flatMap(project => project.dataConnections)
            .map(connection => [connection.id, connection]),
        ).values(),
      ),
    [],
  );

  const availableSecretScopes = useMemo(
    () =>
      Array.from(
        new Map(
          projectCreationCatalog
            .flatMap(project => project.secretScopes)
            .map(scope => [scope.id, scope]),
        ).values(),
      ),
    [],
  );

  const handleTextField =
    (field: keyof typeof form) => (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setForm(prev => ({
        ...prev,
        [field]: value,
        ...(field === 'displayName'
          ? { slug: slugify(value) }
          : {}),
      }));
    };

  const handleEnvironmentChange = (event: ChangeEvent<{ value: unknown }>) => {
    setForm(prev => ({
      ...prev,
      environment: event.target.value as ProjectEnvironment,
    }));
  };

  const handleMultiSelect =
    (field: 'dataConnections' | 'secretScopes' | 'computeProfiles') =>
    (event: ChangeEvent<{ value: unknown }>) => {
      const value = event.target.value as string[];
      setForm(prev => ({ ...prev, [field]: value }));
    };

  const handleToggle = (field: 'enableFips' | 'enforceNetworkIsolation') =>
    (_: ChangeEvent<HTMLInputElement>, checked: boolean) => {
      setForm(prev => ({ ...prev, [field]: checked }));
    };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.displayName.trim()) {
      setError('Provide a project name before creating the project.');
      return;
    }
    if (!form.slug.trim()) {
      setError('Project slug is required.');
      return;
    }
    const selectedProfiles = availableProfiles.filter(profile =>
      form.computeProfiles.includes(profile.id),
    );
    if (selectedProfiles.length === 0) {
      setError('Select at least one compute profile.');
      return;
    }
    const awsAccountId = form.awsAccountId.trim();
    const awsRoleArn = form.awsRoleArn.trim();
    const awsExternalId = form.awsExternalId.trim();
    if (!awsAccountId) {
      setError('AWS account ID is required.');
      return;
    }
    if (!/^\d{12}$/.test(awsAccountId)) {
      setError('AWS account ID must be a 12-digit identifier.');
      return;
    }
    if (!devMode && (!awsRoleArn || !awsExternalId)) {
      setError('Provide the IAM role ARN and external ID for this project (required in production mode).');
      return;
    }

    const projectId = form.slug.trim();
    const displayName = form.displayName.trim();
    const ownerGroup = form.owners.trim() || `${projectId}-owners`;
    const regions = Array.from(
      new Set(selectedProfiles.map(profile => profile.cluster.region)),
    );
    if (regions.length === 0) {
      regions.push('us-east-1');
    }
    const policy = {
      regions,
      dataLevel: dataLevelByEnvironment[form.environment],
      denyEgressByDefault: form.enforceNetworkIsolation,
    };
    const annotations: Record<string, string> = {
      'aegis/environment': form.environment,
      'aegis/monthly_budget': String(form.monthlyBudget),
      'aegis/monthly_alert_percent': String(form.monthlyAlertPercent),
      'aegis/owners': form.owners,
      'aegis/enable_fips': String(form.enableFips),
      'aegis/network_isolation': String(form.enforceNetworkIsolation),
      'aegis/compute_profiles': serializeComputeProfileAnnotations(selectedProfiles),
      'aegis/description': 'Provisioned via Backstage',
    };

    const perQueueBudget = Math.max(
      100,
      Math.round(form.monthlyBudget / Math.max(selectedProfiles.length, 1)),
    );
    const queueDuration = form.environment === 'prod' ? 86400 : 28800;
    const budgetPolicy = form.environment === 'prod' ? 'HARD' : 'ALERT';

    setSubmitting(true);
    setError(null);

    try {
      await createProject(fetchApi, discoveryApi, identityApi, authApi, {
        id: projectId,
        displayName,
        ownerGroup,
        policy,
        annotations,
        aws: {
          accountId: awsAccountId,
          roleArn: awsRoleArn,
          externalId: awsExternalId,
        },
      });

      for (const profile of selectedProfiles) {
        await upsertQueue(fetchApi, discoveryApi, identityApi, authApi, {
          name: profile.queueId,
          projectId,
          priorityTier: priorityTierByEnvironment[form.environment],
          allowedFlavors: [profile.flavor],
          defaultMaxDurationSeconds: queueDuration,
        });
        await upsertBudget(fetchApi, discoveryApi, identityApi, authApi, {
          projectId,
          queue: profile.queueId,
          limitUsd: perQueueBudget,
          policyMode: budgetPolicy,
        });
      }

      alertApi.post({
        message: `Project ${projectId} created with ${selectedProfiles.length} compute profiles`,
        severity: 'success',
      });
      navigate('/aegis/admin/projects');
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'Unable to create project via Platform API';
      setError(message);
      alertApi.post({ severity: 'error', message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Page themeId="tool">
      <Content>
        <ContentHeader title="Create Project">
          <HeaderLabel label="Guardrails" value="Budget · Policy · Data" />
        </ContentHeader>
        <form onSubmit={handleSubmit} className={classes.root}>
          <div className={classes.layout}>
            <Card elevation={0} className={classes.card}>
              <CardContent className={classes.cardContent}>
                <div>
                  <Typography variant="h6" className={classes.sectionTitle}>
                    Project basics
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Projects are the primary container for budgets, policies, data, and
                    workspace guardrails. Stick to one environment per project.
                  </Typography>
                </div>
                <TextField
                  label="Display name"
                  variant="outlined"
                  required
                  value={form.displayName}
                  onChange={handleTextField('displayName')}
                  fullWidth
                />
                <TextField
                  label="Project slug"
                  variant="outlined"
                  value={form.slug}
                  onChange={handleTextField('slug')}
                  helperText="Used for namespaces, workspace names, and tagging (e.g. acme-vision-dev)."
                  fullWidth
                  required
                />
                <FormControl variant="outlined" fullWidth>
                  <InputLabel id="environment-label">Environment</InputLabel>
                  <Select
                    labelId="environment-label"
                    value={form.environment}
                    onChange={handleEnvironmentChange}
                    label="Environment"
                  >
                    {environments.map(option => (
                      <MenuItem key={option} value={option}>
                        {environmentsCopy[option].label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  label="Project owners"
                  variant="outlined"
                  value={form.owners}
                  onChange={handleTextField('owners')}
                  helperText="Comma-separated list of admins."
                  fullWidth
                />
              </CardContent>
            </Card>

            <Card elevation={0} className={`${classes.card} ${classes.summaryCard}`}>
              <Typography variant="subtitle1" className={classes.sectionTitle}>
                Naming & chargeback
              </Typography>
              <Box>
                <Typography variant="caption" color="textSecondary">
                  Namespace
                </Typography>
                <Typography variant="body1">{form.slug || 'project-slug'}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="textSecondary">
                  Workspace naming pattern
                </Typography>
                <Typography variant="body1">
                  {(form.slug || 'project-slug') + '-<purpose>-abc12'}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="textSecondary">
                  Budget policy
                </Typography>
                <Typography variant="body1">
                  {formatCurrency(form.monthlyBudget)} monthly cap · alerts at{' '}
                  {form.monthlyAlertPercent}%
                </Typography>
              </Box>
              <Box className={classes.badgeRow}>
                {form.enableFips && <Chip label="FIPS images" size="small" />}
                {form.enforceNetworkIsolation && (
                  <Chip label="Network isolation" size="small" />
                )}
              </Box>
            </Card>
          </div>

          <Card elevation={0} className={classes.card}>
            <CardContent className={classes.cardContent}>
              <Typography variant="h6" className={classes.sectionTitle}>
                Budgets & guardrails
              </Typography>
              <div className={classes.gridRow}>
                <TextField
                  label="Monthly budget (USD)"
                  type="number"
                  variant="outlined"
                  value={form.monthlyBudget}
                  onChange={handleTextField('monthlyBudget')}
                  inputProps={{ min: 0 }}
                />
                <TextField
                  label="Alert at (%)"
                  type="number"
                  variant="outlined"
                  value={form.monthlyAlertPercent}
                  onChange={handleTextField('monthlyAlertPercent')}
                  inputProps={{ min: 0, max: 100 }}
                />
              </div>
              <div>
                <FormControlLabel
                  control={
                    <Switch
                      color="primary"
                      checked={form.enableFips}
                      onChange={handleToggle('enableFips')}
                    />
                  }
                  label="Require signed / FIPS-approved workspace images"
                />
                <FormControlLabel
                  control={
                    <Switch
                      color="primary"
                      checked={form.enforceNetworkIsolation}
                      onChange={handleToggle('enforceNetworkIsolation')}
                    />
                  }
                  label="Enforce project network isolation"
                />
              </div>
            </CardContent>
          </Card>

          <Card elevation={0} className={classes.card}>
            <CardContent className={classes.cardContent}>
              <Typography variant="h6" className={classes.sectionTitle}>
                AWS deployment credentials
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {devMode
                  ? 'Dev mode: only the AWS account ID is required. Role ARN and external ID are optional (ambient credentials will be used).'
                  : 'Provide the account, IAM role ARN, and external ID configured for this project\u2019s spoke account.'}
              </Typography>
              {devMode && (
                <Chip label="Dev Mode" size="small" color="default" />
              )}
              <div className={classes.gridRow}>
                <TextField
                  label="AWS Account ID"
                  variant="outlined"
                  required
                  value={form.awsAccountId}
                  onChange={handleTextField('awsAccountId')}
                  inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
                  helperText="12-digit AWS account where the EKS cluster will be deployed."
                />
                <TextField
                  label="IAM Role ARN"
                  variant="outlined"
                  required={!devMode}
                  value={form.awsRoleArn}
                  onChange={handleTextField('awsRoleArn')}
                  helperText={devMode
                    ? 'Optional in dev mode. Cross-account role that Pulumi assumes.'
                    : 'Cross-account role that Pulumi assumes (e.g. arn:aws:iam::123456789012:role/AegisPlatformRole).'}
                />
                <TextField
                  label="External ID"
                  variant="outlined"
                  required={!devMode}
                  value={form.awsExternalId}
                  onChange={handleTextField('awsExternalId')}
                  helperText={devMode
                    ? 'Optional in dev mode. External ID on the IAM role trust policy.'
                    : 'External ID configured on the IAM role trust policy.'}
                />
              </div>
            </CardContent>
          </Card>

          <Card elevation={0} className={classes.card}>
            <CardContent className={classes.cardContent}>
              <Typography variant="h6" className={classes.sectionTitle}>
                Compute access
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Choose the compute profiles this project can launch. You can adjust
                grants later from Project → Compute Access.
              </Typography>
              <FormControl variant="outlined" fullWidth>
                <InputLabel id="compute-profiles-label">Compute profiles</InputLabel>
                <Select
                  labelId="compute-profiles-label"
                  multiple
                  value={form.computeProfiles}
                  onChange={handleMultiSelect('computeProfiles')}
                  label="Compute profiles"
                  renderValue={selected =>
                    (selected as string[])
                      .map(id => availableProfiles.find(profile => profile.id === id)?.label)
                      .filter(Boolean)
                      .join(', ')
                  }
                >
                  {availableProfiles.map(profile => (
                    <MenuItem key={profile.id} value={profile.id}>
                      <Box display="flex" flexDirection="column">
                        <Typography variant="body1">{profile.label}</Typography>
                        <Typography variant="caption" color="textSecondary">
                          {formatCurrency(profile.hourlyRate)}/hr · {profile.cluster.name}
                        </Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </CardContent>
          </Card>

          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card elevation={0} className={classes.card}>
                <CardContent className={classes.cardContent}>
                  <Typography variant="h6" className={classes.sectionTitle}>
                    Data connections
                  </Typography>
                  <FormControl variant="outlined" fullWidth>
                    <InputLabel id="data-connections-label">Connections</InputLabel>
                    <Select
                      labelId="data-connections-label"
                      multiple
                      value={form.dataConnections}
                      onChange={handleMultiSelect('dataConnections')}
                      label="Connections"
                      renderValue={selected =>
                        (selected as string[])
                          .map(
                            id =>
                              availableDataConnections.find(connection => connection.id === id)?.name,
                          )
                          .filter(Boolean)
                          .join(', ')
                      }
                    >
                      {availableDataConnections.map(connection => (
                        <MenuItem key={connection.id} value={connection.id}>
                          <Box display="flex" flexDirection="column">
                            <Typography variant="body1">{connection.name}</Typography>
                            <Typography variant="caption" color="textSecondary">
                              {connection.uri}
                            </Typography>
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card elevation={0} className={classes.card}>
                <CardContent className={classes.cardContent}>
                  <Typography variant="h6" className={classes.sectionTitle}>
                    Secret scopes
                  </Typography>
                  <FormControl variant="outlined" fullWidth>
                    <InputLabel id="secret-scopes-label">Secrets</InputLabel>
                    <Select
                      labelId="secret-scopes-label"
                      multiple
                      value={form.secretScopes}
                      onChange={handleMultiSelect('secretScopes')}
                      label="Secrets"
                      renderValue={selected =>
                        (selected as string[])
                          .map(
                            id =>
                              availableSecretScopes.find(scope => scope.id === id)?.name,
                          )
                          .filter(Boolean)
                          .join(', ')
                      }
                    >
                      {availableSecretScopes.map(scope => (
                        <MenuItem key={scope.id} value={scope.id}>
                          <Box display="flex" flexDirection="column">
                            <Typography variant="body1">{scope.name}</Typography>
                            <Typography variant="caption" color="textSecondary">
                              {scope.provider}
                            </Typography>
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Accordion elevation={0}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle1" className={classes.sectionTitle}>
                Advanced defaults
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Tags / Cost Center"
                    variant="outlined"
                    placeholder="Org=AEGIS,CostCenter=1234"
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Notes"
                    variant="outlined"
                    placeholder="Any additional context for platform team"
                    fullWidth
                    multiline
                    minRows={3}
                  />
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>

          {error && (
            <WarningPanel severity="error" title="Unable to create project">
              {error}
            </WarningPanel>
          )}

          <Box className={classes.actionsRow}>
            <Button variant="text" component={RouterLink} to="/aegis/admin/projects">
              Cancel
            </Button>
            <Button
              color="primary"
              variant="contained"
              type="submit"
              disabled={submitting}
            >
              {submitting ? 'Creating…' : 'Create Project'}
            </Button>
          </Box>
        </form>
      </Content>
    </Page>
  );
};
