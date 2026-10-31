/* Run with PLAYWRIGHT_MODULE=/absolute/path/to/playwright node tests/smoke.cjs.
 * CHROME_EXECUTABLE is optional when Playwright's Chromium is installed.
 * No dependencies are added to the application; screenshots stay in /tmp.
 */
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}) });
  const errors = [];
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, locale: 'en-US' });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  const loaded = async () => { await page.waitForFunction(() => document.querySelector('#chef-figure image')); await page.waitForTimeout(300); };
  const shot = name => page.screenshot({ path: '/tmp/kobune-' + name + '.png', fullPage: true });
  const open = async id => { if (await page.locator('#overlay').isVisible()) await page.locator('#modal-close').click(); await page.locator(id === 'cart' ? '#hud-cart' : id === 'guest' ? '#guest .guest-hit' : '.scene [data-id="' + id + '"]:visible').first().click(); await page.waitForTimeout(300); assert.equal(await page.locator('#overlay').getAttribute('hidden'), null); };
  const close = async () => { await page.keyboard.press('Escape'); assert.equal(await page.locator('#overlay').isHidden(), true); };
  try {
    await page.goto(pathToFileURL(path.join(root, 'index.html')).href); await loaded();
    assert.equal(await page.locator('.scene image').count(), 3);
    assert.equal(await page.evaluate(() => JSON.stringify(Object.keys(I18N.zh).sort()) === JSON.stringify(Object.keys(I18N.en).sort())), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    // Local asset decoding under file://, including actual transparency on the chef.
    assert.equal(await page.evaluate(async () => {
      for (const src of ['assets/art/izakaya-room.webp', 'assets/art/haruta.webp', 'assets/art/tatami-room.webp', 'assets/art/guest-dolls.webp', 'assets/art/guest-accessories.webp']) { const im = new Image(); im.src = src; await im.decode(); if (!im.naturalWidth) return false; }
      return true;
    }), true);
    // Deployment regression: a returning browser must request versioned CSS/JS.
    const assetUrls = await page.locator('link[href^="css/"], script[src^="js/"]').evaluateAll(nodes => nodes.map(e => e.getAttribute('href') || e.getAttribute('src')));
    assert.equal(assetUrls.length, 6);
    assert.ok(assetUrls.every(url => new URL(url, 'https://example.test/').searchParams.get('v')));
    assert.equal(new Set(assetUrls.map(url => new URL(url, 'https://example.test/').searchParams.get('v'))).size, 1);
    // Missing/old CSS must not turn SVG interaction regions into opaque black art.
    const fallback = await page.evaluate(() => {
      const link = document.querySelector('link[href^="css/"]');
      link.sheet.disabled = true;
      const transparent = value => value === 'transparent' || value === 'rgba(0, 0, 0, 0)';
      const areas = [...document.querySelectorAll('.hit-area')];
      const safe = areas.length === 21 && areas.every(e => transparent(getComputedStyle(e).fill) && transparent(getComputedStyle(e).stroke));
      const dotsHidden = [...document.querySelectorAll('.hotspot-dot')].every(e => getComputedStyle(e).opacity === '0');
      link.sheet.disabled = false;
      return safe && dotsHidden;
    });
    assert.equal(fallback, true);
    assert.equal(await page.locator('.hint, .scene-shortcuts, .scene-caption').count(),0);
    assert.equal(await page.locator('#room-status').getAttribute('class'),'sr-only');
    assert.equal(await page.locator('.room-bar').isHidden(),true);
    await shot('desktop');
    // All object entry points remain interactive, localized, and escapable.
    for (const lang of ['en', 'zh']) {
      if ((await page.locator('html').getAttribute('lang')).startsWith(lang) === false) await page.locator('#lang-toggle').click();
      for (const id of ['noren', 'board', 'tags', 'drinks', 'zukan', 'chef', 'fishcase', 'seats', 'tablemenu', 'neko']) {
        await open(id); assert.ok((await page.locator('#modal-body').innerText()).length > 10); await close();
      }
    }
    await page.locator('#lang-toggle').click();
    // Keyboard focus opens a hotspot and exposes its tooltip.
    await page.locator('[data-id="chef"]:visible').focus(); assert.equal(await page.locator('#tooltip').isVisible(), true);
    await page.keyboard.press('Enter'); await page.waitForTimeout(300); await shot('chef'); await close();
    // Dine-in: choose seat, add menu item, customize guest, build plate, omakase, checkout.
    await page.locator('#hud-seat').click(); await page.locator('[data-seat="counter"]').click();
    assert.equal(await page.locator('#guest').isVisible(), true);
    assert.equal(await page.locator('#guest .guest-doll-art').getAttribute('height'),'190');
    // Counter stools: legs hang down instead of the tatami cross-legged pose.
    assert.equal(await page.locator('#guest .guest-doll').getAttribute('data-pose'),'stool'); assert.equal(await page.locator('#guest .guest-legs').count(),1);
    await page.locator('#guest').focus();await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    const visualHash = async () => createHash('sha256').update(await page.locator('.guest-preview').screenshot()).digest('hex');
    const looks = new Set();
    for(const clothing of ['casual','kimono','yukata']) {
      for(const hair of ['short','bun','ponytail','long']) {
        await page.locator('[data-k="clothing"][data-v="'+clothing+'"]').click();
        await page.locator('[data-k="hairStyle"][data-v="'+hair+'"]').click();
        assert.equal(await page.locator('#guest .guest-doll').getAttribute('data-clothing'),clothing);
        assert.equal(await page.locator('.guest-preview .guest-doll').getAttribute('data-hair'),hair);
        looks.add(await visualHash());
      }
    }
    assert.equal(looks.size,12,'Each generated hairstyle/outfit combination must render differently');
    for(const [key,values] of [['hairColor',['black','brown','gold','silver']],['outfit',['ai','shu','matcha','sakura','kuro']],['accessory',['none','kanzashi','hat']]]) {
      const colors = new Set();
      for(const value of values) {await page.locator('[data-k="'+key+'"][data-v="'+value+'"]').click();colors.add(await visualHash());}
      assert.equal(colors.size,values.length,'All '+key+' choices must visibly change the doll');
    }
    // Hat crown occludes upper hair for every hairstyle/outfit, without hiding long tails.
    await page.locator('[data-k="accessory"][data-v="hat"]').click();
    for(const clothing of ['casual','kimono','yukata']) {
      await page.locator('[data-k="clothing"][data-v="'+clothing+'"]').click();
      for(const hair of ['short','bun','ponytail','long']) {
        await page.locator('[data-k="hairStyle"][data-v="'+hair+'"]').click();
        assert.equal(await page.locator('.guest-preview .guest-hat').getAttribute('data-fit'),hair);
        assert.ok(await page.locator('.guest-preview .guest-hat-clearance').getAttribute('clip-path'));
        if(clothing==='casual') await page.locator('.guest-preview').screenshot({path:'/tmp/kobune-hat-'+hair+'.png'});
      }
    }
    await page.locator('[data-k="clothing"][data-v="kimono"]').click();
    await page.locator('[data-k="outfit"][data-v="sakura"]').click();
    await page.locator('[data-k="accessory"][data-v="kanzashi"]').click();
    await page.waitForTimeout(300);await shot('doll-wardrobe');
    await page.locator('[data-k="hairColor"][data-v="black"]').click();
    await page.locator('[data-k="hairStyle"][data-v="short"]').click();
    await page.locator('[data-k="outfit"][data-v="ai"]').click();
    await page.locator('[data-k="accessory"][data-v="none"]').click();
    await close();
    await page.waitForTimeout(300);await shot('doll-counter');
    await open('tablemenu'); await page.locator('[data-add]').first().click(); await close();
    await open('fishcase'); const fishId = await page.locator('[data-fish]').nth(1).getAttribute('data-fish');
    for(let i=0;i<7;i++) await page.locator('[data-fish="'+fishId+'"]').click();
    assert.equal(await page.locator('.portion').count(),6);
    await page.locator('[data-remove] .portion-inner').first().click(); assert.equal(await page.locator('.portion').count(),5);
    await page.locator('#plate-order').click(); await close();
    await open('chef'); await page.locator('#chef-omakase').click(); assert.equal(await page.locator('.omakase-preview .portion').count(),3);
    await page.locator('#om-take').click(); await close();
    await page.locator('#hud-cart').click(); assert.equal(await page.locator('.cart-line').count(),3);
    await page.locator('[data-inc]').first().click(); await page.locator('[data-dec]').first().click();
    await page.locator('#cart-submit').click();
    // T-05/T-48: Haruta slices and shapes, the dish is served to the seat, then the receipt opens.
    assert.equal(await page.locator('#overlay').isHidden(),true); assert.equal(await page.locator('.chef-act.act-slice').count(),1);
    await page.locator('#scene-dish .art-geta').waitFor({timeout:3000});
    await page.locator('.receipt').waitFor({timeout:4000}); await page.waitForTimeout(300); await shot('receipt'); await close();
    // T-50: each click eats one piece; after the last one Haruta clears the plate.
    const bites = await page.locator('#scene-dish .bite').count(); assert.ok(bites>=2);
    for (let i=0;i<bites;i++) { await page.locator('#scene-dish').click({force:true}); if (i===0) assert.equal(await page.locator('.pop-say').count()>=1,true); await page.waitForTimeout(650); }
    await page.locator('#scene-dish').waitFor({state:'hidden',timeout:4000});
    // T-53: the receipt book keeps the order and the visit count; the detail reopens the receipt.
    await page.locator('#hud-receipts').click(); assert.equal(await page.locator('.receipt-row').count(),1);
    await page.locator('.receipt-row').first().click(); assert.equal(await page.locator('.receipt-meta').isVisible(),true); await close();
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('kobune.visits'))),1);
    const collected = await page.evaluate(()=>JSON.parse(localStorage.getItem('kobune.zukan')));
    assert.ok(collected.length>=2);
    await page.reload(); await loaded(); assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('kobune.zukan')).length),collected.length);
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('kobune.guest')).clothing),'kimono');
    assert.equal(await page.locator('#hud-cart b').innerText(),'0');
    await shot('seated');
    await page.locator('#hud-zukan').click(); await page.locator('.card:not(.locked)').first().click(); assert.equal(await page.locator('.facts').isVisible(),true); await close();
    // Live language change with an open modal.
    await open('fishcase'); await page.locator('#lang-toggle').click(); assert.equal(await page.locator('html').getAttribute('lang'),'zh-CN'); await close();
    // Fresh context: takeout needs no selected seat.
    const fresh = await browser.newContext({locale:'en-US'}); const take=await fresh.newPage();take.on('pageerror',e=>errors.push(e.message));
    await take.goto(pathToFileURL(path.join(root,'index.html')).href);
    await take.locator('.scene [data-id="tablemenu"]:visible').click();await take.locator('[data-add]').first().click();await take.keyboard.press('Escape');
    await take.locator('#hud-cart').click(); await take.locator('[data-mode="takeout"]').click();await take.locator('#cart-submit').click();
    await take.locator('.receipt .art-takeout').waitFor({timeout:4000}); assert.equal(await take.locator('#scene-dish .art-takeout').isVisible(),true);
    await take.keyboard.press('Escape'); await take.locator('#scene-dish').click({force:true}); await take.locator('#scene-dish').waitFor({state:'hidden',timeout:3000}); await fresh.close();
    // Tatami camera follows the existing saved seat, preserves orders and all entry points.
    await page.locator('#hud-seat').click(); await page.locator('[data-seat="tatami"]').click();
    assert.equal(await page.locator('.scene').getAttribute('data-room'),'tatami');
    assert.equal(await page.locator('#scene-counter').isHidden(),true);
    assert.equal(await page.locator('#scene-tatami').isVisible(),true);
    assert.equal(await page.locator('#scene-counter .hotspot[tabindex="0"]').count(),0);
    assert.equal(await page.locator('#scene-tatami .hotspot[tabindex="0"]:not(#scene-dish)').count(),10);
    await page.waitForTimeout(650); await shot('tatami');
    assert.equal(await page.locator('#guest .guest-doll-art').getAttribute('height'),'220');
    assert.equal(await page.locator('#guest .guest-doll').getAttribute('data-pose'),'floor'); assert.equal(await page.locator('#guest .guest-legs').count(),0);
    await open('tablemenu');await page.locator('[data-add]').first().click();await close();
    const tatamiCart = await page.locator('#hud-cart b').innerText();
    await page.locator('#back-counter').click();
    assert.equal(await page.locator('.scene').getAttribute('data-room'),'counter');
    assert.equal(await page.locator('#hud-cart b').innerText(),tatamiCart);
    await page.locator('#hud-seat').click();await page.locator('[data-seat="tatami"]').click();
    for(const lang of ['zh','en']) {
      if (!(await page.locator('html').getAttribute('lang')).startsWith(lang)) await page.locator('#lang-toggle').click();
      for(const id of ['noren','board','tags','drinks','zukan','chef','fishcase','seats','tablemenu','neko','guest']) {await open(id);await close();}
    }
    await page.reload();await loaded();
    assert.equal(await page.locator('.scene').getAttribute('data-room'),'tatami');
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('kobune.seat'))),'tatami');
    // Complete an order from the tatami view, including seat-required checkout continuation.
    await open('tablemenu');await page.locator('[data-add]').first().click();await close();
    await page.locator('#hud-cart').click();await page.locator('#cart-submit').click();
    await page.locator('.receipt').waitFor({timeout:3000});await close();
    // Mobile: no page/modal overflow; all views and scene remain reachable by scrolling.
    await page.setViewportSize({width:390,height:844});
    for (const lang of ['zh','en']) {
      if (!(await page.locator('html').getAttribute('lang')).startsWith(lang)) await page.locator('#lang-toggle').click();
      for(const id of ['noren','board','tags','drinks','zukan','chef','fishcase','seats','tablemenu','neko','guest','cart']) {
        await open(id);
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'page overflow: '+id);
        assert.equal(await page.locator('#modal').evaluate(e=>e.scrollWidth<=e.clientWidth+1),true,'modal overflow: '+id);
        if(id==='fishcase'&&lang==='en') {await page.waitForTimeout(300);await shot('mobile-menu');}
        await close();
      }
    }
    await page.waitForTimeout(650); await shot('tatami-mobile');
    await page.locator('#back-counter').click();
    assert.equal(await page.locator('.scene').getAttribute('data-room'),'counter');
    await shot('mobile');
    await page.emulateMedia({reducedMotion:'reduce'});
    assert.equal(await page.locator('.chef-idle').evaluate(e=>getComputedStyle(e).animationName),'none');
    assert.equal(await page.locator('.steam').evaluate(e=>getComputedStyle(e).animationName),'none');
    assert.equal(await page.locator('.room-layer.is-active').evaluate(e=>getComputedStyle(e).animationName),'none');
    assert.deepEqual(errors,[]);
    console.log('PASS: file:// assets, 10 hotspots in both languages, keyboard, dine-in, takeout, plate limits, omakase, guest customization with 12 distinct doll combinations and all colors/accessories, persistence, full tatami camera switching and saved view, serving the dish to the seat, eating and clearing, character actions, stool vs tatami sitting pose, mobile views, reduced motion.');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
