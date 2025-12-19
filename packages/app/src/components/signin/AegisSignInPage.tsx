import { useEffect, useState } from 'react';
import { Button } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import {
  BackstageIdentityResponse,
  SignInPageProps,
  useApi,
  useAnalytics,
} from '@backstage/core-plugin-api';
import { UserIdentity } from '@backstage/core-components';
import { keycloakAuthApiRef } from '../../apis';

const AegisLogo = () => (
  <div style={{ position: 'relative', width: 160, margin: '0 auto' }}>
    {/* Backlight glow */}
    <div
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 200,
        height: 200,
        background: 'radial-gradient(ellipse at center, rgba(139, 92, 246, 0.4) 0%, rgba(34, 211, 238, 0.2) 40%, transparent 70%)',
        filter: 'blur(30px)',
        pointerEvents: 'none',
      }}
    />
    {/* Logo SVG */}
    <svg
      viewBox="0 0 200 180"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: 160, height: 'auto', display: 'block', position: 'relative' }}
    >
      {/* ÆGIS Text */}
      <text
        x="100"
        y="35"
        textAnchor="middle"
        fill="#FFFFFF"
        fontSize="32"
        fontWeight="700"
        fontFamily="'Inter', sans-serif"
        letterSpacing="-1"
      >
        ÆGIS
      </text>

      {/* Triangle connecting lines - shortened to stop at circle edges */}
      <g stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round">
        {/* Top line: from edge of left circle to edge of right circle */}
        <line x1="64" y1="75" x2="136" y2="75" />
        {/* Right line: from edge of right circle to edge of bottom circle */}
        <line x1="143" y1="87" x2="107" y2="148" />
        {/* Left line: from edge of bottom circle to edge of left circle */}
        <line x1="93" y1="148" x2="57" y2="87" />
      </g>

      {/* Node circles - transparent with white stroke */}
      <g fill="none" stroke="#FFFFFF" strokeWidth="5">
        <circle cx="50" cy="75" r="14" />
        <circle cx="150" cy="75" r="14" />
        <circle cx="100" cy="160" r="14" />
      </g>

      {/* Center dot */}
      <circle cx="100" cy="103" r="8" fill="#FFFFFF" />
    </svg>
  </div>
);

const useStyles = makeStyles(theme => ({
  '@global': {
    '@keyframes pulse': {
      '0%, 100%': { opacity: 0.4, transform: 'scale(1)' },
      '50%': { opacity: 0.6, transform: 'scale(1.05)' },
    },
    '@keyframes spin': {
      '0%': { transform: 'rotate(0deg)' },
      '100%': { transform: 'rotate(360deg)' },
    },
  },
  root: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing(3),
    position: 'relative',
    overflow: 'hidden',
    background: '#0a0a0b',
  },
  meshBackground: {
    position: 'absolute',
    inset: 0,
    background: `
      radial-gradient(ellipse 80% 50% at 20% 40%, rgba(139, 92, 246, 0.15), transparent),
      radial-gradient(ellipse 60% 40% at 80% 60%, rgba(34, 211, 238, 0.12), transparent),
      radial-gradient(ellipse 50% 30% at 50% 20%, rgba(139, 92, 246, 0.08), transparent)
    `,
    animation: '$pulse 8s ease-in-out infinite',
  },
  gridPattern: {
    position: 'absolute',
    inset: 0,
    backgroundImage: `
      linear-gradient(rgba(139, 92, 246, 0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(139, 92, 246, 0.03) 1px, transparent 1px)
    `,
    backgroundSize: '60px 60px',
    maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 70%)',
  },
  cardWrapper: {
    position: 'relative',
    zIndex: 1,
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    padding: 2,
    background: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
    '&::before': {
      content: '""',
      position: 'absolute',
      top: '-50%',
      left: '-50%',
      width: '200%',
      height: '200%',
      background: 'conic-gradient(from 0deg, transparent 0deg 340deg, #8B5CF6 340deg 350deg, #22D3EE 350deg 360deg)',
      animation: '$spin 4s linear infinite',
    },
  },
  card: {
    position: 'relative',
    width: '100%',
    background: 'rgba(21, 21, 23, 0.95)',
    backdropFilter: 'blur(20px)',
    borderRadius: 22,
    padding: theme.spacing(5),
    boxShadow: '0 25px 80px rgba(0, 0, 0, 0.5)',
  },
  logoSection: {
    textAlign: 'center',
    marginBottom: theme.spacing(4),
  },
  signInButton: {
    width: '100%',
    padding: theme.spacing(1.75, 3),
    fontSize: '1rem',
    fontWeight: 600,
    borderRadius: 14,
    textTransform: 'none',
    background: 'linear-gradient(135deg, #8B5CF6, #22D3EE)',
    color: '#0B0B10',
    boxShadow: '0 4px 20px rgba(139, 92, 246, 0.3)',
    transition: 'all 0.2s ease',
    '&:hover': {
      background: 'linear-gradient(135deg, #A78BFA, #38E8FF)',
      boxShadow: '0 6px 30px rgba(139, 92, 246, 0.4)',
      transform: 'translateY(-1px)',
    },
  },
  error: {
    marginTop: theme.spacing(2),
    padding: theme.spacing(1.5, 2),
    borderRadius: 10,
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    color: '#FCA5A5',
    fontSize: '0.875rem',
    textAlign: 'center',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: '#0a0a0b',
    color: '#6B7280',
    fontSize: '0.9rem',
  },
}));

export const AegisSignInPage = ({ onSignInSuccess }: SignInPageProps) => {
  const classes = useStyles();
  const authApi = useApi(keycloakAuthApiRef);
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
        throw new Error('Authentication failed. Please try again.');
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
        if (!mounted) return;
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
        if (mounted) setError(err as Error);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    checkExisting();
    return () => { mounted = false; };
  }, [authApi, onSignInSuccess]);

  if (loading) {
    return <div className={classes.loading}>Initializing...</div>;
  }

  return (
    <div className={classes.root}>
      <div className={classes.meshBackground} />
      <div className={classes.gridPattern} />

      <div className={classes.cardWrapper}>
        <div className={classes.card}>
          <div className={classes.logoSection}>
            <AegisLogo />
          </div>

          <Button
            variant="contained"
            className={classes.signInButton}
            onClick={handleSignIn}
            disableElevation
          >
            Sign in with SSO
          </Button>

          {error && (
            <div className={classes.error}>
              {error.message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
