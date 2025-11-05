import { FC, useMemo, useState } from 'react';
import {
  Content,
  ContentHeader,
  HeaderLabel,
  Page,
} from '@backstage/core-components';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Chip,
  Divider,
  Grid,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Paper,
  Typography,
  makeStyles,
} from '@material-ui/core';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import { Link as RouterLink } from 'react-router-dom';
import {
  ComputeProfileDefinition,
  ProjectDefinition,
  environmentsCopy,
  projectCatalog,
} from './projectCatalog';

const useStyles = makeStyles(theme => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(3),
  },
  layout: {
    display: 'grid',
    gridTemplateColumns: 'minmax(280px, 0.9fr) minmax(420px, 1.3fr)',
    gap: theme.spacing(3),
    [theme.breakpoints.down('md')]: {
      gridTemplateColumns: '1fr',
    },
  },
  listCard: {
    borderRadius: theme.shape.borderRadius,
    border: `1px solid var(--aegis-card-border)`,
    backgroundColor: 'var(--aegis-card-surface)',
    padding: theme.spacing(1.5, 1),
  },
  listItem: {
    borderRadius: theme.shape.borderRadius,
    margin: theme.spacing(0.5, 1),
    '&.Mui-selected, &.Mui-selected:hover': {
      backgroundColor:
        theme.palette.type === 'dark'
          ? 'rgba(59,130,246,0.16)'
          : 'rgba(59,130,246,0.18)',
    },
  },
  detailCard: {
    borderRadius: theme.shape.borderRadius,
    border: `1px solid var(--aegis-card-border)`,
    backgroundColor: 'var(--aegis-card-surface)',
    padding: theme.spacing(3),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(3),
  },
  heroHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing(2),
  },
  heroHeading: {
    fontWeight: 700,
    letterSpacing: '-0.02em',
  },
  environmentChip: {
    borderRadius: 999,
    fontWeight: 600,
  },
  budgetPanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
    padding: theme.spacing(2),
    borderRadius: theme.shape.borderRadius,
    border: `1px solid var(--aegis-card-border)`,
    backgroundColor:
      theme.palette.type === 'dark'
        ? 'rgba(15,118,110,0.16)'
        : 'rgba(16,185,129,0.12)',
  },
  profileGrid: {
    display: 'grid',
    gap: theme.spacing(2),
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  },
  profileCard: {
    borderRadius: theme.shape.borderRadius,
    border: `1px solid var(--aegis-card-border)`,
    padding: theme.spacing(2.25),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
    backgroundColor:
      theme.palette.type === 'dark'
        ? 'rgba(99,102,241,0.14)'
        : 'rgba(99,102,241,0.08)',
  },
  badgeRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
  },
  computeCardIntro: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: theme.spacing(1.5),
  },
  sectionTitle: {
    fontWeight: 600,
    letterSpacing: '-0.01em',
  },
  metaList: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  },
  muted: {
    color: theme.palette.text.secondary,
  },
  accordionRoot: {
    borderRadius: theme.shape.borderRadius,
    border: `1px solid var(--aegis-card-border)`,
    '&:before': {
      display: 'none',
    },
  },
}));

const formatCurrency = (value: number) =>
  `$${value.toLocaleString('en-US', { minimumFractionDigits: 0 })}`;

const ComputeProfileCard = ({ profile }: { profile: ComputeProfileDefinition }) => {
  const classes = useStyles();
  return (
    <Paper elevation={0} className={classes.profileCard}>
      <Box className={classes.computeCardIntro}>
        <Typography variant="subtitle2" className={classes.sectionTitle}>
          {profile.label}
        </Typography>
        <Typography variant="body2" color="textSecondary">
          {profile.description}
        </Typography>
      </Box>
      <Typography variant="h6">{formatCurrency(profile.hourlyRate)}/hr</Typography>
      <Typography variant="body2">{profile.resources}</Typography>
      <Divider />
      <Typography variant="caption" color="textSecondary">
        Cluster
      </Typography>
      <Typography variant="body2">
        {profile.cluster.name} · {profile.cluster.region} ·{' '}
        {profile.cluster.complianceTier}
      </Typography>
      <div className={classes.badgeRow}>
        {profile.badges.map(badge => (
          <Chip key={badge} label={badge} size="small" />
        ))}
      </div>
      <Typography variant="caption" color="textSecondary">
        Namespace · Storage · Network
      </Typography>
      <Typography variant="body2">
        {profile.namespace} · {profile.storageClass} · {profile.networkZone}
      </Typography>
    </Paper>
  );
};

export const ProjectManagementPage: FC = () => {
  const classes = useStyles();
  const [selectedProjectId, setSelectedProjectId] = useState(
    projectCatalog[0]?.id ?? '',
  );

  const selectedProject = useMemo<ProjectDefinition | undefined>(
    () => projectCatalog.find(project => project.id === selectedProjectId),
    [selectedProjectId],
  );

  const budgetPercent = useMemo(() => {
    if (!selectedProject) {
      return 0;
    }
    return Math.min(
      100,
      Math.round(
        (selectedProject.budget.monthlyUsed /
          Math.max(1, selectedProject.budget.monthlyLimit)) *
          100,
      ),
    );
  }, [selectedProject]);

  return (
    <Page themeId="tool">
      <Content>
        <ContentHeader title="Projects">
          <HeaderLabel label="Scope" value="Organization" />
          <HeaderLabel label="Last Sync" value="3m ago" />
          <Button
            variant="contained"
            color="primary"
            component={RouterLink}
            to="/aegis/admin/projects/create"
          >
            Create Project
          </Button>
        </ContentHeader>
        <div className={classes.layout}>
          <Paper elevation={0} className={classes.listCard}>
            <List disablePadding>
              {projectCatalog.map(project => {
                const envMeta = environmentsCopy[project.environment];
                return (
                  <ListItem
                    key={project.id}
                    button
                    selected={project.id === selectedProjectId}
                    onClick={() => setSelectedProjectId(project.id)}
                    className={classes.listItem}
                  >
                    <ListItemText
                      primary={project.displayName}
                      secondary={project.description}
                    />
                    <Chip
                      className={classes.environmentChip}
                      color={envMeta.tone === 'error' ? 'secondary' : 'primary'}
                      variant={envMeta.tone === 'primary' ? 'default' : 'outlined'}
                      label={envMeta.label}
                      size="small"
                    />
                  </ListItem>
                );
              })}
            </List>
          </Paper>
          {selectedProject && (
            <Paper elevation={0} className={classes.detailCard}>
              <div className={classes.heroHeader}>
                <div>
                  <Typography variant="h4" className={classes.heroHeading}>
                    {selectedProject.displayName}
                  </Typography>
                  <Typography variant="subtitle1" color="textSecondary">
                    {selectedProject.description}
                  </Typography>
                </div>
                <Chip
                  className={classes.environmentChip}
                  color={
                    environmentsCopy[selectedProject.environment].tone === 'error'
                      ? 'secondary'
                      : 'primary'
                  }
                  label={environmentsCopy[selectedProject.environment].label}
                />
              </div>

              <div className={classes.budgetPanel}>
                <Typography variant="subtitle1" className={classes.sectionTitle}>
                  Budget & Guardrails
                </Typography>
                <Typography variant="body2">
                  {formatCurrency(selectedProject.budget.monthlyUsed)} used of{' '}
                  {formatCurrency(selectedProject.budget.monthlyLimit)} this month
                </Typography>
                <LinearProgress variant="determinate" value={budgetPercent} />
              </div>

              <div>
                <Typography variant="subtitle1" className={classes.sectionTitle}>
                  Compute Profiles
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  These profiles are granted to the project via platform-managed
                  clusters. Costs roll up to the project budget.
                </Typography>
                <div className={classes.profileGrid}>
                  {selectedProject.computeProfiles.map(profile => (
                    <ComputeProfileCard key={profile.id} profile={profile} />
                  ))}
                </div>
              </div>

              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Typography
                    variant="subtitle1"
                    className={classes.sectionTitle}
                    gutterBottom
                  >
                    Data Connections
                  </Typography>
                  <div className={classes.metaList}>
                    {selectedProject.dataConnections.map(connection => (
                      <Box key={connection.id}>
                        <Typography variant="body1">{connection.name}</Typography>
                        <Typography variant="caption" color="textSecondary">
                          {connection.uri}
                        </Typography>
                      </Box>
                    ))}
                  </div>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography
                    variant="subtitle1"
                    className={classes.sectionTitle}
                    gutterBottom
                  >
                    Secret Scopes
                  </Typography>
                  <div className={classes.metaList}>
                    {selectedProject.secretScopes.map(scope => (
                      <Box key={scope.id}>
                        <Typography variant="body1">{scope.name}</Typography>
                        <Typography variant="caption" color="textSecondary">
                          {scope.provider}
                        </Typography>
                      </Box>
                    ))}
                  </div>
                </Grid>
              </Grid>

              <Accordion elevation={0} className={classes.accordionRoot}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle1" className={classes.sectionTitle}>
                    Advanced Metadata
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <Typography variant="caption" className={classes.muted}>
                        Owners
                      </Typography>
                      <Typography variant="body1">
                        {selectedProject.owners.join(', ')}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Typography variant="caption" className={classes.muted}>
                        Default Compute Profile
                      </Typography>
                      <Typography variant="body1">
                        {
                          selectedProject.computeProfiles.find(
                            profile =>
                              profile.id === selectedProject.defaultComputeProfileId,
                          )?.label
                        }
                      </Typography>
                    </Grid>
                  </Grid>
                </AccordionDetails>
              </Accordion>
            </Paper>
          )}
        </div>
      </Content>
    </Page>
  );
};
