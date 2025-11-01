import { ChangeEvent, FC, useMemo, useState } from 'react';
import {
  Page,
  Content,
  ContentHeader,
  HeaderLabel,
  Table,
  TableColumn,
} from '@backstage/core-components';
import {
  Box,
  Button,
  FormControl,
  Grid,
  InputLabel,
  makeStyles,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
} from '@material-ui/core';

const useStyles = makeStyles(theme => ({
  pageContent: {
    paddingBottom: theme.spacing(6),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(3),
  },
  tableSection: {
    padding: theme.spacing(3),
    background: 'var(--aegis-card-surface)',
    border: '1px solid var(--aegis-card-border)',
    boxShadow: 'var(--aegis-card-shadow)',
    borderRadius: theme.shape.borderRadius * 2,
  },
  formSection: {
    padding: theme.spacing(3),
    background: 'var(--aegis-card-surface)',
    border: '1px solid var(--aegis-card-border)',
    boxShadow: 'var(--aegis-card-shadow)',
    borderRadius: theme.shape.borderRadius * 2,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2.5),
  },
  actions: {
    display: 'flex',
    gap: theme.spacing(1.5),
    justifyContent: 'flex-end',
  },
}));

type QuotaRow = {
  project: string;
  budget: number;
  maxGpuHours: number;
  currentSpend: number;
  currentGpuHours: number;
  alertThreshold: '80%' | '90%' | '95%';
  resetCadence: 'Monthly' | 'Quarterly';
};

const initialQuotas: QuotaRow[] = [
  {
    project: 'Atlas-Discovery',
    budget: 95000,
    maxGpuHours: 4800,
    currentSpend: 64210,
    currentGpuHours: 3125,
    alertThreshold: '90%',
    resetCadence: 'Monthly',
  },
  {
    project: 'Sentinel-Intel',
    budget: 88000,
    maxGpuHours: 4200,
    currentSpend: 59830,
    currentGpuHours: 2810,
    alertThreshold: '95%',
    resetCadence: 'Monthly',
  },
  {
    project: 'Trident-Recon',
    budget: 76000,
    maxGpuHours: 3600,
    currentSpend: 48740,
    currentGpuHours: 2265,
    alertThreshold: '90%',
    resetCadence: 'Quarterly',
  },
  {
    project: 'Helios-Analytics',
    budget: 69000,
    maxGpuHours: 3250,
    currentSpend: 41325,
    currentGpuHours: 1980,
    alertThreshold: '80%',
    resetCadence: 'Monthly',
  },
  {
    project: 'Bastion-Lab',
    budget: 52000,
    maxGpuHours: 2400,
    currentSpend: 33810,
    currentGpuHours: 1620,
    alertThreshold: '90%',
    resetCadence: 'Quarterly',
  },
];

export const AegisQuotaManagementPage: FC = () => {
  const classes = useStyles();
  const [rows, setRows] = useState<QuotaRow[]>(initialQuotas);
  const [editing, setEditing] = useState<QuotaRow | null>(null);
  const [form, setForm] = useState<QuotaRow | null>(null);

  const columns = useMemo<TableColumn<QuotaRow>[]>(
    () => [
      { title: 'Project', field: 'project' },
      {
        title: 'Budget ($)',
        field: 'budget',
        render: row => `$${row.budget.toLocaleString()}`,
      },
      {
        title: 'Max GPU Hours',
        field: 'maxGpuHours',
        render: row => row.maxGpuHours.toLocaleString(),
      },
      {
        title: 'Current Spend ($)',
        field: 'currentSpend',
        render: row => `$${row.currentSpend.toLocaleString()}`,
      },
      {
        title: 'Current GPU Hours',
        field: 'currentGpuHours',
        render: row => row.currentGpuHours.toLocaleString(),
      },
      {
        title: 'Actions',
        field: 'actions',
        sorting: false,
        render: row => (
          <Button
            variant="outlined"
            size="small"
            onClick={() => {
              setEditing(row);
              setForm({ ...row });
            }}
          >
            Edit
          </Button>
        ),
      },
    ],
    [],
  );

  const handleFieldChange = (
    field: keyof QuotaRow,
    value: string | number | QuotaRow['alertThreshold'] | QuotaRow['resetCadence'],
  ) => {
    if (!form) {
      return;
    }
    setForm({ ...form, [field]: value });
  };

  const handleNumberChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    const numericValue = Number(value);
    handleFieldChange(name as keyof QuotaRow, Number.isNaN(numericValue) ? 0 : numericValue);
  };

  const handleSelectChange = (
    field: 'alertThreshold' | 'resetCadence',
    value: QuotaRow['alertThreshold'] | QuotaRow['resetCadence'],
  ) => {
    handleFieldChange(field, value);
  };

  const handleCancel = () => {
    setEditing(null);
    setForm(null);
  };

  const handleSave = () => {
    if (!form) {
      return;
    }
    setRows(prev =>
      prev.map(row => (row.project === form.project ? { ...row, ...form } : row)),
    );
    setEditing(null);
    setForm(null);
  };

  return (
    <Page themeId="tool">
      <Content className={classes.pageContent}>
        <ContentHeader title="Quota Management">
          <HeaderLabel label="Policies" value="GPU & Cost Guards" />
          <HeaderLabel label="Projects" value={`${rows.length}`} />
        </ContentHeader>

        <Paper className={classes.tableSection}>
          <Typography variant="h6" gutterBottom>
            Quota & Budget Overview
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Review project budgets and GPU hour ceilings to enforce platform guardrails.
          </Typography>
          <Box mt={2}>
            <Table
              title="Project Quotas"
              options={{ paging: false, search: false, toolbar: false }}
              columns={columns}
              data={rows}
            />
          </Box>
        </Paper>

        {editing && form && (
          <Paper className={classes.formSection}>
            <Typography variant="h6">Adjust Quota</Typography>
            <Typography variant="body2" color="textSecondary">
              Update limits and alerting thresholds for {editing.project}.
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  variant="outlined"
                  size="small"
                  label="Budget ($)"
                  name="budget"
                  type="number"
                  value={form.budget}
                  onChange={handleNumberChange}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  variant="outlined"
                  size="small"
                  label="Max GPU Hours"
                  name="maxGpuHours"
                  type="number"
                  value={form.maxGpuHours}
                  onChange={handleNumberChange}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  variant="outlined"
                  size="small"
                  label="Current Spend ($)"
                  name="currentSpend"
                  type="number"
                  value={form.currentSpend}
                  onChange={handleNumberChange}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  variant="outlined"
                  size="small"
                  label="Current GPU Hours"
                  name="currentGpuHours"
                  type="number"
                  value={form.currentGpuHours}
                  onChange={handleNumberChange}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl variant="outlined" fullWidth size="small">
                  <InputLabel id="quota-alert-threshold">Alert Threshold</InputLabel>
                  <Select
                    labelId="quota-alert-threshold"
                    label="Alert Threshold"
                    value={form.alertThreshold}
                    onChange={event =>
                      handleSelectChange(
                        'alertThreshold',
                        event.target.value as QuotaRow['alertThreshold'],
                      )
                    }
                  >
                    <MenuItem value="80%">Trigger at 80%</MenuItem>
                    <MenuItem value="90%">Trigger at 90%</MenuItem>
                    <MenuItem value="95%">Trigger at 95%</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl variant="outlined" fullWidth size="small">
                  <InputLabel id="quota-reset-cadence">Reset Cadence</InputLabel>
                  <Select
                    labelId="quota-reset-cadence"
                    label="Reset Cadence"
                    value={form.resetCadence}
                    onChange={event =>
                      handleSelectChange(
                        'resetCadence',
                        event.target.value as QuotaRow['resetCadence'],
                      )
                    }
                  >
                    <MenuItem value="Monthly">Monthly</MenuItem>
                    <MenuItem value="Quarterly">Quarterly</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
            <div className={classes.actions}>
              <Button variant="outlined" onClick={handleCancel}>
                Cancel
              </Button>
              <Button color="primary" variant="contained" onClick={handleSave}>
                Save Changes
              </Button>
            </div>
          </Paper>
        )}
      </Content>
    </Page>
  );
};

export default AegisQuotaManagementPage;
