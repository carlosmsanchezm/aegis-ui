import { makeStyles, Typography } from '@material-ui/core';
import { useTheme } from '@material-ui/core/styles';
import { useSidebarOpenState } from '@backstage/core-components';

const useStyles = makeStyles(theme => ({
  root: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.75),
    padding: theme.spacing(0.5, 0),
    minHeight: theme.spacing(8),
  },
  image: {
    height: theme.spacing(6.5),
    width: 'auto',
    maxWidth: '100%',
    flexShrink: 0,
    display: 'block',
    objectFit: 'contain',
  },
  wordmark: {
    fontWeight: 700,
    fontSize: '1.8rem',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: theme.palette.text.primary,
    whiteSpace: 'nowrap',
    lineHeight: 1,
  },
}));

const LogoFull = () => {
  const classes = useStyles();
  const theme = useTheme();
  const paletteMode = (theme.palette as any)?.mode ?? theme.palette.type;
  const isDark = paletteMode === 'dark';
  const { isOpen } = useSidebarOpenState();
  const logoSrc = isDark
    ? '/branding/aegis-logo-full-dark.svg'
    : '/branding/aegis-logo-full.svg';
  const wordmarkColor = isDark
    ? theme.palette.primary.light
    : theme.palette.primary.main;

  return (
    <span className={classes.root} aria-label="ÆGIS logo">
      <img
        src={logoSrc}
        alt="ÆGIS emblem"
        className={classes.image}
      />
      {isOpen ? (
        <Typography
          component="span"
          className={classes.wordmark}
          style={{ color: wordmarkColor }}
        >
          ÆGIS
        </Typography>
      ) : null}
    </span>
  );
};

export default LogoFull;
