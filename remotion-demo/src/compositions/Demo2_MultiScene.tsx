import React from 'react';
import { Sequence, useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';

/**
 * Demo 2: Multi-Scene Video
 * 
 * Shows how to compose multiple scenes with sequential timing:
 * - Scene 1: Sliding circle (linear motion)
 * - Scene 2: Rotating square (constant rotation)
 * - Scene 3: Elastic scaling rectangle (bouncy entrance)
 */

const Scene1 = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Slide from left to right
  const translateX = interpolate(frame, [0, fps], [-400, 400], {
    easing: Easing.inOut(Easing.quad),
  });

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#667eea',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div
        style={{
          width: 150,
          height: 150,
          backgroundColor: '#fff',
          borderRadius: '50%',
          translate: `${translateX}px 0`,
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
        }}
      />
    </div>
  );
};

const Scene2 = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Rotate 360 degrees
  const rotate = interpolate(frame, [0, fps], [0, 360], {
    easing: Easing.linear,
  });

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#764ba2',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div
        style={{
          width: 150,
          height: 150,
          backgroundColor: '#fff',
          rotate: `${rotate}deg`,
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
        }}
      />
    </div>
  );
};

const Scene3 = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Elastic scale effect (bounce in and settle)
  const scale = interpolate(frame, [0, fps / 2, fps], [0, 1.3, 1], {
    easing: Easing.out(Easing.elastic(1.2)),
  });

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f093fb',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div
        style={{
          width: 150,
          height: 150,
          backgroundColor: '#fff',
          scale,
          borderRadius: 20,
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
        }}
      />
    </div>
  );
};

export const Demo2MultiScene = () => {
  const { fps } = useVideoConfig();

  return (
    <>
      {/* Scene 1: Sliding circle (frames 0-30) */}
      <Sequence from={0} durationInFrames={fps}>
        <Scene1 />
      </Sequence>

      {/* Scene 2: Rotating square (frames 30-60) */}
      <Sequence from={fps} durationInFrames={fps}>
        <Scene2 />
      </Sequence>

      {/* Scene 3: Elastic rectangle (frames 60-90) */}
      <Sequence from={fps * 2} durationInFrames={fps}>
        <Scene3 />
      </Sequence>
    </>
  );
};
