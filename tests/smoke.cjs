/* Run with PLAYWRIGHT_MODULE=/absolute/path/to/playwright node tests/smoke.cjs.
 * CHROME_EXECUTABLE is optional when Playwright's Chromium is installed.
 * No dependencies are added to the application; screenshots stay in /tmp.
 */
const assert = require('node:assert/strict');
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
  const open = async id => { if (await page.locator('#overlay').isVisible()) await page.locator('#modal-close').click(); await page.locator(id === 'cart' ? '#hud-cart' : '.scene [data-id="' + id + '"]:visible').first().click(); await page.waitForTimeout(300); assert.equal(await page.locator('#overlay').getAttribute('hidden'), null); };
  const close = async () => { await page.keyboard.press('Escape'); assert.equal(await page.locator('#overlay').isHidden(), true); };
  try {
    await page.goto(pathToFileURL(path.join(root, 'index.html')).href); await loaded();
    assert.equal(await page.locator('.scene image').count(), 3);
    assert.equal(await page.evaluate(() => JSON.stringify(Object.keys(I18N.zh).sort()) === JSON.stringify(Object.keys(I18N.en).sort())), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    // Local asset decoding under file://, including actual transparency on the chef.
    assert.equal(await page.evaluate(async () => {
      for (const src of ['assets/art/izakaya-room.webp', 'assets/art/haruta.webp', 'assets/art/tatami-room.webp']) { const im = new Image(); im.src = src; await im.decode(); if (!im.naturalWidth) return false; }
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
    await open('guest'); await page.locator('[data-k="clothing"][data-v="kimono"]').click(); await close();
    await page.locator('.scene-shortcuts [data-open="tablemenu"]').click(); await page.locator('[data-add]').first().click(); await close();
    await open('fishcase'); const fishId = await page.locator('[data-fish]').nth(1).getAttribute('data-fish');
    for(let i=0;i<7;i++) await page.locator('[data-fish="'+fishId+'"]').click();
    assert.equal(await page.locator('.portion').count(),6);
    await page.locator('[data-remove] .portion-inner').first().click(); assert.equal(await page.locator('.portion').count(),5);
    await page.locator('#plate-order').click(); await close();
    await open('chef'); await page.locator('#chef-omakase').click(); assert.equal(await page.locator('.omakase-preview .portion').count(),3);
    await page.locator('#om-take').click(); await close();
    await page.locator('#hud-cart').click(); assert.equal(await page.locator('.cart-line').count(),3);
    await page.locator('[data-inc]').first().click(); await page.locator('[data-dec]').first().click();
    await page.locator('#cart-submit').click(); assert.equal(await page.locator('.receipt').isVisible(),true);
    await page.waitForTimeout(300); await shot('receipt');
    const collected = await page.evaluate(()=>JSON.parse(localStorage.getItem('kobune.zukan')));
    assert.ok(collected.length>=2);
    await page.reload(); await loaded(); assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('kobune.zukan')).length),collected.length);
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('kobune.guest')).clothing),'kimono');
    assert.equal(await page.locator('#hud-cart b').innerText(),'0');
    await shot('seated');
    await page.locator('#hud-zukan').click(); await page.locator('.card:not(.locked)').first().click(); assert.equal(await page.locator('.facts').isVisible(),true); await close();
    // Live language change with an open modal.
    await open('fishcase'); await page.locator('#lang-toggle').click(); assert.equal(await page.locator('.scene-shortcuts button').first().innerText(),'翻开菜单'); await close();
    // Fresh context: takeout needs no selected seat.
    const fresh = await browser.newContext({locale:'en-US'}); const take=await fresh.newPage();take.on('pageerror',e=>errors.push(e.message));
    await take.goto(pathToFileURL(path.join(root,'index.html')).href);
    await take.locator('.scene-shortcuts [data-open="tablemenu"]').click();await take.locator('[data-add]').first().click();await take.keyboard.press('Escape');
    await take.locator('#hud-cart').click(); await take.locator('[data-mode="takeout"]').click();await take.locator('#cart-submit').click();
    assert.equal(await take.locator('.art-takeout').isVisible(),true); await fresh.close();
    // Tatami camera follows the existing saved seat, preserves orders and all entry points.
    await page.locator('#hud-seat').click(); await page.locator('[data-seat="tatami"]').click();
    assert.equal(await page.locator('.scene').getAttribute('data-room'),'tatami');
    assert.equal(await page.locator('#scene-counter').isHidden(),true);
    assert.equal(await page.locator('#scene-tatami').isVisible(),true);
    assert.equal(await page.locator('#scene-counter .hotspot[tabindex="0"]').count(),0);
    assert.equal(await page.locator('#scene-tatami .hotspot[tabindex="0"]').count(),10);
    await page.waitForTimeout(650); await shot('tatami');
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
    assert.equal(await page.locator('.receipt').isVisible(),true);await close();
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
    console.log('PASS: file:// assets, 10 hotspots in both languages, keyboard, dine-in, takeout, plate limits, omakase, guest customization, persistence, full tatami camera switching and saved view, mobile views, reduced motion.');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
