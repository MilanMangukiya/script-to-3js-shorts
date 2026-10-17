export const T={duration:50,clap:.9,scope:4.6,macro:12,travel:18.3,arrival:18.3+1000/343/.5,control:30.2,echo:36.4,reflected:36.4+60/343};
export const C=343,N=8.3e9;
export const ramp=(t:number,a:number,b:number)=>{const q=Math.max(0,Math.min(1,(t-a)/(b-a)));return q*q*(3-2*q);};
/** Presentation clocks revisit one stipulated event, never additional human claps. */
export function localClock(t:number,scene:string){
 if(scene==='S01')return t;
 if(scene==='S02')return .9+t-T.scope;
 if(scene==='S03')return .9+(t-T.macro)*.18;
 if(scene==='S04'||scene==='S05')return .9+(t-T.travel)*.5;
 if(scene==='S06')return .9+t-T.control;
 return .9+t-T.echo;
}
