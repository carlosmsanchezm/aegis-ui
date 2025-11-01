import { ChangeEvent, FC, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import {
  Content,
  ContentHeader,
  HeaderLabel,
  Page,
  Table,
  TableColumn,
} from '@backstage/core-components';

type QuotaRow = {
  project: string;
  budget: string;
  maxGpuHours: string;
  spend: string;
  gpuHours: string;
};

const quotaData: QuotaRow[] = [
  {
    project: 'p-atlas',
    budget: '$500,000',
    maxGpuHours: '2,400',
    spend: '$312,450',
    gpuHours: '1,460',
  },
  {
    project: 'p-orion',
    budget: '$350,000',
    maxGpuHours: '1,800',
    spend: '$278,120',
    gpuHours: '1,220',
  },
  {
    project: 'p-sentinel',
    budget: '$275,000',
    maxGpuHours: '1,450',
    spend: '$198,540',
    gpuHours: '930',
  },
  {
    project: 'p-trident',
    budget: '$420,000',
    maxGpuHours: '2,050',
    spend: '$362,880',
    gpuHours: '1,742',
  },
];

const useStyles = makeStyles(theme => ({
  content: {
    paddingBottom: theme.spacing(6),
  },
  card: {
    backgroundColor: 'var(--aegis-card-surface)',
    border: '1px solid var(--aegis-card-border)',
    boxShadow: 'var(--aegis-card-shadow)',
    borderRadius: theme.shape.borderRadius * 2,
    padding: theme.spacing(3),
  },
  dialogPaper: {
    backgroundColor: 'var(--aegis-card-surface)',
    borderRadius: theme.shape.borderRadius * 2,
  },
  formRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  },
}));

export const AegisQuotaManagementPage: FC = () => {
  const classes = useStyles();
  const [selected, setSelected] = useState<QuotaRow | null>(null);
  const [formValues, setFormValues] = useState({
    budget: '',
    maxGpuHours: '',
    spend: '',
    gpuHours: '',
    threshold: '85',
  });

  const handleEdit = (row: QuotaRow) => {
    setSelected(row);
    setFormValues({
      budget: row.budget.replace(/[$,]/g, ''),
      maxGpuHours: row.maxGpuHours.replace(/[,]/g, ''),
      spend: row.spend.replace(/[$,]/g, ''),
      gpuHours: row.gpuHours.replace(/[,]/g, ''),
      threshold: '85',
    });
  };

  const columns = useMemo<TableColumn<QuotaRow>[]>(
    () => [
      { title: 'Project', field: 'project' },
      { title: 'Budget ($)', field: 'budget' },
      { title: 'Max GPU Hours', field: 'maxGpuHours' },
      { title: 'Current Spend ($)', field: 'spend' },
      { title: 'Current GPU Hours', field: 'gpuHours' },
      {
        title: 'Actions',
        field: 'project',
        sorting: false,
        render: row => (
          <Button
            variant="outlined"
            size="small"
            onClick={() => handleEdit(row)}
          >
            Edit
          </Button>
        ),
      },
    ],
    [],
  );

  const handleClose = () => {
    setSelected(null);
  };

  const handleChange = (field: keyof typeof formValues) => (
    event: ChangeEvent<{ value: unknown }>,
  ) => {
    setFormValues(prev => ({ ...prev, [field]: event.target.value as string }));
  };

  return (
    <Page themeId="tool">
      <Content className={classes.content}>
        <ContentHeader title="Quota Management">
          <HeaderLabel label="Guardrails" value="Budgets & GPU Hours" />
        </ContentHeader>

        <Paper className={classes.card}>
          <Table
            title="Project Quotas"
            options={{ paging: false, search: false, padding: 'dense' }}
            columns={columns}
            data={quotaData}
          />
        </Paper>
      </Content>

      <Dialog
        open={Boolean(selected)}
        onClose={handleClose}
        classes={{ paper: classes.dialogPaper }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Adjust quota for {selected?.project}</DialogTitle>
        <DialogContent>
          <Box className={classes.formRow} mt={1}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Budget ($)"
                  variant="outlined"
                  fullWidth
                  value={formValues.budget}
                  onChange={event =>
                    setFormValues(prev => ({
                      ...prev,
                      budget: event.target.value,
                    }))
                  }
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Max GPU Hours"
                  variant="outlined"
                  fullWidth
                  value={formValues.maxGpuHours}
                  onChange={event =>
                    setFormValues(prev => ({
                      ...prev,
                      maxGpuHours: event.target.value,
                    }))
                  }
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Current Spend ($)"
                  variant="outlined"
                  fullWidth
                  value={formValues.spend}
                  onChange={event =>
                    setFormValues(prev => ({
                      ...prev,
                      spend: event.target.value,
                    }))
                  }
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Current GPU Hours"
                  variant="outlined"
                  fullWidth
                  value={formValues.gpuHours}
                  onChange={event =>
                    setFormValues(prev => ({
                      ...prev,
                      gpuHours: event.target.value,
                    }))
                  }
                />
              </Grid>
              <Grid item xs={12}>
                <FormControl variant="outlined" fullWidth>
                  <InputLabel id="threshold-select-label">Alert Threshold</InputLabel>
                  <Select
                    labelId="threshold-select-label"
                    value={formValues.threshold}
                    onChange={handleChange('threshold')}
                    label="Alert Threshold"
                  >
                    <MenuItem value="75">Notify at 75%</MenuItem>
                    <MenuItem value="85">Notify at 85%</MenuItem>
                    <MenuItem value="95">Notify at 95%</MenuItem>
                    <MenuItem value="100">Notify at 100%</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
            <Typography variant="body2" color="textSecondary">
              Updates are synced to enforcement policies within 5 minutes.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button color="primary" variant="contained" onClick={handleClose}>
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>
    </Page>
  );
};
