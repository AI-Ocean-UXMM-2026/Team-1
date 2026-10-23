# Remotion: Comprehensive Research & Skills Guide

## What is Remotion?

**Remotion** is a framework for making videos programmatically with React. It enables developers to:
- Create videos and motion graphics entirely with code (React/TypeScript)
- Use interactive Studio for drag-and-drop editing that saves back to code
- Build parameterized video templates for batch rendering
- Scale video generation from single videos to millions of renders
- Create video editing applications and tools

### Key Characteristics
- **Framework**: React-based video composition library
- **Output**: MP4, WebM, GIF, PNG sequences
- **Rendering**: Local, Lambda, Vercel, Cloudflare, or custom servers
- **Interactive**: Studio for real-time preview and editing
- **Programmable**: Full code control with Zod schemas for parameters

---

## Remotion Skills Overview

### 1. **remotion-best-practices**
Core orchestration skill that routes to appropriate sub-skills based on task type:
- Creating new videos/compositions
- Working with React markup
- Maps and geographic content
- Multimedia (video trimming, metadata)
- Interactivity and Studio editing
- Rendering optimization
- Captions and subtitles
- SaaS applications
- Upgrades and dependencies

**When to use**: Primary entry point for all Remotion tasks

### 2. **remotion-create**
Scaffolds new Remotion projects and compositions:
- Project setup with `create-video@latest`
- Template selection (blank, hello-world, etc.)
- Package manager choices (npm, pnpm, yarn, bun)
- TailwindCSS optional configuration
- Folder structure for new projects vs. existing codebases

**Key workflows**:
- Empty folder: Create project directly
- Non-empty folder: Create in subfolder
- Existing project: Add composition to current project

### 3. **remotion-docs**
Access and search current Remotion documentation:
- Algolia API search integration
- Markdown source fetching (append `.md` to URL)
- API reference lookup
- Real-time documentation discovery

**Usage**: Search for concepts, fetch relevant documentation pages

### 4. **remotion-markup**
React markup best practices for video composition:
- Component structure and rendering performance
- Animation with `useCurrentFrame()` and `interpolate()`
- Frame-based animation instead of CSS transitions
- Asset management with `staticFile()`
- Media components: `<Video>`, `<Audio>`, `<CanvasImage>`
- Effects system (blur, color correction, distortion, etc.)
- Sequencing and timing control
- Multi-scene video patterns
- Text sizing and layout
- 3D content with Three.js integration

**Core patterns**:
```tsx
import { useCurrentFrame, useVideoConfig, interpolate, Easing } from "remotion";

export const FadeIn = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div style={{
      opacity: interpolate(frame, [0, 2 * fps], [0, 1], {
        extrapolateRight: "clamp",
        easing: Easing.bezier(0.16, 1, 0.3, 1),
      }),
    }}>
      Animated content
    </div>
  );
};
```

### 5. **remotion-studio**
Interactive preview and editing environment:
- Real-time video preview
- Interactive component editing that saves to code
- Drag-and-drop timeline composition editing
- Frame-by-frame inspection
- Studio configuration and CLI flags
- Browser-based or in-app preview

### 6. **remotion-render**
Video export and rendering:
- Local rendering with `npx remotion render`
- MP4, WebM, GIF, PNG sequence output
- Batch rendering for multiple compositions
- Advanced rendering options and optimization
- Performance tuning

### 7. **remotion-captions**
Transcription, display, and animation of captions:
- Caption track creation
- Synchronized timing with video
- Animation and styling
- Multi-language support

### 8. **remotion-interactivity**
Structure markup for interactive editing:
- Making properties editable in Studio
- Interactive components and timelines
- Component extraction for editing
- Source-editable schemas with Zod
- Connected compositions

### 9. **remotion-maps**
Map animations and geographic content:
- Static map rendering
- Animated routes and markers
- Mapbox, MapLibre, MapTiler integration
- GeoJSON support
- 3D geographic flyovers

### 10. **remotion-multimedia**
Working with multimedia in browser:
- Video trimming and cropping
- Metadata extraction
- Mediabunny integration
- Image asset management

### 11. **remotion-saas**
Building Remotion-powered applications:
- Remotion Player component
- Server-side rendering (SSR)
- Lambda rendering integration
- Client-side rendering
- Building video editors and automation tools

### 12. **remotion-upgrade**
Package and dependency management:
- Upgrading Remotion version
- Related package compatibility
- Mediabunny package updates
- Skill version management

---

## Installation Methods

### Method 1: New Project (Recommended)
```bash
npx create-video@latest --yes --blank --no-tailwind my-video
cd my-video
npm install
```

### Method 2: Existing Project
```bash
npm install remotion @remotion/cli
npx remotion skills add  # Optional: Add Agent Skills
```

### Method 3: With Agent Skills
```bash
npx -y skills@latest add remotion-dev/skills -g -y
```

---

## System Requirements
- **Node.js**: 16.0.0+
- **macOS**: 15.0+ (Sequoia or later)
- **Linux**: Libc 2.35+, additional packages required
- **Bun**: 1.0.3+

---

## Key API & Components

### Composition Structure
```tsx
import { Composition } from "remotion";

function Root() {
  return (
    <Composition
      id="MyVideo"
      component={MyVideoComponent}
      durationInFrames={150}
      fps={30}
      width={1920}
      height={1080}
    />
  );
}
```

### Animation
```tsx
import { useCurrentFrame, interpolate, Easing } from "remotion";

const frame = useCurrentFrame();
const opacity = interpolate(frame, [0, 30], [0, 1], {
  easing: Easing.out(Easing.cubic),
});
```

### Media
```tsx
import { Video, Audio } from "@remotion/media";
import { staticFile } from "remotion";

<Video src={staticFile("video.mp4")} />
<Audio src={staticFile("audio.mp3")} />
```

### Effects
```tsx
import { blur, vignette, grayscale } from "@remotion/effects";

<Video effects={[blur(5), vignette()]} />
```

### Sequencing
```tsx
import { Sequence } from "remotion";

<Sequence from={0} durationInFrames={60}>
  <Scene1 />
</Sequence>
<Sequence from={60} durationInFrames={60}>
  <Scene2 />
</Sequence>
```

---

## Common Use Cases

1. **Music Videos**: Sync animations to audio beats
2. **Explainer Videos**: Data visualization with animated scenes
3. **Social Media**: Generate parameterized videos for campaigns
4. **Screencasts**: Automated tutorial recording
5. **Data Videos**: Animated charts and graphs
6. **Batch Rendering**: Generate thousands of personalized videos
7. **Video Editing**: Build custom video editor UI
8. **Motion Design**: Complex animated sequences
9. **Captions & Subtitles**: Auto-generated from transcripts
10. **Interactive Demos**: Real-time editing in Studio

---

## Studio Workflow

1. **Preview**: `npx remotion studio` opens interactive editor
2. **Edit**: Modify component props and see live preview
3. **Code Sync**: Changes in editor save back to React code
4. **Timeline**: Visual composition editor for timing
5. **Inspect**: Frame-by-frame debugging
6. **Export**: Render from Studio UI or CLI

---

## Performance Tips

- Keep `useCurrentFrame()` in smallest necessary components
- Use `interpolate()` for smooth animations
- Apply effects at component level, not globally
- Use connected compositions for complex timelines
- Cache heavy computations
- Optimize media files before use
- Use `@remotion/zod` for type-safe parameters

---

## Resources

- **Official Docs**: https://www.remotion.dev/docs
- **Templates**: https://www.remotion.dev/templates
- **Discord Community**: https://remotion.dev/discord
- **GitHub**: https://github.com/remotion-dev/remotion
- **Test Media**: https://remotion.media
- **Pricing**: Free (up to 3 people), Company License ($250+), Enterprise

---

## License

- **Free**: For individuals and teams up to 3 people
- **Company**: For teams of 4+ (usage-based pricing)
- **Automators**: $0.01 per render for automation projects
- **Creators**: $25/month per seat for manual creation
- **Enterprise**: Custom pricing and terms
