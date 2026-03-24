import { ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Page,
  Content,
  ContentHeader,
  HeaderLabel,
  Progress,
  Table,
  TableColumn,
  WarningPanel,
} from '@backstage/core-components';
import {
  alertApiRef,
  discoveryApiRef,
  fetchApiRef,
  identityApiRef,
  useApi,
} from '@backstage/core-plugin-api';
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

import {
  BudgetRecord,
  ProjectRecord,
  listBudgets,
  listProjects,
  upsertBudget,
} from '../api/aegisClient';
import { keycloakAuthApiRef } from '../api/refs';

export type QuotaRow = {
  projectId: string;
  projectName: string;
  queue: string;
  budget: number;
  currentSpend: number;
  utilization: number;
  policy: 'monitor' | 'enforce';
};

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
  emptyState: {
    marginTop: theme.spacing(3),
    borderRadius: theme.shape.borderRadius * 2,
    border: '1px dashed var(--aegis-card-border)',
    padding: theme.spacing(6, 3),
    background: 'var(--aegis-card-surface)',
    textAlign: 'center',
  },
}));

const budgetToRow = (
  project: ProjectRecord,
  budget: BudgetRecord,
): QuotaRow => {
  const spent = budget.spentUsd ?? 0;
  const limit = budget.limitUsd ?? 0;
  const pct = limit > 0 ? (spent / limit) * 100 : 0;
  const policyMode = budget.policyMode ?? 'monitor';
  return {
    projectId: project.id,
    projectName: project.displayName ?? project.id,
    queue: budget.queue ?? 'default',
    budget: limit,
    currentSpend: spent,
    utilization: Math.round(pct),
    policy: policyMode === 'enforce' ? 'enforce' : 'monitor',
  };
};

export const AegisQuotaManagementPage = () => {
  const classes = useStyles();
  const fetchApi = useApi(fetchApiRef);
  const discoveryApi = useApi(discoveryApiRef);
  const identityApi = useApi(identityApiRef);
  const authApi = useApi(keycloakAuthApiRef);
  const alertApi = useApi(alertApiRef);

  const [rows, setRows] = useState<QuotaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<QuotaRow | null>(null);
  const [draft, setDraft] = useState({
    budget: 0,
    policy: 'monitor' as 'monitor' | 'enforce',
  });
  const [budgetError, setBudgetError] = useState<string | undefined>();

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const projectsResponse = await listProjects(
        fetchApi,
        discoveryApi,
        identityApi,
        authApi,
      );
      const projects = projectsResponse?.items ?? [];

      const allRows: QuotaRow[] = [];
      await Promise.all(
        projects.map(async project => {
          try {
            const budgets = await listBudgets(
              fetchApi,
              discoveryApi,
              identityApi,
              authApi,
              project.id,
            );
            budgets.forEach(b => allRows.push(budgetToRow(project, b)));
          } catch {
            // Project may not have budgets configured yet
          }
        }),
      );

      setRows(allRows);
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      setError(msg);
      alertApi.post({
        message: `Failed to load quotas: ${msg}`,
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [fetchApi, discoveryApi, identityApi, authApi, alertApi]);

  useEffect(() => {
    load();
  }, [load]);

  const handleEdit = useCallback((row: QuotaRow) => {
    setEditing(row);
    setDraft({
      budget: row.budget,
      policy: row.policy,
    });
  }, []);

  const columns = useMemo<TableColumn<QuotaRow>[]>(
    () => [
      { title: 'Project', field: 'projectName', defaultSort: 'asc' },
      { title: 'Queue', field: 'queue' },
      {
        title: 'Budget ($)',
        field: 'budget',
        render: row => `$${row.budget.toLocaleString()}`,
      },
      {
        title: 'Current Spend ($)',
        field: 'currentSpend',
        render: row => `$${row.currentSpend.toLocaleString()}`,
      },
      {
        title: 'Utilization',
        field: 'utilization',
        render: row => `${row.utilization}%`,
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
    const value = Number(event.target.value);
    setDraft(prev => ({ ...prev, budget: value }));
    if (isNaN(value) || value <= 0) {
      setBudgetError('Budget must be a positive number');
    } else {
      setBudgetError(undefined);
    }
  };

  const handlePolicyChange = (event: ChangeEvent<{ value: unknown }>) => {
    setDraft(prev => ({
      ...prev,
      policy: event.target.value as 'monitor' | 'enforce',
    }));
  };

  const handleSave = async () => {
    if (!editing) {
      return;
    }

    if (isNaN(draft.budget) || draft.budget <= 0) {
      setBudgetError('Budget must be a positive number');
      return;
    }

    try {
      setSaving(true);
      await upsertBudget(fetchApi, discoveryApi, identityApi, authApi, {
        projectId: editing.projectId,
        queue: editing.queue,
        limitUsd: draft.budget,
        policyMode: draft.policy,
      });

      alertApi.post({
        message: `Budget updated for ${editing.projectName}`,
        severity: 'success',
      });

      // Refresh data from the server
      await load();
      setEditing(null);
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      alertApi.post({
        message: `Failed to save quota: ${msg}`,
        severity: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (!editing) {
      return;
    }
    setDraft({
      budget: editing.budget,
      policy: editing.policy,
    });
    setBudgetError(undefined);
  };

  const handleCancelEdit = () => {
    setEditing(null);
  };

  if (loading) {
    return (
      <Page themeId="tool">
        <Content className={classes.content}>
          <ContentHeader title="Quota Management">
            <HeaderLabel label="Guardrails" value="Active" />
            <HeaderLabel label="Default Currency" value="USD" />
          </ContentHeader>
          <Progress />
        </Content>
      </Page>
    );
  }

  if (error) {
    return (
      <Page themeId="tool">
        <Content className={classes.content}>
          <ContentHeader title="Quota Management">
            <HeaderLabel label="Guardrails" value="Active" />
            <HeaderLabel label="Default Currency" value="USD" />
          </ContentHeader>
          <WarningPanel title="Failed to load quotas" severity="error">
            {error}
            <Box mt={2}>
              <Button variant="outlined" onClick={load}>
                Retry
              </Button>
            </Box>
          </WarningPanel>
        </Content>
      </Page>
    );
  }

  return (
    <Page themeId="tool">
      <Content className={classes.content}>
        <ContentHeader title="Quota Management">
          <HeaderLabel label="Guardrails" value="Active" />
          <HeaderLabel label="Default Currency" value="USD" />
        </ContentHeader>

        {rows.length === 0 ? (
          <Box className={classes.emptyState}>
            <Typography variant="h6" gutterBottom>
              No budgets configured
            </Typography>
            <Typography variant="body2" color="textSecondary">
              No projects have budget quotas set. Use the platform API to
              configure budgets for your projects and they will appear here for
              management.
            </Typography>
          </Box>
        ) : (
          <Paper
            elevation={0}
            className={`${classes.card} ${classes.tableContainer}`}
          >
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
        )}

        {editing && (
          <Paper elevation={0} className={classes.card}>
            <Typography variant="h6" gutterBottom>
              Set Quota — {editing.projectName} ({editing.queue})
            </Typography>
            <Grid container spacing={3} className={classes.formGrid}>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Budget ($)"
                  type="number"
                  fullWidth
                  required
                  value={draft.budget}
                  onChange={handleBudgetChange}
                  variant="outlined"
                  error={Boolean(budgetError)}
                  helperText={budgetError || 'Enter a positive budget amount in USD'}
                  inputProps={{ min: 1 }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
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
              <Button
                variant="contained"
                color="primary"
                onClick={handleSave}
                disabled={saving || Boolean(budgetError)}
              >
                {saving ? 'Saving...' : 'Save Quota'}
              </Button>
              <Button variant="text" onClick={handleReset} disabled={saving}>
                Reset
              </Button>
              <Button variant="text" onClick={handleCancelEdit} disabled={saving}>
                Cancel
              </Button>
            </Box>
          </Paper>
        )}
      </Content>
    </Page>
  );
};

export default AegisQuotaManagementPage;
