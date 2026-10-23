import React,{type ReactNode}from'react';
import{AbsoluteFill,CanvasImage,Easing,Sequence,interpolate,staticFile,useCurrentFrame,useVideoConfig}from'remotion';

const c={navy:'#172b4d',stage:'#0d1c33',orange:'#c2410c',signal:'#f97316',blue:'#2563eb',bright:'#60a5fa',blueWash:'#dbeafe',green:'#16a34a',greenWash:'#dcfce7',amberWash:'#fef3c7',canvas:'#f8fafc',surface:'#fff',line:'#e2e8f0',slate:'#475569'};
const font='Inter, "Noto Sans Myanmar", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const ease=Easing.bezier(.16,1,.3,1);
const clamp={extrapolateLeft:'clamp' as const,extrapolateRight:'clamp' as const};
type Point={readonly x:number;readonly y:number};
type Target=Point&{readonly width:number;readonly height:number;readonly radius?:number};

const Focus=({target,at=12}:{readonly target:Target;readonly at?:number})=>{
 const f=useCurrentFrame(),opacity=interpolate(f,[at,at+10],[0,1],{...clamp,easing:ease}),scale=interpolate(f,[at,at+12],[1.08,1],{...clamp,easing:ease});
 return <div style={{position:'absolute',left:target.x-7,top:target.y-7,width:target.width+14,height:target.height+14,border:`4px dashed ${c.bright}`,borderRadius:target.radius??16,opacity,scale,boxShadow:'0 0 0 5px rgba(13,28,51,.34)',zIndex:30}}/>;
};
const Cursor=({from,to,clickAt}:{readonly from:Point;readonly to:Point;readonly clickAt:number})=>{
 const f=useCurrentFrame(),start=Math.max(0,clickAt-34),x=interpolate(f,[start,clickAt-5],[from.x,to.x],{...clamp,easing:ease}),y=interpolate(f,[start,clickAt-5],[from.y,to.y],{...clamp,easing:ease});
 const opacity=interpolate(f,[start,start+6,clickAt+16,clickAt+24],[0,1,1,0],clamp),pressed=interpolate(f,[clickAt-3,clickAt,clickAt+5],[1,.82,1],clamp),ro=interpolate(f,[clickAt,clickAt+18],[.9,0],clamp),rs=interpolate(f,[clickAt,clickAt+18],[.25,1.5],{...clamp,easing:ease});
 return <><div style={{position:'absolute',left:to.x,top:to.y,width:46,height:46,translate:'-50% -50%',borderRadius:999,border:`4px solid ${c.bright}`,opacity:ro,scale:rs,zIndex:39}}/><svg width="46" height="54" viewBox="0 0 46 54" style={{position:'absolute',left:x,top:y,opacity,scale:pressed,filter:'drop-shadow(0 3px 5px rgba(15,23,42,.45))',zIndex:40}}><path d="M5 3 38 31 23 34 16 49 5 3Z" fill="white" stroke="#0f172a" strokeWidth="4" strokeLinejoin="round"/></svg></>;
};
const RouteLine=()=> <svg width="1920" height="1080" viewBox="0 0 1920 1080" style={{position:'absolute',inset:0,opacity:.24}}><path d="M-90 918C280 840 420 960 720 720S1120 330 1510 390 1780 210 2020 80" fill="none" stroke={c.bright} strokeWidth="3" strokeDasharray="10 18"/><circle cx="720" cy="720" r="9" fill={c.bright}/><circle cx="1510" cy="390" r="11" fill={c.signal}/></svg>;
const Copy=({role,title,detail}:{readonly role:string;readonly title:string;readonly detail:string})=>{
 const f=useCurrentFrame(),opacity=interpolate(f,[8,20],[0,1],{...clamp,easing:ease}),x=interpolate(f,[8,20],[28,0],{...clamp,easing:ease});
 return <div style={{position:'absolute',left:900,top:310,width:700,color:'white',opacity,transform:`translateX(${x}px)`}}><div style={{display:'inline-flex',alignItems:'center',gap:10,padding:'8px 13px',borderRadius:999,background:'rgba(96,165,250,.14)',color:'#bfdbfe',fontSize:18,fontWeight:650}}><span style={{width:9,height:9,borderRadius:999,background:c.bright}}/>{role}</div><div style={{marginTop:24,fontSize:62,lineHeight:1.02,letterSpacing:'-.035em',fontWeight:760,maxWidth:650}}>{title}</div><div style={{marginTop:24,fontSize:26,lineHeight:1.45,color:'#cbd5e1',maxWidth:620}}>{detail}</div><div style={{marginTop:42,width:220,borderTop:`3px dashed ${c.bright}`}}/></div>;
};
const Phone=({children}:{readonly children:ReactNode})=>{
 const f=useCurrentFrame(),scale=interpolate(f,[0,20],[.985,1],{...clamp,easing:ease});
 return <div style={{position:'absolute',left:250,top:98,width:410,height:864,borderRadius:48,border:'10px solid #081120',overflow:'hidden',background:'white',boxShadow:'0 34px 90px rgba(0,0,0,.38)',scale}}><div style={{position:'absolute',top:10,left:'50%',translate:'-50% 0',width:108,height:24,borderRadius:999,background:'#081120',zIndex:50}}/>{children}</div>;
};
const MobileAction=({src,role,title,detail,target,clickAt}:{readonly src:string;readonly role:string;readonly title:string;readonly detail:string;readonly target:Target;readonly clickAt:number})=>{
 const{fps}=useVideoConfig(),to={x:target.x+target.width*.74,y:target.y+target.height*.55};
 return <AbsoluteFill style={{background:c.stage,fontFamily:font,overflow:'hidden'}}><RouteLine/><Phone><CanvasImage src={staticFile(src)} style={{position:'absolute',inset:0,width:390,height:844}}/><Focus target={target} at={Math.round(.7*fps)}/><Cursor from={{x:290,y:650}} to={to} clickAt={clickAt}/></Phone><Copy role={role} title={title} detail={detail}/></AbsoluteFill>;
};
const MobileResult=({children,role,title,detail,target}:{readonly children:ReactNode;readonly role:string;readonly title:string;readonly detail:string;readonly target:Target})=><AbsoluteFill style={{background:c.stage,fontFamily:font,overflow:'hidden'}}><RouteLine/><Phone>{children}<Focus target={target} at={18}/></Phone><Copy role={role} title={title} detail={detail}/></AbsoluteFill>;

const CustomerTrack=({delivered=false}:{readonly delivered?:boolean})=>{
 const f=useCurrentFrame(),{fps}=useVideoConfig(),p=delivered?1:interpolate(f,[0,7*fps],[.42,.78],{...clamp,easing:ease}),mx=72+230*p,my=395-122*p;
 return <div style={{position:'absolute',inset:0,width:390,height:844,background:c.canvas,color:c.navy}}>
  <header style={{height:104,padding:'42px 18px 12px',boxSizing:'border-box',background:'white',borderBottom:`1px solid ${c.line}`,display:'flex',alignItems:'center',justifyContent:'space-between'}}><div><div style={{fontSize:12,color:c.slate,fontWeight:650}}>ORDER</div><div style={{fontSize:18,fontWeight:750}}>OERN-33C1C0A6D6</div></div><div style={{padding:'7px 11px',borderRadius:999,background:delivered?c.greenWash:c.blueWash,color:delivered?'#166534':'#1d4ed8',fontWeight:700,fontSize:13}}>{delivered?'Delivered':'On the way'}</div></header>
  <div style={{position:'relative',height:374,overflow:'hidden',background:'#e9eef3'}}>
   {[0,1,2,3,4].map(i=><div key={`h${i}`} style={{position:'absolute',left:-40,right:-40,top:42+i*72,height:4,background:'white',rotate:i%2?'8deg':'-5deg'}}/>)}{[0,1,2].map(i=><div key={`v${i}`} style={{position:'absolute',top:-50,bottom:-50,left:72+i*112,width:4,background:'white',rotate:i%2?'-9deg':'6deg'}}/>)}
   <div style={{position:'absolute',left:62,top:284,width:270*p,height:8,borderRadius:999,background:c.blue,rotate:'-24deg',transformOrigin:'left center'}}/><div style={{position:'absolute',left:mx,top:my,width:28,height:28,borderRadius:999,background:delivered?c.green:c.navy,border:'6px solid white',boxShadow:'0 3px 14px rgba(23,43,77,.28)'}}/><div style={{position:'absolute',right:58,top:142,width:27,height:36,borderRadius:'16px 16px 16px 4px',background:c.signal,rotate:'-45deg',border:'5px solid white'}}/><div style={{position:'absolute',left:16,top:16,padding:'9px 12px',borderRadius:12,background:'rgba(255,255,255,.95)',fontSize:13,fontWeight:700,color:delivered?'#166534':'#1d4ed8'}}>{delivered?'Delivered 10:06 PM':'Live rider location'}</div>
  </div>
  <div style={{padding:18,background:'white'}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}><div><div style={{fontSize:12,color:c.slate,fontWeight:650}}>{delivered?'DELIVERED TO':'ARRIVING IN'}</div><div style={{fontSize:delivered?22:39,fontWeight:780,letterSpacing:'-.035em',marginTop:2}}>{delivered?'Botahtaung, Yangon':'13 min'}</div></div><div style={{textAlign:'right'}}><div style={{fontSize:12,color:c.slate}}>RIDER</div><b style={{fontSize:14}}>Oern Test Rider</b></div></div>
   <div style={{marginTop:17,paddingTop:15,borderTop:`1px solid ${c.line}`}}>{['Order confirmed','Picked up',delivered?'Delivered':'On the way'].map((label,i)=><div key={label} style={{display:'flex',gap:11,alignItems:'center',marginTop:i?11:0,fontSize:14,fontWeight:620}}><span style={{width:14,height:14,borderRadius:999,background:i===2&&!delivered?c.blue:c.green}}/>{label}</div>)}</div><div style={{marginTop:17,borderRadius:12,background:delivered?c.greenWash:c.amberWash,color:delivered?'#166534':'#92400e',padding:13,display:'flex',justifyContent:'space-between',fontSize:14}}><b>COD</b><span>{delivered?'Collected · MMK 500':'Due · MMK 500'}</span></div>
  </div>
  <nav style={{position:'absolute',left:0,right:0,bottom:0,height:66,borderTop:`1px solid ${c.line}`,background:'white',display:'grid',gridTemplateColumns:'repeat(4,1fr)',placeItems:'center',color:c.slate,fontSize:11}}><b style={{color:c.orange}}>Home</b><span>Orders</span><span>Pickup</span><span>Profile</span></nav>
 </div>;
};

const DesktopCallout=({target,title,side='right'}:{readonly target:Target;readonly title:string;readonly side?:'left'|'right'})=>{
 const f=useCurrentFrame(),opacity=interpolate(f,[12,24],[0,1],{...clamp,easing:ease}),left=side==='right'?Math.min(target.x+target.width+34,1510):Math.max(target.x-410,28),top=Math.max(28,Math.min(target.y-3,940));
 return <div style={{position:'absolute',left,top,display:'flex',alignItems:'center',gap:14,opacity,zIndex:35}}>{side==='right'?<div style={{width:48,borderTop:`3px dashed ${c.blue}`}}/>:null}<div style={{padding:'13px 17px',borderRadius:12,background:c.navy,color:'white',fontSize:20,fontWeight:650,boxShadow:'0 8px 24px rgba(15,23,42,.24)'}}>{title}</div>{side==='left'?<div style={{width:48,borderTop:`3px dashed ${c.blue}`}}/>:null}</div>;
};
const Desktop=({src,target,title,clickAt,cursorFrom,side}:{readonly src:string;readonly target:Target;readonly title:string;readonly clickAt?:number;readonly cursorFrom?:Point;readonly side?:'left'|'right'})=>{
 const to={x:target.x+target.width*.62,y:target.y+target.height*.52};
 return <AbsoluteFill style={{background:c.canvas,overflow:'hidden',fontFamily:font}}><CanvasImage src={staticFile(src)} style={{position:'absolute',left:0,top:-60,width:1920,height:1200}}/><div style={{position:'absolute',inset:0,boxShadow:'inset 0 0 90px rgba(15,23,42,.16)'}}/><Focus target={target}/><DesktopCallout target={target} title={title} side={side}/>{typeof clickAt==='number'?<Cursor from={cursorFrom??{x:1180,y:830}} to={to} clickAt={clickAt}/>:null}</AbsoluteFill>;
};

export const HackathonDemo_Oern_Enhanced=()=>{
 const{fps}=useVideoConfig();
 return <AbsoluteFill>
  <Sequence name="Customer taps tracking" from={0} durationInFrames={6*fps}><MobileAction src="captures/customer-home.png" role="Customer app" title="Tap Track order" detail="Open one delivery directly from the authenticated home screen." target={{x:231,y:438,width:127,height:52,radius:999}} clickAt={4*fps}/></Sequence>
  <Sequence name="Customer sees live delivery" from={6*fps} durationInFrames={8*fps}><MobileResult role="Customer tracking" title="See the rider move" detail="Live location and ETA update while COD stays a separate payment state." target={{x:12,y:116,width:206,height:56,radius:12}}><CustomerTrack/></MobileResult></Sequence>
  <Sequence name="Rider opens active route" from={14*fps} durationInFrames={7*fps}><MobileAction src="captures/rider-jobs.png" role="Rider app" title="Open the active route" detail="The rider resumes the job already in progress before taking another." target={{x:312,y:92,width:66,height:60,radius:12}} clickAt={4*fps}/></Sequence>
  <Sequence name="Rider confirms arrival" from={21*fps} durationInFrames={11*fps}><MobileAction src="captures/rider-active.png" role="Rider navigation" title="Confirm arrival" detail="The next stop, due time and contact actions stay above one clear completion control." target={{x:16,y:780,width:358,height:56,radius:999}} clickAt={7*fps}/></Sequence>
  <Sequence name="Manager opens automation" from={32*fps} durationInFrames={10*fps}><Desktop src="captures/manager-overview.png" target={{x:16,y:325,width:286,height:49,radius:12}} title="Open task automation" clickAt={7*fps} cursorFrom={{x:920,y:690}}/></Sequence>
  <Sequence name="Manager switches to live tracking" from={42*fps} durationInFrames={10*fps}><Desktop src="captures/manager-jobs.png" target={{x:16,y:105,width:286,height:48,radius:12}} title="Switch to live tracking" clickAt={7*fps} cursorFrom={{x:1140,y:540}}/></Sequence>
  <Sequence name="Manager opens fleet" from={52*fps} durationInFrames={11*fps}><Desktop src="captures/manager-live-track.png" target={{x:16,y:377,width:286,height:48,radius:12}} title="Open fleet readiness" clickAt={8*fps} cursorFrom={{x:1320,y:690}}/></Sequence>
  <Sequence name="Manager checks vehicles" from={63*fps} durationInFrames={7*fps}><Desktop src="captures/manager-vehicles.png" target={{x:362,y:220,width:1516,height:98,radius:16}} title="Availability before assignment" side="left"/></Sequence>
  <Sequence name="Customer sees completion" from={70*fps} durationInFrames={8*fps}><MobileResult role="Customer tracking" title="Delivery complete" detail="Delivered and COD Collected close as separate outcomes." target={{x:16,y:679,width:358,height:50,radius:12}}><CustomerTrack delivered/></MobileResult></Sequence>
 </AbsoluteFill>;
};
