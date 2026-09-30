import { clock } from './playback';
import { validateClip, download } from './clips';
export async function exportWebM(match,clip,{signal,onProgress=()=>{}}={}) {
  validateClip(clip.start,clip.end,match.duration);
  if(clock.exporting)throw new Error('An export is already running.');
  if(!clock.canvas?.captureStream||typeof MediaRecorder==='undefined')throw new Error('WebM recording is unavailable. Download the portable JSON clip instead.');
  const mime=['video/webm;codecs=vp8','video/webm;codecs=vp9','video/webm'].find(type=>MediaRecorder.isTypeSupported(type));
  if(!mime)throw new Error('This browser has no WebM encoder. Download the portable JSON clip instead.');
  const saved={time:clock.time,playing:clock.playing,speed:clock.speed,range:clock.range,loop:clock.loop};
  let stream,recorder,capture;
  try {
    clock.exporting=true;clock.playing=false;clock.time=clip.start;clock.range={start:clip.start,end:clip.end};clock.loop=false;clock.speed=1;clock.revision++;
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    if(signal?.aborted)throw new DOMException('Export cancelled.','AbortError');
    // Copy to a 2D recording surface: direct WebGL capture can yield empty
    // streams on software-backed renderers even when captureStream exists.
    const source=clock.canvas;capture=document.createElement('canvas');capture.width=source.width;capture.height=source.height;
    capture.style.cssText='position:fixed;left:-10000px;top:0;width:1px;height:1px;pointer-events:none';document.body.append(capture);
    const context=capture.getContext('2d');if(!context)throw new Error('A recording surface could not be created.');
    context.drawImage(source,0,0);stream=capture.captureStream(0);const track=stream.getVideoTracks()[0];if(!track.requestFrame)throw new Error('Manual canvas recording is unavailable. Download a portable clip instead.');recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:8_000_000});const chunks=[];
    const blob=await new Promise((resolve,reject)=>{
      let raf,finished=false,timer;const cleanup=()=>{cancelAnimationFrame(raf);clearTimeout(timer);signal?.removeEventListener('abort',cancel);document.removeEventListener('visibilitychange',visibility);};
      const cancel=()=>{if(finished)return;finished=true;cleanup();if(recorder.state!=='inactive')recorder.stop();reject(new DOMException('Export cancelled.','AbortError'));};
      const visibility=()=>{if(document.hidden)cancel();};
      recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.onerror=e=>{finished=true;cleanup();reject(e.error||new Error('Encoder failed.'));};recorder.onstop=()=>{cleanup();if(!finished){finished=true;resolve(new Blob(chunks,{type:mime}));}};
      signal?.addEventListener('abort',cancel,{once:true});document.addEventListener('visibilitychange',visibility);
      recorder.start(100);clock.playing=true;timer=setTimeout(cancel,30000);
      const started=performance.now();track.requestFrame();
      function monitor(){if(finished)return;context.drawImage(source,0,0);/* Flush deferred 2D drawing before requesting an encoder frame. */context.getImageData(0,0,1,1);track.requestFrame();const elapsed=(performance.now()-started)/1000;clock.time=Math.min(clip.end,clip.start+elapsed);onProgress(Math.min(1,elapsed/(clip.end-clip.start)));if(clock.time>=clip.end-1e-6){clock.playing=false;setTimeout(()=>{if(!finished&&recorder.state!=='inactive')recorder.stop();},100);}else raf=requestAnimationFrame(monitor);}raf=requestAnimationFrame(monitor);
    });
    if(!blob.size)throw new Error('The encoder produced an empty video.');
    download(blob,'touchline-clip.webm');return blob;
  }finally{if(recorder&&recorder.state!=='inactive')recorder.stop();stream?.getTracks().forEach(track=>track.stop());capture?.remove();Object.assign(clock,saved,{exporting:false,revision:clock.revision+1});}
}
