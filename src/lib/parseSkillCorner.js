/** Source rates are inferred from timestamps, never assumed to be 25 FPS.
 * Sampling at display time interpolates without materializing a 60 FPS copy.
 * World mapping: source x => world x, source y => world -z, ball z => world y.
 */
export function timestampSeconds(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return NaN;
  const parts=value.split(':').map(Number);
  if (parts.some(v=>!Number.isFinite(v)) || parts.length>3) return NaN;
  return parts.reduce((total,v)=>total*60+v,0);
}
export function decodeTracking(text) {
  if (typeof text !== 'string') return text;
  const clean=text.replace(/^\uFEFF/,'').trim();
  if (!clean) throw new Error('The tracking file is empty.');
  if(clean.startsWith('version https://git-lfs.github.com/spec/v1')) throw new Error('This is a Git LFS pointer, not tracking data. Use the download helper or download the actual file from GitHub.');
  if (clean.startsWith('[')) return JSON.parse(clean);
  try { const parsed=JSON.parse(clean); if (Array.isArray(parsed.frames)) return parsed.frames; if(Array.isArray(parsed.tracking)) return parsed.tracking; return [parsed]; }
  catch { return clean.split(/\r?\n/).filter(line=>line.trim()).map((line,index)=>{try{return JSON.parse(line);}catch{throw new Error(`Invalid JSONL at line ${index+1}.`);}}); }
}
const numeric=v=>typeof v==='number' && Number.isFinite(v);
const point=p=>p && numeric(p.x) && numeric(p.y);
export function parseSkillCorner(input, metadata={}) {
  const rows=decodeTracking(input);
  if (!Array.isArray(rows)||rows.length<2) throw new Error('Load a tracking array or JSONL with at least two frames.');
  const legacy=new Map((metadata.players||[]).map(p=>[String(p.trackable_object),p]));
  const ballId=metadata.ball?.trackable_object;
  const homeId=metadata.home_team?.id;
  const awayId=metadata.away_team?.id;
  const lineup=new Map((metadata.players||[]).map(p=>[String(p.id),p]));
  const ids=new Set();
  const normalized=rows.filter(row=>!(row.period==null&&row.timestamp==null)).map((row,index)=>{
    let players=row.player_data,ball=row.ball_data;
    if (!players && Array.isArray(row.data)) {
      players=row.data.filter(p=>legacy.has(String(p.trackable_object))).map(p=>({...p,player_id:legacy.get(String(p.trackable_object)).id}));
      ball=row.data.find(p=>p.trackable_object===ballId);
    }
    if(!Array.isArray(players)) throw new Error(`Frame ${index}: missing player_data. Legacy data requires the matching metadata file.`);
    const seconds=timestampSeconds(row.timestamp);
    if(!Number.isFinite(seconds)||seconds<0) throw new Error(`Frame ${index}: invalid timestamp.`);
    const map=new Map();
    for (const p of players) if(p.player_id!=null && point(p)) {const id=String(p.player_id);ids.add(id);map.set(id,p);}
    return {seconds,period:Number(row.period)||1,map,ball:point(ball)?ball:null,possession:row.possession||null};
  }).sort((a,b)=>a.period-b.period||a.seconds-b.seconds);
  if(normalized.length<2) throw new Error('No playable tracking periods found.');
  if(!ids.size) throw new Error('No valid player coordinates found.');
  if(ids.size>80) throw new Error('Too many player IDs. Check the tracking schema.');
  // Duplicate timestamps retain the last measurement; periods never overlap.
  const frames=[];
  for(const row of normalized){const previous=frames.at(-1);if(previous&&previous.period===row.period&&previous.seconds===row.seconds)frames[frames.length-1]=row;else frames.push(row);}
  if(frames.length<2) throw new Error('At least two distinct timestamps are required.');
  const deltas=[];for(let i=1;i<frames.length;i++){const dt=frames[i].seconds-frames[i-1].seconds;if(frames[i].period===frames[i-1].period&&dt>0&&dt<=1)deltas.push(dt);}
  deltas.sort((a,b)=>a-b);const step=deltas.length?deltas[Math.floor(deltas.length/2)]:.1;
  const players=[...ids].map((id,index)=>{const p=lineup.get(id);const teamId=p?.team_id??p?.team?.id;return {id,name:p?.short_name||p?.last_name||p?.name||`Player ${id}`,number:p?.number??p?.jersey_number??id,team:teamId!=null&&homeId!=null&&String(teamId)===String(homeId)?'home':teamId!=null&&awayId!=null&&String(teamId)===String(awayId)?'away':'unknown',index};});
  const times=new Float64Array(frames.length),matchTimes=new Float64Array(frames.length),periods=new Uint8Array(frames.length),positions=new Float32Array(frames.length*players.length*3),ball=new Float32Array(frames.length*3),owners=new Int16Array(frames.length);positions.fill(NaN);ball.fill(NaN);owners.fill(-1);
  const indexById=new Map(players.map(p=>[p.id,p.index]));let periodStart=frames[0].seconds,offset=0;
  frames.forEach((row,i)=>{if(i&&row.period!==frames[i-1].period){offset=times[i-1]+step;periodStart=row.seconds;}times[i]=offset+row.seconds-periodStart;matchTimes[i]=row.seconds;periods[i]=row.period;
    for(const [id,p] of row.map){const at=(i*players.length+indexById.get(id))*3;positions[at]=p.x;positions[at+1]=0;positions[at+2]=-p.y;}
    if(row.ball){ball[i*3]=row.ball.x;ball[i*3+1]=numeric(row.ball.z)?Math.max(0,row.ball.z):0;ball[i*3+2]=-row.ball.y;}
    owners[i]=indexById.get(String(row.possession?.player_id))??-1;
  });
  const length=Number(metadata.pitch_length??metadata.pitch?.length??105),width=Number(metadata.pitch_width??metadata.pitch?.width??68);
  return {version:1,id:String(metadata.id??'local-match'),title:`${metadata.home_team?.name||'Home'} vs ${metadata.away_team?.name||'Away'}`,players,times,matchTimes,periods,positions,ball,owners,pitch:{length:Number.isFinite(length)&&length>=90&&length<=120?length:105,width:Number.isFinite(width)&&width>=45&&width<=90?width:68},sourceFps:1/step,duration:times.at(-1),maxGap:Math.max(step*2.5,.2),warnings:players.some(p=>p.team==='unknown')?['Team metadata unavailable: players shown in neutral jerseys.']:[]};
}
export function framePair(match,t) {
  const times=match.times;const clamped=Math.max(0,Math.min(match.duration,t));let lo=0,hi=times.length-1;
  while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(times[mid]<=clamped)lo=mid;else hi=mid-1;}
  const a=lo,b=Math.min(a+1,times.length-1),dt=times[b]-times[a];
  const continuous=a===b||(match.periods[a]===match.periods[b] && dt<=match.maxGap);
  return {a,b,alpha:continuous&&dt>0?(clamped-times[a])/dt:0,continuous,stale:!continuous&&clamped>times[a]+1e-6};
}
export function samplePosition(match,playerIndex,pair,out) {
  const stride=match.players.length*3,a=(pair.a*match.players.length+playerIndex)*3,b=a+(pair.b-pair.a)*stride;
  if(pair.stale||!Number.isFinite(match.positions[a])) return false;
  const canLerp=pair.continuous&&Number.isFinite(match.positions[b]);
  for(let k=0;k<3;k++)out[k]=canLerp?match.positions[a+k]+(match.positions[b+k]-match.positions[a+k])*pair.alpha:match.positions[a+k];
  return true;
}
export function sampleBall(match,pair,out) {
  const a=pair.a*3,b=pair.b*3;if(pair.stale||!Number.isFinite(match.ball[a]))return false;
  for(let k=0;k<3;k++)out[k]=Number.isFinite(match.ball[b+k])&&pair.continuous?match.ball[a+k]+(match.ball[b+k]-match.ball[a+k])*pair.alpha:match.ball[a+k];return true;
}
export function playerSpeed(match,index,pair) {
  if(!pair.continuous||pair.a===pair.b)return null;const a=(pair.a*match.players.length+index)*3,b=(pair.b*match.players.length+index)*3,dt=match.times[pair.b]-match.times[pair.a];
  if(!Number.isFinite(match.positions[a])||!Number.isFinite(match.positions[b]))return null;
  return Math.hypot(match.positions[b]-match.positions[a],match.positions[b+2]-match.positions[a+2])/dt*3.6;
}
