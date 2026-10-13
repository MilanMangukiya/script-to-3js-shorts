import { Humanoid, POSE_STAND, type HumanoidPose } from './Humanoid';
import { smoothstep } from '../util/math';

export interface JumpOptions { height?:number; gravity?:number; start_s?:number; crouch_s?:number; settle_s?:number }
export interface JumpState { elevation:number; crouch:number; airborne:boolean; flight_s:number; pose:HumanoidPose }
/** Metres and seconds. Ballistic COM arc; deterministic squat and landing absorption. */
export function evaluateJump(time_s:number,o:JumpOptions={}):JumpState {
  const h=o.height??.30,g=o.gravity??9.81,start=o.start_s??0,pre=o.crouch_s??.5,settle=o.settle_s??.6;
  const flight=2*Math.sqrt(2*h/g),age=time_s-start,air=age>=0&&age<flight;
  const u=Math.max(0,Math.min(1,age/flight));
  const squat=age<0?smoothstep(start-pre,start,time_s):age<flight?0:Math.sin(Math.PI*Math.min(1,(age-flight)/settle))*.7;
  const elevation=air?4*h*u*(1-u):0,flex=squat*.65;
  return {elevation,crouch:squat,airborne:air,flight_s:flight,pose:{...POSE_STAND,hipsY:.92-.9*(1-Math.cos(flex)),lean:squat*.18,
    legL:[flex,flex*2],legR:[flex,flex*2],armL:[air?-1.25:-.15-squat*.35,.12,air?.3:.4+squat*.6],armR:[air?-1.25:-.15-squat*.35,.12,air?.3:.4+squat*.6],breath:0}};
}
/** Ground the rig's soles through each crouch. Caller owns X/Z and heading. */
export function applyJump(person:Humanoid,time_s:number,o:JumpOptions={},groundY=0):JumpState {
  const state=evaluateJump(time_s,o);person.root.position.y=0;person.setPose(state.pose);
  const sole=person.footL.getWorldPosition(person.root.position.clone()).y-.0325*person.root.scale.y;
  person.root.position.y=groundY-sole+state.elevation;person.root.updateMatrixWorld(true);return state;
}
