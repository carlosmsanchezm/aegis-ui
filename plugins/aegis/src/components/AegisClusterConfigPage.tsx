import { useState } from 'react';
import {
  Box,
  Button,
  InputLabel,
  FormControl,
  makeStyles,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
} from '@material-ui/core';
import { Content, ContentHeader, HeaderLabel, Page } from '@backstage/core-components';
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
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2.5),
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(2),
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: theme.spacing(2),
  },
  formRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  },
}));

type PolicyState = {
  policyName: string;
  minNodes: number;
  maxNodes: number;
  scalePolicy: 'balanced' | 'aggressive' | 'cost-saving';
};

type MaintenanceState = {
  windowName: string;
  day: string;
  start: string;
  duration: string;
};

const initialPolicy: PolicyState = {
  policyName: 'GovCloud GPU Fleet',
  minNodes: 24,
  maxNodes: 320,
  scalePolicy: 'balanced',
};

const initialMaintenance: MaintenanceState = {
  windowName: 'Weekly Patch Window',
  day: 'Saturday',
  start: '02:00',
  duration: '2h',
};

export const AegisClusterConfigPage = () => {
  const classes = useStyles();
  const alertApi = useApi(alertApiRef);
  const [policy, setPolicy] = useState(initialPolicy);
  const [maintenance, setMaintenance] = useState(initialMaintenance);

  const handleSave = () => {
    alertApi.post({
      severity: 'info',
      message: 'Configuration changes queued for apply',
    });
  };

  return (
    <Page themeId="tool">
      <Content className={classes.root}>
        <ContentHeader title="Cluster Configuration">
          <HeaderLabel label="Policies" value="Autoscale" />
          <HeaderLabel label="Windows" value="Maintenance" />
        </ContentHeader>

        <Paper className={classes.paper}>
          <div className={classes.sectionHeader}>
            <div>
              <Typography variant="h6">Auto-scaling Policy</Typography>
              <Typography variant="body2" color="textSecondary">
                Tune fleet expansion and contraction behaviors.
              </Typography>
            </div>
          </div>
          <div className={classes.formGrid}>
            <div className={classes.formRow}>
              <TextField
                label="Policy name"
                variant="outlined"
                fullWidth
                value={policy.policyName}
                onChange={event => setPolicy(prev => ({ ...prev, policyName: event.target.value }))}
              />
            </div>
            <div className={classes.formRow}>
              <TextField
                label="Minimum nodes"
                type="number"
                variant="outlined"
                fullWidth
                value={policy.minNodes}
                onChange={event =>
                  setPolicy(prev => ({ ...prev, minNodes: Number(event.target.value) || 0 }))
                }
              />
            </div>
            <div className={classes.formRow}>
              <TextField
                label="Maximum nodes"
                type="number"
                variant="outlined"
                fullWidth
                value={policy.maxNodes}
                onChange={event =>
                  setPolicy(prev => ({ ...prev, maxNodes: Number(event.target.value) || 0 }))
                }
              />
            </div>
            <div className={classes.formRow}>
              <FormControl variant="outlined" fullWidth>
                <InputLabel id="policy-mode-select-label">Scaling strategy</InputLabel>
                <Select
                  labelId="policy-mode-select-label"
                  id="policy-mode-select"
                  value={policy.scalePolicy}
                  label="Scaling strategy"
                  onChange={event =>
                    setPolicy(prev => ({
                      ...prev,
                      scalePolicy: event.target.value as PolicyState['scalePolicy'],
                    }))
                  }
                >
                  <MenuItem value="balanced">Balanced</MenuItem>
                  <MenuItem value="aggressive">Aggressive</MenuItem>
                  <MenuItem value="cost-saving">Cost optimized</MenuItem>
                </Select>
              </FormControl>
            </div>
          </div>
        </Paper>

        <Paper className={classes.paper}>
          <div className={classes.sectionHeader}>
            <div>
              <Typography variant="h6">Maintenance Windows</Typography>
              <Typography variant="body2" color="textSecondary">
                Coordinate upgrades with mission schedules.
              </Typography>
            </div>
          </div>
          <div className={classes.formGrid}>
            <div className={classes.formRow}>
              <TextField
                label="Window name"
                variant="outlined"
                fullWidth
                value={maintenance.windowName}
                onChange={event =>
                  setMaintenance(prev => ({ ...prev, windowName: event.target.value }))
                }
              />
            </div>
            <div className={classes.formRow}>
              <FormControl variant="outlined" fullWidth>
                <InputLabel id="maintenance-day-select-label">Day of week</InputLabel>
                <Select
                  labelId="maintenance-day-select-label"
                  id="maintenance-day-select"
                  value={maintenance.day}
                  label="Day of week"
                  onChange={event =>
                    setMaintenance(prev => ({ ...prev, day: event.target.value as string }))
                  }
                >
                  <MenuItem value="Saturday">Saturday</MenuItem>
                  <MenuItem value="Sunday">Sunday</MenuItem>
                  <MenuItem value="Wednesday">Wednesday</MenuItem>
                </Select>
              </FormControl>
            </div>
            <div className={classes.formRow}>
              <TextField
                label="Start time"
                type="time"
                variant="outlined"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={maintenance.start}
                onChange={event =>
                  setMaintenance(prev => ({ ...prev, start: event.target.value }))
                }
              />
            </div>
            <div className={classes.formRow}>
              <TextField
                label="Duration"
                variant="outlined"
                fullWidth
                value={maintenance.duration}
                onChange={event =>
                  setMaintenance(prev => ({ ...prev, duration: event.target.value }))
                }
              />
            </div>
          </div>
          <Box display="flex" justifyContent="flex-end">
            <Button color="primary" variant="contained" onClick={handleSave}>
              Save configuration
            </Button>
          </Box>
        </Paper>
      </Content>
    </Page>
  );
};
