import { create } from 'zustand';
import { clock } from './lib/playback';
export const useStore=create(set=>({match:null,loadKey:0,camera:'tactical',selected:0,trails:true,numbers:true,clips:[],error:'',busy:false,exporting:false,
  load:match=>{Object.assign(clock,{time:0,playing:false,speed:1,range:null,loop:false,exporting:false,revision:clock.revision+1});set(s=>({match,loadKey:s.loadKey+1,selected:0,clips:[],error:''}));},
  patch:value=>set(value),saveClip:clip=>set(s=>({clips:[...s.clips,{...clip,id:crypto.randomUUID()}]})),removeClip:id=>set(s=>({clips:s.clips.filter(c=>c.id!==id)}))
}));
