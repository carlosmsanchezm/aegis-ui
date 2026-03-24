import { FC } from 'react';
import {
  Page,
  Content,
  ContentHeader,
  HeaderLabel,
  WarningPanel,
} from '@backstage/core-components';
import {
  Box,
  Button,
  Paper,
  Typography,
  makeStyles,
} from '@material-ui/core';
import OpenInNewIcon from '@material-ui/icons/OpenInNew';
import VpnKeyIcon from '@material-ui/icons/VpnKey';

const useStyles = makeStyles(theme => ({
  layout: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(4),
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
  keycloakInfo: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: theme.spacing(3),
    padding: theme.spacing(6, 2),
    textAlign: 'center',
  },
  iconWrapper: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 64,
    height: 64,
    borderRadius: '50%',
    backgroundColor:
      theme.palette.type === 'dark'
        ? 'rgba(96, 165, 250, 0.15)'
        : 'rgba(79, 70, 229, 0.1)',
  },
}));

export const AegisUserManagementPage: FC = () => {
  const classes = useStyles();

  return (
    <Page themeId="tool">
      <Content>
        <ContentHeader title="User Management">
          <HeaderLabel label="Administration" value="Roles & access" />
        </ContentHeader>
        <div className={classes.layout}>
          <Paper className={classes.card}>
            <div className={classes.keycloakInfo}>
              <div className={classes.iconWrapper}>
                <VpnKeyIcon color="primary" style={{ fontSize: 32 }} />
              </div>
              <Typography variant="h5">
                Managed through Keycloak
              </Typography>
              <Typography variant="body1" color="textSecondary" style={{ maxWidth: 560 }}>
                User management, roles, and access controls are handled through your
                Keycloak admin console. Configure users, groups, and role mappings directly
                in Keycloak to manage access to Aegis.
              </Typography>
              <Box display="flex" flexWrap="wrap" justifyContent="center" gridGap={12}>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<OpenInNewIcon />}
                  href="/auth/keycloak"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open Keycloak Console
                </Button>
              </Box>
            </div>
          </Paper>

          <WarningPanel severity="info" title="User directory integration">
            A read-only user directory view will be available in a future release once the
            Keycloak admin REST API integration is implemented. Until then, all user and role
            management should be performed directly in the Keycloak admin console.
          </WarningPanel>
        </div>
      </Content>
    </Page>
  );
};
