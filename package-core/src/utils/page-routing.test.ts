import {describe,expect,it,vi} from "vitest";
import {matchesPage,runPageTask} from "./page-routing";

describe("route request ordering",()=>{
  it("waits for an old route write before reading it again, without blocking another route",async()=>{
    let finish!:()=>void;
    const pending=runPageTask("route-a",()=>new Promise<void>(r=>{finish=r}));
    const read=vi.fn(async()=>"saved");const next=runPageTask("route-a",read);
    expect(await runPageTask("route-b",async()=>"other page")).toBe("other page");
    expect(read).not.toHaveBeenCalled();finish();await pending;
    expect(await next).toBe("saved");
  });
  it("allows later route work to proceed after a failed request",async()=>{
    const failed=runPageTask("failure",async()=>{throw new Error("offline")});
    const next=runPageTask("failure",async()=>"reconnected");
    await expect(failed).rejects.toThrow("offline");expect(await next).toBe("reconnected");
  });
  it("matches the exact origin, pathname and hash while allowing query-only changes",()=>{
    expect(matchesPage("/app?sort=asc#/one","/app#/one","http://localhost")).toBe(true);
    expect(matchesPage("/app#/two","/app#/one","http://localhost")).toBe(false);
    expect(matchesPage("http://elsewhere/app#/one","/app#/one","http://localhost")).toBe(false);
  });
});
