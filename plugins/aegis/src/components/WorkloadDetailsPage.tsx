import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Page,
  Content,
  Progress,
  WarningPanel,
  StructuredMetadataTable,
  StatusOK,
  StatusWarning,
  StatusError,
  StatusPending,
  CopyTextButton,
} from '@backstage/core-components';
import {
  Box,
  Breadcrumbs,
  Button,
  Grid,
  Link,
  Paper,
  Typography,
  makeStyles,
} from '@material-ui/core';
import {
  alertApiRef,
  discoveryApiRef,
  fetchApiRef,
  identityApiRef,
  useApi,
} from '@backstage/core-plugin-api';
import ArrowBackIcon from '@material-ui/icons/ArrowBack';
import {
  WorkloadDTO,
  ConnectionSession,
  getWorkload,
  createConnectionSession,
  renewConnectionSession,
  revokeConnectionSession,
  getFlavor,
  mapDisplayStatus,
  parseKubernetesUrl,
  buildKubectlDescribeCommand,
} from '../api/aegisClient';
import { keycloakAuthApiRef } from '../api/refs';
import { ConnectModal } from './ConnectModal';

const useStyles = makeStyles(theme => ({
  headerRoot: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    marginBottom: theme.spacing(3),
  },
  headerTopRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: theme.spacing(2),
  },
  headerBreadcrumbs: {
    fontSize: theme.typography.pxToRem(12),
    color: theme.palette.text.secondary,
  },
  headerTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
    flexWrap: 'wrap',
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
  },
  headerMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    flexWrap: 'wrap',
    color: theme.palette.text.secondary,
  },
  monospace: {
    fontFamily:
      '"Roboto Mono", "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
  },
  sectionCard: {
    backgroundColor: 'var(--aegis-card-surface)',
    border: '1px solid var(--aegis-card-border)',
    boxShadow: 'var(--aegis-card-shadow)',
    borderRadius: theme.shape.borderRadius * 2,
    padding: theme.spacing(2.5),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  },
  sectionTitle: {
    fontWeight: 600,
    letterSpacing: '0.01em',
  },
  statCard: {
    backgroundColor: 'var(--aegis-card-surface)',
    border: '1px solid var(--aegis-card-border)',
    boxShadow: 'var(--aegis-card-shadow)',
    borderRadius: theme.shape.borderRadius * 2,
    padding: theme.spacing(2),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.75),
    minHeight: 96,
  },
  statLabel: {
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    fontSize: theme.typography.pxToRem(11),
    color: theme.palette.text.secondary,
    fontWeight: 600,
  },
  statValue: {
    fontSize: theme.typography.pxToRem(20),
    fontWeight: 700,
  },
  statusRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    flexWrap: 'wrap',
  },
  subtleText: {
    color: theme.palette.text.secondary,
  },
  infoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    flexWrap: 'wrap',
  },
  costValue: {
    fontSize: theme.typography.pxToRem(24),
    fontWeight: 700,
  },
  costLabel: {
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    fontSize: theme.typography.pxToRem(11),
    color: theme.palette.text.secondary,
    fontWeight: 600,
  },
  costPaper: {
    backgroundColor: 'var(--aegis-card-surface)',
    border: '1px solid var(--aegis-card-border)',
    boxShadow: 'var(--aegis-card-shadow)',
    borderRadius: theme.shape.borderRadius * 2,
    padding: theme.spacing(3),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2.5),
  },
  costHeader: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.75),
  },
  costMetrics: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: theme.spacing(2),
  },
  costMetricCard: {
    padding: theme.spacing(2),
    borderRadius: theme.shape.borderRadius * 1.5,
    border: `1px solid ${theme.palette.divider}`,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  },
}));

const statusChip = (status: string) => {
  const mapped = mapDisplayStatus(status);
  switch (mapped.color) {
    case 'ok':
      return <StatusOK>{mapped.label}</StatusOK>;
    case 'error':
      return <StatusError>{mapped.label}</StatusError>;
    case 'progress':
      return <StatusPending>{mapped.label}</StatusPending>;
    case 'warning':
    default:
      return <StatusWarning>{mapped.label}</StatusWarning>;
  }
};

const getStoredFlag = (key: string): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    return window.localStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
};

const setStoredFlag = (key: string, value: boolean) => {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(key, value ? 'true' : 'false');
  } catch {
    // ignore storage failures
  }
};

const HELPER_FLAG = 'aegis.helper.installed';
const SYSTEM_ACK_FLAG = 'aegis.system.use.ack';
const RULES_ACK_FLAG = 'aegis.rules.of.behavior.ack';

export const WorkloadDetailsPage: FC = () => {
  const classes = useStyles();
  const { id } = useParams<{ id: string }>();
  const fetchApi = useApi(fetchApiRef);
  const discoveryApi = useApi(discoveryApiRef);
  const identityApi = useApi(identityApiRef);
  const authApi = useApi(keycloakAuthApiRef);
  const alertApi = useApi(alertApiRef);
  const navigate = useNavigate();

  const [workload, setWorkload] = useState<WorkloadDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectOpen, setConnectOpen] = useState(false);

  const [session, setSession] = useState<ConnectionSession | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [pendingSession, setPendingSession] = useState(false);

  const [helperInstalled, setHelperInstalled] = useState(() =>
    getStoredFlag(HELPER_FLAG),
  );
  const [systemAcked, setSystemAcked] = useState(() =>
    getStoredFlag(SYSTEM_ACK_FLAG),
  );
  const [rulesAcked, setRulesAcked] = useState(() =>
    getStoredFlag(RULES_ACK_FLAG),
  );

  const load = useCallback(async () => {
    if (!id) {
      setError('Missing workload id');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const res = await getWorkload(
        fetchApi,
        discoveryApi,
        identityApi,
        authApi,
        id,
      );
      setWorkload(res);
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      setError(msg);
      alertApi.post({
        message: `Failed to load workload: ${msg}`,
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [alertApi, discoveryApi, fetchApi, identityApi, authApi, id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setSession(null);
  }, [id]);

  const requestSession = useCallback(
    async (client: 'cli' | 'vscode') => {
      if (!workload?.id) {
        alertApi.post({ message: 'Workload id is missing', severity: 'error' });
        return;
      }
      try {
        setSessionLoading(true);
        setSessionError(null);
        const created = await createConnectionSession(
          fetchApi,
          discoveryApi,
          identityApi,
          authApi,
          workload.id,
          client,
        );
        setSession(created);
      } catch (e: any) {
        const msg = e?.message ?? String(e);
        setSessionError(msg);
        alertApi.post({
          message: `Failed to create session: ${msg}`,
          severity: 'error',
        });
      } finally {
        setSessionLoading(false);
        setPendingSession(false);
      }
    },
    [alertApi, discoveryApi, fetchApi, identityApi, authApi, workload?.id],
  );

  useEffect(() => {
    if (
      pendingSession &&
      systemAcked &&
      rulesAcked &&
      helperInstalled &&
      !session &&
      !sessionLoading
    ) {
      requestSession('cli');
    }
  }, [
    pendingSession,
    systemAcked,
    rulesAcked,
    helperInstalled,
    session,
    sessionLoading,
    requestSession,
  ]);

  const handleConnectClose = useCallback(() => {
    setConnectOpen(false);
    setSessionError(null);
  }, []);

  const handleConnect = useCallback(() => {
    if (!workload?.id) {
      alertApi.post({ message: 'Workload id is missing', severity: 'error' });
      return;
    }
    setConnectOpen(true);
    setSessionError(null);

    if (session) {
      return;
    }

    if (!systemAcked || !rulesAcked || !helperInstalled) {
      setPendingSession(true);
      return;
    }

    requestSession('cli');
  }, [
    alertApi,
    helperInstalled,
    requestSession,
    rulesAcked,
    session,
    systemAcked,
    workload?.id,
  ]);

  const handleRenew = useCallback(async () => {
    if (!session?.sessionId) {
      return;
    }
    try {
      setSessionLoading(true);
      setSessionError(null);
      const renewed = await renewConnectionSession(
        fetchApi,
        discoveryApi,
        identityApi,
        authApi,
        session.sessionId,
      );
      setSession(renewed);
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      setSessionError(msg);
      alertApi.post({
        message: `Failed to renew session: ${msg}`,
        severity: 'error',
      });
    } finally {
      setSessionLoading(false);
    }
  }, [alertApi, discoveryApi, fetchApi, identityApi, authApi, session?.sessionId]);

  const handleRevoke = useCallback(async () => {
    if (!session?.sessionId) {
      return;
    }
    try {
      setSessionLoading(true);
      setSessionError(null);
      await revokeConnectionSession(
        fetchApi,
        discoveryApi,
        identityApi,
        authApi,
        session.sessionId,
      );
      setSession(null);
      alertApi.post({ message: 'Session revoked', severity: 'info' });
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      setSessionError(msg);
      alertApi.post({
        message: `Failed to revoke session: ${msg}`,
        severity: 'error',
      });
    } finally {
      setSessionLoading(false);
    }
  }, [alertApi, discoveryApi, fetchApi, identityApi, authApi, session?.sessionId]);

  const handleSystemAck = useCallback(() => {
    setSystemAcked(true);
    setStoredFlag(SYSTEM_ACK_FLAG, true);
  }, []);

  const handleRulesAck = useCallback(() => {
    setRulesAcked(true);
    setStoredFlag(RULES_ACK_FLAG, true);
  }, []);

  const handleHelperConfirmed = useCallback(() => {
    setHelperInstalled(true);
    setStoredFlag(HELPER_FLAG, true);
  }, []);

  const loc = parseKubernetesUrl(workload?.url);
  const kubectlCmd = buildKubectlDescribeCommand(loc);

  const rawStatus = workload?.uiStatus ?? workload?.status ?? '';
  const canConnect = Boolean(workload?.workspace?.interactive);
  const isRunning = rawStatus === 'RUNNING' || workload?.status === 'RUNNING';
  const connectButtonDisabled = sessionLoading || !isRunning;

  const metadata = useMemo(
    () =>
      workload
        ? {
            'Workload ID': workload.id ?? '—',
            Status: rawStatus || '—',
            Flavor: getFlavor(workload) || '—',
            Project: workload.projectId ?? '—',
            Queue: workload.queue ?? '—',
            Cluster: workload.clusterId ?? '—',
            URL: workload.url ?? '—',
          }
        : {},
    [rawStatus, workload],
  );

  const displayValue = (value?: string | number | null) =>
    value === undefined || value === null || value === '' ? '—' : value;

  const workloadCommand =
    workload?.workspace?.command?.join(' ') ??
    workload?.training?.command?.join(' ');

  const sshCommand = useMemo(() => {
    if (!session?.sshHostAlias) {
      return '';
    }
    const user =
      session.sshUser && session.sshUser.trim() !== '' ? session.sshUser : 'root';
    return `ssh ${user}@${session.sshHostAlias} -o ProxyCommand="aegis-connect --proxy=${session.proxyUrl} --token=${session.token}"`;
  }, [session]);

  return (
    <Page themeId="tool">
      <Content>
        <Box className={classes.headerRoot}>
          <Box className={classes.headerTopRow}>
            <Box>
              <Breadcrumbs className={classes.headerBreadcrumbs}>
                <Link
                  component={RouterLink}
                  to="/aegis/workloads"
                  color="inherit"
                >
                  Workloads
                </Link>
                <Typography color="textPrimary">
                  {displayValue(id)}
                </Typography>
              </Breadcrumbs>
              <Box className={classes.headerTitleRow}>
                <Typography variant="h4">Workload Details</Typography>
                <Typography
                  variant="body2"
                  className={`${classes.monospace} ${classes.subtleText}`}
                >
                  {displayValue(id)}
                </Typography>
              </Box>
            </Box>
            <Box className={classes.headerActions}>
              {statusChip(rawStatus)}
              {canConnect && (
                <Button
                  variant="contained"
                  color="primary"
                  disabled={connectButtonDisabled}
                  onClick={handleConnect}
                >
                  {sessionLoading ? 'Preparing session…' : 'Connect'}
                </Button>
              )}
            </Box>
          </Box>
          <Box className={classes.headerMeta}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate('/aegis/workloads')}
            >
              Back to list
            </Button>
            <Button
              variant="outlined"
              size="small"
              onClick={() =>
                navigate(
                  `/aegis/operations/logs${
                    id ? `?workloadId=${encodeURIComponent(id)}` : ''
                  }`,
                )
              }
            >
              View Related Logs
            </Button>
            {workload?.message && (
              <Typography variant="body2" className={classes.subtleText}>
                {workload.message}
              </Typography>
            )}
          </Box>
        </Box>

        {loading && <Progress />}

        {error && (
          <WarningPanel title="Failed to load workload" severity="error">
            {error}
          </WarningPanel>
        )}

        {workload && (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Grid container spacing={2}>
                {[
                  {
                    label: 'Flavor',
                    value: displayValue(getFlavor(workload)),
                  },
                  {
                    label: 'Project ID',
                    value: displayValue(workload.projectId),
                  },
                  {
                    label: 'Region / Cluster',
                    value: displayValue(workload.clusterId),
                  },
                  {
                    label: 'Daily Cost',
                    value: '$186 / day',
                  },
                ].map(stat => (
                  <Grid item xs={12} sm={6} md={3} key={stat.label}>
                    <Paper elevation={0} className={classes.statCard}>
                      <Typography className={classes.statLabel}>
                        {stat.label}
                      </Typography>
                      <Typography
                        className={`${classes.statValue} ${classes.monospace}`}
                      >
                        {stat.value}
                      </Typography>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </Grid>

            <Grid item xs={12} md={8}>
              <Box display="flex" flexDirection="column" gridGap={16}>
                <Paper elevation={0} className={classes.sectionCard}>
                  <Typography variant="h6" className={classes.sectionTitle}>
                    Specification
                  </Typography>
                  <StructuredMetadataTable
                    metadata={{
                      Type: workload.workspace ? 'Workspace' : 'Training',
                      Image:
                        workload.workspace?.image ??
                        workload.training?.image ??
                        '—',
                      Command: displayValue(workloadCommand),
                    }}
                  />
                </Paper>

                <Paper elevation={0} className={classes.sectionCard}>
                  <Typography variant="h6" className={classes.sectionTitle}>
                    Kubernetes Object
                  </Typography>
                  <Box className={classes.infoRow}>
                    <Typography variant="body2">
                      {loc ? (
                        <RouterLink
                          to={`/kubernetes/overview?namespace=${loc.namespace}`}
                        >
                          {loc.kind} {loc.name}
                        </RouterLink>
                      ) : (
                        '—'
                      )}
                    </Typography>
                    {kubectlCmd && (
                      <>
                        <Typography
                          variant="body2"
                          className={classes.monospace}
                        >
                          {kubectlCmd}
                        </Typography>
                        <CopyTextButton text={kubectlCmd} />
                      </>
                    )}
                  </Box>
                </Paper>

                <Paper elevation={0} className={classes.sectionCard}>
                  <Typography variant="h6" className={classes.sectionTitle}>
                    Command & Access
                  </Typography>
                  <Box display="flex" flexDirection="column" gridGap={12}>
                    <Box className={classes.infoRow}>
                      <Typography
                        variant="body2"
                        className={classes.monospace}
                      >
                        {displayValue(workloadCommand)}
                      </Typography>
                      {workloadCommand && (
                        <CopyTextButton text={workloadCommand} />
                      )}
                    </Box>
                    <Box className={classes.infoRow}>
                      <Typography
                        variant="body2"
                        className={classes.monospace}
                      >
                        {displayValue(sshCommand)}
                      </Typography>
                      {sshCommand && <CopyTextButton text={sshCommand} />}
                    </Box>
                    {!isRunning && (
                      <Typography variant="caption" color="textSecondary">
                        Workspace must be running before connecting.
                      </Typography>
                    )}
                  </Box>
                </Paper>
              </Box>
            </Grid>

            <Grid item xs={12} md={4}>
              <Box display="flex" flexDirection="column" gridGap={16}>
                <Paper elevation={0} className={classes.sectionCard}>
                  <Typography variant="h6" className={classes.sectionTitle}>
                    Metadata
                  </Typography>
                  <StructuredMetadataTable metadata={metadata} />
                </Paper>

                <Paper elevation={0} className={classes.costPaper}>
                  <div className={classes.costHeader}>
                    <Typography variant="h6">Cost Analysis</Typography>
                    <Typography variant="body2" color="textSecondary">
                      Synthetic estimates for this workload based on GPU tenancy
                      and storage utilization in the current billing cycle.
                    </Typography>
                  </div>
                  <div className={classes.costMetrics}>
                    {[
                      {
                        label: 'Total Cost to Date',
                        value: '$24,680',
                        helper: 'Includes compute, storage, and network egress',
                      },
                      {
                        label: 'Estimated Run Rate',
                        value: '$186 / day',
                        helper: 'Projected using trailing 7-day utilization',
                      },
                      {
                        label: 'Budget Utilization',
                        value: '72% of $34,000 cap',
                        helper: 'Alerts fire at 85% threshold',
                        tone: 'warning',
                      },
                      {
                        label: 'Last Invoice Amount',
                        value: '$6,240',
                        helper: 'Billed on Apr 30, 2024',
                      },
                    ].map(metric => (
                      <Box key={metric.label} className={classes.costMetricCard}>
                        <Typography className={classes.costLabel}>
                          {metric.label}
                        </Typography>
                        <Typography
                          className={`${classes.costValue} ${classes.monospace}`}
                          style={{
                            color:
                              metric.tone === 'warning'
                                ? '#d97706'
                                : undefined,
                          }}
                        >
                          {metric.value}
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          {metric.helper}
                        </Typography>
                      </Box>
                    ))}
                  </div>
                </Paper>

                <Paper elevation={0} className={classes.sectionCard}>
                  <Typography variant="h6" className={classes.sectionTitle}>
                    Troubleshooting
                  </Typography>
                  <Box display="flex" flexDirection="column" gridGap={8}>
                    {[
                      {
                        label: 'Kubernetes Dashboard',
                        to: loc
                          ? `/kubernetes/overview?namespace=${loc.namespace}`
                          : '',
                      },
                      {
                        label: 'Workload Logs',
                        to: `/aegis/operations/logs${
                          id ? `?workloadId=${encodeURIComponent(id)}` : ''
                        }`,
                      },
                      {
                        label: 'Restart Workspace',
                        to: '',
                      },
                    ].map(link => (
                      <Typography key={link.label} variant="body2">
                        {link.to ? (
                          <RouterLink to={link.to}>{link.label}</RouterLink>
                        ) : (
                          <span className={classes.subtleText}>
                            {link.label}
                          </span>
                        )}
                      </Typography>
                    ))}
                  </Box>
                </Paper>
              </Box>
            </Grid>
          </Grid>
        )}
      </Content>
      <ConnectModal
        open={connectOpen}
        onClose={handleConnectClose}
        loading={sessionLoading}
        error={sessionError}
        session={session}
        pendingSession={pendingSession}
        helperInstalled={helperInstalled}
        onConfirmHelper={handleHelperConfirmed}
        systemAcked={systemAcked}
        onAcknowledgeSystemUse={handleSystemAck}
        rulesAcked={rulesAcked}
        onAcknowledgeRules={handleRulesAck}
        onRequestSession={requestSession}
        onRenew={handleRenew}
        onRevoke={handleRevoke}
        workloadId={workload?.id ?? ''}
      />
    </Page>
  );
};
