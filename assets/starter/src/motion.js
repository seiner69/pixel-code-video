export const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
export const lerp=(a,b,p)=>a+(b-a)*p;
export const smooth=p=>{p=clamp(p);return p*p*(3-2*p);};
const progress=(t,a,b)=>clamp((t-a)/(b-a));
// Canonical 6-second scene. This scaling is for the sample, not a pacing rule.
export function sample(t,duration=6){
 const s=clamp(t/duration)*6;
 const walk=progress(s,1.8,3.5), x=lerp(418,796,smooth(walk));
 const moving=s>1.8&&s<3.5;
 const reach=progress(s,1.3,1.5)*(1-progress(s,1.65,1.8));
 const hand={x:x+49,y:408-(moving?Math.abs(Math.sin(walk*Math.PI*8))*3.2:0)};
 let card={x:480,y:360,scale:1};
 if(s<1.5){const p=smooth(progress(s,1.2,1.5));card={x:lerp(480,hand.x,p),y:lerp(360,hand.y,p),scale:1};}
 else if(s<3.5) card={...hand,scale:1};
 else {const p=smooth(progress(s,3.5,3.9));card={x:lerp(hand.x,858,p),y:lerp(hand.y,472,p),scale:1-p*.8};}
 const product=progress(s,4.65,5.2);
 return {s,x,walk: moving?walk*Math.PI*8:0,reach,hand,card,
   carrying:s>=1.5&&s<3.5,cardVisible:s<3.9,running:s>=4.05,
   caption:s<2.1?0:s<4.65?1:2,
   gathered:smooth(progress(s,.15,1.2)),
   productVisible:s>=4.65, productX:lerp(974,1092,smooth(product)),
   productY:498-Math.sin(product*Math.PI)*52,
   phase:s<1.5?0:s<3.9?1:2,
   result:s>=5.2};
}
