import { useMemo, useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  LinearProgress,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
  makeStyles,
} from '@material-ui/core';
import TrendingDownIcon from '@material-ui/icons/TrendingDown';
import TrendingUpIcon from '@material-ui/icons/TrendingUp';
import TimelineIcon from '@material-ui/icons/Timeline';
import VerifiedUserIcon from '@material-ui/icons/VerifiedUser';
import SecurityIcon from '@material-ui/icons/Security';
import WarningIcon from '@material-ui/icons/Warning';
import PlayCircleOutlineIcon from '@material-ui/icons/PlayCircleOutline';
import MoreVertIcon from '@material-ui/icons/MoreVert';
import UpdateIcon from '@material-ui/icons/Update';
import ScaleIcon from '@material-ui/icons/CallSplit';
import BugReportIcon from '@material-ui/icons/BugReport';
import DiffIcon from '@material-ui/icons/CompareArrows';
import LaunchIcon from '@material-ui/icons/Launch';
import CloudQueueIcon from '@material-ui/icons/CloudQueue';
import { Page, Content, ContentHeader, InfoCard } from '@backstage/core-components';

type ClusterPhase = 'Ready' | 'Provisioning' | 'Error';

interface ClusterRow {
  name: string;
  project: string;
  region: string;
  profile: string;
  phase: ClusterPhase;
  controller: string;
  cost: number;
  costDelta: number;
  drift: 'Clean' | 'Drifted';
  compliance: 'Pass' | 'Warn' | 'Fail';
  complianceScore: number;
  gpu: string;
  lastUpdate: string;
}

const clusters: ClusterRow[] = [
  {
    name: 'aurora-east',
    project: 'Project Aurora',
    region: 'us-gov-west-1 / 345678901234',
    profile: 'atlas-gpu-train@1.4.0',
    phase: 'Ready',
    controller: 'Healthy',
    cost: 212,
    costDelta: -4.2,
    drift: 'Clean',
    compliance: 'Pass',
    complianceScore: 98,
    gpu: '64x H100',
    lastUpdate: '8m ago',
  },
  {
    name: 'sentinel-edge',
    project: 'Sentinel',
    region: 'us-gov-east-1 / 412356789012',
    profile: 'sentinel-general@2.1.1',
    phase: 'Ready',
    controller: 'Upgrade available',
    cost: 148,
    costDelta: 3.1,
    drift: 'Drifted',
    compliance: 'Warn',
    complianceScore: 91,
    gpu: '24x L40S',
    lastUpdate: '14m ago',
  },
  {
    name: 'atlas-mi300x',
    project: 'Atlas',
    region: 'us-gov-west-1 / 245678901234',
    profile: 'atlas-gpu-train@1.3.1',
    phase: 'Provisioning',
    controller: 'Apply running',
    cost: 0,
    costDelta: 0,
    drift: 'Clean',
    compliance: 'Pass',
    complianceScore: 0,
    gpu: '48x MI300X',
    lastUpdate: '45s ago',
  },
  {
    name: 'neptune-a100',
    project: 'Neptune',
    region: 'us-gov-west-1 / 934567890123',
    profile: 'atlas-secure@3.0.0',
    phase: 'Error',
    controller: 'Policy denied',
    cost: 96,
    costDelta: 1.1,
    drift: 'Drifted',
    compliance: 'Fail',
    complianceScore: 76,
    gpu: '40x A100',
    lastUpdate: '2m ago',
  },
];

type FilterState = {
  project: string;
  region: string;
  phase: string;
  profile: string;
  compliance: string;
  drift: string;
};

const defaultFilters: FilterState = {
  project: 'All projects',
  region: 'All regions',
  phase: 'Any phase',
  profile: 'Any profile',
  compliance: 'Any compliance',
  drift: 'All',
};

const filters: Record<keyof FilterState, string[]> = {
  project: ['All projects', 'Project Aurora', 'Sentinel', 'Atlas', 'Neptune'],
  region: ['All regions', 'us-gov-west-1', 'us-gov-east-1'],
  phase: ['Any phase', 'Ready', 'Provisioning', 'Error'],
  profile: ['Any profile', 'atlas-gpu-train', 'sentinel-general', 'atlas-secure'],
  compliance: ['Any compliance', 'Pass', 'Warn', 'Fail'],
  drift: ['All', 'Clean', 'Drifted'],
};

const useStyles = makeStyles(theme => ({
  layout: {
    paddingBottom: theme.spacing(6),
  },
  metricsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: theme.spacing(2),
    marginBottom: theme.spacing(3),
  },
  filterRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: theme.spacing(1.5),
    marginBottom: theme.spacing(2),
  },
  tableCard: {
    padding: theme.spacing(2.5),
  },
  phaseChip: {
    fontWeight: 600,
  },
  driftChip: {
    fontWeight: 600,
  },
  complianceBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  rowActions: {
    display: 'flex',
    gap: theme.spacing(1),
  },
}));

const topMetrics = [
  {
    title: 'Clusters',
    value: '42',
    caption: 'Across GovCloud and on-prem',
    icon: <CloudQueueIcon />,
  },
  {
    title: 'Spend / hr',
    value: '$1.32k',
    caption: '-3.8% vs 24h',
    icon: <TrendingDownIcon color="primary" />,
  },
  {
    title: 'Compliance posture',
    value: '31 pass · 8 warn · 3 fail',
    caption: 'FedRAMP / IL guardrails',
    icon: <VerifiedUserIcon color="primary" />,
  },
  {
    title: 'Active alerts',
    value: '5',
    caption: '2 drift · 3 policy',
    icon: <WarningIcon color="secondary" />,
  },
];

const timelineEvents: Record<string, { label: string; time: string; status: 'ok' | 'running' | 'error' }[]> = {
  'aurora-east': [
    { label: 'Apply complete', time: 'Today · 08:24', status: 'ok' },
    { label: 'Nodepool scale', time: 'Yesterday · 18:10', status: 'ok' },
  ],
  'sentinel-edge': [
    { label: 'Drift detected (policy-pack)', time: 'Today · 07:52', status: 'error' },
    { label: 'Upgrade scheduled', time: 'Today · 06:18', status: 'running' },
  ],
  'atlas-mi300x': [
    { label: 'Plan approved', time: '45s ago', status: 'running' },
  ],
  'neptune-a100': [
    { label: 'Apply failed: Gatekeeper PSP', time: '2m ago', status: 'error' },
    { label: 'Change set created', time: '12m ago', status: 'ok' },
  ],
};

const ClusterActions = ({ cluster }: { cluster: ClusterRow }) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => setAnchorEl(null);

  return (
    <>
      <Button
        variant="outlined"
        color="primary"
        startIcon={<PlayCircleOutlineIcon />}
        onClick={handleOpen}
      >
        Actions
      </Button>
      <Menu anchorEl={anchorEl} open={open} onClose={handleClose}>
        <MenuItem onClick={handleClose}>
          <ScaleIcon fontSize="small" style={{ marginRight: 8 }} /> Scale GPU pool
        </MenuItem>
        <MenuItem onClick={handleClose}>
          <UpdateIcon fontSize="small" style={{ marginRight: 8 }} /> Upgrade Kubernetes
        </MenuItem>
        <MenuItem onClick={handleClose}>
          <DiffIcon fontSize="small" style={{ marginRight: 8 }} /> Generate change set
        </MenuItem>
        <MenuItem onClick={handleClose}>
          <LaunchIcon fontSize="small" style={{ marginRight: 8 }} /> Open details
        </MenuItem>
      </Menu>
    </>
  );
};

const InlineTimeline = ({ clusterId }: { clusterId: string }) => {
  const events = timelineEvents[clusterId] ?? [];

  return (
    <div>
      <Divider style={{ margin: '12px 0' }} />
      <List dense>
        {events.map(event => (
          <ListItem key={event.label}>
            <ListItemAvatar>
              <Avatar>
                {event.status === 'ok' && <TimelineIcon color="primary" />}
                {event.status === 'running' && <TimelineIcon color="action" />}
                {event.status === 'error' && <BugReportIcon color="secondary" />}
              </Avatar>
            </ListItemAvatar>
            <ListItemText
              primary={event.label}
              secondary={event.time}
              primaryTypographyProps={{ variant: 'body2' }}
            />
          </ListItem>
        ))}
      </List>
    </div>
  );
};

export const AegisClustersPage = () => {
  const classes = useStyles();
  const [filterState, setFilterState] = useState<FilterState>(defaultFilters);
  const [expandedRow, setExpandedRow] = useState<string | null>('aurora-east');

  const filteredClusters = useMemo(() => {
    return clusters.filter(cluster => {
      if (
        filterState.project !== 'All projects' &&
        cluster.project !== filterState.project
      ) {
        return false;
      }
      if (filterState.region !== 'All regions' && !cluster.region.includes(filterState.region)) {
        return false;
      }
      if (
        filterState.phase !== 'Any phase' &&
        cluster.phase !== (filterState.phase as ClusterPhase)
      ) {
        return false;
      }
      if (
        filterState.profile !== 'Any profile' &&
        !cluster.profile.startsWith(filterState.profile)
      ) {
        return false;
      }
      if (
        filterState.compliance !== 'Any compliance' &&
        cluster.compliance !== filterState.compliance
      ) {
        return false;
      }
      if (filterState.drift !== 'All' && cluster.drift !== filterState.drift) {
        return false;
      }
      return true;
    });
  }, [filterState]);

  const onFilterChange = (key: keyof FilterState, value: string) => {
    setFilterState(prev => ({ ...prev, [key]: value }));
  };

  const renderCompliance = (cluster: ClusterRow) => {
    const color =
      cluster.compliance === 'Pass'
        ? 'primary'
        : cluster.compliance === 'Warn'
        ? 'secondary'
        : 'default';
    return (
      <div className={classes.complianceBadge}>
        <SecurityIcon color={color} />
        <div>
          <Typography variant="body2">{cluster.compliance}</Typography>
          <Typography variant="caption" color="textSecondary">
            {cluster.complianceScore}% controls satisfied
          </Typography>
        </div>
      </div>
    );
  };

  return (
    <Page themeId="home">
      <Content className={classes.layout}>
        <ContentHeader title="Cluster fleet">
          <Chip label="Realtime" color="primary" />
          <Chip label="IL & FedRAMP aware" variant="outlined" />
        </ContentHeader>

        <div className={classes.metricsRow}>
          {topMetrics.map(metric => (
            <InfoCard key={metric.title} title={metric.title} subheader={metric.caption}>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Typography variant="h4">{metric.value}</Typography>
                {metric.icon}
              </Box>
            </InfoCard>
          ))}
        </div>

        <Paper className={classes.tableCard} variant="outlined">
          <Box className={classes.filterRow}>
            {(Object.keys(filters) as (keyof FilterState)[]).map(key => (
              <Button
                key={key}
                variant="outlined"
                onClick={() => {
                  const current = filters[key];
                  const index = current.indexOf(filterState[key]);
                  const nextValue = current[(index + 1) % current.length];
                  onFilterChange(key, nextValue);
                }}
              >
                <strong>{key}</strong>: {filterState[key]}
              </Button>
            ))}
          </Box>

          <Table size="medium">
            <TableHead>
              <TableRow>
                <TableCell>Cluster</TableCell>
                <TableCell>Project</TableCell>
                <TableCell>Region · Account</TableCell>
                <TableCell>Profile@version</TableCell>
                <TableCell>Phase</TableCell>
                <TableCell>Controller</TableCell>
                <TableCell>$ / hr</TableCell>
                <TableCell>Drift</TableCell>
                <TableCell>Compliance</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredClusters.map(cluster => {
                const isExpanded = expandedRow === cluster.name;
                return (
                  <TableRow key={cluster.name} hover>
                    <TableCell>
                      <Typography variant="subtitle1">{cluster.name}</Typography>
                      <Typography variant="caption" color="textSecondary">
                        GPU {cluster.gpu}
                      </Typography>
                      {isExpanded && <InlineTimeline clusterId={cluster.name} />}
                    </TableCell>
                    <TableCell>{cluster.project}</TableCell>
                    <TableCell>{cluster.region}</TableCell>
                    <TableCell>
                      <Chip label={cluster.profile} color="primary" size="small" />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={cluster.phase}
                        className={classes.phaseChip}
                        color={cluster.phase === 'Ready' ? 'primary' : 'secondary'}
                        variant={cluster.phase === 'Ready' ? 'default' : 'outlined'}
                      />
                      {cluster.phase === 'Provisioning' && <LinearProgress style={{ marginTop: 8 }} />}
                    </TableCell>
                    <TableCell>{cluster.controller}</TableCell>
                    <TableCell>
                      <Box
                        display="flex"
                        alignItems="center"
                        style={{ gap: 4 }}
                      >
                        <Typography variant="body2">${cluster.cost}</Typography>
                        {cluster.costDelta >= 0 ? (
                          <Tooltip title="Cost increased vs last sync">
                            <TrendingUpIcon color="secondary" fontSize="small" />
                          </Tooltip>
                        ) : (
                          <Tooltip title="Cost decreased vs last sync">
                            <TrendingDownIcon color="primary" fontSize="small" />
                          </Tooltip>
                        )}
                        <Typography variant="caption" color="textSecondary">
                          {cluster.costDelta >= 0 ? '+' : ''}
                          {cluster.costDelta}%
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={cluster.drift}
                        className={classes.driftChip}
                        color={cluster.drift === 'Clean' ? 'primary' : 'secondary'}
                        variant={cluster.drift === 'Clean' ? 'outlined' : 'default'}
                        onClick={() => setExpandedRow(isExpanded ? null : cluster.name)}
                      />
                    </TableCell>
                    <TableCell>{renderCompliance(cluster)}</TableCell>
                    <TableCell align="right">
                      <div className={classes.rowActions}>
                        <ClusterActions cluster={cluster} />
                        <IconButton onClick={() => setExpandedRow(isExpanded ? null : cluster.name)}>
                          <MoreVertIcon />
                        </IconButton>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Paper>
      </Content>
    </Page>
  );
};

export default AegisClustersPage;
