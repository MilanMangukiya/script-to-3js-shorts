export const T={duration:50,meanReveal:19.480000,drink0:.8,drink1:9.4,pool0:11.5,pool1:13.400000,small0:23.6,small1:27.5,big0:29.6,big1:34.7,quit0:37,quit1:39};
export const N=8.3e9,AREA=361.934e12,VOLUME_L=1.338e21,POOL_L=2.5e6;
export const DROP_NM=N/1000/AREA*1e9,MM_EACH_L=AREA*.001*1000/N,FULL_EACH_L=VOLUME_L/N;
export const unit=(x:number)=>Math.max(0,Math.min(1,x));
export const ramp=(t:number,a:number,b:number)=>{const q=unit((t-a)/(b-a));return q*q*(3-2*q);};
export const intake=(t:number)=>ramp(t,T.drink0,T.drink1);
