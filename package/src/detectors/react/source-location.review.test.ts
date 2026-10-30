import { expect, it } from "vitest";
import { getSourceLocation } from "./source-location";

it('skips proxy and hook frames when the library bundle has been renamed',()=>{
 function Checkout(){
  const error=new Error('probe');
  error.stack='Error: probe\n    at Object.get (http://localhost/src/RenamedBundle.mjs:7000:12)\n    at exports.useState (http://localhost/vendor.js:12:3)\n    at Checkout (http://localhost/src/Checkout.tsx:33:4)';
  throw error;
 }
 const element=document.createElement('button');
 Object.assign(element,{'__reactFiber$renamed':{type:'button',return:{type:Checkout,return:null}}});
 expect(getSourceLocation(element)).toMatchObject({found:true,source:{fileName:'src/Checkout.tsx',lineNumber:33}});
});

it.each([
 '/_next/static/chunks/app_checkout_abc.js',
 '/_astro/ProductReview.C5RllQkM.js',
 '/assets/main-Ka8h-Yin.js',
])('does not report generated %s as original application source',(path)=>{
 function Checkout(){
  const error=new Error('probe');
  error.stack=`Error: probe\n    at Checkout (http://localhost${path}:3108:23)`;
  throw error;
 }
 const element=document.createElement('button');
 Object.assign(element,{'__reactFiber$chunk':{type:'button',return:{type:Checkout,return:null}}});
 expect(getSourceLocation(element).found).toBe(false);
});
