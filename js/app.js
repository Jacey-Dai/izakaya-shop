(() => {
  "use strict";

  const D = window.SHOP_DATA;
  const EN = window.SHOP_DATA_EN || {};
  const ART = window.KOBUNE_ART;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  // 价格单位是人民币（PRD Q4）
  const rmb = (n) => (n === 0 ? t("free") : "¥" + n.toLocaleString("zh-CN"));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const pickIndex = (arr) => Math.floor(Math.random() * arr.length);

  // ---------- 本地存档（失败时静默，页面照常运行） ----------
  // 店名改为小舟后前缀从 koharu. 换成 kobune.，读取时兼容旧存档
  const store = {
    get(key, fallback) {
      try {
        let v = localStorage.getItem("kobune." + key);
        if (v === null) v = localStorage.getItem("koharu." + key);
        return v === null ? fallback : JSON.parse(v);
      } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem("kobune." + key, JSON.stringify(value)); } catch { /* ignore */ }
    },
  };

  // ---------- 数据索引 ----------
  const fishById = Object.fromEntries(D.fish.map((f) => [f.id, f]));
  const menuFish = D.fish.filter((f) => !f.omakaseOnly);

  // 刺身分类根据鱼的数据自动生成
  D.menu.forEach((cat) => {
    if (cat.auto) {
      cat.items = menuFish.map((f) => ({
        id: "s-" + f.id, name: f.name, jp: f.jp, price: f.price, fish: [f.id], desc: "三切",
      }));
    }
  });
  const itemById = {};
  D.menu.forEach((cat) => (cat.items || []).forEach((it) => { itemById[it.id] = it; }));
  const setById = Object.fromEntries(D.sets.map((st) => [st.id, st]));
  const prizeById = Object.fromEntries(D.prizes.map((p) => [p.id, p]));

  // ---------- 语言 ----------
  // 界面文案查 I18N；内容数据中文在 data.js，英文在 data.en.js，缺英文时回退中文
  const isEn = () => state.lang === "en";
  function t(key, vars = {}) {
    const dict = window.I18N[state.lang] || window.I18N.zh;
    const v = dict[key] ?? window.I18N.zh[key] ?? key;
    return typeof v === "string" ? v.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "") : v;
  }
  const en = (kind, id, field) => {
    const entry = EN[kind] && EN[kind][id];
    return entry && (field ? entry[field] : entry);
  };
  const tx = (kind, id, field, zh) => (isEn() && en(kind, id, field)) || zh;
  const fishName = (f) => (isEn() ? f.en : f.name);
  const fishText = (f, field) => tx("fish", f.id, field, f[field]);
  const itemName = (it) => (it.fish && it.id.startsWith("s-") ? fishName(fishById[it.fish[0]]) : tx("menu", it.id, "name", it.name));
  const itemDesc = (it) => (it.id.startsWith("s-") ? t("menu.sashimiDesc") : tx("menu", it.id, "desc", it.desc));
  const setName = (st) => tx("sets", st.id, "name", st.name);
  const setDesc = (st) => tx("sets", st.id, "desc", st.desc);
  const festText = (f, field) => tx("festivals", f.id, field, f[field]);
  const prizeText = (p, field) => tx("prizes", p.id, field, p[field]);
  const catName = (c) => (isEn() && EN.categories && EN.categories[c.id]) || c.name;
  const seatName = (s) => tx("seats", s.id, "name", s.name);
  const seatDesc = (s) => tx("seats", s.id, "desc", s.desc);
  const rarityName = (r) => (isEn() && EN.rarity && EN.rarity[r]) || D.rarity[r].zh;
  const optName = (o) => (isEn() && EN.guest && EN.guest[o.id]) || o.name;
  const chefLine = (key, i) => {
    const list = isEn() && EN.chef && EN.chef[key];
    if (i === undefined) return (list || D.chef[key]);
    return (list && list[i]) || D.chef[key][i];
  };
  const shopName = () => t("shop.name");

  function defaultGuest() {
    return Object.fromEntries(Object.entries(D.guest).map(([k, opts]) => [k, opts[0].id]));
  }

  // ---------- 状态 ----------
  const state = {
    lang: store.get("lang", (navigator.language || "zh").toLowerCase().startsWith("zh") ? "zh" : "en"),
    cart: [],
    plate: [],
    seat: store.get("seat", null),
    collected: new Set(store.get("zukan", [])),
    fresh: new Set(store.get("fresh", [])),
    guest: { ...defaultGuest(), ...store.get("guest", {}) },
    // 当前只实现春田师傅；玩家角色与性别选择继续留在 PRD T-10。
    chefLook: "male",
    orderMode: "dine",
    luck: 0,
    omakase: null,
    // 小票本（T-53）：最近 20 张小票；来店次数 = 下单次数，供积分卡、常客故事使用
    receipts: store.get("receipts", []),
    visits: store.get("visits", 0),
    // 积分卡（T-40）：当前章数（0–10）和抽到的奖品 [{ id, at }]
    stamps: store.get("stamps", 0),
    prizes: store.get("prizes", []),
    // 生日彩蛋（T-58）：{ m, d } 只存在本机；bdayYear 记录今年是否已经庆祝过
    // 当厨师（T-10）：role = guest / chef；npc 是当前来点单的客人；plating 是盘子上摆的鱼片
    role: store.get("role", "guest"),
    npc: null,
    plating: [],
    plateSel: -1,
    chefStats: store.get("chefStats", { served: 0, stars: 0 }),
    birthday: store.get("birthday", null),
    bdayYear: store.get("bdayYear", 0),
    menuTab: "sashimi",
    zukanFilter: "all",
  };

  // 按日期固定的随机数：同一天每次打开都一样。salt 让不同用途各自独立
  function dailyRand(salt = 0) {
    const d = new Date();
    let seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate() + salt;
    return () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  }
  const dailyPick = (list, n, salt) => {
    const rand = dailyRand(salt);
    const pool = [...list];
    const out = [];
    while (out.length < n && pool.length) out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
    return out;
  };
  // ---------- 节日与天气（T-55 / T-56） ----------
  // ?date=2026-07-07 预览其他日期的节日和天气，?weather=rain / clear 强制天气
  const params = new URLSearchParams(location.search);
  const sceneDate = (() => {
    const q = params.get("date");
    const d = q && /^\d{4}-\d{2}-\d{2}$/.test(q) ? new Date(q + "T12:00:00") : null;
    return d && !isNaN(d) ? d : new Date();
  })();
  const mmdd = (d) => String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const festival = D.festivals.find((f) => f.from <= mmdd(sceneDate) && mmdd(sceneDate) <= f.to) || null;
  const rainy = (() => {
    const w = params.get("weather");
    if (w === "rain") return true;
    if (w === "clear") return false;
    let seed = sceneDate.getFullYear() * 10000 + (sceneDate.getMonth() + 1) * 100 + sceneDate.getDate() + 13;
    for (let i = 0; i < 3; i++) seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280 < (sceneDate.getMonth() === 5 ? D.rain.juneChance : D.rain.chance);
  })();

  // 今日鲜货
  const todaysFresh = dailyPick(menuFish, 4, 0);
  // 握寿司定食今天的 3 款（每款一贯两件，共 6 贯）
  const todaysNigiri = dailyPick(D.menu.find((c) => c.id === "sushi").items.filter((it) => /^[ng]-/.test(it.id)), 3, 7);

  // ---------- 小组件 ----------
  // 插画在 art.js：刺身片、握寿司 / 军舰、细卷、木屐盘、外带盒
  const swatchHTML = (f, n = 1) => `<div class="swatch">${ART.sashimi(f, n)}</div>`;
  const sushiHTML = (f) => `<div class="swatch">${ART.nigiri(f)}</div>`;
  function itemArt(it) {
    if (!it.fish) return "";
    const f = fishById[it.fish[0]];
    if (it.id.startsWith("s-")) return ART.sashimi(f, 2);
    if (it.id.startsWith("r-")) return ART.maki(f);
    return ART.nigiri(f);
  }
  const rarityColor = (r) => D.rarity[r].color;

  // 原创微缩玩偶图集：四种发型 × 三种服装，场景与预览共用。
  // 只对中性材质做颜色映射，保留真实发束、织物、肤色和腰带。
  let guestArtId = 0;
  function guestSVG(g, seat = state.seat) {
    const opt = (key) => D.guest[key].find((o) => o.id === g[key]) || D.guest[key][0];
    const style = opt("hairStyle").id;
    const wear = opt("clothing").id;
    const col = ["short", "bun", "ponytail", "long"].indexOf(style);
    const row = ["casual", "kimono", "yukata"].indexOf(wear);
    // 透明像素边界，单位为图集中每格的局部坐标；不裁切原始素材文件。
    const frames = [
      [[88, 13, 242, 323], [80, 18, 239, 318], [70, 17, 242, 319], [72, 19, 238, 317]],
      [[54, 11, 306, 325], [50, 13, 300, 323], [39, 13, 304, 323], [40, 14, 297, 323]],
      [[90, 6, 235, 320], [83, 9, 235, 317], [74, 9, 237, 317], [76, 12, 231, 314]],
    ];
    const [x, y, w, h] = frames[row][col];
    const id = "guest-doll-" + guestArtId++;
    const height = seat === "counter" ? 190 : 220;
    const headEnd = [178, 172, 166][row];
    const tailEnd = [233, 224, 219][row];
    const longEnd = [208, 202, 199][row];
    const hairRegion = (fill) => {
      let shape = `<rect width="384" height="${headEnd}" fill="${fill}"/>`;
      if (style === "ponytail") shape += `<path d="M158 ${headEnd - 25} Q163 ${tailEnd - 15} 193 ${tailEnd} Q228 ${tailEnd + 5} 238 ${tailEnd - 25} L234 ${headEnd - 25} Z" fill="${fill}"/>`;
      if (style === "long") shape += `<path d="M88 ${headEnd - 20} L300 ${headEnd - 20} Q305 ${longEnd - 5} 269 ${longEnd} Q240 ${longEnd + 8} 200 ${longEnd - 3} Q152 ${longEnd + 9} 111 ${longEnd} Q87 ${longEnd - 5} 88 ${headEnd - 20} Z" fill="${fill}"/>`;
      return shape;
    };
    const tint = (color) => {
      const rgb = color.slice(1).match(/../g).map((hex) => parseInt(hex, 16) / 255);
      return rgb.map((c) => `${.2126 * c * 1.8} ${.7152 * c * 1.8} ${.0722 * c * 1.8} 0 ${c * .025}`).join(" ") + " 0 0 0 1 0";
    };
    const accessory = opt("accessory").id;
    // 帽沿按发型单独适配，并裁掉帽冠内的头发，避免发束穿出帽子。
    const hatFits = {
      short: { width: 156, height: 108, lift: 24, cx: 0 },
      bun: { width: 148, height: 102, lift: 18, cx: -2 },
      ponytail: { width: 150, height: 104, lift: 20, cx: 2 },
      long: { width: 160, height: 111, lift: 22, cx: 0 },
    };
    const hat = hatFits[style];
    // 吧台是高凳：裁掉盘腿的膝盖（图集局部坐标），把衣摆放在凳面上，小腿垂在凳腿之间。
    // 座敷和换装预览保持原来的盘腿坐。
    const onStool = seat === "counter";
    const seatClip = {
      casual: "M0 0 H384 V258 H290 L283 282 Q277 299 262 304 Q192 313 122 304 Q108 299 102 282 L95 258 H0 Z",
      kimono: "M0 0 H384 V284 Q378 300 350 301 Q192 306 34 301 Q6 300 0 284 Z",
      yukata: "M0 0 H384 V266 H306 L304 295 Q301 311 280 312 Q208 316 136 312 Q115 311 113 295 L111 266 H0 Z",
    }[wear];
    const seatLine = { casual: 309, kimono: 302, yukata: 313 }[wear];
    const lift = onStool ? -height + (seatLine - (y - 3)) * height / (h + 6) : 0;
    const brimY = -height - hat.lift + hat.height * .73;
    let extra = "";
    if (accessory === "hat") extra = `<svg class="guest-accessory guest-hat" data-fit="${style}" x="${hat.cx - hat.width / 2}" y="${-height - hat.lift}" width="${hat.width}" height="${hat.height}" viewBox="43 153 881 614" overflow="hidden"><image href="assets/art/guest-accessories.webp" width="1774" height="887"/></svg>`;
    if (accessory === "kanzashi") extra = `<svg class="guest-accessory" x="16" y="${-height + 30}" width="58" height="48" viewBox="1020 178 713 584" overflow="hidden"><image href="assets/art/guest-accessories.webp" width="1774" height="887"/></svg>`;
    return `<g class="guest-doll" data-pose="${onStool ? "stool" : "floor"}" data-hair="${style}" data-clothing="${wear}" data-outfit="${opt("outfit").id}" data-hair-color="${opt("hairColor").id}" data-accessory="${accessory}">
      ${onStool ? stoolLegs(wear, opt("outfit").color, id) : `<ellipse cx="0" cy="-2" rx="${wear === "kimono" ? 76 : 58}" ry="7" fill="#36281d" opacity=".22"/>`}
      <g transform="translate(0 ${-lift})">
      ${accessory === "hat" ? `<defs><clipPath id="${id}-hat-clearance" clipPathUnits="userSpaceOnUse"><path d="M-125 ${brimY} Q${hat.cx} ${brimY + hat.height * .28} 125 ${brimY} V20 H-125 Z"/></clipPath></defs>` : ""}
      <g class="guest-hat-clearance" ${accessory === "hat" ? `clip-path="url(#${id}-hat-clearance)"` : ""}>
      <svg class="guest-doll-art" x="-110" y="${-height}" width="220" height="${height}" viewBox="${x - 5} ${y - 3} ${w + 10} ${h + 6}" overflow="hidden">
        <defs>
          <image id="${id}-sprite" href="assets/art/guest-dolls.webp" x="${-col * 384}" y="${-row * 1024 / 3}" width="1536" height="1024"/>
          <filter id="${id}-neutral" filterUnits="userSpaceOnUse" x="0" y="0" width="384" height="342" color-interpolation-filters="sRGB">
            <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  -4 0 4 0 1" result="neutral"/>
            <feComposite in="neutral" in2="SourceGraphic" operator="in"/>
          </filter>
          <filter id="${id}-hair" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="${tint(opt("hairColor").color)}"/></filter>
          <filter id="${id}-cloth" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="${tint(opt("outfit").color)}"/></filter>
          <mask id="${id}-neutral-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="384" height="342"><use href="#${id}-sprite" filter="url(#${id}-neutral)"/></mask>
          <mask id="${id}-hair-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="384" height="342">${hairRegion("white")}</mask>
          <mask id="${id}-cloth-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="384" height="342"><rect width="384" height="${wear === "casual" ? 316 : 342}" fill="white"/>${hairRegion("black")}</mask>
          ${onStool ? `<clipPath id="${id}-seat" clipPathUnits="userSpaceOnUse"><path d="${seatClip}"/></clipPath>` : ""}
        </defs>
        <g ${onStool ? `clip-path="url(#${id}-seat)"` : ""}>
        <use href="#${id}-sprite"/>
        <g mask="url(#${id}-neutral-mask)">
          <g mask="url(#${id}-cloth-mask)"><use href="#${id}-sprite" filter="url(#${id}-cloth)"/></g>
          <g mask="url(#${id}-hair-mask)"><use href="#${id}-sprite" filter="url(#${id}-hair)"/></g>
        </g>
        </g>
      </svg>
      </g>
      ${extra}
      <path class="guest-hit" d="M0 ${-height - 5} C-86 ${-height - 5} -86 ${-height + 115} 0 ${-height + 115} C86 ${-height + 115} 86 ${-height - 5} 0 ${-height - 5} Z M-42 -115 Q-78 -95 -${wear === "kimono" ? 90 : 73} -30 Q-85 10 0 2 Q85 10 ${wear === "kimono" ? 90 : 73} -30 Q78 -95 42 -115 Z" fill="transparent" stroke="transparent"/>
      </g>
    </g>`;
  }

  // 高凳上垂下的小腿，原点是凳面中心；只画在两条凳腿之间，像是从凳面后面伸出来。
  function stoolLegs(wear, cloth, id) {
    const dark = (hex, k) => "#" + hex.slice(1).match(/../g).map((c) => Math.round(parseInt(c, 16) * k).toString(16).padStart(2, "0")).join("");
    const shade = (fill, gid) => `<linearGradient id="${gid}"><stop stop-color="#fff" stop-opacity=".22"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#1c1410" stop-opacity=".35"/></linearGradient>`;
    const leg = (x, fill) => `<rect x="${x}" y="17" width="14" height="38" rx="6" fill="${fill}"/><rect x="${x}" y="17" width="14" height="38" rx="6" fill="url(#${id}-leg)"/>`;
    if (wear === "casual") {
      const pants = dark(cloth, .42);
      return `<g class="guest-legs" filter="url(#guest-soft)"><defs>${shade(pants, id + "-leg")}</defs>
        ${leg(-17, pants)}${leg(3, pants)}
        <path d="M-20 56 q0 -6 10 -6 q10 0 11 6 q0 5 -10 5 q-11 0 -11 -5 Z M-1 56 q1 -6 11 -6 q10 0 10 6 q0 5 -11 5 q-10 0 -10 -5 Z" fill="#6e4a34"/>
        <path d="M-17 52 h11 M3 52 h11" stroke="#f3e6d2" stroke-width="2" stroke-linecap="round" opacity=".8"/>
      </g>`;
    }
    const hem = dark(cloth, .62);
    return `<g class="guest-legs" filter="url(#guest-soft)"><defs>${shade(hem, id + "-leg")}</defs>
      <rect x="-15" y="34" width="11" height="18" rx="5" fill="#f7f1e6"/><rect x="4" y="34" width="11" height="18" rx="5" fill="#f7f1e6"/>
      <path d="M-22 15 H22 L20 40 Q0 46 -20 40 Z" fill="${hem}"/><path d="M-22 15 H22 L20 40 Q0 46 -20 40 Z" fill="url(#${id}-leg)"/>
      <rect x="-18" y="51" width="16" height="6" rx="3" fill="#9a6a45"/><rect x="2" y="51" width="16" height="6" rx="3" fill="#9a6a45"/>
      <path d="M-10 51 v-4 M10 51 v-4" stroke="#b6423a" stroke-width="2.5" stroke-linecap="round"/>
    </g>`;
  }

  // 原创手作人偶角色，场景与对话共用本地透明资源，无网络依赖。
  // 原点维持在台面中心；独立 SVG image 便于沿用原来的场景接口。
  function chefSVG() {
    return `<image href="assets/art/haruta.webp" x="-140" y="-270" width="280" height="420" preserveAspectRatio="xMidYMid meet"/>`;
  }

  function toast(msg, gold = false) {
    const el = document.createElement("div");
    el.className = "toast" + (gold ? " gold" : "");
    el.textContent = msg;
    $("#toasts").appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }

  // ---------- 人物动作（T-48） ----------
  // 人物是整张透明图，动作用 CSS 关键帧对整个人做弯腰、摇晃、弹跳等；减少动态效果时跳过等待。
  const reduceMotion = () => !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, reduceMotion() ? 0 : ms));
  const animate = (el, frames, ms) => (reduceMotion() || !el.animate
    ? Promise.resolve()
    : el.animate(frames, { duration: ms, easing: "ease-in-out", fill: "forwards" }).finished);
  function play(el, cls, ms) {
    if (!el) return wait(0);
    el.classList.remove(cls);
    void el.getBoundingClientRect();
    el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), ms);
    return wait(ms);
  }
  const inCounter = () => $(".scene").dataset.room === "counter";
  // 春田只在吧台视角里出现；座敷视角不做师傅动作
  const chefAct = (cls, ms) => (inCounter() ? play($(".chef-act"), cls, ms) : wait(0));
  const guestAct = (cls, ms) => play($("#guest .guest-doll"), cls, ms);

  // 人物头顶冒出的拟声词（日语，中英界面相同）
  function say(x, y, text) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", "text");
    el.setAttribute("class", "pop-say");
    el.setAttribute("x", x);
    el.setAttribute("y", y);
    el.textContent = text;
    $(".scene").appendChild(el);
    setTimeout(() => el.remove(), 1300);
  }
  const chefSay = (text) => inCounter() && say(745, 235, text);
  function guestSay(text) {
    const guest = $("#guest");
    if (guest.style.display === "none") return;
    const seat = shownSeat();
    // 玩偶在吧台高 190、座敷高 220（见 guestSVG），字放在头部右上方
    say(seat.marker[0] + 80, seat.marker[1] - (seat.id === "counter" ? 160 : 190), text);
  }

  // 上菜（T-05）：吧台从师傅手边、座敷从门口把盘子送到客人旁边，坐标与 viewBox 一致。
  const DISH_SPOTS = {
    counter: { from: [640, 380], to: [735, 515], width: 170 },
    tatami: { from: [190, 430], to: [750, 562], width: 150 },
  };

  // 盘子放进当前房间、排在热点之前：画在背景上，重叠处仍由原热点接收点击。
  // 换房间时按新房间的落点和大小重画，已经吃掉的那几贯保持隐藏。
  const dishState = { art: null, mode: "dine", eaten: 0, busy: false, serving: false };
  // 给读屏用户的播报（上菜、还剩几贯）
  const announce = (msg) => { $("#live-status").textContent = msg; };
  function placeDish(room) {
    const dish = $("#scene-dish");
    const { to: [x, y], width } = DISH_SPOTS[room];
    $(`.room-layer[data-room="${room}"] .hotspot`).before(dish);
    dish.setAttribute("transform", `translate(${x} ${y})`);
    if (!dishState.art) return;
    const [, w, h] = dishState.art.match(/width="(\d+)" height="(\d+)"/).map(Number);
    const k = width / w;
    dish.innerHTML = `<g class="dish-move"><rect class="hit-area" fill="transparent" stroke="transparent" rx="8" x="${-width / 2}" y="${-h * k}" width="${width}" height="${h * k}"/><g transform="translate(${-width / 2} ${-h * k}) scale(${k})">${dishState.art}</g></g>`;
    $$(".bite", dish).slice(0, dishState.eaten).forEach((b) => b.setAttribute("display", "none"));
  }
  function dishOffset(room) {
    const [fx, fy] = DISH_SPOTS[room].from;
    const [toX, toY] = DISH_SPOTS[room].to;
    return [fx - toX, fy - toY];
  }
  function hideDish() {
    dishState.art = null;
    $("#scene-dish").style.display = "none";
  }

  // 吧台：春田先切鱼、捏寿司，再把盘子递过来；盘子留在座位上，点它一贯一贯吃掉。
  // 没有鱼的订单（只点饮料等）不端盘子。special = { art, say } 用于生日玉子烧这类不是订单的盘子。
  async function serveDish(lines, mode, done, special = null) {
    const fishList = [...new Set(lines.flatMap((l) => l.fish || []))].map((id) => fishById[id]);
    const dish = $("#scene-dish");
    hideDish();
    if (!fishList.length && !special) { done(); return; }
    dishState.busy = true;
    dishState.serving = true;
    chefSay(special ? special.say : "トントン");
    await chefAct("act-slice", 700);
    if (!special) {
      chefSay("ぎゅっ");
      await chefAct("act-nigiri", 700);
    }
    const art = special ? special.art : mode === "takeout" ? ART.takeoutBox(fishList) : ART.geta(fishList);
    Object.assign(dishState, { art, mode, eaten: 0 });
    const room = $(".scene").dataset.room;
    placeDish(room);
    dish.setAttribute("aria-label", hotspotInfo("dish").title);
    dish.style.display = "";
    const [dx, dy] = dishOffset(room);
    chefAct("act-serve", 900);
    await animate(dish.firstChild, [
      { transform: `translate(${dx}px, ${dy}px) scale(.7)`, opacity: 0 },
      { transform: `translate(${dx}px, ${dy}px) scale(.85)`, opacity: 1, offset: 0.2 },
      { transform: `translate(${dx * 0.35}px, ${dy * 0.35 - 30}px) scale(.95)`, offset: 0.65 },
      { transform: "none", opacity: 1 },
    ], 1300);
    dishState.busy = false;
    dishState.serving = false;
    announce(t("live.served", { n: $$(".bite", dish).length }));
    done();
  }

  // 点盘子：吃掉一贯；全部吃完后客人满足，春田把空盘收走。外带盒点一下就带走。
  async function eatDish() {
    const dish = $("#scene-dish");
    if (dishState.busy || !dishState.art) return;
    dishState.busy = true;
    if (dishState.mode === "takeout") {
      guestAct("act-happy", 900);
      await animate(dish.firstChild, [{ opacity: 1 }, { transform: "translate(0px, 40px) scale(.8)", opacity: 0 }], 700);
      hideDish();
      toast(t("toast.takeout"));
    } else {
      const left = $$(".bite", dish).filter((b) => b.getAttribute("display") !== "none");
      guestSay("もぐもぐ");
      guestAct("act-chomp", 600);
      await animate(left[0], [{ opacity: 1 }, { transform: "translate(0px, -40px) scale(.6)", opacity: 0 }], 450);
      left[0].setAttribute("display", "none");
      dishState.eaten += 1;
      if (left.length > 1) announce(t("live.left", { n: left.length - 1 }));
      if (left.length === 1) {
        await wait(250);
        guestSay("ごちそうさま！");
        await guestAct("act-happy", 900);
        await clearDish();
      }
    }
    dishState.busy = false;
  }

  async function clearDish() {
    const dish = $("#scene-dish");
    const [dx, dy] = dishOffset($(".scene").dataset.room);
    chefAct("act-serve", 900);
    await animate(dish.firstChild, [
      { transform: "none", opacity: 1 },
      { transform: `translate(${dx * 0.4}px, ${dy * 0.4 - 25}px) scale(.95)`, opacity: 1, offset: 0.4 },
      { transform: `translate(${dx}px, ${dy}px) scale(.7)`, opacity: 0 },
    ], 900);
    hideDish();
    toast(pick(chefLine("cleared")));
  }

  // ---------- 节日装饰与雨天的画面 ----------
  // 坐标与 viewBox 一致：[x, y, 缩放]，y 是装饰底部落地的位置
  const DECO_SPOTS = {
    kadomatsu: { counter: [66, 660, 1.25], tatami: [400, 494, 1.1] },
    tanabata: { counter: [1012, 505, 1], tatami: [882, 494, 1] },
    pumpkin: { counter: [962, 490, 1.1], tatami: [404, 498, 1] },
    tree: { counter: [962, 490, 1.15], tatami: [404, 498, 1.1] },
    umbrella: { counter: [138, 645, 1.1], tatami: [228, 530, 0.95] },
  };
  // 雨：吧台看得到门边的障子，座敷看得到院子的窗；暖帘下摆滴水
  const RAIN_VIEWS = {
    counter: { win: [28, 295, 137, 297], drops: [[45, 284], [80, 288], [118, 290], [155, 292], [188, 294]] },
    tatami: { win: [452, 226, 358, 182], drops: [[40, 256], [80, 260], [120, 262], [160, 266], [192, 266]] },
  };
  const decoAt = (kind, room) => {
    const [x, y, k] = DECO_SPOTS[kind][room];
    return `<g class="deco deco-${kind}" transform="translate(${x} ${y}) scale(${k})">${ART.deco(kind)}</g>`;
  };
  function renderAtmosphere() {
    const scene = $(".scene");
    if (rainy) {
      scene.querySelector("defs").insertAdjacentHTML("beforeend", `
        <pattern id="rain-pat" width="40" height="80" patternUnits="userSpaceOnUse">
          <path d="M6 0 l-4 16 M26 30 l-4 16 M16 56 l-4 16 M36 12 l-3 12" stroke="#eef4fa" stroke-width="2.2" stroke-linecap="round" opacity=".9"/>
        </pattern>`);
    }
    $$(".room-layer").forEach((layer) => {
      const room = layer.dataset.room;
      let html = "";
      if (rainy) {
        const { win: [x, y, w, h], drops } = RAIN_VIEWS[room];
        html += `
          <clipPath id="rain-clip-${room}"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath>
          <g class="rain" clip-path="url(#rain-clip-${room})">
            <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#41557e" opacity=".32"/>
            <rect class="rain-fall" x="${x}" y="${y - 80}" width="${w}" height="${h + 80}" fill="url(#rain-pat)"/>
          </g>
          ${drops.map(([dx, dy], i) => `<ellipse class="rain-drop" style="animation-delay:${(i * 0.37) % 1.4}s" cx="${dx}" cy="${dy}" rx="2.4" ry="3.4" fill="#cfe0f0" stroke="#7fa6c8" stroke-width=".8"/>`).join("")}
          ${decoAt("umbrella", room)}`;
      }
      if (festival && DECO_SPOTS[festival.deco]) html += decoAt(festival.deco, room);
      if (!html) return;
      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.setAttribute("class", "atmo");
      g.setAttribute("pointer-events", "none");
      g.setAttribute("aria-hidden", "true");
      g.innerHTML = html;
      layer.querySelector(".hotspot").before(g);
    });
    // 樱花季：花瓣从上往下飘，画在最上层但不挡点击
    if (festival && festival.deco === "petals") {
      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.setAttribute("class", "atmo petals");
      g.setAttribute("pointer-events", "none");
      g.setAttribute("aria-hidden", "true");
      g.innerHTML = Array.from({ length: 18 }, (_, i) => {
        const x = (i * 211) % 1200, y = (i * 137) % 760;
        return `<path class="petal" style="--dur:${6 + (i % 5)}s;animation-delay:-${(i * 0.9) % 6}s" transform="translate(${x} ${y}) rotate(${i * 40})" d="M0 0 q6 -8 12 0 q-6 9 -12 0 Z" fill="#f6c3cf" stroke="#d9879a" stroke-width=".8"/>`;
      }).join("");
      scene.appendChild(g);
    }
  }

  // ---------- 生日彩蛋（T-58） ----------
  // 2 月 29 日生日在平年的 2 月 28 日庆祝
  function isBirthday(date = new Date()) {
    const b = state.birthday;
    if (!b) return false;
    const y = date.getFullYear();
    const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    const [m, d] = b.m === 2 && b.d === 29 && !leap ? [2, 28] : [b.m, b.d];
    return date.getMonth() + 1 === m && date.getDate() === d;
  }
  // 坐下、没有别的盘子、没有弹窗时才端；今年庆祝过就不再端
  function maybeBirthday() {
    const year = new Date().getFullYear();
    if (isChef() || !isBirthday() || state.bdayYear === year || !state.seat || dishState.serving || dishState.art || current) return;
    state.bdayYear = year;
    store.set("bdayYear", year);
    toast(t("bday.toast"), true);
    serveDish([], "dine", () => {
      guestSay("わあ！");
      guestAct("act-happy", 900);
      announce(t("bday.live"));
    }, { art: ART.tamagoyaki(), say: "おめでとう！" });
  }

  // 镜头只从已有 seat 派生，刷新与旧存档无需新增状态或迁移。
  function updateRoom(seat) {
    const room = seat && seat.id === "tatami" ? "tatami" : "counter";
    const scene = $(".scene");
    const changed = scene.dataset.room !== room;
    scene.dataset.room = room;
    scene.setAttribute("aria-label", t("room." + room));
    $$(".room-layer").forEach((layer) => {
      const active = layer.dataset.room === room;
      layer.setAttribute("display", active ? "inline" : "none");
      layer.setAttribute("aria-hidden", String(!active));
      layer.classList.toggle("is-active", active);
      $$(".hotspot", layer).forEach((hotspot) => hotspot.setAttribute("tabindex", active ? "0" : "-1"));
    });
    $("#room-status").textContent = t("room." + room);
    $("#back-counter").hidden = room !== "tatami";
    $(".room-bar").hidden = room !== "tatami";
    if (changed) {
      placeDish(room);
      $("#tooltip").hidden = true;
      $$(".hotspot.linked").forEach((el) => el.classList.remove("linked"));
      const scroll = $(".scene-scroll");
      scroll.scrollLeft = room === "counter" ? Math.max(0, (scene.clientWidth - scroll.clientWidth) / 2) : 0;
      if (document.activeElement && document.activeElement.closest(".room-layer[aria-hidden='true']")) $("#hud-seat").focus();
    }
  }

  function chooseSeat(id) {
    const seat = D.seats.find((s) => s.id === id);
    if (!seat) return;
    state.seat = seat.id;
    store.set("seat", state.seat);
    updateHud();
    guestAct("act-sit", 500);
    toast(t("toast.seated", { name: seatName(seat) }));
  }

  $("#back-counter").addEventListener("click", () => {
    chooseSeat("counter");
    // 回程按钮隐藏后将焦点交给一直可用的座位按钮。
    $("#hud-seat").focus();
  });

  const isChef = () => state.role === "chef";
  const shownSeat = () => D.seats.find((s) => s.id === (isChef() ? "counter" : state.seat));
  function updateHud() {
    const count = state.cart.reduce((s, l) => s + l.qty, 0);
    const cartBtn = $("#hud-cart");
    cartBtn.querySelector("b").textContent = count;
    const seat = D.seats.find((s) => s.id === state.seat);
    $("#hud-seat").textContent = t("hud.seat", { name: seat ? seatName(seat) : t("hud.seatNone") });
    $("#hud-zukan").textContent = t("hud.zukan", { n: state.collected.size, total: D.fish.length });

    $("#hud-role").textContent = t("hud.role", { name: t(isChef() ? "role.chef" : "role.guest") });

    // 当厨师时镜头固定在吧台，吧台上坐的是来点单的客人
    const shown = shownSeat();
    const look = isChef() ? state.npc.look : state.guest;
    updateRoom(shown);
    const guest = $("#guest");
    // 只在座位或形象变了时重画客人，加菜时不打断正在做的动作
    const guestKey = shown ? (isChef() ? "npc:" : "") + shown.id + JSON.stringify(look) : "";
    if (guest.dataset.key !== guestKey) {
      guest.dataset.key = guestKey;
      if (shown) {
        guest.setAttribute("transform", `translate(${shown.marker[0]} ${shown.marker[1]})`);
        guest.innerHTML = guestSVG(look, shown.id);
      }
    }
    guest.style.display = shown ? "" : "none";
  }

  function bumpCart() {
    const btn = $("#hud-cart");
    btn.classList.remove("bump");
    void btn.offsetWidth;
    btn.classList.add("bump");
  }

  // ---------- 购物车 ----------
  function addToCart(line) {
    const existing = state.cart.find((l) => l.key === line.key);
    if (existing) existing.qty += 1;
    else state.cart.push({ qty: 1, ...line });
    updateHud();
    bumpCart();
    toast(t("toast.added", { name: lineName(line) }));
  }

  // 订单行的名称和备注在显示时才生成，切换语言后也会跟着变
  function lineName(l) {
    if (l.kind === "item") return itemName(itemById[l.key]);
    if (l.kind === "set") return setName(setById[l.set]);
    return t(l.kind === "omakase" ? "chef.omakaseName" : "case.plateName");
  }
  function lineNote(l) {
    if (l.kind === "set") {
      const fish = (l.nigiri || []).map((id) => itemName(itemById[id]))
        .concat(l.nigiri ? [] : (l.fish || []).map((id) => fishName(fishById[id])));
      return fish.concat(setById[l.set].parts.map((id) => itemName(itemById[id]))).join(" · ");
    }
    if (!l.counts) return "";
    return Object.entries(l.counts).map(([id, n]) => fishName(fishById[id]) + (n > 1 ? "×" + n : "")).join(" · ");
  }

  // ---------- 定食（T-26） ----------
  const SET_RATE = 0.85;
  // 套餐的鱼：omakase 每次点都重新挑，其余按日期固定
  function setContents(st, omakaseFish) {
    let fish = [], nigiri = null, base = 0;
    if (st.pick === "fresh3") { fish = todaysFresh.slice(0, 3); base = fish.reduce((s, f) => s + f.price, 0); }
    if (st.pick === "daily3") {
      nigiri = todaysNigiri.map((it) => it.id);
      fish = todaysNigiri.flatMap((it) => it.fish.map((id) => fishById[id]));
      base = todaysNigiri.reduce((s, it) => s + it.price, 0);
    }
    if (st.pick === "omakase" && omakaseFish) { fish = omakaseFish; base = fish.reduce((s, f) => s + f.price, 0); }
    base += st.parts.reduce((s, id) => s + itemById[id].price, 0);
    return { fish, nigiri, base, price: Math.round(base * SET_RATE) };
  }

  function addSet(id) {
    const st = setById[id];
    if (!st) return;
    const random = st.pick === "omakase";
    const c = setContents(st, random ? rollOmakase().fish : null);
    addToCart({
      // 按日期固定的套餐同一单里合并数量；omakase 套餐每份的鱼不同，分开列
      key: random ? st.id + "-" + Date.now() : st.id,
      kind: "set", set: st.id, price: c.price,
      fish: c.fish.map((f) => f.id),
      ...(c.nigiri ? { nigiri: c.nigiri } : {}),
    });
  }

  function addMenuItem(id) {
    const it = itemById[id];
    if (!it) return;
    addToCart({ key: it.id, kind: "item", price: it.price, fish: it.fish || [] });
  }

  // ---------- 弹窗 ----------
  const overlay = $("#overlay");
  const modal = $("#modal");
  const body = $("#modal-body");
  let current = null;
  let currentArgs = [];

  function open(id, ...args) {
    const view = views[id];
    if (!view) return;
    current = id;
    currentArgs = args;
    modal.className = "modal " + (view.cls || id);
    body.innerHTML = view.render(...args);
    overlay.hidden = false;
    view.mount && view.mount(...args);
    modal.scrollTop = 0;
  }
  function close() {
    overlay.hidden = true;
    current = null;
    setTimeout(maybeBirthday, 600);
  }
  function rerender(...args) { if (current) open(current, ...(args.length ? args : currentArgs)); }

  $("#modal-close").addEventListener("click", close);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !overlay.hidden) close(); });

  // 弹窗内的通用按钮：data-add / data-open
  body.addEventListener("click", (e) => {
    const add = e.target.closest("[data-add]");
    if (add) { addMenuItem(add.dataset.add); return; }
    const set = e.target.closest("[data-set]");
    if (set) { addSet(set.dataset.set); return; }
    const go = e.target.closest("[data-open]");
    if (go) open(go.dataset.open);
  });
  $$(".hud [data-open]").forEach((b) => b.addEventListener("click", () => open(b.dataset.open)));

  // ---------- 拍照模式（T-54） ----------
  // 复制场景 SVG，把图片转成 data URL、把 CSS 算出的样式写进属性，画到 Canvas 上，再加店名、日期和印章。
  // file:// 打开时浏览器不允许读本地图片，会提示用线上地址。
  const STYLE_PROPS = ["fill", "fill-opacity", "stroke", "stroke-width", "stroke-opacity", "opacity", "font-family", "font-size", "font-weight", "letter-spacing", "text-anchor", "dominant-baseline", "writing-mode", "visibility", "filter"];
  const toDataURL = async (url) => {
    const blob = await (await fetch(url)).blob();
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  };
  async function sceneImage() {
    const scene = $(".scene");
    const clone = scene.cloneNode(true);
    const src = [scene, ...scene.querySelectorAll("*")];
    const dst = [clone, ...clone.querySelectorAll("*")];
    src.forEach((el, i) => {
      const cs = getComputedStyle(el);
      const style = STYLE_PROPS.map((p) => `${p}:${cs.getPropertyValue(p)}`).join(";");
      dst[i].setAttribute("style", (dst[i].getAttribute("style") || "") + ";" + style + ";animation:none;transition:none");
      if (cs.display === "none") dst[i].setAttribute("display", "none");
    });
    // 拍照时不显示悬停轮廓和提示点
    $$(".hotspot-dot, .pop-say", clone).forEach((el) => el.remove());
    $$(".hit-area", clone).forEach((el) => el.setAttribute("style", "fill:transparent;stroke:transparent"));
    const grain = $("#kb-grain");
    if (grain) clone.querySelector("defs").appendChild(grain.cloneNode(true));
    const cache = {};
    for (const img of $$("image", clone)) {
      const href = img.getAttribute("href");
      if (!href || href.startsWith("data:")) continue;
      cache[href] = cache[href] || await toDataURL(new URL(href, location.href).href);
      img.setAttribute("href", cache[href]);
    }
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", 1200);
    clone.setAttribute("height", 800);
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml" }));
    try {
      const im = new Image();
      im.src = url;
      await im.decode();
      return im;
    } finally { URL.revokeObjectURL(url); }
  }

  async function takePhoto() {
    if (location.protocol === "file:") { toast(t("photo.fileOnly")); return; }
    toast(t("photo.taking"));
    try {
      const im = await sceneImage();
      const c = document.createElement("canvas");
      c.width = 1280; c.height = 960;
      const g = c.getContext("2d");
      g.fillStyle = "#fff8ec"; g.fillRect(0, 0, c.width, c.height);
      g.drawImage(im, 40, 40, 1200, 800);
      g.strokeStyle = "#96643e"; g.lineWidth = 4; g.strokeRect(40, 40, 1200, 800);
      // 下方：店名、日期 + 座位、朱红印章
      const seat = D.seats.find((s) => s.id === state.seat);
      const date = new Date().toLocaleDateString(isEn() ? "en-US" : "zh-CN", { year: "numeric", month: "long", day: "numeric" });
      g.fillStyle = "#423831";
      g.font = '600 40px "Yuji Syuku", "Noto Serif SC", serif';
      g.textBaseline = "middle";
      g.fillText(isEn() ? "Kobune Sushi" : "小舟 · Kobune", 48, 900);
      g.font = '400 24px "Noto Serif SC", serif';
      g.fillStyle = "#796957";
      g.textAlign = "right";
      g.fillText(date + (seat ? " · " + seatName(seat) : ""), 1140, 900);
      g.save();
      g.translate(1196, 900); g.rotate(-0.12);
      g.strokeStyle = "#ad573f"; g.lineWidth = 4; g.strokeRect(-30, -30, 60, 60);
      g.fillStyle = "#ad573f"; g.textAlign = "center"; g.font = '600 38px "Yuji Syuku", serif';
      g.fillText("舟", 0, 2);
      g.restore();
      open("photo", c.toDataURL("image/png"));
    } catch {
      toast(t("photo.failed"));
    }
  }

  // ---------- 当厨师（T-10 ~ T-12） ----------
  const CM = D.chefMode;
  const cmText = (key, i) => {
    const list = isEn() && EN.chefMode && EN.chefMode[key];
    return (list && list[i]) || CM[key][i];
  };
  const reactionText = (stars, i) => {
    const list = isEn() && EN.chefMode && EN.chefMode.reactions[stars];
    return (list && list[i]) || CM.reactions[stars][i];
  };
  // 新客人：随机装扮，点 2–3 种常见鱼，每种 1–3 片；鱼柜里多放 2 种干扰
  function newCustomer() {
    const look = Object.fromEntries(Object.entries(D.guest).map(([k, opts]) => [k, pick(opts).id]));
    const pool = menuFish.filter((f) => f.rarity <= 2).sort(() => Math.random() - 0.5);
    const kinds = Math.random() < 0.4 ? 3 : 2;
    const order = Object.fromEntries(pool.slice(0, kinds).map((f) => [f.id, 1 + Math.floor(Math.random() * (kinds === 3 ? 2 : 3))]));
    const caseIds = pool.slice(0, kinds + 2).map((f) => f.id).sort(() => Math.random() - 0.5);
    state.npc = { look, order, caseIds, intro: pickIndex(CM.orderIntro), reaction: 0 };
    state.plating = [];
    state.plateSel = -1;
  }
  const orderText = (order) => Object.entries(order).map(([id, n]) => t("plate.line", { name: fishName(fishById[id]), n })).join(t("chef.listSep"));

  function setRole(role) {
    if (dishState.serving) { toast(t("toast.busy")); return; }
    if (role === state.role) { if (isChef()) open("chefOrder"); else close(); return; }
    state.role = role;
    store.set("role", role);
    hideDish();
    if (isChef()) {
      newCustomer();
      updateHud();
      guestAct("act-sit", 500);
      open("chefOrder");
    } else {
      updateHud();
      close();
      toast(t("role.backGuest"));
      if (!state.seat) open("seats");
    }
  }

  function rateDish(order, slices) {
    const got = {};
    slices.forEach((sl) => { got[sl.fish] = (got[sl.fish] || 0) + 1; });
    let wrong = 0, diff = 0;
    new Set([...Object.keys(order), ...Object.keys(got)]).forEach((id) => {
      if (!order[id]) wrong += got[id];
      else diff += Math.abs((got[id] || 0) - order[id]);
    });
    if (!wrong && !diff) return 3;
    if (!wrong && diff <= 1) return 2;
    return 1;
  }

  // 上菜：盘子按玩家摆的样子端给客人，客人评价后自己吃完，春田（你）收盘，下一位客人进店
  function serveToNpc() {
    if (!state.plating.length) { toast(t("plate.empty")); return; }
    if (dishState.serving) { toast(t("toast.busy")); return; }
    const npc = state.npc;
    const stars = rateDish(npc.order, state.plating);
    const used = [...new Set(state.plating.map((sl) => sl.fish))];
    const fresh = used.filter((id) => !state.collected.has(id));
    fresh.forEach((id) => { state.collected.add(id); state.fresh.add(id); });
    store.set("zukan", [...state.collected]);
    store.set("fresh", [...state.fresh]);
    state.chefStats.served += 1;
    state.chefStats.stars += stars;
    store.set("chefStats", state.chefStats);
    const bonus = stars === 3 && state.stamps < STAMP_MAX;
    if (bonus) { state.stamps += 1; store.set("stamps", state.stamps); }
    npc.reaction = pickIndex(CM.reactions[stars]);
    const art = ART.platter(state.plating.map((sl) => ({ ...sl, fish: fishById[sl.fish] })));
    state.plating = [];
    state.plateSel = -1;
    updateHud();
    close();
    serveDish([], "dine", () => {
      guestSay(stars === 3 ? "おいしい！" : stars === 2 ? "うん！" : "あれ？");
      guestAct(stars > 1 ? "act-happy" : "act-chomp", 900);
      open("chefResult", stars, fresh, bonus);
      npcEats();
    }, { art, say: "お待ち！" });
  }

  async function npcEats() {
    await wait(1600);
    while (isChef() && dishState.art) {
      await eatDish();
      await wait(650);
    }
    if (!isChef()) return;
    newCustomer();
    updateHud();
    guestAct("act-sit", 500);
    toast(t("order.nextArrived"));
  }

  const sliceSVG = (f, w = 40) => `<svg viewBox="0 0 40 60" width="${w}" height="${w * 1.5}" aria-hidden="true">${ART.slicePiece(f)}</svg>`;

  // ---------- 各个视图 ----------
  const views = {};

  views.role = {
    cls: "book",
    render: () => {
      const st = state.chefStats;
      return `
        <h2>${t("role.title")}</h2>
        <p class="sub">${t("role.sub")}</p>
        <div class="role-cards">
          <button class="role-card ${isChef() ? "" : "active"}" data-role="guest" aria-pressed="${!isChef()}">
            <svg viewBox="-125 -255 250 275" class="role-art" aria-hidden="true"><rect x="-125" y="-255" width="250" height="275" fill="#f4e6d1"/>${guestSVG(state.guest, "preview")}</svg>
            <b>${t("role.guest")}</b><span>${t("role.guestDesc")}</span>
          </button>
          <button class="role-card ${isChef() ? "active" : ""}" data-role="chef" aria-pressed="${isChef()}">
            ${chefPortrait()}
            <b>${t("role.chef")}</b><span>${t("role.chefDesc")}</span>
          </button>
        </div>
        <p class="card-hint">${t("role.look")}</p>
        ${st.served ? `<p class="card-hint">${t("role.stats", { n: st.served, avg: (st.stars / st.served).toFixed(1) })}</p>` : ""}`;
    },
    mount: () => {
      $$("[data-role]", body).forEach((b) => b.addEventListener("click", () => setRole(b.dataset.role)));
    },
  };

  views.chefOrder = {
    cls: "book",
    render: () => {
      const npc = state.npc;
      return `
        <h2>${t("order.title")}</h2>
        <div class="order-wrap">
          <svg viewBox="-125 -255 250 275" class="role-art" aria-hidden="true"><rect x="-125" y="-255" width="250" height="275" fill="#f4e6d1"/>${guestSVG(npc.look, "preview")}</svg>
          <div>
            <div class="bubble">${cmText("orderIntro", npc.intro)}</div>
            <ul class="order-ticket">
              ${Object.entries(npc.order).map(([id, n]) => `<li>${sliceSVG(fishById[id], 22)}<b>${fishName(fishById[id])}</b><span>× ${n}</span></li>`).join("")}
            </ul>
          </div>
        </div>
        <div class="btn-row" style="justify-content:center">
          <button class="btn primary" data-open="plating">${t("order.start")}</button>
          <button class="btn" id="npc-next">${t("order.next")}</button>
          <button class="btn" data-open="role">${t("role.pick")}</button>
        </div>`;
    },
    mount: () => {
      $("#npc-next", body).addEventListener("click", () => {
        if (dishState.serving || dishState.art) { toast(t("toast.busy")); return; }
        newCustomer(); updateHud(); guestAct("act-sit", 500); rerender();
      });
    },
  };

  views.plating = {
    cls: "book",
    render: () => {
      const npc = state.npc;
      const n = state.plating.length;
      return `
        <h2>${t("plate.title")}</h2>
        <p class="sub">${t("plate.order", { list: orderText(npc.order) })}</p>
        <div class="plating">
          <div class="plating-case" role="group" aria-label="${t("plate.case")}">
            ${npc.caseIds.map((id) => `<button class="cut-btn" data-cut="${id}">${sliceSVG(fishById[id], 26)}<span>${fishName(fishById[id])}</span></button>`).join("")}
          </div>
          <div class="plating-board" id="plating-board">
            ${state.plating.map((sl, i) => `<div class="pslice ${i === state.plateSel ? "sel" : ""}" data-i="${i}" tabindex="0" role="button" aria-label="${t("plate.slice", { name: fishName(fishById[sl.fish]) })}" style="left:${sl.x * 100}%;top:${sl.y * 100}%;z-index:${sl.z};transform:translate(-50%,-50%) rotate(${sl.r}deg)">${sliceSVG(fishById[sl.fish], 40)}</div>`).join("")}
            ${n ? "" : `<p class="plating-empty">${t("plate.prompt")}</p>`}
          </div>
        </div>
        <p class="card-hint">${t("plate.hint")} · ${t("plate.count", { n, max: CM.maxSlices })}</p>
        <div class="btn-row" style="justify-content:center">
          <button class="btn" id="plate-rotate" ${state.plateSel < 0 ? "disabled" : ""}>${t("plate.rotate")}</button>
          <button class="btn" id="plate-clear" ${n ? "" : "disabled"}>${t("plate.clear")}</button>
          <button class="btn" id="plate-shuffle" ${n ? "" : "disabled"}>${t("plate.shuffle")}</button>
          <button class="btn primary" id="plate-serve" ${n ? "" : "disabled"}>${t("plate.serve")}</button>
        </div>`;
    },
    mount: () => {
      const board = $("#plating-board", body);
      let top = Math.max(0, ...state.plating.map((sl) => sl.z));
      const clamp = (v) => Math.min(0.86, Math.max(0.14, v));
      const place = (el, sl) => {
        el.style.left = sl.x * 100 + "%";
        el.style.top = sl.y * 100 + "%";
        el.style.zIndex = sl.z;
        el.style.transform = `translate(-50%,-50%) rotate(${sl.r}deg)`;
      };
      const select = (i) => {
        state.plateSel = i;
        $$(".pslice", board).forEach((el) => el.classList.toggle("sel", Number(el.dataset.i) === i));
        $("#plate-rotate", body).disabled = i < 0;
      };
      $$("[data-cut]", body).forEach((b) => b.addEventListener("click", () => {
        if (state.plating.length >= CM.maxSlices) { toast(t("plate.full")); return; }
        chefSay("トン");
        chefAct("act-slice", 500);
        state.plating.push({ fish: b.dataset.cut, x: 0.3 + Math.random() * 0.4, y: 0.3 + Math.random() * 0.4, r: Math.round(Math.random() * 60 - 30), z: top + 1 });
        state.plateSel = state.plating.length - 1;
        rerender();
      }));
      $$(".pslice", board).forEach((el) => {
        const i = Number(el.dataset.i);
        const sl = state.plating[i];
        el.addEventListener("pointerdown", (e) => {
          e.preventDefault();
          select(i);
          sl.z = ++top;
          place(el, sl);
          el.setPointerCapture(e.pointerId);
          const move = (ev) => {
            const r = board.getBoundingClientRect();
            sl.x = clamp((ev.clientX - r.left) / r.width);
            sl.y = clamp((ev.clientY - r.top) / r.height);
            place(el, sl);
          };
          const up = () => { el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", up); };
          el.addEventListener("pointermove", move);
          el.addEventListener("pointerup", up);
          el.addEventListener("pointercancel", up);
        });
        el.addEventListener("wheel", (e) => { e.preventDefault(); select(i); sl.r = (sl.r + (e.deltaY > 0 ? 15 : -15)) % 360; place(el, sl); }, { passive: false });
        // 键盘：方向键移动，R 旋转
        el.addEventListener("keydown", (e) => {
          const step = { ArrowLeft: [-0.04, 0], ArrowRight: [0.04, 0], ArrowUp: [0, -0.04], ArrowDown: [0, 0.04] }[e.key];
          if (step) { e.preventDefault(); sl.x = clamp(sl.x + step[0]); sl.y = clamp(sl.y + step[1]); }
          else if (e.key === "r" || e.key === "R") sl.r = (sl.r + 30) % 360;
          else return;
          select(i);
          place(el, sl);
        });
        el.addEventListener("focus", () => select(i));
      });
      $("#plate-rotate", body).addEventListener("click", () => {
        const sl = state.plating[state.plateSel];
        if (!sl) return;
        sl.r = (sl.r + 30) % 360;
        place($(`.pslice[data-i="${state.plateSel}"]`, board), sl);
      });
      $("#plate-clear", body).addEventListener("click", () => { state.plating = []; state.plateSel = -1; rerender(); });
      $("#plate-shuffle", body).addEventListener("click", () => {
        state.plating.forEach((sl) => { sl.x = 0.2 + Math.random() * 0.6; sl.y = 0.2 + Math.random() * 0.6; sl.r = Math.round(Math.random() * 360); });
        rerender();
      });
      $("#plate-serve", body).addEventListener("click", serveToNpc);
    },
  };

  views.chefResult = {
    cls: "book",
    render: (stars, fresh, bonus) => `
      <div class="receipt">
        <div class="stars" role="img" aria-label="${t("result.stars", { n: stars })}">${"★".repeat(stars)}<span>${"★".repeat(3 - stars)}</span></div>
        <h2>${t("result.title" + stars)}</h2>
        <div class="bubble">${reactionText(stars, state.npc.reaction)}</div>
        ${bonus ? `<p class="stamp-note">${t("result.stamp", { have: state.stamps, max: STAMP_MAX })}</p>` : ""}
        ${fresh.length ? `<p>${t("receipt.new", { n: fresh.length })}</p><div class="unlock-row">${fresh.map((id) => cardHTML(fishById[id], true)).join("")}</div>` : ""}
        <div class="btn-row" style="justify-content:center">
          <button class="btn primary" id="result-ok">${t("result.ok")}</button>
        </div>
      </div>`,
    mount: () => { $("#result-ok", body).addEventListener("click", close); },
  };

  views.photo = {
    cls: "book",
    render: (dataUrl) => {
      const d = new Date();
      const name = `kobune-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}.png`;
      return `
        <h2>${t("photo.title")}</h2>
        <p class="sub">${t("photo.sub")}</p>
        <img class="photo-preview" src="${dataUrl}" alt="${t("photo.alt")}">
        <div class="btn-row" style="justify-content:center">
          <a class="btn primary" id="photo-save" href="${dataUrl}" download="${name}">${t("photo.save")}</a>
          ${navigator.canShare ? `<button class="btn" id="photo-share">${t("photo.share")}</button>` : ""}
        </div>`;
    },
    mount: (dataUrl) => {
      const share = $("#photo-share", body);
      if (!share) return;
      share.addEventListener("click", async () => {
        try {
          const blob = await (await fetch(dataUrl)).blob();
          const file = new File([blob], "kobune.png", { type: "image/png" });
          if (navigator.canShare({ files: [file] })) await navigator.share({ files: [file], title: shopName() });
          else toast(t("photo.noShare"));
        } catch { /* 用户取消分享 */ }
      });
    },
  };

  // 暖帘：店铺介绍
  views.noren = {
    cls: "book",
    render: () => `
      <h2>いらっしゃいませ</h2>
      <p class="sub">${D.shop.name} · ${D.shop.jp} · ${D.shop.en}</p>
      <p>${t("noren.welcome")}</p>
      <ul>${t("noren.items").map(([k, v]) => `<li><b>${k}</b>${isEn() ? ": " : "："}${v}</li>`).join("")}</ul>
      <p>${t("noren.outro")}</p>
      <div class="btn-row">
        <button class="btn primary" data-open="seats">${t("btn.goSeats")}</button>
        <button class="btn" data-open="tablemenu">${t("btn.seeMenu")}</button>
        <button class="btn" data-open="role">${t("role.pick")}</button>
      </div>`,
  };

  // 门口立牌：黑板 + 竖排
  views.board = {
    render: () => `
      <h2>本日のおすすめ</h2>
      <p class="sub">${t("board.sub")}</p>
      <div class="chalk-cols">
        ${todaysFresh.map((f) => `
          <button class="chalk-col" data-add="s-${f.id}" title="${fishName(f)}">${f.kanji}<small>${rmb(f.price)}</small></button>`).join("")}
        <button class="chalk-col special" data-open="chef">おまかせ<small>${t("board.market")}</small></button>
      </div>
      <p class="board-note">— 今日も元気に営業中 —</p>`,
  };

  // 墙上木札：一品料理 + 甜品
  views.tags = {
    render: () => {
      const hot = D.menu.find((c) => c.id === "hot").items;
      const sweet = D.menu.find((c) => c.id === "sweet").items;
      const tag = (it, cls = "") => `<button class="wood-tag ${cls}" data-add="${it.id}" title="${itemName(it)}${itemDesc(it) ? " · " + itemDesc(it) : ""}">${it.jp}<small>${rmb(it.price)}</small></button>`;
      return `
        <h2>お品書き</h2>
        <p class="sub">${t("tags.sub")}</p>
        <div class="tag-wall">${hot.map((it) => tag(it)).join("")}${sweet.map((it) => tag(it, "sweet")).join("")}</div>`;
    },
  };

  // 酒架
  views.drinks = {
    cls: "book",
    render: () => {
      const items = D.menu.find((c) => c.id === "drinks").items;
      return `
        <h2>お飲み物</h2>
        <p class="sub">${t("drinks.sub")}</p>
        <div class="drink-grid">
          ${items.map((it) => `
            <div class="drink">
              <div class="bottle" style="--c:${it.bottle}"></div>
              <b>${it.jp}</b>
              <span>${itemName(it)} · ${itemDesc(it)}</span>
              <div class="price">${rmb(it.price)}</div>
              <div class="btn-row" style="justify-content:center;margin-top:8px">
                <button class="btn" data-add="${it.id}">${t("drinks.order")}</button>
              </div>
            </div>`).join("")}
        </div>`;
    },
  };

  // 桌面菜单：分页签的菜单册
  views.tablemenu = {
    cls: "book",
    render: () => {
      const cat = D.menu.find((c) => c.id === state.menuTab);
      return `
        <h2>メニュー</h2>
        <p class="sub">${t("menu.sub", { tag: `<span class="got" style="margin:0">${t("menu.got")}</span>` })}</p>
        <div class="tabs">
          ${D.menu.map((c) => `<button class="tab ${c.id === state.menuTab ? "active" : ""}" data-tab="${c.id}">${catName(c)}<small>${c.jp}</small></button>`).join("")}
        </div>
        ${cat.id === "sets" ? setListHTML() : `<ul class="menu-list">
          ${cat.items.map((it) => {
            const f = it.fish && fishById[it.fish[0]];
            const got = it.fish && it.fish.every((id) => state.collected.has(id));
            return `
              <li class="menu-item">
                <div class="dish">${itemArt(it)}</div>
                <div class="name"><b>${itemName(it)}${got ? `<span class="got">${t("menu.got")}</span>` : ""}</b><span>${it.jp}${itemDesc(it) ? " · " + itemDesc(it) : ""}</span></div>
                <span class="price">${rmb(it.price)}</span>
                <button class="btn add" data-add="${it.id}">${t("menu.order")}</button>
              </li>`;
          }).join("")}
        </ul>`}`;
    },
    mount: () => {
      $$(".tab", body).forEach((t) => t.addEventListener("click", () => {
        state.menuTab = t.dataset.tab;
        rerender();
      }));
    },
  };

  function setArt(st, c) {
    if (st.pick === "daily3") return ART.nigiri(c.fish[0]);
    if (c.fish.length) return ART.sashimi(c.fish[0], 2);
    return `<span class="set-badge">${st.pick === "omakase" ? "任" : "定"}</span>`;
  }
  function setListHTML() {
    return `
      <p class="sub set-note">${t("sets.note")}</p>
      <ul class="menu-list">
        ${D.sets.map((st) => {
          const c = setContents(st);
          const random = st.pick === "omakase";
          const today = st.pick === "fresh3" || st.pick === "daily3"
            ? t("sets.today", { list: c.nigiri ? c.nigiri.map((id) => itemName(itemById[id])).join(t("chef.listSep")) : c.fish.map(fishName).join(t("chef.listSep")) })
            : "";
          return `
            <li class="menu-item set-item">
              <div class="dish">${setArt(st, c)}</div>
              <div class="name"><b>${setName(st)}</b><span>${st.jp} · ${setDesc(st)}</span>${today ? `<span class="set-today">${today}</span>` : ""}</div>
              <span class="price">${random ? t("sets.market") : `<s>${rmb(c.base)}</s> ${rmb(c.price)}`}</span>
              <button class="btn add" data-set="${st.id}">${t("menu.order")}</button>
            </li>`;
        }).join("")}
      </ul>`;
  }

  // 师傅
  const chefPortrait = () => `
    <svg viewBox="-100 -280 200 220" class="chef-portrait" aria-hidden="true">
      <rect x="-100" y="-280" width="200" height="220" fill="#f4e6d1"/>
      ${chefSVG(state.chefLook)}
    </svg>`;

  function rollOmakase() {
    const weightOf = (f) => {
      if (f.omakaseOnly) return 2 + state.luck * 5;
      return { 1: 40, 2: 26, 3: 10 + state.luck * 3 }[f.rarity] || 10;
    };
    const pool = [...D.fish];
    const chosen = [];
    while (chosen.length < 3) {
      const total = pool.reduce((s, f) => s + weightOf(f), 0);
      let r = Math.random() * total;
      const idx = pool.findIndex((f) => (r -= weightOf(f)) <= 0);
      chosen.push(pool.splice(idx < 0 ? 0 : idx, 1)[0]);
    }
    const price = Math.round(chosen.reduce((s, f) => s + f.price, 0) * 0.9);
    return { fish: chosen, price };
  }

  views.chef = {
    render: (mode = "hello") => {
      const atCounter = state.seat === "counter";
      const greetings = chefLine("greetings");
      let line = greetings[pickIndex(greetings)];
      if (atCounter && Math.random() < 0.6) line = pick(chefLine("counterExtra"));
      let extra = "";

      if (festival && Math.random() < 0.5) line = festText(festival, "line");
      else if (rainy && Math.random() < 0.5) line = pick(chefLine("rainy"));
      if (state.stamps >= STAMP_MAX) line = t("chef.cardFull");
      if (mode === "fresh") {
        line = t("chef.fresh", { list: todaysFresh.map(fishName).join(t("chef.listSep")) });
      }
      if (mode === "omakase") {
        const om = state.omakase;
        const legendary = om.fish.some((f) => f.rarity === 4);
        line = chefLine("omakaseIntro") + (legendary ? chefLine("legendary") : "");
        extra = `
          <div class="omakase-preview">
            <div class="plate">${plateInnerHTML(om.fish.map((f) => f.id))}</div>
            <p class="plate-summary">${om.fish.map((f) => `${fishName(f)} (${D.rarity[f.rarity].label})`).join(" · ")}<br><span class="price">${rmb(om.price)}</span></p>
            <div class="btn-row" style="justify-content:center">
              <button class="btn primary" id="om-take">${t("chef.take")}</button>
              <button class="btn" id="om-reroll">${t("chef.reroll")}</button>
            </div>
          </div>`;
      }

      return `
        <div class="chef-wrap">
          ${chefPortrait()}
          <div>
            <h2>${t("shop.chef")}</h2>
            <p class="sub">${D.shop.chefJp} · ${t("chef.title")}${atCounter ? " · " + t("chef.atCounter") : ""}</p>
            <div class="bubble">${line}</div>
            <div class="btn-row">
              <button class="btn primary" id="chef-omakase">${t("chef.btnOmakase")}</button>
              <button class="btn" data-open="fishcase">${t("chef.btnSelf")}</button>
              <button class="btn" id="chef-fresh">${t("chef.btnFresh")}</button>
              <button class="btn" data-open="pointcard">${t("card.btn", { n: state.stamps, max: STAMP_MAX })}</button>
            </div>
          </div>
        </div>
        ${extra}`;
    },
    mount: () => {
      const roll = () => { state.omakase = rollOmakase(); rerender("omakase"); };
      $("#chef-omakase", body).addEventListener("click", roll);
      $("#chef-fresh", body).addEventListener("click", () => rerender("fresh"));
      const take = $("#om-take", body);
      if (take) {
        take.addEventListener("click", () => {
          const om = state.omakase;
          addToCart({
            key: "omakase-" + Date.now(),
            kind: "omakase",
            counts: Object.fromEntries(om.fish.map((f) => [f.id, 1])),
            price: om.price,
            fish: om.fish.map((f) => f.id),
          });
          state.omakase = null;
          rerender("hello");
        });
        $("#om-reroll", body).addEventListener("click", roll);
      }
    },
  };

  // 鱼柜：自选鱼生拼盘
  const MAX_PORTIONS = 6;

  function plateInnerHTML(fishIds, removable = false) {
    const center = `<div class="plate-center"><div class="daikon"></div><div class="shiso"></div><div class="wasabi"></div></div>`;
    if (!fishIds.length) return center + `<div class="plate-empty">${t("case.platePrompt")}</div>`;
    const n = fishIds.length;
    return center + fishIds.map((id, i) => {
      const f = fishById[id];
      const angle = (360 / n) * i;
      return `<div class="portion" ${removable ? `data-remove="${i}" title="${t("case.remove", { name: fishName(f) })}"` : ""} style="transform: rotate(${angle}deg)">
        <div class="portion-inner">${ART.sashimi(f, 3)}</div></div>`;
    }).join("");
  }

  views.fishcase = {
    cls: "book",
    render: () => {
      const total = state.plate.reduce((s, id) => s + fishById[id].price, 0);
      return `
        <h2>ネタケース</h2>
        <p class="sub">${t("case.sub", { max: MAX_PORTIONS })}</p>
        <div class="builder">
          <div class="case-grid">
            ${menuFish.map((f) => `
              <button class="fish-btn" data-fish="${f.id}">
                ${swatchHTML(f, 2)}
                <b>${fishName(f)}</b>
                <span>${f.jp}</span>
                <span class="price">${rmb(f.price)}</span>
              </button>`).join("")}
          </div>
          <div class="plate-area">
            <div class="plate" id="plate">${plateInnerHTML(state.plate, true)}</div>
            <p class="plate-summary">${state.plate.length ? `${t("case.count", { n: state.plate.length, max: MAX_PORTIONS })} · <span class="price">${rmb(total)}</span>` : t("case.empty")}</p>
            <div class="btn-row" style="justify-content:center">
              <button class="btn primary" id="plate-order" ${state.plate.length ? "" : "disabled"}>${t("case.order")}</button>
              <button class="btn" id="plate-clear" ${state.plate.length ? "" : "disabled"}>${t("case.clear")}</button>
            </div>
          </div>
        </div>`;
    },
    mount: () => {
      $$(".fish-btn", body).forEach((b) => b.addEventListener("click", () => {
        if (state.plate.length >= MAX_PORTIONS) { toast(t("toast.plateFull")); return; }
        state.plate.push(b.dataset.fish);
        rerender();
      }));
      $$("[data-remove]", body).forEach((p) => p.addEventListener("click", () => {
        state.plate.splice(Number(p.dataset.remove), 1);
        rerender();
      }));
      $("#plate-clear", body).addEventListener("click", () => { state.plate = []; rerender(); });
      $("#plate-order", body).addEventListener("click", () => {
        const counts = {};
        state.plate.forEach((id) => { counts[id] = (counts[id] || 0) + 1; });
        addToCart({
          key: "plate-" + Date.now(),
          kind: "plate",
          counts,
          price: state.plate.reduce((s, id) => s + fishById[id].price, 0),
          fish: [...new Set(state.plate)],
        });
        state.plate = [];
        rerender();
      });
    },
  };

  // 座位
  views.seats = {
    cls: "book",
    render: (then) => `
      <h2>お席</h2>
      <p class="sub">${t("seats.sub")} · <button class="link" data-open="guest">${t("seats.changeLook")}</button></p>
      <div class="seat-grid">
        ${D.seats.map((s) => `
          <button class="seat-card ${state.seat === s.id ? "active" : ""}" data-seat="${s.id}">
            <b>${seatName(s)}</b><small>${s.jp}</small>
            <p>${seatDesc(s)}</p>
          </button>`).join("")}
      </div>`,
    mount: (then) => {
      $$(".seat-card", body).forEach((c) => c.addEventListener("click", () => {
        chooseSeat(c.dataset.seat);
        if (then) open(then); else close();
      }));
    },
  };

  // 客人形象
  views.guest = {
    cls: "book",
    render: () => `
      <h2>お客さん</h2>
      <p class="sub">${t("guest.sub")}</p>
      <div class="guest-wrap">
        <svg class="guest-preview" viewBox="-125 -255 250 275" aria-hidden="true">
          <rect x="-125" y="-255" width="250" height="275" fill="#f4e6d1"/>
          <ellipse cx="0" cy="4" rx="88" ry="12" fill="#bd7656"/>
          ${guestSVG(state.guest, "preview")}
        </svg>
        <div class="guest-opts">
          ${Object.entries(D.guest).map(([k, opts]) => `
            <div class="opt-row">
              <span>${t("guest." + k)}</span>
              <div>${opts.map((o) => `
                <button class="opt ${state.guest[k] === o.id ? "active" : ""}" data-k="${k}" data-v="${o.id}">
                  ${o.color ? `<i style="background:${o.color}"></i>` : ""}${optName(o)}
                </button>`).join("")}</div>
            </div>`).join("")}
        </div>
      </div>
      <div class="opt-row bday-row">
        <span>${t("bday.label")}</span>
        <div>
          <select id="bday-m" aria-label="${t("bday.month")}"><option value="">${t("bday.month")}</option>${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}" ${state.birthday && state.birthday.m === i + 1 ? "selected" : ""}>${t("bday.m", { n: i + 1 })}</option>`).join("")}</select>
          <select id="bday-d" aria-label="${t("bday.day")}"><option value="">${t("bday.day")}</option>${Array.from({ length: 31 }, (_, i) => `<option value="${i + 1}" ${state.birthday && state.birthday.d === i + 1 ? "selected" : ""}>${t("bday.d", { n: i + 1 })}</option>`).join("")}</select>
          <small>${t("bday.note")}</small>
        </div>
      </div>
      <div class="btn-row">
        <button class="btn primary" data-open="seats">${state.seat ? t("guest.changeSeat") : t("btn.goSeats")}</button>
        <button class="btn" id="guest-random">${t("guest.random")}</button>
      </div>`,
    mount: () => {
      const save = () => { store.set("guest", state.guest); updateHud(); rerender(); };
      $$(".opt", body).forEach((b) => b.addEventListener("click", () => {
        state.guest[b.dataset.k] = b.dataset.v; save();
      }));
      const saveBday = () => {
        const m = Number($("#bday-m", body).value), d = Number($("#bday-d", body).value);
        // 不存在的日期（如 4 月 31 日）按无效处理
        const valid = m && d && d <= [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
        state.birthday = valid ? { m, d } : null;
        store.set("birthday", state.birthday);
        if (valid) toast(isBirthday() && state.bdayYear !== new Date().getFullYear() ? t("bday.today") : t("bday.saved"));
      };
      $("#bday-m", body).addEventListener("change", saveBday);
      $("#bday-d", body).addEventListener("change", saveBday);
      $("#guest-random", body).addEventListener("click", () => {
        Object.entries(D.guest).forEach(([k, opts]) => { state.guest[k] = pick(opts).id; });
        save();
      });
    },
  };

  // 订单 / 结账
  views.cart = {
    cls: "book",
    render: () => {
      const total = state.cart.reduce((s, l) => s + l.price * l.qty, 0);
      const seat = D.seats.find((s) => s.id === state.seat);
      if (!state.cart.length) {
        return `
          <h2>ご注文</h2>
          <p class="sub">${t("cart.sub")}</p>
          <p class="empty">${t("cart.empty")}</p>
          <div class="btn-row" style="justify-content:center">
            <button class="btn" data-open="tablemenu">${t("cart.menu")}</button>
            <button class="btn" data-open="fishcase">${t("cart.self")}</button>
            <button class="btn" data-open="chef">${t("cart.chef")}</button>
          </div>`;
      }
      return `
        <h2>ご注文</h2>
        <div class="mode-toggle" role="radiogroup" aria-label="${t("cart.mode")}">
          ${["dine", "takeout"].map((m) => `<button class="mode ${state.orderMode === m ? "active" : ""}" data-mode="${m}" role="radio" aria-checked="${state.orderMode === m}">${t("cart." + m)}</button>`).join("")}
        </div>
        <p class="sub">${state.orderMode === "takeout" ? t("cart.takeoutNote") : t("cart.seat", { name: seat ? seatName(seat) : t("cart.seatNone") })}</p>
        <ul class="cart-list">
          ${state.cart.map((l, i) => `
            <li class="cart-line">
              <div><b>${lineName(l)}</b>${lineNote(l) ? `<small>${lineNote(l)}</small>` : ""}</div>
              <div class="qty"><button data-dec="${i}" aria-label="${t("cart.dec")}">−</button><span>${l.qty}</span><button data-inc="${i}" aria-label="${t("cart.inc")}">+</button></div>
              <span class="price">${rmb(l.price * l.qty)}</span>
            </li>`).join("")}
        </ul>
        <div class="cart-total"><span>${t("cart.total")}</span><span class="price">${rmb(total)}</span></div>
        <div class="btn-row" style="justify-content:flex-end">
          <button class="btn" data-open="tablemenu">${t("cart.more")}</button>
          <button class="btn primary" id="cart-submit">${t("cart.submit")}</button>
        </div>`;
    },
    mount: () => {
      $$("[data-inc]", body).forEach((b) => b.addEventListener("click", () => {
        state.cart[b.dataset.inc].qty += 1; updateHud(); rerender();
      }));
      $$("[data-dec]", body).forEach((b) => b.addEventListener("click", () => {
        const l = state.cart[b.dataset.dec];
        l.qty -= 1;
        if (l.qty <= 0) state.cart.splice(b.dataset.dec, 1);
        updateHud(); rerender();
      }));
      $$("[data-mode]", body).forEach((b) => b.addEventListener("click", () => {
        state.orderMode = b.dataset.mode; rerender();
      }));
      const submit = $("#cart-submit", body);
      if (submit) submit.addEventListener("click", submitOrder);
    },
  };

  function submitOrder() {
    if (isChef()) { toast(t("role.noOrder")); return; }
    const mode = state.orderMode;
    if (mode === "dine" && !state.seat) {
      toast(t("toast.pickSeat"));
      open("seats", "cart");
      return;
    }
    // 上一单还没端上来时先不收新单，避免两单的盘子和小票互相顶掉
    if (dishState.serving) { toast(t("toast.busy")); return; }
    const lines = state.cart;
    const eaten = [...new Set(lines.flatMap((l) => l.fish || []))];
    const fresh = eaten.filter((id) => !state.collected.has(id));
    fresh.forEach((id) => { state.collected.add(id); state.fresh.add(id); });
    store.set("zukan", [...state.collected]);
    store.set("fresh", [...state.fresh]);
    state.cart = [];
    state.visits += 1;
    store.set("visits", state.visits);
    // 积分卡：一单一个章，おまかせ套餐多一个；集满 10 个就不再加，等兑换
    const before = state.stamps;
    const bonus = Math.max(0, ...lines.filter((l) => l.kind === "set").map((l) => (setById[l.set].stamps || 1) - 1));
    state.stamps = Math.min(STAMP_MAX, state.stamps + 1 + bonus);
    store.set("stamps", state.stamps);
    const stamped = { got: state.stamps - before, have: state.stamps };
    state.receipts.unshift({ at: Date.now(), visit: state.visits, mode, seat: mode === "dine" ? state.seat : null, lines: JSON.parse(JSON.stringify(lines)), fresh, stamps: stamped.got });
    state.receipts.length = Math.min(state.receipts.length, MAX_RECEIPTS);
    store.set("receipts", state.receipts);
    updateHud();
    // 先关掉订单，让客人看到上菜，再弹小票；上菜期间客人打开了别的弹窗就不打断，小票留在小票本里
    close();
    serveDish(lines, mode, () => {
      if (current) toast(t("toast.receiptSaved"));
      else open("receipt", lines, fresh, mode, stamped);
      fresh.forEach((id, i) => setTimeout(() => toast(t("toast.newEntry", { name: fishName(fishById[id]) }), true), 400 + i * 500));
    });
  }

  // ---------- 小票本（T-53） ----------
  const MAX_RECEIPTS = 20;
  const receiptTotal = (r) => r.lines.reduce((s, l) => s + l.price * l.qty, 0);
  const receiptDate = (r) => new Date(r.at).toLocaleString(isEn() ? "en-US" : "zh-CN", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  function receiptText(r) {
    const head = `${shopName()} · ${t("receipts.visit", { n: r.visit })} · ${receiptDate(r)}`;
    const rows = r.lines.map((l) => `- ${lineName(l)} ×${l.qty}  ${rmb(l.price * l.qty)}`);
    return [head, ...rows, `${t("cart.total")} ${rmb(receiptTotal(r))}`].join("\n");
  }

  views.receipts = {
    cls: "book",
    render: () => `
      <h2>${t("receipts.title")}</h2>
      <p class="sub">${t("receipts.sub", { max: MAX_RECEIPTS, n: state.visits })}</p>
      ${state.receipts.length ? `<ul class="receipt-list">${state.receipts.map((r, i) => `
        <li><button class="receipt-row" data-receipt="${i}">
          <span class="stamp-mini">${r.mode === "takeout" ? "持" : "承"}</span>
          <span><b>${t("receipts.visit", { n: r.visit })}</b><small>${receiptDate(r)} · ${t(r.mode === "takeout" ? "cart.takeout" : "cart.dine")} · ${t("receipts.items", { n: r.lines.length })}</small></span>
          <span class="price">${rmb(receiptTotal(r))}</span>
        </button></li>`).join("")}</ul>` : `<p>${t("receipts.empty")}</p>`}`,
    mount: () => {
      $$("[data-receipt]", body).forEach((b) => b.addEventListener("click", () => open("receiptDetail", Number(b.dataset.receipt))));
    },
  };

  views.receiptDetail = {
    cls: "book",
    render: (i) => {
      const r = state.receipts[i];
      return `
        <p class="sub receipt-meta">${t("receipts.visit", { n: r.visit })} · ${receiptDate(r)}</p>
        ${views.receipt.render(r.lines, r.fresh, r.mode)}
        <div class="btn-row" style="justify-content:center">
          <button class="btn" data-open="receipts">${t("receipts.back")}</button>
          <button class="btn" id="receipt-copy">${t("receipts.copy")}</button>
        </div>`;
    },
    mount: (i) => {
      $("#receipt-copy", body).addEventListener("click", async () => {
        try { await navigator.clipboard.writeText(receiptText(state.receipts[i])); toast(t("receipts.copied")); } catch { /* 没有剪贴板权限时静默 */ }
      });
    },
  };


  // ---------- 积分卡和抽奖（T-40） ----------
  const STAMP_MAX = 10;
  function drawPrize() {
    const total = D.prizes.reduce((s, p) => s + p.weight, 0);
    let r = Math.random() * total;
    return D.prizes.find((p) => (r -= p.weight) < 0) || D.prizes[0];
  }
  const ticketHTML = (p, n = 0) => `
    <div class="ticket" style="--tc:${p.color}">
      <span class="ticket-jp">${p.jp}</span>
      <b>${prizeText(p, "name")}</b>
      ${n > 1 ? `<span class="ticket-n">×${n}</span>` : ""}
    </div>`;

  views.pointcard = {
    cls: "book",
    render: () => {
      const n = state.stamps;
      const owned = D.prizes.map((p) => [p, state.prizes.filter((w) => w.id === p.id).length]).filter(([, c]) => c);
      return `
        <h2>${t("card.title")} <small class="jp">ポイントカード</small></h2>
        <p class="sub">${t("card.sub", { max: STAMP_MAX })}</p>
        <div class="stamp-card" role="img" aria-label="${t("card.count", { n, max: STAMP_MAX })}">
          ${Array.from({ length: STAMP_MAX }, (_, i) => `<span class="stamp-slot ${i < n ? "on" : ""}" style="--r:${(i * 37) % 24 - 12}deg">${i < n ? "舟" : i + 1}</span>`).join("")}
        </div>
        <p class="card-count">${t("card.count", { n, max: STAMP_MAX })}</p>
        <div class="btn-row" style="justify-content:center">
          <button class="btn primary" id="card-draw" ${n < STAMP_MAX ? "disabled" : ""}>${t("card.draw")}</button>
        </div>
        ${n < STAMP_MAX ? `<p class="card-hint">${t("card.left", { n: STAMP_MAX - n })}</p>` : ""}
        <h3>${t("card.prizes")}</h3>
        ${owned.length ? `<div class="ticket-row">${owned.map(([p, c]) => ticketHTML(p, c)).join("")}</div>` : `<p class="card-hint">${t("card.noPrize")}</p>`}
        <p class="card-odds">${t("card.odds")}${D.prizes.map((p) => `${prizeText(p, "name")} ${p.weight}%`).join(" · ")}</p>`;
    },
    mount: () => {
      const btn = $("#card-draw", body);
      btn.addEventListener("click", () => {
        if (state.stamps < STAMP_MAX) return;
        // 先定结果再播动画，关掉弹窗也不会丢奖或重抽
        const p = drawPrize();
        state.stamps = 0;
        state.prizes.push({ id: p.id, at: Date.now() });
        store.set("stamps", 0);
        store.set("prizes", state.prizes);
        open("draw", p.id);
        chefAct("act-bow");
      });
    },
  };

  views.draw = {
    cls: "book",
    render: (id) => {
      const p = prizeById[id];
      return `
        <div class="draw">
          <div class="draw-stage">
            ${chefPortrait()}
            <svg class="draw-box" viewBox="0 0 120 120" aria-hidden="true">
              <rect x="14" y="30" width="92" height="80" rx="6" fill="#c8402e" stroke="#3a2418" stroke-width="5"/>
              <rect x="40" y="22" width="40" height="12" rx="4" fill="#3a2418"/>
              <circle cx="60" cy="70" r="20" fill="#f4e6d1" stroke="#3a2418" stroke-width="4"/>
              <text x="60" y="78" text-anchor="middle" font-size="22" font-weight="700" fill="#3a2418">抽</text>
            </svg>
          </div>
          <div class="bubble">${chefLine("drawIntro")}</div>
          <div class="prize-reveal" role="status">
            ${ticketHTML(p)}
            <p><b>${t("draw.got", { name: prizeText(p, "name") })}</b> ${prizeText(p, "desc")}</p>
            <div class="bubble">${prizeText(p, "line")}</div>
            <div class="btn-row" style="justify-content:center">
              <button class="btn primary" data-open="pointcard">${t("draw.back")}</button>
            </div>
          </div>
        </div>`;
    },
  };

  views.receipt = {
    cls: "book",
    render: (lines, fresh, mode = "dine", stamped = null) => {
      const total = lines.reduce((s, l) => s + l.price * l.qty, 0);
      // 这次点到的鱼：堂食摆在木屐盘上，打包装进外带盒
      const served = [...new Set(lines.flatMap((l) => l.fish || []))].map((id) => fishById[id]);
      const takeout = mode === "takeout";
      const art = takeout ? ART.takeoutBox(served) : served.length ? ART.geta(served) : "";
      return `
        <div class="receipt">
          <div class="stamp">${takeout ? "お持ち帰り" : "注文承り"}</div>
          <h2>${takeout ? t("receipt.takeout") : pick(chefLine("afterOrder"))}</h2>
          ${art ? `<div class="served">${art}</div>` : ""}
          <p class="sub">${t("receipt.summary", { n: lines.length })} <span class="price">${rmb(total)}</span></p>
          ${fresh.length ? `
            <p>${t("receipt.new", { n: fresh.length })}</p>
            <div class="unlock-row">${fresh.map((id) => cardHTML(fishById[id], true)).join("")}</div>`
          : `<p>${t("receipt.none")}</p>`}
          ${stamped ? `<p class="stamp-note">${stamped.got ? t("card.gotStamp", { n: stamped.got, have: stamped.have, max: STAMP_MAX }) : t("card.fullNoStamp")}${stamped.have >= STAMP_MAX ? " " + t("card.goDraw") : ""}</p>` : ""}
          <div class="btn-row" style="justify-content:center">
            <button class="btn primary" data-open="zukan">${t("receipt.zukan")}</button>
            <button class="btn" data-open="chef">${t("receipt.again")}</button>
            <button class="btn" data-open="receipts">${t("receipt.book")}</button>
            ${stamped ? `<button class="btn" data-open="pointcard">${t("card.title")}</button>` : ""}
          </div>
        </div>`;
    },
  };

  // 图鉴
  function cardHTML(f, isNew = false) {
    const got = state.collected.has(f.id);
    const no = String(D.fish.indexOf(f) + 1).padStart(2, "0");
    const r = D.rarity[f.rarity];
    if (!got) {
      return `
        <div class="card locked" style="--rc:${r.color}">
          <span class="no">No.${no}</span><span class="rar">${r.label}</span>
          ${sushiHTML(f)}
          <b>？？？</b>
          <span>${f.omakaseOnly ? t("card.omakaseOnly") : t("card.notYet")}</span>
        </div>`;
    }
    return `
      <button class="card ${isNew ? "new" : ""}" data-fish="${f.id}" style="--rc:${r.color}">
        <span class="no">No.${no}</span><span class="rar">${r.label}</span>
        ${sushiHTML(f)}
        <b>${fishName(f)}</b>
        <span>${f.jp}</span>
      </button>`;
  }

  views.zukan = {
    cls: "book",
    render: () => {
      const n = state.collected.size;
      const total = D.fish.length;
      const filters = [["all", t("zukan.all")], ...Object.entries(D.rarity).map(([k, v]) => [k, `${v.label} · ${rarityName(k)}`])];
      const list = D.fish.filter((f) => state.zukanFilter === "all" || String(f.rarity) === state.zukanFilter);
      return `
        <h2>魚図鑑</h2>
        <p class="sub">${t("zukan.sub")}</p>
        <div class="zukan-head">
          <div class="progress">
            <div class="progress-bar"><i style="width:${(n / total) * 100}%"></i></div>
            <small>${t("zukan.progress", { n, total })}${n === total ? t("zukan.complete") : ""}</small>
          </div>
          <div class="filter">${filters.map(([k, label]) => `<button data-filter="${k}" class="${state.zukanFilter === k ? "active" : ""}">${label}</button>`).join("")}</div>
        </div>
        <div class="zukan-grid">${list.map((f) => cardHTML(f, state.fresh.has(f.id))).join("")}</div>`;
    },
    mount: () => {
      $$("[data-filter]", body).forEach((b) => b.addEventListener("click", () => {
        state.zukanFilter = b.dataset.filter; rerender();
      }));
      $$(".card[data-fish]", body).forEach((c) => c.addEventListener("click", () => open("fish", c.dataset.fish)));
      // “新”标记看过一次就消失
      if (state.fresh.size) { state.fresh.clear(); store.set("fresh", []); }
    },
  };

  views.fish = {
    cls: "book",
    render: (id) => {
      const f = fishById[id];
      const r = D.rarity[f.rarity];
      return `
        <div class="detail">
          <div class="detail-visual" style="--rc:${r.color}">${ART.nigiri(f)}${ART.sashimi(f, 3)}</div>
          <div>
            <h3>${fishName(f)}</h3>
            <p class="names">${f.jp} · ${f.kanji} · <i>${f.romaji}</i><br>${isEn() ? f.name : f.en}</p>
            <dl class="facts">
              <dt>${t("fish.rarity")}</dt><dd style="color:${r.color};font-weight:600">${r.label} (${rarityName(f.rarity)})</dd>
              <dt>${t("fish.texture")}</dt><dd>${fishText(f, "texture")}</dd>
              <dt>${t("fish.flavor")}</dt><dd>${fishText(f, "flavor")}</dd>
              <dt>${t("fish.season")}</dt><dd>${fishText(f, "season")}</dd>
              <dt>${t("fish.price")}</dt><dd class="price">${rmb(f.price)} / ${t("fish.perPortion")}</dd>
            </dl>
            <p>${fishText(f, "desc")}</p>
            <div class="btn-row">
              <button class="btn" data-open="zukan">${t("fish.back")}</button>
              ${f.omakaseOnly ? "" : `<button class="btn primary" data-add="s-${f.id}">${t("fish.again")}</button>`}
            </div>
          </div>
        </div>`;
    },
  };

  // 招财猫抽签
  views.neko = {
    cls: "book",
    render: () => {
      // 换语言重绘时沿用同一支签
      if (state.omikujiIdx === undefined || !state.keepOmikuji) state.omikujiIdx = pickIndex(D.omikuji);
      state.keepOmikuji = false;
      const o = D.omikuji[state.omikujiIdx];
      const text = (isEn() && EN.omikuji && EN.omikuji[state.omikujiIdx] && EN.omikuji[state.omikujiIdx].text) || o.text;
      state.luck = Math.max(state.luck, o.luck);
      return `
        <div class="omikuji">
          <h2>おみくじ</h2>
          <p class="sub">${t("neko.sub")}</p>
          <div class="slip">${o.result}</div>
          <p>${text}</p>
          <div class="btn-row" style="justify-content:center">
            <button class="btn primary" data-open="chef">${t("neko.goChef")}</button>
          </div>
        </div>`;
    },
  };

  // ---------- 场景热点 ----------
  const tip = $("#tooltip");
  $$(".hotspot").forEach((el) => {
    const id = el.dataset.id;
    const siblings = $$(`.hotspot[data-id="${id}"]`);
    el.setAttribute("tabindex", "0");
    el.setAttribute("role", "button");

    el.addEventListener("mouseenter", () => {
      const info = hotspotInfo(id);
      siblings.forEach((s) => s.classList.add("linked"));
      tip.innerHTML = `<b>${info.title}</b><span>${info.hint}</span>`;
      tip.hidden = false;
    });
    el.addEventListener("mousemove", (e) => {
      const x = Math.min(e.clientX + 16, window.innerWidth - 260);
      tip.style.left = x + "px";
      tip.style.top = e.clientY + 18 + "px";
    });
    el.addEventListener("mouseleave", () => {
      siblings.forEach((s) => s.classList.remove("linked"));
      tip.hidden = true;
    });
    el.addEventListener("focus", () => {
      const info = hotspotInfo(id);
      const box = (el.querySelector(".guest-hit") || el).getBoundingClientRect();
      tip.innerHTML = `<b>${info.title}</b><span>${info.hint}</span>`;
      tip.style.left = Math.max(8, Math.min(box.left, window.innerWidth - 260)) + "px";
      tip.style.top = Math.min(box.bottom + 8, window.innerHeight - 90) + "px";
      tip.hidden = false;
    });
    el.addEventListener("blur", () => { tip.hidden = true; });
    // 盘子不开弹窗，点一下吃一贯
    // 当厨师时：点春田或客人看订单，点鱼柜去摆盘
    const route = () => (isChef() && { chef: "chefOrder", guest: "chefOrder", fishcase: "plating" }[id]) || id;
    const activate = () => { tip.hidden = true; if (id === "dish") { if (!isChef()) eatDish(); } else open(route()); };
    el.addEventListener("click", activate);
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activate(); }
    });
  });

  function hotspotInfo(id) {
    if (id === "dish" && dishState.mode === "takeout") id = "dishTakeout";
    if (id === "guest" && isChef()) id = "npc";
    const zh = D.hotspots[id];
    return { title: tx("hotspots", id, "title", zh.title), hint: tx("hotspots", id, "hint", zh.hint) };
  }

  // 切换语言：更新静态文案、热点无障碍标签、顶栏，并重绘当前弹窗
  function applyLang() {
    document.documentElement.lang = isEn() ? "en" : "zh-CN";
    $(".scene").setAttribute("aria-label", t("scene.label"));
    $$("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
    const btn = $("#lang-toggle");
    btn.textContent = t("lang.switch");
    btn.setAttribute("aria-label", t("lang.switchLabel"));
    $("#modal-close").setAttribute("aria-label", t("close"));
    $$(".hotspot").forEach((el) => el.setAttribute("aria-label", hotspotInfo(el.dataset.id).title));
    updateHud();
    syncHudHeight();
  }

  $("#lang-toggle").addEventListener("click", () => {
    state.lang = isEn() ? "zh" : "en";
    store.set("lang", state.lang);
    applyLang();
    if (current) {
      state.keepOmikuji = true;
      rerender();
    }
  });

  // 弹窗避开顶栏
  const syncHudHeight = () => document.documentElement.style.setProperty("--hud-h", $(".hud").offsetHeight + "px");
  window.addEventListener("resize", syncHudHeight);

  if (isChef()) newCustomer();
  $("#chef-figure").innerHTML = `<g class="chef-act"><g transform="translate(628 450)">${chefSVG()}</g></g>`;
  applyLang();
  syncHudHeight();
  // 进店：春田鞠躬招呼，已经坐下的客人招手
  setTimeout(() => {
    chefSay("いらっしゃい！");
    chefAct("act-bow", 1000);
    if (state.seat) guestAct("act-wave", 1000);
  }, 500);
  setTimeout(maybeBirthday, 1800);
  renderAtmosphere();
  if (festival) setTimeout(() => toast(t("fest.toast", { name: festText(festival, "name") }), true), 1200);
  if (rainy) setTimeout(() => toast(t("rain.toast")), festival ? 2000 : 1200);

  $("#hud-photo").addEventListener("click", takePhoto);

  // 离线可用（T-59）：只在 http(s) 下注册，file:// 打开时浏览器不支持
  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => { /* 注册失败时照常在线使用 */ }));
  }
})();
