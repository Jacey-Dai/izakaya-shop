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

  // ---------- 单片刺身（40×60） ----------
  function slicePiece(f) {
    f = fc(f);
    const c = f.color, c2 = f.color2;
    switch (f.shape) {
      case "round":
        return `<circle cx="20" cy="36" r="16" fill="${c}" ${OL()}/>
          <circle cx="20" cy="36" r="9" fill="${c2}" opacity=".55"/>
          <path d="M10 30 Q13 23 20 22" ${HI}/>`;
      case "shrimp":
        return `<path d="M22 10 l-7 -9 l9 4 l5 -5 l1 10 z" fill="#e2553c" ${OL()}/>
          <path d="M8 50 Q4 28 14 12 Q22 4 30 9 Q37 17 33 34 Q29 50 18 55 Q10 56 8 50 Z" fill="${c2}" ${OL()}/>
          <g stroke="${c}" stroke-width="5" stroke-linecap="round" fill="none">
            <path d="M10 22 Q20 18 31 21"/><path d="M8 34 Q20 30 33 33"/><path d="M9 46 Q19 43 30 45"/>
          </g>
          <path d="M12 16 Q16 11 22 10" ${HI}/>`;
      case "roe":
        return `<g ${OL()}>
            <ellipse cx="13" cy="38" rx="8" ry="14" fill="${c}" transform="rotate(-14 13 38)"/>
            <ellipse cx="27" cy="38" rx="8" ry="14" fill="${c}" transform="rotate(14 27 38)"/>
            <ellipse cx="20" cy="32" rx="8" ry="15" fill="${c}"/>
          </g>
          <g fill="${c2}"><circle cx="18" cy="26" r="2"/><circle cx="23" cy="34" r="2"/><circle cx="12" cy="40" r="2"/><circle cx="28" cy="42" r="2"/><circle cx="19" cy="42" r="2"/></g>`;
      case "pearl": {
        const pts = [[12, 30], [26, 28], [19, 40], [8, 44], [30, 42], [19, 52], [20, 20]];
        return pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="7" fill="${c}" ${OL()}/><circle cx="${x - 2}" cy="${y - 2}" r="2" fill="#fff" opacity=".85"/>`).join("");
      }
      default:
        return `<path d="M6 50 Q2 30 8 13 Q14 3 26 4 Q37 8 35 26 Q33 44 22 54 Q12 58 6 50 Z" fill="${c}" ${OL()}/>
          <g stroke="${c2}" stroke-width="3.5" stroke-linecap="round" fill="none" opacity=".9">
            <path d="M10 45 Q12 25 26 11"/><path d="M18 51 Q22 33 32 19"/>
          </g>
          <path d="M11 22 Q14 13 22 9" ${HI}/>`;
    }
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
  const rice = () => `<path d="M8 36 Q6 26 18 24 L62 24 Q74 26 72 36 Q70 46 40 46 Q10 46 8 36 Z" fill="${T.rice}" ${RICE_OL()}/>
    <g stroke="${T.grain}" stroke-width="2" fill="none" stroke-linecap="round"><path d="M16 40 q3 2 6 0"/><path d="M30 42 q3 2 6 0"/><path d="M46 42 q3 2 6 0"/><path d="M58 38 q3 2 6 0"/></g>`;

  function topping(f) {
    f = fc(f);
    const c = f.color, c2 = f.color2;
    if (f.shape === "round") {
      return `<path d="M10 27 Q12 13 40 13 Q68 13 70 27 Q66 33 40 33 Q14 33 10 27 Z" fill="${c}" ${OL()}/>
        <ellipse cx="40" cy="22" rx="18" ry="5" fill="${c2}" opacity=".55"/>
        <path d="M18 20 Q26 16 34 16" ${HI}/>`;
    }
    if (f.shape === "shrimp") {
      return `<path d="M70 20 l10 -9 l-2 9 l7 2 l-10 5 z" fill="#e2553c" ${OL()}/>
        <path d="M4 28 Q6 12 34 10 Q62 8 74 20 Q74 30 58 30 L20 32 Q6 34 4 28 Z" fill="${c2}" ${OL()}/>
        <g stroke="${c}" stroke-width="5" stroke-linecap="round" fill="none">
          <path d="M18 30 Q20 18 28 12"/><path d="M34 30 Q36 18 44 11"/><path d="M50 29 Q52 18 60 13"/>
        </g>
        <path d="M12 20 Q20 14 28 13" ${HI}/>`;
    }
    return `<path d="M4 28 Q6 12 34 10 Q64 8 76 22 Q76 30 60 30 L20 32 Q6 34 4 28 Z" fill="${c}" ${OL()}/>
      <g stroke="${c2}" stroke-width="3.5" stroke-linecap="round" fill="none" opacity=".9">
        <path d="M18 30 Q22 18 34 12"/><path d="M36 30 Q40 18 52 12"/><path d="M54 29 Q58 20 68 16"/>
      </g>
      <path d="M12 21 Q20 14 30 13" ${HI}/>`;
  }

  function gunkanBody(f) {
    f = fc(f);
    const c = f.color, c2 = f.color2;
    const top = f.shape === "pearl"
      ? [16, 26, 36, 46, 56, 64, 21, 31, 41, 51, 60].map((x, i) => {
          const y = i < 6 ? 18 : 11;
          return `<circle cx="${x}" cy="${y}" r="6" fill="${c}" ${OL()}/><circle cx="${x - 2}" cy="${y - 2}" r="1.8" fill="#fff" opacity=".85"/>`;
        }).join("")
      : `<g ${OL()}>${[18, 30, 42, 54, 62].map((x, i) => `<ellipse cx="${x}" cy="${15 + (i % 2) * 3}" rx="8" ry="6" fill="${c}"/>`).join("")}</g>
         <g fill="${c2}"><circle cx="24" cy="14" r="1.8"/><circle cx="40" cy="17" r="1.8"/><circle cx="56" cy="14" r="1.8"/></g>`;
    return `<rect x="10" y="20" width="60" height="26" rx="7" fill="${NORI}" ${OL()}/>
      <path d="M18 26 q4 8 0 16 M34 26 q4 8 0 16 M52 26 q4 8 0 16" stroke="#2f3d32" stroke-width="3" fill="none"/>
      <ellipse cx="40" cy="20" rx="29" ry="5" fill="${T.rice}" ${RICE_OL()}/>
      ${top}`;
  }

  const nigiriBody = (f) => (f.shape === "roe" || f.shape === "pearl" ? gunkanBody(f) : rice() + topping(f));
  const nigiri = (f) => svg(80, 52, nigiriBody(f), "art art-nigiri");

  function maki(f) {
    return svg(60, 60, `
      <circle cx="30" cy="31" r="25" fill="${NORI}" ${OL()}/>
      <circle cx="30" cy="31" r="18" fill="${T.rice}" stroke="${T.grain}" stroke-width="2"/>
      <g stroke="#e6dfd4" stroke-width="2" fill="none" stroke-linecap="round"><path d="M17 26 q3 -2 5 0"/><path d="M38 20 q3 -2 5 0"/><path d="M36 42 q3 -2 5 0"/></g>
      <rect x="22" y="23" width="16" height="16" rx="4" fill="${col(f.color)}" ${OL()}/>
      <path d="M25 27 q3 -2 6 -2" ${HI}/>`, "art art-maki");
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
      <rect x="0" y="34" width="44" height="26" rx="6" fill="#f6c94a" ${OL()}/>
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
    pumpkin: () => `
      <ellipse cx="0" cy="-26" rx="38" ry="27" fill="#e8892e" ${OL()}/>
      <path d="M-12 -52 Q0 -46 12 -52 M-14 -2 Q0 -6 14 -2" stroke="#b5601c" stroke-width="2.5" fill="none"/>
      <path d="M-14 -52 Q-18 -26 -14 -1 M14 -52 Q18 -26 14 -1" stroke="#c96d22" stroke-width="2.5" fill="none"/>
      <path d="M-3 -52 q-2 -12 8 -16" stroke="#5d7a35" stroke-width="5" stroke-linecap="round" fill="none"/>
      <path d="M-22 -34 l8 -9 l8 9 Z M6 -34 l8 -9 l8 9 Z" fill="#ffd96a" stroke="#7a3f12" stroke-width="1.5"/>
      <path d="M-18 -20 Q0 -6 18 -20 Q0 -12 -18 -20 Z" fill="#ffd96a" stroke="#7a3f12" stroke-width="1.5"/>
      <ellipse class="deco-glow" cx="0" cy="-26" rx="54" ry="40" fill="url(#lamp-light)"/>`,
    // 圣诞：小盆栽圣诞树
    tree: () => `
      <path d="M-14 0 L-18 -20 L18 -20 L14 0 Z" fill="#b5653a" ${OL()}/>
      <path d="M0 -100 L-30 -54 L-18 -54 L-38 -20 L38 -20 L18 -54 L30 -54 Z" fill="#4f8a46" ${OL()}/>
      <path d="M-22 -40 Q0 -30 22 -42 M-14 -70 Q0 -62 14 -72" stroke="#f6d55c" stroke-width="2" fill="none"/>
      ${[[-16, -30, "#e86a5c"], [12, -36, "#6a9bd8"], [-6, -58, "#f6d55c"], [10, -64, "#e86a5c"], [0, -84, "#f0a8b8"], [22, -26, "#f6d55c"]].map(([x, y, c]) => `<circle cx="${x}" cy="${y}" r="3.6" fill="${c}" ${OL()}/>`).join("")}
      <path d="M0 -114 l4 9 l10 1 l-8 6 l3 10 l-9 -6 l-9 6 l3 -10 l-8 -6 l10 -1 Z" fill="#f6d55c" ${OL()}/>`,
    // 下雨天（T-56）：靠在门口的湿雨伞
    umbrella: () => `
      <path d="M0 0 L-2 -12" stroke="${T.ol}" stroke-width="3" stroke-linecap="round"/>
      <path d="M-2 -12 Q-14 -60 -10 -118 L6 -118 Q12 -60 -2 -12 Z" fill="#41557e" ${OL()}/>
      <path d="M-6 -20 Q-10 -70 -6 -116 M2 -24 Q4 -70 2 -116" stroke="#2f3f60" stroke-width="1.5" fill="none"/>
      <rect x="-9" y="-62" width="14" height="5" rx="2" fill="#c0392b"/>
      <path d="M-2 -118 L-2 -150 Q-2 -160 8 -160 Q16 -160 16 -152" stroke="#8a5a32" stroke-width="4" stroke-linecap="round" fill="none"/>
      <ellipse cx="2" cy="2" rx="18" ry="4" fill="#7fa6c8" opacity=".45"/>`,
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
