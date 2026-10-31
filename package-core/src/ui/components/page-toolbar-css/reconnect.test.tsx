import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import { PageFeedbackToolbarCSS } from "./index";
import * as timing from "../../../utils/freeze-animations";
import { saveAnnotations, loadAnnotations } from "../../../utils/storage";
import type { Annotation } from "../../../types";

const root = () => within(document.querySelector("agentation-toolbar")!.shadowRoot! as unknown as HTMLElement);
const note = (id: string): Annotation => ({id,x:20,y:50,comment:`Keep ${id}`,element:"button",elementPath:"#target",timestamp:Date.now(),status:"pending"});
const response = (data: unknown) => Promise.resolve({ok:true,json:async()=>data});
const notFound = () => Promise.resolve({ok:false,status:404,json:async()=>({error:"Annotation not found"})});
const intervals: Array<() => unknown> = [];
class Source extends EventTarget {
  static instances: Source[] = [];
  static CLOSED = 2;
  readyState = 1;
  constructor(public url: string) { super(); Source.instances.push(this); }
  close() { this.readyState = 2; }
}
beforeEach(()=>{
  localStorage.clear();sessionStorage.clear();history.replaceState(null,"","/reconnect-test");
  intervals.length=0;Source.instances=[];
  vi.stubGlobal("EventSource",Source);
  vi.spyOn(HTMLCanvasElement.prototype,"getContext").mockReturnValue(null);
  vi.spyOn(timing,"originalSetInterval").mockImplementation((callback:any)=>{
    intervals.push(callback);return setInterval(()=>{},60000);
  });
});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();history.replaceState(null,"","/");});

it.each(["edit", "delete"])("preserves a local %s while an existing session is loading", async (change) => {
  const original = note("loading-session");
  saveAnnotations("/reconnect-test", [original]);
  let finishJoin!: (value: unknown) => void;
  const joining = new Promise(resolve => { finishJoin = resolve; });
  const fetchMock = vi.fn((url: string, options?: RequestInit) => {
    if (url.endsWith("/sessions/session") && !options?.method) return joining;
    return response({});
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<PageFeedbackToolbarCSS endpoint="http://reconnect.test" sessionId="session" />);
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("http://reconnect.test/sessions/session"));
  fireEvent.click(root().getByRole("button", { name: "Start feedback mode" }));
  fireEvent.click(root().getByRole("button", { name: /^Edit annotation 1:/ }));
  if (change === "edit") {
    fireEvent.change(root().getByDisplayValue(original.comment), { target: { value: "Keep the newer edit" } });
    fireEvent.click(root().getByRole("button", { name: "Save" }));
  } else {
    fireEvent.click(root().getByRole("button", { name: "Delete annotation" }));
  }
  const expected = change === "edit" ? ["Keep the newer edit"] : [];
  await waitFor(() => expect(loadAnnotations<Annotation>("/reconnect-test").map(a => a.comment)).toEqual(expected));
  await act(async () => finishJoin({ ok: true, json: async () => ({ id: "session", annotations: [original] }) }));
  await waitFor(() => expect(Source.instances.length).toBe(1));
  expect(loadAnnotations<Annotation>("/reconnect-test").map(a => a.comment)).toEqual(expected);
});

it.each(["periodic check", "stream reopen"])("removes missed resolutions on %s while preserving other feedback",async(trigger)=>{
  let remote=[note("resolved-later"),note("still-pending")];
  saveAnnotations("/reconnect-test",remote);
  vi.stubGlobal("fetch",vi.fn((url:string)=>response(url.endsWith("/health")?{}:{id:"session",annotations:remote})));
  const copied=vi.fn();
  render(<PageFeedbackToolbarCSS endpoint="http://reconnect.test" sessionId="session" copyToClipboard={false} onCopy={copied}/>);
  await waitFor(()=>expect(Source.instances.length).toBe(1));
  fireEvent.click(root().getByRole("button",{name:"Start feedback mode"}));
  await waitFor(()=>expect(root().getByRole("button",{name:"Copy feedback"}).hasAttribute("disabled")).toBe(false));
  remote=[{...remote[0],status:"resolved"},remote[1]];
  await act(async()=>{
    if(trigger==="periodic check") for(const tick of intervals) await tick();
    else Source.instances[0].dispatchEvent(new Event("open"));
  });
  await waitFor(()=>expect(loadAnnotations<Annotation>("/reconnect-test").map(a=>a.id)).toEqual(["still-pending"]));
  await waitFor(()=>expect(document.querySelector("agentation-toolbar")!.shadowRoot!.querySelectorAll("[data-annotation-marker]")).toHaveLength(1));
  fireEvent.click(root().getByRole("button",{name:"Copy feedback"}));
  await waitFor(()=>expect(copied).toHaveBeenCalledOnce());
  expect(copied.mock.calls[0][0]).toContain("Keep still-pending");
  expect(copied.mock.calls[0][0]).not.toContain("Keep resolved-later");
});

it.each([
  ["join", "edit"], ["join", "delete"],
  ["new session", "edit"], ["new session", "delete"],
])("keeps a local change during an annotation upload (%s, %s)", async (sessionMode, change) => {
  const original = note("uploading-note");
  saveAnnotations("/reconnect-test", [original]);
  let finishUpload!: (value: unknown) => void;
  const uploading = new Promise(resolve => { finishUpload = resolve; });
  const fetchMock = vi.fn((url: string, options?: RequestInit) => {
    if (url.endsWith("/sessions/session/annotations") && options?.method === "POST") return uploading;
    // The server has never seen this stored note, so the toolbar uploads it.
    if (url.endsWith("/annotations/uploading-note") && !options?.method) return notFound();
    return response(url.endsWith("/health") ? {} : { id: "session", annotations: [] });
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<PageFeedbackToolbarCSS endpoint="http://reconnect.test" sessionId={sessionMode === "join" ? "session" : undefined} />);
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("http://reconnect.test/sessions/session/annotations", expect.objectContaining({ method: "POST" })));
  fireEvent.click(root().getByRole("button", { name: "Start feedback mode" }));
  fireEvent.click(root().getByRole("button", { name: /^Edit annotation 1:/ }));
  if (change === "edit") {
    fireEvent.change(root().getByDisplayValue(original.comment), { target: { value: "Keep edit during upload" } });
    fireEvent.click(root().getByRole("button", { name: "Save" }));
  } else {
    fireEvent.click(root().getByRole("button", { name: "Delete annotation" }));
  }
  fetchMock.mockClear();
  await act(async () => finishUpload({ ok: true, json: async () => ({ ...original, id: "server-note", sessionId: "session" }) }));
  await waitFor(() => expect(loadAnnotations<Annotation>("/reconnect-test")).toEqual(change === "edit" ? [
    expect.objectContaining({ id: "server-note", comment: "Keep edit during upload" }),
  ] : []));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("http://reconnect.test/annotations/server-note", expect.objectContaining(change === "edit" ? {
    method: "PATCH", body: JSON.stringify({ comment: "Keep edit during upload" }),
  } : { method: "DELETE" })));
});

it.each([
  ["pending", ["synced-earlier"]],
  ["resolved", []],
])("never re-uploads a note already on the server in another session (%s)", async (status, expected) => {
  // Synced under an earlier session, so the stored copy already has its server ID.
  saveAnnotations("/reconnect-test", [{ ...note("synced-earlier"), sessionId: "earlier" }]);
  const fetchMock = vi.fn((url: string, options?: RequestInit) => {
    if (url.endsWith("/annotations/synced-earlier") && !options?.method) {
      return response({ ...note("synced-earlier"), sessionId: "earlier", status });
    }
    return response(url.endsWith("/health") ? {} : { id: "session", annotations: [] });
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<PageFeedbackToolbarCSS endpoint="http://reconnect.test" sessionId="session" />);
  await waitFor(() => expect(Source.instances.length).toBe(1));
  await waitFor(() => expect(loadAnnotations<Annotation>("/reconnect-test").map(a => a.id)).toEqual(expected));
  expect(fetchMock).not.toHaveBeenCalledWith(expect.stringMatching(/\/annotations$/), expect.objectContaining({ method: "POST" }));
});

it("uploads only notes the server has never seen when a new session starts", async () => {
  saveAnnotations("/reconnect-test", [note("on-server"), note("local-only")]);
  const fetchMock = vi.fn((url: string, options?: RequestInit) => {
    if (url.endsWith("/annotations/on-server") && !options?.method) return response({ ...note("on-server"), sessionId: "earlier" });
    if (url.endsWith("/annotations/local-only") && !options?.method) return notFound();
    if (url.endsWith("/sessions/fresh/annotations")) return response({ ...note("local-only"), id: "fresh-id", sessionId: "fresh" });
    return response(url.endsWith("/health") ? {} : { id: "fresh", url: "http://localhost/reconnect-test", annotations: [] });
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<PageFeedbackToolbarCSS endpoint="http://reconnect.test" />);
  await waitFor(() => expect(loadAnnotations<Annotation>("/reconnect-test").map(a => a.id).sort()).toEqual(["fresh-id", "on-server"]));
  const posts = fetchMock.mock.calls.filter(([url, options]) => url.endsWith("/annotations") && options?.method === "POST");
  expect(posts.map(([, options]) => JSON.parse(options!.body as string).id)).toEqual(["local-only"]);
});
