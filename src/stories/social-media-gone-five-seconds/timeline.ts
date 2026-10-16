import events from './timeline.json';
export const T=events;
export const unit=(x:number)=>Math.max(0,Math.min(1,x));
export const ramp=(t:number,a:number,b:number)=>{const u=unit((t-a)/(b-a));return u*u*(3-2*u);};
/** Explicit slow-motion mapping. Only the first five story seconds are expanded. */
export function outageSeconds(t:number){
 const f=[T.outageOn,5.5,11.5,17,23,29,35,T.restored],s=[0,.65,1.4,2.35,3.38,4.15,4.75,5];
 if(t<=f[0])return 0;if(t>=T.restored)return 5;
 for(let i=1;i<f.length;i++)if(t<=f[i])return s[i-1]+(s[i]-s[i-1])*(t-f[i-1])/(f[i]-f[i-1]);
 return 5;
}
export const pulse=(t:number,a:number,b:number,c:number,d:number)=>ramp(t,a,b)*(1-ramp(t,c,d));
