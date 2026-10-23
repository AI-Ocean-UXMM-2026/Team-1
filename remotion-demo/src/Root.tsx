import React from 'react';
import { Composition } from 'remotion';
import { Demo1BasicAnimation } from './compositions/Demo1_BasicAnimation';
import { Demo2MultiScene } from './compositions/Demo2_MultiScene';
import { Demo3TextAnimation } from './compositions/Demo3_TextAnimation';
import { Demo4GridAnimation } from './compositions/Demo4_GridAnimation';
import { Demo5Parametrized, parametrizationSchema } from './compositions/Demo5_Parametrized';
import { DemoShowcase } from './compositions/Demo_Showcase';
import { HackathonDemo_Oern } from './compositions/HackathonDemo_Oern';

export const Root = () => {
  return (
    <>
      {/* Demo 1: Basic Animation with Fade and Bounce */}
      <Composition
        id="Demo1_BasicAnimation"
        component={Demo1BasicAnimation}
        durationInFrames={150}
        fps={30}
        width={1280}
        height={720}
        defaultProps={{}}
      />

      {/* Demo 2: Multi-Scene Video with Sequencing */}
      <Composition
        id="Demo2_MultiScene"
        component={Demo2MultiScene}
        durationInFrames={270}
        fps={30}
        width={1280}
        height={720}
        defaultProps={{}}
      />

      {/* Demo 3: Text Animation and Typography */}
      <Composition
        id="Demo3_TextAnimation"
        component={Demo3TextAnimation}
        durationInFrames={150}
        fps={30}
        width={1280}
        height={720}
        defaultProps={{}}
      />

      {/* Demo 4: Grid Animation for Data Visualization */}
      <Composition
        id="Demo4_GridAnimation"
        component={Demo4GridAnimation}
        durationInFrames={180}
        fps={30}
        width={1280}
        height={720}
        defaultProps={{}}
      />

      {/* Demo 5: Parametrized Video with Dynamic Content */}
      <Composition
        id="Demo5_Parametrized"
        component={Demo5Parametrized}
        durationInFrames={90}
        fps={30}
        width={1280}
        height={720}
        schema={parametrizationSchema}
        defaultProps={{
          title: 'Remotion Magic',
          bgColor: '#667eea',
          textColor: '#ffffff',
          duration: 3,
        }}
      />

      {/* Best Practices Showcase - 60 second demo video */}
      <Composition
        id="DemoShowcase_1Min"
        component={DemoShowcase}
        durationInFrames={1800}
        fps={30}
        width={1280}
        height={720}
        defaultProps={{
          title: 'Remotion Best Practices',
          bgColor: '#667eea',
        }}
      />

      {/* OERN Hackathon Demo - 70 second explainer video */}
      <Composition
        id="HackathonDemo_Oern"
        component={HackathonDemo_Oern}
        durationInFrames={2100}
        fps={30}
        width={1280}
        height={720}
        defaultProps={{}}
      />
    </>
  );
};
