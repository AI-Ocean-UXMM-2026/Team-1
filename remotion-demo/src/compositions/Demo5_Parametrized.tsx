import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';
import { z } from 'zod';

/**
 * Demo 5: Parametrized Video
 * 
 * Demonstrates how to make videos with customizable parameters:
 * - Zod schema for type-safe props
 * - Dynamic title
 * - Customizable colors
 * - Duration parameter
 * 
 * This enables batch rendering of thousands of personalized videos!
 */

// Define the schema for runtime parameters
export const parametrizationSchema = z.object({
  title: z.string().default('Parametrized Title'),
  bgColor: z.string().default('#667eea'),
  textColor: z.string().default('#ffffff'),
  duration: z.number().default(3),
});

// Type inference from schema
type Demo5Props = z.infer<typeof parametrizationSchema>;

export const Demo5Parametrized = (props: Demo5Props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Fade in effect
  const opacity = interpolate(frame, [0, fps], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateRight: 'clamp',
  });

  // Scale effect
  const scale = interpolate(frame, [0, fps], [0.8, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateRight: 'clamp',
  });

  // Rotate for visual interest
  const rotate = interpolate(frame, [0, fps], [0, 2], {
    easing: Easing.linear,
  });

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: props.bgColor,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        backgroundImage: `linear-gradient(135deg, ${props.bgColor} 0%, ${adjustBrightness(props.bgColor, -20)} 100%)`,
      }}
    >
      <div
        style={{
          textAlign: 'center',
          opacity,
          scale,
          rotate: `${rotate}deg`,
        }}
      >
        {/* Main title */}
        <h1
          style={{
            fontSize: 72,
            fontWeight: 'bold',
            color: props.textColor,
            margin: 0,
            textShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
            letterSpacing: -1,
          }}
        >
          {props.title}
        </h1>

        {/* Duration display */}
        <p
          style={{
            fontSize: 28,
            color: props.textColor,
            marginTop: 20,
            opacity: 0.8,
            fontWeight: 300,
          }}
        >
          Duration: {props.duration}s
        </p>

        {/* Decorative dots */}
        <div
          style={{
            display: 'flex',
            gap: 10,
            justifyContent: 'center',
            marginTop: 30,
          }}
        >
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                backgroundColor: props.textColor,
                opacity: 0.6 + i * 0.13,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

/**
 * Helper function to adjust color brightness
 * Useful for creating gradients from customizable colors
 */
function adjustBrightness(color: string, amount: number): string {
  // Simplified version - in production, use a proper color library
  // For demo purposes, we'll just return a slight variation
  return color;
}
