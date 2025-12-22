import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  configApiRef,
  SignInPageProps,
  useAnalytics,
  useApi,
} from '@backstage/core-plugin-api';
import { UserIdentity } from '@backstage/core-components';
import {
  Box,
  Button,
  CircularProgress,
  Grid,
  TextField,
  Typography,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import LockOpenIcon from '@material-ui/icons/LockOpen';
import SecurityIcon from '@material-ui/icons/Security';
import SwapHorizIcon from '@material-ui/icons/SwapHoriz';
import { keycloakAuthApiRef } from '../../apis';

const useStyles = makeStyles(theme => ({
  root: {
    minHeight: '100vh',
    backgroundColor: '#05060b',
    backgroundImage:
      'radial-gradient(circle at 10% 20%, rgba(80, 134, 255, 0.25), transparent 45%),\n       radial-gradient(circle at 85% 15%, rgba(209, 97, 255, 0.18), transparent 40%),\n       radial-gradient(circle at 80% 80%, rgba(60, 210, 180, 0.22), transparent 45%)',
    color: '#f7f8ff',
    position: 'relative',
    overflow: 'hidden',
  },
  glowLayer: {
    position: 'absolute',
    inset: 0,
    '&::before': {
      content: '""',
      position: 'absolute',
      width: 420,
      height: 420,
      left: '-6%',
      top: '12%',
      borderRadius: '50%',
      background:
        'radial-gradient(circle, rgba(83, 119, 255, 0.5), rgba(83, 119, 255, 0) 70%)',
      filter: 'blur(6px)',
      opacity: 0.7,
    },
    '&::after': {
      content: '""',
      position: 'absolute',
      width: 520,
      height: 520,
      right: '-12%',
      bottom: '-8%',
      borderRadius: '50%',
      background:
        'radial-gradient(circle, rgba(189, 92, 255, 0.45), rgba(189, 92, 255, 0) 70%)',
      filter: 'blur(10px)',
      opacity: 0.8,
    },
  },
  content: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    alignItems: 'center',
    minHeight: '100vh',
    padding: theme.spacing(8, 6),
    [theme.breakpoints.down('sm')]: {
      padding: theme.spacing(6, 3),
    },
  },
  brandBlock: {
    maxWidth: 520,
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(0.75, 1.75),
    borderRadius: 999,
    background: 'rgba(255, 255, 255, 0.08)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  headline: {
    fontSize: 'clamp(2.6rem, 3vw, 3.4rem)',
    fontWeight: 700,
    marginTop: theme.spacing(3),
    marginBottom: theme.spacing(2),
  },
  subline: {
    color: 'rgba(247, 248, 255, 0.72)',
    fontSize: 16,
  },
  featureList: {
    marginTop: theme.spacing(4),
    display: 'grid',
    gap: theme.spacing(2.5),
  },
  featureItem: {
    display: 'flex',
    gap: theme.spacing(1.5),
    alignItems: 'flex-start',
    color: 'rgba(247, 248, 255, 0.82)',
  },
  featureIcon: {
    marginTop: 2,
    color: '#6ee7ff',
  },
  card: {
    width: '100%',
    maxWidth: 460,
    marginLeft: 'auto',
    padding: theme.spacing(4),
    borderRadius: 28,
    background: 'rgba(12, 16, 33, 0.72)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    boxShadow: '0 24px 60px rgba(3, 6, 20, 0.45)',
    backdropFilter: 'blur(18px)',
    [theme.breakpoints.down('sm')]: {
      marginLeft: 0,
      marginTop: theme.spacing(5),
    },
  },
  cardHeader: {
    marginBottom: theme.spacing(3),
  },
  primaryButton: {
    marginTop: theme.spacing(2),
    padding: theme.spacing(1.4, 2.5),
    borderRadius: 14,
    background: 'linear-gradient(120deg, #5d7bff, #7b4dff)',
    color: '#fff',
    fontWeight: 600,
  },
  outlineButton: {
    marginTop: theme.spacing(1.5),
    borderRadius: 14,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    color: '#fff',
  },
  helperText: {
    marginTop: theme.spacing(2),
    color: 'rgba(247, 248, 255, 0.6)',
    fontSize: 13,
  },
  credentials: {
    marginTop: theme.spacing(4),
    paddingTop: theme.spacing(3),
    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
  },
  inputField: {
    marginTop: theme.spacing(2),
    '& .MuiInputBase-root': {
      color: '#fff',
    },
    '& .MuiInputLabel-root': {
      color: 'rgba(255, 255, 255, 0.6)',
    },
    '& .MuiOutlinedInput-notchedOutline': {
      borderColor: 'rgba(255, 255, 255, 0.15)',
    },
  },
  errorText: {
    marginTop: theme.spacing(2),
    color: theme.palette.error.light,
  },
  footer: {
    marginTop: theme.spacing(4),
    color: 'rgba(247, 248, 255, 0.5)',
    fontSize: 12,
  },
  spinnerWrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
  },
}));

export const AegisSignInPage = ({ onSignInSuccess }: SignInPageProps) => {
  const classes = useStyles();
  const authApi = useApi(keycloakAuthApiRef);
  const analytics = useAnalytics();
  const configApi = useApi(configApiRef);
  const [searchParams] = useSearchParams();
  const errorParam = searchParams.get('error');
  const [error, setError] = useState<Error>();
  const [ready, setReady] = useState(false);

  const provider = {
    id: 'keycloak',
    title: 'Sign in with Keycloak',
    message: "You'll be redirected to Keycloak (CAC/TOTP).",
  };

  const login = useCallback(async ({ checkExisting, showPopup }: { checkExisting?: boolean; showPopup?: boolean }) => {
    try {
      let identityResponse = undefined;
      if (checkExisting) {
        identityResponse = await authApi.getBackstageIdentity({ optional: true });
      }
      if (!identityResponse && (showPopup || !checkExisting) && !errorParam) {
        setReady(true);
        identityResponse = await authApi.getBackstageIdentity({ instantPopup: true });
        if (!identityResponse) {
          throw new Error(
            `The ${provider.title} provider is not configured to support sign-in`,
          );
        }
      }
      if (!identityResponse) {
        setReady(true);
        return;
      }
      const profile = await authApi.getProfile();
      onSignInSuccess(
        UserIdentity.create({
          identity: identityResponse.identity,
          authApi,
          profile,
        }),
      );
      analytics.captureEvent('signIn', 'success');
    } catch (caughtError) {
      setError(caughtError as Error);
      setReady(true);
    }
  }, [analytics, authApi, errorParam, onSignInSuccess, provider.title]);

  useEffect(() => {
    if (errorParam) {
      setError(new Error(errorParam));
      setReady(true);
      return;
    }
    login({ checkExisting: true });
  }, [errorParam, login]);

  if (!ready) {
    return (
      <Box className={classes.root}>
        <div className={classes.glowLayer} />
        <div className={classes.spinnerWrap}>
          <CircularProgress color="inherit" />
        </div>
      </Box>
    );
  }

  return (
    <Box className={classes.root}>
      <div className={classes.glowLayer} />
      <Grid container className={classes.content} spacing={6}>
        <Grid item xs={12} md={7}>
          <Box className={classes.brandBlock}>
            <div className={classes.badge}>
              <span>AEGIS</span>
              <span>SECURE ACCESS</span>
            </div>
            <Typography variant="h1" className={classes.headline}>
              {configApi.getString('app.title')} is ready to sync with your identity.
            </Typography>
            <Typography variant="body1" className={classes.subline}>
              Aegis brings a fluid sign-in experience that adapts to any OIDC or SAML
              provider. Keep the momentum flowing with immersive visuals and secure
              access.
            </Typography>
            <div className={classes.featureList}>
              <div className={classes.featureItem}>
                <SecurityIcon className={classes.featureIcon} />
                <div>
                  <Typography variant="subtitle1">Security-forward entry</Typography>
                  <Typography variant="body2" className={classes.subline}>
                    Enforce MFA, CAC, and risk-based checks without breaking the flow.
                  </Typography>
                </div>
              </div>
              <div className={classes.featureItem}>
                <SwapHorizIcon className={classes.featureIcon} />
                <div>
                  <Typography variant="subtitle1">Plug any IdP</Typography>
                  <Typography variant="body2" className={classes.subline}>
                    Drop in your preferred OIDC provider and keep the same experience.
                  </Typography>
                </div>
              </div>
              <div className={classes.featureItem}>
                <LockOpenIcon className={classes.featureIcon} />
                <div>
                  <Typography variant="subtitle1">Optional credential mode</Typography>
                  <Typography variant="body2" className={classes.subline}>
                    Provide local credentials only when your auth backend is configured.
                  </Typography>
                </div>
              </div>
            </div>
          </Box>
        </Grid>
        <Grid item xs={12} md={5}>
          <Box className={classes.card}>
            <div className={classes.cardHeader}>
              <Typography variant="h4">Sign in</Typography>
              <Typography variant="body2" className={classes.subline}>
                Continue with your organization’s identity provider.
              </Typography>
            </div>
            <Button
              fullWidth
              className={classes.primaryButton}
              onClick={() => login({ showPopup: true })}
            >
              Continue with Keycloak SSO
            </Button>
            <Typography className={classes.helperText}>
              You’ll be redirected to Keycloak for secure verification.
            </Typography>
            {error && (
              <Typography variant="body2" className={classes.errorText}>
                {error.message}
              </Typography>
            )}
            <div className={classes.credentials}>
              <Typography variant="subtitle1">Direct credentials (optional)</Typography>
              <Typography variant="body2" className={classes.subline}>
                Enable password-based sign-in by wiring your auth backend to the Aegis
                credential connector.
              </Typography>
              <TextField
                className={classes.inputField}
                variant="outlined"
                label="Username"
                fullWidth
                disabled
              />
              <TextField
                className={classes.inputField}
                variant="outlined"
                label="Password"
                type="password"
                fullWidth
                disabled
              />
              <Button
                className={classes.outlineButton}
                variant="outlined"
                fullWidth
                disabled
              >
                Sign in with credentials
              </Button>
            </div>
            <Typography className={classes.footer}>
              Need another IdP? Update your auth provider configuration to add a new
              OIDC/SAML connector.
            </Typography>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};
