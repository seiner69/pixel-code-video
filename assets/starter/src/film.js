import {C,box,order,parcel,person,factory,label} from './pixel.js';
import {sample,lerp,clamp} from './motion.js';
const canvas=document.querySelector('#film'),ctx=canvas.getContext('2d',{alpha:false});
let config;
function draw(t){
 const q=sample(t,config.duration); ctx.resetTransform();ctx.globalAlpha=1;ctx.clearRect(0,0,canvas.width,canvas.height);
 // Preserve the 16:9 design if an explicitly requested canvas uses a different ratio.
 box(ctx,0,0,canvas.width,canvas.height,C.bg);const scale=Math.min(canvas.width/1280,canvas.height/720);ctx.translate((canvas.width-1280*scale)/2,(canvas.height-720*scale)/2);ctx.scale(scale,scale);ctx.imageSmoothingEnabled=false;
 box(ctx,48,42,8,34,C.mint);label(ctx,'PIXEL / CAUSE & EFFECT',72,56,16,C.muted,'left');
 label(ctx,config.title,64,122,48,C.paper,'left');label(ctx,'需求 → 订单 → 生产',64,181,24,C.muted,'left');
 const stages=['01  聚集','02  交付','03  产出'];for(let i=0;i<3;i++){box(ctx,830+i*124,68,106,32,i===q.phase?C.mint:'#283d42');label(ctx,stages[i],883+i*124,84,16,i===q.phase?C.ink:C.muted);}
 // Scene ground and local anchors.
 box(ctx,60,510,1160,4,'#66817c');box(ctx,60,514,1160,12,'#20373c');
 for(let i=0;i<24;i++)box(ctx,72+i*49,538,20,3,'#294148');
 label(ctx,'需求池',240,567,20,C.muted);label(ctx,'订单',484,567,20,C.muted);label(ctx,'生产',940,567,20,C.muted);
 if(q.s<1.2){const points=[[150,300],[250,385],[140,465]];for(let i=0;i<3;i++){
  const p=clamp(q.gathered*1.25-i*.1), x=lerp(points[i][0],480,p), y=lerp(points[i][1],360,p)-Math.sin(p*Math.PI)*35;
  order(ctx,x,y,.65+.35*p,lerp((i-1)*.13,0,p));
 }}
 // Actor shadow stays on ground. Each frame reconstitutes the full state.
 box(ctx,q.x-42,506,84,7,'#0e1d23');
 factory(ctx,940,506,{running:q.running,pulse:(q.s*2)%1});
 person(ctx,q.x,500,{walk:q.walk,carry:q.carrying,reach:q.reach});
 if(q.cardVisible&&q.s>=1.2)order(ctx,q.card.x,q.card.y,q.card.scale);
 if(q.running&&q.s<4.65){label(ctx,'生产中',940,260,22,C.gold);for(let i=0;i<3;i++)box(ctx,907+i*24,294,16,8,(Math.floor(q.s*6)+i)%3===0?C.mint:'#456261');}
 if(q.productVisible)parcel(ctx,q.productX,q.productY,1.4);
 if(q.result){label(ctx,'需求有了结果',1092,393,22,C.mint);box(ctx,1078,425,8,10,C.mint);box(ctx,1086,433,8,8,C.mint);box(ctx,1094,417,8,16,C.mint);}
 box(ctx,60,603,1160,64,'#0e1d25');box(ctx,60,603,6,64,C.mint);label(ctx,config.captions[q.caption],640,635,28,C.paper);
 // Restore baseline for callers; no drawing state leaks across seeks.
 ctx.resetTransform();ctx.globalAlpha=1;
 return q;
}
window.ready=(async()=>{
 config=await(await fetch('./config.json')).json();canvas.width=config.width;canvas.height=config.height;
 await document.fonts.ready;
 window.sampleAt=t=>sample(t,config.duration);window.drawAt=draw;
 window.renderAt=(t,mime='image/png',quality)=>{draw(t);return canvas.toDataURL(mime,quality);};
 const seek=document.querySelector('#seek'),readout=document.querySelector('#time'),play=document.querySelector('#play');seek.max=config.duration;seek.step=1/config.fps;
 let playing=false,origin=0,current=0;
 function set(t){current=clamp(t,0,config.duration);seek.value=current;readout.textContent=`${current.toFixed(2)} s`;draw(current);}
 seek.oninput=()=>{playing=false;play.textContent='播放';set(Number(seek.value));};
 play.onclick=()=>{playing=!playing;if(playing){if(current>=config.duration)current=0;origin=performance.now()-current*1000;}play.textContent=playing?'暂停':'播放';};
 function tick(now){if(playing){set((now-origin)/1000);if(current>=config.duration){playing=false;play.textContent='播放';}}requestAnimationFrame(tick);}requestAnimationFrame(tick);set(0);
 if(new URLSearchParams(location.search).has('render'))document.querySelector('nav').style.display='none';
 return true;
})();
