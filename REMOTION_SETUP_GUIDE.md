# Remotion Setup & Demo Flows - Complete Guide

## Quick Start Installation

### Prerequisites
- **Node.js**: 16.0.0 or higher
- **npm**: 7.0.0 or higher (or use yarn/pnpm)
- **macOS**: 15.0+ (Sequoia or later) or **Linux** with Libc 2.35+

### Method 1: Using Create-Video (Recommended)

```bash
# Create a new Remotion project
npx create-video@latest --yes --blank --no-tailwind my-video
cd my-video
npm install

# Start the interactive Studio
npm run dev
```

The Studio opens at `http://localhost:3000` with live preview!

### Method 2: Manual Setup

```bash
# Initialize a new project
mkdir my-video
cd my-video
npm init -y

# Install Remotion
npm install remotion @remotion/cli

# Add scripts to package.json
```

Update `package.json`:
```json
{
  "scripts": {
    "dev": "remotion studio",
    "build": "remotion render",
    "start": "remotion studio"
  }
}
```

---

## Project Structure

```
remotion-demo/
├── src/
│   ├── index.tsx                          # Entry point
│   ├── Root.tsx                          # Register all compositions
│   └── compositions/
│       ├── Demo1_BasicAnimation.tsx       # Fade & bounce effects
│       ├── Demo2_MultiScene.tsx           # Sequenced scenes
│       ├── Demo3_TextAnimation.tsx        # Typography
│       ├── Demo4_GridAnimation.tsx        # Data visualization
│       └── Demo5_Parametrized.tsx         # Dynamic content
├── public/                                # Static assets (images, videos)
├── remotion.config.ts                    # Remotion configuration
├── tsconfig.json                         # TypeScript config
└── package.json
```

---

## Demo Flows Overview

### Demo 1: Basic Animation ⭐ (Start Here!)
**Duration**: 5 seconds | **Complexity**: ⭐

```
File: src/compositions/Demo1_BasicAnimation.tsx
Features:
- Fade-in animation
- Bounce effect using easing functions
- Frame-based interpolation
- useCurrentFrame() hook

Use Cases:
- UI transitions
- Loading animations
- Simple intro sequences
```

**Run in Studio**:
1. Start: `npm run dev`
2. Select "Demo1_BasicAnimation" from compositions
3. Watch the preview on the right
4. Edit code and see live changes!

---

### Demo 2: Multi-Scene Video 🎬 (Advanced)
**Duration**: 9 seconds | **Complexity**: ⭐⭐

```
File: src/compositions/Demo2_MultiScene.tsx
Features:
- <Sequence> component for timing
- Three different animated scenes
- Linear, rotational, and elastic animations
- Scene transitions

Use Cases:
- Story-driven videos
- Tutorial sequences
- Product demos
- Social media content
```

**Scenes**:
- Scene 1 (0-3s): Circle slides left to right
- Scene 2 (3-6s): Square rotates 360°
- Scene 3 (6-9s): Rectangle scales with bounce

---

### Demo 3: Text Animation ✍️ (Design)
**Duration**: 5 seconds | **Complexity**: ⭐⭐

```
File: src/compositions/Demo3_TextAnimation.tsx
Features:
- Gradient text effect
- Delayed subtitle entrance
- Accent line animation
- Typography best practices

Use Cases:
- Title sequences
- Intro animations
- Brand videos
- Educational content
```

**Elements**:
- Main title with gradient (fades in at 0s)
- Subtitle appears at 1.5s
- Accent line fills from center at 2s

---

### Demo 4: Grid Animation 📊 (Data Viz)
**Duration**: 6 seconds | **Complexity**: ⭐⭐

```
File: src/compositions/Demo4_GridAnimation.tsx
Features:
- 3×3 grid layout
- Staggered animations
- 3D rotation effects
- Dynamic color generation

Use Cases:
- Dashboard animations
- Infographics
- Data visualizations
- Statistics presentations
```

**Pattern**:
- Items animate in staggered sequence
- Each item rotates 90° on Y-axis while appearing
- Colors auto-generated based on index

---

### Demo 5: Parametrized Video 🎨 (Batch Rendering)
**Duration**: 3 seconds | **Complexity**: ⭐⭐⭐

```
File: src/compositions/Demo5_Parametrized.tsx
Features:
- Zod schema for type safety
- Dynamic title prop
- Customizable background color
- Customizable text color
- Duration parameter

Use Cases:
- Batch rendering thousands of videos
- Personalized video generation
- Dynamic social media content
- A/B testing different variants
```

**Parameters** (editable in Studio):
```javascript
{
  title: "Your Custom Title",
  bgColor: "#667eea",
  textColor: "#ffffff",
  duration: 3
}
```

---

## Remotion Core Concepts

### 1. Compositions
Define a video structure with dimensions and duration:

```tsx
<Composition
  id="MyVideo"
  component={MyComponent}
  durationInFrames={150}
  fps={30}
  width={1280}
  height={720}
/>
```

### 2. Frame-Based Animation
Animate using `useCurrentFrame()`:

```tsx
const frame = useCurrentFrame();
const { fps } = useVideoConfig();

const opacity = interpolate(frame, [0, fps], [0, 1], {
  easing: Easing.out(Easing.cubic)
});
```

### 3. Sequencing
Arrange clips and scenes with `<Sequence>`:

```tsx
<Sequence from={0} durationInFrames={30}>
  <Scene1 />
</Sequence>
<Sequence from={30} durationInFrames={30}>
  <Scene2 />
</Sequence>
```

### 4. Interpolation
Smooth animations between values:

```tsx
// Animate opacity from 0 to 1 over 30 frames
interpolate(frame, [0, 30], [0, 1])

// With easing
interpolate(frame, [0, 30], [0, 1], {
  easing: Easing.out(Easing.cubic)
})
```

### 5. Easing Functions
Control animation timing:

```tsx
Easing.linear
Easing.in(Easing.cubic)
Easing.out(Easing.cubic)
Easing.inOut(Easing.cubic)
Easing.bezier(x1, y1, x2, y2)
Easing.spring({ damping: 10 })
Easing.elastic(bounciness)
```

### 6. Parameters & Zod
Make videos parametrizable:

```tsx
import { z } from 'zod';

export const parametrizationSchema = z.object({
  title: z.string().default('Hello'),
  bgColor: z.string().default('#000'),
});

export const MyVideo = (props: z.infer<typeof parametrizationSchema>) => {
  return <div style={{ backgroundColor: props.bgColor }} />;
};
```

---

## Running the Demos

### Start Interactive Studio
```bash
npm run dev
# Opens http://localhost:3000
```

Features:
- Live preview with code sync
- Editable component props
- Frame-by-frame scrubbing
- Timeline composition editor
- Real-time rendering

### Render to MP4
```bash
# Render all compositions
npm run build

# Render specific composition
npx remotion render Demo1_BasicAnimation

# Output to WebM (smaller file)
npx remotion render Demo1_BasicAnimation --codec=vp9

# High quality render
npx remotion render Demo1_BasicAnimation --quality=100
```

### Render to PNG Sequence
```bash
npx remotion render Demo1_BasicAnimation --sequence
```

### Batch Rendering with Parameters
```bash
# Render multiple variations
npx remotion render --props '{"title":"Video 1","bgColor":"#667eea"}'
npx remotion render --props '{"title":"Video 2","bgColor":"#764ba2"}'
```

---

## Production Workflow

### 1. Development
```bash
npm run dev
# Edit in code editor while watching Studio preview
```

### 2. Preview & Test
- Check Studio preview
- Frame-by-frame scrub to verify timing
- Test interactive parameters
- Export PNG for quick validation

### 3. Render Final Video
```bash
npx remotion render Demo1_BasicAnimation --concurrency=4 --quality=90
```

### 4. Post-Processing (Optional)
- Add audio with FFmpeg
- Color grading in DaVinci Resolve
- VFX in After Effects
- Export for social media

---

## Common Tasks

### Add Audio
```tsx
import { Audio } from "@remotion/media";
import { staticFile } from "remotion";

export const MyVideo = () => {
  return (
    <>
      <Audio src={staticFile("music.mp3")} />
      <YourContent />
    </>
  );
};
```

### Add Video/Image
```tsx
import { Video, CanvasImage } from "@remotion/media";
import { staticFile } from "remotion";

<Video src={staticFile("background.mp4")} />
<CanvasImage src={staticFile("logo.png")} width={200} height={200} />
```

### Apply Effects
```tsx
import { blur, vignette, grayscale } from "@remotion/effects";

<Video
  src={staticFile("video.mp4")}
  effects={[blur(5), vignette(), grayscale(0.5)]}
/>
```

### Add Captions
```tsx
import { AbsoluteFill } from "remotion";

<AbsoluteFill>
  <YourVideo />
  <CaptionTrack>
    {/* Captions appear synchronized with timing */}
  </CaptionTrack>
</AbsoluteFill>
```

---

## Performance Tips

1. **Keep useCurrentFrame() local**
   - Only subscribe where needed
   - Extract to smallest component possible

2. **Use useMemo for heavy computations**
   ```tsx
   const expensive = useMemo(() => complexCalc(frame), [frame]);
   ```

3. **Optimize assets**
   - Compress images and videos
   - Use WebP for images
   - Consider video codec (VP9 for web, H.264 for compatibility)

4. **Use concurrency for rendering**
   ```bash
   npx remotion render --concurrency=8
   ```

5. **Cache externally**
   - Don't re-fetch data on every frame
   - Use static files from `public/`

---

## Deployment Options

### 1. AWS Lambda
```bash
npx remotion lambda create-function
npx remotion lambda render MyVideo
```

### 2. Vercel Serverless
Deploy your Remotion React app on Vercel for on-demand video generation

### 3. Cloudflare Workers
Stream video generation to edge

### 4. Self-Hosted Node.js
Express server with Remotion Server rendering

---

## Troubleshooting

### Port 3000 already in use
```bash
npx remotion studio --port 3001
```

### Canvas rendering issues
- Update Chrome/Chromium
- Check system memory
- Reduce frame dimensions for testing

### Slow rendering
- Increase concurrency: `--concurrency=8`
- Reduce quality during development: `--quality=50`
- Use VP9 codec: `--codec=vp9`

### Module not found errors
```bash
rm -rf node_modules
npm install
```

---

## Resources

| Resource | URL |
|----------|-----|
| **Official Docs** | https://www.remotion.dev/docs |
| **API Reference** | https://www.remotion.dev/docs/api |
| **Templates** | https://www.remotion.dev/templates |
| **Community** | https://remotion.dev/discord |
| **GitHub** | https://github.com/remotion-dev/remotion |
| **Test Media** | https://remotion.media |

---

## Next Steps

After mastering the demo flows:

1. **Create your own composition** from scratch
2. **Add audio** and synchronize animations
3. **Integrate with your app** for dynamic video generation
4. **Deploy to production** on Lambda or Vercel
5. **Build a video editor** using Remotion Player
6. **Experiment with 3D** using Three.js + React Three Fiber
7. **Add AI captions** with ElevenLabs or Deepgram

---

## License

- **Free**: For individuals and teams up to 3 people
- **Company**: For teams of 4+ ($250+/month)
- **Automators**: $0.01 per render ($100/month minimum)
- **Enterprise**: Custom pricing

See full details at: https://www.remotion.dev/docs/license/pricing
