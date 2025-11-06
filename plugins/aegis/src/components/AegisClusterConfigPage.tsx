import React, { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Divider,
  Grid,
  Link,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  makeStyles,
  Paper,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from '@material-ui/core';
import AssignmentIcon from '@material-ui/icons/AssignmentTurnedIn';
import StorageIcon from '@material-ui/icons/Storage';
import LayersIcon from '@material-ui/icons/Layers';
import InfoIcon from '@material-ui/icons/InfoOutlined';
import TimelineIcon from '@material-ui/icons/Timeline';
import FileCopyIcon from '@material-ui/icons/FileCopy';
import LaunchIcon from '@material-ui/icons/Launch';
import { useLocation } from 'react-router-dom';
import { Content, ContentHeader, HeaderLabel, Page } from '@backstage/core-components';
import { alertApiRef, useApi } from '@backstage/core-plugin-api';
import {
  CLUSTERS,
  ClusterActivity,
  ClusterCondition,
  ClusterDetail,
} from './clusterData';

const useStyles = makeStyles(theme => ({
  root: {
    paddingBottom: theme.spacing(6),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(3),
  },
  tabsPaper: {
    borderRadius: theme.shape.borderRadius * 2,
    border: '1px solid rgba(148, 163, 184, 0.25)',
  },
  tabContent: {
    padding: theme.spacing(3),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(3),
  },
  sectionCard: {
    border: '1px solid rgba(148, 163, 184, 0.18)',
    borderRadius: theme.shape.borderRadius * 2,
  },
  conditionChip: {
    marginRight: theme.spacing(1),
    marginBottom: theme.spacing(1),
  },
  nodePoolCard: {
    border: '1px solid rgba(148, 163, 184, 0.22)',
    borderRadius: theme.shape.borderRadius * 2,
    padding: theme.spacing(2),
  },
  activityList: {
    padding: 0,
  },
}));

const ConditionBadges = ({ conditions }: { conditions: ClusterCondition[] }) => {
  const classes = useStyles();
  return (
    <Box display="flex" flexWrap="wrap">
      {conditions.map(condition => (
        <Tooltip
          key={condition.type}
          title={`${condition.message} • Updated ${new Date(condition.lastTransitionTime).toLocaleString()}`}
          arrow
        >
          <Chip
            size="small"
            color={condition.status === 'True' ? 'primary' : 'secondary'}
            label={condition.type}
            className={classes.conditionChip}
          />
        </Tooltip>
      ))}
    </Box>
  );
};

const ActivityTimeline = ({ activity }: { activity: ClusterActivity[] }) => {
  const classes = useStyles();
  return (
    <List className={classes.activityList}>
      {activity.map(event => (
        <ListItem key={event.id} divider>
          <ListItemIcon>
            <TimelineIcon color="primary" />
          </ListItemIcon>
          <ListItemText
            primary={event.title}
            secondary={`${new Date(event.timestamp).toLocaleString()} • ${event.description}`}
          />
        </ListItem>
      ))}
    </List>
  );
};

const NodePoolCard = ({ cluster }: { cluster: ClusterDetail }) => {
  const classes = useStyles();
  return (
    <Grid container spacing={2}>
      {cluster.nodePools.map(pool => (
        <Grid key={`${cluster.id}-${pool.name}`} item xs={12} md={6}>
          <Box className={classes.nodePoolCard}>
            <Typography variant="subtitle1">{pool.name}</Typography>
            <Typography variant="body2" color="textSecondary">
              {pool.instanceType} · {pool.minSize} - {pool.maxSize}
            </Typography>
            {pool.labels && pool.labels.length > 0 && (
              <Box mt={1}>
                <Typography variant="caption" color="textSecondary">
                  Labels
                </Typography>
                <Box display="flex" flexWrap="wrap">
                  {pool.labels.map(label => (
                    <Chip key={label} size="small" label={label} className={classes.conditionChip} />
                  ))}
                </Box>
              </Box>
            )}
            {pool.taints && pool.taints.length > 0 && (
              <Box mt={1}>
                <Typography variant="caption" color="textSecondary">
                  Taints
                </Typography>
                <Box display="flex" flexWrap="wrap">
                  {pool.taints.map(taint => (
                    <Chip key={taint} size="small" label={taint} className={classes.conditionChip} />
                  ))}
                </Box>
              </Box>
            )}
          </Box>
        </Grid>
      ))}
    </Grid>
  );
};

export const AegisClusterConfigPage = () => {
  const classes = useStyles();
  const alertApi = useApi(alertApiRef);
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const requestedClusterId = params.get('clusterId');
  const [activeTab, setActiveTab] = useState(0);

  const cluster = useMemo<ClusterDetail | undefined>(() => {
    if (requestedClusterId) {
      return CLUSTERS.find(item => item.id === requestedClusterId) ?? CLUSTERS[0];
    }
    return CLUSTERS[0];
  }, [requestedClusterId]);

  const handleCopySecret = async (secret: string) => {
    try {
      await navigator.clipboard.writeText(secret);
      alertApi.post({
        severity: 'success',
        message: `Copied ${secret} to clipboard. Retrieve via secrets integration to download the kubeconfig.`,
      });
    } catch (err) {
      alertApi.post({
        severity: 'error',
        message: 'Unable to copy to clipboard in this environment. Reference the secret manually.',
      });
    }
  };

  if (!cluster) {
    return (
      <Page themeId="tool">
        <Content className={classes.root}>
          <ContentHeader title="Cluster configuration" />
          <Paper className={classes.tabContent}>
            <Typography variant="h6">Cluster not found</Typography>
            <Typography variant="body2">
              The requested cluster is unavailable. Return to the fleet overview and select a different cluster.
            </Typography>
          </Paper>
        </Content>
      </Page>
    );
  }

  return (
    <Page themeId="tool">
      <Content className={classes.root}>
        <ContentHeader title={`Cluster · ${cluster.name}`}>
          <HeaderLabel label="Project" value={cluster.projectId} />
          <HeaderLabel label="Region" value={cluster.region} />
          <HeaderLabel label="Pulumi stack" value={cluster.pulumiStack} />
        </ContentHeader>
        <Paper className={classes.tabsPaper} elevation={0}>
          <Tabs
            value={activeTab}
            onChange={(_, value) => setActiveTab(value)}
            indicatorColor="primary"
            textColor="primary"
            variant="scrollable"
          >
            <Tab label="Overview" />
            <Tab label="Infrastructure" />
            <Tab label="Access" />
            <Tab label="Integrations" />
            <Tab label="Activity log" />
          </Tabs>
          <Divider />
          <div className={classes.tabContent}>
            {activeTab === 0 && (
              <>
                <Card className={classes.sectionCard} variant="outlined">
                  <CardHeader
                    avatar={<InfoIcon color="primary" />}
                    title="Status overview"
                    subheader="Mirrors controller phases and messages for operators."
                  />
                  <CardContent>
                    <ConditionBadges conditions={cluster.conditions} />
                    <Box mt={2}>
                      <Typography variant="body2" color="textSecondary">
                        Phase: {cluster.phase}. Provisioning events may take several minutes while Pulumi orchestrates resources.
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
                <Card className={classes.sectionCard} variant="outlined">
                  <CardHeader
                    avatar={<TimelineIcon color="primary" />}
                    title="Provisioning timeline"
                    subheader="Combined wizard, Pulumi, and Helm milestones."
                  />
                  <CardContent>
                    <ActivityTimeline activity={cluster.activity} />
                  </CardContent>
                </Card>
              </>
            )}
            {activeTab === 1 && (
              <>
                <Card className={classes.sectionCard} variant="outlined">
                  <CardHeader
                    avatar={<LayersIcon color="primary" />}
                    title="Cluster topology"
                    subheader="Reflects ClusterName and AdditionalClusters payload."
                  />
                  <CardContent>
                    <Typography variant="body1">
                      Primary cluster: {cluster.name}
                    </Typography>
                    {cluster.additionalClusters && cluster.additionalClusters.length > 0 && (
                      <Typography variant="body2" color="textSecondary">
                        Secondary clusters: {cluster.additionalClusters.join(', ')}
                      </Typography>
                    )}
                    <Box mt={2}>
                      <Typography variant="subtitle1">Node pools</Typography>
                      <Typography variant="body2" color="textSecondary">
                        Managed node groups provisioned through Pulumi. Labels and taints align with controller inputs.
                      </Typography>
                    </Box>
                    <NodePoolCard cluster={cluster} />
                  </CardContent>
                </Card>
                <Card className={classes.sectionCard} variant="outlined">
                  <CardHeader
                    avatar={<StorageIcon color="primary" />}
                    title="Tags & role assumptions"
                    subheader="Audit context applied during provisioning."
                  />
                  <CardContent>
                    <Box display="flex" flexWrap="wrap">
                      <Chip label={`Project=${cluster.projectId}`} className={classes.conditionChip} />
                      <Chip label={`Cluster=${cluster.name}`} className={classes.conditionChip} />
                      {cluster.roleArn && (
                        <Chip label={`Role=${cluster.roleArn}`} className={classes.conditionChip} />
                      )}
                      {cluster.vpcId && (
                        <Chip label={`VPC=${cluster.vpcId}`} className={classes.conditionChip} />
                      )}
                    </Box>
                    <Box mt={2}>
                      <Typography variant="body2" color="textSecondary">
                        External ID: {cluster.externalId || 'not provided'}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </>
            )}
            {activeTab === 2 && (
              <>
                <Card className={classes.sectionCard} variant="outlined">
                  <CardHeader
                    avatar={<AssignmentIcon color="primary" />}
                    title="Kubeconfig access"
                    subheader="Retrieve secrets to access the cluster."
                  />
                  <CardContent>
                    <Typography variant="body2">
                      Kubeconfig secret key:{' '}
                      <Chip
                        label={cluster.kubeconfigSecretKey}
                        onClick={() => handleCopySecret(cluster.kubeconfigSecretKey)}
                        onDelete={() => handleCopySecret(cluster.kubeconfigSecretKey)}
                        deleteIcon={<FileCopyIcon />}
                      />
                    </Typography>
                    <Box mt={2}>
                      <Typography variant="body2" color="textSecondary">
                        Download kubeconfigs via the platform secrets store once provisioning is complete. Import mode requires the secret to exist before submitting the wizard.
                      </Typography>
                    </Box>
                    <Box mt={2}>
                      <Button
                        variant="outlined"
                        startIcon={<LaunchIcon />}
                        onClick={() =>
                          alertApi.post({
                            severity: 'info',
                            message: 'Opening documentation for retrieving kubeconfigs from Vault.',
                          })
                        }
                      >
                        View access documentation
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </>
            )}
            {activeTab === 3 && (
              <>
                <Card className={classes.sectionCard} variant="outlined">
                  <CardHeader
                    avatar={<InfoIcon color="primary" />}
                    title="Platform integration"
                    subheader="Helm overrides applied during provisioning."
                  />
                  <CardContent>
                    <List dense>
                      <ListItem>
                        <ListItemIcon>
                          <InfoIcon color="primary" />
                        </ListItemIcon>
                        <ListItemText
                          primary="Platform endpoint"
                          secondary={cluster.platformEndpoint || 'Pulumi default'}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon>
                          <InfoIcon color="primary" />
                        </ListItemIcon>
                        <ListItemText
                          primary="CA bundle"
                          secondary={cluster.caBundleProvided ? 'Provided' : 'Default'}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon>
                          <InfoIcon color="primary" />
                        </ListItemIcon>
                        <ListItemText
                          primary="Custom spoke image"
                          secondary={cluster.spokeImage || 'Default image'}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon>
                          <InfoIcon color="primary" />
                        </ListItemIcon>
                        <ListItemText
                          primary="Values file"
                          secondary={cluster.valuesFile || 'Default chart values'}
                        />
                      </ListItem>
                    </List>
                    <Box mt={2}>
                      <Typography variant="body2" color="textSecondary">
                        Troubleshoot Helm failures using the{' '}
                        <Link
                          href="https://docs.aegis.mil/platform/helm-troubleshooting"
                          target="_blank"
                          rel="noopener"
                        >
                          support guide
                        </Link>
                        .
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </>
            )}
            {activeTab === 4 && (
              <>
                <Card className={classes.sectionCard} variant="outlined">
                  <CardHeader
                    avatar={<TimelineIcon color="primary" />}
                    title="Activity log"
                    subheader="Chronological events mapped from backend telemetry."
                  />
                  <CardContent>
                    <ActivityTimeline activity={cluster.activity} />
                    <Box mt={2}>
                      <Typography variant="body2" color="textSecondary">
                        Missing events? Trigger a health check from the cluster list to request a Pulumi refresh.
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </Paper>
      </Content>
    </Page>
  );
};

export default AegisClusterConfigPage;
