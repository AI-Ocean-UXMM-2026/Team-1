# OERN Hackathon Demo - Quick Render Guide

## ⚡ 30-Second Setup

### 1. Install Dependencies
```bash
cd /Users/happer/Projects/oern/remotion-demo
npm install remotion @remotion/cli zod
```

### 2. Preview (Optional)
```bash
npm run dev
# Opens http://localhost:3000
# Select "HackathonDemo_Oern"
```

### 3. Render the Video
```bash
npx remotion render HackathonDemo_Oern
```

✅ Done! Video saves to `out/HackathonDemo_Oern.mp4`

---

## 🎬 Render Variations

### Standard Quality (Fast)
```bash
npx remotion render HackathonDemo_Oern --quality=80
# ~60 seconds to render
# File: ~18 MB
```

### High Quality (Slower)
```bash
npx remotion render HackathonDemo_Oern --quality=90
# ~2 minutes to render
# File: ~22 MB
```

### Ultra Quality (Very Slow)
```bash
npx remotion render HackathonDemo_Oern --quality=100
# ~3 minutes to render
# File: ~25 MB
```

### Faster Render (Multiple Cores)
```bash
npx remotion render HackathonDemo_Oern --concurrency=4
# Uses 4 CPU cores
# ~1 minute to render
```

### WebM Format (Smaller File)
```bash
npx remotion render HackathonDemo_Oern --codec=vp9
# WebM format (better for web)
# File: ~12 MB
```

### MP4 with Audio Track (Requires External Audio)
```bash
# Render first
npx remotion render HackathonDemo_Oern

# Then add audio with FFmpeg
ffmpeg -i out/HackathonDemo_Oern.mp4 -i background.mp3 \
  -c:v copy -c:a aac -shortest output_with_audio.mp4
```

---

## 📋 Output Details

**Default Output**:
- **File**: `out/HackathonDemo_Oern.mp4`
- **Resolution**: 1280×720 (16:9)
- **Duration**: 70 seconds
- **Frame Rate**: 30 fps
- **Codec**: H.264
- **Quality**: 80 (default)
- **File Size**: ~18 MB

---

## 📤 Upload to Platforms

### YouTube
```bash
# Render and keep defaults
npx remotion render HackathonDemo_Oern --quality=90

# Upload MP4 to YouTube
# YouTube will accept 1280×720 resolution
```

### LinkedIn/Twitter
```bash
# Create 16:9 version (already optimized)
npx remotion render HackathonDemo_Oern --quality=80

# Twitter max: 15 MB, 10 minutes → ✅ Good (18 MB, 70s)
# LinkedIn max: 10 GB, unlimited duration → ✅ Good
```

### Website (Embed)
```bash
# Use WebM for smaller size
npx remotion render HackathonDemo_Oern --codec=vp9

# Then embed with video tag:
# <video width="1280" height="720" controls>
#   <source src="out/HackathonDemo_Oern.webm" type="video/webm">
#   <source src="out/HackathonDemo_Oern.mp4" type="video/mp4">
# </video>
```

---

## 🎨 Customization Before Rendering

### Change Colors
Edit: `src/compositions/HackathonDemo_Oern.tsx`

Find and replace:
- `'#172b4d'` → Your navy color
- `'#f97316'` → Your orange color
- `'#2563eb'` → Your blue color

### Change Text
Search for these strings:
- `"OERN"` → Your app name
- `"Door-to-Door Delivery for Yangon"` → Your tagline
- `"hello@oern.app"` → Your email
- `"oern.app"` → Your website

### Change Duration
```tsx
const sceneDuration = fps * 10;  // 10 seconds per scene
// Change to fps * 5 for 5-second scenes = 35 second total video
```

### Save and Re-render
```bash
npx remotion render HackathonDemo_Oern
```

---

## 🐛 Troubleshooting

### Port 3000 Already in Use
```bash
npx remotion studio --port 3001
```

### Rendering Failed
```bash
# Clear cache
rm -rf .next
rm -rf node_modules
npm install

# Try again
npx remotion render HackathonDemo_Oern
```

### Out of Memory
```bash
# Lower quality to reduce memory
npx remotion render HackathonDemo_Oern --quality=50

# Or use single core
npx remotion render HackathonDemo_Oern --concurrency=1
```

### Composition Not Found
```bash
# Make sure Root.tsx is updated
# Check that HackathonDemo_Oern is registered
npm run dev
# You should see it in the list
```

---

## ⚙️ Advanced Options

### Full Command with All Options
```bash
npx remotion render HackathonDemo_Oern \
  --quality=90 \
  --concurrency=4 \
  --codec=h264 \
  --output=my_video.mp4
```

### Export PNG Frames (for editing)
```bash
npx remotion render HackathonDemo_Oern --sequence
# Creates 2100 PNG files (70s × 30fps)
# In: out/HackathonDemo_Oern/
```

### Render Specific Frame Range
```bash
npx remotion render HackathonDemo_Oern --frame-range 0 600
# Renders first 20 seconds only
```

### List All Compositions
```bash
npx remotion compositions
```

---

## 📊 Recommended Render Settings

### For Hackathon Pitch
```bash
npx remotion render HackathonDemo_Oern --quality=85 --concurrency=4
# Fast: ~90 seconds
# Good quality for projector
```

### For Social Media
```bash
npx remotion render HackathonDemo_Oern --codec=vp9 --quality=80
# WebM format, smaller file
# ~18 MB instead of 25 MB
```

### For Website
```bash
npx remotion render HackathonDemo_Oern --codec=vp9 --quality=75
# Optimized for web delivery
# ~12 MB WebM file
```

### For Archive/Backup
```bash
npx remotion render HackathonDemo_Oern --quality=100 --concurrency=4
# Best possible quality
# ~3 minutes to render
```

---

## 📹 File Location

After rendering, find your video at:
```
/Users/happer/Projects/oern/remotion-demo/out/HackathonDemo_Oern.mp4
```

Move it to:
```bash
# Copy to Desktop
cp out/HackathonDemo_Oern.mp4 ~/Desktop/

# Or your preferred location
cp out/HackathonDemo_Oern.mp4 /path/to/your/folder/
```

---

## 🚀 One-Liner Commands

### Setup + Render in One Go
```bash
cd /Users/happer/Projects/oern/remotion-demo && npm install && npx remotion render HackathonDemo_Oern
```

### Render and Copy to Desktop
```bash
npx remotion render HackathonDemo_Oern && cp out/HackathonDemo_Oern.mp4 ~/Desktop/
```

### Render High Quality to Desktop
```bash
npx remotion render HackathonDemo_Oern --quality=90 --concurrency=4 && cp out/HackathonDemo_Oern.mp4 ~/Desktop/oern-hackathon-demo.mp4
```

---

## ✅ Checklist

Before your hackathon pitch:

- [ ] Install dependencies: `npm install`
- [ ] Preview video: `npm run dev`
- [ ] Confirm composition works
- [ ] Render video: `npx remotion render HackathonDemo_Oern`
- [ ] Check output file exists
- [ ] Play video to verify quality
- [ ] Copy to presentation/USB drive
- [ ] Test playback on presentation device
- [ ] Backup to cloud storage

---

## 📚 More Info

- Full video guide: [HACKATHON_DEMO_VIDEO.md](./HACKATHON_DEMO_VIDEO.md)
- Remotion docs: https://remotion.dev/docs
- OERN product: [PRODUCT.md](./PRODUCT.md)
- Source code: [HackathonDemo_Oern.tsx](./remotion-demo/src/compositions/HackathonDemo_Oern.tsx)

---

**Ready? Let's render!** 🎬

```bash
npx remotion render HackathonDemo_Oern
```

Your 70-second hackathon demo will be ready in ~90 seconds! ⚡
