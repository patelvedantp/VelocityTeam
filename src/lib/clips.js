export function validateClip(start,end,duration) {
  if(![start,end,duration].every(Number.isFinite)||start<0||end>duration+1e-8||end<=start||end-start>10+1e-8) throw new Error('Choose a positive clip up to 10 seconds within the match.');
  return {start,end};
}
export function clipURL(match,clip,locationURL) {
  validateClip(clip.start,clip.end,match.duration);const url=new URL(locationURL);url.hash=new URLSearchParams({match:match.id,start:clip.start.toFixed(3),end:clip.end.toFixed(3)}).toString();return url.toString();
}
export function readClipURL(match,hash) {
  const params=new URLSearchParams(hash.replace(/^#/,''));if(!params.has('start'))return null;
  if(params.get('match')!==match.id)throw new Error('This link belongs to another match. Import that match first.');
  return {...validateClip(Number(params.get('start')),Number(params.get('end')),match.duration),name:'Shared sequence'};
}
export function portableClip(match,clip) {
  validateClip(clip.start,clip.end,match.duration);
  // Include neighboring frames for interpolation at exact trim boundaries.
  let a=0;while(a+1<match.times.length&&match.times[a+1]<=clip.start)a++;
  let b=a;while(b+1<match.times.length&&match.times[b]<clip.end)b++;
  const n=match.players.length;
  const tracking=Array.from({length:b-a+1},(_,j)=>{const i=a+j;return {timestamp:match.times[i]-match.times[a],period:match.periods[i],player_data:match.players.flatMap((p,k)=>{const at=(i*n+k)*3;return Number.isFinite(match.positions[at])?[{player_id:p.id,x:match.positions[at],y:-match.positions[at+2]}]:[]}),ball_data:Number.isFinite(match.ball[i*3])?{x:match.ball[i*3],y:-match.ball[i*3+2],z:match.ball[i*3+1]}:null,possession:{player_id:match.players[match.owners[i]]?.id??null}};});
  return {format:'touchline-clip-v1',name:clip.name,sourceMatchId:match.id,range:{start:clip.start-match.times[a],end:clip.end-match.times[a]},metadata:{id:`${match.id}-clip`,pitch_length:match.pitch.length,pitch_width:match.pitch.width,home_team:{id:'home',name:match.title.split(' vs ')[0]},away_team:{id:'away',name:match.title.split(' vs ')[1]},players:match.players.map(p=>({id:p.id,number:p.number,name:p.name,team_id:p.team}))},tracking};
}
export function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
