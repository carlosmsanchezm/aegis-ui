import { FC, useMemo, useState } from 'react';
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
  Chip,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
  makeStyles,
} from '@material-ui/core';

const useStyles = makeStyles(theme => ({
  layout: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(4),
  },
  controls: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(2),
    alignItems: 'center',
  },
  card: {
    backgroundColor: 'var(--aegis-card-surface)',
    border: `1px solid var(--aegis-card-border)`,
    borderRadius: theme.shape.borderRadius,
    boxShadow: 'var(--aegis-card-shadow)',
    padding: theme.spacing(3),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(3),
  },
}));

type Role = 'admin' | 'project-admin' | 'user';

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  lastActive: string;
  teams: string[];
};

const userDirectory: UserRow[] = [
  {
    id: 'usr-1982',
    name: 'Nina Alvarez',
    email: 'nina.alvarez@aegis.io',
    role: 'project-admin',
    lastActive: '5 minutes ago',
    teams: ['Atlas Vision', 'Labs'],
  },
  {
    id: 'usr-2042',
    name: 'Jacob Singh',
    email: 'jacob.singh@aegis.io',
    role: 'user',
    lastActive: '32 minutes ago',
    teams: ['Conversational AI'],
  },
  {
    id: 'usr-2110',
    name: 'Maya Chen',
    email: 'maya.chen@aegis.io',
    role: 'admin',
    lastActive: 'Active now',
    teams: ['Platform'],
  },
  {
    id: 'usr-2199',
    name: 'Ravi Patel',
    email: 'ravi.patel@aegis.io',
    role: 'user',
    lastActive: '1 hour ago',
    teams: ['Labs'],
  },
];

export const AegisUserManagementPage: FC = () => {
  const classes = useStyles();
  const [users, setUsers] = useState<UserRow[]>(userDirectory);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | Role>('all');

  const handleRoleChange = (userId: string, newRole: Role) => {
    setUsers(prev =>
      prev.map(user => (user.id === userId ? { ...user, role: newRole } : user)),
    );
  };

  const filtered = useMemo(() => {
    return users.filter(user => {
      const matchesSearch =
        !search ||
        user.name.toLowerCase().includes(search.toLowerCase()) ||
        user.email.toLowerCase().includes(search.toLowerCase());
      const matchesRole = roleFilter === 'all' || user.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, search, roleFilter]);

  const columns = useMemo<TableColumn<UserRow>[]>(
    () => [
      {
        title: 'User',
        field: 'name',
        render: row => (
          <Box display="flex" flexDirection="column">
            <Typography variant="body1" component="span">
              {row.name}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {row.email}
            </Typography>
          </Box>
        ),
      },
      {
        title: 'Teams',
        field: 'teams',
        render: row => (
          <Box display="flex" flexWrap="wrap" gridGap={8}>
            {row.teams.map(team => (
              <Chip key={team} label={team} size="small" color="primary" />
            ))}
          </Box>
        ),
      },
      {
        title: 'Role',
        field: 'role',
        render: row => (
          <Select
            variant="outlined"
            value={row.role}
            onChange={event => handleRoleChange(row.id, event.target.value as Role)}
            style={{ minWidth: 160 }}
          >
            <MenuItem value="admin">Platform admin</MenuItem>
            <MenuItem value="project-admin">Project admin</MenuItem>
            <MenuItem value="user">Workspace user</MenuItem>
          </Select>
        ),
      },
      {
        title: 'Last Active',
        field: 'lastActive',
      },
      {
        title: 'Access',
        field: 'id',
        render: row => (
          <Button variant="outlined" color="primary" size="small">
            Manage Access
          </Button>
        ),
      },
    ],
    [handleRoleChange],
  );

  return (
    <Page themeId="tool">
      <Content>
        <ContentHeader title="User Management">
          <HeaderLabel label="Administration" value="Roles & access" />
        </ContentHeader>
        <div className={classes.layout}>
          <Paper className={classes.card}>
            <Typography variant="h6">Directory controls</Typography>
            <div className={classes.controls}>
              <TextField
                variant="outlined"
                label="Search users"
                placeholder="Search by name or email"
                value={search}
                onChange={event => setSearch(event.target.value)}
                style={{ minWidth: 280 }}
              />
              <TextField
                select
                variant="outlined"
                label="Role filter"
                value={roleFilter}
                onChange={event => setRoleFilter(event.target.value as 'all' | Role)}
                style={{ width: 200 }}
              >
                <MenuItem value="all">All roles</MenuItem>
                <MenuItem value="admin">Platform admin</MenuItem>
                <MenuItem value="project-admin">Project admin</MenuItem>
                <MenuItem value="user">Workspace user</MenuItem>
              </TextField>
              <Button variant="contained" color="primary">
                Invite new user
              </Button>
            </div>
          </Paper>

          <Paper className={classes.card}>
            <Typography variant="h6">Users & access</Typography>
            <Table
              options={{ paging: false, search: false, padding: 'dense' }}
              data={filtered}
              columns={columns}
            />
          </Paper>
        </div>
      </Content>
    </Page>
  );
};
