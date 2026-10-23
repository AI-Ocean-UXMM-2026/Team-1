# Remotion Demo Video Flows

This document showcases 5 complete, production-ready demo flows demonstrating Remotion's core capabilities.

---

## Installation Setup (After npm cache fix)

```bash
# Method 1: Create new project
npx create-video@latest --yes --blank --no-tailwind my-video
cd my-video
npm install

# Method 2: Install in existing project
npm install remotion @remotion/cli
```

---

## Demo 1: Basic Animation Flow (FadeIn & Bounce)

**File**: `src/compositions/Demo1_BasicAnimation.tsx`

This demo showcases fundamental animation concepts: fade-in effect and bouncing motion.

```tsx
import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, Easing, Composition } from "remotion";

// Main composition component
export const Demo1_BasicAnimation = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  // Fade in effect (0 to 100% opacity in first 1 second)
  const opacity = interpolate(frame, [0, fps], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  
  // Bounce animation (scale up and down)
  const bounceScale = interpolate(frame, [0, fps/2, fps], [1, 1.2, 1], {
    easing: Easing.bezier(0.68, -0.55, 0.265, 1.55),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div style={{
      flex: 1,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#1a1a2e",
    }}>
      <div style={{
        width: 200,
        height: 200,
        backgroundColor: "#0f3460",
        borderRadius: 20,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity,
        scale: bounceScale,
        fontSize: 32,
        fontWeight: "bold",
        color: "#fff",
      }}>
        Remotion ✨
      </div>
    </div>
  );
};

// Register in Root.tsx:
// <Composition
//   id="Demo1_BasicAnimation"
//   component={Demo1_BasicAnimation}
//   durationInFrames={150}
//   fps={30}
//   width={1280}
//   height={720}
// />
```

---

## Demo 2: Multi-Scene Video (Sequencing)

**File**: `src/compositions/Demo2_MultiScene.tsx`

This demo shows how to compose multiple scenes with sequential timing using `<Sequence>`.

```tsx
import React from "react";
import { Composition, Sequence, useCurrentFrame, useVideoConfig, interpolate, Easing } from "remotion";

const Scene1 = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const translateX = interpolate(frame, [0, fps], [- 400, 400], {
    easing: Easing.inOut(Easing.quad),
  });

  return (
    <div style={{
      flex: 1,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#667eea",
    }}>
      <div style={{
        width: 150,
        height: 150,
        backgroundColor: "#fff",
        borderRadius: "50%",
        translate: `${translateX}px 0`,
      }} />
    </div>
  );
};

const Scene2 = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const rotate = interpolate(frame, [0, fps], [0, 360], {
    easing: Easing.linear,
  });

  return (
    <div style={{
      flex: 1,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#764ba2",
    }}>
      <div style={{
        width: 150,
        height: 150,
        backgroundColor: "#fff",
        rotate: `${rotate}deg`,
      }} />
    </div>
  );
};

const Scene3 = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const scale = interpolate(frame, [0, fps/2, fps], [0, 1.3, 1], {
    easing: Easing.out(Easing.elastic(1.2)),
  });

  return (
    <div style={{
      flex: 1,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#f093fb",
    }}>
      <div style={{
        width: 150,
        height: 150,
        backgroundColor: "#fff",
        scale,
        borderRadius: 20,
      }} />
    </div>
  );
};

export const Demo2_MultiScene = () => {
  const { fps } = useVideoConfig();
  
  return (
    <>
      <Sequence from={0} durationInFrames={fps}>
        <Scene1 />
      </Sequence>
      <Sequence from={fps} durationInFrames={fps}>
        <Scene2 />
      </Sequence>
      <Sequence from={fps * 2} durationInFrames={fps}>
        <Scene3 />
      </Sequence>
    </>
  );
};

// Register in Root.tsx:
// <Composition
//   id="Demo2_MultiScene"
//   component={Demo2_MultiScene}
//   durationInFrames={270}
//   fps={30}
//   width={1280}
//   height={720}
// />
```

---

## Demo 3: Text Animation & Typography

**File**: `src/compositions/Demo3_TextAnimation.tsx`

Demonstrates animated text, typography, and letter-by-letter effects.

```tsx
import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, Easing } from "remotion";

export const Demo3_TextAnimation = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  // Fade in text
  const textOpacity = interpolate(frame, [0, fps * 0.5], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateRight: "clamp",
  });
  
  // Scale effect
  const textScale = interpolate(frame, [0, fps * 0.5], [0.5, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateRight: "clamp",
  });
  
  // Y position (slide down)
  const translateY = interpolate(frame, [0, fps * 0.5], [-50, 0], {
    easing: Easing.out(Easing.cubic),
    extrapolateRight: "clamp",
  });
  
  // Subtitle delay
  const subtitleOpacity = interpolate(frame, [fps * 0.5, fps], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateRight: "clamp",
  });

  return (
    <div style={{
      flex: 1,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#0f0f1e",
      padding: 40,
    }}>
      {/* Main title */}
      <h1 style={{
        fontSize: 96,
        fontWeight: "900",
        color: "#fff",
        margin: 0,
        opacity: textOpacity,
        scale: textScale,
        translate: `0 ${translateY}px`,
        textAlign: "center",
        backgroundImage: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        backgroundClip: "text",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
      }}>
        Remotion
      </h1>
      
      {/* Subtitle */}
      <p style={{
        fontSize: 32,
        color: "#999",
        margin: "20px 0 0 0",
        opacity: subtitleOpacity,
        textAlign: "center",
      }}>
        Make videos programmatically with React
      </p>
      
      {/* Accent line */}
      <div style={{
        width: 100,
        height: 4,
        backgroundColor: "#667eea",
        borderRadius: 2,
        marginTop: 30,
        opacity: subtitleOpacity,
      }} />
    </div>
  );
};

// Register in Root.tsx:
// <Composition
//   id="Demo3_TextAnimation"
//   component={Demo3_TextAnimation}
//   durationInFrames={150}
//   fps={30}
//   width={1280}
//   height={720}
// />
```

---

## Demo 4: Grid Animation (Data Visualization)

**File**: `src/compositions/Demo4_GridAnimation.tsx`

Shows a data visualization pattern with animated grid items - useful for dashboards and infographics.

```tsx
import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, Easing } from "remotion";

const GridItem = ({ index, totalItems }: { index: number; totalItems: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  // Staggered delay for each item
  const delay = (index / totalItems) * fps * 0.3;
  const itemFrame = Math.max(0, frame - delay);
  
  const scale = interpolate(itemFrame, [0, fps * 0.3], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateRight: "clamp",
  });
  
  const opacity = interpolate(itemFrame, [0, fps * 0.3], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateRight: "clamp",
  });
  
  const rotationY = interpolate(itemFrame, [0, fps * 0.3], [90, 0], {
    easing: Easing.out(Easing.cubic),
    extrapolateRight: "clamp",
  });

  return (
    <div style={{
      width: 120,
      height: 120,
      backgroundColor: `hsl(${(index * 45) % 360}, 70%, 50%)`,
      borderRadius: 12,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 48,
      fontWeight: "bold",
      color: "#fff",
      opacity,
      scale,
      perspective: "1000px",
      transform: `rotateY(${rotationY}deg)`,
    }}>
      {index + 1}
    </div>
  );
};

export const Demo4_GridAnimation = () => {
  const items = Array.from({ length: 9 }, (_, i) => i);

  return (
    <div style={{
      flex: 1,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#1a1a2e",
      padding: 40,
    }}>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 20,
        width: "100%",
        maxWidth: 500,
      }}>
        {items.map((index) => (
          <GridItem key={index} index={index} totalItems={items.length} />
        ))}
      </div>
    </div>
  );
};

// Register in Root.tsx:
// <Composition
//   id="Demo4_GridAnimation"
//   component={Demo4_GridAnimation}
//   durationInFrames={180}
//   fps={30}
//   width={1280}
//   height={720}
// />
```

---

## Demo 5: Parametrized Video (Dynamic Content)

**File**: `src/compositions/Demo5_Parametrized.tsx`

Shows how to make videos with customizable parameters using Zod schemas.

```tsx
import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, Easing, Composition } from "remotion";
import { z } from "zod";

// Define the schema for parameters
export const parametrizationSchema = z.object({
  title: z.string().default("Parametrized Title"),
  bgColor: z.string().default("#667eea"),
  textColor: z.string().default("#fff"),
  duration: z.number().default(3),
});

type ParametrizationProps = z.infer<typeof parametrizationSchema>;

export const Demo5_Parametrized = (props: ParametrizationProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const opacity = interpolate(frame, [0, fps], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateRight: "clamp",
  });
  
  const scale = interpolate(frame, [0, fps], [0.8, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateRight: "clamp",
  });

  return (
    <div style={{
      flex: 1,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: props.bgColor,
    }}>
      <div style={{
        textAlign: "center",
        opacity,
        scale,
      }}>
        <h1 style={{
          fontSize: 72,
          fontWeight: "bold",
          color: props.textColor,
          margin: 0,
          textShadow: "0 4px 20px rgba(0, 0, 0, 0.3)",
        }}>
          {props.title}
        </h1>
        <p style={{
          fontSize: 24,
          color: props.textColor,
          marginTop: 20,
          opacity: 0.8,
        }}>
          Duration: {props.duration} seconds
        </p>
      </div>
    </div>
  );
};

// Register in Root.tsx:
// <Composition
//   id="Demo5_Parametrized"
//   component={Demo5_Parametrized}
//   durationInFrames={(props) => props.duration * 30}
//   fps={30}
//   width={1280}
//   height={720}
//   schema={parametrizationSchema}
//   defaultProps={{
//     title: "Remotion Demo",
//     bgColor: "#667eea",
//     textColor: "#fff",
//     duration: 3,
//   }}
// />
```

---

## Root Component Setup

**File**: `src/Root.tsx`

Register all compositions here:

```tsx
import React from "react";
import { Composition } from "remotion";
import { Demo1_BasicAnimation } from "./compositions/Demo1_BasicAnimation";
import { Demo2_MultiScene } from "./compositions/Demo2_MultiScene";
import { Demo3_TextAnimation } from "./compositions/Demo3_TextAnimation";
import { Demo4_GridAnimation } from "./compositions/Demo4_GridAnimation";
import { Demo5_Parametrized, parametrizationSchema } from "./compositions/Demo5_Parametrized";

export const Root = () => {
  return (
    <>
      {/* Demo 1: Basic Animation */}
      <Composition
        id="Demo1_BasicAnimation"
        component={Demo1_BasicAnimation}
        durationInFrames={150}
        fps={30}
        width={1280}
        height={720}
      />

      {/* Demo 2: Multi-Scene */}
      <Composition
        id="Demo2_MultiScene"
        component={Demo2_MultiScene}
        durationInFrames={270}
        fps={30}
        width={1280}
        height={720}
      />

      {/* Demo 3: Text Animation */}
      <Composition
        id="Demo3_TextAnimation"
        component={Demo3_TextAnimation}
        durationInFrames={150}
        fps={30}
        width={1280}
        height={720}
      />

      {/* Demo 4: Grid Animation */}
      <Composition
        id="Demo4_GridAnimation"
        component={Demo4_GridAnimation}
        durationInFrames={180}
        fps={30}
        width={1280}
        height={720}
      />

      {/* Demo 5: Parametrized */}
      <Composition
        id="Demo5_Parametrized"
        component={Demo5_Parametrized}
        durationInFrames={90}
        fps={30}
        width={1280}
        height={720}
        schema={parametrizationSchema}
        defaultProps={{
          title: "Remotion Demo",
          bgColor: "#667eea",
          textColor: "#fff",
          duration: 3,
        }}
      />
    </>
  );
};
```

---

## Running the Demo

```bash
# Start Remotion Studio (interactive preview)
npm run dev
# or
npx remotion studio

# The Studio opens at http://localhost:3000
# Select a composition to preview
# Edit code and see changes live in the preview!
```

## Rendering Videos

```bash
# Render a specific composition
npx remotion render Demo1_BasicAnimation

# Render all compositions
npx remotion render

# Render to WebM format
npx remotion render Demo1_BasicAnimation --codec=vp9

# Render with custom quality
npx remotion render Demo1_BasicAnimation --quality=100
```

---

## Key Takeaways

| Demo | Key Concept | Use Case |
|------|----------|----------|
| **Demo 1** | Basic interpolation, easing functions | Simple animations, UI transitions |
| **Demo 2** | Sequencing, multi-scene composition | Story-driven videos, tutorials |
| **Demo 3** | Typography, text animation, gradients | Title sequences, intros |
| **Demo 4** | Grid layout, staggered animations | Data visualization, infographics |
| **Demo 5** | Parametrization, Zod schemas | Batch rendering, dynamic content |

---

## Next Steps

1. **Audio Integration**: Add `<Audio>` component for music synchronization
2. **Video Clips**: Use `<Video>` from `@remotion/media` for video editing
3. **Effects**: Apply effects from `@remotion/effects` (blur, vignette, etc.)
4. **3D Content**: Integrate Three.js for 3D animations
5. **Captions**: Add automated captions with transcript synchronization
6. **Advanced Effects**: Custom motion blur, light trails, distortion effects
7. **Server Rendering**: Deploy to Lambda for batch rendering
8. **Studio Interactivity**: Make components interactive in Studio

---

## Resources

- **Official Docs**: https://www.remotion.dev/docs
- **API Reference**: https://www.remotion.dev/docs/api
- **Templates**: https://www.remotion.dev/templates
- **Discord**: https://remotion.dev/discord
