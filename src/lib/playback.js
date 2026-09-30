// Mutable clock stays out of React/Zustand updates during frame rendering.
export const clock={time:0,playing:false,speed:1,range:null,loop:false,exporting:false,canvas:null,revision:0};
export function seek(time,duration){clock.time=Math.max(0,Math.min(duration,time));clock.revision++;}
export function advance(delta,duration){if(!clock.playing)return;const start=clock.range?.start??0,end=clock.range?.end??duration;const next=clock.time+Math.max(0,delta)*clock.speed;if(next>=end){clock.time=clock.loop&&end>start?start+(next-start)%(end-start):end;if(!clock.loop)clock.playing=false;}else clock.time=next;}
export function togglePlayback(){const start=clock.range?.start??0,end=clock.range?.end;if(end!=null&&clock.time>=end)clock.time=start;clock.playing=!clock.playing;}
