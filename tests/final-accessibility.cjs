/* Local finishing checks; uses the existing Playwright installation. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const out=process.env.ARTIFACT_DIR||path.resolve(__dirname,'../artifacts/email-contact/accessibility');
fs.mkdirSync(out,{recursive:true});
const report={checks:[],contrast:[],focus:[],expandedText:[],errors:[]};
const origin=process.env.SITE_URL||'http://127.0.0.1:8000';
function contrast(a,b) {
  function light(v){return v.slice(0,3).map(x=>x/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((s,x,i)=>s+x*[.2126,.7152,.0722][i],0);}
  const x=light(a),y=light(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
}
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
 report.browser=browser.version(); report.platform=process.platform;
 try {
 for(const locale of ['en','fr']) {
  const context=await browser.newContext({viewport:{width:390,height:1000},reducedMotion:'reduce',permissions:['clipboard-read','clipboard-write']});
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  async function go(width){await page.setViewportSize({width,height:1000});await page.goto(origin+(locale==='fr'?'/fr/':'/'));await page.waitForFunction(()=>document.querySelector('#modify-state').textContent==='VALID');await page.evaluate(()=>document.fonts.ready);}
  await go(390);
  // Native keyboard navigation, including forward progress and the visible focus ring.
  for(let i=0;i<60;i++) {
   await page.keyboard.press('Tab');
   const focus=await page.evaluate(()=>{const e=document.activeElement,r=e.getBoundingClientRect(),s=getComputedStyle(e);return {tag:e.tagName,id:e.id,text:e.textContent.trim().slice(0,45),outline:s.outlineStyle,width:parseFloat(s.outlineWidth),visible:r.bottom>0&&r.top<innerHeight&&r.right>0&&r.left<innerWidth};});
   if(focus.tag==='BODY'){assert(i>=20,'unexpected early loss of document focus');break;}
   assert(focus.visible&&focus.outline==='solid'&&focus.width>=2,JSON.stringify(focus)); report.focus.push({locale,...focus});
  }
  report.checks.push({locale,name:'sequential Tab navigation until browser chrome: visible focus and no offscreen focused control',result:'PASS'});
  for(const width of [320,390,1440]) {
   await go(width);
   // Include the technical data and the always-visible email contact block.
   await page.evaluate(()=>{document.querySelectorAll('details').forEach(e=>e.open=true);document.querySelector('#extra-properties').hidden=false;});
   const textPairs=await page.evaluate(()=>{
    const rgb=s=>(s.match(/[\d.]+/g)||[]).map(Number);
    const results=[];
    const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
    while(walker.nextNode()) {
     const n=walker.currentNode,e=n.parentElement;if(!n.textContent.trim()||!e.checkVisibility()||e.closest('script,style,[aria-hidden=true]'))continue;
     const r=document.createRange();r.selectNodeContents(n);if(!r.getBoundingClientRect().width)continue;
     const s=getComputedStyle(e);if(e.closest(':disabled'))continue;
     let bg=[243,242,238,1];
     for(let p=e;p;p=p.parentElement){const c=rgb(getComputedStyle(p).backgroundColor);if(c[3]===undefined||c[3]===1){bg=c;break;}}
     results.push({text:n.textContent.trim().slice(0,60),fg:rgb(s.color),bg,size:parseFloat(s.fontSize),weight:parseFloat(s.fontWeight)});
    }
    return results;
   });
   const measured=textPairs.map(x=>({...x,ratio:contrast(x.fg,x.bg),required:x.size>=24||(x.size>=18.66&&x.weight>=700)?3:4.5}));
   const failures=measured.filter(x=>x.ratio<x.required);assert.deepEqual(failures,[]);
   report.contrast.push({locale,width,type:'rendered-text',count:measured.length,minRatio:Math.min(...measured.map(x=>x.ratio)),failures});
   const borders=await page.locator('select,textarea,input[type=text]').evaluateAll(elements=>elements.filter(e=>e.checkVisibility()).map(e=>{const s=getComputedStyle(e);const rgb=c=>c.match(/[\d.]+/g).map(Number);return {id:e.id,fg:rgb(s.borderTopColor),bg:rgb(s.backgroundColor)};}));
   for(const b of borders){b.ratio=contrast(b.fg,b.bg);report.contrast.push({locale,width,type:'control-border',...b});}
   // Report all concrete failures before failing the run.
   const badBorders=borders.filter(b=>b.ratio<3);
   if(badBorders.length) report.errors.push({locale,width,issue:'control-border contrast below 3:1',values:badBorders});
   await page.addStyleTag({content:'html { font-size:200%; }'});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);
   const clipped=await page.locator('h1,h2,h3,h4,p,summary,code,dd,label,button').evaluateAll(elements=>elements.filter(e=>e.checkVisibility()&&!e.closest('.byte-grid')).filter(e=>e.scrollWidth>e.clientWidth+1&&getComputedStyle(e).display!=='inline').map(e=>({tag:e.tagName,id:e.id,text:e.textContent.trim().slice(0,50),width:e.clientWidth,scroll:e.scrollWidth})));
   assert.deepEqual(clipped,[],'expanded content clipped at 200%');
   report.expandedText.push({locale,width,rootFontSize:'200%',detailsOpen:true,emailContactVisible:true,overflow:false,clipped:0});
   if(width===390)await page.locator('#feedback').screenshot({path:path.join(out,`${locale}-email-contact-200.png`)});
  }
  // Commands are copied with real keyboard activation.
  await go(390);
  for(const id of ['hero-install','verify-command','release-install','contact-email']) {
   await page.locator(`[data-copy-target=${id}]`).focus();await page.keyboard.press('Enter');
   assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),await page.locator('#'+id).textContent());
  }
  report.checks.push({locale,name:'three commands and email copy via keyboard',result:'PASS'});
  await page.locator('.languages a').filter({hasText:locale==='en'?'FR':'EN'}).last().click();
  assert.equal(await page.locator('html').getAttribute('lang'),locale==='en'?'fr':'en');
  await page.goBack();assert.equal(await page.locator('html').getAttribute('lang'),locale);
  report.checks.push({locale,name:'language navigation and browser Back',result:'PASS'});
  await context.close();
 }
 assert.deepEqual(report.errors,[]);
 report.result='PASS';
 } catch(e){report.result='FAIL';report.failure=String(e);throw e;}
 finally{fs.writeFileSync(path.join(out,'accessibility-results.json'),JSON.stringify(report,null,2)+'\n');await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
