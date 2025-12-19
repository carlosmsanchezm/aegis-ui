import { useEffect, useState } from 'react';
import {
  Button,
  Divider,
  Grid,
  Paper,
  TextField,
  Typography,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import VpnKeyIcon from '@material-ui/icons/VpnKey';
import {
  BackstageIdentityResponse,
  configApiRef,
  SignInPageProps,
  useApi,
  useAnalytics,
} from '@backstage/core-plugin-api';
import { UserIdentity } from '@backstage/core-components';
import { keycloakAuthApiRef } from '../../apis';

const useStyles = makeStyles(theme => {
  const glowPrimary = theme.palette.primary.main;
  const glowSecondary = theme.palette.secondary.main;

  return {
    root: {
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.spacing(6, 3),
      position: 'relative',
      overflow: 'hidden',
    },
    glow: {
      position: 'absolute',
      width: 420,
      height: 420,
      borderRadius: '50%',
      filter: 'blur(80px)',
      opacity: 0.35,
      background: `radial-gradient(circle, ${glowPrimary} 0%, transparent 70%)`,
      top: '-10%',
      left: '-10%',
      animation: '$pulse 12s ease-in-out infinite',
      pointerEvents: 'none',
    },
    glowSecondary: {
      position: 'absolute',
      width: 520,
      height: 520,
      borderRadius: '50%',
      filter: 'blur(90px)',
      opacity: 0.25,
      background: `radial-gradient(circle, ${glowSecondary} 0%, transparent 70%)`,
      bottom: '-20%',
      right: '-15%',
      animation: '$pulse 14s ease-in-out infinite',
      pointerEvents: 'none',
    },
    content: {
      position: 'relative',
      zIndex: 1,
      width: '100%',
      maxWidth: 1020,
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 420px) minmax(0, 1fr)',
      gap: theme.spacing(6),
      alignItems: 'center',
      [theme.breakpoints.down('sm')]: {
        gridTemplateColumns: '1fr',
      },
    },
    card: {
      background: 'var(--aegis-card-surface)',
      border: '1px solid var(--aegis-card-border)',
      boxShadow: 'var(--aegis-card-shadow)',
      borderRadius: theme.spacing(2),
      padding: theme.spacing(4),
      backdropFilter: 'blur(6px)',
    },
    cardHeader: {
      marginBottom: theme.spacing(2),
    },
    fields: {
      display: 'grid',
      gap: theme.spacing(2),
      marginTop: theme.spacing(3),
    },
    signInButton: {
      marginTop: theme.spacing(2),
    },
    helperText: {
      marginTop: theme.spacing(2),
      color: theme.palette.text.secondary,
    },
    divider: {
      margin: theme.spacing(3, 0),
    },
    benefitList: {
      marginTop: theme.spacing(2),
      display: 'grid',
      gap: theme.spacing(1),
    },
    benefitItem: {
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1.5),
      color: theme.palette.text.secondary,
    },
    badge: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      padding: theme.spacing(0.5, 1.5),
      borderRadius: 999,
      background: 'var(--aegis-muted)',
      color: theme.palette.text.secondary,
      fontWeight: 600,
      fontSize: '0.75rem',
      letterSpacing: '0.02em',
      textTransform: 'uppercase',
    },
    globeWrap: {
      position: 'relative',
      width: 360,
      height: 360,
      margin: '0 auto',
      [theme.breakpoints.down('sm')]: {
        width: 280,
        height: 280,
      },
    },
    globe: {
      position: 'absolute',
      inset: 0,
      borderRadius: '50%',
      background: `radial-gradient(circle at 30% 30%, rgba(255,255,255,0.18), transparent 55%), radial-gradient(circle at 70% 70%, ${theme.palette.primary.main}55, transparent 60%), radial-gradient(circle at 50% 50%, ${theme.palette.secondary.main}44, transparent 65%), ${theme.palette.background.paper}`,
      border: `1px solid ${theme.palette.divider}`,
      boxShadow: `0 35px 80px rgba(0,0,0,0.35), 0 0 60px ${theme.palette.primary.main}33`,
      overflow: 'hidden',
      animation: '$float 10s ease-in-out infinite',
    },
    globeRings: {
      position: 'absolute',
      inset: '10% 5%',
      borderRadius: '50%',
      border: `1px solid ${theme.palette.primary.main}33`,
      animation: '$spin 20s linear infinite',
      '&::before, &::after': {
        content: '""',
        position: 'absolute',
        inset: '10% 15%',
        borderRadius: '50%',
        border: `1px solid ${theme.palette.secondary.main}33`,
      },
      '&::after': {
        inset: '25% 30%',
        border: `1px dashed ${theme.palette.primary.main}55`,
      },
    },
    globeGrid: {
      position: 'absolute',
      inset: 0,
      backgroundImage:
        'repeating-linear-gradient(90deg, rgba(255,255,255,0.05) 0, rgba(255,255,255,0.05) 2px, transparent 2px, transparent 16px), repeating-linear-gradient(0deg, rgba(255,255,255,0.04) 0, rgba(255,255,255,0.04) 2px, transparent 2px, transparent 14px)',
      opacity: 0.55,
      mixBlendMode: 'screen',
      animation: '$drift 18s linear infinite',
    },
    orbit: {
      position: 'absolute',
      width: 12,
      height: 12,
      borderRadius: '50%',
      background: theme.palette.secondary.light,
      top: '12%',
      left: '50%',
      transform: 'translateX(-50%)',
      boxShadow: `0 0 18px ${theme.palette.secondary.main}`,
      animation: '$orbit 12s linear infinite',
    },
    tagline: {
      marginTop: theme.spacing(2),
      color: theme.palette.text.secondary,
    },
    '@keyframes float': {
      '0%': { transform: 'translateY(0px)' },
      '50%': { transform: 'translateY(-12px)' },
      '100%': { transform: 'translateY(0px)' },
    },
    '@keyframes spin': {
      '0%': { transform: 'rotate(0deg)' },
      '100%': { transform: 'rotate(360deg)' },
    },
    '@keyframes drift': {
      '0%': { transform: 'translateX(0%)' },
      '100%': { transform: 'translateX(-20%)' },
    },
    '@keyframes orbit': {
      '0%': { transform: 'translate(-50%, 0) rotate(0deg) translateX(150px)' },
      '100%': {
        transform: 'translate(-50%, 0) rotate(360deg) translateX(150px)',
      },
    },
    '@keyframes pulse': {
      '0%': { transform: 'scale(1)', opacity: 0.2 },
      '50%': { transform: 'scale(1.1)', opacity: 0.4 },
      '100%': { transform: 'scale(1)', opacity: 0.2 },
    },
  };
});

export const AegisSignInPage = ({ onSignInSuccess }: SignInPageProps) => {
  const classes = useStyles();
  const authApi = useApi(keycloakAuthApiRef);
  const configApi = useApi(configApiRef);
  const analytics = useAnalytics();
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);

  const handleSignIn = async () => {
    try {
      setError(null);
      const identityResponse = await authApi.getBackstageIdentity({
        instantPopup: true,
      });
      if (!identityResponse) {
        throw new Error('Keycloak sign-in is not available.');
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
    } catch (err) {
      setError(err as Error);
    }
  };

  useEffect(() => {
    let mounted = true;
    const checkExisting = async () => {
      try {
        const identityResponse: BackstageIdentityResponse | undefined =
          await authApi.getBackstageIdentity({ optional: true });
        if (!mounted) {
          return;
        }
        if (identityResponse) {
          const profile = await authApi.getProfile();
          onSignInSuccess(
            UserIdentity.create({
              identity: identityResponse.identity,
              authApi,
              profile,
            }),
          );
          return;
        }
      } catch (err) {
        if (mounted) {
          setError(err as Error);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    checkExisting();
    return () => {
      mounted = false;
    };
  }, [authApi, onSignInSuccess]);

  if (loading) {
    return null;
  }

  return (
    <div className={classes.root}>
      <div className={classes.glow} />
      <div className={classes.glowSecondary} />
      <div className={classes.content}>
        <Paper className={classes.card} elevation={0}>
          <div className={classes.cardHeader}>
            <span className={classes.badge}>Secure access</span>
            <Typography variant="h4" component="h1" gutterBottom>
              Welcome to {configApi.getString('app.title')}
            </Typography>
            <Typography variant="body1" className={classes.tagline}>
              Sign in with your organization&apos;s identity provider. Aegis is
              built to plug into any OIDC-ready SSO flow.
            </Typography>
          </div>
          <form
            onSubmit={event => {
              event.preventDefault();
              handleSignIn();
            }}
          >
            <div className={classes.fields}>
              <TextField
                label="Username"
                variant="outlined"
                fullWidth
                autoComplete="username"
              />
              <TextField
                label="Password"
                variant="outlined"
                type="password"
                fullWidth
                autoComplete="current-password"
              />
            </div>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              fullWidth
              size="large"
              className={classes.signInButton}
              startIcon={<VpnKeyIcon />}
            >
              Sign in to Aegis
            </Button>
          </form>
          <Typography variant="body2" className={classes.helperText}>
            Credentials are validated by your configured IdP (Keycloak, Okta,
            Azure AD, or any OIDC provider).
          </Typography>
          {error ? (
            <Typography variant="body2" color="error" className={classes.helperText}>
              {error.message}
            </Typography>
          ) : null}
          <Divider className={classes.divider} />
          <Typography variant="subtitle1">Security signals you can trust</Typography>
          <div className={classes.benefitList}>
            <div className={classes.benefitItem}>
              <span>●</span>
              <Typography variant="body2">Unified access across clusters and clouds.</Typography>
            </div>
            <div className={classes.benefitItem}>
              <span>●</span>
              <Typography variant="body2">Policy enforcement from first login.</Typography>
            </div>
            <div className={classes.benefitItem}>
              <span>●</span>
              <Typography variant="body2">Just-in-time access for sensitive actions.</Typography>
            </div>
          </div>
        </Paper>
        <Grid container spacing={4} alignItems="center">
          <Grid item xs={12}>
            <Typography variant="h2">Aegis Identity Mesh</Typography>
            <Typography variant="body1" className={classes.tagline}>
              A crisp, animated identity globe keeps the experience modern while
              your team authenticates. It mirrors the Aegis brand palette and
              stays lightweight on performance.
            </Typography>
          </Grid>
          <Grid item xs={12}>
            <div className={classes.globeWrap}>
              <div className={classes.globe}>
                <div className={classes.globeGrid} />
                <div className={classes.globeRings} />
                <div className={classes.orbit} />
              </div>
            </div>
          </Grid>
        </Grid>
      </div>
    </div>
  );
};
