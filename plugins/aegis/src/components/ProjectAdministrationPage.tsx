import { ChangeEvent, FC, useMemo, useState } from 'react';
import {
  Page,
  Content,
  ContentHeader,
  HeaderLabel,
  Table,
  TableColumn,
  StatusOK,
  StatusWarning,
  StatusError,
} from '@backstage/core-components';
import {
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  MenuItem,
  Paper,
  TextField,
  Typography,
  makeStyles,
} from '@material-ui/core';
import AddCircleOutlineIcon from '@material-ui/icons/AddCircleOutline';
import EditIcon from '@material-ui/icons/Edit';

export type ProjectRow = {
  id: string;
  displayName: string;
  defaultQueue: string;
  queueStrategy: 'best-effort' | 'priority' | 'gpu-first';
  budgetOwner: string;
  monthlyBudget: number;
  spendToDate: number;
  runwayDays: number;
  activeWorkspaces: number;
  status: 'healthy' | 'warning' | 'overrun';
};

const initialProjects: ProjectRow[] = [
  {
    id: 'p-default',
    displayName: 'Mission Default',
    defaultQueue: 'cpu-general',
    queueStrategy: 'best-effort',
    budgetOwner: 'FinOps Automation',
    monthlyBudget: 25000,
    spendToDate: 11840,
    runwayDays: 42,
    activeWorkspaces: 18,
    status: 'healthy',
  },
  {
    id: 'p-aurora',
    displayName: 'Aurora ISR',
    defaultQueue: 'gpu-priority',
    queueStrategy: 'gpu-first',
    budgetOwner: 'Col. Ramirez',
    monthlyBudget: 60000,
    spendToDate: 42820,
    runwayDays: 28,
    activeWorkspaces: 32,
    status: 'warning',
  },
  {
    id: 'p-vanguard',
    displayName: 'Vanguard Analytics',
    defaultQueue: 'cpu-analytics',
    queueStrategy: 'priority',
    budgetOwner: 'GS-15 Lee',
    monthlyBudget: 45000,
    spendToDate: 39110,
    runwayDays: 19,
    activeWorkspaces: 21,
    status: 'overrun',
  },
];

const queueOptions = [
  { value: 'cpu-general', label: 'CPU General' },
  { value: 'cpu-analytics', label: 'CPU Analytics' },
  { value: 'gpu-priority', label: 'GPU Priority' },
  { value: 'gpu-batch', label: 'GPU Batch' },
];

const queueStrategies: { value: ProjectRow['queueStrategy']; label: string }[] = [
  { value: 'best-effort', label: 'Best effort (first available)' },
  { value: 'priority', label: 'Priority (reserve burst capacity)' },
  { value: 'gpu-first', label: 'GPU-first (route to accelerators)' },
];

const useStyles = makeStyles(theme => ({
  content: {
    paddingBottom: theme.spacing(5),
  },
  metricsRow: {
    marginTop: theme.spacing(2),
  },
  metricCard: {
    backgroundColor: 'var(--aegis-card-surface)',
    border: '1px solid var(--aegis-card-border)',
    boxShadow: 'var(--aegis-card-shadow)',
    borderRadius: theme.shape.borderRadius * 2,
    padding: theme.spacing(3),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    height: '100%',
  },
  metricLabel: {
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    fontSize: theme.typography.pxToRem(12),
    color: theme.palette.text.secondary,
  },
  metricValue: {
    fontSize: theme.typography.pxToRem(32),
    fontWeight: 700,
    letterSpacing: '-0.02em',
  },
  metricMeta: {
    color: theme.palette.text.secondary,
  },
  tableContainer: {
    marginTop: theme.spacing(4),
  },
  actionBar: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginBottom: theme.spacing(2),
  },
  primaryButton: {
    textTransform: 'none',
    fontWeight: 600,
  },
  dialogContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    marginTop: theme.spacing(1),
    minWidth: 420,
  },
  dialogRow: {
    display: 'flex',
    gap: theme.spacing(2),
  },
  dialogActions: {
    padding: theme.spacing(2, 3, 3),
  },
  statusChip: {
    fontWeight: 600,
    letterSpacing: '0.03em',
    textTransform: 'uppercase',
  },
}));

const emptyDraft: ProjectRow = {
  id: '',
  displayName: '',
  defaultQueue: queueOptions[0].value,
  queueStrategy: 'best-effort',
  budgetOwner: '',
  monthlyBudget: 20000,
  spendToDate: 0,
  runwayDays: 30,
  activeWorkspaces: 0,
  status: 'healthy',
};

const statusDisplay = (status: ProjectRow['status']) => {
  switch (status) {
    case 'healthy':
      return <StatusOK>Healthy</StatusOK>;
    case 'warning':
      return <StatusWarning>Monitoring</StatusWarning>;
    default:
      return <StatusError>Overrun</StatusError>;
  }
};

export const ProjectAdministrationPage: FC = () => {
  const classes = useStyles();
  const [rows, setRows] = useState<ProjectRow[]>(initialProjects);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mode, setMode] = useState<'create' | 'edit'>('create');
  const [draft, setDraft] = useState<ProjectRow>(emptyDraft);

  const totals = useMemo(() => {
    const monthlyBudget = rows.reduce((acc, row) => acc + row.monthlyBudget, 0);
    const spend = rows.reduce((acc, row) => acc + row.spendToDate, 0);
    const active = rows.reduce((acc, row) => acc + row.activeWorkspaces, 0);
    return { monthlyBudget, spend, active };
  }, [rows]);

  const columns = useMemo<TableColumn<ProjectRow>[]>(
    () => [
      { title: 'Project ID', field: 'id', defaultSort: 'asc' },
      { title: 'Display name', field: 'displayName' },
      {
        title: 'Default queue',
        field: 'defaultQueue',
        render: row => (
          <Chip
            label={row.defaultQueue}
            color="primary"
            size="small"
            className={classes.statusChip}
          />
        ),
      },
      {
        title: 'Queue strategy',
        field: 'queueStrategy',
        render: row => {
          const label = queueStrategies.find(option => option.value === row.queueStrategy)?.label;
          return label ?? row.queueStrategy;
        },
      },
      { title: 'Budget owner', field: 'budgetOwner' },
      {
        title: 'Monthly budget',
        field: 'monthlyBudget',
        render: row => `$${row.monthlyBudget.toLocaleString()}`,
      },
      {
        title: 'Spend to date',
        field: 'spendToDate',
        render: row => `$${row.spendToDate.toLocaleString()}`,
      },
      {
        title: 'Active workspaces',
        field: 'activeWorkspaces',
        render: row => row.activeWorkspaces.toLocaleString(),
      },
      {
        title: 'Runway',
        field: 'runwayDays',
        render: row => `${row.runwayDays} days`,
      },
      {
        title: 'Status',
        field: 'status',
        sorting: false,
        render: row => statusDisplay(row.status),
      },
      {
        title: 'Actions',
        field: 'actions',
        sorting: false,
        render: row => (
          <Button
            size="small"
            variant="outlined"
            color="primary"
            className={classes.primaryButton}
            startIcon={<EditIcon />}
            onClick={() => handleEdit(row)}
          >
            Edit
          </Button>
        ),
      },
    ],
    [classes.primaryButton],
  );

  const handleEdit = (row: ProjectRow) => {
    setMode('edit');
    setDraft({ ...row });
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setMode('create');
    setDraft(emptyDraft);
    setDialogOpen(true);
  };

  const handleTextChange = (field: 'id' | 'displayName' | 'budgetOwner') =>
    (event: ChangeEvent<HTMLInputElement>) => {
      setDraft(prev => ({ ...prev, [field]: event.target.value }));
    };

  const handleNumberChange = (
    field: 'monthlyBudget' | 'spendToDate' | 'activeWorkspaces' | 'runwayDays',
  ) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      setDraft(prev => ({ ...prev, [field]: Number(event.target.value) }));
    };

  const handleSelectChange = <K extends 'defaultQueue' | 'queueStrategy' | 'status'>(
    field: K,
  ) =>
    (event: ChangeEvent<{ value: unknown }>) => {
      setDraft(prev => ({ ...prev, [field]: event.target.value as ProjectRow[K] }));
    };

  const handleSave = () => {
    if (!draft.id.trim() || !draft.displayName.trim()) {
      return;
    }

    if (mode === 'create') {
      setRows(prev => [...prev, { ...draft }]);
    } else {
      setRows(prev => prev.map(row => (row.id === draft.id ? { ...draft } : row)));
    }

    setDialogOpen(false);
  };

  return (
    <Page themeId="tool">
      <Content className={classes.content}>
        <ContentHeader title="Project administration">
          <HeaderLabel label="Purpose" value="Curate launch defaults and guardrails" />
          <HeaderLabel label="Scope" value="ÆGIS FinOps" />
        </ContentHeader>

        <Grid container spacing={3} className={classes.metricsRow}>
          <Grid item xs={12} md={4}>
            <Paper elevation={0} className={classes.metricCard}>
              <span className={classes.metricLabel}>Monthly budget</span>
              <span className={classes.metricValue}>
                ${totals.monthlyBudget.toLocaleString()}
              </span>
              <Typography variant="body2" className={classes.metricMeta}>
                Across {rows.length} projects
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper elevation={0} className={classes.metricCard}>
              <span className={classes.metricLabel}>Spend to date</span>
              <span className={classes.metricValue}>
                ${totals.spend.toLocaleString()}
              </span>
              <Typography variant="body2" className={classes.metricMeta}>
                Includes auto-bootstrapped defaults
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper elevation={0} className={classes.metricCard}>
              <span className={classes.metricLabel}>Active workspaces</span>
              <span className={classes.metricValue}>{totals.active.toLocaleString()}</span>
              <Typography variant="body2" className={classes.metricMeta}>
                Launches inheriting project guardrails
              </Typography>
            </Paper>
          </Grid>
        </Grid>

        <div className={classes.tableContainer}>
          <div className={classes.actionBar}>
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddCircleOutlineIcon />}
              className={classes.primaryButton}
              onClick={handleCreate}
            >
              Create project
            </Button>
          </div>
          <Table
            title="Projects"
            options={{ paging: false, search: false, padding: 'dense' }}
            data={rows}
            columns={columns}
          />
        </div>

        <Dialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          aria-labelledby="project-admin-dialog"
        >
          <DialogTitle id="project-admin-dialog">
            {mode === 'create' ? 'Create project' : `Edit ${draft.displayName}`}
          </DialogTitle>
          <DialogContent className={classes.dialogContent}>
            <TextField
              label="Project ID"
              value={draft.id}
              onChange={handleTextChange('id')}
              variant="outlined"
              required
              helperText="Immutable identifier used by APIs"
              fullWidth
              disabled={mode === 'edit'}
            />
            <TextField
              label="Display name"
              value={draft.displayName}
              onChange={handleTextChange('displayName')}
              variant="outlined"
              required
              fullWidth
            />
            <TextField
              label="Budget owner"
              value={draft.budgetOwner}
              onChange={handleTextChange('budgetOwner')}
              variant="outlined"
              required
              fullWidth
            />
            <TextField
              select
              label="Default queue"
              value={draft.defaultQueue}
              onChange={handleSelectChange('defaultQueue')}
              variant="outlined"
              fullWidth
            >
              {queueOptions.map(option => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Queue strategy"
              value={draft.queueStrategy}
              onChange={handleSelectChange('queueStrategy')}
              variant="outlined"
              fullWidth
            >
              {queueStrategies.map(option => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
            <div className={classes.dialogRow}>
              <TextField
                label="Monthly budget"
                value={draft.monthlyBudget}
                onChange={handleNumberChange('monthlyBudget')}
                type="number"
                variant="outlined"
                fullWidth
              />
              <TextField
                label="Spend to date"
                value={draft.spendToDate}
                onChange={handleNumberChange('spendToDate')}
                type="number"
                variant="outlined"
                fullWidth
              />
            </div>
            <div className={classes.dialogRow}>
              <TextField
                label="Active workspaces"
                value={draft.activeWorkspaces}
                onChange={handleNumberChange('activeWorkspaces')}
                type="number"
                variant="outlined"
                fullWidth
              />
              <TextField
                label="Runway (days)"
                value={draft.runwayDays}
                onChange={handleNumberChange('runwayDays')}
                type="number"
                variant="outlined"
                fullWidth
              />
            </div>
            <TextField
              select
              label="Status"
              value={draft.status}
              onChange={handleSelectChange('status')}
              variant="outlined"
              fullWidth
            >
              <MenuItem value="healthy">Healthy</MenuItem>
              <MenuItem value="warning">Monitoring</MenuItem>
              <MenuItem value="overrun">Overrun</MenuItem>
            </TextField>
          </DialogContent>
          <DialogActions className={classes.dialogActions}>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              color="primary"
              variant="contained"
              className={classes.primaryButton}
              onClick={handleSave}
              disabled={!draft.id.trim() || !draft.displayName.trim()}
            >
              {mode === 'create' ? 'Create' : 'Save changes'}
            </Button>
          </DialogActions>
        </Dialog>
      </Content>
    </Page>
  );
};

export default ProjectAdministrationPage;
