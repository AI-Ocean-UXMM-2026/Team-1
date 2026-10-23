# Remotion Quick Reference Guide

## Installation & Setup

```bash
# Create new project
npx create-video@latest --yes --blank --no-tailwind my-video
cd my-video
npm install

# OR manual setup
npm install remotion @remotion/cli

# Install extensions
npx remotion add @remotion/media
npx remotion add @remotion/effects
npx remotion add @remotion/shapes
```

---

## Common Commands

### Development
```bash
npm run dev                           # Start Studio
npx remotion studio                  # Start Studio with custom port
npx remotion studio --port 3001      # Change port
npx remotion studio --no-open        # Start without auto-opening browser
```

### Rendering
```bash
npx remotion render                  # Render all compositions
npx remotion render Demo1            # Render specific composition
npx remotion render Demo1 --quality=90 # Quality 1-100
npx remotion render --concurrency=4  # Use 4 cores
npx remotion render --codec=vp9      # VP9 codec (WebM)
npx remotion render --codec=h264     # H.264 (MP4)
npx remotion render --sequence       # PNG sequence output
```

---

## Core Imports

```tsx
// Basic
import { Composition, Sequence, AbsoluteFill, Img } from "remotion";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { interpolate, Easing } from "remotion";
import { staticFile } from "remotion";

// Media
import { Video, Audio, CanvasImage, AnimatedImage } from "@remotion/media";

// Effects
import {
  blur, vignette, grayscale, brightness,
  colorCorrection, hue, saturation,
  dropShadow, glow, // ... more effects
} from "@remotion/effects";

// Shapes
import { Circle, Rect, Triangle, Star, Arrow } from "@remotion/shapes";

// Captions
import { Caption, CaptionTrack } from "@remotion/captions";

// Parameters
import { z } from "zod";
```

---

## Animation Patterns

### Basic Interpolation
```tsx
const frame = useCurrentFrame();
const value = interpolate(frame, [0, 100], [0, 1]);
// Maps frame 0-100 to value 0-1
```

### With Easing
```tsx
const value = interpolate(frame, [0, 100], [0, 1], {
  easing: Easing.out(Easing.cubic)
});
```

### Clamped (no extrapolation)
```tsx
const value = interpolate(frame, [0, 100], [0, 1], {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp"
});
```

### Bezier Easing
```tsx
const value = interpolate(frame, [0, 100], [0, 1], {
  easing: Easing.bezier(0.25, 0.1, 0.25, 1.0)
});
```

### Spring Animation
```tsx
const value = interpolate(frame, [0, 100], [0, 1], {
  easing: Easing.spring({ damping: 10, mass: 1, stiffness: 100 })
});
```

### Elastic Animation
```tsx
const value = interpolate(frame, [0, 100], [0, 1], {
  easing: Easing.elastic(1.5) // bounciness
});
```

---

## Component Structure

### Basic Composition
```tsx
export const MyVideo = () => {
  return (
    <div style={{ flex: 1, backgroundColor: "#000" }}>
      {/* Content */}
    </div>
  );
};

// Register in Root.tsx
<Composition
  id="MyVideo"
  component={MyVideo}
  durationInFrames={150}
  fps={30}
  width={1280}
  height={720}
/>
```

### With Sequencing
```tsx
export const MyVideo = () => {
  const { fps } = useVideoConfig();
  
  return (
    <>
      <Sequence from={0} durationInFrames={fps}>
        <Scene1 />
      </Sequence>
      <Sequence from={fps} durationInFrames={fps}>
        <Scene2 />
      </Sequence>
    </>
  );
};
```

### With Parameters
```tsx
import { z } from "zod";

export const schema = z.object({
  title: z.string().default("Hello"),
  color: z.string().default("#000"),
});

export const MyVideo = (props: z.infer<typeof schema>) => {
  return <h1 style={{ color: props.color }}>{props.title}</h1>;
};

// Register with schema
<Composition
  id="MyVideo"
  component={MyVideo}
  schema={schema}
  defaultProps={{ title: "Hello", color: "#000" }}
  durationInFrames={150}
  fps={30}
  width={1280}
  height={720}
/>
```

---

## Animation Recipes

### Fade In
```tsx
const fade = interpolate(frame, [0, 30], [0, 1], {
  easing: Easing.out(Easing.cubic),
  extrapolateRight: "clamp"
});

<div style={{ opacity: fade }} />
```

### Slide From Left
```tsx
const x = interpolate(frame, [0, 30], [-400, 0], {
  easing: Easing.inOut(Easing.quad)
});

<div style={{ translate: `${x}px 0` }} />
```

### Rotate 360°
```tsx
const rotation = interpolate(frame, [0, 60], [0, 360]);

<div style={{ rotate: `${rotation}deg` }} />
```

### Scale Bounce
```tsx
const scale = interpolate(frame, [0, 15, 30], [0, 1.2, 1], {
  easing: Easing.bezier(0.68, -0.55, 0.265, 1.55)
});

<div style={{ scale }} />
```

### Staggered List
```tsx
items.map((item, i) => {
  const delay = i * 5; // 5 frame delay per item
  const frame = currentFrame - delay;
  
  const opacity = interpolate(frame, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });
  
  return <div key={i} style={{ opacity }} />;
})
```

---

## Media

### Video
```tsx
import { Video } from "@remotion/media";

<Video src={staticFile("video.mp4")} />
<Video src="https://example.com/video.mp4" />
<Video src={staticFile("video.mp4")} muted volume={0.5} />
```

### Audio
```tsx
import { Audio } from "@remotion/media";

<Audio src={staticFile("music.mp3")} />
<Audio src={staticFile("audio.mp3")} volume={0.5} />
```

### Image
```tsx
import { CanvasImage } from "@remotion/media";
import { Img } from "remotion";

<CanvasImage src={staticFile("image.png")} width={200} height={200} />
<Img src={staticFile("image.png")} width={200} height={200} />
```

### Animated GIF
```tsx
import { AnimatedImage } from "@remotion/media";

<AnimatedImage src={staticFile("animation.gif")} />
```

---

## Effects

```tsx
import { blur, vignette, grayscale } from "@remotion/effects";

<Video
  src={staticFile("video.mp4")}
  effects={[
    blur(5),
    vignette(0.5),
    grayscale(0.5)
  ]}
/>
```

### Common Effects
```tsx
// Color & Tone
brightness(2)
contrast(1.5)
saturation(1.2)
hue(45)
grayscale(0.5)
invert(1)
duotone("#ff0000", "#0000ff")

// Blur
blur(10)
radialProgressiveBlur(0.5)

// Lighting
dropShadow(0, 10, 20, "#000", 0.5)
glow(20, "#fff", 0.8)
vignette(0.5)

// Distortion
fisheye(0.5)
barrelDistortion(0.3)
cornerPin([...])
```

---

## Layout Patterns

### Center Content
```tsx
<div style={{
  flex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center"
}}>
  {/* Centered content */}
</div>
```

### Grid
```tsx
<div style={{
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: 20
}}>
  {items.map(item => <div key={item} />)}
</div>
```

### Flex Column
```tsx
<div style={{
  display: "flex",
  flexDirection: "column",
  gap: 20
}}>
  {/* Items stack vertically */}
</div>
```

### Absolute Positioning
```tsx
import { AbsoluteFill } from "remotion";

<AbsoluteFill>
  <div style={{ position: "absolute", top: 50, left: 50 }} />
</AbsoluteFill>
```

---

## Timing Utilities

```tsx
// Get FPS and calculate frame durations
const { fps } = useVideoConfig();
const oneSec = fps;
const twoSec = fps * 2;

// Frame ranges
const frame = useCurrentFrame();
const durationInSeconds = 3;
const durationInFrames = durationInSeconds * fps;

// Check frame ranges
const isInRange = frame >= start && frame < end;
```

---

## Performance

### Memoize Heavy Computations
```tsx
import { useMemo } from "react";

const computed = useMemo(() => {
  return expensiveCalculation(frame);
}, [frame]);
```

### Extract Animated Components
```tsx
// ❌ Bad: whole component re-renders every frame
<Parent>
  <AnimatedChild />
  <StaticContent />
</Parent>

// ✅ Good: only animated part re-renders
const AnimatedPart = () => {
  const frame = useCurrentFrame();
  return <AnimatedChild frame={frame} />;
};
```

---

## Debugging

### Console Logging
```tsx
useEffect(() => {
  console.log("Frame:", frame);
  console.log("FPS:", fps);
}, [frame, fps]);
```

### Frame Inspector (in Studio)
- Use timeline scrubber to freeze on specific frame
- Adjust individual props in Studio UI
- Export frame as PNG for inspection

### Render Test Frame
```bash
npx remotion still Demo1 --frame=0 --output=test.png
```

---

## File Structure Template

```
my-video/
├── src/
│   ├── index.tsx
│   ├── Root.tsx
│   ├── compositions/
│   │   ├── Intro.tsx
│   │   ├── Main.tsx
│   │   └── Outro.tsx
│   └── components/
│       ├── Button.tsx
│       ├── Card.tsx
│       └── Text.tsx
├── public/
│   ├── images/
│   ├── videos/
│   └── audio/
├── remotion.config.ts
├── tsconfig.json
└── package.json
```

---

## Common Config

### remotion.config.ts
```tsx
import { Config } from "remotion";

Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setFrameRange([0, 150]);
Config.setQuality(80);
Config.setChromiumDownloadDir("./chromium");
```

---

## Useful Links

```
Studio UI:          http://localhost:3000
Docs:               https://remotion.dev/docs
API Reference:      https://remotion.dev/docs/api
Templates:          https://remotion.dev/templates
Discord:            https://remotion.dev/discord
GitHub Issues:      https://github.com/remotion-dev/remotion/issues
```

---

## Tips & Tricks

1. **Use `--no-open` for headless rendering**
   ```bash
   npx remotion studio --no-open
   ```

2. **Export multiple formats**
   ```bash
   npx remotion render --codec=h264  # MP4
   npx remotion render --codec=vp9   # WebM
   npx remotion render --sequence    # PNG
   ```

3. **Speed up rendering**
   - Increase concurrency: `--concurrency=8`
   - Lower quality during dev: `--quality=50`
   - Use VP9: `--codec=vp9`

4. **Freeze development version**
   ```bash
   npx remotion@4.0.0 studio
   ```

5. **Check installed version**
   ```bash
   npm list remotion
   ```

---

## Common Errors

| Error | Solution |
|-------|----------|
| Port 3000 in use | `npx remotion studio --port 3001` |
| Module not found | `npm install` + `rm -rf node_modules` |
| Canvas rendering slow | Reduce width/height for testing |
| Frame skipped | Check for heavy computations, use useMemo |
| Type errors | Check schema matches props |

---

**Last Updated**: Oct 2026
**Remotion Version**: 4.0+
