import {
  Grid,
  Paper,
  Typography,
  makeStyles,
  Box,
} from '@material-ui/core';
import {
  Content,
  ContentHeader,
  HeaderLabel,
  Page,
  Table,
  TableColumn,
} from '@backstage/core-components';

const useStyles = makeStyles(theme => ({
  content: {
    paddingBottom: theme.spacing(6),
  },
  headline: {
    marginBottom: theme.spacing(3),
  },
  card: {
    background: 'var(--aegis-card-surface)',
    border: '1px solid var(--aegis-card-border)',
    boxShadow: 'var(--aegis-card-shadow)',
    borderRadius: 24,
    padding: theme.spacing(3),
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
  },
  cardLabel: {
    fontSize: theme.typography.pxToRem(13),
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: theme.palette.text.secondary,
  },
  cardValue: {
    fontSize: '2rem',
    fontWeight: 600,
  },
  cardContext: {
    color: theme.palette.text.secondary,
  },
}));

type GovernanceRow = {
  project: string;
  policy: string;
  budget: string;
  spend: string;
};

const governanceRows: GovernanceRow[] = [
  {
    project: 'Trident Recon',
    policy: 'Zero-Trust Mission Access',
    budget: '$6.5M',
    spend: '$4.2M',
  },
  {
    project: 'Aquila Cyber Defense',
    policy: 'Continuous Authority to Operate',
    budget: '$8.0M',
    spend: '$6.9M',
  },
  {
    project: 'Atlas Research Labs',
    policy: 'R&D Expanded GPU',
    budget: '$5.2M',
    spend: '$3.8M',
  },
  {
    project: 'Sentinel Training Pipeline',
    policy: 'Role-Based Access + Guardrails',
    budget: '$3.9M',
    spend: '$2.6M',
  },
  {
    project: 'Voyager Space Testbed',
    policy: 'Launch Readiness Hardening',
    budget: '$4.7M',
    spend: '$3.1M',
  },
];

const columns: TableColumn<GovernanceRow>[] = [
  { title: 'Project/Team', field: 'project', highlight: true },
  { title: 'Assigned Policy', field: 'policy' },
  { title: 'Allocated Budget ($)', field: 'budget' },
  { title: 'Current Spend ($)', field: 'spend' },
];

export const AegisGovernanceDashboardPage = () => {
  const classes = useStyles();

  return (
    <Page themeId="tool">
      <Content className={classes.content}>
        <ContentHeader title="Governance Dashboard">
          <HeaderLabel label="Compliance" value="Continuous" />
          <HeaderLabel label="Controls" value="Role · Policy · Budget" />
        </ContentHeader>

        <Grid container spacing={4} className={classes.headline}>
          <Grid item xs={12} md={4}>
            <Paper className={classes.card} elevation={0}>
              <Typography className={classes.cardLabel} variant="overline">
                Federated Users Onboarded
              </Typography>
              <Typography className={classes.cardValue}>1,482</Typography>
              <Typography className={classes.cardContext} variant="body2">
                All users validated through DoD Identity Services with CAC/TOTP.
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper className={classes.card} elevation={0}>
              <Typography className={classes.cardLabel} variant="overline">
                Policy Coverage
              </Typography>
              <Typography className={classes.cardValue}>100%</Typography>
              <Typography className={classes.cardContext} variant="body2">
                Mission projects inherit 64 guardrail policies with drift alerts.
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper className={classes.card} elevation={0}>
              <Typography className={classes.cardLabel} variant="overline">
                Budget Adherence
              </Typography>
              <Typography className={classes.cardValue}>96%</Typography>
              <Typography className={classes.cardContext} variant="body2">
                Automated quota enforcement held spend below thresholds for 19 of 21 teams.
              </Typography>
            </Paper>
          </Grid>
        </Grid>

        <Box>
          <Table
            title="Mission Portfolio Controls"
            options={{ paging: false, search: false, padding: 'dense' }}
            columns={columns}
            data={governanceRows}
          />
        </Box>
      </Content>
    </Page>
  );
};
