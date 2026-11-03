const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{})});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1100},locale:'en-US'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
  const open=async id=>{if(await page.locator('#overlay').isVisible())await page.keyboard.press('Escape');await page.locator('.scene [data-id="'+id+'"]:visible').first().click()};
  const ids=async()=>page.locator('[data-menu-item]').evaluateAll(es=>es.map(e=>e.dataset.menuItem));
  await open('drinks');assert.deepEqual(await ids(),['sake','umeshu','beer','matcha','yuzu','hojicha']);
  assert.equal(await page.locator('.bottle,.drink-grid,.wood-tag').count(),0);
  await page.locator('.menu-object img').evaluateAll(es=>Promise.all(es.map(e=>e.decode())));
  const prices={sake:78,umeshu:52,beer:58,matcha:48,yuzu:42,hojicha:0};
  for(const [id,price] of Object.entries(prices)){
   assert.equal((await page.locator('[data-menu-item="'+id+'"] .price').textContent()).trim(),price?'¥'+price:'Free');
   await page.locator('[data-add="'+id+'"]').click();
  }
  assert.match(await page.locator('[data-menu-count]').textContent(),/6 items/);
  await page.locator('[data-menu-filter="alcohol"]').click();assert.deepEqual(await ids(),['sake','umeshu','beer']);
  await page.locator('[data-menu-filter="soft"]').click();assert.deepEqual(await ids(),['matcha','yuzu','hojicha']);
  await page.locator('[data-menu-filter="tea"]').focus();await page.keyboard.press('Enter');assert.deepEqual(await ids(),['matcha','hojicha']);
  assert.equal(await page.evaluate(()=>document.activeElement.dataset.menuFilter),'tea');
  await page.locator('#lang-toggle').click();assert.match(await page.locator('[data-menu-count]').textContent(),/6 件/);assert.equal(await page.locator('[data-menu-filter="tea"]').getAttribute('aria-pressed'),'true');
  await page.locator('[data-menu-filter="all"]').click();await page.waitForTimeout(2700);await page.screenshot({path:'/tmp/tactile-drinks.png',fullPage:true});
  await open('tags');assert.deepEqual(await ids(),['matcha-ice','warabi']);
  await page.locator('[data-add="matcha-ice"]').click();await page.locator('[data-add="warabi"]').focus();await page.keyboard.press('Enter');
  assert.match(await page.locator('[data-menu-count]').textContent(),/8 件/);await page.waitForTimeout(2700);await page.screenshot({path:'/tmp/tactile-sweets.png',fullPage:true});
  await page.locator('[data-menu-filter="hot"]').click();assert.deepEqual(await ids(),['tempura','yakitori','chawanmushi','agedashi','edamame','misoshiru','gohan']);
  for(const id of await ids())await page.locator('[data-add="'+id+'"]').click();
  assert.match(await page.locator('[data-menu-count]').textContent(),/15 件/);await page.waitForTimeout(2700);await page.screenshot({path:'/tmp/tactile-hot.png',fullPage:true});
  await page.locator('.tactile-footer [data-open="cart"]').click();assert.equal(await page.locator('.cart-line').count(),15);
  // None of the new presentation changes original quantities or free tea pricing.
  assert.match(await page.locator('.cart-line').filter({hasText:'焙茶'}).textContent(),/免费/);
  assert.equal(await page.locator('.cart-total .price').textContent(),'¥626');
  await page.setViewportSize({width:390,height:844});
  for(const lang of ['zh','en']){
   if(await page.locator('html').getAttribute('lang')!==(lang==='zh'?'zh-CN':'en'))await page.locator('#lang-toggle').click();
   for(const view of ['drinks','tags']){
    await open(view);
    for(const filter of view==='drinks'?['all','alcohol','soft','tea']:['hot','sweet']){
     await page.locator('[data-menu-filter="'+filter+'"]').click();
     assert.ok(await page.locator('#modal').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
     assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
     const button=page.locator('[data-add]').last();await button.click();
    }
    if(lang==='en'){await page.waitForTimeout(2700);await page.screenshot({path:'/tmp/tactile-mobile-'+view+'.png',fullPage:true});}
   }
  }
  assert.equal(await page.evaluate(()=>JSON.stringify(Object.keys(I18N.en).sort())===JSON.stringify(Object.keys(I18N.zh).sort())),true);
  await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('#modal').evaluate(e=>getComputedStyle(e).animationName),'none');
  assert.deepEqual(errors,[]);
  console.log('PASS: 15 menu items, unchanged drink prices/free tea, live order counts, filters and keyboard focus, category retention on language switch, cart integration, 390px bilingual layouts and ordering, reduced motion, decoded assets and screenshots.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
