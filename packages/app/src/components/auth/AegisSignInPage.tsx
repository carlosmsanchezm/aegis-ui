import { useCallback, useEffect, useMemo, useState } from 'react';
import { configApiRef, SignInPageProps, useApi } from '@backstage/core-plugin-api';
import { SignInProviderConfig, UserIdentity } from '@backstage/core-components';
import {
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Typography,
  useMediaQuery,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { alpha } from '@material-ui/core/styles/colorManipulator';

type AegisSignInPageProps = SignInPageProps & {
  providers: SignInProviderConfig[];
  auto?: boolean;
};

type ProviderButtonProps = {
  provider: SignInProviderConfig;
  onSignInSuccess: SignInPageProps['onSignInSuccess'];
  auto?: boolean;
};

const useStyles = makeStyles(theme => ({
  root: {
    minHeight: '100vh',
    display: 'grid',
    gridTemplateColumns: 'minmax(320px, 1.05fr) minmax(320px, 1fr)',
    gap: theme.spacing(6),
    alignItems: 'center',
    padding: theme.spacing(6),
    [theme.breakpoints.down('md')]: {
      gridTemplateColumns: '1fr',
      padding: theme.spacing(4),
    },
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(3),
  },
  brand: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    padding: theme.spacing(1, 2),
    borderRadius: 999,
    background: alpha(theme.palette.primary.main, 0.12),
    color: theme.palette.primary.main,
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    width: 'fit-content',
  },
  card: {
    borderRadius: theme.spacing(2),
    background: alpha(theme.palette.background.paper, 0.92),
    border: `1px solid ${alpha(theme.palette.text.primary, 0.08)}`,
    boxShadow: `0 24px 60px ${alpha(theme.palette.common.black, 0.35)}`,
    backdropFilter: 'blur(18px)',
  },
  providerStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
  },
  providerHint: {
    color: theme.palette.text.secondary,
  },
  helper: {
    color: theme.palette.text.secondary,
    fontSize: '0.9rem',
  },
  rightPanel: {
    position: 'relative',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 420,
    [theme.breakpoints.down('md')]: {
      minHeight: 320,
      order: -1,
    },
  },
  globe: {
    width: 360,
    height: 360,
    borderRadius: '50%',
    position: 'relative',
    background: `radial-gradient(circle at 30% 30%, ${alpha(
      theme.palette.primary.light,
      0.95,
    )}, ${alpha(theme.palette.primary.dark, 0.6)} 42%, ${alpha(
      theme.palette.common.black,
      0.9,
    )} 80%)`,
    boxShadow: `0 0 120px ${alpha(
      theme.palette.primary.main,
      0.45,
    )}, inset 0 0 40px ${alpha(theme.palette.common.black, 0.7)}`,
    overflow: 'hidden',
    animation: '$float 14s ease-in-out infinite',
    '&::before': {
      content: '""',
      position: 'absolute',
      inset: '-25%',
      background:
        'repeating-linear-gradient(90deg, rgba(255,255,255,0.18) 0px, rgba(255,255,255,0.18) 2px, transparent 2px, transparent 16px)',
      opacity: 0.4,
      animation: '$spin 22s linear infinite',
    },
    '&::after': {
      content: '""',
      position: 'absolute',
      inset: '12% 16% 55% 12%',
      borderRadius: '50%',
      background: `radial-gradient(circle, ${alpha(
        theme.palette.secondary.light,
        0.6,
      )} 0%, transparent 70%)`,
      filter: 'blur(2px)',
    },
    [theme.breakpoints.down('sm')]: {
      width: 260,
      height: 260,
    },
  },
  orbit: {
    position: 'absolute',
    width: 440,
    height: 180,
    borderRadius: '50%',
    border: `1px solid ${alpha(theme.palette.secondary.light, 0.45)}`,
    animation: '$tilt 18s ease-in-out infinite',
    [theme.breakpoints.down('sm')]: {
      width: 320,
      height: 140,
    },
  },
  orbitSecond: {
    position: 'absolute',
    width: 300,
    height: 320,
    borderRadius: '50%',
    border: `1px dashed ${alpha(theme.palette.primary.light, 0.35)}`,
    animation: '$spinSlow 26s linear infinite',
    [theme.breakpoints.down('sm')]: {
      width: 220,
      height: 240,
    },
  },
  particle: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: alpha(theme.palette.secondary.main, 0.9),
    boxShadow: `0 0 14px ${alpha(theme.palette.secondary.main, 0.7)}`,
    animation: '$pulse 6s ease-in-out infinite',
  },
  particleOne: {
    top: '12%',
    right: '18%',
    animationDelay: '0s',
  },
  particleTwo: {
    bottom: '20%',
    left: '16%',
    animationDelay: '1.4s',
  },
  particleThree: {
    bottom: '12%',
    right: '28%',
    animationDelay: '2.6s',
  },
  caption: {
    marginTop: theme.spacing(2),
    textAlign: 'center',
    color: theme.palette.text.secondary,
  },
  '@keyframes float': {
    '0%': { transform: 'translateY(0px)' },
    '50%': { transform: 'translateY(-16px)' },
    '100%': { transform: 'translateY(0px)' },
  },
  '@keyframes spin': {
    '0%': { transform: 'rotate(0deg)' },
    '100%': { transform: 'rotate(360deg)' },
  },
  '@keyframes spinSlow': {
    '0%': { transform: 'rotate(0deg)' },
    '100%': { transform: 'rotate(-360deg)' },
  },
  '@keyframes tilt': {
    '0%': { transform: 'rotate(-8deg)' },
    '50%': { transform: 'rotate(8deg)' },
    '100%': { transform: 'rotate(-8deg)' },
  },
  '@keyframes pulse': {
    '0%': { transform: 'scale(1)', opacity: 0.75 },
    '50%': { transform: 'scale(1.6)', opacity: 0.35 },
    '100%': { transform: 'scale(1)', opacity: 0.75 },
  },
  '@media (prefers-reduced-motion: reduce)': {
    globe: {
      animation: 'none',
    },
    orbit: {
      animation: 'none',
    },
    orbitSecond: {
      animation: 'none',
    },
    particle: {
      animation: 'none',
    },
  },
}));

const ProviderButton = ({ provider, onSignInSuccess, auto }: ProviderButtonProps) => {
  const authApi = useApi(provider.apiRef);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const signIn = useCallback(
    async (options?: { optional?: boolean; instantPopup?: boolean }) => {
      setIsLoading(true);
      setError(null);
      try {
        const identityResponse = await authApi.getBackstageIdentity({
          optional: options?.optional,
          instantPopup: options?.instantPopup,
        });

        if (!identityResponse) {
          throw new Error(
            `The ${provider.title} provider is not configured to support sign-in`,
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
      } catch (err) {
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    },
    [authApi, onSignInSuccess, provider.title],
  );

  useEffect(() => {
    let isMounted = true;

    const checkExistingSession = async () => {
      try {
        const identityResponse = await authApi.getBackstageIdentity({
          optional: true,
        });
        if (!identityResponse || !isMounted) {
          if (auto) {
            await signIn({ instantPopup: true });
          }
          return;
        }

        const profile = await authApi.getProfile();
        if (!isMounted) {
          return;
        }
        onSignInSuccess(
          UserIdentity.create({
            identity: identityResponse.identity,
            authApi,
            profile,
          }),
        );
      } catch (err) {
        if (auto && isMounted) {
          setError(err as Error);
        }
      }
    };

    checkExistingSession();

    return () => {
      isMounted = false;
    };
  }, [authApi, auto, onSignInSuccess, signIn]);

  return (
    <Box>
      <Button
        fullWidth
        variant="contained"
        color="primary"
        disabled={isLoading}
        onClick={() => signIn({ instantPopup: true })}
      >
        {isLoading ? 'Connecting…' : provider.title}
      </Button>
      <Typography variant="body2" color="textSecondary">
        {provider.message}
      </Typography>
      {error ? (
        <Typography variant="body2" color="error">
          {error.message}
        </Typography>
      ) : null}
    </Box>
  );
};

export const AegisSignInPage = ({ providers, onSignInSuccess, auto }: AegisSignInPageProps) => {
  const classes = useStyles();
  const configApi = useApi(configApiRef);
  const isCompact = useMediaQuery('(max-width:900px)');

  const title = useMemo(
    () => configApi.getOptionalString('app.title') ?? 'Aegis',
    [configApi],
  );

  const primaryProvider = providers[0];

  return (
    <div className={classes.root}>
      <div className={classes.content}>
        <div className={classes.brand}>Aegis Identity</div>
        <Typography variant={isCompact ? 'h4' : 'h2'}>
          Welcome back to {title}
        </Typography>
        <Typography variant="body1" className={classes.providerHint}>
          Authenticate with your enterprise identity provider. Administrators can
          plug in any OIDC-compatible IdP to keep Aegis flexible across environments.
        </Typography>

        <Card className={classes.card} elevation={0}>
          <CardContent>
            <Typography variant="h5">Sign in</Typography>
            <Typography variant="body2" className={classes.helper}>
              Choose your identity provider to continue.
            </Typography>
            <Divider style={{ margin: '16px 0' }} />
            <div className={classes.providerStack}>
              {providers.map(provider => (
                <ProviderButton
                  key={provider.id}
                  provider={provider}
                  onSignInSuccess={onSignInSuccess}
                  auto={auto && provider.id === primaryProvider?.id}
                />
              ))}
            </div>
          </CardContent>
        </Card>
        <Typography variant="body2" className={classes.helper}>
          Need access? Contact your platform administrator to enable additional
          identity providers.
        </Typography>
      </div>

      <div className={classes.rightPanel}>
        <div className={classes.globe} />
        <div className={classes.orbit} />
        <div className={classes.orbitSecond} />
        <div className={`${classes.particle} ${classes.particleOne}`} />
        <div className={`${classes.particle} ${classes.particleTwo}`} />
        <div className={`${classes.particle} ${classes.particleThree}`} />
        <Typography variant="body2" className={classes.caption}>
          Secure access, orbiting at the speed of trust.
        </Typography>
      </div>
    </div>
  );
};
