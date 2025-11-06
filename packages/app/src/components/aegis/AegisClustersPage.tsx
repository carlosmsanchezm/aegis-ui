import React, { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  LinearProgress,
  makeStyles,
  Menu,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@material-ui/core';
import {
  Content,
  ContentHeader,
  Page,
  StatusOK,
  StatusPending,
  StatusError,
} from '@backstage/core-components';
import MoreVertIcon from '@material-ui/icons/MoreVert';
import LaunchIcon from '@material-ui/icons/Launch';
import GetAppIcon from '@material-ui/icons/GetApp';
import DeleteForeverIcon from '@material-ui/icons/DeleteForever';
import AssessmentIcon from '@material-ui/icons/Assessment';
import ReplayIcon from '@material-ui/icons/Replay';
import AddIcon from '@material-ui/icons/Add';
import { useNavigate } from 'react-router-dom';
import { alertApiRef, useApi } from '@backstage/core-plugin-api';
import {
  CLUSTERS,
  ClusterCondition,
  ClusterDetail,
  ClusterPhase,
} from '../../../../../plugins/aegis/src/components/clusterData';

const useStyles = makeStyles(theme => ({
  pageContent: {
    paddingBottom: theme.spacing(6),
  },
  controlBar: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(2),
    marginBottom: theme.spacing(3),
  },
  filterRow: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.spacing(2),
  },
  summaryPaper: {
    padding: theme.spacing(3),
    marginBottom: theme.spacing(3),
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(4),
    justifyContent: 'space-between',
    background:
      theme.palette.type === 'dark'
        ? 'rgba(15, 23, 42, 0.65)'
        : 'linear-gradient(135deg, rgba(246, 248, 252, 0.96), rgba(231, 235, 247, 0.9))',
    border: '1px solid rgba(148, 163, 184, 0.22)',
  },
  tableCard: {
    padding: theme.spacing(3),
    borderRadius: 24,
    border: '1px solid rgba(148, 163, 184, 0.2)',
  },
  conditionChip: {
    marginRight: theme.spacing(1),
    marginBottom: theme.spacing(1),
  },
  statusCell: {
    minWidth: 140,
  },
  actionsCell: {
    width: 60,
  },
  placeholderEmpty: {
    padding: theme.spacing(6),
    textAlign: 'center',
    color: theme.palette.text.secondary,
  },
}));

type MenuAnchor = {
  anchorEl: HTMLElement | null;
  clusterId?: string;
};

const phaseToStatusComponent: Record<ClusterPhase, typeof StatusOK> = {
  Ready: StatusOK,
  Provisioning: StatusPending,
  Error: StatusError,
};

const phaseLabel: Record<ClusterPhase, string> = {
  Ready: 'Ready',
  Provisioning: 'Provisioning',
  Error: 'Error',
};

const formatCurrency = (cost: number) => `$${cost.toFixed(2)}`;

const ConditionBadge = ({
  condition,
  className,
}: {
  condition: ClusterCondition;
  className: string;
}) => {
  const color = condition.status === 'True' ? 'primary' : 'secondary';
  return (
    <Tooltip
      title={`${condition.message} • Last updated ${new Date(condition.lastTransitionTime).toLocaleString()}`}
      arrow
    >
      <Chip size="small" color={color} label={condition.type} className={className} />
    </Tooltip>
  );
};

const ClusterStatus = ({ phase }: { phase: ClusterPhase }) => {
  const StatusComponent = phaseToStatusComponent[phase];
  return (
    <Box display="flex" alignItems="center" style={{ gap: 8 }}>
      <StatusComponent />
      <Typography variant="body1">{phaseLabel[phase]}</Typography>
    </Box>
  );
};

export const AegisClustersPage = () => {
  const classes = useStyles();
  const navigate = useNavigate();
  const alertApi = useApi(alertApiRef);

  const [phaseFilter, setPhaseFilter] = useState<ClusterPhase | 'all'>('all');
  const [regionFilter, setRegionFilter] = useState<string>('all');
  const [menuAnchor, setMenuAnchor] = useState<MenuAnchor>({ anchorEl: null });
  const [destroyTarget, setDestroyTarget] = useState<ClusterDetail | null>(null);

  const regions = useMemo(() => {
    const unique = Array.from(new Set(CLUSTERS.map(cluster => cluster.region))).sort();
    return ['all', ...unique];
  }, []);

  const filteredClusters = useMemo(() => {
    return CLUSTERS.filter(cluster => {
      if (phaseFilter !== 'all' && cluster.phase !== phaseFilter) {
        return false;
      }
      if (regionFilter !== 'all' && cluster.region !== regionFilter) {
        return false;
      }
      return true;
    });
  }, [phaseFilter, regionFilter]);

  const totalHourlyCost = useMemo(
    () => filteredClusters.reduce((acc, cluster) => acc + cluster.costHintPerHour, 0),
    [filteredClusters],
  );

  const handleOpenMenu = (event: React.MouseEvent<HTMLButtonElement>, clusterId: string) => {
    setMenuAnchor({ anchorEl: event.currentTarget, clusterId });
  };

  const handleCloseMenu = () => setMenuAnchor({ anchorEl: null });

  const handleOpenDetail = (clusterId: string) => {
    handleCloseMenu();
    navigate(`/aegis/operations/configuration?clusterId=${clusterId}`);
  };

  const handleDownloadKubeconfig = (cluster: ClusterDetail) => {
    handleCloseMenu();
    alertApi.post({
      severity: 'info',
      message: `Kubeconfig secret ${cluster.kubeconfigSecretKey} referenced. Retrieve via platform secrets store.`,
    });
  };

  const handleDestroyCluster = (cluster: ClusterDetail) => {
    handleCloseMenu();
    setDestroyTarget(cluster);
  };

  const handleDownloadReport = () => {
    const summary = filteredClusters
      .map(cluster => `${cluster.name} (${cluster.region}) – ${formatCurrency(cluster.costHintPerHour)}/h`)
      .join('\n');
    alertApi.post({
      severity: 'info',
      message: `Report generated for ${filteredClusters.length} clusters.\n${summary}`,
    });
  };

  const handleRunHealthCheck = () => {
    alertApi.post({
      severity: 'info',
      message: 'Health check requested. Pulumi refresh will sync state shortly.',
    });
  };

  const selectedCluster = menuAnchor.clusterId
    ? CLUSTERS.find(cluster => cluster.id === menuAnchor.clusterId)
    : undefined;

  return (
    <Page themeId="apis">
      <Content className={classes.pageContent}>
        <ContentHeader title="Cluster fleet">
          <Button
            color="primary"
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/aegis/clusters/create')}
          >
            New cluster
          </Button>
          <Button
            variant="outlined"
            startIcon={<AssessmentIcon />}
            onClick={handleDownloadReport}
          >
            Download report
          </Button>
          <Button
            variant="outlined"
            startIcon={<ReplayIcon />}
            onClick={handleRunHealthCheck}
          >
            Run health check
          </Button>
        </ContentHeader>
        <Paper className={classes.summaryPaper} elevation={0}>
          <Box>
            <Typography variant="overline">Clusters</Typography>
            <Typography variant="h4">{filteredClusters.length}</Typography>
            <Typography variant="body2" color="textSecondary">
              Filtered from {CLUSTERS.length} total
            </Typography>
          </Box>
          <Box>
            <Typography variant="overline">Hourly cost hint</Typography>
            <Typography variant="h4">{formatCurrency(totalHourlyCost)} / h</Typography>
            <Typography variant="body2" color="textSecondary">
              Pulumi CostHintUSDPerHour
            </Typography>
          </Box>
          <Box>
            <Typography variant="overline">Provisioning guidance</Typography>
            <Typography variant="body2">
              Controller messages surface below. Align remediation with backend status.
            </Typography>
          </Box>
        </Paper>
        <div className={classes.controlBar}>
          <div className={classes.filterRow}>
            <TextField
              select
              label="Phase"
              variant="outlined"
              value={phaseFilter}
              onChange={event => setPhaseFilter(event.target.value as ClusterPhase | 'all')}
              helperText="Mirror controller status phases"
            >
              <MenuItem value="all">All phases</MenuItem>
              <MenuItem value="Ready">Ready</MenuItem>
              <MenuItem value="Provisioning">Provisioning</MenuItem>
              <MenuItem value="Error">Error</MenuItem>
            </TextField>
            <TextField
              select
              label="Region"
              variant="outlined"
              value={regionFilter}
              onChange={event => setRegionFilter(event.target.value)}
              helperText="Filter by AWS target region"
            >
              {regions.map(region => (
                <MenuItem key={region} value={region}>
                  {region === 'all' ? 'All regions' : region}
                </MenuItem>
              ))}
            </TextField>
          </div>
        </div>
        {filteredClusters.length === 0 ? (
          <Paper className={classes.placeholderEmpty}>
            <Typography variant="h6">No clusters match the selected filters.</Typography>
            <Typography variant="body2">
              Adjust filters to review provisioning state or launch a new cluster.
            </Typography>
          </Paper>
        ) : (
          <Paper className={classes.tableCard} elevation={0}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Cluster</TableCell>
                  <TableCell>Region</TableCell>
                  <TableCell className={classes.statusCell}>Phase</TableCell>
                  <TableCell>Cost hint (/h)</TableCell>
                  <TableCell>Conditions</TableCell>
                  <TableCell>Latest controller message</TableCell>
                  <TableCell align="right" className={classes.actionsCell}>
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredClusters.map(cluster => {
                  const latestCondition = cluster.conditions[0];
                  return (
                    <TableRow key={cluster.id} hover>
                      <TableCell>
                        <Typography variant="subtitle1">{cluster.name}</Typography>
                        <Typography variant="body2" color="textSecondary">
                          Project {cluster.projectId} · Stack {cluster.pulumiStack}
                        </Typography>
                        {cluster.phase === 'Provisioning' && (
                          <Box mt={1}>
                            <LinearProgress />
                          </Box>
                        )}
                      </TableCell>
                      <TableCell>{cluster.region}</TableCell>
                      <TableCell>
                        <ClusterStatus phase={cluster.phase} />
                      </TableCell>
                      <TableCell>{formatCurrency(cluster.costHintPerHour)}</TableCell>
                      <TableCell>
                        {cluster.conditions.map(condition => (
                          <ConditionBadge
                            key={`${cluster.id}-${condition.type}`}
                            condition={condition}
                            className={classes.conditionChip}
                          />
                        ))}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {latestCondition?.message || 'Awaiting controller update'}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          aria-label="cluster actions"
                          onClick={event => handleOpenMenu(event, cluster.id)}
                        >
                          <MoreVertIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Paper>
        )}
        <Menu
          anchorEl={menuAnchor.anchorEl}
          open={Boolean(menuAnchor.anchorEl)}
          onClose={handleCloseMenu}
        >
          <MenuItem
            onClick={() => selectedCluster && handleOpenDetail(selectedCluster.id)}
          >
            <LaunchIcon fontSize="small" style={{ marginRight: 12 }} /> Open detail
          </MenuItem>
          <MenuItem
            onClick={() => selectedCluster && handleDownloadKubeconfig(selectedCluster)}
            disabled={selectedCluster?.phase !== 'Ready'}
          >
            <GetAppIcon fontSize="small" style={{ marginRight: 12 }} /> Download kubeconfig
          </MenuItem>
          <MenuItem
            onClick={() => selectedCluster && handleDestroyCluster(selectedCluster)}
          >
            <DeleteForeverIcon fontSize="small" style={{ marginRight: 12 }} /> Destroy cluster
          </MenuItem>
        </Menu>
        <Dialog open={Boolean(destroyTarget)} onClose={() => setDestroyTarget(null)}>
          <DialogTitle>Destroy cluster?</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Destroying {destroyTarget?.name} will trigger a Pulumi destroy operation and
              remove associated EKS resources. Confirm you have drained workloads and
              captured any required kubeconfigs before proceeding.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDestroyTarget(null)}>Cancel</Button>
            <Button
              color="secondary"
              onClick={() => {
                if (destroyTarget) {
                  alertApi.post({
                    severity: 'warning',
                    message: `Destroy requested for ${destroyTarget.name}. Pulumi destroy will execute shortly.`,
                  });
                }
                setDestroyTarget(null);
              }}
            >
              Confirm destroy
            </Button>
          </DialogActions>
        </Dialog>
      </Content>
    </Page>
  );
};

export default AegisClustersPage;
