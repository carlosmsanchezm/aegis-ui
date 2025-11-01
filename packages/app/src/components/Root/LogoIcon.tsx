import { makeStyles, useTheme } from '@material-ui/core';

const useStyles = makeStyles(theme => ({
  glyph: {
    width: theme.spacing(7),
    height: theme.spacing(7),
  },
}));

const LogoIcon = () => {
  const classes = useStyles();
  const theme = useTheme();
  const paletteMode = (theme.palette as any)?.mode ?? theme.palette.type;
  const isDark = paletteMode === 'dark';
  const stroke = isDark ? '#F4F4F3' : '#050505';
  const fill = isDark ? '#F4F4F3' : '#050505';

  return (
    <svg
      className={classes.glyph}
      viewBox="0 0 40 40"
      role="presentation"
      aria-hidden
      focusable="false"
    >
      <path
        d="M20 5.5l12.5 21.65H7.5L20 5.5z"
        fill="none"
        stroke={stroke}
        strokeWidth={2.4}
        strokeLinejoin="round"
      />
      <circle cx={20} cy={16.2} r={2.6} fill={fill} />
      <circle cx={11.2} cy={29.8} r={2.8} fill="none" stroke={stroke} strokeWidth={2.4} />
      <circle cx={28.8} cy={29.8} r={2.8} fill="none" stroke={stroke} strokeWidth={2.4} />
    </svg>
  );
};

export default LogoIcon;
