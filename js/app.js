(() => {
  "use strict";

  const D = window.SHOP_DATA;
  const EN = window.SHOP_DATA_EN || {};
  const ART = window.KOBUNE_ART;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const yen = (n) => (n === 0 ? t("free") : "¥" + n.toLocaleString("ja-JP"));
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
  D.menu.forEach((cat) => cat.items.forEach((it) => { itemById[it.id] = it; }));

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
    menuTab: "sashimi",
    zukanFilter: "all",
  };

  // 今日鲜货：按日期固定随机，同一天每次打开都一样
  const todaysFresh = (() => {
    const d = new Date();
    let seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
    const rand = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    const pool = [...menuFish];
    const out = [];
    while (out.length < 4 && pool.length) out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
    return out;
  })();

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
    const brimY = -height - hat.lift + hat.height * .73;
    let extra = "";
    if (accessory === "hat") extra = `<svg class="guest-accessory guest-hat" data-fit="${style}" x="${hat.cx - hat.width / 2}" y="${-height - hat.lift}" width="${hat.width}" height="${hat.height}" viewBox="43 153 881 614" overflow="hidden"><image href="assets/art/guest-accessories.webp" width="1774" height="887"/></svg>`;
    if (accessory === "kanzashi") extra = `<svg class="guest-accessory" x="16" y="${-height + 30}" width="58" height="48" viewBox="1020 178 713 584" overflow="hidden"><image href="assets/art/guest-accessories.webp" width="1774" height="887"/></svg>`;
    return `<g class="guest-doll" data-hair="${style}" data-clothing="${wear}" data-outfit="${opt("outfit").id}" data-hair-color="${opt("hairColor").id}" data-accessory="${accessory}">
      <ellipse cx="0" cy="-2" rx="${wear === "kimono" ? 76 : 58}" ry="7" fill="#36281d" opacity=".22"/>
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
        </defs>
        <use href="#${id}-sprite"/>
        <g mask="url(#${id}-neutral-mask)">
          <g mask="url(#${id}-cloth-mask)"><use href="#${id}-sprite" filter="url(#${id}-cloth)"/></g>
          <g mask="url(#${id}-hair-mask)"><use href="#${id}-sprite" filter="url(#${id}-hair)"/></g>
        </g>
      </svg>
      </g>
      ${extra}
      <path class="guest-hit" d="M0 ${-height - 5} C-86 ${-height - 5} -86 ${-height + 115} 0 ${-height + 115} C86 ${-height + 115} 86 ${-height - 5} 0 ${-height - 5} Z M-42 -115 Q-78 -95 -${wear === "kimono" ? 90 : 73} -30 Q-85 10 0 2 Q85 10 ${wear === "kimono" ? 90 : 73} -30 Q78 -95 42 -115 Z" fill="transparent" stroke="transparent"/>
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

  // 上菜（T-05）：吧台从师傅手边、座敷从门口把盘子送到客人旁边，坐标与 viewBox 一致。
  const DISH_SPOTS = {
    counter: { from: [640, 380], to: [735, 515], width: 170 },
    tatami: { from: [190, 430], to: [750, 562], width: 150 },
  };
  const reduceMotion = () => !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);

  // 盘子放进当前房间、排在热点之前：画在背景上，重叠处仍由原热点接收点击。
  // 换房间时按新房间的落点和大小重画。
  let dishArt = null;
  function placeDish(room) {
    const dish = $("#scene-dish");
    const { to: [x, y], width } = DISH_SPOTS[room];
    $(`.room-layer[data-room="${room}"] .hotspot`).before(dish);
    dish.setAttribute("transform", `translate(${x} ${y})`);
    if (!dishArt) return;
    const [, w, h] = dishArt.match(/width="(\d+)" height="(\d+)"/).map(Number);
    const k = width / w;
    dish.innerHTML = `<g class="dish-move"><rect class="hit-area" fill="transparent" stroke="transparent" rx="8" x="${-width / 2}" y="${-h * k}" width="${width}" height="${h * k}"/><g transform="translate(${-width / 2} ${-h * k}) scale(${k})">${dishArt}</g></g>`;
  }

  // 盘子留在座位上直到下一单或刷新；没有鱼的订单（只点饮料等）不端盘子。
  function serveDish(lines, mode, done) {
    const fishList = [...new Set(lines.flatMap((l) => l.fish || []))].map((id) => fishById[id]);
    const dish = $("#scene-dish");
    dishArt = !fishList.length ? null : mode === "takeout" ? ART.takeoutBox(fishList) : ART.geta(fishList);
    if (!dishArt) { dish.style.display = "none"; done(); return; }
    const room = $(".scene").dataset.room;
    placeDish(room);
    dish.style.display = "";
    const move = dish.firstChild;
    if (reduceMotion() || !move.animate) { done(); return; }
    const [fx, fy] = DISH_SPOTS[room].from;
    const [toX, toY] = DISH_SPOTS[room].to;
    const dx = fx - toX, dy = fy - toY;
    move.animate([
      { transform: `translate(${dx}px, ${dy}px) scale(.7)`, opacity: 0 },
      { transform: `translate(${dx}px, ${dy}px) scale(.85)`, opacity: 1, offset: 0.2 },
      { transform: `translate(${dx * 0.35}px, ${dy * 0.35 - 30}px) scale(.95)`, offset: 0.65 },
      { transform: "none", opacity: 1 },
    ], { duration: 1300, easing: "ease-in-out" }).onfinish = done;
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
    toast(t("toast.seated", { name: seatName(seat) }));
  }

  $("#back-counter").addEventListener("click", () => {
    chooseSeat("counter");
    // 回程按钮隐藏后将焦点交给一直可用的座位按钮。
    $("#hud-seat").focus();
  });

  function updateHud() {
    const count = state.cart.reduce((s, l) => s + l.qty, 0);
    const cartBtn = $("#hud-cart");
    cartBtn.querySelector("b").textContent = count;
    const seat = D.seats.find((s) => s.id === state.seat);
    $("#hud-seat").textContent = t("hud.seat", { name: seat ? seatName(seat) : t("hud.seatNone") });
    $("#hud-zukan").textContent = t("hud.zukan", { n: state.collected.size, total: D.fish.length });

    updateRoom(seat);
    const guest = $("#guest");
    if (seat) {
      guest.setAttribute("transform", `translate(${seat.marker[0]} ${seat.marker[1]})`);
      guest.innerHTML = guestSVG(state.guest);
      guest.style.display = "";
    } else {
      guest.style.display = "none";
    }
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
    return t(l.kind === "omakase" ? "chef.omakaseName" : "case.plateName");
  }
  function lineNote(l) {
    if (!l.counts) return "";
    return Object.entries(l.counts).map(([id, n]) => fishName(fishById[id]) + (n > 1 ? "×" + n : "")).join(" · ");
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
  function close() { overlay.hidden = true; current = null; }
  function rerender(...args) { if (current) open(current, ...(args.length ? args : currentArgs)); }

  $("#modal-close").addEventListener("click", close);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !overlay.hidden) close(); });

  // 弹窗内的通用按钮：data-add / data-open
  body.addEventListener("click", (e) => {
    const add = e.target.closest("[data-add]");
    if (add) { addMenuItem(add.dataset.add); return; }
    const go = e.target.closest("[data-open]");
    if (go) open(go.dataset.open);
  });
  $$(".hud [data-open]").forEach((b) => b.addEventListener("click", () => open(b.dataset.open)));

  // ---------- 各个视图 ----------
  const views = {};

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
      </div>`,
  };

  // 门口立牌：黑板 + 竖排
  views.board = {
    render: () => `
      <h2>本日のおすすめ</h2>
      <p class="sub">${t("board.sub")}</p>
      <div class="chalk-cols">
        ${todaysFresh.map((f) => `
          <button class="chalk-col" data-add="s-${f.id}" title="${fishName(f)}">${f.kanji}<small>${yen(f.price)}</small></button>`).join("")}
        <button class="chalk-col special" data-open="chef">おまかせ<small>${t("board.market")}</small></button>
      </div>
      <p class="board-note">— 今日も元気に営業中 —</p>`,
  };

  // 墙上木札：一品料理 + 甜品
  views.tags = {
    render: () => {
      const hot = D.menu.find((c) => c.id === "hot").items;
      const sweet = D.menu.find((c) => c.id === "sweet").items;
      const tag = (it, cls = "") => `<button class="wood-tag ${cls}" data-add="${it.id}" title="${itemName(it)}${itemDesc(it) ? " · " + itemDesc(it) : ""}">${it.jp}<small>${yen(it.price)}</small></button>`;
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
              <div class="price">${yen(it.price)}</div>
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
        <ul class="menu-list">
          ${cat.items.map((it) => {
            const f = it.fish && fishById[it.fish[0]];
            const got = it.fish && it.fish.every((id) => state.collected.has(id));
            return `
              <li class="menu-item">
                <div class="dish">${itemArt(it)}</div>
                <div class="name"><b>${itemName(it)}${got ? `<span class="got">${t("menu.got")}</span>` : ""}</b><span>${it.jp}${itemDesc(it) ? " · " + itemDesc(it) : ""}</span></div>
                <span class="price">${yen(it.price)}</span>
                <button class="btn add" data-add="${it.id}">${t("menu.order")}</button>
              </li>`;
          }).join("")}
        </ul>`;
    },
    mount: () => {
      $$(".tab", body).forEach((t) => t.addEventListener("click", () => {
        state.menuTab = t.dataset.tab;
        rerender();
      }));
    },
  };

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
    const price = Math.round(chosen.reduce((s, f) => s + f.price, 0) * 0.9 / 10) * 10;
    return { fish: chosen, price };
  }

  views.chef = {
    render: (mode = "hello") => {
      const atCounter = state.seat === "counter";
      const greetings = chefLine("greetings");
      let line = greetings[pickIndex(greetings)];
      if (atCounter && Math.random() < 0.6) line = pick(chefLine("counterExtra"));
      let extra = "";

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
            <p class="plate-summary">${om.fish.map((f) => `${fishName(f)} (${D.rarity[f.rarity].label})`).join(" · ")}<br><span class="price">${yen(om.price)}</span></p>
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
                <span class="price">${yen(f.price)}</span>
              </button>`).join("")}
          </div>
          <div class="plate-area">
            <div class="plate" id="plate">${plateInnerHTML(state.plate, true)}</div>
            <p class="plate-summary">${state.plate.length ? `${t("case.count", { n: state.plate.length, max: MAX_PORTIONS })} · <span class="price">${yen(total)}</span>` : t("case.empty")}</p>
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
      <div class="btn-row">
        <button class="btn primary" data-open="seats">${state.seat ? t("guest.changeSeat") : t("btn.goSeats")}</button>
        <button class="btn" id="guest-random">${t("guest.random")}</button>
      </div>`,
    mount: () => {
      const save = () => { store.set("guest", state.guest); updateHud(); rerender(); };
      $$(".opt", body).forEach((b) => b.addEventListener("click", () => {
        state.guest[b.dataset.k] = b.dataset.v; save();
      }));
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
              <span class="price">${yen(l.price * l.qty)}</span>
            </li>`).join("")}
        </ul>
        <div class="cart-total"><span>${t("cart.total")}</span><span class="price">${yen(total)}</span></div>
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
    const mode = state.orderMode;
    if (mode === "dine" && !state.seat) {
      toast(t("toast.pickSeat"));
      open("seats", "cart");
      return;
    }
    const lines = state.cart;
    const eaten = [...new Set(lines.flatMap((l) => l.fish || []))];
    const fresh = eaten.filter((id) => !state.collected.has(id));
    fresh.forEach((id) => { state.collected.add(id); state.fresh.add(id); });
    store.set("zukan", [...state.collected]);
    store.set("fresh", [...state.fresh]);
    state.cart = [];
    state.lastOrder = [lines, fresh, mode];
    updateHud();
    // 先关掉订单，让客人看到上菜，再弹小票
    close();
    serveDish(lines, mode, () => {
      open("receipt", lines, fresh, mode);
      fresh.forEach((id, i) => setTimeout(() => toast(t("toast.newEntry", { name: fishName(fishById[id]) }), true), 400 + i * 500));
    });
  }

  // 座位上的盘子：点开重看这一单的小票
  views.dish = {
    cls: "book",
    render: () => views.receipt.render(...state.lastOrder),
  };

  views.receipt = {
    cls: "book",
    render: (lines, fresh, mode = "dine") => {
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
          <p class="sub">${t("receipt.summary", { n: lines.length })} <span class="price">${yen(total)}</span></p>
          ${fresh.length ? `
            <p>${t("receipt.new", { n: fresh.length })}</p>
            <div class="unlock-row">${fresh.map((id) => cardHTML(fishById[id], true)).join("")}</div>`
          : `<p>${t("receipt.none")}</p>`}
          <div class="btn-row" style="justify-content:center">
            <button class="btn primary" data-open="zukan">${t("receipt.zukan")}</button>
            <button class="btn" data-open="chef">${t("receipt.again")}</button>
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
              <dt>${t("fish.price")}</dt><dd class="price">${yen(f.price)} / ${t("fish.perPortion")}</dd>
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
    el.addEventListener("click", () => { tip.hidden = true; open(id); });
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); tip.hidden = true; open(id); }
    });
  });

  function hotspotInfo(id) {
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

  $("#chef-figure").innerHTML = `<g transform="translate(628 450)">${chefSVG()}</g>`;
  applyLang();
  syncHudHeight();
})();
