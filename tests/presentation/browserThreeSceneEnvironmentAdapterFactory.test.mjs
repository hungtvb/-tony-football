import assert from "node:assert/strict";
import test from "node:test";
import { createBrowserThreeSceneEnvironmentAdapter } from "../../src/game/presentation/BrowserThreeSceneEnvironmentAdapterFactory.js";
import { createRebindableThreeSceneHostPort } from "../../src/game/presentation/RebindableThreeSceneHostPort.js";
import { createThreeSceneHostPort } from "../../src/game/presentation/ThreeSceneHostContract.js";

class FakeCanvas extends EventTarget {
  constructor() { super(); this.width=1200; this.height=700; this.clientWidth=900; this.clientHeight=525; }
}
function createScheduler(){let next=1;const timers=new Map();return {schedule(callback,delay){const id=next++;timers.set(id,{callback,delay});return id;},cancel(id){timers.delete(id);},runAll(){for(const [id,timer] of [...timers]){timers.delete(id);timer.callback();}},get size(){return timers.size;}};}
function createTarget(replacements){const target=new EventTarget();target.devicePixelRatio=1;target.location={href:"https://example.test/?visualTest=1",search:"?visualTest=1",replace:(url)=>replacements.push(url)};target.navigator={deviceMemory:8};target.matchMedia=()=>({matches:false});return target;}
function createDelegate(name,calls){const objects=new Set();return createThreeSceneHostPort({addObject:(object)=>{calls.push([name,"add",object]);objects.add(object);return true;},removeObject:(object)=>{calls.push([name,"remove",object]);objects.delete(object);return true;},setCameraPose:(pose)=>{calls.push([name,"camera",pose]);return true;},copyCameraQuaternion:(target)=>{calls.push([name,"quaternion",target]);target.copy?.({});return true;},requestRender:()=>{calls.push([name,"render"]);return true;},diagnostics:()=>Object.freeze({owner:name,renderer:"webgl",profile:"test",foreignObjects:objects.size})});}
const pose=Object.freeze({position:Object.freeze({x:1,y:2,z:3}),lookAt:Object.freeze({x:4,y:5,z:6})});

test("production factory defers context-loss navigation and restoration cancels it while rebinding views",()=>{
 const replacements=[];const scheduler=createScheduler();const target=createTarget(replacements);const canvas=new FakeCanvas();const facade=createRebindableThreeSceneHostPort();const hostCalls=[];let generation=0;
 const adapter=createBrowserThreeSceneEnvironmentAdapter({target,document:{getElementById:()=>canvas},onHostChanged:(port)=>facade.bind(port),contextRestoreGraceMilliseconds:250,scheduleTimeout:(cb,d)=>scheduler.schedule(cb,d),cancelTimeout:(id)=>scheduler.cancel(id),createSceneHost:()=>{generation+=1;const name=`host-${generation}`;const calls=[];hostCalls.push(calls);return {port:createDelegate(name,calls),start:()=>calls.push([name,"start"]),resize:()=>calls.push([name,"resize"]),render:()=>true,dispose:()=>calls.push([name,"dispose"])};}});
 assert.equal(adapter.attach(),true);const runtimePort=facade.port;const player={id:"player"};const ball={id:"ball"};runtimePort.addObject(player);runtimePort.addObject(ball);runtimePort.setCameraPose(pose);
 canvas.dispatchEvent(new Event("webglcontextlost",{cancelable:true}));assert.equal(replacements.length,0);assert.equal(scheduler.size,1);assert.equal(facade.bound,false);
 canvas.dispatchEvent(new Event("webglcontextrestored"));assert.equal(generation,2);assert.equal(facade.bound,true);assert.equal(scheduler.size,0);scheduler.runAll();assert.equal(replacements.length,0);
 const restoredOps=hostCalls[1].map(([,operation,object])=>[operation,object?.id]);assert.deepEqual(restoredOps.slice(0,5),[["start",undefined],["resize",undefined],["add","player"],["add","ball"],["camera",undefined]]);
 assert.equal(runtimePort.copyCameraQuaternion({copy(){}}),true);assert.equal(runtimePort.requestRender(),true);adapter.teardown();
});

test("production factory routes startup failures immediately and context-loss timeout eventually routes Canvas",()=>{
 const replacements=[];const scheduler=createScheduler();const target=createTarget(replacements);const canvas=new FakeCanvas();
 const failed=createBrowserThreeSceneEnvironmentAdapter({target,document:{getElementById:()=>canvas},scheduleTimeout:(cb,d)=>scheduler.schedule(cb,d),cancelTimeout:(id)=>scheduler.cancel(id),createSceneHost:()=>({start(){throw new Error("boom");},resize(){},render(){},dispose(){}})});
 assert.equal(failed.attach(),false);assert.equal(replacements.length,1);assert.match(replacements[0],/renderer=canvas/);assert.equal(scheduler.size,0);failed.teardown();
 replacements.length=0;const live=createBrowserThreeSceneEnvironmentAdapter({target,document:{getElementById:()=>canvas},contextRestoreGraceMilliseconds:250,scheduleTimeout:(cb,d)=>scheduler.schedule(cb,d),cancelTimeout:(id)=>scheduler.cancel(id),createSceneHost:()=>({port:createDelegate("host",[]),start(){},resize(){},render(){return true;},dispose(){}})});
 assert.equal(live.attach(),true);canvas.dispatchEvent(new Event("webglcontextlost",{cancelable:true}));assert.equal(replacements.length,0);scheduler.runAll();assert.equal(replacements.length,1);assert.match(replacements[0],/renderer=canvas/);live.teardown();
});

test("teardown cancels a pending context-loss fallback",()=>{
 const replacements=[];const scheduler=createScheduler();const target=createTarget(replacements);const canvas=new FakeCanvas();const adapter=createBrowserThreeSceneEnvironmentAdapter({target,document:{getElementById:()=>canvas},scheduleTimeout:(cb,d)=>scheduler.schedule(cb,d),cancelTimeout:(id)=>scheduler.cancel(id),createSceneHost:()=>({port:createDelegate("host",[]),start(){},resize(){},render(){return true;},dispose(){}})});
 adapter.attach();canvas.dispatchEvent(new Event("webglcontextlost",{cancelable:true}));assert.equal(scheduler.size,1);adapter.teardown();assert.equal(scheduler.size,0);scheduler.runAll();assert.equal(replacements.length,0);
});
