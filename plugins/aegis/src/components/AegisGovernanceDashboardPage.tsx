import { useMemo } from 'react';
import { Box, Grid, makeStyles, Paper, Typography } from '@material-ui/core';
import {
  Content,
  ContentHeader,
  HeaderLabel,
  Page,
  Table,
  TableColumn,
} from '@backstage/core-components';

type GovernanceRow = {
  team: string;
  policy: string;
  budget: string;
  spend: string;
};

const rows: GovernanceRow[] = [
  {
    team: 'Sentinel ISR Program',
    policy: 'Zero-Trust Mission Boundary',
    budget: '$6,500,000',
    spend: '$5,120,400',
  },
  {
    team: 'Artemis Cyber Defense',
    policy: 'Continuous ATO (IL5)',
    budget: '$4,250,000',
    spend: '$3,318,900',
  },
  {
    team: 'Trident Recon AI',
    policy: 'Mission Assurance Tier-1',
    budget: '$3,900,000',
    spend: '$2,870,150',
  },
  {
    team: 'Atlas Analyst Workbench',
    policy: 'Privileged Analyst Guardrails',
    budget: '$2,150,000',
    spend: '$1,480,320',
  },
];

const useStyles = makeStyles(theme => ({
  root: {
    paddingBottom: theme.spacing(6),
  },
  card: {
    padding: theme.spacing(3),
    backgroundColor: 'var(--aegis-card-surface)',
    border: '1px solid var(--aegis-card-border)',
    boxShadow: 'var(--aegis-card-shadow)',
    borderRadius: theme.spacing(2.5),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    height: '100%',
  },
  statValue: {
    fontSize: theme.typography.pxToRem(28),
    fontWeight: 600,
    letterSpacing: '-0.02em',
  },
  statLabel: {
    color: theme.palette.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    fontSize: theme.typography.pxToRem(12),
  },
}));

export const AegisGovernanceDashboardPage = () => {
  const classes = useStyles();
  const columns = useMemo<TableColumn<GovernanceRow>[]>(
    () => [
      { title: 'Project / Team', field: 'team' },
      { title: 'Assigned Policy', field: 'policy' },
      { title: 'Allocated Budget ($)', field: 'budget' },
      { title: 'Current Spend ($)', field: 'spend' },
    ],
    [],
  );

  return (
    <Page themeId="tool">
      <Content className={classes.root} noPadding>
        <ContentHeader title="Governance Dashboard">
          <HeaderLabel label="Policies" value="All compliant" />
          <HeaderLabel label="Budget Adherence" value="92%" />
          <HeaderLabel label="Last Review" value="48 hours ago" />
        </ContentHeader>
        <Box px={4} pb={6}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Paper className={classes.card}>
                <Typography className={classes.statLabel}>Projects Under Governance</Typography>
                <Typography className={classes.statValue}>24</Typography>
                <Typography variant="body2" color="textSecondary">
                  Spanning 3 mission theaters
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper className={classes.card}>
                <Typography className={classes.statLabel}>Automated Guardrails</Typography>
                <Typography className={classes.statValue}>156</Typography>
                <Typography variant="body2" color="textSecondary">
                  Enforced via continuous policy sync
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper className={classes.card}>
                <Typography className={classes.statLabel}>Budget Coverage</Typography>
                <Typography className={classes.statValue}>$16.8M</Typography>
                <Typography variant="body2" color="textSecondary">
                  87% of FY24 allocation in scope
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12}>
              <Paper className={classes.card}>
                <Typography variant="h6">Projects & Spend Alignment</Typography>
                <Table
                  options={{ paging: false, search: false, padding: 'dense' }}
                  data={rows}
                  columns={columns}
                />
              </Paper>
            </Grid>
          </Grid>
        </Box>
      </Content>
    </Page>
  );
};
