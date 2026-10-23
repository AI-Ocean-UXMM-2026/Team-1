import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';

/**
 * Demo 4: Grid Animation
 * 
 * Demonstrates data visualization patterns:
 * - Staggered item animations
 * - 3D rotation effects
 * - Grid layout with CSS
 * - Dynamic color generation
 */

interface GridItemProps {
  index: number;
  totalItems: number;
}

const GridItem: React.FC<GridItemProps> = ({ index, totalItems }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Staggered delay for each item
  const delay = (index / totalItems) * fps * 0.3;
  const itemFrame = Math.max(0, frame - delay);

  // Scale effect
  const scale = interpolate(itemFrame, [0, fps * 0.3], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateRight: 'clamp',
  });

  // Opacity
  const opacity = interpolate(itemFrame, [0, fps * 0.3], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateRight: 'clamp',
  });

  // 3D rotation effect
  const rotationY = interpolate(itemFrame, [0, fps * 0.3], [90, 0], {
    easing: Easing.out(Easing.cubic),
    extrapolateRight: 'clamp',
  });

  // Generate distinct colors for each item
  const hue = (index * 45) % 360;

  return (
    <div
      style={{
        width: 120,
        height: 120,
        backgroundColor: `hsl(${hue}, 70%, 50%)`,
        borderRadius: 12,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 48,
        fontWeight: 'bold',
        color: '#fff',
        opacity,
        scale,
        perspective: '1000px',
        transform: `rotateY(${rotationY}deg)`,
        boxShadow: `0 10px 30px hsla(${hue}, 70%, 40%, 0.4)`,
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {index + 1}
    </div>
  );
};

export const Demo4GridAnimation = () => {
  const items = Array.from({ length: 9 }, (_, i) => i);

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#1a1a2e',
        padding: 40,
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 20,
          width: '100%',
          maxWidth: 500,
        }}
      >
        {items.map((index) => (
          <GridItem key={index} index={index} totalItems={items.length} />
        ))}
      </div>
    </div>
  );
};
