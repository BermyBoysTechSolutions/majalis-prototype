import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = process.env.PERF_OUTPUT_DIR || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.performance');
await fs.mkdir(root, { recursive: true });
const label = process.argv[2] || 'profile';
const targets = await fetch(`http://127.0.0.1:${process.env.CDP_PORT || 9223}/json/list`).then(r => r.json());
const target = targets.find(t => t.type === 'page' && t.url.includes('majalis'));
if (!target) throw new Error('Native Chrome MAJALIS tab not found');
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve,reject) => {socket.onopen=resolve;socket.onerror=reject;});
let next=0;const pending=new Map();const listeners=new Map();
socket.onmessage=({data})=>{const message=JSON.parse(data);if(message.id){const p=pending.get(message.id);pending.delete(message.id);message.error?p.reject(message.error):p.resolve(message.result);}else for(const fn of listeners.get(message.method)||[])fn(message.params);};
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++next;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
const evaluate=async(expression)=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
await send('Page.enable');await send('Runtime.enable');await send('Page.bringToFront');
if(process.env.WIDTH){
  const width=Number(process.env.WIDTH),height=Number(process.env.HEIGHT),dpr=Number(process.env.DPR||1);
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:dpr,mobile:width<=700,screenWidth:width,screenHeight:height});
  await send('Emulation.setTouchEmulationEnabled',{enabled:width<=700,maxTouchPoints:5});
}
await send('Emulation.setCPUThrottlingRate',{rate:Number(process.env.CPU_RATE||1)});
if(process.env.RELOAD==='1'){await send('Page.reload',{ignoreCache:true});await wait(2000);}
await evaluate('document.fonts.ready.then(()=>true)');
await evaluate('document.documentElement.style.scrollBehavior="auto"');
const env=await evaluate('({url:location.href,width:innerWidth,height:innerHeight,dpr:devicePixelRatio,hidden:document.hidden,scrollTimeline:typeof ScrollTimeline,storyHeight:document.querySelector(".scroll-story").offsetHeight,scrollHeight:document.documentElement.scrollHeight})');
env.cpuRate=Number(process.env.CPU_RATE||1);
if(process.env.WIDTH && env.width!==Number(process.env.WIDTH))throw new Error('Viewport override failed');
const storyDistance=env.storyHeight-env.height;
const scenes=[
  {name:'hero',top:0,duration:4000},
  {name:'cards-scroll',top:storyDistance*.19,end:storyDistance*.52,duration:4000},
  {name:'outro-scroll',top:storyDistance*.80,end:storyDistance*1.025,duration:4000},
  {name:'about',selector:'.about-section',duration:4000},
  {name:'community',selector:'.community-section',duration:4000}
];
const results={label,environment:env,scenes:[]};
for(const scene of scenes){
  let top=scene.top;
  if(scene.selector)top=await evaluate(`document.querySelector('${scene.selector}').getBoundingClientRect().top+scrollY`);
  await evaluate(`window.scrollTo({top:${top},behavior:'instant'})`);await wait(900);
  const scrollStart=await evaluate('scrollY');
  const trace=[];listeners.set('Tracing.dataCollected',[p=>trace.push(...p.value)]);
  const tracingDone=new Promise(resolve=>listeners.set('Tracing.tracingComplete',[resolve]));
  await send('Tracing.start',{categories:'devtools.timeline,blink.user_timing,cc,benchmark',options:'record-as-much-as-possible',transferMode:'ReportEvents'});
  const probe=evaluate(`new Promise(resolve=>{const deltas=[],longTasks=[];let start=0,last=0;const obs=new PerformanceObserver(l=>longTasks.push(...l.getEntries().map(x=>x.duration)));obs.observe({type:'longtask'});function tick(t){if(!start)start=t;if(last)deltas.push(t-last);last=t;if(t-start<${scene.duration})requestAnimationFrame(tick);else{obs.disconnect();const sorted=[...deltas].sort((a,b)=>a-b);resolve({frames:deltas.length,elapsed:t-start,fps:deltas.length*1000/(t-start),median:sorted[Math.floor(sorted.length*.5)],p95:sorted[Math.floor(sorted.length*.95)],p99:sorted[Math.floor(sorted.length*.99)],max:Math.max(...deltas),over25ms:deltas.filter(d=>d>25).length,over50ms:deltas.filter(d=>d>50).length,longTasks,deltas});}}requestAnimationFrame(tick);})`);
  if(scene.end!==undefined){await send('Input.synthesizeScrollGesture',{x:Math.round(env.width*.8),y:Math.round(env.height*.6),yDistance:-(scene.end-top),speed:Math.round((scene.end-top)/(scene.duration/1000)),gestureSourceType:'touch',preventFling:true});}
  const samples=await probe;
  const scrollEnd=await evaluate('scrollY');
  await send('Tracing.end');await tracingDone;
  await fs.writeFile(path.join(root,`${label}-${scene.name}-trace.json`),JSON.stringify({traceEvents:trace}));
  const durations={};const counts={};for(const e of trace){counts[e.name]=(counts[e.name]||0)+1;if(e.ph==='X'&&e.dur)durations[e.name]=(durations[e.name]||0)+e.dur/1000;}
  const stats={};for(const name of ['Paint','Layout','UpdateLayoutTree','FunctionCall','FireAnimationFrame','DrawFrame','DroppedFrame','RasterTask','Animation','FrameSequenceTracker','FramePresented','PipelineReporter'])stats[name]={count:counts[name]||0,ms:durations[name]||0};
  const screenshot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await fs.writeFile(path.join(root,`${label}-${scene.name}.png`),Buffer.from(screenshot.data,'base64'));
  const result={scene:scene.name,scrollStart,scrollEnd,expectedStart:top,expectedEnd:scene.end??top,...samples,trace:stats};results.scenes.push(result);console.log(JSON.stringify({...result,deltas:undefined}));
}
await fs.writeFile(path.join(root,`${label}-results.json`),JSON.stringify(results,null,2));
console.log(JSON.stringify({environment:env,output:path.join(root,`${label}-results.json`)}));socket.close();
