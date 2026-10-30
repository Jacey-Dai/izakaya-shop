(() => {
  "use strict";

  const D = window.SHOP_DATA;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const yen = (n) => (n === 0 ? "免费" : "¥" + n.toLocaleString("ja-JP"));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  // ---------- 本地存档（失败时静默，页面照常运行） ----------
  const store = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem("koharu." + key);
        return v === null ? fallback : JSON.parse(v);
      } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem("koharu." + key, JSON.stringify(value)); } catch { /* ignore */ }
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

  // ---------- 状态 ----------
  const state = {
    cart: [],
    plate: [],
    seat: store.get("seat", null),
    collected: new Set(store.get("zukan", [])),
    fresh: new Set(store.get("fresh", [])),
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
    $("#hud-seat").textContent = "座位：" + (seat ? seat.name : "未选");
    $("#hud-zukan").textContent = `图鉴 ${state.collected.size}/${D.fish.length}`;

    const marker = $("#you-marker");
    if (seat) {
      marker.setAttribute("transform", `translate(${seat.marker[0]} ${seat.marker[1]})`);
      marker.style.display = "";
    } else {
      marker.style.display = "none";
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
    toast(`已加入：${line.name}`);
  }

  function addMenuItem(id) {
    const it = itemById[id];
    if (!it) return;
    addToCart({ key: it.id, name: it.name, price: it.price, fish: it.fish || [] });
  }

  // ---------- 弹窗 ----------
  const overlay = $("#overlay");
  const modal = $("#modal");
  const body = $("#modal-body");
  let current = null;

  function open(id, ...args) {
    const view = views[id];
    if (!view) return;
    current = id;
    modal.className = "modal " + (view.cls || id);
    body.innerHTML = view.render(...args);
    overlay.hidden = false;
    view.mount && view.mount(...args);
    modal.scrollTop = 0;
  }
  function close() { overlay.hidden = true; current = null; }
  function rerender(...args) { if (current) open(current, ...args); }

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
      <p>欢迎光临！这是一家只有吧台和一间小座敷的寿司小店。把鼠标移到店里的东西上看看吧：</p>
      <ul>
        <li><b>门口立牌</b>：今日鲜货，每天都不一样</li>
        <li><b>墙上木札</b> / <b>酒架</b> / <b>桌面菜单</b>：三种不同的菜单</li>
        <li><b>鱼柜</b>：自己挑鱼，拼一盘专属刺身</li>
        <li><b>春田师傅</b>：聊天，或者让他来一份おまかせ</li>
        <li><b>挂轴</b>：鱼图鉴。吃过的鱼会被收录，有些鱼只有师傅推荐才遇得到</li>
        <li><b>招财猫</b>：抽签，好运会影响师傅推荐</li>
      </ul>
      <p>先选个座位，再点菜结账，吃到的鱼就会出现在图鉴里。</p>
      <div class="btn-row">
        <button class="btn primary" data-open="seats">去选座位</button>
        <button class="btn" data-open="tablemenu">直接看菜单</button>
      </div>`,
  };

  // 门口立牌：黑板 + 竖排
  views.board = {
    render: () => `
      <h2>本日のおすすめ</h2>
      <p class="sub">今日鲜货 · 点一下即可加入订单</p>
      <div class="chalk-cols">
        ${todaysFresh.map((f) => `
          <button class="chalk-col" data-add="s-${f.id}">${f.kanji}<small>${yen(f.price)}</small></button>`).join("")}
        <button class="chalk-col special" data-open="chef">おまかせ<small>时价</small></button>
      </div>
      <p class="board-note">— 今日も元気に営業中 —</p>`,
  };

  // 墙上木札：一品料理 + 甜品
  views.tags = {
    render: () => {
      const hot = D.menu.find((c) => c.id === "hot").items;
      const sweet = D.menu.find((c) => c.id === "sweet").items;
      const tag = (it, cls = "") => `<button class="wood-tag ${cls}" data-add="${it.id}" title="${it.name}${it.desc ? " · " + it.desc : ""}">${it.jp}<small>${yen(it.price)}</small></button>`;
      return `
        <h2>お品書き</h2>
        <p class="sub">墙上的木札 · 一品料理与甜品，点木札加入订单</p>
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
        <p class="sub">酒架上的饮品</p>
        <div class="drink-grid">
          ${items.map((it) => `
            <div class="drink">
              <div class="bottle" style="--c:${it.bottle}"></div>
              <b>${it.jp}</b>
              <span>${it.name} · ${it.desc}</span>
              <div class="price">${yen(it.price)}</div>
              <div class="btn-row" style="justify-content:center;margin-top:8px">
                <button class="btn" data-add="${it.id}">来一杯</button>
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
        <p class="sub">桌上的菜单册 · 带 <span class="got" style="margin:0">已收录</span> 的鱼已在图鉴中</p>
        <div class="tabs">
          ${D.menu.map((c) => `<button class="tab ${c.id === state.menuTab ? "active" : ""}" data-tab="${c.id}">${c.name}<small>${c.jp}</small></button>`).join("")}
        </div>
        <ul class="menu-list">
          ${cat.items.map((it) => {
            const f = it.fish && fishById[it.fish[0]];
            const got = it.fish && it.fish.every((id) => state.collected.has(id));
            return `
              <li class="menu-item">
                <div class="dish">${f ? swatchHTML(f) : ""}</div>
                <div class="name"><b>${it.name}${got ? '<span class="got">已收录</span>' : ""}</b><span>${it.jp}${it.desc ? " · " + it.desc : ""}</span></div>
                <span class="price">${yen(it.price)}</span>
                <button class="btn add" data-add="${it.id}">点</button>
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
      let line = pick(D.chef.greetings);
      if (atCounter && Math.random() < 0.6) line = pick(D.chef.counterExtra);
      let extra = "";

      if (mode === "fresh") {
        line = `今天的好货是：${todaysFresh.map((f) => f.name).join("、")}。门口立牌上也写着呢。`;
      }
      if (mode === "omakase") {
        const om = state.omakase;
        const legendary = om.fish.some((f) => f.rarity === 4);
        line = D.chef.omakaseIntro + (legendary ? D.chef.legendary : "");
        extra = `
          <div class="omakase-preview">
            <div class="plate">${plateInnerHTML(om.fish.map((f) => f.id))}</div>
            <p class="plate-summary">${om.fish.map((f) => `${f.name}（${D.rarity[f.rarity].label}）`).join(" · ")}<br><span class="price">${yen(om.price)}</span></p>
            <div class="btn-row" style="justify-content:center">
              <button class="btn primary" id="om-take">就要这盘</button>
              <button class="btn" id="om-reroll">换一换</button>
            </div>
          </div>`;
      }

      return `
        <div class="chef-wrap">
          ${chefPortrait}
          <div>
            <h2>${D.shop.chef}</h2>
            <p class="sub">${D.shop.chefJp} · 板前 ${atCounter ? "· 你正坐在他面前" : ""}</p>
            <div class="bubble">${line}</div>
            <div class="btn-row">
              <button class="btn primary" id="chef-omakase">おまかせ（交给师傅）</button>
              <button class="btn" data-open="fishcase">我想自己挑鱼</button>
              <button class="btn" id="chef-fresh">今天有什么好鱼？</button>
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
            name: "师傅推荐拼盘",
            note: om.fish.map((f) => f.name).join(" · "),
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
    if (!fishIds.length) return center + `<div class="plate-empty">从左边挑鱼放到盘子里</div>`;
    const n = fishIds.length;
    return center + fishIds.map((id, i) => {
      const f = fishById[id];
      const angle = (360 / n) * i;
      return `<div class="portion" ${removable ? `data-remove="${i}" title="拿掉 ${f.name}"` : ""} style="transform: rotate(${angle}deg)">
        <div class="portion-inner">${sliceHTML(f).repeat(3)}</div></div>`;
    }).join("");
  }

  views.fishcase = {
    cls: "book",
    render: () => {
      const total = state.plate.reduce((s, id) => s + fishById[id].price, 0);
      return `
        <h2>ネタケース</h2>
        <p class="sub">自选鱼生 · 每点一次放一份（三切），最多 ${MAX_PORTIONS} 份；点盘子里的鱼可以拿掉</p>
        <div class="builder">
          <div class="case-grid">
            ${menuFish.map((f) => `
              <button class="fish-btn" data-fish="${f.id}">
                ${swatchHTML(f, 2)}
                <b>${f.name}</b>
                <span>${f.jp}</span>
                <span class="price">${yen(f.price)}</span>
              </button>`).join("")}
          </div>
          <div class="plate-area">
            <div class="plate" id="plate">${plateInnerHTML(state.plate, true)}</div>
            <p class="plate-summary">${state.plate.length ? `${state.plate.length} / ${MAX_PORTIONS} 份 · <span class="price">${yen(total)}</span>` : "盘子还是空的"}</p>
            <div class="btn-row" style="justify-content:center">
              <button class="btn primary" id="plate-order" ${state.plate.length ? "" : "disabled"}>放入订单</button>
              <button class="btn" id="plate-clear" ${state.plate.length ? "" : "disabled"}>清空</button>
            </div>
          </div>
        </div>`;
    },
    mount: () => {
      $$(".fish-btn", body).forEach((b) => b.addEventListener("click", () => {
        if (state.plate.length >= MAX_PORTIONS) { toast("盘子装满啦"); return; }
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
          name: "自选刺身拼盘",
          note: Object.entries(counts).map(([id, n]) => fishById[id].name + (n > 1 ? "×" + n : "")).join(" · "),
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
      <p class="sub">选一个座位吧</p>
      <div class="seat-grid">
        ${D.seats.map((s) => `
          <button class="seat-card ${state.seat === s.id ? "active" : ""}" data-seat="${s.id}">
            <b>${s.name}</b><small>${s.jp}</small>
            <p>${s.desc}</p>
          </button>`).join("")}
      </div>`,
    mount: (then) => {
      $$(".seat-card", body).forEach((c) => c.addEventListener("click", () => {
        state.seat = c.dataset.seat;
        store.set("seat", state.seat);
        updateHud();
        const s = D.seats.find((x) => x.id === state.seat);
        toast(`已入座：${s.name}`);
        if (then) open(then); else close();
      }));
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
          <p class="sub">你的订单</p>
          <p class="empty">还没有点菜哦。</p>
          <div class="btn-row" style="justify-content:center">
            <button class="btn" data-open="tablemenu">看菜单</button>
            <button class="btn" data-open="fishcase">自选鱼生</button>
            <button class="btn" data-open="chef">交给师傅</button>
          </div>`;
      }
      return `
        <h2>ご注文</h2>
        <p class="sub">座位：${seat ? seat.name : "还没选"}</p>
        <ul class="cart-list">
          ${state.cart.map((l, i) => `
            <li class="cart-line">
              <div><b>${l.name}</b>${l.note ? `<small>${l.note}</small>` : ""}</div>
              <div class="qty"><button data-dec="${i}" aria-label="减少">−</button><span>${l.qty}</span><button data-inc="${i}" aria-label="增加">+</button></div>
              <span class="price">${yen(l.price * l.qty)}</span>
            </li>`).join("")}
        </ul>
        <div class="cart-total"><span>合计</span><span class="price">${yen(total)}</span></div>
        <div class="btn-row" style="justify-content:flex-end">
          <button class="btn" data-open="tablemenu">再点一些</button>
          <button class="btn primary" id="cart-submit">下单</button>
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
      toast("先选个座位吧");
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
    fresh.forEach((id, i) => setTimeout(() => toast(`图鉴新收录：${fishById[id].name}`, true), 400 + i * 500));
  }

  views.receipt = {
    cls: "book",
    render: (lines, fresh) => {
      const total = lines.reduce((s, l) => s + l.price * l.qty, 0);
      return `
        <div class="receipt">
          <div class="stamp">注文承り</div>
          <h2>${pick(D.chef.afterOrder)}</h2>
          <p class="sub">${lines.length} 样菜 · 合计 <span class="price">${yen(total)}</span></p>
          ${fresh.length ? `
            <p>这次吃到了 <b>${fresh.length}</b> 种新的鱼，已收录进图鉴！</p>
            <div class="unlock-row">${fresh.map((id) => cardHTML(fishById[id], true)).join("")}</div>`
          : `<p>这次的鱼都已经在图鉴里了。试试师傅推荐，说不定能遇到稀有的鱼。</p>`}
          <div class="btn-row" style="justify-content:center">
            <button class="btn primary" data-open="zukan">打开图鉴</button>
            <button class="btn" data-open="chef">再请师傅推荐</button>
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
          <span>${f.omakaseOnly ? "只在师傅推荐中出现" : "还没吃过"}</span>
        </div>`;
    }
    return `
      <button class="card ${isNew ? "new" : ""}" data-fish="${f.id}" style="--rc:${r.color}">
        <span class="no">No.${no}</span><span class="rar">${r.label}</span>
        ${swatchHTML(f, 2)}
        <b>${f.name}</b>
        <span>${f.jp}</span>
      </button>`;
  }

  views.zukan = {
    cls: "book",
    render: () => {
      const n = state.collected.size;
      const total = D.fish.length;
      const filters = [["all", "全部"], ...Object.entries(D.rarity).map(([k, v]) => [k, `${v.label} · ${v.zh}`])];
      const list = D.fish.filter((f) => state.zukanFilter === "all" || String(f.rarity) === state.zukanFilter);
      return `
        <h2>魚図鑑</h2>
        <p class="sub">吃过的鱼会被收录。点开卡片查看日语、英语名称和口感。</p>
        <div class="zukan-head">
          <div class="progress">
            <div class="progress-bar"><i style="width:${(n / total) * 100}%"></i></div>
            <small>已收集 ${n} / ${total}${n === total ? " · 全部集齐！春田师傅向你鞠了一躬。" : ""}</small>
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
            <h3>${f.name}</h3>
            <p class="names">${f.jp} · ${f.kanji} · <i>${f.romaji}</i><br>${f.en}</p>
            <dl class="facts">
              <dt>稀有度</dt><dd style="color:${r.color};font-weight:600">${r.label}（${r.zh}）</dd>
              <dt>口感</dt><dd>${f.texture}</dd>
              <dt>风味</dt><dd>${f.flavor}</dd>
              <dt>旬</dt><dd>${f.season}</dd>
              <dt>价格</dt><dd class="price">${yen(f.price)} / 三切</dd>
            </dl>
            <p>${f.desc}</p>
            <div class="btn-row">
              <button class="btn" data-open="zukan">← 返回图鉴</button>
              ${f.omakaseOnly ? "" : `<button class="btn primary" data-add="s-${f.id}">再来一份</button>`}
            </div>
          </div>
        </div>`;
    },
  };

  // 招财猫抽签
  views.neko = {
    cls: "book",
    render: () => {
      const o = pick(D.omikuji);
      state.luck = Math.max(state.luck, o.luck);
      return `
        <div class="omikuji">
          <h2>おみくじ</h2>
          <p class="sub">招财猫轻轻招了招手……</p>
          <div class="slip">${o.result}</div>
          <p>${o.text}</p>
          <div class="btn-row" style="justify-content:center">
            <button class="btn primary" data-open="chef">去找师傅</button>
          </div>
        </div>`;
    },
  };

  // ---------- 场景热点 ----------
  const tip = $("#tooltip");
  $$(".hotspot").forEach((el) => {
    const id = el.dataset.id;
    const info = D.hotspots[id];
    const siblings = $$(`.hotspot[data-id="${id}"]`);
    el.setAttribute("tabindex", "0");
    el.setAttribute("role", "button");
    el.setAttribute("aria-label", info.title);

    el.addEventListener("mouseenter", () => {
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

  updateHud();
})();
