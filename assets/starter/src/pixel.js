// Draw functions receive state; no clock reads or accumulated animation here.
export const C={bg:'#14252d',ink:'#0b1721',paper:'#f0edcf',muted:'#93a6a1',gold:'#edc86b',blue:'#62bcbd',mint:'#d7ef80',orange:'#e39b63'};
export function box(c,x,y,w,h,color){c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
export function grid(c,x,y,u,fn){c.save();c.translate(Math.round(x),Math.round(y));c.scale(u,u);fn();c.restore();}
export function order(c,x,y,scale=1,rotation=0){c.save();c.translate(Math.round(x),Math.round(y));c.rotate(rotation);c.scale(scale,scale);box(c,-22,-29,44,58,C.ink);box(c,-18,-25,36,50,C.paper);box(c,-11,-15,22,4,C.blue);box(c,-11,-4,16,3,C.muted);box(c,-11,5,20,3,C.muted);box(c,5,14,7,7,C.gold);c.restore();}
export function parcel(c,x,y,scale=1){grid(c,x,y,scale,()=>{box(c,-22,-40,44,40,C.ink);box(c,-18,-36,36,32,C.orange);box(c,-2,-36,8,32,C.gold);box(c,-14,-28,8,5,C.paper);});}
export function person(c,x,y,{walk=0,carry=false,reach=0,face=1}={}){grid(c,x,y,4,()=>{
 c.scale(face,1); const stride=Math.round(Math.sin(walk)*2), bob=Math.abs(stride)*.4;
 box(c,-7,-9,6,9-stride,C.ink);box(c,2,-9,6,9+stride,C.ink);
 box(c,-9,-2-stride,8,3,C.paper);box(c,2,-2+stride,9,3,C.paper);
 c.translate(0,-bob);box(c,-8,-25,16,18,C.ink);box(c,-6,-23,12,14,C.blue);box(c,-3,-23,5,3,C.paper);
 box(c,-7,-39,14,15,C.ink);box(c,-5,-36,11,11,C.orange);box(c,-5,-39,11,5,C.ink);box(c,3,-32,2,2,C.ink);box(c,2,-27,4,1,C.ink);
 box(c,-10,-22,4,12,C.ink);box(c,-9,-14,3,4,C.orange);
 if(carry||reach>0){box(c,6,-22,5+reach*4,4,C.ink);box(c,9+reach*4,-23,4,4,C.orange);}else{box(c,7,-22,4,11,C.ink);box(c,8,-14,3,4,C.orange);}
 });}
export function factory(c,x,y,{running=false,pulse=0}={}){grid(c,x,y,4,()=>{
 box(c,-7,-50,12,34,C.ink);box(c,-4,-47,6,29,C.muted);box(c,-3,-52,8,5,C.ink);
 box(c,-36,-30,74,31,C.ink);box(c,-33,-27,68,25,'#3b565c');
 for(let j=0;j<4;j++){box(c,-29+j*16,-24,12,9,C.ink);box(c,-27+j*16,-22,8,5,running?C.gold:'#729798');}
 box(c,-25,-10,17,11,C.ink);box(c,-23,-8,13,9,C.blue);box(c,11,-13,18,14,C.ink);box(c,14,-10,12,11,'#b6bf9a');
 box(c,-40,1,83,4,C.ink);box(c,-37,1,77,1,C.muted);
 box(c,30,-35,8,6,C.ink);box(c,32,-33,4,2,running?C.mint:C.orange);
 if(running){for(let j=0;j<3;j++){const py=-58-j*6-pulse*5;box(c,-3+j*3,py,6+j*2,4,'#607773');}}
 });}
export function label(c,text,x,y,size,color=C.paper,align='center'){c.font=`${size}px "Microsoft YaHei", "Noto Sans CJK SC", monospace`;c.textAlign=align;c.textBaseline='middle';c.fillStyle=color;c.fillText(text,Math.round(x),Math.round(y));}
