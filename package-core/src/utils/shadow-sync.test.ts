import { afterEach, describe, expect, it, vi } from "vitest";
import { createShadowSync } from "./shadow-sync";
import type { Annotation } from "../types";
const annotation: Annotation = {id:"layout",x:1,y:2,comment:"Before",element:"button",elementPath:"[placement]",timestamp:1,kind:"placement",placement:{componentType:"button",width:100,height:30,scrollY:0,text:"Before"}};
function deferred<T>() { let resolve!: (value:T)=>void; const promise=new Promise<T>(r=>{resolve=r;});return {promise,resolve}; }
function setup(){const ids=new Map<string,string>();const transport={create:vi.fn(async(a:Annotation)=>({...a,id:"server"})),update:vi.fn(async(id:string,a:Annotation)=>({...a,id})),remove:vi.fn(async()=>{})};const queue=createShadowSync(transport,ids);return {ids,transport,queue};}
afterEach(()=>vi.restoreAllMocks());
describe("layout sync",()=>{
 it("reuses persisted layout records after reload",async()=>{
  const {transport,ids}=setup();
  const queue=createShadowSync(transport,ids,[{...annotation,id:"saved-server-id",url:"http://review.localhost/"}]);
  queue.replace([{...annotation,comment:"Edited after reload",url:"/"}]);
  await vi.waitFor(()=>expect(transport.update).toHaveBeenCalledOnce());
  expect(transport.create).not.toHaveBeenCalled();
  expect(transport.update.mock.calls[0][0]).toBe("saved-server-id");queue.dispose();
 });
 it("delivers edits made during creation without a second create",async()=>{
  const {queue,transport}=setup();const creation=deferred<Annotation>();transport.create.mockReturnValueOnce(creation.promise);
  queue.replace([annotation]);queue.replace([{...annotation,comment:"After",placement:{...annotation.placement!,text:"After"}}]);
  creation.resolve({...annotation,id:"server"});
  await vi.waitFor(()=>expect(transport.update).toHaveBeenCalledOnce());
  expect(transport.create).toHaveBeenCalledOnce();expect(transport.update.mock.calls[0][1].placement?.text).toBe("After");queue.dispose();
 });
 it("serializes updates and coalesces the newest edit",async()=>{
  const {queue,transport}=setup();queue.replace([annotation]);await vi.waitFor(()=>expect(transport.create).toHaveBeenCalledOnce());await Promise.resolve();
  const update=deferred<Annotation>();transport.update.mockReturnValueOnce(update.promise);
  queue.replace([{...annotation,comment:"Second"}]);queue.replace([{...annotation,comment:"Third"}]);queue.replace([{...annotation,comment:"Fourth"}]);
  expect(transport.update).toHaveBeenCalledOnce();update.resolve({...annotation,id:"server",comment:"Second"});
  await vi.waitFor(()=>expect(transport.update).toHaveBeenCalledTimes(2));expect(transport.update.mock.calls[1][1].comment).toBe("Fourth");queue.dispose();
 });
 it("retries a failed update without recording it as synced",async()=>{
  vi.spyOn(console,"warn").mockImplementation(()=>{});
  const {queue,transport}=setup();queue.replace([annotation]);await Promise.resolve();await Promise.resolve();
  transport.update.mockRejectedValueOnce(new Error("offline"));queue.replace([{...annotation,comment:"Retry me"}]);
  await vi.waitFor(()=>expect(transport.update).toHaveBeenCalledTimes(2),{timeout:1500});
  expect(transport.update.mock.calls[1][1].comment).toBe("Retry me");queue.dispose();
 });
 it("deletes a placement removed while creation is in flight",async()=>{
  const {queue,transport}=setup();const creation=deferred<Annotation>();transport.create.mockReturnValueOnce(creation.promise);
  queue.replace([annotation]);queue.replace([]);creation.resolve({...annotation,id:"server"});
  await vi.waitFor(()=>expect(transport.remove).toHaveBeenCalledWith("server"));queue.dispose();
 });
 it("does not duplicate unchanged annotations or retry after disposal",async()=>{
  vi.spyOn(console,"warn").mockImplementation(()=>{});
  const {queue,transport}=setup();queue.replace([annotation]);await Promise.resolve();await Promise.resolve();queue.replace([annotation]);expect(transport.update).not.toHaveBeenCalled();
  transport.update.mockRejectedValue(new Error("offline"));queue.replace([{...annotation,comment:"Pending"}]);await Promise.resolve();await Promise.resolve();queue.dispose();
  await new Promise(resolve=>setTimeout(resolve,600));expect(transport.update).toHaveBeenCalledOnce();
 });
});
