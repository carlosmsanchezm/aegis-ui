import { ChangeEvent, FC, useState } from 'react';
import {
  Page,
  Content,
  ContentHeader,
} from '@backstage/core-components';
import {
  Box,
  Button,
  Grid,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
  makeStyles,
} from '@material-ui/core';
import { alertApiRef, useApi } from '@backstage/core-plugin-api';

type AutoscalingPolicy = {
  id: string;
  cluster: string;
  minNodes: number;
  maxNodes: number;
  strategy: 'Balanced' | 'GPU Priority' | 'Cost Optimized';
};

type MaintenanceWindow = {
  id: string;
  cluster: string;
  day: string;
  start: string;
  durationHours: number;
};

const useStyles = makeStyles(theme => ({
  section: {
    backgroundColor: 'var(--aegis-card-surface)',
    border: '1px solid var(--aegis-card-border)',
    boxShadow: 'var(--aegis-card-shadow)',
    padding: theme.spacing(3),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(3),
  },
  fieldRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: theme.spacing(2),
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
}));

const initialPolicies: AutoscalingPolicy[] = [
  {
    id: 'policy-1',
    cluster: 'compute-cluster-a',
    minNodes: 48,
    maxNodes: 160,
    strategy: 'Balanced',
  },
  {
    id: 'policy-2',
    cluster: 'ml-training-east',
    minNodes: 64,
    maxNodes: 240,
    strategy: 'GPU Priority',
  },
  {
    id: 'policy-3',
    cluster: 'edge-fleet-eu',
    minNodes: 24,
    maxNodes: 72,
    strategy: 'Cost Optimized',
  },
];

const initialWindows: MaintenanceWindow[] = [
  {
    id: 'window-1',
    cluster: 'compute-cluster-a',
    day: 'Saturday',
    start: '00:00',
    durationHours: 2,
  },
  {
    id: 'window-2',
    cluster: 'ml-training-east',
    day: 'Sunday',
    start: '02:00',
    durationHours: 3,
  },
  {
    id: 'window-3',
    cluster: 'edge-fleet-eu',
    day: 'Wednesday',
    start: '22:00',
    durationHours: 1,
  },
];

export const AegisClusterConfigPage: FC = () => {
  const classes = useStyles();
  const alertApi = useApi(alertApiRef);
  const [policies, setPolicies] = useState(initialPolicies);
  const [windows, setWindows] = useState(initialWindows);

  const handlePolicyChange = (
    id: string,
    field: keyof AutoscalingPolicy,
    value: number | string,
  ) => {
    setPolicies(prev =>
      prev.map(policy => (policy.id === id ? { ...policy, [field]: value } : policy)),
    );
  };

  const handleWindowChange = (
    id: string,
    field: keyof MaintenanceWindow,
    value: number | string,
  ) => {
    setWindows(prev =>
      prev.map(window => (window.id === id ? { ...window, [field]: value } : window)),
    );
  };

  const handleSave = () => {
    alertApi.post({
      message: 'Configuration changes submitted to the control plane',
      severity: 'info',
    });
  };

  return (
    <Page themeId="tool">
      <Content>
        <ContentHeader title="Cluster Configuration">
          <Typography variant="body1" color="textSecondary">
            Govern autoscaling policies and maintenance windows across clusters.
          </Typography>
        </ContentHeader>

        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Paper className={classes.section}>
              <div className={classes.sectionHeader}>
                <Typography variant="h6">Auto-scaling Policies</Typography>
                <Button variant="outlined" onClick={handleSave}>
                  Save Changes
                </Button>
              </div>

              {policies.map(policy => (
                <Box key={policy.id} className={classes.fieldRow}>
                  <TextField
                    label="Cluster"
                    value={policy.cluster}
                    variant="outlined"
                    size="small"
                    disabled
                  />
                  <TextField
                    label="Min Nodes"
                    type="number"
                    variant="outlined"
                    size="small"
                    value={policy.minNodes}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      handlePolicyChange(policy.id, 'minNodes', Number(event.target.value))
                    }
                  />
                  <TextField
                    label="Max Nodes"
                    type="number"
                    variant="outlined"
                    size="small"
                    value={policy.maxNodes}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      handlePolicyChange(policy.id, 'maxNodes', Number(event.target.value))
                    }
                  />
                  <Select
                    value={policy.strategy}
                    onChange={event =>
                      handlePolicyChange(policy.id, 'strategy', event.target.value as AutoscalingPolicy['strategy'])
                    }
                    variant="outlined"
                  >
                    <MenuItem value="Balanced">Balanced</MenuItem>
                    <MenuItem value="GPU Priority">GPU Priority</MenuItem>
                    <MenuItem value="Cost Optimized">Cost Optimized</MenuItem>
                  </Select>
                </Box>
              ))}
            </Paper>
          </Grid>

          <Grid item xs={12}>
            <Paper className={classes.section}>
              <div className={classes.sectionHeader}>
                <Typography variant="h6">Maintenance Windows</Typography>
                <Button variant="outlined" onClick={handleSave}>
                  Save Changes
                </Button>
              </div>

              {windows.map(window => (
                <Box key={window.id} className={classes.fieldRow}>
                  <TextField
                    label="Cluster"
                    value={window.cluster}
                    variant="outlined"
                    size="small"
                    disabled
                  />
                  <Select
                    value={window.day}
                    onChange={event =>
                      handleWindowChange(window.id, 'day', event.target.value as MaintenanceWindow['day'])
                    }
                    variant="outlined"
                  >
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(
                      day => (
                        <MenuItem key={day} value={day}>
                          {day}
                        </MenuItem>
                      ),
                    )}
                  </Select>
                  <TextField
                    label="Start"
                    type="time"
                    variant="outlined"
                    size="small"
                    value={window.start}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      handleWindowChange(window.id, 'start', event.target.value)
                    }
                    inputProps={{ step: 300 }}
                  />
                  <TextField
                    label="Duration (hours)"
                    type="number"
                    variant="outlined"
                    size="small"
                    value={window.durationHours}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      handleWindowChange(window.id, 'durationHours', Number(event.target.value))
                    }
                  />
                </Box>
              ))}
            </Paper>
          </Grid>
        </Grid>
      </Content>
    </Page>
  );
};

