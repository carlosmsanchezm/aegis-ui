import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Page,
  Content,
  ContentHeader,
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
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Tab,
  Tabs,
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
import AssessmentIcon from '@material-ui/icons/Assessment';
import CloudDoneIcon from '@material-ui/icons/CloudDone';
import CloudQueueIcon from '@material-ui/icons/CloudQueue';
import ErrorOutlineIcon from '@material-ui/icons/ErrorOutline';
import FilterListIcon from '@material-ui/icons/FilterList';
import InfoOutlinedIcon from '@material-ui/icons/InfoOutlined';
import LaunchIcon from '@material-ui/icons/Launch';
import LayersIcon from '@material-ui/icons/Layers';
import ScheduleIcon from '@material-ui/icons/Schedule';
import TimelineIcon from '@material-ui/icons/Timeline';
import { useNavigate } from 'react-router-dom';
import {
  ApiError,
  ClusterActivityItem,
  ClusterDetail,
  ClusterJobCondition,
  ClusterMode,
  ClusterNodePoolStatus,
  ClusterSummary,
  ClusterTaint,
  getCluster,
  listClusters,
} from '../../../../../plugins/aegis/src/api/aegisClient';
import { keycloakAuthApiRef } from '../../../../../plugins/aegis/src/api/refs';
import { mockClusterDetails, mockClusterSummaries } from './clusterMockData';

type FilterState = {
  projectId: string;
  region: string;
  mode: 'all' | ClusterMode;
};

type DetailTab = 0 | 1 | 2 | 3;

const useStyles = makeStyles(theme => ({
  root: {
    paddingBottom: theme.spacing(6),
  },
  filtersCard: {
    borderRadius: 18,
  },
  summaryCard: {
    borderRadius: 18,
    height: '100%',
  },
  tableCard: {
    borderRadius: 18,
  },
  filtersRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
    flexWrap: 'wrap',
  },
  badge: {
    marginRight: theme.spacing(1),
  },
  statusChip: {
    textTransform: 'uppercase',
    fontWeight: 600,
  },
  detailHeader: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  },
  detailActions: {
    display: 'flex',
    gap: theme.spacing(1),
    flexWrap: 'wrap',
    marginTop: theme.spacing(1),
  },
  tabPanel: {
    marginTop: theme.spacing(2),
  },
  activityList: {
    maxHeight: 280,
    overflowY: 'auto',
  },
  emptyState: {
    padding: theme.spacing(4),
    textAlign: 'center',
    color: theme.palette.text.secondary,
  },
}));

const formatPhaseChipColor = (phase: ClusterSummary['phase']): 'default' | 'primary' | 'secondary' => {
  if (phase === 'Ready') {
    return 'primary';
  }
  if (phase === 'Error' || phase === 'Degraded') {
    return 'secondary';
  }
  return 'default';
};

const renderTaints = (taints?: ClusterTaint[]): string => {
  if (!taints || taints.length === 0) {
    return '—';
  }
  return taints
    .map(taint =>
      [taint.key, taint.value].filter(Boolean).join('=') + (taint.effect ? `:${taint.effect}` : ''),
    )
    .join(', ');
};

const renderLabels = (labels?: Record<string, string>): string => {
  if (!labels) {
    return '—';
  }
  return Object.entries(labels)
    .map(([key, value]) => `${key}=${value}`)
    .join(', ');
};

const renderActivityIcon = (phase: string) => {
  if (phase.toLowerCase().includes('error')) {
    return <ErrorOutlineIcon color="secondary" />;
  }
  if (phase.toLowerCase().includes('ready')) {
    return <CloudDoneIcon color="primary" />;
  }
  return <TimelineIcon color="action" />;
};

const DetailTabs = ({
  value,
  onChange,
}: {
  value: DetailTab;
  onChange: (tab: DetailTab) => void;
}) => (
  <Tabs value={value} onChange={(_, next) => onChange(next as DetailTab)} indicatorColor="primary">
    <Tab label="Overview" />
    <Tab label="Node pools" />
    <Tab label="Integrations" />
    <Tab label="Activity" />
  </Tabs>
);

const NodePoolTable = ({ nodePools }: { nodePools?: ClusterNodePoolStatus[] }) => {
  if (!nodePools || nodePools.length === 0) {
    return <Typography>No node pools reported yet.</Typography>;
  }
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Name</TableCell>
          <TableCell>Instance type</TableCell>
          <TableCell>Desired</TableCell>
          <TableCell>Min</TableCell>
          <TableCell>Max</TableCell>
          <TableCell>Labels</TableCell>
          <TableCell>Taints</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {nodePools.map(pool => (
          <TableRow key={pool.name}>
            <TableCell>{pool.name}</TableCell>
            <TableCell>{pool.instanceType}</TableCell>
            <TableCell>{pool.desiredSize ?? pool.actualSize ?? '—'}</TableCell>
            <TableCell>{pool.minSize}</TableCell>
            <TableCell>{pool.maxSize}</TableCell>
            <TableCell>{renderLabels(pool.labels)}</TableCell>
            <TableCell>{renderTaints(pool.taints)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

const ActivityList = ({ activity }: { activity?: ClusterActivityItem[] }) => {
  if (!activity || activity.length === 0) {
    return <Typography>No activity recorded yet.</Typography>;
  }
  return (
    <List dense>
      {activity.map(item => (
        <ListItem key={item.id} divider>
          <ListItemIcon>{renderActivityIcon(item.phase)}</ListItemIcon>
          <ListItemText
            primary={item.phase}
            secondary={`${new Date(item.timestamp).toLocaleString()} · ${item.message || ''}`}
          />
        </ListItem>
      ))}
    </List>
  );
};

const ClusterDetailDialog = ({
  clusterId,
  open,
  onClose,
}: {
  clusterId?: string;
  open: boolean;
  onClose: () => void;
}) => {
  const classes = useStyles();
  const fetchApi = useApi(fetchApiRef);
  const discoveryApi = useApi(discoveryApiRef);
  const identityApi = useApi(identityApiRef);
  const authApi = useApi(keycloakAuthApiRef);
  const alertApi = useApi(alertApiRef);

  const [detail, setDetail] = useState<ClusterDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<DetailTab>(0);

  useEffect(() => {
    if (!clusterId || !open) {
      return;
    }
    setLoading(true);
    setError(null);
    setTab(0);
    getCluster(fetchApi, discoveryApi, identityApi, authApi, clusterId)
      .then((result: ClusterDetail) => {
        setDetail(result);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message.toLowerCase() : '';
        if (
          err instanceof ApiError &&
          (err.status === 405 ||
            err.status === 404 ||
            message.includes('method not allowed') ||
            message.includes('not found'))
        ) {
          const mock = mockClusterDetails[clusterId];
          if (mock) {
            setDetail(mock);
            setError(null);
            alertApi.post({
              message: 'Showing sample cluster details because the platform API is unavailable.',
              severity: 'info',
            });
            return;
          }
        }
        setError(err instanceof Error ? err.message : 'Unable to load cluster details.');
      })
      .finally(() => setLoading(false));
  }, [authApi, clusterId, discoveryApi, fetchApi, identityApi, open]);

  const navigate = useNavigate();

  const handleScale = useCallback(() => {
    if (!detail) {
      return;
    }
    navigate('/aegis/clusters/create', {
      state: { projectId: detail.projectId, region: detail.region, clusterId: detail.id, mode: 'provision' },
    });
    alertApi.post({
      message: 'Wizard pre-filled with cluster context for scaling operations.',
      severity: 'info',
    });
  }, [alertApi, detail, navigate]);

  const handleAddCluster = useCallback(() => {
    if (!detail) {
      return;
    }
    navigate('/aegis/clusters/create', {
      state: { projectId: detail.projectId, region: detail.region, mode: 'provision' },
    });
  }, [detail, navigate]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle disableTypography>
        <div className={classes.detailHeader}>
          <Typography variant="h5">Cluster detail</Typography>
          {detail && (
            <Typography variant="subtitle1" color="textSecondary">
              {detail.name} · {detail.region}
            </Typography>
          )}
        </div>
      </DialogTitle>
      <DialogContent dividers>
        {loading && <Progress />}
        {error && <WarningPanel severity="error" title="Unable to load cluster">{error}</WarningPanel>}
        {!loading && detail && (
          <>
            <Box className={classes.detailActions}>
              <Chip
                label={detail.phase}
                color={formatPhaseChipColor(detail.phase)}
                className={classes.statusChip}
              />
              {detail.costEstimate && (
                <Chip
                  icon={<AssessmentIcon />}
                  label={`≈ ${detail.costEstimate.currency || 'USD'} ${detail.costEstimate.hourly.toFixed(2)}/hr`}
                />
              )}
              <Tooltip title="Scale node pools">
                <Button startIcon={<LayersIcon />} onClick={handleScale}>
                  Scale node pool
                </Button>
              </Tooltip>
              <Tooltip title="Launch wizard with existing context">
                <Button startIcon={<LaunchIcon />} onClick={handleAddCluster}>
                  Add cluster
                </Button>
              </Tooltip>
            </Box>
            <DetailTabs value={tab} onChange={setTab} />
            <div className={classes.tabPanel}>
              {tab === 0 && (
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Card variant="outlined">
                      <CardHeader title="Metadata" />
                      <CardContent>
                        <List dense>
                          <ListItem>
                            <ListItemIcon>
                              <InfoOutlinedIcon />
                            </ListItemIcon>
                            <ListItemText primary="Project" secondary={detail.projectId} />
                          </ListItem>
                          <ListItem>
                            <ListItemIcon>
                              <CloudQueueIcon />
                            </ListItemIcon>
                            <ListItemText primary="Provider" secondary={detail.provider} />
                          </ListItem>
                          <ListItem>
                            <ListItemIcon>
                              <ScheduleIcon />
                            </ListItemIcon>
                            <ListItemText
                              primary="Last synced"
                              secondary={detail.lastSyncedAt ? new Date(detail.lastSyncedAt).toLocaleString() : '—'}
                            />
                          </ListItem>
                        </List>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Card variant="outlined">
                      <CardHeader title="Conditions" />
                      <CardContent>
                        {detail.conditions && detail.conditions.length > 0 ? (
                          <List dense>
                            {detail.conditions.map((condition: ClusterJobCondition) => (
                              <ListItem key={condition.type}>
                                <ListItemIcon>
                                  {condition.status === 'True' ? (
                                    <CloudDoneIcon color="primary" />
                                  ) : condition.status === 'False' ? (
                                    <ErrorOutlineIcon color="secondary" />
                                  ) : (
                                    <CloudQueueIcon color="action" />
                                  )}
                                </ListItemIcon>
                                <ListItemText
                                  primary={condition.type}
                                  secondary={condition.message || condition.reason || condition.status}
                                />
                              </ListItem>
                            ))}
                          </List>
                        ) : (
                          <Typography>No conditions reported by the controller.</Typography>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              )}
              {tab === 1 && <NodePoolTable nodePools={detail.nodePools} />}
              {tab === 2 && (
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Card variant="outlined">
                      <CardHeader title="Helm release" />
                      <CardContent>
                        <Typography>Namespace: {detail.helm?.namespace || 'aegis-system'}</Typography>
                        <Typography>Chart version: {detail.helm?.chartVersion || 'latest'}</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Card variant="outlined">
                      <CardHeader title="Platform endpoints" />
                      <CardContent>
                        <Typography>
                          API server: {detail.platformOverrides?.apiServer || 'default'}
                        </Typography>
                        <Typography>
                          Metrics: {detail.platformOverrides?.metricsEndpoint || 'default'}
                        </Typography>
                        <Typography>
                          Logging: {detail.platformOverrides?.loggingEndpoint || 'default'}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              )}
              {tab === 3 && (
                <div className={classes.activityList}>
                  <ActivityList activity={detail.activity} />
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export const AegisClustersPage = () => {
  const classes = useStyles();
  const fetchApi = useApi(fetchApiRef);
  const discoveryApi = useApi(discoveryApiRef);
  const identityApi = useApi(identityApiRef);
  const authApi = useApi(keycloakAuthApiRef);
  const navigate = useNavigate();

  const [clusters, setClusters] = useState<ClusterSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usingMockData, setUsingMockData] = useState(false);
  const [filters, setFilters] = useState<FilterState>({ projectId: 'all', region: 'all', mode: 'all' });
  const [selectedCluster, setSelectedCluster] = useState<string | undefined>();

  const loadClusters = useCallback(() => {
    setLoading(true);
    setError(null);
    setUsingMockData(false);
    listClusters(fetchApi, discoveryApi, identityApi, authApi)
      .then((items: ClusterSummary[]) => setClusters(items))
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message.toLowerCase() : '';
        if (
          err instanceof ApiError &&
          (err.status === 405 ||
            err.status === 404 ||
            message.includes('method not allowed') ||
            message.includes('not found'))
        ) {
          setClusters(mockClusterSummaries);
          setUsingMockData(true);
          return;
        }
        setError(err instanceof Error ? err.message : 'Unable to load clusters.');
      })
      .finally(() => setLoading(false));
  }, [authApi, discoveryApi, fetchApi, identityApi]);

  useEffect(() => {
    loadClusters();
  }, [loadClusters]);

  const uniqueProjects = useMemo(() => Array.from(new Set(clusters.map(cluster => cluster.projectId))), [clusters]);
  const uniqueRegions = useMemo(() => Array.from(new Set(clusters.map(cluster => cluster.region))), [clusters]);

  const filteredClusters = useMemo(() => {
    return clusters.filter(cluster => {
      if (filters.projectId !== 'all' && cluster.projectId !== filters.projectId) {
        return false;
      }
      if (filters.region !== 'all' && cluster.region !== filters.region) {
        return false;
      }
      if (filters.mode !== 'all' && cluster.mode !== filters.mode) {
        return false;
      }
      return true;
    });
  }, [clusters, filters]);

  const provisioningCount = useMemo(
    () => filteredClusters.filter(cluster => cluster.phase === 'Provisioning').length,
    [filteredClusters],
  );
  const readyCount = useMemo(
    () => filteredClusters.filter(cluster => cluster.phase === 'Ready').length,
    [filteredClusters],
  );
  const errorCount = useMemo(
    () => filteredClusters.filter(cluster => cluster.phase === 'Error' || cluster.phase === 'Degraded').length,
    [filteredClusters],
  );

  const handleFilterChange = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  return (
    <Page themeId="tool">
      <Content className={classes.root}>
        <ContentHeader title="Clusters">
          <Button color="primary" variant="contained" onClick={() => navigate('/aegis/clusters/create')}>
            New cluster
          </Button>
        </ContentHeader>
        {error && <WarningPanel severity="error" title="Unable to load clusters">{error}</WarningPanel>}
        {usingMockData && !error && (
          <WarningPanel severity="warning" title="Showing sample data">
            The platform API is unavailable in this environment. Displaying staged clusters for UI review.
          </WarningPanel>
        )}
        {loading && <Progress />}
        {!loading && clusters.length === 0 && !error && (
          <Box className={classes.emptyState}>
            <Typography variant="h6">No clusters yet</Typography>
            <Typography>
              Launch your first cluster to see provisioning status, cost hints, and controller feedback
              in one place.
            </Typography>
          </Box>
        )}
        {!loading && clusters.length > 0 && (
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Card className={classes.summaryCard} variant="outlined">
                <CardHeader title="Provisioning" avatar={<TimelineIcon />} />
                <CardContent>
                  <Typography variant="h4">{provisioningCount}</Typography>
                  <Typography variant="body2" color="textSecondary">
                    Cluster specs currently flowing through Pulumi automation.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card className={classes.summaryCard} variant="outlined">
                <CardHeader title="Ready" avatar={<CloudDoneIcon />} />
                <CardContent>
                  <Typography variant="h4">{readyCount}</Typography>
                  <Typography variant="body2" color="textSecondary">
                    Managed clusters available for workspace routing.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card className={classes.summaryCard} variant="outlined">
                <CardHeader title="Attention" avatar={<ErrorOutlineIcon />} />
                <CardContent>
                  <Typography variant="h4">{errorCount}</Typography>
                  <Typography variant="body2" color="textSecondary">
                    Clusters requiring remediation per latest controller conditions.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12}>
              <Card className={classes.filtersCard} variant="outlined">
                <CardHeader title="Filters" avatar={<FilterListIcon />} />
                <CardContent>
                  <div className={classes.filtersRow}>
                    <FormControl>
                      <TextField
                        select
                        label="Project"
                        value={filters.projectId}
                        onChange={event => handleFilterChange('projectId', event.target.value as FilterState['projectId'])}
                      >
                        <MenuItem value="all">All projects</MenuItem>
                        {uniqueProjects.map(project => (
                          <MenuItem key={project} value={project}>
                            {project}
                          </MenuItem>
                        ))}
                      </TextField>
                    </FormControl>
                    <FormControl>
                      <TextField
                        select
                        label="Region"
                        value={filters.region}
                        onChange={event => handleFilterChange('region', event.target.value as FilterState['region'])}
                      >
                        <MenuItem value="all">All regions</MenuItem>
                        {uniqueRegions.map(region => (
                          <MenuItem key={region} value={region}>
                            {region}
                          </MenuItem>
                        ))}
                      </TextField>
                    </FormControl>
                    <FormControl>
                      <TextField
                        select
                        label="Mode"
                        value={filters.mode}
                        onChange={event => handleFilterChange('mode', event.target.value as FilterState['mode'])}
                      >
                        <MenuItem value="all">Provision & import</MenuItem>
                        <MenuItem value="provision">Provision</MenuItem>
                        <MenuItem value="import">Import</MenuItem>
                      </TextField>
                    </FormControl>
                    <Button onClick={loadClusters}>Refresh</Button>
                  </div>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12}>
              <Card className={classes.tableCard} variant="outlined">
                <CardHeader title="Cluster catalog" />
                <CardContent>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Cluster</TableCell>
                        <TableCell>Project</TableCell>
                        <TableCell>Region</TableCell>
                        <TableCell>Mode</TableCell>
                        <TableCell>Phase</TableCell>
                        <TableCell>Latest condition</TableCell>
                        <TableCell>Last sync</TableCell>
                        <TableCell>Cost hint</TableCell>
                        <TableCell align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredClusters.map(cluster => (
                        <TableRow key={cluster.id} hover>
                          <TableCell>
                            <Typography variant="subtitle1">{cluster.name}</Typography>
                            <Typography variant="caption" color="textSecondary">
                              {cluster.provider}
                            </Typography>
                          </TableCell>
                          <TableCell>{cluster.projectId}</TableCell>
                          <TableCell>{cluster.region}</TableCell>
                          <TableCell>{cluster.mode === 'provision' ? 'Provision' : 'Import'}</TableCell>
                          <TableCell>
                            <Chip
                              label={cluster.phase}
                              color={formatPhaseChipColor(cluster.phase)}
                              size="small"
                              className={classes.statusChip}
                            />
                          </TableCell>
                          <TableCell>{cluster.latestCondition?.message || cluster.latestCondition?.type || '—'}</TableCell>
                          <TableCell>
                            {cluster.lastSyncedAt ? new Date(cluster.lastSyncedAt).toLocaleString() : '—'}
                          </TableCell>
                          <TableCell>
                            {cluster.costEstimate
                              ? `${cluster.costEstimate.currency || 'USD'} ${cluster.costEstimate.hourly.toFixed(2)}/hr`
                              : '—'}
                          </TableCell>
                          <TableCell align="right">
                            <Tooltip title="View details">
                              <IconButton onClick={() => setSelectedCluster(cluster.id)}>
                                <LaunchIcon />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}
        <ClusterDetailDialog
          clusterId={selectedCluster}
          open={Boolean(selectedCluster)}
          onClose={() => setSelectedCluster(undefined)}
        />
      </Content>
    </Page>
  );
};
