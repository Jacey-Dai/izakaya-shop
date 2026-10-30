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
    const pieces = list.map((f, i) => `<g transform="translate(${18 + i * 52} 6) scale(.62)">${nigiriBody(f)}</g>`).join("");
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

  return { sashimi, nigiri, maki, geta, takeoutBox, slicePiece, OUTLINE: T.ol };
})();
