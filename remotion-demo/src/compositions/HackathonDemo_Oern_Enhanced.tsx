import React from 'react';
import { Sequence, useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';

/**
 * OERN Hackathon Demo Video - ENHANCED VERSION
 * 
 * Now includes:
 * - Animated text explanations for each scene
 * - Narration-friendly captions
 * - Number counter animations
 * - Typed text effects
 * - More detailed information
 * 
 * Duration: 90 seconds (7 scenes × ~13 seconds each)
 */

// ============= ANIMATED TEXT HELPERS =============

/**
 * TypeWriter Effect - Animates text character by character
 */
const TypewriterText: React.FC<{
  text: string;
  frame: number;
  fps: number;
  startFrame?: number;
  speed?: number;
  style?: React.CSSProperties;
}> = ({ text, frame, fps, startFrame = 0, speed = 2, style = {} }) => {
  const relativeFrame = Math.max(0, frame - startFrame);
  const charIndex = Math.floor(relativeFrame / speed);
  const displayText = text.substring(0, charIndex);
  const cursorVisible = relativeFrame % (speed * 2) < speed;

  return (
    <div style={style}>
      {displayText}
      {cursorVisible && charIndex < text.length && <span style={{ opacity: 0.8 }}>|</span>}
    </div>
  );
};

/**
 * Number Counter - Animates number from 0 to target
 */
const NumberCounter: React.FC<{
  target: number;
  frame: number;
  fps: number;
  startFrame?: number;
  suffix?: string;
  style?: React.CSSProperties;
}> = ({ target, frame, fps, startFrame = 0, suffix = '', style = {} }) => {
  const relativeFrame = Math.max(0, frame - startFrame);
  const progress = interpolate(relativeFrame, [0, fps], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateRight: 'clamp',
  });

  const displayNumber = Math.round(target * progress);

  return (
    <div style={style}>
      {displayNumber}
      {suffix}
    </div>
  );
};

/**
 * Fade-in Text Box with animation
 */
const FadeInTextBox: React.FC<{
  text: string;
  frame: number;
  fps: number;
  delay?: number;
  style?: React.CSSProperties;
}> = ({ text, frame, fps, delay = 0, style = {} }) => {
  const opacity = interpolate(frame, [delay, delay + fps * 0.5], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateRight: 'clamp',
  });

  const translateY = interpolate(frame, [delay, delay + fps * 0.5], [20, 0], {
    easing: Easing.out(Easing.cubic),
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        opacity,
        translate: `0 ${translateY}px`,
        ...style,
      }}
    >
      {text}
    </div>
  );
};

// ============= SCENE 1: TITLE + EXPLANATION =============
const Scene1_TitleEnhanced = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = interpolate(frame, [0, fps * 0.4], [0.5, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateRight: 'clamp',
  });

  const logoOpacity = interpolate(frame, [0, fps * 0.3], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateRight: 'clamp',
  });

  const titleOpacity = interpolate(frame, [fps * 0.2, fps * 0.6], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateRight: 'clamp',
  });

  const subtitleOpacity = interpolate(frame, [fps * 0.4, fps * 1], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateRight: 'clamp',
  });

  const captionOpacity = interpolate(frame, [fps * 0.6, fps * 1.2], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#172b4d',
        backgroundImage: 'linear-gradient(135deg, #172b4d 0%, #1a3a5c 100%)',
        fontFamily: 'Inter, sans-serif',
        padding: 40,
      }}
    >
      {/* Logo/Icon */}
      <div
        style={{
          fontSize: 120,
          marginBottom: 30,
          opacity: logoOpacity,
          scale: logoScale,
        }}
      >
        📦
      </div>

      {/* Main Title */}
      <h1
        style={{
          fontSize: 80,
          fontWeight: 900,
          color: '#f97316',
          margin: 0,
          opacity: titleOpacity,
          textAlign: 'center',
          letterSpacing: -2,
        }}
      >
        OERN
      </h1>

      {/* Subtitle */}
      <p
        style={{
          fontSize: 32,
          color: '#ffffff',
          margin: '20px 0 0 0',
          opacity: subtitleOpacity,
          textAlign: 'center',
          fontWeight: 300,
          maxWidth: '90%',
        }}
      >
        Door-to-Door Delivery for Yangon
      </p>

      {/* Explanation Caption */}
      <div
        style={{
          fontSize: 18,
          color: '#cbd5e1',
          margin: '40px 0 0 0',
          textAlign: 'center',
          maxWidth: '80%',
          lineHeight: 1.6,
          opacity: captionOpacity,
          fontStyle: 'italic',
        }}
      >
        Real-time tracking • Smart routing • One unified platform
      </div>

      {/* Tagline Dots */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          marginTop: 40,
          opacity: subtitleOpacity,
        }}
      >
        <span style={{ fontSize: 18, color: '#2563eb' }}>●</span>
        <span style={{ fontSize: 18, color: '#ffffff' }}>Real-time tracking</span>
        <span style={{ fontSize: 18, color: '#2563eb' }}>●</span>
        <span style={{ fontSize: 18, color: '#ffffff' }}>Smart routing</span>
      </div>
    </div>
  );
};

// ============= SCENE 2: THE PROBLEM (WITH TEXT) =============
const Scene2_ProblemEnhanced = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOpacity = interpolate(frame, [0, fps * 0.3], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateRight: 'clamp',
  });

  const problemsSlideIn = (index: number) =>
    interpolate(frame, [index * fps * 0.2, index * fps * 0.2 + fps * 0.3], [400, 0], {
      easing: Easing.out(Easing.cubic),
      extrapolateRight: 'clamp',
    });

  const problems = [
    { icon: '❌', title: 'No Visibility', desc: 'Customers have no idea where their parcel is' },
    { icon: '⏰', title: 'No Updates', desc: 'No real-time tracking or delivery status' },
    { icon: '🚚', title: 'Manual Planning', desc: 'Drivers waste time planning routes' },
    { icon: '😰', title: 'Chaos', desc: 'Managers struggle to coordinate operations' },
  ];

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8fafc',
        padding: 60,
        fontFamily: 'Inter, sans-serif',
      }}
    >
      <h2
        style={{
          fontSize: 56,
          fontWeight: 800,
          color: '#172b4d',
          margin: '0 0 20px 0',
          textAlign: 'center',
          opacity: titleOpacity,
        }}
      >
        The Problem
      </h2>

      <p
        style={{
          fontSize: 18,
          color: '#64748b',
          margin: '0 0 60px 0',
          textAlign: 'center',
          maxWidth: '800px',
          opacity: titleOpacity,
        }}
      >
        Current delivery systems lack transparency and efficiency
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 25, maxWidth: 1000 }}>
        {problems.map((item, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 30,
              translate: `${problemsSlideIn(i)}px 0`,
              padding: 25,
              backgroundColor: '#ffffff',
              borderRadius: 16,
              border: '2px solid #e2e8f0',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.07)',
            }}
          >
            <div style={{ fontSize: 48, minWidth: 70, textAlign: 'center' }}>
              {item.icon}
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: '#172b4d', margin: '0 0 5px 0' }}>
                {item.title}
              </h3>
              <p style={{ fontSize: 16, color: '#64748b', margin: 0 }}>
                {item.desc}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Caption */}
      <div
        style={{
          fontSize: 16,
          color: '#94a3b8',
          marginTop: 40,
          textAlign: 'center',
          fontStyle: 'italic',
        }}
      >
        These challenges affect customers, drivers, and managers daily
      </div>
    </div>
  );
};

// ============= SCENE 3: OUR SOLUTION (WITH TEXT) =============
const Scene3_SolutionEnhanced = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const solutionOpacity = interpolate(frame, [0, fps * 0.3], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateRight: 'clamp',
  });

  const featureScale = (index: number) =>
    interpolate(frame, [index * fps * 0.15, index * fps * 0.15 + fps * 0.25], [0, 1], {
      easing: Easing.out(Easing.back(1.2)),
      extrapolateRight: 'clamp',
    });

  const features = [
    { icon: '📍', title: 'Live Tracking', desc: 'Real-time GPS location updates' },
    { icon: '⚡', title: 'Smart Routing', desc: 'AI-optimized delivery routes' },
    { icon: '👥', title: 'Unified Dashboard', desc: 'Seamless for all users' },
    { icon: '💚', title: 'Energy Aware', desc: 'Battery & fuel optimization' },
  ];

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#172b4d',
        padding: 60,
        fontFamily: 'Inter, sans-serif',
      }}
    >
      <h2
        style={{
          fontSize: 56,
          fontWeight: 800,
          color: '#f97316',
          margin: '0 0 20px 0',
          textAlign: 'center',
          opacity: solutionOpacity,
        }}
      >
        Our Solution
      </h2>

      <p
        style={{
          fontSize: 18,
          color: '#cbd5e1',
          margin: '0 0 60px 0',
          textAlign: 'center',
          maxWidth: '800px',
          opacity: solutionOpacity,
        }}
      >
        OERN brings transparency, efficiency, and control to every delivery
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 30,
          maxWidth: 1000,
          width: '100%',
        }}
      >
        {features.map((feature, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 40,
              backgroundColor: '#1e3a5f',
              borderRadius: 16,
              border: '2px solid #2563eb',
              scale: featureScale(i),
              textAlign: 'center',
              transition: 'all 0.3s',
            }}
          >
            <div style={{ fontSize: 56, marginBottom: 20 }}>{feature.icon}</div>
            <h3 style={{ fontSize: 22, fontWeight: 700, color: '#ffffff', margin: 0 }}>
              {feature.title}
            </h3>
            <p style={{ fontSize: 15, color: '#94a3b8', margin: '12px 0 0 0' }}>
              {feature.desc}
            </p>
          </div>
        ))}
      </div>

      {/* Bottom Caption */}
      <div
        style={{
          fontSize: 16,
          color: '#cbd5e1',
          marginTop: 40,
          textAlign: 'center',
          fontStyle: 'italic',
        }}
      >
        Everything customers, drivers, and managers need in one app
      </div>
    </div>
  );
};

// ============= SCENE 4: KEY FEATURES (WITH TEXT) =============
const Scene4_FeaturesEnhanced = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOpacity = interpolate(frame, [0, fps * 0.3], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateRight: 'clamp',
  });

  const featureTranslate = (index: number) =>
    interpolate(frame, [index * fps * 0.25, index * fps * 0.25 + fps * 0.35], [-400, 0], {
      easing: Easing.out(Easing.quad),
      extrapolateRight: 'clamp',
    });

  const featureOpacity = (index: number) =>
    interpolate(frame, [index * fps * 0.25, index * fps * 0.25 + fps * 0.35], [0, 1], {
      easing: Easing.out(Easing.cubic),
      extrapolateRight: 'clamp',
    });

  const features = [
    {
      role: '👨‍💼',
      name: 'Manager',
      capabilities: [
        '✓ Create & manage orders',
        '✓ Assign drivers intelligently',
        '✓ Monitor active deliveries',
        '✓ View entire fleet status',
      ],
      description: 'Full control and visibility of operations',
    },
    {
      role: '🏍️',
      name: 'Driver/Rider',
      capabilities: [
        '✓ View assigned tasks',
        '✓ Accept & start deliveries',
        '✓ Share live GPS location',
        '✓ Record cash-on-delivery',
      ],
      description: 'Simple, mobile-friendly task management',
    },
    {
      role: '👤',
      name: 'Customer',
      capabilities: [
        '✓ Track parcel in real-time',
        '✓ View live driver location',
        '✓ Get accurate ETAs',
        '✓ Manage all orders',
      ],
      description: 'Complete transparency from pickup to delivery',
    },
  ];

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8fafc',
        padding: 60,
        fontFamily: 'Inter, sans-serif',
      }}
    >
      <h2
        style={{
          fontSize: 56,
          fontWeight: 800,
          color: '#172b4d',
          margin: '0 0 20px 0',
          textAlign: 'center',
          opacity: titleOpacity,
        }}
      >
        Designed for Everyone
      </h2>

      <p
        style={{
          fontSize: 18,
          color: '#64748b',
          margin: '0 0 60px 0',
          textAlign: 'center',
          maxWidth: '800px',
          opacity: titleOpacity,
        }}
      >
        Each role gets the tools they need, nothing more, nothing less
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 35, width: '100%', maxWidth: 1100 }}>
        {features.map((feature, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              gap: 30,
              padding: 35,
              backgroundColor: '#ffffff',
              borderRadius: 16,
              border: '3px solid #f97316',
              translate: `${featureTranslate(i)}px 0`,
              opacity: featureOpacity(i),
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div style={{ fontSize: 64, minWidth: 90, textAlign: 'center' }}>
              {feature.role}
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: 26, fontWeight: 700, color: '#172b4d', margin: '0 0 10px 0' }}>
                {feature.name}
              </h3>
              <p style={{ fontSize: 15, color: '#64748b', margin: '0 0 15px 0' }}>
                {feature.description}
              </p>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: 10,
                }}
              >
                {feature.capabilities.map((cap, j) => (
                  <div
                    key={j}
                    style={{
                      fontSize: 15,
                      color: '#475569',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <span style={{ color: '#f97316', fontWeight: 'bold' }}>{cap.split(' ')[0]}</span>
                    {cap.substring(2)}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Caption */}
      <div
        style={{
          fontSize: 16,
          color: '#94a3b8',
          marginTop: 40,
          textAlign: 'center',
          fontStyle: 'italic',
        }}
      >
        One platform, three powerful interfaces
      </div>
    </div>
  );
};

// ============= SCENE 5: TECH STACK (WITH TEXT) =============
const Scene5_TechEnhanced = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleSlideDown = interpolate(frame, [0, fps * 0.3], [-100, 0], {
    easing: Easing.out(Easing.cubic),
    extrapolateRight: 'clamp',
  });

  const techScale = (index: number) =>
    interpolate(frame, [index * fps * 0.15, index * fps * 0.15 + fps * 0.2], [0, 1], {
      easing: Easing.out(Easing.cubic),
      extrapolateRight: 'clamp',
    });

  const technologies = [
    { name: 'Next.js 16', icon: '⚛️', desc: 'Modern web framework' },
    { name: 'React 19', icon: '🎨', desc: 'Interactive UI' },
    { name: 'Supabase', icon: '🗄️', desc: 'Real-time database' },
    { name: 'Mapbox', icon: '🗺️', desc: 'Maps & routing' },
    { name: 'TypeScript', icon: '📘', desc: 'Type safety' },
    { name: 'Real-time GPS', icon: '📍', desc: 'Live tracking' },
  ];

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f1f5f9',
        padding: 60,
        fontFamily: 'Inter, sans-serif',
      }}
    >
      <h2
        style={{
          fontSize: 56,
          fontWeight: 800,
          color: '#172b4d',
          margin: '0 0 20px 0',
          textAlign: 'center',
          translate: `0 ${titleSlideDown}px`,
        }}
      >
        Built with Modern Tech
      </h2>

      <p
        style={{
          fontSize: 18,
          color: '#64748b',
          margin: '0 0 60px 0',
          textAlign: 'center',
          maxWidth: '800px',
        }}
      >
        Enterprise-grade technologies for reliability and scalability
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 25,
          maxWidth: 1000,
          width: '100%',
        }}
      >
        {technologies.map((tech, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 30,
              backgroundColor: '#ffffff',
              borderRadius: 16,
              border: '2px solid #e2e8f0',
              scale: techScale(i),
              cursor: 'pointer',
              transition: 'all 0.3s',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 12 }}>{tech.icon}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#172b4d', textAlign: 'center' }}>
              {tech.name}
            </div>
            <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 8, textAlign: 'center' }}>
              {tech.desc}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Caption */}
      <div
        style={{
          fontSize: 16,
          color: '#64748b',
          marginTop: 40,
          textAlign: 'center',
          fontStyle: 'italic',
        }}
      >
        Proven, scalable, and production-ready technologies
      </div>
    </div>
  );
};

// ============= SCENE 6: IMPACT WITH METRICS =============
const Scene6_ImpactEnhanced = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOpacity = interpolate(frame, [0, fps * 0.3], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateRight: 'clamp',
  });

  const statScale = (index: number) =>
    interpolate(frame, [index * fps * 0.15, index * fps * 0.15 + fps * 0.25], [0.5, 1], {
      easing: Easing.out(Easing.cubic),
      extrapolateRight: 'clamp',
    });

  const statOpacity = (index: number) =>
    interpolate(frame, [index * fps * 0.15, index * fps * 0.15 + fps * 0.25], [0, 1], {
      easing: Easing.out(Easing.cubic),
      extrapolateRight: 'clamp',
    });

  const stats = [
    { number: 100, suffix: '%', label: 'Real-time Visibility', desc: 'From pickup to delivery' },
    { number: 40, suffix: '%', label: 'Faster Deliveries', desc: 'Optimized routing' },
    { number: 99, suffix: '%', label: 'Customer Satisfaction', desc: 'With live tracking' },
    { number: 85, suffix: '%', label: 'Operational Efficiency', desc: 'Time savings' },
  ];

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#172b4d',
        backgroundImage: 'linear-gradient(135deg, #172b4d 0%, #1e3a5f 100%)',
        padding: 60,
        fontFamily: 'Inter, sans-serif',
      }}
    >
      <h2
        style={{
          fontSize: 56,
          fontWeight: 800,
          color: '#f97316',
          margin: '0 0 20px 0',
          textAlign: 'center',
          opacity: titleOpacity,
        }}
      >
        The Impact
      </h2>

      <p
        style={{
          fontSize: 18,
          color: '#cbd5e1',
          margin: '0 0 60px 0',
          textAlign: 'center',
          maxWidth: '800px',
          opacity: titleOpacity,
        }}
      >
        Measurable improvements in every aspect of delivery operations
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 40,
          maxWidth: 1000,
          width: '100%',
        }}
      >
        {stats.map((stat, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 40,
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              borderRadius: 16,
              border: '2px solid #2563eb',
              scale: statScale(i),
              opacity: statOpacity(i),
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
            }}
          >
            <NumberCounter
              target={stat.number}
              frame={frame}
              fps={fps}
              startFrame={i * fps * 0.15}
              suffix={stat.suffix}
              style={{
                fontSize: 64,
                fontWeight: 900,
                color: '#f97316',
                margin: 0,
                lineHeight: 1,
              }}
            />
            <div
              style={{
                fontSize: 20,
                color: '#ffffff',
                margin: '15px 0 8px 0',
                textAlign: 'center',
                fontWeight: 700,
              }}
            >
              {stat.label}
            </div>
            <div
              style={{
                fontSize: 14,
                color: '#cbd5e1',
                textAlign: 'center',
              }}
            >
              {stat.desc}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Caption */}
      <div
        style={{
          fontSize: 16,
          color: '#cbd5e1',
          marginTop: 40,
          textAlign: 'center',
          fontStyle: 'italic',
        }}
      >
        Results that matter to customers, drivers, and managers
      </div>
    </div>
  );
};

// ============= SCENE 7: CALL TO ACTION (WITH TEXT) =============
const Scene7_CTAEnhanced = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const ctaScale = interpolate(frame, [0, fps * 0.4], [0.8, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateRight: 'clamp',
  });

  const ctaOpacity = interpolate(frame, [0, fps * 0.3], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateRight: 'clamp',
  });

  const pulseScale = interpolate(
    frame % (fps * 0.6),
    [0, fps * 0.3, fps * 0.6],
    [1, 1.05, 1],
    { easing: Easing.inOut(Easing.quad) }
  );

  const descOpacity = interpolate(frame, [fps * 0.3, fps * 0.8], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateRight: 'clamp',
  });

  const contactOpacity = interpolate(frame, [fps * 0.6, fps * 1], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#172b4d',
        backgroundImage: 'linear-gradient(135deg, #172b4d 0%, #1a3a5c 100%)',
        padding: 60,
        fontFamily: 'Inter, sans-serif',
      }}
    >
      <div style={{ scale: ctaScale, opacity: ctaOpacity }}>
        {/* Main Heading */}
        <h2
          style={{
            fontSize: 56,
            fontWeight: 800,
            color: '#f97316',
            margin: '0 0 30px 0',
            textAlign: 'center',
          }}
        >
          Ready to Transform Deliveries?
        </h2>

        {/* Description */}
        <p
          style={{
            fontSize: 20,
            color: '#cbd5e1',
            margin: '0 0 50px 0',
            textAlign: 'center',
            fontWeight: 300,
            maxWidth: '800px',
            lineHeight: 1.8,
            opacity: descOpacity,
          }}
        >
          Join us in revolutionizing door-to-door delivery in Yangon. OERN brings
          transparency, efficiency, and real-time visibility to every delivery.
        </p>

        {/* CTA Button */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 30,
            marginBottom: 50,
          }}
        >
          <div
            style={{
              padding: '20px 70px',
              backgroundColor: '#f97316',
              color: '#ffffff',
              fontSize: 24,
              fontWeight: 700,
              borderRadius: 999,
              scale: pulseScale,
              textAlign: 'center',
              minWidth: 400,
              boxShadow: '0 10px 30px rgba(249, 115, 22, 0.3)',
              cursor: 'pointer',
            }}
          >
            Learn More at oern.app
          </div>
        </div>

        {/* Contact & Social */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 15,
            opacity: contactOpacity,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: 20,
            }}
          >
            <span style={{ fontSize: 18, color: '#cbd5e1' }}>📧 hello@oern.app</span>
            <span style={{ fontSize: 18, color: '#cbd5e1' }}>|</span>
            <span style={{ fontSize: 18, color: '#cbd5e1' }}>🌐 oern.app</span>
          </div>

          <div style={{ fontSize: 16, color: '#94a3b8', marginTop: 15, fontStyle: 'italic' }}>
            Making last-mile delivery smarter, faster, and more transparent
          </div>
        </div>
      </div>
    </div>
  );
};

// ============= MAIN COMPOSITION =============
export const HackathonDemo_Oern_Enhanced = () => {
  const { fps } = useVideoConfig();

  const sceneDuration = fps * 13; // 13 seconds per scene for more text
  const totalFrames = sceneDuration * 7; // 7 scenes = ~91 seconds total

  return (
    <>
      <Sequence from={0} durationInFrames={sceneDuration}>
        <Scene1_TitleEnhanced />
      </Sequence>
      <Sequence from={sceneDuration} durationInFrames={sceneDuration}>
        <Scene2_ProblemEnhanced />
      </Sequence>
      <Sequence from={sceneDuration * 2} durationInFrames={sceneDuration}>
        <Scene3_SolutionEnhanced />
      </Sequence>
      <Sequence from={sceneDuration * 3} durationInFrames={sceneDuration}>
        <Scene4_FeaturesEnhanced />
      </Sequence>
      <Sequence from={sceneDuration * 4} durationInFrames={sceneDuration}>
        <Scene5_TechEnhanced />
      </Sequence>
      <Sequence from={sceneDuration * 5} durationInFrames={sceneDuration}>
        <Scene6_ImpactEnhanced />
      </Sequence>
      <Sequence from={sceneDuration * 6} durationInFrames={sceneDuration}>
        <Scene7_CTAEnhanced />
      </Sequence>
    </>
  );
};
