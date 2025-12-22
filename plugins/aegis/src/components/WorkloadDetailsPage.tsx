import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Page,
  Content,
  Progress,
  WarningPanel,
  StructuredMetadataTable,
  CopyTextButton,
} from '@backstage/core-components';
import {
  Box,
  Breadcrumbs,
  Button,
  Grid,
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
import { alpha } from '@material-ui/core/styles/colorManipulator';
import {
  WorkloadDTO,
  ConnectionSession,
  getWorkload,
  createConnectionSession,
  renewConnectionSession,
  revokeConnectionSession,
  getFlavor,
  parseKubernetesUrl,
  buildKubectlDescribeCommand,
} from '../api/aegisClient';
import { keycloakAuthApiRef } from '../api/refs';
import { ConnectModal } from './ConnectModal';
import {
  WorkloadStatusIndicator,
  isRunningStatus,
} from './WorkloadStatusIndicator';
import { demoWorkloads } from '../demoData';

const useStyles = makeStyles(theme => ({
  header: {
    background: 'var(--aegis-card-surface)',
    border: '1px solid var(--aegis-card-border)',
    borderRadius: theme.shape.borderRadius * 2,
    padding: theme.spacing(3),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    marginBottom: theme.spacing(3),
    boxShadow: 'var(--aegis-card-shadow)',
  },
  headerTop: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing(2),
  },
  breadcrumbs: {
    color: theme.palette.text.secondary,
    fontSize: theme.typography.pxToRem(14),
  },
  headerMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  },
  headerTitle: {
    fontWeight: 700,
    fontSize: theme.typography.pxToRem(28),
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  primaryCta: {
    boxShadow: '0 0 16px rgba(124, 58, 237, 0.4)',
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    '&:hover': {
      backgroundColor: theme.palette.primary.dark,
      boxShadow: '0 0 24px rgba(124, 58, 237, 0.5)',
    },
  },
  card: {
    backgroundColor: 'var(--aegis-card-surface)',
    border: '1px solid var(--aegis-card-border)',
    boxShadow: 'var(--aegis-card-shadow)',
    borderRadius: theme.shape.borderRadius * 2,
    padding: theme.spacing(3),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  },
  cardTitle: {
    fontWeight: 600,
    fontSize: theme.typography.pxToRem(16),
  },
  sectionStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
  },
  statCard: {
    backgroundColor: 'var(--aegis-card-surface)',
    border: '1px solid var(--aegis-card-border)',
    boxShadow: 'var(--aegis-card-shadow)',
    borderRadius: theme.shape.borderRadius * 1.5,
    padding: theme.spacing(2.5),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
    minHeight: 110,
  },
  statLabel: {
    fontSize: theme.typography.pxToRem(12),
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    fontWeight: 600,
    color: theme.palette.text.secondary,
  },
  statValue: {
    fontSize: theme.typography.pxToRem(20),
    fontWeight: 700,
  },
  mono: {
    fontFamily:
      '"SFMono-Regular", "Roboto Mono", "Liberation Mono", Consolas, Menlo, monospace',
  },
  muted: {
    color: theme.palette.text.secondary,
  },
  copyRow: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
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
    border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
    backgroundColor: alpha(theme.palette.background.paper, 0.5),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  },
  costMetricLabel: {
    fontSize: theme.typography.pxToRem(12),
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    fontWeight: 600,
    color: theme.palette.text.secondary,
  },
  costMetricValue: {
    fontSize: theme.typography.pxToRem(22),
    fontWeight: 700,
  },
  costMetricValueEmphasis: {
    fontSize: theme.typography.pxToRem(26),
    fontWeight: 700,
  },
  costMetricValueWarning: {
    color: theme.palette.warning.main,
  },
  troubleshootingLink: {
    color: theme.palette.primary.main,
    fontWeight: 600,
    textDecoration: 'none',
    '&:hover': {
      textDecoration: 'underline',
    },
  },
  statusRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    marginTop: theme.spacing(0.5),
  },
}));

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
const DEFAULT_EMPTY = '—';

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

    // Check for demo data first
    const demoItem = demoWorkloads.find(w => w.id === id);
    if (demoItem) {
      setWorkload(demoItem);
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
  const sshCommand = useMemo(() => {
    if (!session) {
      return '';
    }
    const user =
      session.sshUser && session.sshUser.trim() !== ''
        ? session.sshUser
        : 'aegis';
    return `ssh ${user}@${session.sshHostAlias} -o ProxyCommand="aegis-connect --proxy=${session.proxyUrl} --token=${session.token}"`;
  }, [session]);

  const rawStatus = workload?.uiStatus ?? workload?.status ?? '';
  const canConnect = Boolean(workload?.workspace?.interactive);
  const isRunning = isRunningStatus(rawStatus);
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

  const statCards = [
    {
      label: 'Flavor',
      value: workload ? getFlavor(workload) : DEFAULT_EMPTY,
    },
    {
      label: 'Project ID',
      value: workload?.projectId ?? DEFAULT_EMPTY,
      mono: true,
    },
    {
      label: 'Region / Cluster',
      value: workload?.clusterId ?? workload?.queue ?? DEFAULT_EMPTY,
    },
    {
      label: 'Daily Cost',
      value: '$186 / day',
    },
  ];

  const specCommand =
    workload?.workspace?.command?.join(' ') ??
    workload?.training?.command?.join(' ') ??
    DEFAULT_EMPTY;
  const specImage =
    workload?.workspace?.image ?? workload?.training?.image ?? DEFAULT_EMPTY;

  return (
    <Page themeId="tool">
      <Content>
        <Box className={classes.header}>
          <Box className={classes.headerTop}>
            <Box className={classes.headerMeta}>
              <Breadcrumbs className={classes.breadcrumbs}>
                <RouterLink
                  to="/aegis/workloads"
                  className={classes.breadcrumbs}
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  Workloads
                </RouterLink>
                <Typography color="textPrimary">
                  {id ?? DEFAULT_EMPTY}
                </Typography>
              </Breadcrumbs>
              <Typography variant="h4" className={classes.headerTitle}>
                Workload Details
              </Typography>
              <Box className={classes.statusRow}>
                {workload && (
                  <WorkloadStatusIndicator
                    status={workload.status ?? workload.uiStatus}
                  />
                )}
                {workload?.message && (
                  <Typography variant="body2" className={classes.muted}>
                    {workload.message}
                  </Typography>
                )}
              </Box>
            </Box>
            <Box className={classes.headerActions}>
              {canConnect && (
                <Button
                  variant="contained"
                  className={classes.primaryCta}
                  disabled={connectButtonDisabled}
                  onClick={handleConnect}
                >
                  {sessionLoading ? 'Preparing session…' : 'Connect'}
                </Button>
              )}
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
              <Button
                variant="text"
                size="small"
                startIcon={<ArrowBackIcon />}
                onClick={() => navigate('/aegis/workloads')}
              >
                Back to list
              </Button>
            </Box>
          </Box>
          {!isRunning && canConnect && (
            <Typography variant="caption" className={classes.muted}>
              Workspace must be running before connecting.
            </Typography>
          )}
        </Box>

        {loading && <Progress />}

        {error && (
          <WarningPanel title="Failed to load workload" severity="error">
            {error}
          </WarningPanel>
        )}

        {workload && (
          <Box display="flex" flexDirection="column" gridGap={24}>
            <Grid container spacing={3}>
              {statCards.map(card => (
                <Grid item xs={12} sm={6} md={3} key={card.label}>
                  <Paper elevation={0} className={classes.statCard}>
                    <Typography className={classes.statLabel}>
                      {card.label}
                    </Typography>
                    <Typography
                      className={`${classes.statValue} ${
                        card.mono ? classes.mono : ''
                      }`}
                    >
                      {card.value}
                    </Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>

            <Grid container spacing={3}>
              <Grid item xs={12} md={8}>
                <Box display="flex" flexDirection="column" gridGap={24}>
                  {(workload.workspace || workload.training) && (
                    <Paper elevation={0} className={classes.card}>
                      <Typography className={classes.cardTitle}>
                        Specification Details
                      </Typography>
                      <StructuredMetadataTable
                        metadata={{
                          Type: workload.workspace ? 'Workspace' : 'Training',
                          Image: specImage,
                          Command: specCommand,
                        }}
                        dense
                      />
                    </Paper>
                  )}

                  <Paper elevation={0} className={classes.card}>
                    <Typography className={classes.cardTitle}>
                      Kubernetes Object
                    </Typography>
                    <Box className={classes.sectionStack}>
                      <StructuredMetadataTable
                        metadata={{
                          Namespace: loc?.namespace ?? DEFAULT_EMPTY,
                          Kind: loc?.kind ?? DEFAULT_EMPTY,
                          Name: loc?.name ?? DEFAULT_EMPTY,
                          URL: workload?.url ?? DEFAULT_EMPTY,
                        }}
                        dense
                      />
                      {loc && (
                        <Typography variant="body2">
                          View object in{' '}
                          <RouterLink
                            to={`/kubernetes/overview?namespace=${loc.namespace}`}
                          >
                            Kubernetes Explorer
                          </RouterLink>
                        </Typography>
                      )}
                    </Box>
                  </Paper>

                  <Paper elevation={0} className={classes.card}>
                    <Typography className={classes.cardTitle}>
                      Commands &amp; Access
                    </Typography>
                    <Box className={classes.sectionStack}>
                      <Box>
                        <Typography
                          variant="subtitle2"
                          className={classes.muted}
                          style={{ marginBottom: 4 }}
                        >
                          Kubectl Describe
                        </Typography>
                        <Box className={classes.copyRow}>
                          <Typography variant="body2" className={classes.mono}>
                            {kubectlCmd || DEFAULT_EMPTY}
                          </Typography>
                          {kubectlCmd && <CopyTextButton text={kubectlCmd} />}
                        </Box>
                      </Box>
                      <Box>
                        <Typography
                          variant="subtitle2"
                          className={classes.muted}
                          style={{ marginBottom: 4 }}
                        >
                          SSH Connection
                        </Typography>
                        <Box className={classes.copyRow}>
                          <Typography variant="body2" className={classes.mono}>
                            {sshCommand || DEFAULT_EMPTY}
                          </Typography>
                          {sshCommand && <CopyTextButton text={sshCommand} />}
                        </Box>
                      </Box>
                    </Box>
                  </Paper>
                </Box>
              </Grid>

              <Grid item xs={12} md={4}>
                <Box display="flex" flexDirection="column" gridGap={24}>
                  <Paper elevation={0} className={classes.card}>
                    <Typography className={classes.cardTitle}>
                      Metadata
                    </Typography>
                    <StructuredMetadataTable metadata={metadata} dense />
                  </Paper>

                  <Paper elevation={0} className={classes.costPaper}>
                    <div className={classes.costHeader}>
                      <Typography className={classes.cardTitle}>
                        Cost Analysis
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        Synthetic estimates for this workload based on GPU
                        tenancy and storage utilization in the current billing
                        cycle.
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
                        <Box
                          key={metric.label}
                          className={classes.costMetricCard}
                        >
                          <Typography className={classes.costMetricLabel}>
                            {metric.label}
                          </Typography>
                          <Typography
                            className={`${classes.costMetricValueEmphasis} ${
                              metric.tone === 'warning'
                                ? classes.costMetricValueWarning
                                : ''
                            }`}
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

                  <Paper elevation={0} className={classes.card}>
                    <Typography className={classes.cardTitle}>
                      Troubleshooting
                    </Typography>
                    <Box className={classes.sectionStack}>
                      <Typography variant="body2" className={classes.muted}>
                        Quick links for diagnosing issues with this workload.
                      </Typography>
                      <Box display="flex" flexDirection="column" gridGap={8}>
                        <RouterLink
                          to={`/aegis/operations/logs${
                            id ? `?workloadId=${encodeURIComponent(id)}` : ''
                          }`}
                          className={classes.troubleshootingLink}
                        >
                          View related logs
                        </RouterLink>
                        <RouterLink
                          to="/aegis/workloads"
                          className={classes.troubleshootingLink}
                        >
                          Return to workload list
                        </RouterLink>
                      </Box>
                    </Box>
                  </Paper>
                </Box>
              </Grid>
            </Grid>
          </Box>
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