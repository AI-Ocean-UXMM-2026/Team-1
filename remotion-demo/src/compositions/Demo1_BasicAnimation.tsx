import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';

/**
 * Demo 1: Basic Animation
 * 
 * Demonstrates fundamental animation concepts:
 * - Fade-in effect with easing
 * - Bounce animation with custom easing
 * - Frame-based interpolation
 */
export const Demo1BasicAnimation = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Fade in effect: opacity goes from 0 to 1 in the first second
  const opacity = interpolate(frame, [0, fps], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Bounce animation: scale bounces up and back down
  const bounceScale = interpolate(frame, [0, fps / 2, fps], [1, 1.2, 1], {
    easing: Easing.bezier(0.68, -0.55, 0.265, 1.55), // Elastic easing
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#1a1a2e',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div
        style={{
          width: 200,
          height: 200,
          backgroundColor: '#0f3460',
          borderRadius: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity,
          scale: bounceScale,
          fontSize: 48,
          fontWeight: 'bold',
          color: '#fff',
          boxShadow: '0 20px 60px rgba(102, 126, 234, 0.4)',
        }}
      >
        ✨
      </div>
    </div>
  );
};
