import { describe, expect, it } from "vitest";
import { generateDesignOutput, generateRearrangeOutput } from "./output";
import type { DesignPlacement, RearrangeState } from "./types";
const placement: DesignPlacement = {id:"button",type:"button",x:10,y:20,width:100,height:30,scrollY:0,timestamp:1,text:"Use a clearer label"};
const rect={x:10,y:20,width:100,height:30};
const state: RearrangeState = {sections:[{id:"section",label:"Header",tagName:"header",selector:"header",role:null,className:null,textSnippet:null,originalRect:rect,currentRect:rect,originalIndex:0,note:"Make this easier to scan"}],originalOrder:["section"],detectedAt:1};
describe("layout notes in copied feedback",()=>{
 it.each(["compact","standard","detailed","forensic"] as const)("includes placement and note-only section feedback at %s detail",detail=>{
  expect(generateDesignOutput([placement],{width:1000,height:800},undefined,detail)).toContain(placement.text);
  const output=generateRearrangeOutput(state,detail,{width:1000,height:800});
  expect(output).toContain("note only");expect(output).toContain(state.sections[0].note);
 });
 it("keeps a note when a moved section returns to its original geometry",()=>{
  const moved={...state,sections:[{...state.sections[0],currentRect:{...rect,y:70}}]};
  expect(generateRearrangeOutput(moved)).toContain("Make this easier to scan");
  expect(generateRearrangeOutput(state)).toContain("Make this easier to scan");
  expect(generateRearrangeOutput({...state,sections:[{...state.sections[0],note:""}]})).toBe("");
 });
});
