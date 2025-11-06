import React, { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { Content, ContentHeader, InfoCard, Page, WarningPanel } from '@backstage/core-components';
import { alertApiRef, useApi } from '@backstage/core-plugin-api';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import ErrorOutlineIcon from '@material-ui/icons/ErrorOutline';
import TimelineIcon from '@material-ui/icons/Timeline';
import AssignmentIcon from '@material-ui/icons/Assignment';
import CloudQueueIcon from '@material-ui/icons/CloudQueue';
import FileCopyIcon from '@material-ui/icons/FileCopy';

const useStyles = makeStyles(theme => ({
  page: {
    paddingBottom: theme.spacing(6),
  },
  tabPanel: {
    marginTop: theme.spacing(3),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(3),
  },
  chipRow: {
    display: 'flex',
    gap: theme.spacing(1),
    flexWrap: 'wrap',
  },
  timeline: {
    display: 'grid',
    gap: theme.spacing(1.5),
  },
  listCard: {
    display: 'flex',
    flexDirection: 'column',
  },
}));

type NodePool = {
  name: string;
  instanceType: string;
  minSize: number;
  maxSize: number;
  labels?: Record<string, string>;
  taints?: string[];
};

type ClusterDetail = {
  name: string;
  region: string;
  projectId: string;
  phase: 'Ready' | 'Provisioning' | 'Error';
  pulumiStack: string;
  platformEndpoint: string;
  caBundle?: string;
  customImage?: string;
  valuesFile?: string;
  assumeRoleArn?: string;
  assumeRoleExternalId?: string;
  nodePools: NodePool[];
  additionalClusters: { name: string; nodePools: NodePool[] }[];
  costHintPerHour: number;
  statusHistory: { label: string; timestamp: string; status: 'success' | 'warning' | 'error' }[];
  activityLog: { title: string; timestamp: string; actor: string; detail: string }[];
  kubeconfigSecrets: { name: string; key: string; description: string }[];
  helmStatus: { release: string; namespace: string; status: 'deployed' | 'failed' | 'pending'; message: string }[];
};

const cluster: ClusterDetail = {
  name: 'aurora-east',
  region: 'us-east-1',
  projectId: 'mission-alpha',
  phase: 'Ready',
  pulumiStack: 'mission-alpha-us-east-1',
  platformEndpoint: 'https://platform.aegis.svc.cluster.local',
  customImage: 'registry.aegis.dev/spoke:2024.04',
  valuesFile: 's3://aegis-configs/aurora-east-values.yaml',
  assumeRoleArn: 'arn:aws:iam::222233334444:role/AegisPulumiOperator',
  assumeRoleExternalId: 'mission-alpha-cluster',
  nodePools: [
    {
      name: 'default',
      instanceType: 'm6i.large',
      minSize: 1,
      maxSize: 3,
      labels: {
        'node.kubernetes.io/lifecycle': 'on-demand',
      },
    },
    {
      name: 'gpu-heavy',
      instanceType: 'g5.8xlarge',
      minSize: 2,
      maxSize: 6,
      labels: {
        'aegis.ai/workload': 'training',
      },
      taints: ['accelerator=true:PreferNoSchedule'],
    },
  ],
  additionalClusters: [
    {
      name: 'aurora-east-canary',
      nodePools: [
        {
          name: 'canary-default',
          instanceType: 'm6i.large',
          minSize: 1,
          maxSize: 2,
        },
      ],
    },
  ],
  costHintPerHour: 42.5,
  statusHistory: [
    { label: 'Helm deployed', timestamp: '2024-06-02T09:42Z', status: 'success' },
    { label: 'Pulumi apply', timestamp: '2024-06-02T09:33Z', status: 'success' },
    { label: 'Provisioning started', timestamp: '2024-06-02T09:03Z', status: 'warning' },
  ],
  activityLog: [
    {
      title: 'Wizard submission',
      timestamp: '2024-06-02T09:03Z',
      actor: 'sre.maria',
      detail: 'Provisioning request created with import mode disabled.',
    },
    {
      title: 'Pulumi apply',
      timestamp: '2024-06-02T09:33Z',
      actor: 'automation',
      detail: 'Stack mission-alpha-us-east-1 applied with 14 resources updated.',
    },
    {
      title: 'Helm release',
      timestamp: '2024-06-02T09:42Z',
      actor: 'automation',
      detail: 'aegis-platform connected cluster to control plane.',
    },
  ],
  kubeconfigSecrets: [
    {
      name: 'aurora-east-admin',
      key: 'kubeconfig-admin',
      description: 'Administrative access for operators. Mirrors KubeconfigSecretKey.',
    },
    {
      name: 'aurora-east-readonly',
      key: 'kubeconfig-readonly',
      description: 'Limited read-only access for observability pipelines.',
    },
  ],
  helmStatus: [
    {
      release: 'aegis-platform',
      namespace: 'aegis-system',
      status: 'deployed',
      message: 'Healthy – last sync 3m ago',
    },
  ],
};

const statusChipColor: Record<ClusterDetail['phase'], 'primary' | 'secondary' | 'default'> = {
  Ready: 'primary',
  Provisioning: 'secondary',
  Error: 'default',
};

const statusIcon = (status: 'success' | 'warning' | 'error') => {
  switch (status) {
    case 'success':
      return <CheckCircleIcon color="primary" />;
    case 'warning':
      return <TimelineIcon color="secondary" />;
    case 'error':
    default:
      return <ErrorOutlineIcon color="error" />;
  }
};

export const AegisClusterDetailsPage = () => {
  const classes = useStyles();
  const alertApi = useApi(alertApiRef);
  const [tab, setTab] = useState(0);

  const handleCopy = (value: string) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(value).then(() => {
        alertApi.post({ severity: 'info', message: 'Copied to clipboard.' });
      });
    } else {
      alertApi.post({ severity: 'warning', message: value });
    }
  };

  const totalNodePools = useMemo(() => {
    return cluster.nodePools.length + cluster.additionalClusters.reduce((count, c) => count + c.nodePools.length, 0);
  }, []);

  const renderOverview = () => (
    <div className={classes.tabPanel}>
      <Card>
        <CardContent>
          <Typography variant="h5">{cluster.name}</Typography>
          <Box mt={1} className={classes.chipRow}>
            <Chip
              label={cluster.phase}
              color={statusChipColor[cluster.phase]}
              icon={<CloudQueueIcon />}
            />
            <Chip label={cluster.region} variant="outlined" />
            <Chip label={`Project: ${cluster.projectId}`} variant="outlined" />
            <Chip label={`Pulumi: ${cluster.pulumiStack}`} variant="outlined" />
            <Chip label={`$${cluster.costHintPerHour.toFixed(2)}/hr`} variant="default" />
          </Box>
        </CardContent>
      </Card>
      <Card className={classes.listCard}>
        <CardContent>
          <Typography variant="h6">Provisioning timeline</Typography>
          <List>
            {cluster.statusHistory.map(event => (
              <ListItem key={event.label}>
                <ListItemIcon>{statusIcon(event.status)}</ListItemIcon>
                <ListItemText primary={event.label} secondary={event.timestamp} />
              </ListItem>
            ))}
          </List>
        </CardContent>
      </Card>
    </div>
  );

  const renderInfrastructure = () => (
    <div className={classes.tabPanel}>
      <Card>
        <CardContent>
          <Typography variant="h6">Cluster & node pools</Typography>
          <Typography variant="body2" color="textSecondary">
            Mirrors the provisioning object applied by the controller.
          </Typography>
          <Box mt={2}>
            <Typography variant="subtitle2">Primary cluster</Typography>
            {cluster.nodePools.map(pool => (
              <Typography key={pool.name} variant="body1">
                {pool.name} · {pool.instanceType} · {pool.minSize}-{pool.maxSize}
              </Typography>
            ))}
          </Box>
          {cluster.additionalClusters.map(additional => (
            <Box key={additional.name} mt={2}>
              <Typography variant="subtitle2">{additional.name}</Typography>
              {additional.nodePools.map(pool => (
                <Typography key={pool.name} variant="body1">
                  {pool.name} · {pool.instanceType} · {pool.minSize}-{pool.maxSize}
                </Typography>
              ))}
            </Box>
          ))}
          <Box mt={2}>
            <Typography variant="body2" color="textSecondary">
              Total node pools: {totalNodePools}
            </Typography>
          </Box>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <Typography variant="h6">Helm deployments</Typography>
          {cluster.helmStatus.map(release => (
            <Box key={release.release} mb={2}>
              <Typography variant="subtitle1">{release.release}</Typography>
              <Typography variant="body2">Namespace: {release.namespace}</Typography>
              <Typography variant="body2">Status: {release.status}</Typography>
              <Typography variant="body2" color="textSecondary">
                {release.message}
              </Typography>
            </Box>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <Typography variant="h6">Role assumptions & tags</Typography>
          {cluster.assumeRoleArn ? (
            <Box mt={1}>
              <Typography variant="body2">Role ARN: {cluster.assumeRoleArn}</Typography>
              <Typography variant="body2">External ID: {cluster.assumeRoleExternalId}</Typography>
              <Typography variant="body2" color="textSecondary">
                Pulumi runs will assume this role when reconciling resources.
              </Typography>
            </Box>
          ) : (
            <WarningPanel title="No IAM role" severity="warning">
              This cluster provisions with the default project credentials.
            </WarningPanel>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const renderAccess = () => (
    <div className={classes.tabPanel}>
      <Card>
        <CardContent>
          <Typography variant="h6">Kubeconfig secrets</Typography>
          {cluster.kubeconfigSecrets.map(secret => (
            <Box key={secret.key} display="flex" alignItems="center" justifyContent="space-between" mt={2}>
              <div>
                <Typography variant="subtitle1">{secret.name}</Typography>
                <Typography variant="body2" color="textSecondary">
                  {secret.description}
                </Typography>
                <Typography variant="body2">Key: {secret.key}</Typography>
              </div>
              <Tooltip title="Copy secret key">
                <span>
                  <IconButton onClick={() => handleCopy(secret.key)}>
                    <FileCopyIcon />
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
          ))}
          <Box mt={3}>
            <WarningPanel title="Need the kubeconfig file?" severity="info">
              Retrieve the secret from your project namespace or use the download action on the cluster
              list when available.
            </WarningPanel>
          </Box>
        </CardContent>
      </Card>
    </div>
  );

  const renderIntegrations = () => (
    <div className={classes.tabPanel}>
      <InfoCard title="Platform configuration">
        <Typography variant="body1">Endpoint: {cluster.platformEndpoint}</Typography>
        <Typography variant="body1">
          Custom image: {cluster.customImage ?? 'Default platform-managed image'}
        </Typography>
        <Typography variant="body1">Values file: {cluster.valuesFile ?? 'Default Helm values'}</Typography>
      </InfoCard>
      {cluster.caBundle && (
        <Card>
          <CardContent>
            <Typography variant="h6">CA bundle</Typography>
            <Typography variant="body2" color="textSecondary">
              Provided to the Helm release to trust upstream endpoints.
            </Typography>
            <Button onClick={() => handleCopy(cluster.caBundle!)} startIcon={<AssignmentIcon />}>
              Copy CA bundle
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderActivity = () => (
    <div className={classes.tabPanel}>
      <Card>
        <CardContent>
          <Typography variant="h6">Activity log</Typography>
          <List>
            {cluster.activityLog.map(event => (
              <React.Fragment key={event.title + event.timestamp}>
                <ListItem alignItems="flex-start">
                  <ListItemIcon>
                    <TimelineIcon color="action" />
                  </ListItemIcon>
                  <ListItemText
                    primary={`${event.title} · ${event.actor}`}
                    secondary={
                      <>
                        <Typography component="span" variant="body2" color="textPrimary">
                          {event.timestamp}
                        </Typography>
                        {' — '}
                        {event.detail}
                      </>
                    }
                  />
                </ListItem>
                <Divider component="li" />
              </React.Fragment>
            ))}
          </List>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <Page themeId="tool">
      <Content className={classes.page}>
        <ContentHeader title="Cluster detail">
          <Chip label={cluster.phase} color={statusChipColor[cluster.phase]} icon={<CloudQueueIcon />} />
          <Chip label={cluster.region} variant="outlined" />
        </ContentHeader>
        <Tabs value={tab} onChange={(_, value) => setTab(value)} indicatorColor="primary" textColor="primary">
          <Tab label="Overview" />
          <Tab label="Infrastructure" />
          <Tab label="Access" />
          <Tab label="Integrations" />
          <Tab label="Activity log" />
        </Tabs>
        {tab === 0 && renderOverview()}
        {tab === 1 && renderInfrastructure()}
        {tab === 2 && renderAccess()}
        {tab === 3 && renderIntegrations()}
        {tab === 4 && renderActivity()}
      </Content>
    </Page>
  );
};

export default AegisClusterDetailsPage;
