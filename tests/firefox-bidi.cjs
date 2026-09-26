/* Stock Firefox: WebDriver BiDi, no browser/driver installation.
   https://firefox-source-docs.mozilla.org/remote/index.html
   https://w3c.github.io/webdriver-bidi/ */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawn}=require('node:child_process');
const assert=require('node:assert/strict');
const out=process.env.ARTIFACT_DIR||path.resolve(__dirname,'../artifacts/email-contact/firefox');
fs.mkdirSync(out,{recursive:true});
const report={checks:[],widths:[],textZoom:[],screenshots:[],errors:[]};
const origin=process.env.SITE_URL||'http://127.0.0.1:8000';
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'aelitium-final-firefox-'));
fs.writeFileSync(path.join(profile,'user.js'),'user_pref("browser.shell.checkDefaultBrowser", false);\nuser_pref("browser.startup.homepage_override.mstone", "ignore");\n');
const proc=spawn(process.env.BROWSER_EXECUTABLE,['--headless','--no-remote','--profile',profile,'--remote-debugging-port','9322'],{stdio:['ignore','pipe','pipe']});
let logs='',socket,context,id=0;const pending=new Map();
proc.stdout.on('data',x=>logs+=x);proc.stderr.on('data',x=>logs+=x);
const delay=ms=>new Promise(r=>setTimeout(r,ms));
function command(method,params={}){return new Promise((resolve,reject)=>{const n=++id;const timer=setTimeout(()=>{pending.delete(n);reject(Error('BiDi timeout: '+method));},20000);pending.set(n,{resolve,reject,timer});socket.send(JSON.stringify({id:n,method,params}));});}
async function evaluate(expression){const r=await command('script.evaluate',{expression:`(async()=>JSON.stringify(await (${expression})))()`,target:{context},awaitPromise:true});if(r.type==='exception')throw Error(r.exceptionDetails.text);return r.result.value===undefined?undefined:JSON.parse(r.result.value);}
async function key(value){await command('input.performActions',{context,actions:[{type:'key',id:'keyboard',actions:[{type:'keyDown',value},{type:'keyUp',value}]}]});}
async function focus(selector){await evaluate(`document.querySelector(${JSON.stringify(selector)}).focus()`);}
async function activate(selector){await focus(selector);await key('\uE007');}
async function waitFor(expression){for(let i=0;i<100;i++){if(await evaluate(expression))return;await delay(100);}throw Error('Condition timed out: '+expression);}
async function load(locale,width){await command('browsingContext.setViewport',{context,viewport:{width,height:1000},devicePixelRatio:1});await command('browsingContext.navigate',{context,url:origin+(locale==='fr'?'/fr/':'/'),wait:'complete'});await waitFor("document.querySelector('#modify-state').textContent==='VALID'");await evaluate('document.fonts.ready.then(()=>true)');}
async function capture(locale,width,selector,name){await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView()`);await delay(300);const r=await command('browsingContext.captureScreenshot',{context,origin:'viewport',format:{type:'image/png'}});const file=`${locale}-${width}-${name}.png`;fs.writeFileSync(path.join(out,file),Buffer.from(r.data,'base64'));report.screenshots.push(file);}
async function check(name,fn){await fn();report.checks.push({name,result:'PASS'});console.log('PASS',name);}
(async()=>{
 try {
  for(let i=0;i<150&&!logs.includes('WebDriver BiDi listening');i++) {if(proc.exitCode!==null)throw Error('Firefox exited: '+logs);await delay(100);}
  if(!logs.includes('WebDriver BiDi listening'))throw Error('Firefox did not expose BiDi: '+logs);
  socket=new WebSocket('ws://127.0.0.1:9322/session');
  await new Promise((r,j)=>{socket.addEventListener('open',r,{once:true});socket.addEventListener('error',j,{once:true});});
  socket.addEventListener('message',event=>{const m=JSON.parse(event.data);if(pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);clearTimeout(p.timer);if(m.type==='error')p.reject(Error(m.error+': '+m.message));else p.resolve(m.result);}else if(m.method==='log.entryAdded'&&m.params.level==='error')report.errors.push(m.params.text);});
  const session=await command('session.new',{capabilities:{alwaysMatch:{}}});report.capabilities=session.capabilities;
  await command('session.subscribe',{events:['log.entryAdded']});
  context=(await command('browsingContext.create',{type:'tab'})).context;
  for(const locale of ['en','fr']) {
   await check(`${locale}: five responsive widths and final rendered pages`,async()=>{
    for(const width of [320,390,768,1024,1440]){await load(locale,width);assert.deepEqual(await evaluate('[innerWidth,document.documentElement.scrollWidth]'),[width,width]);report.widths.push({locale,width,overflow:false});if([390,1440].includes(width))await capture(locale,width,'#compare','compare');}
   });
   await check(`${locale}: native keyboard menu, focus, accordions and eight properties`,async()=>{
    await load(locale,390);await key('\uE004');assert.equal(await evaluate('document.activeElement.className'),'skip-link');
    await key('\uE007');assert.equal(await evaluate('document.activeElement.id'),'main');
    await activate('#menu-toggle');assert.equal(await evaluate("document.querySelector('#menu-toggle').getAttribute('aria-expanded')"),'true');
    await key('\uE004');assert.equal(await evaluate("document.activeElement.closest('nav').id"),'site-nav');
    assert.equal(await evaluate("getComputedStyle(document.activeElement).outlineStyle"),'solid');
    await key('\uE00C');assert.equal(await evaluate('document.activeElement.id'),'menu-toggle');
    assert.equal(await evaluate("document.querySelector('.states').open"),false);
    for(const selector of ['.states > summary','#canonical-step > summary','.boundaries > details > summary']){await activate(selector);assert.equal(await evaluate(`document.querySelector(${JSON.stringify(selector)}).parentElement.open`),true);}
    await activate('#toggle-properties');assert.equal(await evaluate("document.querySelector('#extra-properties').hidden"),false);
   });
   await check(`${locale}: Modify, Inspector and all Compare values`,async()=>{
    await evaluate("(()=>{const e=document.querySelector('#modify-choice');e.value='record-a-modified';e.dispatchEvent(new Event('change'));})()");
    assert.equal(await evaluate("document.querySelector('#modify-state').textContent"),'INVALID');
    assert.equal(await evaluate("getComputedStyle(document.querySelector('#modify-state')).color"),'rgb(165, 42, 42)');
    await activate('#reset-example');assert.equal(await evaluate("document.querySelector('#modify-state').textContent"),'VALID');
    await activate('[data-field=response]');assert.equal(await evaluate("document.querySelector('.selected-derived').dataset.derivedHash"),'response_hash');
    const fixtures=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../assets/examples/results.json')));
    for(const name of ['changed','not-comparable','unchanged','invalid']){
     let selector=`[data-comparison="${name}"]`;
     if(['unchanged','invalid'].includes(name)){await evaluate("document.querySelector('.other-scenarios').open=true");await evaluate(`(()=>{const e=document.querySelector('#compare-choice');e.value=${JSON.stringify(name)};e.dispatchEvent(new Event('change'));})()`);selector='[data-comparison="extra"]';}
     assert.equal(await evaluate(`document.querySelector(${JSON.stringify(selector+' .verdict')}).textContent`),fixtures.comparisons[name].result.status);
     await activate(selector+' .comparison-details > summary');
     const actual=await evaluate(`Array.from(document.querySelectorAll(${JSON.stringify(selector+' .comparison-metadata dd')}),e=>e.textContent)`),expected=fixtures.comparisons[name].result;
     assert.deepEqual(actual.slice(0,4),[expected.comparison_mode,expected.comparison_basis,expected.comparison_reason,String(expected.rc)]);
     const hashes=await evaluate(`Array.from(document.querySelectorAll(${JSON.stringify(selector+' .full-hash')}),e=>e.textContent)`);
     assert.deepEqual(hashes,['invocation_identity_hash','response_hash'].flatMap(f=>['a','b'].map(s=>expected[f+'_'+s])).filter(Boolean));
     await activate(selector+' .comparison-details > summary');
    }
   });
   await check(`${locale}: native keyboard command copy reports write success`,async()=>{
    for(const id of ['hero-install','verify-command','release-install']){await activate(`[data-copy-target=${id}]`);await waitFor(`document.querySelector('#${id}').closest('.copy-group').querySelector('.copy-status').textContent.match(/Copied|Copié/) !== null`);}
   });
   await check(`${locale}: email links by keyboard, email copy and language links`,async()=>{
    await evaluate("(()=>{window.emailActivations=[];document.addEventListener('click',event=>{const a=event.target.closest('a[href^=\"mailto:\"]');if(a){event.preventDefault();window.emailActivations.push(a.href);}});})()");
    const links=await evaluate("Array.from(document.querySelectorAll('a[data-email]'),a=>({kind:a.dataset.email,href:a.href}))");
    assert.equal(links.length,3);
    for(const link of links){const url=new URL(link.href);assert.equal(url.pathname,'hello@aelitium.com');assert.deepEqual([...url.searchParams],[['subject',link.kind==='feedback'?'[AELITIUM Feedback]':'[AELITIUM Contact]']]);}
    await activate('#feedback [data-email=feedback]');await activate('#feedback [data-email=contact]');await activate('.site-footer [data-email=contact]');
    assert.deepEqual(await evaluate('window.emailActivations'),links.map(x=>x.href));
    await activate('[data-copy-target=contact-email]');await waitFor("document.querySelector('#feedback .copy-status').textContent.match(/Copied|Copié/) !== null");
    assert.equal(await evaluate("document.querySelector('#contact-email').textContent"),'hello@aelitium.com');
    assert.equal(await evaluate("document.querySelectorAll('#feedback-flow,form,fieldset,textarea,input').length"),0);
    assert.deepEqual(await evaluate('[localStorage.length,sessionStorage.length,document.cookie]'),[0,0,'']);
    await capture(locale,390,'#feedback','email-contact');
    await activate(`.site-footer .languages a[lang=${locale==='en'?'fr':'en'}]`);await waitFor(`document.documentElement?.lang===${JSON.stringify(locale==='en'?'fr':'en')}`);
   });
   await check(`${locale}: 200% text with technical details and definitions expanded`,async()=>{
    for(const width of [320,390,1440]){await load(locale,width);await evaluate("(()=>{document.documentElement.style.fontSize='200%';document.querySelectorAll('details').forEach(e=>e.open=true);document.querySelector('#extra-properties').hidden=false;})()");assert.deepEqual(await evaluate('[innerWidth,document.documentElement.scrollWidth]'),[width,width]);report.textZoom.push({locale,width,rootFontSize:'200%',detailsOpen:true,overflow:false});}
   });
  }
  assert.deepEqual(report.errors,[]);report.result='PASS';
 }catch(e){report.result='FAIL';report.failure=String(e);throw e;}
 finally{
  if(socket?.readyState===WebSocket.OPEN){try{await command('browser.close');}catch{}socket.close();}
  if(proc.exitCode===null)proc.kill();
  fs.writeFileSync(path.join(out,'firefox-results.json'),JSON.stringify(report,null,2)+'\n');
  fs.writeFileSync(path.join(out,'firefox-process.txt'),logs);
  // Only the isolated profile created by this runner is eligible for cleanup.
  try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:3,retryDelay:200});}catch{}
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
