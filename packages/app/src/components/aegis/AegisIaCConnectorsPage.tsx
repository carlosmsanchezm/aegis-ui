import { useState } from 'react';
import {
  Box,
  Button,
  Chip,
  FormControlLabel,
  Paper,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  makeStyles,
} from '@material-ui/core';
import GitHubIcon from '@material-ui/icons/GitHub';
import MergeTypeIcon from '@material-ui/icons/MergeType';
import SecurityIcon from '@material-ui/icons/Security';
import CloudQueueIcon from '@material-ui/icons/CloudQueue';
import { Page, Content, ContentHeader, InfoCard } from '@backstage/core-components';

const useStyles = makeStyles(theme => ({
  layout: {
    paddingBottom: theme.spacing(6),
  },
  tableCard: {
    padding: theme.spacing(3),
  },
  codeBlock: {
    fontFamily: 'Source Code Pro, monospace',
    background: theme.palette.type === 'dark' ? '#0B1120' : '#F8FAFC',
    padding: theme.spacing(2),
    borderRadius: theme.shape.borderRadius * 2,
    border: `1px solid ${theme.palette.divider}`,
  },
}));

type Connector = {
  provider: 'GitHub' | 'GitLab' | 'Bitbucket' | 'CodeCommit';
  account: string;
  repos: number;
  status: 'Connected' | 'Pending';
  approvals: boolean;
  lastSync: string;
};

const connectors: Connector[] = [
  {
    provider: 'GitHub',
    account: 'aegis-secops',
    repos: 12,
    status: 'Connected',
    approvals: true,
    lastSync: '6 min ago',
  },
  {
    provider: 'GitLab',
    account: 'mission-control',
    repos: 5,
    status: 'Pending',
    approvals: false,
    lastSync: 'Awaiting OAuth',
  },
];

const connectorIcon = (provider: Connector['provider']) => {
  switch (provider) {
    case 'GitHub':
      return <GitHubIcon />;
    case 'GitLab':
      return <MergeTypeIcon />;
    case 'Bitbucket':
      return <SecurityIcon />;
    case 'CodeCommit':
      return <CloudQueueIcon />;
    default:
      return null;
  }
};

export const AegisIaCConnectorsPage = () => {
  const classes = useStyles();
  const [webhookUrl, setWebhookUrl] = useState('https://aegis.run/api/webhooks/plan');
  const [ssoEnforced, setSsoEnforced] = useState(true);

  return (
    <Page themeId="admin">
      <Content className={classes.layout}>
        <ContentHeader title="IaC connectors">
          <Chip label="Pulumi / Terraform" color="primary" />
          <Chip label="Git approvals" variant="outlined" />
        </ContentHeader>

        <Paper className={classes.tableCard} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Provider</TableCell>
                <TableCell>Account</TableCell>
                <TableCell>Repos</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Approvals</TableCell>
                <TableCell>Last sync</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {connectors.map(connector => (
                <TableRow key={connector.account} hover>
                  <TableCell>
                    <Box
                      display="flex"
                      alignItems="center"
                      style={{ gap: 8 }}
                    >
                      {connectorIcon(connector.provider)}
                      <Typography>{connector.provider}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>{connector.account}</TableCell>
                  <TableCell>{connector.repos}</TableCell>
                  <TableCell>
                    <Chip
                      label={connector.status}
                      color={connector.status === 'Connected' ? 'primary' : 'default'}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={connector.approvals ? 'Required' : 'Optional'}
                      color={connector.approvals ? 'primary' : 'default'}
                    />
                  </TableCell>
                  <TableCell>{connector.lastSync}</TableCell>
                  <TableCell align="right">
                    <Button size="small">Configure</Button>
                    <Button size="small">Disconnect</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>

        <Box
          display="grid"
          gridTemplateColumns="repeat(auto-fit, minmax(280px, 1fr))"
          style={{ gap: 16 }}
        >
          <InfoCard title="Runtime policy" subheader="Approval guardrails">
            <FormControlLabel
              control={
                <Switch
                  checked={ssoEnforced}
                  onChange={event => setSsoEnforced(event.target.checked)}
                  color="primary"
                />
              }
              label="Enforce SSO + MFA for plan approvals"
            />
            <Typography variant="body2" color="textSecondary">
              Applies to platform-admin reviewers across Git providers.
            </Typography>
          </InfoCard>
          <InfoCard title="Webhook endpoint" subheader="Connect plan/apply events">
            <TextField
              fullWidth
              label="Webhook URL"
              value={webhookUrl}
              onChange={event => setWebhookUrl(event.target.value)}
            />
            <Typography variant="body2" color="textSecondary" style={{ marginTop: 12 }}>
              Provide this URL to your IaC pipelines. Events stream to the provisioning timeline
              in real time.
            </Typography>
            <Typography component="pre" className={classes.codeBlock}>
              {`curl -X POST ${webhookUrl} \\\n  -H 'X-Aegis-Signature: <hmac>' \\\n  -d '{"status":"plan_complete"}'`}
            </Typography>
          </InfoCard>
        </Box>
      </Content>
    </Page>
  );
};

export default AegisIaCConnectorsPage;
