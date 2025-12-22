import { useEffect, useMemo, useState } from 'react';
import {
  CircularProgress,
  Divider,
  Typography,
  Button,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { SignInPageProps, useApiHolder } from '@backstage/core-plugin-api';
import { UserIdentity, SignInProviderConfig } from '@backstage/core-components';
import { InteractiveBackground } from '../layout/InteractiveBackground';
import { useSearchParams } from 'react-router-dom';

const useStyles = makeStyles(theme => {
  const paletteMode = (theme.palette as any)?.mode ?? theme.palette.type;
  const isDark = paletteMode === 'dark';

  return {
    root: {
      minHeight: '100vh',
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.spacing(6, 3),
      overflow: 'hidden',
    },
    shell: {
      position: 'relative',
      zIndex: 1,
      width: '100%',
      maxWidth: 1200,
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 0.9fr)',
      gap: theme.spacing(6),
      alignItems: 'center',
      [theme.breakpoints.down('md')]: {
        gridTemplateColumns: '1fr',
        textAlign: 'center',
      },
    },
    hero: {
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(3),
      color: theme.palette.text.primary,
    },
    eyebrow: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      padding: theme.spacing(0.75, 2),
      borderRadius: 999,
      fontSize: theme.typography.pxToRem(12.5),
      letterSpacing: '0.2em',
      textTransform: 'uppercase',
      background: isDark
        ? 'rgba(99,102,241,0.16)'
        : 'rgba(59,130,246,0.12)',
      color: isDark ? theme.palette.primary.light : theme.palette.primary.main,
      width: 'fit-content',
      border: `1px solid ${
        isDark ? 'rgba(99,102,241,0.3)' : 'rgba(59,130,246,0.2)'
      }`,
      [theme.breakpoints.down('md')]: {
        margin: '0 auto',
      },
    },
    headline: {
      fontSize: theme.typography.pxToRem(44),
      fontWeight: 700,
      letterSpacing: '-0.02em',
      lineHeight: 1.05,
      maxWidth: 520,
      [theme.breakpoints.down('sm')]: {
        fontSize: theme.typography.pxToRem(34),
      },
    },
    accent: {
      background: isDark
        ? 'linear-gradient(120deg, #A5B4FC, #38BDF8)'
        : 'linear-gradient(120deg, #2563EB, #7C3AED)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
    },
    description: {
      color: theme.palette.text.secondary,
      maxWidth: 480,
      lineHeight: 1.6,
      [theme.breakpoints.down('md')]: {
        margin: '0 auto',
      },
    },
    featureGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      gap: theme.spacing(2),
      [theme.breakpoints.down('sm')]: {
        gridTemplateColumns: '1fr',
      },
    },
    featureCard: {
      padding: theme.spacing(2.5),
      borderRadius: theme.shape.borderRadius * 2,
      background: isDark
        ? 'rgba(15, 23, 42, 0.7)'
        : 'rgba(255, 255, 255, 0.7)',
      border: `1px solid ${theme.palette.divider}`,
      boxShadow: isDark
        ? '0 20px 40px rgba(2, 6, 23, 0.55)'
        : '0 20px 40px rgba(148, 163, 184, 0.25)',
      backdropFilter: 'blur(24px)',
    },
    featureTitle: {
      fontWeight: 600,
      marginBottom: theme.spacing(0.75),
    },
    featureText: {
      color: theme.palette.text.secondary,
      fontSize: theme.typography.pxToRem(14.5),
    },
    card: {
      padding: theme.spacing(4),
      borderRadius: theme.shape.borderRadius * 3,
      background: isDark
        ? 'rgba(15, 23, 42, 0.78)'
        : 'rgba(255, 255, 255, 0.8)',
      border: `1px solid ${theme.palette.divider}`,
      boxShadow: isDark
        ? '0 30px 60px rgba(2, 6, 23, 0.6)'
        : '0 30px 60px rgba(148, 163, 184, 0.35)',
      backdropFilter: 'blur(24px)',
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(3),
    },
    cardHeader: {
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
    },
    providerList: {
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1.5),
    },
    providerButton: {
      justifyContent: 'space-between',
      padding: theme.spacing(1.5, 2.5),
      borderRadius: theme.shape.borderRadius * 2,
      border: `1px solid ${theme.palette.divider}`,
      textTransform: 'none',
      fontWeight: 600,
      fontSize: theme.typography.pxToRem(15),
      color: theme.palette.text.primary,
      background: isDark
        ? 'rgba(2, 6, 23, 0.7)'
        : 'rgba(255, 255, 255, 0.9)',
      transition: theme.transitions.create(['transform', 'box-shadow'], {
        duration: theme.transitions.duration.shorter,
      }),
      '&:hover': {
        transform: 'translateY(-2px)',
        boxShadow: isDark
          ? '0 18px 30px rgba(2, 6, 23, 0.55)'
          : '0 18px 30px rgba(148, 163, 184, 0.28)',
      },
    },
    providerMeta: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      textAlign: 'left',
      gap: theme.spacing(0.25),
      flex: 1,
    },
    providerTitle: {
      fontWeight: 600,
    },
    providerMessage: {
      fontSize: theme.typography.pxToRem(12.5),
      color: theme.palette.text.secondary,
    },
    statusRow: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing(2),
      color: theme.palette.text.secondary,
      fontSize: theme.typography.pxToRem(12.5),
    },
    footer: {
      color: theme.palette.text.secondary,
      fontSize: theme.typography.pxToRem(12.5),
      lineHeight: 1.6,
    },
    error: {
      color: theme.palette.error.main,
      fontSize: theme.typography.pxToRem(13),
    },
  };
});

export type AegisSignInPageProps = SignInPageProps & {
  providers?: SignInProviderConfig[];
  provider?: SignInProviderConfig;
  auto?: boolean;
};

export const AegisSignInPage = ({
  onSignInSuccess,
  providers,
  provider,
  auto = false,
}: AegisSignInPageProps) => {
  const classes = useStyles();
  const apiHolder = useApiHolder();
  const [activeProviderId, setActiveProviderId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [searchParams] = useSearchParams();

  const resolvedProviders = useMemo(
    () => provider ? [provider] : providers ?? [],
    [provider, providers],
  );

  useEffect(() => {
    let isMounted = true;

    const checkExistingSession = async () => {
      const errorParam = searchParams.get('error');
      if (errorParam && isMounted) {
        setErrorMessage(errorParam);
      }

      for (const providerConfig of resolvedProviders) {
        const authApi = apiHolder.get(providerConfig.apiRef);
        if (!authApi) {
          continue;
        }

        try {
          const identityResponse = await authApi.getBackstageIdentity({
            optional: true,
          });

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
        } catch (error) {
          // Ignore optional session checks.
        }
      }

      if (isMounted) {
        setCheckingSession(false);
      }
    };

    checkExistingSession();

    return () => {
      isMounted = false;
    };
  }, [apiHolder, onSignInSuccess, resolvedProviders, searchParams]);

  useEffect(() => {
    if (!auto || resolvedProviders.length !== 1 || checkingSession) {
      return;
    }

    const [singleProvider] = resolvedProviders;
    const authApi = apiHolder.get(singleProvider.apiRef);
    if (!authApi) {
      return;
    }

    const start = async () => {
      try {
        setActiveProviderId(singleProvider.id);
        const identityResponse = await authApi.getBackstageIdentity({
          instantPopup: true,
        });
        if (!identityResponse) {
          throw new Error(
            `${singleProvider.title} is not configured to support sign-in.`,
          );
        }
        const profile = await authApi.getProfile();
        onSignInSuccess(
          UserIdentity.create({
            identity: identityResponse.identity,
            authApi,
            profile,
          }),
        );
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : 'Sign-in failed.',
        );
        setActiveProviderId(null);
      }
    };

    start();
  }, [apiHolder, auto, checkingSession, onSignInSuccess, resolvedProviders]);

  const handleSignIn = async (providerConfig: SignInProviderConfig) => {
    const authApi = apiHolder.get(providerConfig.apiRef);
    if (!authApi) {
      setErrorMessage('Authentication provider is not available.');
      return;
    }

    try {
      setActiveProviderId(providerConfig.id);
      setErrorMessage(null);
      const identityResponse = await authApi.getBackstageIdentity({
        instantPopup: true,
      });

      if (!identityResponse) {
        throw new Error(
          `${providerConfig.title} is not configured to support sign-in.`,
        );
      }

      const profile = await authApi.getProfile();
      onSignInSuccess(
        UserIdentity.create({
          identity: identityResponse.identity,
          authApi,
          profile,
        }),
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Sign-in failed.');
      setActiveProviderId(null);
    }
  };

  return (
    <div className={classes.root}>
      <InteractiveBackground />
      <div className={classes.shell}>
        <div className={classes.hero}>
          <span className={classes.eyebrow}>Aegis access portal</span>
          <Typography variant="h1" className={classes.headline}>
            Deploy, secure, and govern with{' '}
            <span className={classes.accent}>Aegis</span>
          </Typography>
          <Typography variant="body1" className={classes.description}>
            Sign in through your identity provider and step directly into the
            control plane. Aegis stays modular so any OIDC or SAML-backed IDP can
            power the experience.
          </Typography>
          <div className={classes.featureGrid}>
            <div className={classes.featureCard}>
              <Typography variant="subtitle1" className={classes.featureTitle}>
                Lusion-inspired motion
              </Typography>
              <Typography variant="body2" className={classes.featureText}>
                Fluid gradients, soft glows, and depth-driven layers give the
                sign-in journey cinematic polish.
              </Typography>
            </div>
            <div className={classes.featureCard}>
              <Typography variant="subtitle1" className={classes.featureTitle}>
                Modular identity
              </Typography>
              <Typography variant="body2" className={classes.featureText}>
                Swap Keycloak, Okta, Azure AD, or custom OIDC with the same UI
                surface and redirect flow.
              </Typography>
            </div>
          </div>
        </div>

        <div className={classes.card}>
          <div className={classes.cardHeader}>
            <Typography variant="h5">Welcome back</Typography>
            <Typography variant="body2" color="textSecondary">
              Choose your secure sign-in method to continue.
            </Typography>
          </div>

          <div className={classes.providerList}>
            {resolvedProviders.length === 0 ? (
              <Typography variant="body2" color="textSecondary">
                No providers configured. Add an OIDC provider to enable sign in.
              </Typography>
            ) : (
              resolvedProviders.map(providerConfig => (
                <Button
                  key={providerConfig.id}
                  className={classes.providerButton}
                  onClick={() => handleSignIn(providerConfig)}
                  disabled={
                    checkingSession ||
                    (activeProviderId !== null &&
                      activeProviderId !== providerConfig.id)
                  }
                >
                  <span className={classes.providerMeta}>
                    <span className={classes.providerTitle}>
                      {providerConfig.title}
                    </span>
                    <span className={classes.providerMessage}>
                      {providerConfig.message}
                    </span>
                  </span>
                  {activeProviderId === providerConfig.id ? (
                    <CircularProgress size={18} />
                  ) : (
                    <span aria-hidden>→</span>
                  )}
                </Button>
              ))
            )}
          </div>

          {errorMessage ? (
            <Typography className={classes.error}>{errorMessage}</Typography>
          ) : null}

          <Divider />
          <div className={classes.statusRow}>
            <span>Session check</span>
            <span>
              {checkingSession ? 'Scanning existing sessions…' : 'Ready'}
            </span>
          </div>
          <Typography className={classes.footer}>
            Your credentials stay with your identity provider. Aegis only
            receives verified user tokens and profile claims.
          </Typography>
        </div>
      </div>
    </div>
  );
};
