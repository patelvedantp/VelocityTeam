import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { BufferAttribute, BufferGeometry, CanvasTexture, Vector3 } from 'three';
import { useStore } from '../store';
import { advance, clock } from '../lib/playback';
import { framePair, samplePosition, sampleBall } from '../lib/parseSkillCorner';
const colors={home:'#93c5fd',away:'#fdba74',unknown:'#cbd5e1'};
function Player({player,index,groups,numbers,lines}) {
  const geometry=useMemo(()=>{const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(new Float32Array(24*3),3));g.setDrawRange(0,0);return g;},[]);
  const texture=useMemo(()=>{const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d');ctx.fillStyle=colors[player.team];ctx.beginPath();ctx.roundRect(6,6,116,116,26);ctx.fill();ctx.font='bold 56px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#0f172a';ctx.fillText(String(player.number).slice(0,4),64,66);return new CanvasTexture(c);},[player.number,player.team]);
  useEffect(()=>()=>{texture.dispose();geometry.dispose();},[texture,geometry]);
  return <><group ref={el=>{groups.current[index]=el;}}><mesh position={[0,1.1,0]} castShadow><cylinderGeometry args={[.65,.48,1.8,10]}/><meshStandardMaterial color={colors[player.team]} roughness={.8}/></mesh><mesh position={[0,2.25,0]} castShadow><sphereGeometry args={[.35,10,8]}/><meshStandardMaterial color="#e8cfb9"/></mesh><sprite position={[0,3.5,0]} scale={[2.7,2.7,1]} ref={el=>{numbers.current[index]=el;}}><spriteMaterial map={texture} depthTest={false}/></sprite><mesh rotation={[-Math.PI/2,0,0]} position={[0,.025,0]}><ringGeometry args={[.85,1.05,24]}/><meshBasicMaterial color={colors[player.team]} transparent opacity={.6}/></mesh></group><line ref={el=>{lines.current[index]=el;}} geometry={geometry}><lineBasicMaterial color={colors[player.team]} transparent opacity={.45}/></line></>;
}
export default function TrackingScene({match}) {
  const mode=useStore(s=>s.camera),selected=useStore(s=>s.selected);const groups=useRef([]),numbers=useRef([]),lines=useRef([]),ball=useRef(),shadow=useRef(),ring=useRef(),orbit=useRef();const {camera,gl,size}=useThree();const point=useMemo(()=>new Float32Array(3),[]),ballPoint=useMemo(()=>new Float32Array(3),[]),target=useMemo(()=>new Vector3(),[]);const lastTrail=useRef(-1);
  useEffect(()=>{clock.canvas=gl.domElement;return()=>{if(clock.canvas===gl.domElement)clock.canvas=null;};},[gl]);
  useEffect(()=>{if(mode==='tactical'){const tangent=Math.tan(camera.fov*Math.PI/360),aspect=size.width/size.height;const distance=Math.max((match.pitch.length+12)/2/tangent/aspect,(match.pitch.width+12)/2/tangent)*1.05;camera.position.set(0,distance,.01);camera.up.set(0,0,-1);camera.lookAt(0,0,0);}else{camera.up.set(0,1,0);camera.position.set(65,60,70);camera.lookAt(0,0,0);}camera.updateProjectionMatrix();if(orbit.current){orbit.current.target.set(0,0,0);orbit.current.update();}},[mode,match,camera,size.width,size.height]);
  useFrame((_,delta)=>{if(!clock.exporting)advance(delta,match.duration);const pair=framePair(match,clock.time),settings=useStore.getState();
    for(let i=0;i<match.players.length;i++){const group=groups.current[i];if(!group)continue;group.visible=samplePosition(match,i,pair,point);if(group.visible)group.position.set(point[0],point[1],point[2]);if(numbers.current[i])numbers.current[i].visible=settings.numbers;}
    const visible=sampleBall(match,pair,ballPoint);if(ball.current){ball.current.visible=visible;if(visible)ball.current.position.set(ballPoint[0],Math.max(.22,ballPoint[1]),ballPoint[2]);}if(shadow.current){shadow.current.visible=visible;if(visible){shadow.current.position.set(ballPoint[0],.06,ballPoint[2]);shadow.current.scale.setScalar(1+ballPoint[1]*.2);shadow.current.material.opacity=.45/(1+ballPoint[1]);}}
    if(ring.current){const player=groups.current[selected];ring.current.visible=!!player?.visible;if(player)ring.current.position.set(player.position.x,.08,player.position.z);}
    if(mode==='follow'){const player=groups.current[selected];if(player?.visible){target.copy(player.position);camera.position.set(target.x+25,23,target.z+30);camera.lookAt(target);}}
    const trailTick=Math.floor(clock.time*10)+clock.revision*100000;
    if(lastTrail.current!==trailTick){lastTrail.current=trailTick;for(let i=0;i<match.players.length;i++){const line=lines.current[i];if(!line)continue;const attr=line.geometry.attributes.position;let count=0;for(let k=0;k<24;k++){const t=clock.time-(23-k)*.08;if(t<0||!samplePosition(match,i,framePair(match,t),point)){count=0;continue;}attr.setXYZ(count++,point[0],.09,point[2]);}line.geometry.setDrawRange(0,count);attr.needsUpdate=true;line.frustumCulled=false;}}for(const line of lines.current)if(line)line.visible=settings.trails;
  });
  return <>{match.players.map((player,i)=><Player key={player.id} player={player} index={i} groups={groups} numbers={numbers} lines={lines}/>)}<mesh ref={ball} castShadow><sphereGeometry args={[.22,16,12]}/><meshStandardMaterial color="#fff" roughness={.45}/></mesh><mesh ref={shadow} rotation={[-Math.PI/2,0,0]}><circleGeometry args={[.35,16]}/><meshBasicMaterial color="#071a14" transparent opacity={.4}/></mesh><mesh ref={ring} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[1.2,1.4,32]}/><meshBasicMaterial color="#a7f3d0"/></mesh>{mode==='orbit'&&<OrbitControls ref={orbit} makeDefault maxPolarAngle={Math.PI/2-.05} minDistance={12} maxDistance={180} target={[0,0,0]}/>}</>;
}
