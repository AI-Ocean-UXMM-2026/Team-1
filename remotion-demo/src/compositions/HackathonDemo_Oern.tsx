import React from 'react';
import { Sequence, useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';

/**
 * OERN Hackathon Demo Video
 * 
 * A comprehensive explainer video showcasing the door-to-door delivery platform
 * Duration: 60 seconds
 * Features: Title, Problem, Solution, Key Features, CTA
 */

// ============= SCENE 1: TITLE SCREEN =============
const Scene1_Title = () => {
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

      {/* Tagline */}
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

// ============= SCENE 2: THE PROBLEM =============
const Scene2_Problem = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const problemsSlideIn = (index: number) =>
    interpolate(frame, [index * fps * 0.2, index * fps * 0.2 + fps * 0.3], [400, 0], {
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
          margin: '0 0 60px 0',
          textAlign: 'center',
        }}
      >
        The Problem
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 40, maxWidth: 900 }}>
        {[
          { icon: '❌', text: 'Customers have no idea where their parcel is' },
          { icon: '⏰', text: 'No real-time tracking or delivery updates' },
          { icon: '🚚', text: 'Drivers waste time planning routes manually' },
          { icon: '😰', text: 'Managers struggle to coordinate operations' },
        ].map((item, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 30,
              translate: `${problemsSlideIn(i)}px 0`,
              padding: 20,
              backgroundColor: '#ffffff',
              borderRadius: 16,
              border: '2px solid #e2e8f0',
            }}
          >
            <span style={{ fontSize: 48 }}>{item.icon}</span>
            <span style={{ fontSize: 28, color: '#172b4d', fontWeight: 600 }}>
              {item.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============= SCENE 3: THE SOLUTION =============
const Scene3_Solution = () => {
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
          margin: '0 0 60px 0',
          textAlign: 'center',
          opacity: solutionOpacity,
        }}
      >
        Our Solution
      </h2>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 30,
          maxWidth: 1000,
          width: '100%',
        }}
      >
        {[
          { icon: '📍', title: 'Live Tracking', desc: 'Real-time GPS location' },
          { icon: '⚡', title: 'Smart Routing', desc: 'AI-optimized delivery routes' },
          { icon: '👥', title: 'Unified Dashboard', desc: 'Managers, drivers, customers' },
          { icon: '💚', title: 'Energy Aware', desc: 'Battery & fuel optimization' },
        ].map((feature, i) => (
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
            }}
          >
            <div style={{ fontSize: 56, marginBottom: 20 }}>{feature.icon}</div>
            <h3 style={{ fontSize: 24, fontWeight: 700, color: '#ffffff', margin: 0 }}>
              {feature.title}
            </h3>
            <p style={{ fontSize: 16, color: '#94a3b8', margin: '12px 0 0 0' }}>
              {feature.desc}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============= SCENE 4: KEY FEATURES =============
const Scene4_Features = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const featureTranslate = (index: number) =>
    interpolate(frame, [index * fps * 0.2, index * fps * 0.2 + fps * 0.3], [-400, 0], {
      easing: Easing.out(Easing.quad),
      extrapolateRight: 'clamp',
    });

  const featureOpacity = (index: number) =>
    interpolate(frame, [index * fps * 0.2, index * fps * 0.2 + fps * 0.3], [0, 1], {
      easing: Easing.out(Easing.cubic),
      extrapolateRight: 'clamp',
    });

  const features = [
    {
      role: '👨‍💼 Manager',
      capabilities: ['Create & manage orders', 'Assign drivers', 'Monitor deliveries', 'View fleet'],
    },
    {
      role: '🏍️ Driver/Rider',
      capabilities: ['View tasks', 'Accept deliveries', 'Share location', 'Record COD'],
    },
    {
      role: '👤 Customer',
      capabilities: ['Track parcel', 'View ETA', 'See live location', 'Manage orders'],
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
          margin: '0 0 60px 0',
          textAlign: 'center',
        }}
      >
        Designed for Everyone
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 30, width: '100%', maxWidth: 1100 }}>
        {features.map((feature, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              gap: 40,
              padding: 30,
              backgroundColor: '#ffffff',
              borderRadius: 16,
              border: '3px solid #f97316',
              translate: `${featureTranslate(i)}px 0`,
              opacity: featureOpacity(i),
            }}
          >
            <div style={{ fontSize: 56, minWidth: 80, textAlign: 'center' }}>
              {feature.role.split(' ')[0]}
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: 24, fontWeight: 700, color: '#172b4d', margin: '0 0 15px 0' }}>
                {feature.role}
              </h3>
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
                      fontSize: 16,
                      color: '#475569',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <span style={{ color: '#f97316', fontWeight: 'bold' }}>✓</span>
                    {cap}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============= SCENE 5: TECH STACK =============
const Scene5_Tech = () => {
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
          margin: '0 0 60px 0',
          textAlign: 'center',
          translate: `0 ${titleSlideDown}px`,
        }}
      >
        Built with Modern Tech
      </h2>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 30,
          maxWidth: 1000,
          width: '100%',
        }}
      >
        {[
          { name: 'Next.js 16', icon: '⚛️' },
          { name: 'React 19', icon: '🎨' },
          { name: 'Supabase', icon: '🗄️' },
          { name: 'Mapbox', icon: '🗺️' },
          { name: 'TypeScript', icon: '📘' },
          { name: 'Real-time GPS', icon: '📍' },
        ].map((tech, i) => (
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
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 15 }}>{tech.icon}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#172b4d', textAlign: 'center' }}>
              {tech.name}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============= SCENE 6: IMPACT =============
const Scene6_Impact = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

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
          margin: '0 0 80px 0',
          textAlign: 'center',
        }}
      >
        The Impact
      </h2>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 50,
          maxWidth: 1000,
          width: '100%',
        }}
      >
        {[
          { number: '100%', label: 'Real-time Visibility' },
          { number: '40%', label: 'Faster Deliveries' },
          { number: '∞', label: 'Scalable Routes' },
          { number: '😊', label: 'Happy Customers' },
        ].map((stat, i) => (
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
            }}
          >
            <div
              style={{
                fontSize: 72,
                fontWeight: 900,
                color: '#f97316',
                margin: 0,
                lineHeight: 1,
              }}
            >
              {stat.number}
            </div>
            <div
              style={{
                fontSize: 20,
                color: '#ffffff',
                margin: '15px 0 0 0',
                textAlign: 'center',
                fontWeight: 600,
              }}
            >
              {stat.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============= SCENE 7: CALL TO ACTION =============
const Scene7_CTA = () => {
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
        <h2
          style={{
            fontSize: 56,
            fontWeight: 800,
            color: '#f97316',
            margin: '0 0 40px 0',
            textAlign: 'center',
          }}
        >
          Ready to Transform Deliveries?
        </h2>

        <p
          style={{
            fontSize: 28,
            color: '#ffffff',
            margin: '0 0 60px 0',
            textAlign: 'center',
            fontWeight: 300,
          }}
        >
          Join us in revolutionizing door-to-door delivery in Yangon
        </p>

        {/* CTA Button */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 30,
            marginBottom: 40,
          }}
        >
          <div
            style={{
              padding: '20px 60px',
              backgroundColor: '#f97316',
              color: '#ffffff',
              fontSize: 24,
              fontWeight: 700,
              borderRadius: 999,
              scale: pulseScale,
              textAlign: 'center',
              minWidth: 400,
            }}
          >
            Visit oern.app
          </div>
        </div>

        {/* Social Proof */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 20,
            marginTop: 60,
          }}
        >
          <span style={{ fontSize: 20, color: '#94a3b8' }}>📧 hello@oern.app</span>
          <span style={{ fontSize: 20, color: '#94a3b8' }}>|</span>
          <span style={{ fontSize: 20, color: '#94a3b8' }}>🌐 oern.app</span>
        </div>
      </div>
    </div>
  );
};

// ============= MAIN COMPOSITION =============
export const HackathonDemo_Oern = () => {
  const { fps } = useVideoConfig();

  const sceneDuration = fps * 10; // 10 seconds per scene
  const totalFrames = sceneDuration * 7; // 7 scenes

  return (
    <>
      <Sequence from={0} durationInFrames={sceneDuration}>
        <Scene1_Title />
      </Sequence>
      <Sequence from={sceneDuration} durationInFrames={sceneDuration}>
        <Scene2_Problem />
      </Sequence>
      <Sequence from={sceneDuration * 2} durationInFrames={sceneDuration}>
        <Scene3_Solution />
      </Sequence>
      <Sequence from={sceneDuration * 3} durationInFrames={sceneDuration}>
        <Scene4_Features />
      </Sequence>
      <Sequence from={sceneDuration * 4} durationInFrames={sceneDuration}>
        <Scene5_Tech />
      </Sequence>
      <Sequence from={sceneDuration * 5} durationInFrames={sceneDuration}>
        <Scene6_Impact />
      </Sequence>
      <Sequence from={sceneDuration * 6} durationInFrames={sceneDuration}>
        <Scene7_CTA />
      </Sequence>
    </>
  );
};
