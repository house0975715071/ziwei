// 紫微斗數網頁版｜圖表（web contract v1 第 4 節）
// 全部是純函式、回傳 SVG 字串；不依賴任何外部套件、不發任何連線，在 Node 也能直接測。
// 規格：線 2px 圓角、點直徑 >= 8px 外圈 2px 底色、長條 <= 24px 資料端 4px 圓角、
//       格線 1px 實線、文字只用字色（不用資料色）、只標重點。
// 版面尺寸建議：app.js 依容器寬度傳 width／size 進來，字就會維持原本大小（圖不會被縮小到看不清）。

export const COLORS = {
  accent: '#256abf',
  highlight: '#b8860b',
  muted: '#a39a88',
  grid: '#e3ddd0',
  ink: '#23211d',
  ink2: '#6f6759',
  ink3: '#8a8274',
  surface: '#fffdf8',
};

const FONT = 'system-ui, &quot;Microsoft JhengHei&quot;, &quot;PingFang TC&quot;, sans-serif';
const AREA_OPACITY = 0.1;

// ---------- 小工具 ----------

/** HTML／XML 跳脫（文字與屬性共用） */
export function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 數值：NaN／undefined／字串亂碼 → 0，再夾在 lo～hi */
export function clampScore(v, lo = 0, hi = 100) {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

// 座標輸出固定一位小數，避免 -0 與浮點雜訊，讓輸出可重現
function f(n) {
  const r = Math.round(n * 10) / 10;
  return Object.is(r, -0) || r === 0 ? '0' : String(r);
}

// 分數顯示：整數就整數，否則一位小數
function num(n) {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

function palName(n) {
  const s = String(n == null ? '' : n).trim();
  if (!s) return '';
  return s.endsWith('宮') ? s : s + '宮';
}

/** 估算文字寬度（px）：中文／全形字 = 1 字寬，英數約 0.6，空白約 0.3 */
export function textWidth(str, fs) {
  let w = 0;
  for (const ch of String(str)) {
    const c = ch.codePointAt(0);
    if (c === 32) w += 0.3;
    else if (c < 0x2e80) w += (c >= 0x41 && c <= 0x5a) || ch === 'm' || ch === 'w' ? 0.7 : 0.6;
    else w += 1;
  }
  return w * fs;
}

function truncate(str, fs, maxW) {
  const s = String(str);
  if (textWidth(s, fs) <= maxW) return s;
  let out = '';
  for (const ch of s) {
    if (textWidth(out + ch + '…', fs) > maxW) break;
    out += ch;
  }
  return out + '…';
}

function sizeOr(v, def, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return def;
  return Math.min(max, Math.max(min, Math.round(n)));
}

// 標準外框：role=img＋aria-label＋<title>；寬高照 viewBox，CSS 讓它隨容器縮放
function svgOpen({ vbX = 0, vbY = 0, w, h, label, title, cls }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" class="zw-chart ${cls}" role="img" aria-label="${esc(label)}"`
    + ` viewBox="${f(vbX)} ${f(vbY)} ${f(w)} ${f(h)}" width="${f(w)}" height="${f(h)}"`
    + ` style="max-width:100%;height:auto;display:block;margin:0 auto;-webkit-tap-highlight-color:transparent" font-family="${FONT}">`
    + `<title>${esc(title)}</title>`;
}

// 可點的元素：不要手機點擊的藍色反白框與瀏覽器焦點框（焦點時會跳出提示框，看得出在哪）
const TAP = 'cursor:pointer;outline:none;-webkit-tap-highlight-color:transparent';

// 文字外圍一圈底色，壓在格線上仍清楚
const HALO = `paint-order="stroke" stroke="${COLORS.surface}" stroke-width="4" stroke-linejoin="round"`;

function dot(x, y, r, color, extra = '') {
  return `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${color}" stroke="${COLORS.surface}" stroke-width="2"${extra}/>`;
}

function emptyChart(w, h, title, cls) {
  return svgOpen({ w, h, label: `${title}：目前沒有資料`, title, cls })
    + `<rect x="0" y="0" width="${f(w)}" height="${f(h)}" fill="${COLORS.surface}"/>`
    + `<text x="${f(w / 2)}" y="${f(h / 2)}" text-anchor="middle" dominant-baseline="middle" font-size="14" fill="${COLORS.ink3}">目前沒有資料</text></svg>`;
}

// 依角度決定文字對齊：θ 從正上方順時針（弧度）
function labelPlacement(cx, cy, r, theta, fs, text, lineCount = 1) {
  const sx = Math.sin(theta);
  const sy = -Math.cos(theta);
  const x = cx + r * sx;
  const y = cy + r * sy;
  const anchor = Math.abs(sx) < 0.3 ? 'middle' : sx > 0 ? 'start' : 'end';
  const w = textWidth(text, fs);
  const h = fs * 1.25 * lineCount;
  // 文字方塊的上緣
  let top;
  if (sy < -0.3) top = y - h;               // 上方：整塊在點的上面
  else if (sy > 0.3) top = y;               // 下方：整塊在點的下面
  else top = y - h / 2;                     // 左右：垂直置中
  const left = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2;
  const baseline = top + fs * 0.95;         // 第一行基線
  return { x, y, anchor, baseline, box: { x: left, y: top, w, h } };
}

function unionBox(boxes) {
  let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
  for (const b of boxes) {
    x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y);
    x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

// 左右對稱撐開，讓圖的中心永遠在正中間（不同命盤的圖寬度也比較一致）
function symmetricX(b, cx) {
  const half = Math.max(cx - b.x, b.x + b.w - cx);
  return { x: cx - half, y: b.y, w: half * 2, h: b.h };
}

function overlaps(a, b, pad = 0) {
  return a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad;
}

// ---------- 同分規則（圖與 app.js 共用，保證畫面各處說法一致） ----------

/**
 * 分數最高／最低的「全部」位置（同分並列一起算）。全部同分時 flat＝true，max／min 都是空陣列。
 * @param {number[]} values
 * @returns {{ max: number[], min: number[], flat: boolean, hi: number, lo: number }}
 */
export function extremes(values) {
  const v = (Array.isArray(values) ? values : []).map((x) => clampScore(x));
  if (!v.length) return { max: [], min: [], flat: true, hi: 0, lo: 0 };
  const hi = Math.max(...v);
  const lo = Math.min(...v);
  if (hi === lo) return { max: [], min: [], flat: true, hi, lo };
  const max = [];
  const min = [];
  v.forEach((x, i) => { if (x === hi) max.push(i); if (x === lo) min.push(i); });
  return { max, min, flat: false, hi, lo };
}

/**
 * 前 n 名的位置（跟第 n 名同分的也一起算進來）。全部同分回空陣列（沒有誰比較高）。
 * 同分擴張太多（超過 2n 個）時，只留比第 n 名分數高的，避免一整片金色。
 */
export function topWithTies(values, n) {
  const v = (Array.isArray(values) ? values : []).map((x) => clampScore(x));
  const k = Math.max(0, Math.min(v.length, Math.floor(Number(n)) || 0));
  if (!k || !v.length) return [];
  if (Math.max(...v) === Math.min(...v)) return [];
  const order = v.map((_, i) => i).sort((a, b) => v[b] - v[a] || a - b);
  const cut = v[order[k - 1]];
  let set = order.filter((i) => v[i] >= cut);
  if (set.length > k * 2) set = order.filter((i) => v[i] > cut);
  return set;
}

/** 人生曲線只從「實際會走到的年紀」裡挑最好／要留意：大限起始年齡 <= 這個數（或目前年齡，取大的） */
export const LIFE_PICK_MAX_START = 85;

/**
 * 人生曲線的「最好／要留意」：只從起始年齡 <= max(85, 目前年齡) 的大限裡挑，同分並列。
 * @param {{ageStart:number, score:number}[]} points
 * @param {number|null} currentAge
 * @returns {{ best: number[], worst: number[], flat: boolean, pool: number[] }} 位置是 points 的 index
 */
export function lifePicks(points, currentAge = null) {
  const list = Array.isArray(points) ? points : [];
  const now = Number(currentAge);
  const limit = Math.max(LIFE_PICK_MAX_START, Number.isFinite(now) && currentAge !== null && currentAge !== '' ? now : 0);
  let pool = [];
  list.forEach((p, i) => { if (p && clampScore(p.ageStart, 0, 150) <= limit) pool.push(i); });
  if (!pool.length) pool = list.map((_, i) => i).filter((i) => list[i]);
  const ex = extremes(pool.map((i) => list[i].score));
  return { best: ex.max.map((k) => pool[k]), worst: ex.min.map((k) => pool[k]), flat: ex.flat, pool };
}

// ---------- 雷達圖（五大面向） ----------

/**
 * 五大面向雷達（星狀圖）
 * @param {{ axes: {key:string,label:string,value:number}[], size?: number, title?: string, highlightKey?: string|null }} opt
 */
export function radarChart({ axes = [], size = 340, title = '', highlightKey = null } = {}) {
  const S = sizeOr(size, 340, 220, 1200);
  const heading = String(title || '五大面向雷達圖');
  const list = (Array.isArray(axes) ? axes : []).filter(Boolean).map((a, i) => ({
    key: String(a.key ?? a.label ?? i),
    label: String(a.label ?? a.key ?? ''),
    value: clampScore(a.value),
  }));
  if (list.length < 3) return emptyChart(S, Math.round(S * 0.6), heading, 'zw-radar');

  // 找重點軸：有指定就用指定（字串或陣列，同分可以一次給多個）；沒指定就用分數最高（同分全部標）。
  // 五個分數全部一樣時，沒有誰比較強，一個都不標。
  const ex = extremes(list.map((a) => a.value));
  let hiIdx = [];
  if (!ex.flat) {
    if (highlightKey == null) hiIdx = ex.max;
    else {
      const keys = new Set((Array.isArray(highlightKey) ? highlightKey : [highlightKey]).map(String));
      hiIdx = list.map((a, i) => (keys.has(a.key) ? i : -1)).filter((i) => i >= 0);
    }
  }
  const hiSet = new Set(hiIdx);
  const hiNames = hiIdx.map((i) => list[i].label).join('、');

  const fs = Math.max(12, Math.round(S / 26));
  const cx = S / 2;
  const cy = S / 2;
  const R = S / 2 - fs * 4.2;
  const n = list.length;
  const ang = (i) => (Math.PI * 2 * i) / n;
  const pt = (i, v) => [cx + R * (v / 100) * Math.sin(ang(i)), cy - R * (v / 100) * Math.cos(ang(i))];

  const parts = [];
  // 同心格（20/40/60/80/100）：多邊形格線
  for (const lv of [20, 40, 60, 80, 100]) {
    const ring = list.map((_, i) => pt(i, lv).map(f).join(',')).join(' ');
    parts.push(`<polygon class="zw-grid" points="${ring}" fill="none" stroke="${COLORS.grid}" stroke-width="1"/>`);
  }
  // 軸線
  list.forEach((_, i) => {
    const [x, y] = pt(i, 100);
    parts.push(`<line class="zw-axis" x1="${f(cx)}" y1="${f(cy)}" x2="${f(x)}" y2="${f(y)}" stroke="${COLORS.grid}" stroke-width="1"/>`);
  });
  // 基準 50：襯底色細線
  const base = list.map((_, i) => pt(i, 50).map(f).join(',')).join(' ');
  parts.push(`<polygon class="zw-base" points="${base}" fill="none" stroke="${COLORS.muted}" stroke-width="1.5"/>`);

  // 資料多邊形
  const poly = list.map((a, i) => pt(i, a.value).map(f).join(',')).join(' ');
  parts.push(`<polygon class="zw-area" points="${poly}" fill="${COLORS.accent}" fill-opacity="${AREA_OPACITY}" stroke="${COLORS.accent}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`);

  // 點＋標籤
  const boxes = [{ x: cx - R - 7, y: cy - R - 7, w: 2 * R + 14, h: 2 * R + 14 }];
  const labels = [];
  const ptsLo = [];
  const ptsHi = [];
  list.forEach((a, i) => {
    const [x, y] = pt(i, a.value);
    const isHi = hiSet.has(i);
    const tip = `${a.label}｜${num(a.value)} 分${isHi ? (hiSet.size > 1 ? '｜並列比較有優勢的方向' : '｜你比較有優勢的方向') : ''}`;
    const text = `${a.label} ${num(a.value)}`;
    const L = labelPlacement(cx, cy, R + fs * 0.7, ang(i), fs, text);
    boxes.push(L.box);
    const weight = isHi ? ' font-weight="700"' : '';
    labels.push(`<text class="zw-label${isHi ? ' zw-hi' : ''}" x="${f(L.x)}" y="${f(L.baseline)}" text-anchor="${L.anchor}" font-size="${fs}" fill="${COLORS.ink}"${weight}>`
      + `${esc(a.label)} <tspan fill="${isHi ? COLORS.ink : COLORS.ink2}">${esc(num(a.value))}</tspan></text>`);
    // 點的可點範圍：直徑 44px 的透明圓（手指點得到）
    (isHi ? ptsHi : ptsLo).push(`<g class="zw-pt${isHi ? ' zw-hi' : ''}" data-key="${esc(a.key)}" data-tip="${esc(tip)}">`
      + `<circle cx="${f(x)}" cy="${f(y)}" r="22" fill="transparent"/>`
      + dot(x, y, isHi ? 6 : 4.5, isHi ? COLORS.highlight : COLORS.accent)
      + '</g>');
  });
  // 重點色的點畫在最上層，不會被主色點蓋住
  parts.push(...ptsLo, ...ptsHi, ...labels);

  // 圖例（放在圖下方，不會壓到圖形）：基準 50、最高
  const all = unionBox(boxes);
  const legY = all.y + all.h + fs * 1.1;
  const legFs = Math.max(11, fs - 2);
  const leg = [];
  const legItems = [['line', COLORS.muted, '基準 50']];
  if (hiSet.size) legItems.push(['dot', COLORS.highlight, hiSet.size > 1 ? `並列較強：${hiNames}` : `較強：${hiNames}`]);
  else if (ex.flat) legItems.push(['text', null, '各面向同分']);
  const itemsW = legItems.map(([kind, , t]) => (kind === 'text' ? 0 : 22) + textWidth(t, legFs));
  const totalW = itemsW.reduce((s, w) => s + w, 0) + 18 * (legItems.length - 1);
  let lx = cx - totalW / 2;
  legItems.forEach(([kind, color, t], k) => {
    if (kind === 'line') leg.push(`<line x1="${f(lx)}" y1="${f(legY - legFs * 0.35)}" x2="${f(lx + 16)}" y2="${f(legY - legFs * 0.35)}" stroke="${color}" stroke-width="1.5"/>`);
    else if (kind === 'dot') leg.push(dot(lx + 8, legY - legFs * 0.35, 5, color));
    leg.push(`<text x="${f(lx + (kind === 'text' ? 0 : 22))}" y="${f(legY)}" font-size="${legFs}" fill="${COLORS.ink2}">${esc(t)}</text>`);
    lx += itemsW[k] + 18;
  });
  boxes.push({ x: cx - totalW / 2, y: legY - legFs, w: totalW, h: legFs * 1.3 });

  // viewBox 依所有文字方塊撐開，四周留白，避免被切掉
  const pad = 8;
  const vb = symmetricX(unionBox(boxes), cx);
  const vbX = Math.floor(vb.x - pad);
  const vbY = Math.floor(vb.y - pad);
  const w = Math.ceil(vb.w + pad * 2);
  const h = Math.ceil(vb.h + pad * 2);

  const sorted = list.map((a) => `${a.label} ${num(a.value)} 分`).join('、');
  const tail = hiSet.size ? `；${hiNames}${hiSet.size > 1 ? '並列' : ''}比較有優勢` : (ex.flat ? '；各面向分數相同，沒有特別偏向哪一面' : '');
  const label = `${heading}：${sorted}${tail}。`;
  return svgOpen({ vbX, vbY, w, h, label, title: heading, cls: 'zw-radar' })
    + `<rect x="${f(vbX)}" y="${f(vbY)}" width="${f(w)}" height="${f(h)}" fill="${COLORS.surface}"/>`
    + parts.join('') + leg.join('') + '</svg>';
}

// ---------- 十二宮星狀圖 ----------

/**
 * 十二宮能量星狀圖
 * @param {{ palaces: {name:string,score:number}[], size?: number, top?: number }} opt
 */
export function palaceStarChart({ palaces = [], size = 360, top = 3 } = {}) {
  const S = sizeOr(size, 360, 240, 1200);
  const heading = '十二宮能量星狀圖';
  const list = (Array.isArray(palaces) ? palaces : []).filter(Boolean).map((p) => ({
    name: String(p.name ?? ''),
    score: clampScore(p.score),
  }));
  if (list.length < 3) return emptyChart(S, Math.round(S * 0.6), heading, 'zw-palace');

  const topN = Math.max(0, Math.min(list.length, Math.floor(Number(top)) || 0));
  const order = list.map((p, i) => i).sort((a, b) => list[b].score - list[a].score || a - b);
  // 前 N 名：跟第 N 名同分的一起標（不會因為排在後面就被切掉）；全部同分就不標
  const topIdx = topWithTies(list.map((p) => p.score), topN);
  const topSet = new Set(topIdx);
  const tiedAtCut = topSet.size > topN;
  // 名次用「比它高的有幾個＋1」，同分同名次
  const rank = new Map(list.map((p, i) => [i, 1 + list.filter((q) => q.score > p.score).length]));
  const sameCount = new Map(list.map((p, i) => [i, list.filter((q) => q.score === p.score).length]));

  const fs = Math.max(12, Math.round(S / 28));
  const cx = S / 2;
  const cy = S / 2;
  const R = S / 2 - fs * 3.6;
  const n = list.length;
  const ang = (i) => (Math.PI * 2 * i) / n;
  const pt = (i, v) => [cx + R * (v / 100) * Math.sin(ang(i)), cy - R * (v / 100) * Math.cos(ang(i))];

  const parts = [];
  for (const lv of [25, 50, 75, 100]) {
    const color = lv === 50 ? COLORS.muted : COLORS.grid;
    parts.push(`<circle class="zw-grid" cx="${f(cx)}" cy="${f(cy)}" r="${f(R * lv / 100)}" fill="none" stroke="${color}" stroke-width="1"/>`);
  }
  list.forEach((_, i) => {
    const [x, y] = pt(i, 100);
    parts.push(`<line class="zw-axis" x1="${f(cx)}" y1="${f(cy)}" x2="${f(x)}" y2="${f(y)}" stroke="${COLORS.grid}" stroke-width="1"/>`);
  });
  const poly = list.map((p, i) => pt(i, p.score).map(f).join(',')).join(' ');
  parts.push(`<polygon class="zw-area" points="${poly}" fill="${COLORS.accent}" fill-opacity="${AREA_OPACITY}" stroke="${COLORS.accent}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`);

  const boxes = [{ x: cx - R - 7, y: cy - R - 7, w: 2 * R + 14, h: 2 * R + 14 }];
  const groups = [];
  list.forEach((p, i) => {
    const [x, y] = pt(i, p.score);
    const isTop = topSet.has(i);
    const text = isTop ? `${p.name} ${num(p.score)}` : p.name;
    const L = labelPlacement(cx, cy, R + fs * 0.6, ang(i), fs, text);
    boxes.push(L.box);
    const [ex, ey] = pt(i, 100);
    const tip = `${palName(p.name)}｜${num(p.score)} 分｜${sameCount.get(i) > 1 ? '並列' : ''}第 ${rank.get(i)} 高｜點一下看詳解`;
    const labelSvg = isTop
      ? `<text class="zw-label zw-hi" x="${f(L.x)}" y="${f(L.baseline)}" text-anchor="${L.anchor}" font-size="${fs}" font-weight="700" fill="${COLORS.ink}">${esc(p.name)} <tspan>${esc(num(p.score))}</tspan></text>`
      : `<text class="zw-label" x="${f(L.x)}" y="${f(L.baseline)}" text-anchor="${L.anchor}" font-size="${fs}" fill="${COLORS.ink2}">${esc(p.name)}</text>`;
    // 可點範圍：整條軸（粗的透明線）＋標籤＋點周圍
    groups.push(`<g class="zw-pt zw-palace-axis${isTop ? ' zw-hi' : ''}" data-palace="${esc(p.name)}" data-tip="${esc(tip)}" tabindex="0" style="${TAP}">`
      + `<line x1="${f(cx)}" y1="${f(cy)}" x2="${f(ex)}" y2="${f(ey)}" stroke="transparent" stroke-width="22" stroke-linecap="round"/>`
      + `<rect x="${f(L.box.x - 4)}" y="${f(L.box.y - 4)}" width="${f(L.box.w + 8)}" height="${f(L.box.h + 8)}" fill="transparent"/>`
      + `<circle cx="${f(x)}" cy="${f(y)}" r="14" fill="transparent"/>`
      + dot(x, y, isTop ? 6 : 4, isTop ? COLORS.highlight : COLORS.accent)
      + labelSvg
      + '</g>');
  });
  parts.push(...groups);

  // 圖例
  const all = unionBox(boxes);
  const legFs = Math.max(11, fs - 2);
  const legY = all.y + all.h + fs * 1.7;
  const items = [];
  if (topSet.size > 0) items.push(['dot', COLORS.highlight, tiedAtCut ? `前 ${topN} 高（含同分）` : `前 ${topSet.size} 高`]);
  items.push(['dot', COLORS.accent, '其他宮位'], ['ring', COLORS.muted, '50 分']);
  const itemsW = items.map(([, , t]) => 22 + textWidth(t, legFs));
  const totalW = itemsW.reduce((s, w) => s + w, 0) + 18 * (items.length - 1);
  let lx = cx - totalW / 2;
  const leg = [];
  items.forEach(([kind, color, t], k) => {
    const my = legY - legFs * 0.35;
    if (kind === 'ring') leg.push(`<line x1="${f(lx)}" y1="${f(my)}" x2="${f(lx + 16)}" y2="${f(my)}" stroke="${color}" stroke-width="1"/>`);
    else leg.push(dot(lx + 8, my, kind === 'dot' && color === COLORS.highlight ? 5.5 : 4.5, color));
    leg.push(`<text x="${f(lx + 22)}" y="${f(legY)}" font-size="${legFs}" fill="${COLORS.ink2}">${esc(t)}</text>`);
    lx += itemsW[k] + 18;
  });
  boxes.push({ x: cx - totalW / 2, y: legY - legFs, w: totalW, h: legFs * 1.3 });

  const pad = 8;
  const vb = symmetricX(unionBox(boxes), cx);
  const vbX = Math.floor(vb.x - pad);
  const vbY = Math.floor(vb.y - pad);
  const w = Math.ceil(vb.w + pad * 2);
  const h = Math.ceil(vb.h + pad * 2);

  const topText = order.filter((i) => topSet.has(i)).map((i) => `${list[i].name} ${num(list[i].score)} 分`).join('、');
  const allSame = list.every((p) => p.score === list[0].score);
  let label;
  if (topSet.size > 0) label = `${heading}：共 ${n} 宮，分數前 ${topN} 高${tiedAtCut ? '（含同分並列）' : ''}是${topText}。`;
  else if (topN > 0 && allSame) label = `${heading}：共 ${n} 宮，每一宮都是 ${num(list[0].score)} 分。`;
  else label = `${heading}：共 ${n} 宮。`;
  return svgOpen({ vbX, vbY, w, h, label, title: heading, cls: 'zw-palace' })
    + `<rect x="${f(vbX)}" y="${f(vbY)}" width="${f(w)}" height="${f(h)}" fill="${COLORS.surface}"/>`
    + parts.join('') + leg.join('') + '</svg>';
}

// ---------- 人生運勢曲線 ----------

const STAGES = [
  { name: '早年', from: -Infinity, to: 35.5, tint: 0.07 },
  { name: '中年', from: 35.5, to: 60.5, tint: 0.13 },
  { name: '晚年', from: 60.5, to: Infinity, tint: 0.07 },
];

function ageRangeText(p) {
  return p.ageEnd > p.ageStart ? `${p.ageStart}～${p.ageEnd} 歲` : `${p.ageStart} 歲起`;
}

/**
 * 人生運勢曲線（大限十年一運）
 * @param {{ points: {ageStart:number,ageEnd:number,score:number,palace?:string,summary?:string}[], currentAge?: number|null, width?: number, height?: number }} opt
 */
export function lifeCurve({ points = [], currentAge = null, width = 680, height = 260 } = {}) {
  const W = sizeOr(width, 680, 300, 2000);
  const H = sizeOr(height, 260, 200, 1200);
  const heading = '人生運勢曲線';
  const list = (Array.isArray(points) ? points : []).filter(Boolean).map((p, i) => {
    const s = Math.round(clampScore(p.ageStart, 0, 150));
    const e = Math.round(clampScore(p.ageEnd, 0, 150));
    return {
      i,
      ageStart: s,
      ageEnd: Math.max(s, e),
      score: clampScore(p.score),
      palace: palName(p.palace),
      summary: String(p.summary ?? '').trim(),
    };
  }).sort((a, b) => a.ageStart - b.ageStart || a.i - b.i);
  if (!list.length) return emptyChart(W, H, heading, 'zw-life');

  const hasNow = currentAge !== null && currentAge !== undefined && currentAge !== '' && Number.isFinite(Number(currentAge));
  const now = hasNow ? Math.round(clampScore(currentAge, 0, 150)) : null;

  const fs = 12;
  const tickFs = 12;
  const padL = 34;
  const padR = 12;
  const bandTop = 4;
  const bandLabelH = 22;
  const plotTop = bandTop + bandLabelH + 8;
  const nowRowH = hasNow ? 20 : 0;
  const plotBottom = H - 26 - nowRowH;
  const plotL = padL;
  const plotR = W - padR;
  const inner = 14;

  let lo = list[0].ageStart;
  let hi = list[list.length - 1].ageStart;
  if (hasNow) { lo = Math.min(lo, now); hi = Math.max(hi, now); }
  if (hi - lo < 10) { hi = lo + 10; }
  const xs = (age) => plotL + inner + ((age - lo) / (hi - lo)) * (plotR - plotL - inner * 2);
  const ys = (v) => plotBottom - (v / 100) * (plotBottom - plotTop);

  const parts = [];
  parts.push(`<rect x="0" y="0" width="${f(W)}" height="${f(H)}" fill="${COLORS.surface}"/>`);

  // 三段底色（極淡）＋上方標籤。年齡範圍要嘛三段都標、要嘛都不標（手機上不會一段有一段沒有）
  const bands = STAGES.map((st) => {
    const x0 = Math.max(plotL, st.from === -Infinity ? plotL : xs(st.from));
    const x1 = Math.min(plotR, st.to === Infinity ? plotR : xs(st.to));
    const range = st.name === '早年' ? '0～35 歲' : st.name === '中年' ? '36～60 歲' : '61 歲以後';
    return { st, x0, x1, range, full: `${st.name} ${range}` };
  }).filter((b) => b.x1 - b.x0 >= 1);
  const allFull = bands.every((b) => textWidth(b.full, fs) + 8 <= b.x1 - b.x0);
  bands.forEach(({ st, x0, x1, range, full }) => {
    parts.push(`<rect class="zw-stage" data-stage="${st.name}" x="${f(x0)}" y="${f(bandTop)}" width="${f(x1 - x0)}" height="${f(plotBottom - bandTop)}" fill="${COLORS.muted}" fill-opacity="${st.tint}"/>`);
    const text = allFull ? full : (textWidth(st.name, fs) + 6 <= x1 - x0 ? st.name : '');
    if (text) {
      parts.push(`<text class="zw-stage-label" x="${f((x0 + x1) / 2)}" y="${f(bandTop + 16)}" text-anchor="middle" font-size="${fs}" fill="${COLORS.ink2}">`
        + (text === full ? `<tspan font-weight="700">${st.name}</tspan> <tspan fill="${COLORS.ink3}">${range}</tspan>` : `<tspan font-weight="700">${st.name}</tspan>`)
        + '</text>');
    }
  });

  // 橫向格線 0/25/50/75/100，標 0/50/100
  for (const v of [0, 25, 50, 75, 100]) {
    const y = ys(v);
    parts.push(`<line class="zw-grid" x1="${f(plotL)}" y1="${f(y)}" x2="${f(plotR)}" y2="${f(y)}" stroke="${v === 50 ? COLORS.muted : COLORS.grid}" stroke-width="1"/>`);
    if (v % 50 === 0) parts.push(`<text x="${f(plotL - 6)}" y="${f(y + 4)}" text-anchor="end" font-size="${tickFs}" fill="${COLORS.ink3}">${v}</text>`);
  }

  const nowX = hasNow ? xs(now) : null;
  // x 軸刻度（大限起始年齡）：太擠就隔一個標；被「你現在」直線穿過的刻度不標（那裡已經有年齡）。
  // 「歲」這個單位標在第一個「有畫出來」的刻度上（第一個被直線蓋掉時，改標在下一個）。
  const coords = list.map((p) => ({ ...p, x: xs(p.ageStart), y: ys(p.score) }));
  const spacing = coords.length > 1 ? (coords[coords.length - 1].x - coords[0].x) / (coords.length - 1) : 999;
  const every = spacing >= 30 ? 1 : spacing >= 15 ? 2 : 3;
  let unitShown = false;
  coords.forEach((c, k) => {
    if (k % every !== 0) return;
    const t = unitShown ? String(c.ageStart) : `${c.ageStart} 歲`;
    const tw0 = textWidth(t, tickFs);
    const anchor = !unitShown && c.x - tw0 / 2 < 2 ? 'start' : 'middle';
    const tl = anchor === 'start' ? c.x : c.x - tw0 / 2;
    if (nowX != null && nowX > tl - 4 && nowX < tl + tw0 + 4) return;
    unitShown = true;
    parts.push(`<text class="zw-tick" x="${f(c.x)}" y="${f(plotBottom + 17)}" text-anchor="${anchor}" font-size="${tickFs}" fill="${COLORS.ink3}">${esc(t)}</text>`);
  });

  // 面積＋折線
  if (coords.length > 1) {
    const line = coords.map((c) => `${f(c.x)},${f(c.y)}`).join(' ');
    const area = `${f(coords[0].x)},${f(plotBottom)} ${line} ${f(coords[coords.length - 1].x)},${f(plotBottom)}`;
    parts.push(`<polygon class="zw-area" points="${area}" fill="${COLORS.accent}" fill-opacity="${AREA_OPACITY}"/>`);
    parts.push(`<polyline class="zw-line" points="${line}" fill="none" stroke="${COLORS.accent}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`);
  }

  // 目前年齡：重點色直線＋底部一列「你現在 虛歲 ○」（跟下面的說明一樣講虛歲，才不會以為算錯年紀）
  if (hasNow) {
    const x = nowX;
    parts.push(`<line class="zw-now" x1="${f(x)}" y1="${f(plotTop - 4)}" x2="${f(x)}" y2="${f(plotBottom + 22)}" stroke="${COLORS.highlight}" stroke-width="2" stroke-linecap="round"/>`);
    const t = `你現在 虛歲 ${now}`;
    const tw = textWidth(t, fs) + 2;
    let tx = x - tw / 2;
    tx = Math.min(W - 4 - tw, Math.max(4, tx));
    parts.push(`<text class="zw-now-label" x="${f(tx)}" y="${f(H - 7)}" font-size="${fs}" font-weight="700" fill="${COLORS.ink}">${esc(t)}</text>`);
  }

  // 最好／要留意：只從實際會走到的年紀裡挑（lifePicks），同分並列都標；全部同分就都不標
  const picks = lifePicks(coords, hasNow ? now : null);
  const flat = picks.flat;
  const bestSet = new Set(picks.best);
  const worstSet = new Set(picks.worst);
  const placed = [];
  const labelSvg = [];
  const leaders = [];
  // 標籤可以往上放到三段標籤的下面（不壓到它們）
  const bounds = { x0: plotL + 2, x1: W - 4, y0: bandTop + bandLabelH, y1: plotBottom - 2 };
  // 障礙物：其他標籤、所有資料點、折線每一段、目前年齡直線
  const segs = [];
  for (let k = 1; k < coords.length; k++) segs.push([coords[k - 1].x, coords[k - 1].y, coords[k].x, coords[k].y]);
  if (nowX != null) segs.push([nowX, plotTop - 4, nowX, plotBottom]);
  function segHits(sg, b) {
    const [x1, y1, x2, y2] = sg;
    const len = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.max(1, Math.ceil(len / 2));
    for (let t = 0; t <= steps; t++) {
      const px = x1 + ((x2 - x1) * t) / steps;
      const py = y1 + ((y2 - y1) * t) / steps;
      if (px > b.x - 2 && px < b.x + b.w + 2 && py > b.y - 2 && py < b.y + b.h + 2) return true;
    }
    return false;
  }
  // 壓到別的標籤最糟、再來是被折線穿過（線會劃過字），碰到別的點最輕
  function penalty(box) {
    let p = 0;
    for (const b of placed) if (overlaps(b, box, 3)) p += 1000;
    for (const sg of segs) if (segHits(sg, box)) p += 200;
    for (const o of coords) if (o.x > box.x - 7 && o.x < box.x + box.w + 7 && o.y > box.y - 7 && o.y < box.y + box.h + 7) p += 20;
    return p;
  }
  function placeLabel(c, lines, prefer) {
    const tw = Math.max(...lines.map((t) => textWidth(t, fs)));
    const th = fs * 1.25 * lines.length;
    const clampX = (xx) => Math.min(bounds.x1 - tw, Math.max(bounds.x0, xx));
    const fits = (yy) => yy >= bounds.y0 && yy + th <= bounds.y1;
    // 第一輪：點附近的幾個位置，照「離點近」的順序試，找到乾淨的就停
    const xOpts = [c.x - tw / 2, c.x + 10, c.x - 10 - tw, c.x + 10 - tw * 0.25, c.x - 10 - tw * 0.75, c.x + 24, c.x - 24 - tw];
    const dys = [8, 14, 20, 28, 38, 50, 64, 80];
    let bestBox = null;
    let bestP = Infinity;
    for (const d of dys) {
      const above = c.y - d - th;
      const below = c.y + d;
      for (const yy of prefer === 'above' ? [above, below] : [below, above]) {
        if (!fits(yy)) continue;
        for (const xx0 of xOpts) {
          const box = { x: clampX(xx0), y: yy, w: tw, h: th };
          const p = penalty(box);
          if (p < bestP) { bestP = p; bestBox = box; }
          if (p === 0) break;
        }
        if (bestP === 0) break;
      }
      if (bestP === 0) break;
    }
    // 第二輪：附近的位置都會被折線穿過，就整張圖掃一遍，找沒壓線的空位（離點最近的），再拉一條引線
    const distTo = (box) => Math.hypot(Math.min(box.x + box.w, Math.max(box.x, c.x)) - c.x, Math.min(box.y + box.h, Math.max(box.y, c.y)) - c.y);
    if (bestP >= 200) {
      let bestD = bestBox ? distTo(bestBox) : Infinity;
      for (let yy = bounds.y0; yy + th <= bounds.y1; yy += 3) {
        for (let xx = bounds.x0; xx + tw <= bounds.x1; xx += 4) {
          const box = { x: xx, y: yy, w: tw, h: th };
          const p = penalty(box);
          if (p > bestP) continue;
          const d = distTo(box);
          if (p < bestP || d < bestD) { bestP = p; bestD = d; bestBox = box; }
        }
      }
    }
    if (!bestBox) {
      const yy = Math.min(bounds.y1 - th, Math.max(bounds.y0, c.y - 10 - th));
      bestBox = { x: clampX(c.x - tw / 2), y: yy, w: tw, h: th };
    }
    placed.push(bestBox);
    // 標籤離點比較遠時，拉一條細引線，讓人看得出是哪一點
    const nx = Math.min(bestBox.x + bestBox.w, Math.max(bestBox.x, c.x));
    const ny = Math.min(bestBox.y + bestBox.h + 1, Math.max(bestBox.y - 1, c.y));
    const dist = Math.hypot(nx - c.x, ny - c.y);
    if (dist > 20) {
      const sx = c.x + ((nx - c.x) / dist) * 7;
      const sy = c.y + ((ny - c.y) / dist) * 7;
      leaders.push(`<line class="zw-leader" pointer-events="none" x1="${f(sx)}" y1="${f(sy)}" x2="${f(nx)}" y2="${f(ny)}" stroke="${COLORS.ink3}" stroke-width="1"/>`);
    }
    return bestBox;
  }
  // 寬度夠：一行「最好 36～45 歲 72 分」；窄螢幕：兩行（分數一行、年齡一行），比較不會撞到折線
  const compact = W < 520;
  const mkLines = (word, c) => (compact
    ? [`${word} ${num(c.score)} 分`, ageRangeText(c)]
    : [`${word} ${ageRangeText(c)} ${num(c.score)} 分`]);
  const textSvg = (cls, box, lines) => `<text class="${cls}" x="${f(box.x)}" y="${f(box.y + fs * 0.95)}" font-size="${fs}" font-weight="700" fill="${COLORS.ink}" pointer-events="none" ${HALO}>`
    + lines.map((t, k) => (k === 0 ? esc(t) : `<tspan x="${f(box.x)}" dy="${f(fs * 1.25)}" font-weight="400" fill="${COLORS.ink2}">${esc(t)}</tspan>`)).join('')
    + '</text>';
  if (!flat) {
    const MAX_LABELS = 3; // 同分太多時只標前 3 個（點一樣都是重點色）
    const bw = picks.best.length > 1 ? '並列最好' : '最好';
    for (const k of picks.best.slice(0, MAX_LABELS)) {
      const lines = mkLines(bw, coords[k]);
      labelSvg.push(textSvg('zw-best-label', placeLabel(coords[k], lines, 'above'), lines));
    }
    const ww = picks.worst.length > 1 ? '並列要留意' : '要留意';
    for (const k of picks.worst.slice(0, MAX_LABELS)) {
      const lines = mkLines(ww, coords[k]);
      labelSvg.push(textSvg('zw-worst-label', placeLabel(coords[k], lines, 'below'), lines));
    }
  }

  // 資料點（帶 data-tip）。可點範圍是整個「十年那一欄」（整個圖的高度），手指不用剛好點到小圓點
  const colW = coords.length > 1 ? spacing : Math.min(88, plotR - plotL);
  coords.forEach((c, k) => {
    const key = bestSet.has(k) ? ' zw-best' : worstSet.has(k) ? ' zw-worst' : '';
    const color = key ? COLORS.highlight : COLORS.accent;
    const tipParts = [ageRangeText(c)];
    if (c.palace) tipParts.push(`走${c.palace}`);
    tipParts.push(`${num(c.score)} 分`);
    if (c.summary) tipParts.push(c.summary);
    const hx0 = Math.max(plotL, c.x - colW / 2);
    const hx1 = Math.min(plotR, c.x + colW / 2);
    parts.push(`<g class="zw-pt${key}" data-age="${c.ageStart}" data-tip="${esc(tipParts.join('｜'))}" style="${TAP}">`
      + `<rect class="zw-hit" x="${f(hx0)}" y="${f(plotTop - 4)}" width="${f(hx1 - hx0)}" height="${f(plotBottom - plotTop + 8)}" fill="transparent"/>`
      + dot(c.x, c.y, key ? 5.5 : 4.5, color)
      + '</g>');
  });
  parts.push(...leaders, ...labelSvg);

  const ranges = (idx) => idx.map((k) => ageRangeText(coords[k])).join('、');
  let label = `${heading}：共 ${coords.length} 個大限（十年一運），分數 0 到 100。`;
  if (!flat) {
    label += `最好是 ${ranges(picks.best)}（${num(coords[picks.best[0]].score)} 分${picks.best.length > 1 ? '，並列' : ''}），`
      + `要留意 ${ranges(picks.worst)}（${num(coords[picks.worst[0]].score)} 分${picks.worst.length > 1 ? '，並列' : ''}）。`;
  } else if (picks.pool.length === coords.length) {
    label += `每個大限都是 ${num(coords[picks.pool[0]].score)} 分。`;
  } else {
    label += `${LIFE_PICK_MAX_START} 歲以前的大限都是 ${num(coords[picks.pool[0]].score)} 分。`;
  }
  if (hasNow) label += `你現在虛歲 ${now}。`;

  return svgOpen({ w: W, h: H, label, title: heading, cls: 'zw-life' }) + parts.join('') + '</svg>';
}

// ---------- 水平長條 ----------

function barPath(x, y, w, h) {
  if (w <= 0) return '';
  const r = Math.min(4, w, h / 2);
  return `M${f(x)},${f(y)}H${f(x + w - r)}A${f(r)},${f(r)} 0 0 1 ${f(x + w)},${f(y + r)}`
    + `V${f(y + h - r)}A${f(r)},${f(r)} 0 0 1 ${f(x + w - r)},${f(y + h)}H${f(x)}Z`;
}

/**
 * 水平長條圖：label 在左、值在長條末端；最大值那條（同分都算）用重點色
 * @param {{ items: {label:string,value:number,sub?:string}[], width?: number, max?: number, highlightMax?: boolean, title?: string }} opt
 */
export function barChart({ items = [], width = 520, max = 100, highlightMax = true, title = '' } = {}) {
  const W = sizeOr(width, 520, 240, 2000);
  const heading = String(title || '分數長條圖');
  const list = (Array.isArray(items) ? items : []).filter(Boolean).map((it) => ({
    label: String(it.label ?? ''),
    value: clampScore(it.value),
    sub: it.sub == null ? '' : String(it.sub).trim(),
  }));
  if (!list.length) return emptyChart(W, 120, heading, 'zw-bar');

  let M = Number(max);
  if (!Number.isFinite(M) || M <= 0) M = 100;
  M = Math.min(100, M);
  const top = Math.max(...list.map((it) => it.value));

  const fs = 14;
  const subFs = 12;
  const barH = 20;
  const valW = textWidth('100', 13) + 10;
  const labelW = Math.min(W * 0.4, Math.max(...list.map((it) => textWidth(it.label, fs))) + 14);
  const x0 = labelW;
  const barMax = W - x0 - valW - 4;
  const anySub = list.some((it) => it.sub);
  const rowH = anySub ? 50 : 34;

  const parts = [];
  let y = 6;
  // 基線
  const H = 6 + rowH * list.length + 4;
  parts.push(`<rect x="0" y="0" width="${f(W)}" height="${f(H)}" fill="${COLORS.surface}"/>`);
  parts.push(`<line class="zw-grid" x1="${f(x0)}" y1="2" x2="${f(x0)}" y2="${f(H - 2)}" stroke="${COLORS.grid}" stroke-width="1"/>`);
  list.forEach((it) => {
    const isHi = highlightMax && it.value === top && top > 0;
    const w = (Math.min(it.value, M) / M) * barMax;
    const by = y + 4;
    const lbl = truncate(it.label, fs, labelW - 10);
    const tip = `${it.label}｜${num(it.value)} 分${it.sub ? `｜${it.sub}` : ''}`;
    parts.push(`<g class="zw-bar-row${isHi ? ' zw-hi' : ''}" data-tip="${esc(tip)}">`
      + `<rect x="0" y="${f(y)}" width="${f(W)}" height="${f(rowH)}" fill="transparent"/>`
      + `<text class="zw-label" x="2" y="${f(by + barH / 2 + fs * 0.35)}" font-size="${fs}" fill="${COLORS.ink}"${isHi ? ' font-weight="700"' : ''}>${esc(lbl)}</text>`
      + (w > 0 ? `<path class="zw-bar" d="${barPath(x0, by, w, barH)}" fill="${isHi ? COLORS.highlight : COLORS.accent}"/>` : '')
      + `<text class="zw-value" x="${f(x0 + w + 6)}" y="${f(by + barH / 2 + 13 * 0.35)}" font-size="13" font-weight="700" fill="${COLORS.ink}">${esc(num(it.value))}</text>`
      + (it.sub ? `<text class="zw-sub" x="${f(x0 + 6)}" y="${f(by + barH + 17)}" font-size="${subFs}" fill="${COLORS.ink3}">${esc(truncate(it.sub, subFs, W - x0 - 8))}</text>` : '')
      + '</g>');
    y += rowH;
  });

  const label = `${heading}：` + list.map((it) => `${it.label} ${num(it.value)} 分`).join('、') + '。';
  return svgOpen({ w: W, h: H, label, title: heading, cls: 'zw-bar' }) + parts.join('') + '</svg>';
}

// ---------- 提示框（滑鼠滑過、手機點一下） ----------

/**
 * 讓 rootEl 裡帶 data-tip 的元素出現提示框。滑鼠：滑過出現、移開消失；
 * 觸控：點一下出現、點別處消失；鍵盤：Tab 到時出現、Esc 關掉。回傳 detach 函式。
 */
export function attachTooltips(rootEl) {
  if (!rootEl || typeof document === 'undefined') return () => {};
  const doc = rootEl.ownerDocument || document;
  const win = doc.defaultView || window;
  const tip = doc.createElement('div');
  tip.className = 'zw-tip';
  tip.setAttribute('role', 'tooltip');
  Object.assign(tip.style, {
    position: 'fixed', left: '0px', top: '0px', zIndex: '9999', display: 'none',
    maxWidth: 'min(280px, calc(100vw - 16px))', padding: '7px 10px', borderRadius: '6px',
    background: COLORS.ink, color: COLORS.surface, fontSize: '13px', lineHeight: '1.5',
    fontFamily: 'system-ui, "Microsoft JhengHei", "PingFang TC", sans-serif',
    boxShadow: '0 4px 14px rgba(0,0,0,.18)', pointerEvents: 'none', whiteSpace: 'normal',
    wordBreak: 'break-word',
  });
  doc.body.appendChild(tip);

  let current = null;
  let pinned = false;

  const findTip = (t) => {
    let el = t;
    while (el && el !== rootEl.parentNode) {
      if (el.nodeType === 1 && el.hasAttribute && el.hasAttribute('data-tip')) return rootEl.contains(el) ? el : null;
      el = el.parentNode;
    }
    return null;
  };

  function position(el, px, py) {
    const m = 8;
    const vw = win.innerWidth || doc.documentElement.clientWidth;
    const vh = win.innerHeight || doc.documentElement.clientHeight;
    let ax = px; let ay = py;
    if (ax == null || ay == null) {
      const r = el.getBoundingClientRect();
      ax = r.left + r.width / 2;
      ay = r.top + r.height / 2;
    }
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;
    let left = ax - tw / 2;
    let top = ay - th - 14;
    if (top < m) top = ay + 18;                 // 上面放不下就放下面
    left = Math.min(vw - m - tw, Math.max(m, left));
    top = Math.min(vh - m - th, Math.max(m, top));
    tip.style.left = `${Math.round(left)}px`;
    tip.style.top = `${Math.round(top)}px`;
  }

  function show(el, px, py) {
    current = el;
    tip.textContent = el.getAttribute('data-tip') || '';
    tip.style.display = 'block';
    position(el, px, py);
  }
  function hide() {
    current = null;
    pinned = false;
    tip.style.display = 'none';
  }

  const onOver = (e) => {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    if (pinned) return;
    const el = findTip(e.target);
    if (el) show(el, e.clientX, e.clientY);
  };
  const onMove = (e) => {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    if (pinned || !current) return;
    const el = findTip(e.target);
    if (el === current) position(el, e.clientX, e.clientY);
  };
  const onOut = (e) => {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    if (pinned) return;
    const from = findTip(e.target);
    const to = findTip(e.relatedTarget);
    if (from && from !== to) hide();
  };
  // 點一下（觸控或滑鼠點擊）：釘住提示；點別處：關掉
  let lastPointer = null;
  const onDown = (e) => { lastPointer = e.pointerType || null; };
  const onDocClick = (e) => {
    const el = findTip(e.target);
    const byMouse = lastPointer === 'mouse';
    lastPointer = null;
    if (el) {
      show(el, e.clientX || null, e.clientY || null);
      pinned = !byMouse;                       // 觸控才釘住；滑鼠移開就自然消失
    } else if (current) hide();
  };
  const onFocus = (e) => {
    const el = findTip(e.target);
    if (el) show(el);
  };
  const onBlur = (e) => {
    if (findTip(e.target) === current && !pinned) hide();
  };
  const onKey = (e) => { if (e.key === 'Escape' && current) hide(); };
  const onScroll = () => { if (current) hide(); };

  doc.addEventListener('pointerdown', onDown, true);
  rootEl.addEventListener('pointerover', onOver);
  rootEl.addEventListener('pointermove', onMove);
  rootEl.addEventListener('pointerout', onOut);
  rootEl.addEventListener('focusin', onFocus);
  rootEl.addEventListener('focusout', onBlur);
  doc.addEventListener('click', onDocClick, true);
  doc.addEventListener('keydown', onKey);
  win.addEventListener('scroll', onScroll, { passive: true });
  win.addEventListener('resize', onScroll);

  const detach = function detach() {
    doc.removeEventListener('pointerdown', onDown, true);
    rootEl.removeEventListener('pointerover', onOver);
    rootEl.removeEventListener('pointermove', onMove);
    rootEl.removeEventListener('pointerout', onOut);
    rootEl.removeEventListener('focusin', onFocus);
    rootEl.removeEventListener('focusout', onBlur);
    doc.removeEventListener('click', onDocClick, true);
    doc.removeEventListener('keydown', onKey);
    win.removeEventListener('scroll', onScroll);
    win.removeEventListener('resize', onScroll);
    if (tip.parentNode) tip.parentNode.removeChild(tip);
    current = null;
  };
  // 外部（例如打開宮位詳解時）要把提示框收起來，免得它浮在彈出層上面
  detach.hide = hide;
  return detach;
}
