/* Rear sitting regression: the physical stool stays still and occupies a single layer. */
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{})});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1100},locale:'en-US'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const url=pathToFileURL(path.resolve(__dirname,'../index.html')).href+'?date=2026-03-01&weather=clear';
  await page.goto(url);await page.evaluate(()=>localStorage.setItem('kobune.seat','"counter"'));await page.reload();await page.waitForTimeout(1700);
  assert.equal(await page.locator('#guest .occupied-stool-clear').count(),1);
  assert.equal(await page.locator('#guest .guest-stool-fixed').count(),1);
  assert.equal(await page.locator('#guest .guest-doll').getAttribute('data-integrated-stool'),'true');
  const fixed=[],upper=[];
  await page.evaluate(()=>document.querySelector('#guest .guest-doll').classList.add('act-wave'));
  for(let i=0;i<7;i++){
   fixed.push(await page.locator('#guest .guest-stool-fixed').evaluate(el=>{const m=el.getScreenCTM();return [m.a,m.b,m.c,m.d,m.e,m.f]}));
   upper.push(await page.locator('#guest .guest-upper').evaluate(el=>getComputedStyle(el).transform));
   await page.waitForTimeout(140);
  }
  fixed.forEach(m=>m.forEach((x,i)=>assert.ok(Math.abs(x-fixed[0][i])<.001,'stool does not move during greeting')));
  assert.ok(new Set(upper).size>2,'only upper-body layer performs the greeting');
  await page.locator('#guest .guest-hit').click();
  for(const wear of ['casual','kimono','yukata']){
   await page.locator('[data-k="clothing"][data-v="'+wear+'"]').click();
   for(const hair of ['short','bun','ponytail','long']){
    await page.locator('[data-k="hairStyle"][data-v="'+hair+'"]').click();
    assert.equal(await page.locator('#guest .guest-stool-fixed').count(),1);
   }
   await page.keyboard.press('Escape');await page.mouse.move(1400,10);await page.locator('#guest').blur();await page.waitForTimeout(150);
   await page.screenshot({path:'/tmp/rear-seat-'+wear+'.png',fullPage:true});
   await page.locator('#guest .guest-hit').click();
  }
  await page.locator('[data-k="outfit"][data-v="shu"]').click();await page.locator('[data-k="accessory"][data-v="hat"]').click();await page.keyboard.press('Escape');await page.mouse.move(1400,10);await page.waitForTimeout(150);
  await page.screenshot({path:'/tmp/rear-seat-hat.png',fullPage:true});
  await page.locator('#hud-seat').click();await page.locator('[data-seat="tatami"]').click();
  assert.equal(await page.locator('#guest .occupied-stool-clear, #guest .guest-stool-fixed').count(),0);
  await page.reload();await page.waitForTimeout(500);assert.equal(await page.locator('.scene').getAttribute('data-room'),'tatami');
  assert.deepEqual(errors,[]);
  console.log('PASS: one integrated stool for all12looks, old-chair clearing only when occupied, stationary stool during greeting, moving upper body, hat and color screenshots, tatami and reload.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
