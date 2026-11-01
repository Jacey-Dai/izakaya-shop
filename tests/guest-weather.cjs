/* Verify connected guest poses and material-based weather in the actual page. */
const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{})});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1100},locale:'en-US'});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    const url=pathToFileURL(path.resolve(__dirname,'../index.html')).href;
    await page.goto(url+'?date=2026-10-31&weather=rain');
    await page.evaluate(()=>localStorage.setItem('kobune.seat','"counter"'));
    await page.reload();await page.waitForTimeout(1700);
    assert.equal(await page.locator('.guest-legs,.guest-forearm').count(),0);
    assert.equal(await page.locator('#guest image[href="assets/art/guest-stool.webp"]').count(),1);
    assert.equal(await page.locator('.rain image').count(),2);
    assert.equal(await page.locator('.rain-fall,.rain-drop,#rain-pat').count(),0);
    assert.equal(await page.locator('.deco-pumpkin image[href="assets/art/pumpkin.webp"]').count(),2);
    assert.equal(await page.locator('.deco-umbrella image[href="assets/art/umbrella.webp"]').count(),2);
    // Frame sampling catches a joint popping into existence or the hip moving off the seat.
    await page.evaluate(()=>{document.querySelector('.chef-idle').style.animation='none';document.querySelector('#guest .guest-doll').classList.add('act-wave')});
    const anchors=[];
    for(let i=0;i<7;i++){
      anchors.push(await page.locator('#guest .guest-doll').evaluate(el=>{const p=new DOMPoint(0,0).matrixTransform(el.getCTM());return [p.x,p.y]}));
      assert.equal(await page.locator('.guest-legs,.guest-forearm').count(),0);
      await page.screenshot({path:'/tmp/guest-greet-'+i+'.png',clip:{x:610,y:460,width:220,height:330}});
      await page.waitForTimeout(120);
    }
    assert.ok(anchors.every(([x,y])=>Math.abs(x-anchors[0][0])<.01&&Math.abs(y-anchors[0][1])<.01),'hip stays anchored through greeting');
    await page.waitForTimeout(300);await page.mouse.move(1400,10);await page.screenshot({path:'/tmp/guest-weather-counter.png',fullPage:true});
    await page.locator('#guest .guest-hit').click();
    for(const wear of ['casual','kimono','yukata']){
      await page.locator('[data-k="clothing"][data-v="'+wear+'"]').click();
      for(const hair of ['short','bun','ponytail','long']){
        await page.locator('[data-k="hairStyle"][data-v="'+hair+'"]').click();
        assert.equal(await page.locator('#guest .guest-doll').getAttribute('data-pose'),'stool');
        assert.equal(await page.locator('#guest image[href="assets/art/guest-stool.webp"]').count(),1);
        assert.equal(await page.locator('.guest-legs,.guest-forearm').count(),0);
      }
    }
    await page.locator('[data-k="accessory"][data-v="hat"]').click();
    await page.keyboard.press('Escape');
    assert.match(await page.locator('#guest .guest-hat-clearance').getAttribute('clip-path'),/hat-clearance/);
    assert.match(await page.locator('#guest clipPath[id$="hat-clearance"] path').getAttribute('d'),/V100/);
    await page.mouse.move(1400,10);await page.screenshot({path:'/tmp/guest-weather-hat.png',fullPage:true});
    await page.evaluate(()=>localStorage.setItem('kobune.seat','"tatami"'));
    await page.reload();await page.waitForTimeout(1800);
    assert.equal(await page.locator('#guest image[href="assets/art/guest-dolls.webp"]').count(),1);
    await page.screenshot({path:'/tmp/guest-weather-tatami.png',fullPage:true});
    await page.emulateMedia({reducedMotion:'reduce'});
    assert.equal(await page.locator('.rain-glint').first().evaluate(e=>getComputedStyle(e).animationName),'none');
    assert.equal(await page.locator('#guest .guest-doll').evaluate(e=>getComputedStyle(e).animationName),'none');
    await page.goto(url+'?date=2026-03-01&weather=clear');
    assert.equal(await page.locator('.rain,.deco-pumpkin,.deco-umbrella').count(),0);
    assert.deepEqual(errors,[]);
    console.log('PASS: 12 complete stool looks, hip-anchored greeting frame samples, no detached limbs, miniature Halloween/rain assets, floor pose, clear weather and reduced motion.');
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
