import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';

/**
 * Demo 3: Text Animation
 * 
 * Demonstrates typography and text effects:
 * - Title fade-in with scale
 * - Subtitle delayed entrance
 * - Gradient text effect
 * - Accent line animation
 */
export const Demo3TextAnimation = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Main title fade in and scale up
  const titleOpacity = interpolate(frame, [0, fps * 0.5], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateRight: 'clamp',
  });

  const titleScale = interpolate(frame, [0, fps * 0.5], [0.5, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateRight: 'clamp',
  });

  const titleTranslateY = interpolate(frame, [0, fps * 0.5], [-50, 0], {
    easing: Easing.out(Easing.cubic),
    extrapolateRight: 'clamp',
  });

  // Subtitle entrance (delayed)
  const subtitleOpacity = interpolate(frame, [fps * 0.5, fps], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateRight: 'clamp',
  });

  // Accent line animation
  const lineWidth = interpolate(frame, [fps * 0.7, fps], [0, 100], {
    easing: Easing.out(Easing.cubic),
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0f0f1e',
        padding: 40,
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Main title with gradient */}
      <h1
        style={{
          fontSize: 96,
          fontWeight: '900',
          color: '#fff',
          margin: 0,
          opacity: titleOpacity,
          scale: titleScale,
          translate: `0 ${titleTranslateY}px`,
          textAlign: 'center',
          backgroundImage: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          letterSpacing: -2,
        }}
      >
        Remotion
      </h1>

      {/* Subtitle */}
      <p
        style={{
          fontSize: 32,
          color: '#999',
          margin: '20px 0 0 0',
          opacity: subtitleOpacity,
          textAlign: 'center',
          fontWeight: 300,
        }}
      >
        Make videos programmatically
      </p>

      {/* Accent line */}
      <div
        style={{
          width: lineWidth,
          height: 4,
          backgroundColor: '#667eea',
          borderRadius: 2,
          marginTop: 30,
          opacity: subtitleOpacity,
          boxShadow: '0 0 20px rgba(102, 126, 234, 0.8)',
        }}
      />
    </div>
  );
};
