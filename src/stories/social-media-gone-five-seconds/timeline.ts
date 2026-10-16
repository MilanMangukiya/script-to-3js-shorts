export type City='tokyo'|'london'|'lagos'|'sao'|'mumbai'|'nyc';
export const windows:Record<City,[number,number]>={tokyo:[0,11.4],london:[11.4,17.6],lagos:[17.6,23.8],sao:[23.8,30],mumbai:[30,36.2],nyc:[36.2,49]};
export const cities=['tokyo','tokyo','london','lagos','sao','mumbai','nyc','nyc'] as City[];
export const names:Record<City,string>={tokyo:'TOKYO',london:'LONDON',lagos:'LAGOS',sao:'SAO PAULO',mumbai:'MUMBAI',nyc:'NEW YORK'};
export const unit=(n:number)=>Math.max(0,Math.min(1,n));
export const ramp=(t:number,a:number,b:number)=>{const x=unit((t-a)/(b-a));return x*x*(3-2*x);};
export const pulse=(t:number,a:number,b:number,c:number,d:number)=>ramp(t,a,b)*(1-ramp(t,c,d));
export const localSeconds=(city:City,t:number)=>4.9*unit((t-windows[city][0])/(windows[city][1]-windows[city][0]));
