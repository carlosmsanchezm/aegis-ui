import { useMemo, useState } from 'react';
import {
  Content,
  ContentHeader,
  HeaderLabel,
  Page,
  Table,
  TableColumn,
} from '@backstage/core-components';
import {
  Box,
  Button,
  Chip,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
} from '@material-ui/core';
import { makeStyles, Theme } from '@material-ui/core/styles';

type UserRow = {
  id: string;
  name: string;
  email: string;
  team: string;
  role: 'admin' | 'user' | 'viewer';
  lastActive: string;
  access: string[];
};

const mockUsers: UserRow[] = [
  {
    id: 'usr-101',
    name: 'Alicia Flores',
    email: 'aflores@aegis.ai',
    team: 'Inference Ops',
    role: 'admin',
    lastActive: '5 minutes ago',
    access: ['Workspaces', 'Policies', 'Telemetry'],
  },
  {
    id: 'usr-102',
    name: 'Marcus Chen',
    email: 'mchen@aegis.ai',
    team: 'RL Research',
    role: 'user',
    lastActive: '18 minutes ago',
    access: ['Workspaces'],
  },
  {
    id: 'usr-103',
    name: 'Priya Rao',
    email: 'prao@aegis.ai',
    team: 'Platform',
    role: 'viewer',
    lastActive: '1 hour ago',
    access: ['Telemetry', 'Audit Logs'],
  },
  {
    id: 'usr-104',
    name: 'Logan Walters',
    email: 'lwalters@aegis.ai',
    team: 'Security',
    role: 'user',
    lastActive: '2 hours ago',
    access: ['Audit Logs', 'Policies'],
  },
];

const useStyles = makeStyles((theme: Theme) => ({
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(4),
  },
  headerActions: {
    display: 'flex',
    gap: theme.spacing(1),
  },
  card: {
    backgroundColor: 'var(--aegis-card-surface)',
    border: '1px solid var(--aegis-card-border)',
    borderRadius: theme.shape.borderRadius,
    boxShadow: 'var(--aegis-card-shadow)',
    padding: theme.spacing(3),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2.5),
  },
  chipRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
  },
  filterRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: theme.spacing(2),
  },
}));

export const AegisUserManagementPage = () => {
  const classes = useStyles();
  const [roleOverrides, setRoleOverrides] = useState<Record<string, UserRow['role']>>({});
  const [filters, setFilters] = useState({
    team: '',
    search: '',
  });

  const handleRoleChange = (userId: string, newRole: UserRow['role']) => {
    setRoleOverrides(prev => ({ ...prev, [userId]: newRole }));
  };

  const filteredUsers = useMemo(() => {
    return mockUsers.filter(user => {
      const matchesTeam = !filters.team || user.team === filters.team;
      const query = filters.search.trim().toLowerCase();
      const matchesSearch =
        !query ||
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query);
      return matchesTeam && matchesSearch;
    });
  }, [filters.team, filters.search]);

  const teamOptions = Array.from(new Set(mockUsers.map(user => user.team)));

  const userColumns = useMemo<TableColumn<UserRow>[]>(
    () => [
      { title: 'Name', field: 'name' },
      { title: 'Email', field: 'email' },
      { title: 'Team', field: 'team' },
      { title: 'Last Active', field: 'lastActive' },
      {
        title: 'Role',
        field: 'role',
        render: row => {
          const currentRole = roleOverrides[row.id] ?? row.role;
          return (
            <Select
              value={currentRole}
              onChange={event =>
                handleRoleChange(row.id, event.target.value as UserRow['role'])
              }
              variant="outlined"
            >
              <MenuItem value="admin">Admin</MenuItem>
              <MenuItem value="user">User</MenuItem>
              <MenuItem value="viewer">Viewer</MenuItem>
            </Select>
          );
        },
      },
      {
        title: 'Access',
        field: 'access',
        render: row => (
          <Box className={classes.chipRow}>
            {row.access.map(scope => (
              <Chip key={scope} label={scope} size="small" color="primary" />
            ))}
          </Box>
        ),
      },
    ],
    [classes.chipRow, roleOverrides],
  );

  return (
    <Page themeId="tool">
      <Content>
        <ContentHeader title="User Management">
          <HeaderLabel label="Persona" value="Program Admin" />
          <HeaderLabel label="Total Users" value={`${mockUsers.length}`} />
          <div className={classes.headerActions}>
            <Button variant="outlined" color="primary">
              Invite User
            </Button>
            <Button variant="contained" color="primary">
              Sync from SSO
            </Button>
          </div>
        </ContentHeader>
        <div className={classes.content}>
          <Paper className={classes.card}>
            <Typography variant="h6">Directory Filters</Typography>
            <div className={classes.filterRow}>
              <TextField
                label="Search"
                placeholder="Name or email"
                value={filters.search}
                onChange={event =>
                  setFilters(current => ({ ...current, search: event.target.value }))
                }
                variant="outlined"
                size="small"
              />
              <Select
                value={filters.team}
                onChange={event =>
                  setFilters(current => ({ ...current, team: event.target.value as string }))
                }
                displayEmpty
                variant="outlined"
              >
                <MenuItem value="">All Teams</MenuItem>
                {teamOptions.map(team => (
                  <MenuItem key={team} value={team}>
                    {team}
                  </MenuItem>
                ))}
              </Select>
            </div>
          </Paper>

          <Paper className={classes.card}>
            <Typography variant="h6">Workspace Directory</Typography>
            <Table
              options={{ paging: false, search: false, toolbar: false }}
              data={filteredUsers}
              columns={userColumns}
            />
          </Paper>
        </div>
      </Content>
    </Page>
  );
};

