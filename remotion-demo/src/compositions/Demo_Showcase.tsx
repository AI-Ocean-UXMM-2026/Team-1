import React from 'react';
import {
  AbsoluteFill,
  Sequence,
  useVideoConfig,
  useCurrentFrame,
  interpolate,
  Easing,
  spring,
} from 'remotion';

/**
 * Remotion Best Practices Showcase Demo
 * 
 * This 1-minute video demonstrates:
 * 1. Best practices in Remotion composition structure
 * 2. SaaS patterns with dynamic content
 * 3. Smooth animations and easing
 * 4. Proper frame timing and sequencing
 */

interface ShowcaseProps {
  title?: string;
  bgColor?: string;
}

const Slide = ({
  title,
  description,
  bgColor,
  durationInFrames,
}: {
  title: string;
  description: string;
  bgColor: string;
  durationInFrames: number;
}) => {
  const frame = useCurrentFrame();
  const fps = useVideoConfig().fps;
  
  // Fade in animation
  const fadeIn = interpolate(frame, [0, fps * 0.5], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Scale animation
  const scale = spring({
    frame,
    fps,
    config: { damping: 10, mass: 1, overshootClamping: false },
    from: 0.8,
    to: 1,
  });

  // Fade out animation (last second)
  const fadeOut = interpolate(
    frame,
    [durationInFrames - fps * 1, durationInFrames],
    [1, 0],
    {
      easing: Easing.in(Easing.cubic),
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );

  const opacity = fadeIn * fadeOut;

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%',
          opacity,
          transform: `scale(${scale})`,
        }}
      >
        <h1
          style={{
            fontSize: 72,
            fontWeight: 'bold',
            color: '#ffffff',
            margin: 0,
            textAlign: 'center',
            textShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
          }}
        >
          {title}
        </h1>
        <p
          style={{
            fontSize: 28,
            color: 'rgba(255, 255, 255, 0.8)',
            margin: '20px 0 0 0',
            textAlign: 'center',
            maxWidth: '800px',
            textShadow: '0 2px 10px rgba(0, 0, 0, 0.3)',
          }}
        >
          {description}
        </p>
      </div>
    </AbsoluteFill>
  );
};

const AnimatedCounter = ({ value, durationInFrames }: { value: number; durationInFrames: number }) => {
  const frame = useCurrentFrame();
  const fps = useVideoConfig().fps;

  // Count from 0 to value
  const count = interpolate(frame, [0, durationInFrames], [0, value], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Fade in/out
  const fadeIn = interpolate(frame, [0, fps * 0.3], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const fadeOut = interpolate(
    frame,
    [durationInFrames - fps * 0.5, durationInFrames],
    [1, 0],
    {
      easing: Easing.in(Easing.cubic),
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );

  return (
    <AbsoluteFill style={{ backgroundColor: '#1a202c' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%',
          opacity: fadeIn * fadeOut,
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: 120,
              fontWeight: 'bold',
              color: '#667eea',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {Math.floor(count).toLocaleString()}
          </div>
          <div style={{ fontSize: 32, color: '#cbd5e0', marginTop: '20px' }}>
            Renders/Day
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const DemoShowcase: React.FC<ShowcaseProps> = ({
  title = 'Remotion Best Practices',
  bgColor = '#667eea',
}) => {
  const fps = 30;
  const durationPerSlide = fps * 12; // 12 seconds per slide in 30 fps

  return (
    <>
      {/* Slide 1: Title (0-12s) */}
      <Sequence durationInFrames={durationPerSlide}>
        <Slide
          title={title}
          description="Create stunning videos programmatically with React"
          bgColor={bgColor}
          durationInFrames={durationPerSlide}
        />
      </Sequence>

      {/* Slide 2: Best Practices (12-24s) */}
      <Sequence from={durationPerSlide} durationInFrames={durationPerSlide}>
        <Slide
          title="✓ Best Practices"
          description="Component-based • Typed Props • Composable Sequences • Smooth Easing"
          bgColor="#48bb78"
          durationInFrames={durationPerSlide}
        />
      </Sequence>

      {/* Slide 3: Counter Animation (24-36s) */}
      <Sequence from={durationPerSlide * 2} durationInFrames={durationPerSlide}>
        <AnimatedCounter value={1000} durationInFrames={durationPerSlide} />
      </Sequence>

      {/* Slide 4: SaaS Pattern (36-48s) */}
      <Sequence from={durationPerSlide * 3} durationInFrames={durationPerSlide}>
        <Slide
          title="SaaS Pattern"
          description="Player Component • Lambda Rendering • Dynamic Props • Scalable"
          bgColor="#ed8936"
          durationInFrames={durationPerSlide}
        />
      </Sequence>

      {/* Slide 5: Final Call to Action (48-60s) */}
      <Sequence from={durationPerSlide * 4} durationInFrames={durationPerSlide}>
        <Slide
          title="Build with Remotion"
          description="Create, Share, Scale"
          bgColor="#9f7aea"
          durationInFrames={durationPerSlide}
        />
      </Sequence>
    </>
  );
};
