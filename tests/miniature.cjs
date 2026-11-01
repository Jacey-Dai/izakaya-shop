/* Focused art regression: bounded sprites, actual cat clicks and local action layers. */
const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const browser = await chromium.launch({headless:true, ...(process.env.CHROME_EXECUTABLE ? {executablePath:process.env.CHROME_EXECUTABLE} : {})});
  try {
    const page = await browser.newPage({viewport:{width:1440,height:1100},locale:'en-US'});
    const errors = []; page.on('pageerror',e=>errors.push(e.message));
    const url = pathToFileURL(path.resolve(__dirname,'../index.html')).href + '?date=2026-03-01&weather=clear';
    await page.goto(url); await page.waitForSelector('#shop-cat image');
    await page.locator('#shop-cat').click();
    assert.equal(await page.locator('#shop-cat').getAttribute('data-pose'),'4');
    assert.match(await page.locator('#live-status').textContent(),/Mikan/);
    await page.evaluate(()=>{localStorage.setItem('kobune.seat','"tatami"');});
    await page.reload(); await page.waitForSelector('#shop-cat image');
    assert.equal(await page.locator('.scene').getAttribute('data-room'),'tatami');
    await page.locator('#shop-cat').click(); assert.equal(await page.locator('#shop-cat').getAttribute('data-pose'),'4');
    await page.locator('#lang-toggle').click(); await page.locator('#shop-cat').focus(); await page.keyboard.press('Enter');
    assert.match(await page.locator('#live-status').textContent(),/小橘/);
    await page.addStyleTag({content:'*,*::before,*::after { animation:none !important; transition:none !important; }'});
    await page.screenshot({path:'/tmp/miniature-tatami.png',fullPage:true});
    await page.locator('#back-counter').click();
    await page.evaluate(()=>document.querySelector('.chef-act').setAttribute('class','chef-act act-slice'));
    assert.equal(await page.locator('.pose-slice').evaluate(e=>getComputedStyle(e).display),'inline');
    assert.equal(await page.locator('.chef-rest').evaluate(e=>getComputedStyle(e).display),'none');
    await page.screenshot({path:'/tmp/miniature-slice.png',fullPage:true});
    await page.evaluate(()=>{document.querySelector('.chef-act').setAttribute('class','chef-act');document.querySelector('#guest .guest-doll').classList.add('act-chomp')});
    assert.equal(await page.locator('#guest .guest-forearm').evaluate(e=>getComputedStyle(e).display),'inline');
    await page.screenshot({path:'/tmp/miniature-eating.png',fullPage:true});
    await page.evaluate(()=>{document.querySelector('#modal-body').innerHTML='<div style="display:flex;flex-wrap:wrap;gap:20px;padding:24px">'+SHOP_DATA.fish.map(f=>'<div style="width:120px">'+KOBUNE_ART.nigiri(f)+'<p>'+f.en+'</p>'+KOBUNE_ART.sashimi(f)+'</div>').join('')+'</div>';document.querySelector('#overlay').hidden=false});
    // Food geometry must fit its viewport, so group clicks and keyboard focus use the visible dish.
    assert.ok(await page.locator('.art-nigiri').evaluateAll(nodes=>nodes.every(e=>{const b=e.getBBox();return b.x>=-1 && b.y>=-1 && b.x+b.width<=81 && b.y+b.height<=53})));
    await page.locator('#modal').screenshot({path:'/tmp/miniature-food.png'});
    await page.keyboard.press('Escape');
    await page.emulateMedia({reducedMotion:'reduce'});
    assert.equal(await page.locator('#guest .guest-forearm').evaluate(e=>getComputedStyle(e).display),'none');
    assert.equal(await page.locator('.chef-idle').evaluate(e=>getComputedStyle(e).animationName),'none');
    assert.deepEqual(errors,[]);
    console.log('PASS: physical cat clicks in both rooms, keyboard and bilingual feedback, action layers, bounded food geometry, reduced motion and screenshots.');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1});
