(() => {
  "use strict";

  const D = window.SHOP_DATA;
  const EN = window.SHOP_DATA_EN || {};
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
  const sliceHTML = (f) => `<i class="slice ${f.shape === "slice" ? "" : f.shape}" style="--c:${f.color};--c2:${f.color2}"></i>`;
  const swatchHTML = (f, n = 1) => `<div class="swatch">${sliceHTML(f).repeat(n)}</div>`;
  const rarityColor = (r) => D.rarity[r].color;

  // 客人背影，原点在座位面中心，向上画
  function guestSVG(g) {
    const opt = (k) => D.guest[k].find((o) => o.id === g[k]) || D.guest[k][0];
    const hair = opt("hairColor").color;
    const cloth = opt("outfit").color;
    const style = g.hairStyle;
    const acc = g.accessory;
    const back = {
      short: "",
      bun: `<circle cx="0" cy="-138" r="11" fill="${hair}"/>`,
      ponytail: `<ellipse cx="0" cy="-80" rx="8" ry="20" fill="${hair}"/><rect x="-5" y="-98" width="10" height="5" rx="2" fill="#c0392b"/>`,
      long: `<path d="M-23 -112 Q-26 -70 -20 -56 L20 -56 Q26 -70 23 -112 Z" fill="${hair}"/>`,
    }[style] || "";
    const extra = {
      none: "",
      kanzashi: `<line x1="6" y1="${style === "bun" ? -140 : -126}" x2="24" y2="${style === "bun" ? -150 : -138}" stroke="#d9a520" stroke-width="3" stroke-linecap="round"/><circle cx="25" cy="${style === "bun" ? -151 : -139}" r="4" fill="#c0392b"/>`,
      hat: `<ellipse cx="0" cy="-122" rx="30" ry="7" fill="#d9c08a" stroke="#a08850"/><path d="M-17 -123 Q-16 -142 0 -142 Q16 -142 17 -123 Z" fill="#d9c08a" stroke="#a08850"/><rect x="-17" y="-128" width="34" height="5" fill="#c0392b"/>`,
    }[acc] || "";
    return `
      <ellipse cx="0" cy="2" rx="30" ry="6" fill="rgba(0,0,0,.18)"/>
      <path d="M-30 0 Q-34 -50 -22 -78 Q0 -90 22 -78 Q34 -50 30 0 Z" fill="${cloth}"/>
      <path d="M-12 -84 L0 -70 L12 -84" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="3"/>
      <rect x="-31" y="-34" width="62" height="10" fill="rgba(0,0,0,.25)"/>
      <rect x="-6" y="-94" width="12" height="12" fill="#f1c7a0"/>
      <circle cx="-22" cy="-108" r="5" fill="#f1c7a0"/>
      <circle cx="22" cy="-108" r="5" fill="#f1c7a0"/>
      ${style === "long" ? back : ""}
      <circle cx="0" cy="-112" r="23" fill="${hair}"/>
      ${style === "long" ? "" : back}
      ${extra}`;
  }

  function toast(msg, gold = false) {
    const el = document.createElement("div");
    el.className = "toast" + (gold ? " gold" : "");
    el.textContent = msg;
    $("#toasts").appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }

  function updateHud() {
    const count = state.cart.reduce((s, l) => s + l.qty, 0);
    const cartBtn = $("#hud-cart");
    cartBtn.querySelector("b").textContent = count;
    const seat = D.seats.find((s) => s.id === state.seat);
    $("#hud-seat").textContent = t("hud.seat", { name: seat ? seatName(seat) : t("hud.seatNone") });
    $("#hud-zukan").textContent = t("hud.zukan", { n: state.collected.size, total: D.fish.length });

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
                <div class="dish">${f ? swatchHTML(f) : ""}</div>
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
  const chefPortrait = `
    <svg viewBox="560 200 160 160" class="chef-portrait" aria-hidden="true">
      <rect x="560" y="200" width="160" height="160" fill="#e9dcc0"/>
      <path d="M582 380 Q586 302 640 292 Q694 302 698 380 Z" fill="#fbfbf8" stroke="#c9c4b8" stroke-width="2"/>
      <rect x="630" y="270" width="20" height="26" fill="#f1c7a0"/>
      <circle cx="640" cy="248" r="30" fill="#f1c7a0"/>
      <path d="M610 248 Q610 214 640 214 Q670 214 670 248 Q656 234 640 234 Q624 234 610 248Z" fill="#2b2b2b"/>
      <rect x="609" y="228" width="62" height="10" rx="3" fill="#2c3e60"/>
      <path d="M625 252 q5 -5 10 0 M645 252 q5 -5 10 0" stroke="#2b2b2b" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <circle cx="622" cy="262" r="5" fill="#f3a6a0" opacity=".7"/><circle cx="658" cy="262" r="5" fill="#f3a6a0" opacity=".7"/>
      <path d="M633 265 q7 6 14 0" stroke="#7a3b2e" stroke-width="2.5" fill="none" stroke-linecap="round"/>
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
          ${chefPortrait}
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
        <div class="portion-inner">${sliceHTML(f).repeat(3)}</div></div>`;
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
        state.seat = c.dataset.seat;
        store.set("seat", state.seat);
        updateHud();
        const s = D.seats.find((x) => x.id === state.seat);
        toast(t("toast.seated", { name: seatName(s) }));
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
        <svg class="guest-preview" viewBox="-60 -165 120 175" aria-hidden="true">
          <rect x="-60" y="-165" width="120" height="175" fill="#e9dcc0"/>
          <ellipse cx="0" cy="4" rx="36" ry="9" fill="#9e2b25"/>
          ${guestSVG(state.guest)}
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
        <p class="sub">${t("cart.seat", { name: seat ? seatName(seat) : t("cart.seatNone") })}</p>
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
      const submit = $("#cart-submit", body);
      if (submit) submit.addEventListener("click", submitOrder);
    },
  };

  function submitOrder() {
    if (!state.seat) {
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
    updateHud();
    open("receipt", lines, fresh);
    fresh.forEach((id, i) => setTimeout(() => toast(t("toast.newEntry", { name: fishName(fishById[id]) }), true), 400 + i * 500));
  }

  views.receipt = {
    cls: "book",
    render: (lines, fresh) => {
      const total = lines.reduce((s, l) => s + l.price * l.qty, 0);
      return `
        <div class="receipt">
          <div class="stamp">注文承り</div>
          <h2>${pick(chefLine("afterOrder"))}</h2>
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
          ${swatchHTML(f, 2)}
          <b>？？？</b>
          <span>${f.omakaseOnly ? t("card.omakaseOnly") : t("card.notYet")}</span>
        </div>`;
    }
    return `
      <button class="card ${isNew ? "new" : ""}" data-fish="${f.id}" style="--rc:${r.color}">
        <span class="no">No.${no}</span><span class="rar">${r.label}</span>
        ${swatchHTML(f, 2)}
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
          <div class="detail-visual" style="--rc:${r.color}">${swatchHTML(f, 3)}</div>
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
    el.addEventListener("click", () => { tip.hidden = true; open(id); });
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(id); }
    });
  });

  function hotspotInfo(id) {
    const zh = D.hotspots[id];
    return { title: tx("hotspots", id, "title", zh.title), hint: tx("hotspots", id, "hint", zh.hint) };
  }

  // 切换语言：更新静态文案、热点无障碍标签、顶栏，并重绘当前弹窗
  function applyLang() {
    document.documentElement.lang = isEn() ? "en" : "zh-CN";
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

  applyLang();
  syncHudHeight();
})();
