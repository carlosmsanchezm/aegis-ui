import { ChangeEvent, useCallback, useMemo, useState } from 'react';
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
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
  makeStyles,
} from '@material-ui/core';

import EditIcon from '@material-ui/icons/Edit';

export type QuotaRow = {
  project: string;
  budget: number;
  maxGpuHours: number;
  currentSpend: number;
  currentGpuHours: number;
  policy: 'monitor' | 'enforce';
};

const mockQuotas: QuotaRow[] = [
  {
    project: 'p-aurora',
    budget: 60000,
    maxGpuHours: 4200,
    currentSpend: 42820,
    currentGpuHours: 2980,
    policy: 'monitor',
  },
  {
    project: 'p-atlas',
    budget: 45000,
    maxGpuHours: 3600,
    currentSpend: 31220,
    currentGpuHours: 2488,
    policy: 'enforce',
  },
  {
    project: 'p-vanguard',
    budget: 80000,
    maxGpuHours: 5400,
    currentSpend: 61240,
    currentGpuHours: 4012,
    policy: 'enforce',
  },
  {
    project: 'p-demo',
    budget: 25000,
    maxGpuHours: 1800,
    currentSpend: 22180,
    currentGpuHours: 1462,
    policy: 'monitor',
  },
];

const useStyles = makeStyles(theme => ({
  content: {
    paddingBottom: theme.spacing(5),
  },
  card: {
    backgroundColor: 'var(--aegis-card-surface)',
    border: '1px solid var(--aegis-card-border)',
    boxShadow: 'var(--aegis-card-shadow)',
    borderRadius: theme.shape.borderRadius * 2,
    padding: theme.spacing(3),
  },
  tableContainer: {
    marginTop: theme.spacing(3),
    marginBottom: theme.spacing(4),
  },
  editButton: {
    textTransform: 'none',
  },
  formGrid: {
    marginTop: theme.spacing(1.5),
  },
  formActions: {
    marginTop: theme.spacing(3),
    display: 'flex',
    gap: theme.spacing(2),
  },
}));

export const AegisQuotaManagementPage = () => {
  const classes = useStyles();
  const [rows, setRows] = useState<QuotaRow[]>(mockQuotas);
  const [editing, setEditing] = useState<QuotaRow | null>(mockQuotas[0]);
  const [draft, setDraft] = useState({
    budget: mockQuotas[0].budget,
    maxGpuHours: mockQuotas[0].maxGpuHours,
    policy: mockQuotas[0].policy,
  });

  const handleEdit = useCallback((row: QuotaRow) => {
    setEditing(row);
    setDraft({
      budget: row.budget,
      maxGpuHours: row.maxGpuHours,
      policy: row.policy,
    });
  }, []);

  const columns = useMemo<TableColumn<QuotaRow>[]>(
    () => [
      { title: 'Project', field: 'project', defaultSort: 'asc' },
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
        title: 'Policy',
        field: 'policy',
        render: row =>
          row.policy === 'enforce' ? 'Enforce & Halt' : 'Monitor & Alert',
      },
      {
        title: 'Actions',
        field: 'actions',
        sorting: false,
        render: row => (
          <Button
            variant="outlined"
            color="primary"
            size="small"
            className={classes.editButton}
            startIcon={<EditIcon />}
            onClick={() => handleEdit(row)}
          >
            Edit
          </Button>
        ),
      },
    ],
    [classes.editButton, handleEdit],
  );

  const handleBudgetChange = (event: ChangeEvent<HTMLInputElement>) => {
    setDraft(prev => ({ ...prev, budget: Number(event.target.value) }));
  };

  const handleHoursChange = (event: ChangeEvent<HTMLInputElement>) => {
    setDraft(prev => ({ ...prev, maxGpuHours: Number(event.target.value) }));
  };

  const handlePolicyChange = (event: ChangeEvent<{ value: unknown }>) => {
    setDraft(prev => ({ ...prev, policy: event.target.value as 'monitor' | 'enforce' }));
  };

  const handleSave = () => {
    if (!editing) {
      return;
    }

    setRows(prevRows =>
      prevRows.map(row =>
        row.project === editing.project
          ? {
              ...row,
              budget: draft.budget,
              maxGpuHours: draft.maxGpuHours,
              policy: draft.policy,
            }
          : row,
      ),
    );

    setEditing(prev =>
      prev
        ? {
            ...prev,
            budget: draft.budget,
            maxGpuHours: draft.maxGpuHours,
            policy: draft.policy,
          }
        : prev,
    );
  };

  const handleReset = () => {
    if (!editing) {
      return;
    }
    const baseline =
      rows.find(row => row.project === editing.project) ?? mockQuotas[0];
    setDraft({
      budget: baseline.budget,
      maxGpuHours: baseline.maxGpuHours,
      policy: baseline.policy,
    });
  };

  return (
    <Page themeId="tool">
      <Content className={classes.content}>
        <ContentHeader title="Quota Management">
          <HeaderLabel label="Guardrails" value="Active" />
          <HeaderLabel label="Default Currency" value="USD" />
        </ContentHeader>

        <Paper elevation={0} className={`${classes.card} ${classes.tableContainer}`}>
          <Typography variant="h6" gutterBottom>
            Project Quotas & Budgets
          </Typography>
          <Table
            options={{
              paging: false,
              search: false,
              padding: 'dense',
            }}
            data={rows}
            columns={columns}
          />
        </Paper>

        {editing && (
          <Paper elevation={0} className={classes.card}>
            <Typography variant="h6" gutterBottom>
              Set Quota — {editing.project}
            </Typography>
            <Grid container spacing={3} className={classes.formGrid}>
              <Grid item xs={12} md={4}>
                <TextField
                  label="Budget ($)"
                  type="number"
                  fullWidth
                  value={draft.budget}
                  onChange={handleBudgetChange}
                  variant="outlined"
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  label="Max GPU Hours"
                  type="number"
                  fullWidth
                  value={draft.maxGpuHours}
                  onChange={handleHoursChange}
                  variant="outlined"
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <FormControl variant="outlined" fullWidth>
                  <InputLabel id="quota-policy-label">Policy</InputLabel>
                  <Select
                    labelId="quota-policy-label"
                    value={draft.policy}
                    onChange={handlePolicyChange}
                    label="Policy"
                  >
                    <MenuItem value="monitor">Monitor & Alert</MenuItem>
                    <MenuItem value="enforce">Enforce & Halt</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            <Box className={classes.formActions}>
              <Button variant="contained" color="primary" onClick={handleSave}>
                Save Quota
              </Button>
              <Button variant="text" onClick={handleReset}>
                Reset
              </Button>
            </Box>
          </Paper>
        )}
      </Content>
    </Page>
  );
};

export default AegisQuotaManagementPage;
