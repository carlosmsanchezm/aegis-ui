import React, { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Grid,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { alertApiRef, useApi } from '@backstage/core-plugin-api';
import { Content, ContentHeader, Page, Progress, WarningPanel } from '@backstage/core-components';
import FilterListIcon from '@material-ui/icons/FilterList';
import MoreHorizIcon from '@material-ui/icons/MoreHoriz';
import AssessmentIcon from '@material-ui/icons/Assessment';
import CloudQueueIcon from '@material-ui/icons/CloudQueue';
import GetAppIcon from '@material-ui/icons/GetApp';
import DeleteOutlineIcon from '@material-ui/icons/DeleteOutline';
import RefreshIcon from '@material-ui/icons/Refresh';
import { useNavigate } from 'react-router-dom';

const useStyles = makeStyles(theme => ({
  pageContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(3),
    paddingBottom: theme.spacing(6),
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
  },
  filterBar: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(2),
    alignItems: 'center',
    padding: theme.spacing(2),
    border: '1px solid var(--aegis-card-border, rgba(0,0,0,0.08))',
    borderRadius: theme.shape.borderRadius * 2,
    background: 'var(--aegis-card-surface, #fff)',
  },
  summaryCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
  },
  conditionChips: {
    display: 'flex',
    gap: theme.spacing(1),
    flexWrap: 'wrap',
  },
  statusChip: {
    textTransform: 'uppercase',
    fontWeight: theme.typography.fontWeightBold,
  },
  secondaryText: {
    color: theme.palette.text.secondary,
  },
}));

type ClusterCondition = {
  type: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
};

type ClusterRow = {
  id: string;
  name: string;
  projectId: string;
  region: string;
  account: string;
  phase: 'Ready' | 'Provisioning' | 'Error';
  costHintPerHour: number;
  pulumiStack: string;
  lastUpdated: string;
  conditions: ClusterCondition[];
  hasKubeconfig: boolean;
};

const clusters: ClusterRow[] = [
  {
    id: 'aurora-east',
    name: 'aurora-east',
    projectId: 'mission-alpha',
    region: 'us-east-1',
    account: '222233334444',
    phase: 'Ready',
    costHintPerHour: 42.5,
    pulumiStack: 'mission-alpha-us-east-1',
    lastUpdated: '2m ago',
    hasKubeconfig: true,
    conditions: [
      {
        type: 'Ready',
        message: 'Cluster reconciled and healthy',
        severity: 'info',
      },
    ],
  },
  {
    id: 'sentinel-west',
    name: 'sentinel-west',
    projectId: 'mission-beta',
    region: 'us-west-2',
    account: '555566667777',
    phase: 'Provisioning',
    costHintPerHour: 36.1,
    pulumiStack: 'mission-beta-us-west-2',
    lastUpdated: 'Just now',
    hasKubeconfig: false,
    conditions: [
      {
        type: 'Provisioning',
        message: 'Creating node groups (2/4 complete)',
        severity: 'warning',
      },
      {
        type: 'Helm',
        message: 'Awaiting spoke image pull',
        severity: 'info',
      },
    ],
  },
  {
    id: 'atlas-eu',
    name: 'atlas-eu',
    projectId: 'mission-eu',
    region: 'eu-central-1',
    account: '999900001111',
    phase: 'Error',
    costHintPerHour: 18.7,
    pulumiStack: 'mission-eu-eu-central-1',
    lastUpdated: '12m ago',
    hasKubeconfig: false,
    conditions: [
      {
        type: 'Error',
        message: 'Helm install failed: missing CA bundle',
        severity: 'error',
      },
      {
        type: 'Retry',
        message: 'Controller will retry in 2 minutes',
        severity: 'warning',
      },
    ],
  },
];

const phaseColors: Record<ClusterRow['phase'], 'default' | 'primary' | 'secondary'> = {
  Ready: 'primary',
  Provisioning: 'secondary',
  Error: 'default',
};

const conditionColor = (
  severity: ClusterCondition['severity'],
): 'default' | 'primary' | 'secondary' => {
  switch (severity) {
    case 'error':
      return 'secondary';
    case 'warning':
      return 'default';
    case 'info':
    default:
      return 'primary';
  }
};

export const AegisClustersPage = () => {
  const classes = useStyles();
  const alertApi = useApi(alertApiRef);
  const navigate = useNavigate();

  const [phaseFilter, setPhaseFilter] = useState<'All' | ClusterRow['phase']>('All');
  const [regionFilter, setRegionFilter] = useState<'All' | string>('All');
  const [search, setSearch] = useState('');
  const [actionMenuAnchor, setActionMenuAnchor] = useState<null | HTMLElement>(null);
  const [actionCluster, setActionCluster] = useState<ClusterRow | null>(null);
  const [destroyTarget, setDestroyTarget] = useState<ClusterRow | null>(null);
  const [downloading, setDownloading] = useState(false);

  const regions = useMemo(() => Array.from(new Set(clusters.map(cluster => cluster.region))), []);
  const phases = useMemo(() => Array.from(new Set(clusters.map(cluster => cluster.phase))), []);

  const filteredClusters = useMemo(() => {
    return clusters.filter(cluster => {
      if (phaseFilter !== 'All' && cluster.phase !== phaseFilter) {
        return false;
      }
      if (regionFilter !== 'All' && cluster.region !== regionFilter) {
        return false;
      }
      if (search && !cluster.name.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [phaseFilter, regionFilter, search]);

  const totalHourlyCost = useMemo(
    () => filteredClusters.reduce((sum, cluster) => sum + cluster.costHintPerHour, 0),
    [filteredClusters],
  );

  const openActionMenu = (event: React.MouseEvent<HTMLButtonElement>, cluster: ClusterRow) => {
    setActionMenuAnchor(event.currentTarget);
    setActionCluster(cluster);
  };

  const closeActionMenu = () => {
    setActionMenuAnchor(null);
    setActionCluster(null);
  };

  const handleOpenDetails = () => {
    if (actionCluster) {
      navigate(`/aegis/clusters/${actionCluster.id}`);
    }
    closeActionMenu();
  };

  const handleDownloadKubeconfig = async () => {
    if (!actionCluster) {
      return;
    }
    closeActionMenu();
    if (!actionCluster.hasKubeconfig) {
      alertApi.post({
        severity: 'warning',
        message: 'Kubeconfig not yet available. Provisioning is still in progress.',
      });
      return;
    }
    setDownloading(true);
    setTimeout(() => {
      setDownloading(false);
      alertApi.post({
        severity: 'info',
        message: `Kubeconfig for ${actionCluster.name} downloaded.`,
      });
    }, 800);
  };

  const handleDestroyCluster = () => {
    if (actionCluster) {
      setDestroyTarget(actionCluster);
    }
    closeActionMenu();
  };

  const confirmDestroy = () => {
    if (destroyTarget) {
      alertApi.post({
        severity: 'error',
        message: `Destroying cluster ${destroyTarget.name} via Pulumi destroy.`,
      });
    }
    setDestroyTarget(null);
  };

  const cancelDestroy = () => setDestroyTarget(null);

  const runHealthCheck = () => {
    alertApi.post({
      severity: 'info',
      message: 'Triggered backend refresh. Pulumi refresh job queued.',
    });
  };

  return (
    <Page themeId="apis">
      <Content className={classes.pageContent}>
        <ContentHeader title="Cluster operations">
          <div className={classes.headerActions}>
            <Button startIcon={<AssessmentIcon />} variant="outlined" color="primary">
              Download project report
            </Button>
            <Button startIcon={<RefreshIcon />} variant="contained" color="primary" onClick={runHealthCheck}>
              Run health check
            </Button>
          </div>
        </ContentHeader>

        <Paper className={classes.filterBar} elevation={0}>
          <FilterListIcon color="action" />
          <Typography variant="subtitle2">Filter clusters</Typography>
          <Select
            native
            value={phaseFilter}
            onChange={event => setPhaseFilter(event.target.value as typeof phaseFilter)}
          >
            <option value="All">All phases</option>
            {phases.map(phase => (
              <option key={phase} value={phase}>
                {phase}
              </option>
            ))}
          </Select>
          <Select
            native
            value={regionFilter}
            onChange={event => setRegionFilter(event.target.value as typeof regionFilter)}
          >
            <option value="All">All regions</option>
            {regions.map(region => (
              <option key={region} value={region}>
                {region}
              </option>
            ))}
          </Select>
          <TextField
            placeholder="Search clusters"
            value={search}
            onChange={event => setSearch(event.target.value)}
            variant="outlined"
            size="small"
          />
        </Paper>

        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Card elevation={0}>
              <CardContent className={classes.summaryCard}>
                <Typography variant="subtitle2" className={classes.secondaryText}>
                  Clusters in view
                </Typography>
                <Typography variant="h4">{filteredClusters.length}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card elevation={0}>
              <CardContent className={classes.summaryCard}>
                <Typography variant="subtitle2" className={classes.secondaryText}>
                  Total hourly cost hint
                </Typography>
                <Typography variant="h4">${totalHourlyCost.toFixed(2)}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card elevation={0}>
              <CardContent className={classes.summaryCard}>
                <Typography variant="subtitle2" className={classes.secondaryText}>
                  Active alerts
                </Typography>
                <Typography variant="h4">
                  {filteredClusters.reduce((count, cluster) =>
                    count + cluster.conditions.filter(condition => condition.severity === 'error').length,
                  0)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <TableContainer component={Paper} elevation={0}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Cluster</TableCell>
                <TableCell>Region</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Hourly cost</TableCell>
                <TableCell>Conditions</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredClusters.map(cluster => (
                <TableRow key={cluster.id} hover>
                  <TableCell>
                    <Typography variant="subtitle1">{cluster.name}</Typography>
                    <Typography variant="body2" className={classes.secondaryText}>
                      Project: {cluster.projectId} · Stack: {cluster.pulumiStack}
                    </Typography>
                    <Typography variant="body2" className={classes.secondaryText}>
                      Last update: {cluster.lastUpdated}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body1">{cluster.region}</Typography>
                    <Typography variant="body2" className={classes.secondaryText}>
                      Account {cluster.account}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={cluster.phase}
                      color={phaseColors[cluster.phase]}
                      className={classes.statusChip}
                      icon={<CloudQueueIcon />}
                    />
                  </TableCell>
                  <TableCell>${cluster.costHintPerHour.toFixed(2)}</TableCell>
                  <TableCell>
                    <div className={classes.conditionChips}>
                      {cluster.conditions.map(condition => (
                        <Tooltip key={condition.type} title={condition.message}>
                          <Chip
                            label={condition.type}
                            color={conditionColor(condition.severity)}
                            variant={condition.severity === 'info' ? 'default' : 'outlined'}
                          />
                        </Tooltip>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell align="right">
                    <IconButton onClick={event => openActionMenu(event, cluster)}>
                      <MoreHorizIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filteredClusters.length === 0 && (
            <Box p={4} display="flex" justifyContent="center">
              <WarningPanel title="No clusters found" severity="info">
                Adjust the filters to see matching clusters.
              </WarningPanel>
            </Box>
          )}
        </TableContainer>

        <Menu
          anchorEl={actionMenuAnchor}
          keepMounted
          open={Boolean(actionMenuAnchor)}
          onClose={closeActionMenu}
        >
          <MenuItem onClick={handleOpenDetails}>Open detail</MenuItem>
          <MenuItem onClick={handleDownloadKubeconfig} disabled={downloading}>
            <GetAppIcon fontSize="small" style={{ marginRight: 8 }} /> Download kubeconfig
          </MenuItem>
          <MenuItem onClick={handleDestroyCluster}>
            <DeleteOutlineIcon fontSize="small" style={{ marginRight: 8 }} /> Destroy cluster
          </MenuItem>
        </Menu>

        <Dialog open={Boolean(destroyTarget)} onClose={cancelDestroy}>
          <DialogTitle>Destroy cluster</DialogTitle>
          <DialogContent>
            <DialogContentText>
              This will invoke a Pulumi destroy on stack {destroyTarget?.pulumiStack}. All resources
              created by the provisioning run will be torn down. Continue?
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={cancelDestroy}>Cancel</Button>
            <Button onClick={confirmDestroy} color="secondary" variant="contained">
              Confirm destroy
            </Button>
          </DialogActions>
        </Dialog>

        {downloading && (
          <Box display="flex" alignItems="center" gap={8}>
            <Progress />
            <Typography variant="body2">Preparing kubeconfig download…</Typography>
          </Box>
        )}
      </Content>
    </Page>
  );
};

export default AegisClustersPage;
