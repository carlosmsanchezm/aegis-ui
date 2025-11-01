import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  Button,
  Chip,
  Grid,
  makeStyles,
  Paper,
  Typography,
} from '@material-ui/core';
import {
  Content,
  ContentHeader,
  HeaderLabel,
  Page,
  Table,
  TableColumn,
} from '@backstage/core-components';
import { alertApiRef, useApi } from '@backstage/core-plugin-api';

const useStyles = makeStyles(theme => ({
  root: {
    paddingBottom: theme.spacing(6),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(4),
  },
  paper: {
    background: 'var(--aegis-card-surface)',
    border: '1px solid var(--aegis-card-border)',
    boxShadow: 'var(--aegis-card-shadow)',
    borderRadius: theme.shape.borderRadius * 2,
    padding: theme.spacing(3),
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  },
  chartPlaceholder: {
    width: '100%',
    height: 220,
    borderRadius: theme.shape.borderRadius * 1.5,
    border: '1px dashed rgba(148, 163, 184, 0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: theme.palette.text.secondary,
    fontStyle: 'italic',
  },
  actionBar: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1.5),
  },
  metadata: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: theme.spacing(2),
  },
  metadataItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
  },
}));

type ResourceDetails = {
  id: string;
  name: string;
  environment: string;
  region: string;
  status: 'Healthy' | 'Warning' | 'Degraded';
  role: string;
  version: string;
  pods: Array<{ name: string; status: string; restarts: number; age: string }>;
};

const resources: ResourceDetails[] = [
  {
    id: 'aurora-west-1',
    name: 'Aurora Control Plane',
    environment: 'Production',
    region: 'us-gov-west-1',
    status: 'Healthy',
    role: 'Scheduler',
    version: 'v1.27.6-aegis.4',
    pods: [
      { name: 'scheduler-0', status: 'Running', restarts: 1, age: '9d' },
      { name: 'scheduler-1', status: 'Running', restarts: 0, age: '9d' },
    ],
  },
  {
    id: 'sentinel-east-2',
    name: 'Sentinel GPU Pool',
    environment: 'Production',
    region: 'us-gov-east-2',
    status: 'Warning',
    role: 'Compute',
    version: 'v1.27.6-aegis.2',
    pods: [
      { name: 'node-manager-0', status: 'Running', restarts: 2, age: '4d' },
      { name: 'node-manager-1', status: 'CrashLoopBackOff', restarts: 6, age: '1d' },
    ],
  },
  {
    id: 'atlas-eu-central',
    name: 'Atlas Data Plane',
    environment: 'Staging',
    region: 'eu-central-1',
    status: 'Healthy',
    role: 'Ingress',
    version: 'v1.27.3-aegis.1',
    pods: [
      { name: 'ingress-0', status: 'Running', restarts: 0, age: '16d' },
      { name: 'ingress-1', status: 'Running', restarts: 0, age: '16d' },
    ],
  },
  {
    id: 'titan-apac',
    name: 'Titan ML Node',
    environment: 'Production',
    region: 'ap-southeast-2',
    status: 'Degraded',
    role: 'GPU',
    version: 'v1.27.2-aegis.6',
    pods: [
      { name: 'gpu-agent-0', status: 'Running', restarts: 3, age: '7h' },
      { name: 'gpu-agent-1', status: 'Error', restarts: 9, age: '30m' },
    ],
  },
];

type PodRow = ResourceDetails['pods'][number];

const getPodStatusColor = (status: string): 'default' | 'primary' | 'secondary' => {
  if (status === 'Running') {
    return 'primary';
  }
  if (status === 'Error' || status === 'CrashLoopBackOff') {
    return 'secondary';
  }
  return 'default';
};

export const AegisResourceDetailsPage = () => {
  const classes = useStyles();
  const { resourceId } = useParams<{ resourceId: string }>();
  const alertApi = useApi(alertApiRef);

  const resource = resources.find(r => r.id === resourceId) ?? resources[0];

  const podColumns = useMemo<TableColumn<PodRow>[]>(
    () => [
      { title: 'Pod', field: 'name' },
      {
        title: 'Status',
        field: 'status',
        render: row => (
          <Chip size="small" label={row.status} color={getPodStatusColor(row.status)} />
        ),
      },
      { title: 'Restarts', field: 'restarts' },
      { title: 'Age', field: 'age' },
    ],
    [],
  );

  const triggerAction = (action: string) => {
    alertApi.post({
      severity: 'info',
      message: `${action} issued for ${resource.name}`,
    });
  };

  return (
    <Page themeId="tool">
      <Content className={classes.root}>
        <ContentHeader title={resource.name}>
          <HeaderLabel label="Environment" value={resource.environment} />
          <HeaderLabel label="Region" value={resource.region} />
          <HeaderLabel label="Version" value={resource.version} />
        </ContentHeader>

        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Paper className={classes.paper}>
              <Typography variant="h6">CPU Utilization</Typography>
              <Typography variant="body2" color="textSecondary">
                Last 6 hours scoped to this resource
              </Typography>
              <div className={classes.chartPlaceholder}>CPU chart placeholder</div>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper className={classes.paper}>
              <Typography variant="h6">GPU Utilization</Typography>
              <Typography variant="body2" color="textSecondary">
                Accelerator load across active workloads
              </Typography>
              <div className={classes.chartPlaceholder}>GPU chart placeholder</div>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper className={classes.paper}>
              <Typography variant="h6">Error Rate</Typography>
              <Typography variant="body2" color="textSecondary">
                Rolling failure rate from telemetry
              </Typography>
              <div className={classes.chartPlaceholder}>Error chart placeholder</div>
            </Paper>
          </Grid>
        </Grid>

        <Paper className={classes.paper}>
          <Typography variant="h6">Control Plane Actions</Typography>
          <Typography variant="body2" color="textSecondary">
            Execute mitigation steps against this resource.
          </Typography>
          <div className={classes.actionBar}>
            <Button variant="contained" color="secondary" onClick={() => triggerAction('Drain Node')}>
              Drain Node
            </Button>
            <Button variant="outlined" color="secondary" onClick={() => triggerAction('Cordon Node')}>
              Cordon Node
            </Button>
            <Button variant="outlined" color="primary" onClick={() => triggerAction('Reboot Node')}>
              Reboot Node
            </Button>
          </div>
        </Paper>

        <Paper className={classes.paper}>
          <Typography variant="h6">Resource Metadata</Typography>
          <div className={classes.metadata}>
            <div className={classes.metadataItem}>
              <Typography variant="caption" color="textSecondary">
                Resource ID
              </Typography>
              <Typography variant="body1">{resource.id}</Typography>
            </div>
            <div className={classes.metadataItem}>
              <Typography variant="caption" color="textSecondary">
                Role
              </Typography>
              <Typography variant="body1">{resource.role}</Typography>
            </div>
            <div className={classes.metadataItem}>
              <Typography variant="caption" color="textSecondary">
                Health
              </Typography>
              <Typography variant="body1">{resource.status}</Typography>
            </div>
          </div>
        </Paper>

        <Paper className={classes.paper}>
          <Table
            options={{ paging: false, search: false, padding: 'dense' }}
            title="Active Pods"
            columns={podColumns}
            data={resource.pods}
          />
        </Paper>
      </Content>
    </Page>
  );
};
