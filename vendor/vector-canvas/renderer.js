import {VectorTile} from './packages/@mapbox/vector-tile/index.js';
import {PbfReader} from './packages/pbf/index.js';

// A small Canvas renderer for the same OpenFreeMap/OpenMapTiles vector data.
// It intentionally implements base geography rather than the full GL style spec.
const cache=new Map(),metadataCache=new Map();
let cacheBytes=0;
const MAX_BYTES=12*1024*1024,MAX_TILES=64;
function remember(key,bytes){if(cache.has(key)){cacheBytes-=cache.get(key).byteLength;cache.delete(key);}cache.set(key,bytes);cacheBytes+=bytes.byteLength;while(cache.size>MAX_TILES||cacheBytes>MAX_BYTES){const first=cache.keys().next().value;cacheBytes-=cache.get(first).byteLength;cache.delete(first);}}
function cached(key){const value=cache.get(key);if(value){cache.delete(key);cache.set(key,value);}return value;}
async function json(url,signal){const r=await fetch(url,{signal,credentials:'omit'});if(!r.ok)throw Error('地图配置加载失败（'+r.status+'）');return r.json();}
async function metadata(settings,signal){
  const styleUrl=settings.vectorStyleUrl||'https://tiles.openfreemap.org/styles/liberty';
  const hit=metadataCache.get(styleUrl);if(hit&&Date.now()-hit.time<600000)return hit.value;
  const style=await json(styleUrl,signal),source=style.sources?.openmaptiles;
  if(!source||source.type!=='vector')throw Error('OpenFreeMap样式缺少openmaptiles矢量数据源');
  const value=source.url?await json(new URL(source.url,styleUrl).href,signal):source;
  if(!Array.isArray(value.tiles)||!value.tiles.length)throw Error('OpenFreeMap TileJSON未提供瓦片模板');
  const template=new URL(value.tiles[0],source.url||styleUrl).href.replace(/%7B/gi,'{').replace(/%7D/gi,'}');
  const result={template,maxzoom:Number.isFinite(Number(value.maxzoom))?Number(value.maxzoom):14,minzoom:Number(value.minzoom)||0,scheme:value.scheme||'xyz'};
  metadataCache.set(styleUrl,{time:Date.now(),value:result});while(metadataCache.size>3)metadataCache.delete(metadataCache.keys().next().value);
  return result;
}
function name(p){return String(p['name:zh-Hans']||p['name:zh']||p.name_zh||p.name||p['name:nonlatin']||p.name_en||'').slice(0,60);}
function features(tile,key,fn){const layer=tile.layers[key];if(!layer)return;for(let i=0;i<layer.length;i++){const f=layer.feature(i);fn(f,f.properties,f.loadGeometry(),256/layer.extent);}}
function path(ctx,geometry,scale,close=false){ctx.beginPath();for(const ring of geometry){if(!ring.length)continue;ctx.moveTo(ring[0].x*scale,ring[0].y*scale);for(let i=1;i<ring.length;i++)ctx.lineTo(ring[i].x*scale,ring[i].y*scale);if(close)ctx.closePath();}}
function polygon(ctx,geo,s,fill,stroke){path(ctx,geo,s,true);ctx.fillStyle=fill;ctx.fill('evenodd');if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=.5;ctx.stroke();}}
function roadStyle(p,z){const c=p.class||'',factor=z<11?.55:z<13?.75:1;
  if(c==='motorway')return {width:6*factor,color:'#edc27b',case:'#d1ad7a'};
  if(c==='trunk')return {width:5.3*factor,color:'#f5d697',case:'#d4bd91'};
  if(c==='primary')return {width:4.5*factor,color:'#f5dfaa',case:'#d7cbb0'};
  if(c==='secondary')return {width:3.6*factor,color:'#fff4d4',case:'#d3cfc0'};
  if(c==='tertiary')return {width:3*factor,color:'#fffdf6',case:'#d1d0c8'};
  if(c==='rail')return {width:1.3*factor,color:'#a3a5a2',case:'#d7d8d4',dash:[4,3]};
  if(c==='path'||c==='track')return {width:1*factor,color:'#c5b8a4',case:'#ede7db',dash:[3,3]};
  return {width:(c==='minor'?2.4:1.7)*factor,color:'#fffefa',case:'#d8d8d1'};
}
function lineAnchor(geo,s){let best=null,bestLength=0;for(const line of geo){let total=0;for(let i=1;i<line.length;i++)total+=Math.hypot(line[i].x-line[i-1].x,line[i].y-line[i-1].y)*s;if(total>bestLength){bestLength=total;best=line;}}if(!best||best.length<2)return null;let target=bestLength/2;for(let i=1;i<best.length;i++){const a=best[i-1],b=best[i],len=Math.hypot(b.x-a.x,b.y-a.y)*s;if(target<=len){let angle=Math.atan2(b.y-a.y,b.x-a.x);if(angle>Math.PI/2)angle-=Math.PI;if(angle< -Math.PI/2)angle+=Math.PI;const t=len?target/len:0;return {x:(a.x+(b.x-a.x)*t)*s,y:(a.y+(b.y-a.y)*t)*s,angle,length:bestLength};}target-=len;}return null;}
function drawLabel(ctx,label,occupied){
  const {text,x,y,size=11,angle=0,color='#536778',bold=false}=label;
  if(!text)return;ctx.font=`${bold?'600':'400'} ${size}px "Noto Sans SC","Microsoft YaHei",sans-serif`;
  const width=ctx.measureText(text).width;if(label.length&&width+14>label.length)return;
  const rotated=Math.abs(Math.sin(angle));const bw=Math.abs(Math.cos(angle))*width+rotated*size,bh=rotated*width+Math.abs(Math.cos(angle))*size;
  const box=[x-bw/2-4,y-bh/2-3,x+bw/2+4,y+bh/2+3];
  if(box[0]<3||box[1]<3||box[2]>253||box[3]>253)return;
  if(occupied.some(b=>box[0]<b[2]&&box[2]>b[0]&&box[1]<b[3]&&box[3]>b[1]))return;
  occupied.push(box);ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';ctx.lineWidth=3.5;ctx.strokeStyle='#fffdf7ee';ctx.strokeText(text,0,0);ctx.fillStyle=color;ctx.fillText(text,0,0);ctx.restore();
}
export function drawTile(canvas,bytes,z){
  const tile=new VectorTile(new PbfReader(bytes)),ctx=canvas.getContext('2d');if(!ctx)throw Error('浏览器Canvas 2D不可用');
  const ratio=canvas.width/256;ctx.setTransform(ratio,0,0,ratio,0,0);ctx.fillStyle='#f0efe8';ctx.fillRect(0,0,256,256);ctx.lineCap='round';ctx.lineJoin='round';
  const stats={roads:0,buildings:0,water:0,labels:[]},labels=[];
  features(tile,'landcover',(f,p,g,s)=>{if(f.type===3)polygon(ctx,g,s,['wood','grass','wetland'].includes(p.class)?'#dce8cf':'#e9eadb');});
  features(tile,'landuse',(f,p,g,s)=>{if(f.type!==3)return;const c=p.class;const fill=['park','recreation_ground','village_green','grass','cemetery','allotments'].includes(c)?'#d6e6c8':['industrial','commercial','retail'].includes(c)?'#e5e2dc':'#ecebe4';polygon(ctx,g,s,fill);});
  features(tile,'park',(f,p,g,s)=>{if(f.type===3)polygon(ctx,g,s,'#d2e4c4');});
  features(tile,'water',(f,p,g,s)=>{if(f.type===3){polygon(ctx,g,s,'#a9d1e4');stats.water++;}});
  features(tile,'waterway',(f,p,g,s)=>{path(ctx,g,s);ctx.strokeStyle='#a2cbdf';ctx.lineWidth=p.class==='river'?2.5:1.1;ctx.stroke();});
  if(z>=12)features(tile,'building',(f,p,g,s)=>{if(f.type===3){polygon(ctx,g,s,'#d8d5cd',z>=14?'#c7c4bc':null);stats.buildings++;}});
  const roads=[];features(tile,'transportation',(f,p,g,s)=>{if(f.type===2){roads.push({p,g,s,style:roadStyle(p,z)});stats.roads++;}});
  for(const road of roads){const st=road.style;path(ctx,road.g,road.s);ctx.setLineDash(st.dash||[]);ctx.strokeStyle=st.case;ctx.lineWidth=st.width+1.5;ctx.stroke();}
  for(const road of roads){const st=road.style;path(ctx,road.g,road.s);ctx.setLineDash(st.dash||[]);ctx.strokeStyle=st.color;ctx.lineWidth=st.width;ctx.stroke();}ctx.setLineDash([]);
  features(tile,'place',(f,p,g,s)=>{if(f.type!==1||!g[0]?.[0])return;const point=g[0][0];labels.push({text:name(p),x:point.x*s,y:point.y*s,size:['city','town'].includes(p.class)?14:11.5,bold:true,priority:0});});
  features(tile,'water_name',(f,p,g,s)=>{const point=g[0]?.[0];if(point)labels.push({text:name(p),x:point.x*s,y:point.y*s,color:'#4589a9',priority:1});});
  features(tile,'transportation_name',(f,p,g,s)=>{if(z<11)return;const a=lineAnchor(g,s);if(a)labels.push({...a,text:name(p)||p.ref||'',size:10.5,color:'#6d756c',priority:2});});
  if(z>=14)features(tile,'poi',(f,p,g,s)=>{if(f.type!==1||!g[0]?.[0]||Number(p.rank||0)>15)return;const point=g[0][0];labels.push({text:name(p),x:point.x*s,y:point.y*s,size:10,color:'#5b7680',priority:3});});
  const occupied=[];for(const label of labels.sort((a,b)=>a.priority-b.priority).slice(0,250)){const before=occupied.length;drawLabel(ctx,label,occupied);if(occupied.length>before)stats.labels.push(label.text);}
  return stats;
}
export function addTo(map,settings={},onError=()=>{}){
  let removed=false,layer=null;const setupAbort=new AbortController();
  const report=error=>{if(!removed&&error?.name!=='AbortError')onError(error);};
  const ready=metadata(settings,setupAbort.signal).then(meta=>{
    if(removed)return null;
    const Layer=window.L.GridLayer.extend({
      initialize(options){window.L.GridLayer.prototype.initialize.call(this,options);this._requests=new Map();this._jobs=[];this._active=0;this.on('tileunload',e=>{this._requests.get(e.tile)?.abort();this._requests.delete(e.tile);});},
      createTile(coords,done){
        const canvas=document.createElement('canvas'),ratio=Math.min(window.devicePixelRatio||1,2);canvas.width=256*ratio;canvas.height=256*ratio;canvas.className='hn-vector-canvas-tile';
        const ctx=canvas.getContext('2d');if(ctx){ctx.fillStyle='#f0efe8';ctx.fillRect(0,0,canvas.width,canvas.height);}
        const abort=new AbortController();this._requests.set(canvas,abort);
        const y=meta.scheme==='tms'?2**coords.z-1-coords.y:coords.y;
        const url=meta.template.replace('{z}',coords.z).replace('{x}',coords.x).replace('{y}',y);
        canvas.dataset.vectorTile=coords.z+'/'+coords.x+'/'+y;
        const task=async()=>{if(abort.signal.aborted)throw new DOMException('Tile unloaded','AbortError');let bytes=cached(url);if(!bytes){const response=await fetch(url,{signal:abort.signal,credentials:'omit'});if(!response.ok)throw Error('矢量瓦片加载失败（'+response.status+'）');bytes=new Uint8Array(await response.arrayBuffer());remember(url,bytes);}if(abort.signal.aborted)throw new DOMException('Tile unloaded','AbortError');const stats=drawTile(canvas,bytes,coords.z);canvas.dataset.vectorFeatures=JSON.stringify({roads:stats.roads,buildings:stats.buildings,water:stats.water,labels:stats.labels.length});};
        this._jobs.push({task,done,canvas,abort});this._pump();return canvas;
      },
      _pump(){while(this._active<4&&this._jobs.length){const job=this._jobs.shift();this._active++;Promise.resolve().then(job.task).then(()=>job.done(null,job.canvas),error=>{if(error.name!=='AbortError')report(error);job.done(error,job.canvas);}).finally(()=>{this._requests.delete(job.canvas);this._active--;this._pump();});}},
      onRemove(m){for(const abort of this._requests.values())abort.abort();this._requests.clear();window.L.GridLayer.prototype.onRemove.call(this,m);}
    });
    layer=new Layer({tileSize:256,minZoom:1,maxZoom:19,maxNativeZoom:meta.maxzoom,minNativeZoom:meta.minzoom,keepBuffer:0,updateWhenIdle:true,updateWhenZooming:false,noWrap:true,pane:'tilePane',zIndex:1}).addTo(map);
    return layer;
  }).catch(error=>{report(error);return null;});
  return {ready,remove(){removed=true;setupAbort.abort();if(layer&&map.hasLayer(layer))map.removeLayer(layer);},get layer(){return layer;}};
}
