import { useEffect, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { makeStyles, useTheme } from '@material-ui/core/styles';

const useStyles = makeStyles({
  root: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: -1,
    overflow: 'hidden',
    pointerEvents: 'none',
    background: 'transparent', // Background color handled by global theme
    transition: 'background-color 500ms ease',
  },
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  blob: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '120vmax',
    height: '120vmax',
    transform: 'translate(-50%, -50%)',
    borderRadius: '50%',
    willChange: 'transform',
    mixBlendMode: 'screen', // or normal depending on theme
  },
  texture: {
    position: 'absolute',
    inset: 0,
    opacity: 0.4,
    backgroundSize: '120px 120px',
    backgroundImage:
      'radial-gradient(circle at center, rgba(148,163,184,0.12) 1px, transparent 0)',
  },
  overlayLight: {
    position: 'absolute',
    inset: 0,
    background:
      'linear-gradient(120deg, rgba(255,255,255,0.08) 0%, transparent 55%, rgba(255,255,255,0.08) 100%)',
    mixBlendMode: 'soft-light',
  },
  overlayRadial: {
    position: 'absolute',
    inset: 0,
    background:
      'radial-gradient(circle at top, rgba(255,255,255,0.18), transparent 55%)',
    mixBlendMode: 'soft-light',
  },
});

export const InteractiveBackground = () => {
  const classes = useStyles();
  const theme = useTheme();
  const isDark = theme.palette.type === 'dark';
  
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });

  // Mouse position (0-100 percentage based)
  const mouseX = useMotionValue(50);
  const mouseY = useMotionValue(50);

  const springConfig = { damping: 40, stiffness: 120, mass: 0.8 };
  const xSpring = useSpring(mouseX, springConfig);
  const ySpring = useSpring(mouseY, springConfig);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
      
      const handleResize = () => {
        setWindowSize({ width: window.innerWidth, height: window.innerHeight });
      };
      
      const handlePointerMove = (event: PointerEvent) => {
        const { innerWidth, innerHeight } = window;
        const newX = (event.clientX / innerWidth) * 100;
        const newY = (event.clientY / innerHeight) * 100;
        mouseX.set(newX);
        mouseY.set(newY);
      };

      window.addEventListener('resize', handleResize);
      window.addEventListener('pointermove', handlePointerMove);
      
      return () => {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('pointermove', handlePointerMove);
      };
    }
    return () => {};
  }, [mouseX, mouseY]);

  // Map percentage (0-100) to pixel offsets for the divs
  const xPos = useTransform(xSpring, (v) => (v / 100) * windowSize.width);
  const yPos = useTransform(ySpring, (v) => (v / 100) * windowSize.height);

  // Blob colors based on theme
  const blob1Color = isDark
    ? 'radial-gradient(closest-side, rgba(99,102,241,0.65), transparent)'
    : 'radial-gradient(closest-side, rgba(99,102,241,0.15), transparent)';
  
  const blob2Color = isDark
    ? 'radial-gradient(closest-side, rgba(14,165,233,0.45), transparent)'
    : 'radial-gradient(closest-side, rgba(14,165,233,0.15), transparent)';
    
  const blob3Color = isDark
    ? 'radial-gradient(closest-side, rgba(249,115,22,0.35), transparent)'
    : 'radial-gradient(closest-side, rgba(249,115,22,0.12), transparent)';

  return (
    <div className={classes.root}>
      
      {/* Bottom Linear Fade - MOVED TO BOTTOM (rendered first) so blobs are ON TOP */}
      <div 
        className={classes.layer}
        style={{
            background: isDark
                ? 'linear-gradient(180deg, rgba(2,6,23,0.98) 0%, rgba(2,6,23,0.9) 55%, rgba(2,6,23,1) 100%)'
                : 'linear-gradient(180deg, rgba(248,250,252,0.8) 0%, rgba(248,250,252,0.9) 55%, rgba(248,250,252,1) 100%)'
        }}
      />

      {/* Static Gradients - Also moved below blobs */}
      <div 
        className={classes.layer}
        style={{
            background: isDark 
                ? 'radial-gradient(circle at 25% 15%, rgba(14,116,144,0.4), transparent 60%)' 
                : 'radial-gradient(circle at 25% 15%, rgba(14,116,144,0.1), transparent 60%)'
        }} 
      />
      <div 
        className={classes.layer}
        style={{
            background: isDark 
                ? 'radial-gradient(circle at 80% 0%, rgba(15,23,42,0.35), transparent 65%)'
                : 'radial-gradient(circle at 80% 0%, rgba(15,23,42,0.05), transparent 65%)'
        }} 
      />

      {/* 1. Main Moving Gradient (Purple/Indigo) */}
      <motion.div
        className={classes.blob}
        style={{
          x: xPos,
          y: yPos,
          background: blob1Color,
        }}
      />

      {/* 2. Secondary Moving Gradient (Sky Blue) */}
      <motion.div
        className={classes.blob}
        style={{
          x: useTransform(xPos, (v) => v + windowSize.width * 0.18),
          y: useTransform(yPos, (v) => v + windowSize.height * 0.20),
          background: blob2Color,
        }}
      />

      {/* 3. Tertiary Moving Gradient (Orange) */}
      <motion.div
        className={classes.blob}
        style={{
          x: useTransform(xPos, (v) => v - windowSize.width * 0.20),
          y: useTransform(yPos, (v) => v - windowSize.height * 0.25),
          background: blob3Color,
        }}
      />

      {/* Texture Overlays */}
      <div className={classes.texture} />
      <div className={classes.overlayLight} />
      <div className={classes.overlayRadial} />

      {/* Floating Orbs */}
      <motion.div
        style={{
          position: 'absolute',
          top: -96,
          left: '33%',
          width: 288,
          height: 288,
          borderRadius: '50%',
          backgroundColor: isDark ? 'rgba(99,102,241,0.3)' : 'rgba(99,102,241,0.1)',
          filter: 'blur(120px)',
        }}
        animate={{ y: [0, -20, 0], scale: [1, 1.05, 1] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        style={{
          position: 'absolute',
          bottom: -64,
          right: 40,
          width: 320,
          height: 320,
          borderRadius: '50%',
          backgroundColor: isDark ? 'rgba(14,165,233,0.3)' : 'rgba(14,165,233,0.1)',
          filter: 'blur(150px)',
        }}
        animate={{ y: [0, 30, 0], scale: [1, 0.95, 1] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        style={{
          position: 'absolute',
          bottom: '25%',
          left: '-5%',
          width: 240,
          height: 240,
          borderRadius: '50%',
          backgroundColor: isDark ? 'rgba(249,115,22,0.25)' : 'rgba(249,115,22,0.1)',
          filter: 'blur(150px)',
        }}
        animate={{ y: [0, -25, 0], scale: [1, 1.08, 1] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
};
