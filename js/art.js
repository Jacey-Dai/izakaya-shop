/*
 * 小舟 · 寿司与刺身插画
 * 画风：微缩手作。柔和立体明暗、米粒纹理和陶器般高光，与店内人偶一致。
 * 原创程序绘制，按鱼种颜色生成渐变，保留所有鱼种和摆盘 API。
 */
window.KOBUNE_ART = (() => {
  // 统一的画风参数；厨师和客人（app.js）也用同一个描边色
  const T = { ol: "#805b48", w: 1.1, rice: "#fffaf0", riceOl: "#a8968a", grain: "#e0d5c6", mute: 0.08, filter: true };

  const OL = () => `stroke="${T.ol}" stroke-width="${T.w}" stroke-linejoin="round" stroke-linecap="round"`;
  const RICE_OL = () => `stroke="${T.riceOl}" stroke-width="${T.w}" stroke-linejoin="round"`;
  const HI = 'stroke="#fff" stroke-width="1.5" stroke-linecap="round" fill="none" opacity=".65"';
  const NORI = "#1f2a22";

  // 颜色轻轻往暖色方向拉一点，显得更温馨
  function col(hex) {
    if (!T.mute) return hex;
    const n = parseInt(hex.slice(1), 16);
    const mix = (v, m) => Math.round(v * (1 - T.mute) + m * T.mute);
    const r = mix(n >> 16, 0xb8), g = mix((n >> 8) & 255, 0xa6), b = mix(n & 255, 0x8a);
    return "#" + ((r << 16) | (g << 8) | b).toString(16).padStart(6, "0");
  }
  const fc = (f) => ({ ...f, color: col(f.color), color2: col(f.color2) });

  const shade = (hex, factor) => "#" + hex.slice(1).match(/../g).map((part) => {
    const channel = parseInt(part, 16);
    return Math.round(factor > 0 ? channel + (255 - channel) * factor : channel * (1 + factor)).toString(16).padStart(2, "0");
  }).join("");

  // 每张 SVG 独立 gradient id，避免多张鱼卡片互相串色。
  let illustrationId = 0;
  const svg = (w, h, body, cls = "art") => {
    const prefix = "dish-" + illustrationId++;
    const colors = [...new Set([...body.matchAll(/fill="(#[0-9a-fA-F]{6})"/g)].map((m) => m[1]))];
    const defs = colors.map((color, i) => `<linearGradient id="${prefix}-${i}" x1="0" y1="0" x2=".3" y2="1"><stop stop-color="${shade(color, .22)}"/><stop offset=".38" stop-color="${color}"/><stop offset="1" stop-color="${shade(color, -.22)}"/></linearGradient>`).join("");
    // 上侧柔和高光、下侧暖暗部，保留每条鱼自己的颜色。
    const shaded = body.replace(/fill="(#[0-9a-fA-F]{6})"/g, (_, color) => `fill="url(#${prefix}-${colors.indexOf(color)})"`);
    return `<svg class="${cls}" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><defs>${defs}</defs>${T.filter ? `<g filter="url(#kb-grain)">${shaded}</g>` : shaded}</svg>`;
  };

  // 原创透明食物图集。每格 362×362，保持现有鱼种数据与调用接口。
  const foodSprite = (slot, x, y, w, h, fish = null, base = null) => {
    const id = "food-material-" + illustrationId++;

    const rgb = (hex) => hex.slice(1).match(/../g).map((v) => parseInt(v, 16));
    const tone = fish && base ? rgb(fish.color).map((v, i) => Math.min(2.5, v / rgb(base)[i])) : null;
    const filter = tone ? `<defs><filter id="${id}" color-interpolation-filters="sRGB"><feColorMatrix values="${tone[0]} 0 0 0 0 0 ${tone[1]} 0 0 0 0 0 ${tone[2]} 0 0 0 0 0 1 0"/></filter></defs>` : "";
    return `${filter}<image class="food-sprite" preserveAspectRatio="none" data-food="${fish ? fish.id : slot}" x="${x}" y="${y}" width="${w}" height="${h}" href="assets/art/food-${slot}.webp" ${tone ? `filter="url(#${id})"` : ""}/>`;
  };
  const redFish = (f) => /maguro|toro|akami|katsuo/.test(f.id);
  function slicePiece(f) {
    if (f.shape === "round") return foodSprite(10, 0, 8, 40, 48, f, "#f6ece6");
    if (f.shape === "shrimp") return foodSprite(4, 0, 0, 40, 58);
    if (f.shape === "roe" || f.shape === "pearl") return foodSprite(f.shape === "pearl" ? 6 : 5, 0, 3, 40, 54);
    const slot = redFish(f) ? 9 : f.id === "salmon" ? 8 : 3;
    return foodSprite(slot, 0, 0, 40, 60, f, slot === 9 ? "#b3202f" : slot === 8 ? "#f28a36" : "#f6ece6");
  }

  // n 片刺身错开叠放
  function sashimi(f, n = 3) {
    const step = 15;
    const w = 40 + (n - 1) * step;
    const pieces = Array.from({ length: n }, (_, i) => {
      const angle = (i - (n - 1) / 2) * 9;
      return `<g transform="translate(${i * step} 0) rotate(${angle} 20 34)">${slicePiece(f)}</g>`;
    }).join("");
    return svg(w, 60, pieces, "art art-sashimi");
  }

  // ---------- 握寿司 / 军舰 / 细卷（80×52 / 60×60） ----------
  const rice = () => foodSprite(0, 8, 25, 64, 23);
  function topping(f) {
    if (f.shape === "shrimp") return foodSprite(4, 1, 1, 78, 39);
    const slot = f.shape === "round" || (!redFish(f) && f.id !== "salmon") ? 3 : redFish(f) ? 2 : 1;
    return foodSprite(slot, 1, 6, 78, 31, f, slot === 2 ? "#b3202f" : slot === 1 ? "#f28a36" : "#f6ece6");
  }
  const nigiriBody = (f) => f.shape === "roe" || f.shape === "pearl"
    ? foodSprite(f.shape === "pearl" ? 6 : 5, 7, 0, 66, 50)
    : rice() + topping(f);
  const nigiri = (f) => svg(80, 52, nigiriBody(f), "art art-nigiri");
  function maki(f) {
    return svg(60, 60, foodSprite(7, 0, 0, 60, 60) + `<ellipse cx="30" cy="31" rx="9" ry="10" fill="${f.color}" opacity=".3"/>`, "art art-maki");
  }

  // ---------- 木屐盘（堂食） ----------
  function geta(fishList) {
    const list = fishList.slice(0, 5);
    // 每贯外面套一层 .bite，app.js 吃掉时对外层做动画，不影响里面的定位
    const pieces = list.map((f, i) => `<g class="bite"><g transform="translate(${18 + i * 52} 6) scale(.62)">${nigiriBody(f)}</g></g>`).join("");
    const w = Math.max(200, 36 + list.length * 52);
    return svg(w, 70, `
      <rect x="8" y="48" width="14" height="16" fill="#b07a45" ${OL()}/>
      <rect x="${w - 22}" y="48" width="14" height="16" fill="#b07a45" ${OL()}/>
      <rect x="2" y="34" width="${w - 4}" height="16" rx="3" fill="#d9a466" ${OL()}/>
      <line x1="10" y1="40" x2="${w - 10}" y2="40" stroke="#c38d52" stroke-width="2"/>
      ${pieces}`, "art art-geta");
  }

  // ---------- 外带盒（打包）：黑底托盘、绿色叶片、透明盖 ----------
  function takeoutBox(fishList) {
    const slots = [];
    if (fishList.length) for (let i = 0; i < 8; i++) slots.push(fishList[i % fishList.length]);
    const pieces = slots.map((f, i) => {
      const row = Math.floor(i / 4), col = i % 4;
      return `<g transform="translate(${26 + col * 44 + row * 10} ${50 + row * 24}) scale(.5)">${nigiriBody(f)}</g>`;
    }).join("");
    return svg(240, 130, `
      <path d="M14 70 L226 70 L214 118 Q212 124 204 124 L36 124 Q28 124 26 118 Z" fill="#232323" ${OL()}/>
      <path d="M22 72 L218 72 L208 112 L32 112 Z" fill="#303030"/>
      <path d="M30 86 l8 -6 l8 6 l8 -6 l8 6 l8 -6 l8 6 l8 -6 l8 6 l8 -6 l8 6 l8 -6 l8 6 l8 -6 l8 6 l8 -6 l8 6 l8 -6 l8 6 l8 -6 l8 6 l8 -6 l8 6 L206 92 L32 94 Z" fill="#4f9a3e"/>
      ${pieces}
      <path d="M10 70 L40 14 Q42 10 48 10 L192 10 Q198 10 200 14 L230 70" fill="rgba(235,245,250,.28)" stroke="#a9b6bf" stroke-width="3" stroke-linejoin="round"/>
      <line x1="40" y1="14" x2="200" y2="14" stroke="#a9b6bf" stroke-width="2"/>
      <path d="M58 22 L44 56 M70 22 L60 44" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".55"/>
      <rect x="6" y="66" width="228" height="9" rx="4" fill="rgba(210,222,230,.7)" stroke="#9aa6ae" stroke-width="2"/>
      <rect x="150" y="96" width="62" height="20" rx="3" fill="#c0392b" transform="rotate(-8 181 106)"/>
      <text x="181" y="111" text-anchor="middle" font-size="12" fill="#fff" font-family="serif" transform="rotate(-8 181 106)">小舟</text>`, "art art-takeout");
  }

  // ---------- 生日玉子烧（T-58）：白盘三块玉子烧，中间那块插一根蜡烛 ----------
  function tamagoyaki() {
    const piece = (x, candle) => `<g class="bite"><g transform="translate(${x} 0)">
      ${foodSprite(11, -3, 27, 50, 40)}
      <path d="M4 42 Q22 38 40 42 M4 50 Q22 46 40 50" stroke="#e0a43a" stroke-width="1.6" fill="none"/>
      <path d="M6 37 q8 -2 14 0" ${HI}/>
      ${candle ? `<rect x="18" y="0" width="8" height="35" rx="2" fill="#f2a7b6" ${OL()}/>
      <path d="M18 8 l8 -4 M18 16 l8 -4 M18 24 l8 -4" stroke="#fff" stroke-width="1.6"/>
      <path class="candle-flame" d="M22 -17 Q30 -6 22 -1 Q14 -6 22 -17 Z" fill="#ffb238" stroke="#e07a1f" stroke-width="1"/>` : ""}
    </g></g>`;
    return svg(200, 98, `<g transform="translate(0 20)">
      <ellipse cx="100" cy="62" rx="96" ry="16" fill="#f7f1e6" ${OL()}/>
      <ellipse cx="100" cy="60" rx="78" ry="10" fill="#ece3d2"/>
      ${piece(30, false)}${piece(78, true)}${piece(126, false)}</g>`, "art art-tamago");
  }

  // ---------- 节日装饰（T-55）：原点在底部中心，向上画；直接放进场景 SVG ----------
  const DECO = {
    // 正月门松：三根斜切竹 + 松枝 + 草绳底座
    kadomatsu: () => `
      <path d="M-34 -28 Q-40 -60 -30 -68 Q-14 -76 0 -66 Q16 -78 32 -66 Q40 -56 34 -28 Z" fill="#3f6b3a" ${OL()}/>
      <path d="M-24 -62 q-6 -10 2 -14 M20 -64 q8 -8 0 -14 M-2 -70 q2 -10 -6 -12" stroke="#2c4f2a" stroke-width="3" fill="none"/>
      <rect x="-22" y="-128" width="14" height="100" fill="#7fb04a" ${OL()}/>
      <path d="M-22 -128 L-8 -140 L-8 -128 Z" fill="#cfe39a" ${OL()}/>
      <rect x="-7" y="-150" width="14" height="122" fill="#8cbc52" ${OL()}/>
      <path d="M-7 -150 L7 -164 L7 -150 Z" fill="#d8eaa6" ${OL()}/>
      <rect x="8" y="-116" width="14" height="88" fill="#7fb04a" ${OL()}/>
      <path d="M8 -116 L22 -128 L22 -116 Z" fill="#cfe39a" ${OL()}/>
      <path d="M-22 -100 h14 M-7 -112 h14 M8 -90 h14" stroke="#5d8a35" stroke-width="2"/>
      <path d="M-36 -30 L36 -30 L32 0 L-32 0 Z" fill="#d9b26a" ${OL()}/>
      <path d="M-34 -20 L34 -20 M-33 -10 L33 -10" stroke="#a5793a" stroke-width="2.5"/>
      <path d="M-6 -30 v30 M6 -30 v30" stroke="#c0392b" stroke-width="3"/>`,
    // 七夕：竹枝挂彩色短册和纸星星
    tanabata: () => {
      const strips = [[-34, -200, "#e86a5c"], [26, -214, "#f2c14e"], [-20, -160, "#6a9bd8"], [34, -170, "#f0a8b8"], [-40, -120, "#9ac46a"], [18, -128, "#e86a5c"], [-8, -236, "#6a9bd8"]];
      return `
      <rect x="-5" y="-260" width="10" height="260" rx="3" fill="#7fb04a" ${OL()}/>
      <path d="M-5 -200 h10 M-5 -140 h10 M-5 -80 h10" stroke="#5d8a35" stroke-width="2"/>
      ${[[-1, -230], [1, -190], [-1, -150], [1, -110]].map(([dir, y]) => `<path d="M0 ${y} q${dir * 30} -10 ${dir * 52} 6 q${dir * -26} 4 ${dir * -52} -6 Z" fill="#6aa04a" ${OL()}/>`).join("")}
      ${strips.map(([x, y, c]) => `<line x1="${x + 4}" y1="${y - 10}" x2="${x + 4}" y2="${y}" stroke="${T.ol}" stroke-width="1"/><rect class="sway" x="${x}" y="${y}" width="9" height="30" fill="${c}" ${OL()}/>`).join("")}
      <path d="M40 -240 l4 9 l10 1 l-8 6 l3 10 l-9 -6 l-9 6 l3 -10 l-8 -6 l10 -1 Z" fill="#f6d55c" ${OL()}/>`;
    },
    // 万圣节：笑脸南瓜灯
    pumpkin: () => `<ellipse cx="0" cy="-1" rx="33" ry="5" fill="#6b381c" opacity=".22"/><image href="assets/art/pumpkin.webp" x="-37" y="-78" width="74" height="78" preserveAspectRatio="xMidYMax meet"/>`,
    // 圣诞：小盆栽圣诞树
    tree: () => `
      <path d="M-14 0 L-18 -20 L18 -20 L14 0 Z" fill="#b5653a" ${OL()}/>
      <path d="M0 -100 L-30 -54 L-18 -54 L-38 -20 L38 -20 L18 -54 L30 -54 Z" fill="#4f8a46" ${OL()}/>
      <path d="M-22 -40 Q0 -30 22 -42 M-14 -70 Q0 -62 14 -72" stroke="#f6d55c" stroke-width="2" fill="none"/>
      ${[[-16, -30, "#e86a5c"], [12, -36, "#6a9bd8"], [-6, -58, "#f6d55c"], [10, -64, "#e86a5c"], [0, -84, "#f0a8b8"], [22, -26, "#f6d55c"]].map(([x, y, c]) => `<circle cx="${x}" cy="${y}" r="3.6" fill="${c}" ${OL()}/>`).join("")}
      <path d="M0 -114 l4 9 l10 1 l-8 6 l3 10 l-9 -6 l-9 6 l3 -10 l-8 -6 l10 -1 Z" fill="#f6d55c" ${OL()}/>`,
    // 下雨天（T-56）：靠在门口的湿雨伞
    umbrella: () => `<ellipse cx="0" cy="0" rx="18" ry="4" fill="#493c35" opacity=".18"/><image href="assets/art/umbrella.webp" x="-25" y="-150" width="65" height="150" preserveAspectRatio="xMidYMax meet"/>`,
  };
  const deco = (kind) => (DECO[kind] ? DECO[kind]() : "");

  // ---------- 玩家摆的刺身拼盘（T-11 / T-12）：slices = [{ fish, x, y, r }]，x / y 是 0–1 的盘面坐标 ----------
  // 俯视摆好的盘子在场景里压扁成椭圆，每片外层套 .bite，客人可以一片片吃
  function platter(slices) {
    const pieces = slices.map((s) => `<g class="bite"><g transform="translate(${20 + s.x * 180} ${14 + s.y * 64}) rotate(${s.r}) scale(.8 .58) translate(-20 -30)">${slicePiece(s.fish)}</g></g>`).join("");
    return svg(220, 96, `
      <ellipse cx="110" cy="52" rx="106" ry="40" fill="#f7f1e6" ${OL()}/>
      <ellipse cx="110" cy="50" rx="88" ry="30" fill="#ece3d2"/>
      <path d="M40 46 q8 -6 16 0 q-8 6 -16 0 Z" fill="#6aa04a"/>
      ${pieces}`, "art art-platter");
  }

  return { sashimi, nigiri, maki, geta, takeoutBox, tamagoyaki, platter, deco, slicePiece, OUTLINE: T.ol };
})();
