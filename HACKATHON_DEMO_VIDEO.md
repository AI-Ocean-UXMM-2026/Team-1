# OERN Hackathon Demo Video Guide

## 📹 Overview

A professional **70-second explainer video** showcasing the OERN door-to-door delivery platform. Perfect for:
- Hackathon pitch presentations
- Investor demos
- Product walkthroughs
- Social media promotion
- Website hero video

---

## 🎬 Video Structure

### Scene 1: Title Screen (10 seconds)
**Theme**: Navy gradient background with orange accent  
**Content**:
- Large animated logo (📦)
- "OERN" title in signal orange (#f97316)
- Subtitle: "Door-to-Door Delivery for Yangon"
- Tagline: "Real-time tracking • Smart routing"

**Animation**: Fade-in with bounce and scale effects

### Scene 2: The Problem (10 seconds)
**Theme**: Light canvas background  
**Content**: Four key problems customers face
1. ❌ Customers have no idea where their parcel is
2. ⏰ No real-time tracking or delivery updates
3. 🚚 Drivers waste time planning routes manually
4. 😰 Managers struggle to coordinate operations

**Animation**: Slide-in from right with staggered timing

### Scene 3: Our Solution (10 seconds)
**Theme**: Navy gradient with blue accents  
**Content**: Four core capabilities in 2×2 grid
- 📍 Live Tracking (Real-time GPS location)
- ⚡ Smart Routing (AI-optimized delivery routes)
- 👥 Unified Dashboard (Managers, drivers, customers)
- 💚 Energy Aware (Battery & fuel optimization)

**Animation**: Elastic scale-in with back easing

### Scene 4: Designed for Everyone (10 seconds)
**Theme**: Light canvas background  
**Content**: Three user personas with capabilities
- **Manager**: Create & manage orders, assign drivers, monitor deliveries, view fleet
- **Driver/Rider**: View tasks, accept deliveries, share location, record COD
- **Customer**: Track parcel, view ETA, see live location, manage orders

**Animation**: Slide from left with icon highlights

### Scene 5: Built with Modern Tech (10 seconds)
**Theme**: Subtle grid background  
**Content**: Technology stack in 3×2 grid
- ⚛️ Next.js 16
- 🎨 React 19
- 🗄️ Supabase
- 🗺️ Mapbox
- 📘 TypeScript
- 📍 Real-time GPS

**Animation**: Scale-in cascade effect

### Scene 6: The Impact (10 seconds)
**Theme**: Navy gradient with blue borders  
**Content**: Key metrics in 2×2 grid
- **100%** Real-time Visibility
- **40%** Faster Deliveries
- **∞** Scalable Routes
- **😊** Happy Customers

**Animation**: Scale-up with staggered opacity

### Scene 7: Call to Action (10 seconds)
**Theme**: Navy gradient background  
**Content**:
- Main CTA: "Ready to Transform Deliveries?"
- Subheading: "Join us in revolutionizing door-to-door delivery in Yangon"
- Button: "Visit oern.app"
- Contact: "📧 hello@oern.app | 🌐 oern.app"

**Animation**: Scale and pulsing button effect

---

## 🎨 Design System

### Colors (From DESIGN.md)
```
Primary Accent:  #f97316 (signal-orange)
Secondary Dark:  #172b4d (dispatch-navy)
Accent Blue:     #2563eb (live-blue)
Success:         #16a34a (delivered-green)
Background:      #f8fafc (canvas)
Surface:         #ffffff (white)
```

### Typography
- **Display**: 80px, weight 900
- **Headlines**: 56px, weight 800
- **Title**: 28-32px, weight 700
- **Body**: 16-20px, weight 400-600

### Effects
- Fade-in with cubic easing
- Slide transitions with quad easing
- Scale effects with elastic/back easing
- Staggered animations for lists
- Pulsing animations for CTAs

---

## 🚀 How to Use

### 1. Preview in Studio
```bash
cd /Users/happer/Projects/oern/remotion-demo
npm install
npm run dev
```

Then select **"HackathonDemo_Oern"** from the composition list.

### 2. Render to MP4
```bash
npx remotion render HackathonDemo_Oern
```

Output: `out/HackathonDemo_Oern.mp4` (1280×720, 30fps, ~70 seconds)

### 3. Render High Quality
```bash
npx remotion render HackathonDemo_Oern --quality=90 --concurrency=4
```

### 4. Export to WebM
```bash
npx remotion render HackathonDemo_Oern --codec=vp9
```

### 5. Export Frame Sequence (for editing)
```bash
npx remotion render HackathonDemo_Oern --sequence
```

---

## 📝 Customization

### Easy Edits (No Code Changes)
The composition uses hardcoded content that's easy to find and modify:

**File**: `src/compositions/HackathonDemo_Oern.tsx`

### Change Colors
```tsx
// Theme colors at top of each scene
backgroundColor: '#172b4d',  // Navy
backgroundColor: '#f8fafc',  // Light canvas
```

### Change Text
Search for these strings to modify:
- "OERN" → Your app name
- "Door-to-Door Delivery for Yangon" → Your tagline
- Feature names and descriptions
- Contact information
- Website URL

### Change Duration
```tsx
const sceneDuration = fps * 10; // Change 10 to 5 for 5-second scenes
const totalFrames = sceneDuration * 7; // 7 scenes total
```

### Add More Scenes
```tsx
<Sequence from={sceneDuration * 7} durationInFrames={sceneDuration}>
  <YourNewScene />
</Sequence>
```

---

## 🎯 Key Features

✅ **Professional Design**: Uses brand colors from DESIGN.md  
✅ **Animated Transitions**: Smooth easing and scale effects  
✅ **Mobile-Friendly**: 16:9 aspect ratio  
✅ **Fast Rendering**: ~2 minutes for full quality render  
✅ **Easy Customization**: Simple text/color changes  
✅ **No External Assets**: Self-contained, no image dependencies  
✅ **Responsive Text**: Readable on all displays  
✅ **Brand Consistency**: Follows OERN design system  

---

## 📊 Technical Specs

| Property | Value |
|----------|-------|
| **Duration** | 70 seconds (2100 frames) |
| **Frame Rate** | 30 fps |
| **Resolution** | 1280 × 720 (16:9) |
| **Codec** | H.264 (MP4) or VP9 (WebM) |
| **File Size** | ~15-25 MB (depends on quality) |
| **Render Time** | 1-3 minutes (depends on quality/concurrency) |

---

## 🎬 Scene Durations Breakdown

| Scene | Duration | Focus |
|-------|----------|-------|
| 1. Title | 10s | Brand introduction |
| 2. Problem | 10s | Market pain points |
| 3. Solution | 10s | Core value proposition |
| 4. Features | 10s | User-centric capabilities |
| 5. Tech | 10s | Technology credibility |
| 6. Impact | 10s | Business metrics |
| 7. CTA | 10s | Call to action |

---

## 💡 Usage Ideas

### Hackathon Pitch Deck
Include as full-screen video on title slide or play before Q&A

### Website Hero Section
Embed on landing page with play button overlay

### Social Media
- Export 15-second teaser (change Scene 7 timing)
- Share on LinkedIn, Twitter, YouTube
- Use with captions for silent viewing

### Investor Presentation
Play as opener to demonstrate product vision

### Team Onboarding
Help new team members understand the platform vision

### Marketing Campaign
Use across email, LinkedIn, and social channels

---

## 🔄 Versions

### Version 1.0 (Current)
- 7 scenes, 70 seconds total
- Hackathon-focused messaging
- OERN brand colors and typography
- Ready to render and export

### Future Versions
- Add demo of actual UI/app screens
- Include testimonials
- Add background music/voiceover sync
- Create shorter 15-30 second versions
- Multi-language versions

---

## 📞 Support

### Remotion Issues
- Check [Remotion Docs](https://remotion.dev/docs)
- Rendering too slow? Reduce quality: `--quality=50`
- Not seeing changes? Clear cache: `rm -rf .next node_modules`

### OERN App Updates
- Change contact info in Scene 7 CTA
- Update technology stack in Scene 5
- Modify messaging for different audiences
- Adapt colors if brand identity changes

---

## 📦 Files Included

```
remotion-demo/src/compositions/
└── HackathonDemo_Oern.tsx    (Main video composition - 350+ lines)

remotion-demo/src/
└── Root.tsx                   (Registered as HackathonDemo_Oern)
```

---

## 🎓 Learning Resources

### Remotion Concepts Used in This Video
1. **Sequencing**: Multiple scenes with `<Sequence>`
2. **Interpolation**: Smooth animations between frames
3. **Easing Functions**: Professional timing (cubic, quad, back, elastic)
4. **Component Composition**: Modular scene components
5. **Frame-based Animation**: `useCurrentFrame()` and `useVideoConfig()`
6. **Responsive Layout**: Flexbox and grid layouts
7. **Typography**: Professional text sizing and spacing
8. **Color Theory**: Brand-consistent color usage

### Next Steps
- Modify for your own hackathon project
- Add voiceover synchronization
- Integrate with your pitch deck
- Create variations for different audiences
- Build a library of reusable video components

---

## 🎉 Ready to Go!

Just run:
```bash
npm run dev
```

Select **"HackathonDemo_Oern"** and watch the magic happen! 🚀

---

**Version**: 1.0  
**Last Updated**: October 23, 2026  
**Status**: Production Ready ✅
