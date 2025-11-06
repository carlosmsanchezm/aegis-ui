import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import MoreVertIcon from '@material-ui/icons/MoreVert';
import CloudDoneIcon from '@material-ui/icons/CloudDone';
import ReportProblemIcon from '@material-ui/icons/ReportProblem';
import TrendingUpIcon from '@material-ui/icons/TrendingUp';
import UpdateIcon from '@material-ui/icons/Update';
import { Content, ContentHeader, Page } from '@backstage/core-components';
import {
  ClusterAddon,
  ClusterActivityItem,
  ClusterChangeSet,
  ClusterDetail,
  ClusterFleetItem,
  ClusterNodePool,
  ClusterTimelineEvent,
} from '@internal/plugin-aegis';

const useStyles = makeStyles(theme => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(4),
    paddingBottom: theme.spacing(6),
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: theme.spacing(2.5),
  },
  summaryCard: {
    borderRadius: theme.shape.borderRadius * 2,
    border: `1px solid ${theme.palette.divider}`,
    background:
      theme.palette.type === 'dark'
        ? 'rgba(15, 23, 42, 0.85)'
        : 'linear-gradient(135deg, rgba(248,250,255,0.96), rgba(229,234,246,0.85))',
  },
  filters: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: theme.spacing(1.5),
  },
  filterCard: {
    borderRadius: theme.shape.borderRadius * 1.5,
    border: `1px solid ${theme.palette.divider}`,
    padding: theme.spacing(1.5),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  },
  filterLabel: {
    textTransform: 'uppercase',
    fontSize: '0.7rem',
    letterSpacing: '0.14em',
    color: theme.palette.text.secondary,
  },
  filterSelect: {
    width: '100%',
    padding: '10px',
    borderRadius: 12,
    border: '1px solid rgba(148, 163, 184, 0.4)',
    background: 'transparent',
    color: 'inherit',
  },
  tablePaper: {
    borderRadius: theme.shape.borderRadius * 2,
    border: `1px solid ${theme.palette.divider}`,
    overflow: 'hidden',
  },
  table: {
    '& th': {
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      fontSize: '0.75rem',
      color: theme.palette.text.secondary,
    },
  },
  timeline: {
    display: 'flex',
    gap: theme.spacing(1),
    flexWrap: 'wrap',
  },
  drawer: {
    width: 420,
    maxWidth: '100vw',
    display: 'flex',
    flexDirection: 'column',
  },
  drawerHeader: {
    padding: theme.spacing(3),
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  drawerContent: {
    flex: 1,
    overflowY: 'auto',
  },
  tabPanel: {
    padding: theme.spacing(3),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  },
  changeSetCard: {
    padding: theme.spacing(2.5),
    borderRadius: theme.shape.borderRadius * 1.5,
    border: `1px solid ${theme.palette.divider}`,
  },
  costChip: {
    fontWeight: 600,
  },
  flexChips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
  },
  changeSetContainer: {
    padding: theme.spacing(3),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  },
}));

type ClusterFilterState = {
  project: string;
  region: string;
  phase: string;
  profile: string;
  compliance: string;
  drift: string;
};

const initialFilters: ClusterFilterState = {
  project: 'all',
  region: 'all',
  phase: 'all',
  profile: 'all',
  compliance: 'all',
  drift: 'all',
};

const clustersSeed: ClusterDetail[] = [
  {
    id: 'aurora-east-il5',
    name: 'aurora-east',
    project: 'Project Aurora',
    region: 'us-gov-east-1',
    account: '111111111111',
    profileRef: {
      id: 'il5-hardened',
      version: '2.3.1',
      name: 'IL5 – GovCloud Hardened',
    },
    phase: 'Ready',
    controllerCondition: 'Healthy',
    cost: {
      hourly: 62.4,
      deltaPercent: -3.2,
      currency: 'USD',
      topDrivers: [
        { label: 'GPU node pool', hourly: 48.3 },
        { label: 'FSx for Lustre', hourly: 7.4 },
      ],
    },
    drift: 'clean',
    compliance: {
      level: 'IL-5',
      fedramp: 'High',
      passed: 142,
      warnings: 3,
      failed: 0,
      guardrailsEngaged: false,
    },
    timeline: [
      {
        id: 'apply',
        label: 'Apply succeeded',
        status: 'success',
        timestamp: '2024-05-18T12:45:01Z',
      },
      {
        id: 'plan',
        label: 'Plan approved',
        status: 'success',
        timestamp: '2024-05-18T12:12:04Z',
      },
    ],
    labels: {
      compliance: 'IL-5',
      profileRef: 'il5-hardened@2.3.1',
      drift: 'clean',
    },
    description:
      'Primary IL5 GPU training cluster servicing mission workloads with automated compliance evidence.',
    nodePools: [
      {
        id: 'cpu',
        name: 'Control Plane + CPU',
        type: 'cpu',
        instanceType: 'm6i.4xlarge',
        desired: 5,
        min: 3,
        max: 15,
        spotPercentage: 0,
        labels: { role: 'system' },
      },
      {
        id: 'gpu',
        name: 'GPU training (H100)',
        type: 'gpu',
        instanceType: 'p5.48xlarge',
        gpuModel: 'NVIDIA H100',
        desired: 4,
        min: 0,
        max: 8,
        driverVersion: '535.86',
        taints: ['gpu=true:NoSchedule'],
      },
    ],
    addons: [
      { id: 'aegis-agent', name: 'Aegis agent', type: 'operator', version: '1.8.2', status: 'ready' },
      { id: 'opa', name: 'OPA Gatekeeper', type: 'operator', version: '3.13.0', status: 'ready' },
      { id: 'fsx', name: 'FSx CSI', type: 'helm', version: '1.5.4', status: 'ready' },
    ],
    activity: [
      {
        id: 'upgrade-1',
        label: 'K8s patch 1.28.4 applied',
        actor: 'Alex Platform',
        at: '2024-05-10T05:30:00Z',
        status: 'success',
        details: 'Rolling patch with surge=1 succeeded.',
      },
      {
        id: 'scale-1',
        label: 'Scaled GPU pool to 4 nodes',
        actor: 'Mission Control',
        at: '2024-05-12T16:43:00Z',
        status: 'info',
        details: 'Approval granted per budget guardrail.',
      },
    ],
    finops: {
      hourly: 62.4,
      monthlyForecast: 45500,
      recommendations: [
        {
          id: 'gpu-utilization',
          title: 'Enable GPU sleep during idle windows',
          savingsPerMonth: 3200,
          summary: 'Use NVIDIA MIG automation to pause nodes outside mission hours.',
        },
      ],
    },
  },
  {
    id: 'atlas-mi300x',
    name: 'atlas-mi300x',
    project: 'Project Atlas',
    region: 'us-gov-west-1',
    account: '222222222222',
    profileRef: {
      id: 'il4-cost-optimized',
      version: '1.6.0',
      name: 'IL4 – Cost Optimized GPU',
    },
    phase: 'Provisioning',
    controllerCondition: 'Waiting for plan approval',
    cost: {
      hourly: 18.2,
      deltaPercent: 12.4,
      currency: 'USD',
      topDrivers: [
        { label: 'GPU node pool', hourly: 12.8 },
        { label: 'EBS storage', hourly: 3.6 },
      ],
    },
    drift: 'pending',
    compliance: {
      level: 'IL-4',
      fedramp: 'Moderate',
      passed: 108,
      warnings: 4,
      failed: 1,
      guardrailsEngaged: true,
    },
    timeline: [
      { id: 'submit', label: 'Spec submitted', status: 'success', timestamp: '2024-05-18T14:01:00Z' },
      { id: 'plan', label: 'Plan awaiting approval', status: 'running' },
    ],
    labels: {
      compliance: 'IL-4',
      profileRef: 'il4-cost-optimized@1.6.0',
      drift: 'pending',
    },
    description: 'Cost optimized IL4 environment with MI300X GPUs and spot pooling.',
    nodePools: [
      {
        id: 'gpu-spot',
        name: 'GPU training (Spot)',
        type: 'gpu',
        instanceType: 'p4d.24xlarge',
        gpuModel: 'NVIDIA A100',
        desired: 0,
        min: 0,
        max: 6,
        spotPercentage: 85,
      },
    ],
    addons: [
      { id: 'aegis-agent', name: 'Aegis agent', type: 'operator', version: '1.8.2', status: 'ready' },
      { id: 'gpu-operator', name: 'NVIDIA GPU Operator', type: 'operator', version: '23.9.2', status: 'installing' },
    ],
    activity: [],
    finops: {
      hourly: 18.2,
      monthlyForecast: 12500,
      recommendations: [],
    },
  },
  {
    id: 'legacy-a100',
    name: 'legacy-a100',
    project: 'Legacy Mission',
    region: 'us-gov-west-1',
    account: '333333333333',
    profileRef: {
      id: 'legacy-ml',
      version: '1.2.2',
      name: 'Legacy GPU IL5',
    },
    phase: 'Ready',
    controllerCondition: 'Drift detected',
    cost: {
      hourly: 31.6,
      deltaPercent: 6.1,
      currency: 'USD',
      topDrivers: [
        { label: 'GPU node pool', hourly: 24.1 },
        { label: 'Elastic Load Balancer', hourly: 2.8 },
      ],
    },
    drift: 'drifted',
    compliance: {
      level: 'IL-5',
      fedramp: 'High',
      passed: 127,
      warnings: 6,
      failed: 2,
      guardrailsEngaged: true,
    },
    timeline: [
      { id: 'drift', label: 'Drift detected: securityGroupIngress', status: 'warning', timestamp: '2024-05-16T09:22:00Z' },
      { id: 'remediate', label: 'Change set pending approval', status: 'pending' },
    ],
    labels: {
      compliance: 'IL-5',
      profileRef: 'legacy-ml@1.2.2',
      drift: 'drifted',
    },
    description: 'Legacy IL5 cluster scheduled for retirement; drift tracking enabled.',
    nodePools: [
      {
        id: 'gpu-legacy',
        name: 'GPU legacy',
        type: 'gpu',
        instanceType: 'p3.16xlarge',
        gpuModel: 'NVIDIA V100',
        desired: 2,
        min: 2,
        max: 2,
        driverVersion: '470.82',
      },
    ],
    addons: [
      { id: 'aegis-agent', name: 'Aegis agent', type: 'operator', version: '1.8.2', status: 'ready' },
      { id: 'audit-logs', name: 'Audit log forwarder', type: 'system', version: '2024.5', status: 'ready' },
    ],
    activity: [
      {
        id: 'drift-change-set',
        label: 'Generated change set to reconcile security groups',
        actor: 'Platform Bot',
        at: '2024-05-16T09:24:00Z',
        status: 'warning',
      },
    ],
    finops: {
      hourly: 31.6,
      monthlyForecast: 22300,
      recommendations: [
        {
          id: 'retire-cluster',
          title: 'Decommission legacy cluster',
          savingsPerMonth: 22300,
          summary: 'Cluster replaced by IL5 hardened profile; migrate workloads.',
        },
      ],
    },
  },
];

const changeSetsSeed: Record<string, ClusterChangeSet[]> = {
  'legacy-a100': [
    {
      id: 'chg-3421',
      source: 'profile-drift',
      status: 'awaiting-approval',
      createdAt: '2024-05-16T09:24:00Z',
      createdBy: 'Platform Bot',
      diff: 'Security group rule removed on resource sg-12345',
      policyChecks: [
        { id: 'psc-1', status: 'warn', message: 'Ingress rule widens CIDR' },
        { id: 'psc-2', status: 'pass', message: 'FedRAMP logging retained' },
      ],
      approvers: [
        { name: 'Alex Platform', role: 'platform-admin', status: 'pending' },
        { name: 'Maria Security', role: 'auditor', status: 'pending' },
      ],
      impact: [
        {
          type: 'security',
          description: 'Restores baseline security group',
          estimatedDurationMinutes: 15,
          riskLevel: 'low',
        },
      ],
      maintenanceWindow: {
        windowId: 'weekly-maint',
        startsAt: '2024-05-16T23:00:00Z',
        durationMinutes: 60,
      },
    },
  ],
};

const driftLabel: Record<string, { label: string; color: 'default' | 'primary' | 'secondary' }[]> = {
  clean: [{ label: 'Clean', color: 'primary' }],
  drifted: [{ label: 'Drifted', color: 'secondary' }],
  pending: [{ label: 'Pending scan', color: 'default' }],
};

const complianceBadge = (cluster: ClusterFleetItem) => {
  const severity = cluster.compliance.failed > 0 ? 'secondary' : cluster.compliance.warnings > 0 ? 'default' : 'primary';
  const label = `${cluster.compliance.level} · ${cluster.compliance.passed}/${cluster.compliance.passed + cluster.compliance.failed}`;
  return <Chip label={label} color={severity as 'default' | 'primary' | 'secondary'} />;
};

const formatCost = (value: number) => `$${value.toFixed(2)}`;

const formatDelta = (value: number) =>
  `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;

const Timeline = ({ events }: { events: ClusterTimelineEvent[] }) => {
  const classes = useStyles();
  const statusColor = (status: ClusterTimelineEvent['status']) => {
    switch (status) {
      case 'success':
        return 'primary';
      case 'warning':
        return 'secondary';
      case 'error':
        return 'secondary';
      case 'running':
        return 'default';
      default:
        return 'default';
    }
  };
  return (
    <div className={classes.timeline}>
      {events.map(event => (
        <Chip key={event.id} label={event.label} color={statusColor(event.status)} size="small" />
      ))}
    </div>
  );
};

const NodePoolList = ({ nodePools }: { nodePools: ClusterNodePool[] }) => (
  <List dense>
    {nodePools.map(pool => (
      <ListItem key={pool.id} divider>
        <ListItemText
          primary={`${pool.name} · ${pool.instanceType}`}
          secondary={`Desired ${pool.desired} · ${pool.min}-${pool.max} ${pool.type.toUpperCase()}$${pool.spotPercentage ? ` · Spot ${pool.spotPercentage}%` : ''}${pool.gpuModel ? ` · ${pool.gpuModel}` : ''}`}
        />
      </ListItem>
    ))}
  </List>
);

const ChangeSetCard = ({ changeSet }: { changeSet: ClusterChangeSet }) => {
  const classes = useStyles();
  return (
    <Paper className={classes.changeSetCard}>
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Typography variant="subtitle1">Change set {changeSet.id}</Typography>
        <Chip label={changeSet.status} size="small" color={changeSet.status.includes('approval') ? 'secondary' : 'primary'} />
      </Box>
      <Typography variant="body2" color="textSecondary">
        {changeSet.diff}
      </Typography>
      <Divider style={{ margin: '16px 0' }} />
      <Typography variant="subtitle2">Policy checks</Typography>
      <List dense>
        {changeSet.policyChecks.map((check: ClusterChangeSet['policyChecks'][number]) => (
          <ListItem key={check.id}>
            <ListItemText primary={check.message} secondary={check.status.toUpperCase()} />
          </ListItem>
        ))}
      </List>
      <Typography variant="subtitle2">Approvals</Typography>
      <List dense>
        {changeSet.approvers.map((approver: ClusterChangeSet['approvers'][number]) => (
          <ListItem key={approver.name}>
            <ListItemText
              primary={approver.name}
              secondary={`${approver.role} · ${approver.status}`}
            />
          </ListItem>
        ))}
      </List>
    </Paper>
  );
};

const applyFilters = (clusters: ClusterFleetItem[], filters: ClusterFilterState) =>
  clusters.filter(cluster => {
    if (filters.project !== 'all' && cluster.project !== filters.project) {
      return false;
    }
    if (filters.region !== 'all' && cluster.region !== filters.region) {
      return false;
    }
    if (filters.phase !== 'all' && cluster.phase !== filters.phase) {
      return false;
    }
    if (filters.profile !== 'all' && cluster.profileRef?.id !== filters.profile) {
      return false;
    }
    if (filters.compliance !== 'all' && cluster.compliance.level !== filters.compliance) {
      return false;
    }
    if (filters.drift !== 'all' && cluster.drift !== filters.drift) {
      return false;
    }
    return true;
  });

export const AegisClustersPage = () => {
  const classes = useStyles();
  const [filters, setFilters] = useState(initialFilters);
  const [detailCluster, setDetailCluster] = useState<ClusterDetail | null>(null);
  const [selectedTab, setSelectedTab] = useState(0);
  const [actionAnchor, setActionAnchor] = useState<null | HTMLElement>(null);

  const filtered = useMemo(() => applyFilters(clustersSeed, filters), [filters]);

  useEffect(() => {
    if (detailCluster) {
      setSelectedTab(0);
    }
  }, [detailCluster?.id]);

  const totals = useMemo(() => {
    const totalHourly = filtered.reduce((acc, cluster) => acc + cluster.cost.hourly, 0);
    const totalAlerts = filtered.reduce(
      (acc, cluster) => acc + (cluster.compliance.failed > 0 ? 1 : 0),
      0,
    );
    const drifted = filtered.filter(cluster => cluster.drift === 'drifted').length;
    return {
      total: filtered.length,
      cost: totalHourly,
      alerts: totalAlerts,
      drifted,
    };
  }, [filtered]);

  const handleActionMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
    setActionAnchor(event.currentTarget);
  };

  const closeActionMenu = () => {
    setActionAnchor(null);
  };

  const actionItems = [
    'Scale GPU pool',
    'Upgrade Kubernetes',
    'Rotate AMIs/drivers',
    'Generate change set',
    'Download kubeconfig',
    'Destroy cluster',
  ];

  return (
    <Page themeId="tool">
      <Content className={classes.root}>
        <ContentHeader title="Fleet">
          <Chip color="primary" label={`${totals.total} clusters`} />
          <Chip
            icon={<TrendingUpIcon />}
            label={`$${totals.cost.toFixed(1)} / hr`}
            className={classes.costChip}
            variant="outlined"
          />
          <Chip icon={<ReportProblemIcon />} label={`${totals.alerts} compliance alerts`} />
          <Chip icon={<UpdateIcon />} label={`${totals.drifted} drifted`} variant="outlined" />
        </ContentHeader>

        <div className={classes.summaryGrid}>
          <Card className={classes.summaryCard}>
            <CardContent>
              <Typography color="textSecondary">Clusters</Typography>
              <Typography variant="h4">{totals.total}</Typography>
              <Typography variant="body2" color="textSecondary">
                Filtered view across projects and regions
              </Typography>
            </CardContent>
          </Card>
          <Card className={classes.summaryCard}>
            <CardContent>
              <Typography color="textSecondary">Spend velocity</Typography>
              <Typography variant="h4">${totals.cost.toFixed(1)} / hr</Typography>
              <Typography variant="body2" color="textSecondary">
                Includes autoscaler baseline adjustments
              </Typography>
            </CardContent>
          </Card>
          <Card className={classes.summaryCard}>
            <CardContent>
              <Typography color="textSecondary">Compliance posture</Typography>
              <Typography variant="h4">{totals.alerts === 0 ? 'Pass' : 'Attention'}</Typography>
              <Typography variant="body2" color="textSecondary">
                {totals.alerts === 0
                  ? 'All clusters meeting IL/FedRAMP guardrails'
                  : `${totals.alerts} clusters with failing controls`}
              </Typography>
            </CardContent>
          </Card>
          <Card className={classes.summaryCard}>
            <CardContent>
              <Typography color="textSecondary">Drift</Typography>
              <Typography variant="h4">{totals.drifted}</Typography>
              <Typography variant="body2" color="textSecondary">
                Clusters requiring reconciliation or override
              </Typography>
            </CardContent>
          </Card>
        </div>

        <div className={classes.filters}>
          {(
            [
              ['project', 'Project'],
              ['region', 'Region'],
              ['phase', 'Phase'],
              ['profile', 'Profile'],
              ['compliance', 'Compliance level'],
              ['drift', 'Drift'],
            ] as Array<[keyof ClusterFilterState, string]>
          ).map(([key, label]) => (
            <div key={key} className={classes.filterCard}>
              <span className={classes.filterLabel}>{label}</span>
              <select
                aria-label={label}
                value={filters[key]}
                onChange={event =>
                  setFilters(prev => ({
                    ...prev,
                    [key]: event.target.value,
                  }))
                }
                className={classes.filterSelect}
              >
                <option value="all">All</option>
                {[...new Set(
                  clustersSeed
                    .map(cluster => {
                      if (key === 'profile') {
                        return cluster.profileRef?.id || 'unassigned';
                      }
                      return cluster[key as keyof ClusterDetail] as string;
                    })
                    .filter(Boolean),
                )].map(value => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>

        <Paper className={classes.tablePaper}>
          <Table className={classes.table}>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Project</TableCell>
                <TableCell>Region / Account</TableCell>
                <TableCell>Profile@version</TableCell>
                <TableCell>Phase</TableCell>
                <TableCell>$ / hr (Δ)</TableCell>
                <TableCell>Drift</TableCell>
                <TableCell>Compliance</TableCell>
                <TableCell>Timeline</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map(cluster => (
                <TableRow key={cluster.id} hover onClick={() => setDetailCluster(cluster)}>
                  <TableCell>
                    <Typography variant="subtitle1">{cluster.name}</Typography>
                    <Typography variant="body2" color="textSecondary">
                      {cluster.controllerCondition}
                    </Typography>
                  </TableCell>
                  <TableCell>{cluster.project}</TableCell>
                  <TableCell>
                    <div>{cluster.region}</div>
                    <Typography variant="caption" color="textSecondary">
                      {cluster.account}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {cluster.profileRef ? (
                      <Chip
                        icon={<CloudDoneIcon />}
                        label={`${cluster.profileRef.name}@${cluster.profileRef.version}`}
                        size="small"
                      />
                    ) : (
                      <Chip label="Unassigned" size="small" />
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip label={cluster.phase} color={cluster.phase === 'Ready' ? 'primary' : 'default'} size="small" />
                  </TableCell>
                  <TableCell>
                    <Typography>{formatCost(cluster.cost.hourly)}</Typography>
                    <Typography variant="caption" color={cluster.cost.deltaPercent >= 0 ? 'error' : 'primary'}>
                      {formatDelta(cluster.cost.deltaPercent)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {driftLabel[cluster.drift].map(item => (
                      <Chip key={item.label} label={item.label} color={item.color} size="small" />
                    ))}
                  </TableCell>
                  <TableCell>{complianceBadge(cluster)}</TableCell>
                  <TableCell>
                    <Timeline events={cluster.timeline} />
                  </TableCell>
                  <TableCell align="right" onClick={event => event.stopPropagation()}>
                    <IconButton size="small" onClick={event => handleActionMenu(event)}>
                      <MoreVertIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>

        <Menu anchorEl={actionAnchor} open={Boolean(actionAnchor)} onClose={closeActionMenu}>
          {actionItems.map(item => (
            <MenuItem key={item} onClick={closeActionMenu}>
              {item}
            </MenuItem>
          ))}
        </Menu>
      </Content>

      <Drawer
        anchor="right"
        open={Boolean(detailCluster)}
        onClose={() => setDetailCluster(null)}
        classes={{ paper: classes.drawer }}
      >
        {detailCluster ? (
          <>
            <div className={classes.drawerHeader}>
              <Typography variant="h6">{detailCluster.name}</Typography>
              <Typography variant="body2" color="textSecondary">
                {detailCluster.description}
              </Typography>
              <div className={classes.flexChips} style={{ marginTop: 12 }}>
                <Chip label={detailCluster.project} size="small" />
                <Chip label={detailCluster.region} size="small" />
                {detailCluster.profileRef && (
                  <Chip
                    label={`Profile ${detailCluster.profileRef.version}`}
                    size="small"
                    color="primary"
                  />
                )}
              </div>
            </div>
            <div className={classes.drawerContent}>
              <Tabs
                value={selectedTab}
                onChange={(_, value) => setSelectedTab(value)}
                indicatorColor="primary"
                textColor="primary"
                variant="scrollable"
              >
                <Tab label="Overview" />
                <Tab label="Node pools" />
                <Tab label="Add-ons" />
                <Tab label="Activity" />
                <Tab label="Compliance" />
                <Tab label="FinOps" />
              </Tabs>
              <Divider />
              <div className={classes.tabPanel}>
                {selectedTab === 0 && (
                  <>
                    <Typography variant="subtitle1">Operational status</Typography>
                    <Typography variant="body2" color="textSecondary">
                      Phase: {detailCluster.phase} · Controller: {detailCluster.controllerCondition}
                    </Typography>
                    <Typography variant="subtitle1">Day-2 operations</Typography>
                    <Button variant="outlined" color="primary">
                      Generate change set
                    </Button>
                    <div className={classes.flexChips}>
                      <Button variant="outlined">Reconcile to profile</Button>
                      <Button variant="outlined">Accept drift</Button>
                    </div>
                    <Typography variant="subtitle1">Guardrails</Typography>
                    <Typography variant="body2" color="textSecondary">
                      {detailCluster.compliance.guardrailsEngaged
                        ? 'Guardrails engaged · privileged pod attempts are blocked.'
                        : 'Guardrails nominal'}
                    </Typography>
                  </>
                )}
                {selectedTab === 1 && <NodePoolList nodePools={detailCluster.nodePools} />}
                {selectedTab === 2 && (
                  <List dense>
                    {detailCluster.addons.map((addon: ClusterAddon) => (
                      <ListItem key={addon.id} divider>
                        <ListItemText
                          primary={`${addon.name} (${addon.version})`}
                          secondary={`Type ${addon.type} · Status ${addon.status}`}
                        />
                      </ListItem>
                    ))}
                  </List>
                )}
                {selectedTab === 3 && (
                  <List dense>
                    {detailCluster.activity.map((entry: ClusterActivityItem) => (
                      <ListItem key={entry.id} divider>
                        <ListItemText
                          primary={`${entry.label} – ${entry.status}`}
                          secondary={`${entry.actor} · ${new Date(entry.at).toLocaleString()}`}
                        />
                      </ListItem>
                    ))}
                  </List>
                )}
                {selectedTab === 4 && (
                  <>
                    <Typography variant="subtitle1">Controls</Typography>
                    <Typography variant="body2" color="textSecondary">
                      {detailCluster.compliance.passed} pass · {detailCluster.compliance.warnings}{' '}
                      warn · {detailCluster.compliance.failed} fail
                    </Typography>
                    <Button variant="outlined">Export attestation bundle</Button>
                  </>
                )}
                {selectedTab === 5 && (
                  <>
                    <Typography variant="subtitle1">Cost insight</Typography>
                    <Typography variant="body2" color="textSecondary">
                      Hourly {formatCost(detailCluster.finops.hourly)} · Forecast ${detailCluster.finops.monthlyForecast.toLocaleString()}
                    </Typography>
                    <Typography variant="subtitle1">Recommendations</Typography>
                    <List dense>
                      {detailCluster.finops.recommendations.map(rec => (
                        <ListItem key={rec.id} divider>
                          <ListItemText
                            primary={`${rec.title} – save $${rec.savingsPerMonth.toLocaleString()}/mo`}
                            secondary={rec.summary}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </>
                )}
              </div>

              {changeSetsSeed[detailCluster.id]?.length ? (
                <div className={classes.changeSetContainer}>
                  <Typography variant="subtitle1">Pending change sets</Typography>
                  {changeSetsSeed[detailCluster.id].map(changeSet => (
                    <ChangeSetCard key={changeSet.id} changeSet={changeSet} />
                  ))}
                </div>
              ) : null}
            </div>
          </>
        ) : null}
      </Drawer>
    </Page>
  );
};

