import { parseSkillCorner } from './parseSkillCorner';
self.onmessage=({data})=>{try{const match=parseSkillCorner(data.tracking,data.metadata);self.postMessage({match},[match.times.buffer,match.matchTimes.buffer,match.periods.buffer,match.positions.buffer,match.ball.buffer,match.owners.buffer]);}catch(error){self.postMessage({error:error.message});}};
