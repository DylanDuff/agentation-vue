import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, waitFor, within } from "./test-utils";
import { PageFeedbackToolbarCSS } from "../src";
import { loadAnnotations, saveAnnotations, saveDesignPlacements, saveSessionId, loadSessionId, getStorageKey } from "@agentation/core/utils/storage";
import type { Annotation } from "@agentation/core/types";

const path = "/hash-review";
const route = (name: string) => `${path}#/${name}`;
const root = () => document.querySelector("agentation-toolbar")!.shadowRoot! as unknown as HTMLElement;
const ui = () => within(root());
const annotation = (name: string): Annotation => ({id:name,x:50,y:100,comment:`Note for ${name}`,element:"button",elementPath:"main > button",timestamp:Date.now(),url:`http://localhost:3000${route(name)}`});
async function navigate(name: string) {
  await act(async () => { history.replaceState(null,"",route(name));window.dispatchEvent(new HashChangeEvent("hashchange")); });
}
const response = (value: unknown) => Promise.resolve({ok:true,json:async()=>value});
function deferred<T>() { let resolve!: (value:T)=>void;const promise=new Promise<T>(r=>{resolve=r});return {promise,resolve}; }
async function copy(onCopy: ReturnType<typeof vi.fn>) {
  if (ui().queryByRole("button",{name:"Start feedback mode"})) await fireEvent.click(ui().getByRole("button",{name:"Start feedback mode"}));
  await waitFor(()=>expect((ui().getByRole("button",{name:"Copy feedback"}) as HTMLButtonElement).disabled).toBe(false));
  onCopy.mockClear();await fireEvent.click(ui().getByRole("button",{name:"Copy feedback"}));
  await waitFor(()=>expect(onCopy).toHaveBeenCalledOnce());
  return onCopy.mock.calls[0][0] as string;
}
beforeEach(async () =>{
  localStorage.clear();sessionStorage.clear();history.replaceState(null,"",route("a"));
  vi.stubGlobal("EventSource",class {addEventListener(){} removeEventListener(){} close(){}});
  vi.spyOn(HTMLCanvasElement.prototype,"getContext").mockReturnValue(null);
});
afterEach(async () =>{cleanup();vi.unstubAllGlobals();vi.restoreAllMocks();history.replaceState(null,"","/");});

describe("hash route isolation",()=>{
  it("reads history API navigation when a router rerenders its Agentation wrapper", async () =>{
    saveAnnotations(route('a'),[annotation('a')]);saveAnnotations(route('b'),[annotation('b')]);
    const onCopy=vi.fn();const view=await render(<PageFeedbackToolbarCSS useHashLocation onCopy={onCopy} copyToClipboard={false}/>);
    expect(await copy(onCopy)).toContain('Note for a');
    await act(()=>{history.pushState(null,'',route('b'));});
    await view.rerender(<PageFeedbackToolbarCSS useHashLocation onCopy={onCopy} copyToClipboard={false}/>);
    expect(ui().getByRole('button',{name:'Exit'})).toBeTruthy();
    expect(await copy(onCopy)).toContain('Note for b');
  });

  it("does not restore cleared local notes when the initial session request arrives late", async () =>{
    saveSessionId(route('a'),'session-a');saveAnnotations(route('a'),[annotation('a')]);
    const slow=deferred<unknown>();const fetch=vi.fn((url:string,options?:RequestInit)=>
      url.endsWith('/sessions/session-a')?slow.promise:response({}));
    vi.stubGlobal('fetch',fetch);const onCopy=vi.fn();
    await render(<PageFeedbackToolbarCSS useHashLocation endpoint="http://late.test" onCopy={onCopy} copyToClipboard={false}/>);
    await copy(onCopy);await fireEvent.click(ui().getByRole('button',{name:'Clear all'}));
    await act(async()=>{slow.resolve({ok:true,json:async()=>({id:'session-a',url:`http://localhost:3000${route('a')}`,annotations:[annotation('a')]})});await slow.promise;});
    await navigate('b');
    await waitFor(()=>expect(fetch).toHaveBeenCalledWith('http://late.test/annotations/a',expect.objectContaining({method:'DELETE'})));
    expect(loadAnnotations(route('a'))).toEqual([]);
  });

  it.each([false, true])("keeps the new marker mounted when sync assigns its permanent ID (entered: %s)", async (entered) => {
    saveSessionId(route("a"), "session-a");
    const slow = deferred<unknown>();
    vi.stubGlobal("fetch", vi.fn((url: string, options?: RequestInit) => {
      if (options?.method === "POST") return slow.promise;
      return response(url.endsWith("/health") ? {} : {
        id: "session-a", url: `http://localhost:3000${route("a")}`, annotations: [],
      });
    }));
    const added = vi.fn();
    await render(<><p data-testid="target">Synced target</p><PageFeedbackToolbarCSS useHashLocation endpoint="http://save.test" onAnnotationAdd={added}/></>);
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
    await fireEvent.click(ui().getByRole("button", { name: "Start feedback mode" }));
    const target = document.querySelector('[data-testid="target"]')!;
    const originalPoint = document.elementFromPoint;
    document.elementFromPoint = () => target;
    try { await fireEvent.click(target, { clientX: 150, clientY: 120 }); }
    finally { document.elementFromPoint = originalPoint; }
    const pending = ui().getByRole("button", { name: "Pending annotation" });
    if (entered) await fireEvent.animationEnd(pending);
    await fireEvent.input(ui().getByRole("textbox"), { target: { value: "Synced note" } });
    await fireEvent.click(ui().getByRole("button", { name: "Add" }));
    const marker = root().querySelector("[data-annotation-marker]");
    expect(marker).toBe(pending);
    await act(async () => {
      slow.resolve({ ok: true, json: async () => ({ ...added.mock.calls[0][0], id: "permanent-id" }) });
      await slow.promise;
    });
    await waitFor(() => expect(loadAnnotations<Annotation>(route("a"))[0].id).toBe("permanent-id"));
    expect(root().querySelector("[data-annotation-marker]")).toBe(marker);
    expect(marker!.className).toContain(entered ? "confirm" : "enter");
    await fireEvent.animationEnd(marker!);
    expect(marker!.className).not.toMatch(/confirm|enter/);
  });

  it.each([false,true])("settles a pending save before returning to its route (cleared: %s)",async (clear)=>{
    saveSessionId(route("a"),"session-a");saveSessionId(route("b"),"session-b");
    const slow=deferred<unknown>();let saved:Annotation[]=[];
    const fetch=vi.fn((url:string,options?:RequestInit)=>{
      if(options?.method==='POST')return slow.promise;
      if(options?.method==='DELETE'){
        saved=saved.filter(a=>!url.endsWith(`/annotations/${a.id}`));return response({});
      }
      return response(url.endsWith('/health')?{}:{id:url.endsWith('session-a')?'session-a':'session-b',url:`http://localhost:3000${route(url.endsWith('session-a')?'a':'b')}`,annotations:url.endsWith('session-a')?saved:[]});
    });
    vi.stubGlobal("fetch",fetch);const added=vi.fn();const onCopy=vi.fn();
    await render(<><p data-testid="target">Route content</p><PageFeedbackToolbarCSS useHashLocation endpoint="http://save.test" onAnnotationAdd={added} onCopy={onCopy} copyToClipboard={false}/></>);
    await waitFor(()=>expect(loadSessionId(route("a"))).toBe('session-a'));
    await act(async()=>{await new Promise(r=>setTimeout(r,20));});
    await fireEvent.click(ui().getByRole('button',{name:'Start feedback mode'}));
    const target=document.querySelector('[data-testid="target"]')!;
    vi.spyOn(target,'getBoundingClientRect').mockReturnValue(new DOMRect(100,100,200,40));
    const originalPoint=document.elementFromPoint;
    document.elementFromPoint=()=>target;
    try {await fireEvent.click(target,{clientX:150,clientY:120});} finally {document.elementFromPoint=originalPoint;}
    await fireEvent.input(ui().getByRole('textbox'),{target:{value:'Pending save on A'}});
    await fireEvent.click(ui().getByRole('button',{name:'Add'}));
    await waitFor(()=>expect(fetch.mock.calls.some(([,o])=>o?.method==='POST')).toBe(true));
    if(clear)await fireEvent.click(ui().getByRole('button',{name:'Clear all'}));
    await navigate('b');await navigate('a');
    expect(fetch.mock.calls.filter(([url])=>url==='http://save.test/sessions/session-a')).toHaveLength(1);
    saved=[{...added.mock.calls[0][0],id:'server-assigned'}];
    await act(async()=>{slow.resolve({ok:true,json:async()=>saved[0]});await slow.promise;});
    await waitFor(()=>expect(fetch.mock.calls.filter(([url])=>url==='http://save.test/sessions/session-a')).toHaveLength(2));
    if(clear){
      expect(saved).toEqual([]);expect(loadAnnotations(route('a'))).toEqual([]);
    }else{
      expect(await copy(onCopy)).toContain('Pending save on A');
      expect(loadAnnotations<Annotation>(route('a'))[0].id).toBe('server-assigned');
    }
    expect(fetch.mock.calls.filter(([,o])=>o?.method==='POST')).toHaveLength(1);
  });

  it("switches notes and layout state while retaining the open toolbar and legacy data", async () =>{
    const legacy = [annotation("legacy")];saveAnnotations(path,legacy);
    for(const name of ["a","b"]){
      saveAnnotations(route(name),[annotation(name)]);
      saveDesignPlacements(route(name),[{id:name,type:"text",x:30,y:60,width:100,height:30,text:`Layout for ${name}`,timestamp:Date.now()}]);
    }
    const onCopy=vi.fn();await render(<PageFeedbackToolbarCSS useHashLocation copyToClipboard={false} onCopy={onCopy}/>);
    const first=await copy(onCopy);expect(first).toContain("Note for a");expect(first).toContain("Layout for a");expect(first).not.toContain("Note for b");
    await navigate("b");
    expect(ui().getByRole("button",{name:"Exit"})).toBeTruthy();
    const second=await copy(onCopy);expect(second).toContain("Note for b");expect(second).toContain("Layout for b");expect(second).not.toContain("Note for a");expect(second).not.toContain("Layout for a");
    await navigate("a");expect(await copy(onCopy)).toContain("Note for a");
    expect(loadAnnotations(path)).toEqual(legacy);
    expect(loadAnnotations<Annotation>(route("b"))[0].comment).toBe("Note for b");
  });

  it("leaves ordinary fragment navigation on the existing pathname storage by default", async () =>{
    saveAnnotations(path,[annotation("legacy")]);const onCopy=vi.fn();await render(<PageFeedbackToolbarCSS copyToClipboard={false} onCopy={onCopy}/>);
    expect(await copy(onCopy)).toContain("Note for legacy");await navigate("b");expect(await copy(onCopy)).toContain("Note for legacy");
    expect(localStorage.getItem(getStorageKey(route("b")))).toBeNull();
  });

  it("does not display a late session response on another route", async () =>{
    saveSessionId(route("a"),"session-a");saveSessionId(route("b"),"session-b");
    const slow=deferred<unknown>();
    const fetch=vi.fn((url: string)=>url.endsWith('/sessions/session-a')?slow.promise:response(url.endsWith('/health')?{}:{id:"session-b",url:`http://localhost:3000${route("b")}`,annotations:[annotation("b")]}));
    vi.stubGlobal("fetch",fetch);const onCopy=vi.fn();
    await render(<PageFeedbackToolbarCSS useHashLocation endpoint="http://review.test" onCopy={onCopy} copyToClipboard={false}/>);
    await waitFor(()=>expect(fetch).toHaveBeenCalledWith("http://review.test/sessions/session-a"));
    await navigate("b");expect(await copy(onCopy)).toContain("Note for b");
    await act(async()=>{slow.resolve({ok:true,json:async()=>({id:"session-a",url:`http://localhost:3000${route("a")}`,annotations:[annotation("a")]})});await slow.promise;});
    expect(await copy(onCopy)).toContain("Note for b");
    expect(loadSessionId(route("b"))).toBe("session-b");
  });

  it("filters a deliberately shared server session by the selected hash route", async () =>{
    vi.stubGlobal("fetch",vi.fn(()=>response({id:"shared",url:`http://localhost:3000${path}`,annotations:[annotation("a"),annotation("b")]})));
    const onCopy=vi.fn();await render(<PageFeedbackToolbarCSS useHashLocation endpoint="http://review.test" sessionId="shared" onCopy={onCopy} copyToClipboard={false}/>);
    const first=await copy(onCopy);expect(first).toContain("Note for a");expect(first).not.toContain("Note for b");
    await navigate("b");const second=await copy(onCopy);expect(second).toContain("Note for b");expect(second).not.toContain("Note for a");
  });

  it("persists Clear before navigation without letting its old animation erase a later visit", async () =>{
    saveAnnotations(route("a"),[annotation("a")]);saveAnnotations(route("b"),[annotation("b")]);
    const onCopy=vi.fn();await render(<PageFeedbackToolbarCSS useHashLocation onCopy={onCopy} copyToClipboard={false}/>);
    await copy(onCopy);await fireEvent.click(ui().getByRole("button",{name:"Clear all"}));
    expect(loadAnnotations(route("a"))).toEqual([]);
    await navigate("b");expect(await copy(onCopy)).toContain("Note for b");
    saveAnnotations(route("a"),[{...annotation("new-a"),url:`http://localhost:3000${route("a")}`}]);
    await navigate("a");expect(await copy(onCopy)).toContain("Note for new-a");
    await act(async()=>{await new Promise(r=>setTimeout(r,300));});
    expect(loadAnnotations<Annotation>(route("a"))[0].comment).toBe("Note for new-a");
    expect(loadAnnotations<Annotation>(route("b"))[0].comment).toBe("Note for b");
  });

  it("finishes a pending session for its original URL and reuses it on return", async () =>{
    const slow=deferred<unknown>();const created=vi.fn();
    const fetch=vi.fn((url:string,options?:RequestInit)=>{
      if(url.endsWith('/health'))return response({});
      if(options?.method==='POST'){
        const body=JSON.parse(options.body as string);
        return body.url.endsWith('#/a')?slow.promise:response({id:"new-b",url:body.url});
      }
      return response({id:"new-a",url:`http://localhost:3000${route("a")}`,annotations:[annotation("a")]});
    });
    vi.stubGlobal("fetch",fetch);const onCopy=vi.fn();
    await render(<PageFeedbackToolbarCSS useHashLocation endpoint="http://create.test" onSessionCreated={created} onCopy={onCopy} copyToClipboard={false}/>);
    await waitFor(()=>expect(fetch).toHaveBeenCalledWith("http://create.test/sessions",expect.objectContaining({method:"POST"})));
    await navigate("b");await waitFor(()=>expect(created).toHaveBeenCalledWith("new-b"));
    await act(async()=>{slow.resolve({ok:true,json:async()=>({id:"new-a",url:`http://localhost:3000${route("a")}`})});await slow.promise;});
    await waitFor(()=>expect(loadSessionId(route("a"))).toBe("new-a"));
    expect(created).toHaveBeenCalledTimes(1);
    await navigate("a");expect(await copy(onCopy)).toContain("Note for a");
    expect(fetch.mock.calls.filter(([,options])=>options?.method==='POST')).toHaveLength(2);
  });
});
