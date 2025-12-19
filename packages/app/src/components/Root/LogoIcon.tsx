import { makeStyles, useTheme } from '@material-ui/core';

const useStyles = makeStyles({
  glyph: {
    width: 36,
    height: 36,
  },
});

const LogoIcon = () => {
  const classes = useStyles();
  const theme = useTheme();
  const paletteMode = (theme.palette as any)?.mode ?? theme.palette.type;
  const isDark = paletteMode === 'dark';
  const stroke = isDark ? '#FFFFFF' : '#1a1a1a';
  const fill = isDark ? '#FFFFFF' : '#1a1a1a';

  return (
    <svg
      className={classes.glyph}
      viewBox="0 0 40 40"
      role="presentation"
      aria-hidden
      focusable="false"
    >
      {/* Triangle connecting lines - stop at circle edges */}
      <g stroke={stroke} strokeWidth={2.2} strokeLinecap="round">
        {/* Top line */}
        <line x1="9" y1="10" x2="31" y2="10" />
        {/* Right to bottom */}
        <line x1="33" y1="13" x2="22" y2="32" />
        {/* Bottom to left */}
        <line x1="18" y1="32" x2="7" y2="13" />
      </g>

      {/* Node circles */}
      <g fill="none" stroke={stroke} strokeWidth={2.2}>
        <circle cx="6" cy="10" r="4" />
        <circle cx="34" cy="10" r="4" />
        <circle cx="20" cy="35" r="4" />
      </g>

      {/* Center dot */}
      <circle cx="20" cy="18" r="3" fill={fill} />
    </svg>
  );
};

export default LogoIcon;
