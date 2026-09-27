/* 紫微斗數 免費排盤（網頁版）— 主程式
 * 全部在訪客自己的瀏覽器裡算：不連網、不存任何東西（沒有 cookie、沒有瀏覽器儲存、網址不帶生日）。
 * 重新整理就清空，這是故意的。
 */
import { buildChart } from './lib/chart.js?v=e69bf8b5';
import { analyze } from './lib/analyze.js?v=e69bf8b5';
import { renderReport } from './lib/report.js?v=e69bf8b5';
import { buildNarration } from './lib/narrate.js?v=e69bf8b5';
import { radarChart, palaceStarChart, lifeCurve, barChart, attachTooltips, extremes, topWithTies, lifePicks, LIFE_PICK_MAX_START } from './charts.js?v=e69bf8b5';
import { createSpeaker } from './speak.js?v=e69bf8b5';

/* ───────── 常數 ───────── */

// iztro 的時辰序號 0～12（0＝早子時、12＝晚子時）
const HOURS = [
  ['早子時', '00:00～00:59'], ['丑時', '01:00～02:59'], ['寅時', '03:00～04:59'], ['卯時', '05:00～06:59'],
  ['辰時', '07:00～08:59'], ['巳時', '09:00～10:59'], ['午時', '11:00～12:59'], ['未時', '13:00～14:59'],
  ['申時', '15:00～16:59'], ['酉時', '17:00～18:59'], ['戌時', '19:00～20:59'], ['亥時', '21:00～22:59'],
  ['晚子時', '23:00～23:59'],
];

const ASPECT_KEYS = ['事業', '財運', '家庭', '感情', '健康'];

// 文墨天機式 4×4：[列, 欄]，中間 2×2 是中宮
const GRID_POS = {
  巳: [1, 1], 午: [1, 2], 未: [1, 3], 申: [1, 4],
  辰: [2, 1], 酉: [2, 4],
  卯: [3, 1], 戌: [3, 4],
  寅: [4, 1], 丑: [4, 2], 子: [4, 3], 亥: [4, 4],
};

const TONE = { great: '#b8860b', good: '#2e7d5b', ok: '#4a5568', warn: '#b7791f', bad: '#9b2c2c' };
const PAT_LEVEL = { great: '上格', good: '吉格', mixed: '雙面', warn: '留意', bad: '留意' };

// 語音講稿參數（web contract 3.2）
const NARRATION_OPTS = {
  mode: 'brief',
  useChartName: false,
  speaker: '阿良',
  voiceKind: 'generic',
  disclosure: true,
  cta: '如果你最近有買房、換屋或置產的想法，歡迎點下面的 LINE 按鈕找我聊聊。',
};

/* ───────── 小工具 ───────── */

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));
const esc = (s) => String(s ?? '').replace(/[&<>"'`]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' }[c]));
// 宮名一律補「宮」，但不會變成「命宮宮」
const palName = (n) => (!n ? '' : (String(n).endsWith('宮') ? String(n) : String(n) + '宮'));
const samePalace = (a, b) => palName(a) === palName(b);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const toneOf = (lv) => TONE[lv && lv.tone] || TONE.ok;
const tradLunar = (s) => String(s ?? '').replace(/闰/g, '閏').replace(/腊/g, '臘');
const hasCjk = (s) => /[一-鿿]/.test(String(s || ''));

function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

function widthOf(el, fallback) {
  const w = el ? el.clientWidth : 0;
  return w > 0 ? w : fallback;
}

// 圖表畫壞不能拖垮整頁：包起來，失敗就顯示一行字
function chartHtml(fn) {
  try {
    const svg = fn();
    if (typeof svg === 'string' && svg.includes('<svg')) return svg;
  } catch (e) {
    console.warn('圖表產生失敗', e);
  }
  return '<p class="chart-empty">這張圖畫不出來，下面的文字說明一樣可以看。</p>';
}

function aspectList(an) {
  return ASPECT_KEYS.map((k) => an.aspects[k]).filter(Boolean);
}

/* ───────── 狀態（只在記憶體，重新整理就沒了） ───────── */

let cur = null; // { chart, analysis, narration, nick }
let aspectKey = ASPECT_KEYS[0];
const detach = {};
let lastSheetFocus = null;

/* ───────── 初始化 ───────── */

function init() {
  const hSel = $('#f-h');
  hSel.innerHTML = '<option value="">請選擇時辰</option>' +
    HOURS.map(([n, r], i) => `<option value="${i}">${esc(n)}（${esc(r)}）</option>`).join('');

  $('#f-m').innerHTML = '<option value="">--</option>' +
    Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('');
  fillDays();

  $$('input[name="zw-cal"]').forEach((r) => r.addEventListener('change', onCalendarChange));
  $('#f-y').addEventListener('input', fillDays);
  $('#f-m').addEventListener('change', fillDays);
  $('#birth-form').addEventListener('submit', (e) => { e.preventDefault(); startChart(); });

  // 宮位詳解：十二宮星狀圖、宮位按鈕、命盤格子，全部用同一個入口
  for (const id of ['#palace-star', '#palace-list', '#grid']) {
    $(id).addEventListener('click', (e) => {
      const t = e.target.closest('[data-palace]');
      if (t) openPalace(t.getAttribute('data-palace'));
    });
    $(id).addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const t = e.target.closest('[data-palace]');
      if (t && t.tagName !== 'BUTTON') { e.preventDefault(); openPalace(t.getAttribute('data-palace')); }
    });
  }

  $('#sheet').addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeSheet(); });
  document.addEventListener('keydown', onSheetKey);

  $('#aspect-tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-aspect]');
    if (b) selectAspect(b.getAttribute('data-aspect'), false);
  });
  $('#aspect-tabs').addEventListener('keydown', onTabKey);

  $('#btn-report').addEventListener('click', openReport);

  // 圖表提示框：整個結果區只掛一次（雷達、長條、十二宮、曲線都有 data-tip，重畫圖也不用重掛）
  try { detach.tips = attachTooltips($('#result')); } catch (e) { console.warn('提示框掛載失敗', e); }

  // 「改生日重新排」：回到輸入卡、游標放在年份
  $('#result').addEventListener('click', (e) => {
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (e.target.closest('[data-goto="cta"]')) {
      $('#cta-card').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      return;
    }
    const b = e.target.closest('[data-redo]');
    if (!b) return;
    $('#form-card').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    try { $('#f-y').focus({ preventScroll: true }); } catch { /* 舊瀏覽器 */ }
  });

  initVoice();

  let lastW = document.documentElement.clientWidth;
  window.addEventListener('resize', debounce(() => {
    const w = document.documentElement.clientWidth;
    if (!cur || Math.abs(w - lastW) < 24) return;
    lastW = w;
    renderCharts();
  }, 200));

  const boot = $('#boot-note');
  if (boot) boot.remove();
}

function calendarVal() {
  const r = $('input[name="zw-cal"]:checked');
  return r ? r.value : 'solar';
}
function genderVal() {
  const r = $('input[name="zw-gender"]:checked');
  return r ? r.value : '男';
}

function onCalendarChange() {
  const lunar = calendarVal() === 'lunar';
  $('#leap-wrap').hidden = !lunar;
  if (!lunar) $('#f-leap').checked = false;
  $('#cal-help').textContent = lunar
    ? '農曆年份也用西元填，例如 1985；農曆每月最多 30 天。'
    : '西元年份，例如 1985（民國 74 年＋1911）。支援 1900～2100 年。';
  fillDays();
}

// 日期下拉：國曆依年月算天數（避免 2 月 30 日），農曆最多 30 天
function fillDays() {
  const sel = $('#f-d');
  const keep = sel.value;
  let max = 31;
  if (calendarVal() === 'lunar') max = 30;
  else {
    const y = Number($('#f-y').value);
    const m = Number($('#f-m').value);
    if (m >= 1 && m <= 12) max = (y >= 1900 && y <= 2100) ? new Date(y, m, 0).getDate() : [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
  }
  sel.innerHTML = '<option value="">--</option>' +
    Array.from({ length: max }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('');
  if (keep && Number(keep) <= max) sel.value = keep;
}

/* ───────── 排盤 ───────── */

function formError(text) {
  const el = $('#form-err');
  el.textContent = text || '';
  el.hidden = !text;
}

function cleanNick(s) {
  return String(s || '').replace(/[\u0000-\u001f\u007f<>{}[\]\\/"'`&;|$]/g, '').trim().slice(0, 12);
}

// 今天（只看年月日）；生日比今天晚就是還沒出生，排出來的年齡會是負的
function todayStart() {
  const t = new Date();
  return new Date(t.getFullYear(), t.getMonth(), t.getDate());
}
const NOT_BORN = '這個生日比今天還晚，還沒出生沒辦法排流年與年齡。請確認年份有沒有填錯（要填西元年）。';

function readForm() {
  const yRaw = $('#f-y').value.trim();
  const note = '';
  // 台灣很多人只記得民國年：1～3 位數就提醒怎麼換算（不自動換：85 也可能是 1985 的簡寫，排錯年更糟）
  if (/^\d{1,3}$/.test(yRaw) && Number(yRaw) >= 1 && Number(yRaw) <= 189) {
    const roc = Number(yRaw);
    return { error: `出生年請填西元四位數。你填的 ${roc} 如果是民國 ${roc} 年，西元是 ${roc + 1911} 年，請改填 ${roc + 1911}。` };
  }
  const y = Number(yRaw);
  const m = Number($('#f-m').value);
  const d = Number($('#f-d').value);
  const hRaw = $('#f-h').value;
  const calendar = calendarVal();
  if (!/^\d{4}$/.test(yRaw) || y < 1900 || y > 2100) return { error: '請填出生年（西元四位數，1900～2100），例如 1985（民國 74 年）。' };
  if (!m) return { error: '請選擇出生月份。' };
  if (!d) return { error: '請選擇出生日期。' };
  if (hRaw === '') return { error: '請選擇出生時辰。不確定的話，先選最接近的。' };
  if (calendar === 'solar') {
    const dt = new Date(y, m - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) {
      return { error: `國曆 ${y} 年 ${m} 月沒有 ${d} 日，請再確認一次。` };
    }
    if (dt > todayStart()) return { error: NOT_BORN };
  } else if (y > todayStart().getFullYear()) {
    return { error: NOT_BORN };
  }
  return {
    note,
    input: {
      name: cleanNick($('#f-nick').value),
      gender: genderVal(),
      calendar,
      isLeap: calendar === 'lunar' && $('#f-leap').checked,
      date: `${y}-${m}-${d}`,
      hourIndex: Number(hRaw),
    },
    y, m, d,
  };
}

// 從農曆字串（例：一九八五年四月廿七）取出「日」的數字，用來抓「這個月沒有 30 日」
function lunarDayOf(str) {
  const t = String(str || '').slice(-2);
  const N = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  if (t === '初十') return 10;
  if (t === '二十') return 20;
  if (t === '三十') return 30;
  if (t[0] === '初' && N[t[1]]) return N[t[1]];
  if (t[0] === '十' && N[t[1]]) return 10 + N[t[1]];
  if (t[0] === '廿' && N[t[1]]) return 20 + N[t[1]];
  return 0;
}

// 新的一次排盤失敗時，把上一個人的結果收起來，免得把舊結果看成新結果（例如幫家人排）
function clearResult() {
  if (!cur) return;
  cur = null;
  try { V.speaker && V.speaker.stop(); } catch { /* 忽略 */ }
  try { if (detach.tips && detach.tips.hide) detach.tips.hide(); } catch { /* 忽略 */ }
  closeSheet();
  $('#result').hidden = true;
}

function chartFail(text) {
  clearResult();
  formError(text);
  // 錯誤訊息在表單裡；結果收起來後畫面可能停在很下面，拉回來讓人看得到
  const el = $('#form-err');
  if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: 'center' });
}

function startChart() {
  formError('');
  const f = readForm();
  if (f.error) { chartFail(f.error); return; }
  const btn = $('#btn-go');
  btn.disabled = true;
  btn.textContent = '排盤中…';
  // 讓「排盤中」先畫出來再算
  setTimeout(() => {
    try { runChart(f); } finally {
      btn.disabled = false;
      btn.textContent = '開始排盤';
    }
  }, 20);
}

function runChart(f) {
  const { input, y, m, d } = f;
  let chart;
  let analysis;
  try {
    chart = buildChart(input);
    analysis = analyze(chart);
  } catch (e) {
    const msg = String((e && e.message) || '');
    // iztro 對「農曆小月填了 30 日」丟英文訊息：only 29 days in lunar year 2023 month 3（閏月是 month -6）
    const short = msg.match(/only (\d+) days in lunar year (\d+) month (-?\d+)/i);
    if (short) {
      const leap = Number(short[3]) < 0 || input.isLeap;
      chartFail(`農曆 ${y} 年${leap ? '閏' : ''} ${m} 月只有 ${short[1]} 天，沒有 ${d} 日，請再確認一次。`);
      return;
    }
    chartFail(hasCjk(msg) ? `排盤沒有成功：${msg.replace(/[。．.]+$/, '')}。` : '排盤沒有成功：請確認日期與時辰是否正確。');
    return;
  }

  const notes = [];
  if (f.note) notes.push(f.note);
  if (input.calendar === 'lunar') {
    const ld = lunarDayOf(tradLunar(chart.lunarDate));
    if (ld && ld !== d) {
      chartFail(`農曆 ${y} 年${input.isLeap ? '閏' : ''} ${m} 月沒有 ${d} 日，請再確認一次。`);
      return;
    }
    if (input.isLeap && !/[闰閏]/.test(String(chart.lunarDate))) {
      notes.push(`農曆 ${y} 年沒有閏 ${m} 月，這次是用一般的 ${m} 月來排。`);
    }
    // 農曆換成國曆後才知道是不是還沒到
    const sd = String(chart.solarDate || '').match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (sd && new Date(Number(sd[1]), Number(sd[2]) - 1, Number(sd[3])) > todayStart()) {
      chartFail(NOT_BORN);
      return;
    }
  }
  const note = notes.join('');

  let narration = null;
  try {
    narration = buildNarration(chart, analysis, { ...NARRATION_OPTS, callName: input.name });
  } catch (e) {
    console.warn('講稿產生失敗', e);
  }

  cur = { chart, analysis, narration, nick: input.name };
  aspectKey = ASPECT_KEYS[0];
  const result = $('#result');
  result.hidden = false;
  renderAll(note);

  const ov = $('#ov');
  try { ov.focus({ preventScroll: true }); } catch { /* 舊瀏覽器 */ }
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  ov.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
}

/* ───────── 畫面 ───────── */

function renderAll(note) {
  renderOverview(note);
  renderPalaceList();
  renderGrid();
  renderAspectTabs();
  renderCareers();
  renderStages();
  renderYearly();
  renderCharts();
  loadVoice();
  $('#r-msg').textContent = '';
}

// 先一次讀完所有容器寬度（只觸發一次版面計算），再一口氣寫入圖表；
// 不要「讀一次、寫一次、再讀」，那樣手機上每張圖都要重排整頁，會卡一秒多
function renderCharts() {
  if (!cur) return;
  const w = {
    radar: widthOf($('#radar-box'), 320),
    abar: widthOf($('#abar-box'), 320),
    star: widthOf($('#palace-star'), 330),
    curve: widthOf($('#life-curve'), 340),
    career: widthOf($('#career-bars'), 320),
  };
  renderAspectCharts(w);
  renderPalaceStar(w);
  renderLifeCurve(w);
  renderCareerBars(w);
}

// 同分並列的寫法：【事業 72】、【財運 72】
const bracketList = (items) => items.map((a) => `【${esc(a.key)} ${a.score}】`).join('、');

function aspectExtremes(an) {
  const list = aspectList(an);
  const ex = extremes(list.map((a) => a.score));
  return { list, ex, hi: ex.max.map((i) => list[i]), lo: ex.min.map((i) => list[i]) };
}

function renderOverview(note) {
  const an = cur.analysis;
  const o = an.overview;
  const { list, ex, hi, lo } = aspectExtremes(an);
  let line = '';
  if (list.length && !ex.flat) {
    line = `你最強的是<b>${bracketList(hi)}</b>${hi.length > 1 ? '（並列）' : ''}，`
      + `最需要留心的是<b class="low">${bracketList(lo)}</b>${lo.length > 1 ? '（並列）' : ''}`;
  } else if (list.length) {
    line = `五個面向都是 ${list[0].score} 分，走勢相對平均，沒有特別偏向哪一面。`;
  }
  const pats = an.patterns || [];
  $('#ov').innerHTML = `
    <h2 id="ov-h" class="card-h">命盤總覽</h2>
    ${note ? `<p class="info-note" role="status">${esc(note)}</p>` : ''}
    <p class="ov-who">${cur.nick ? `${esc(cur.nick)}，` : ''}你是 <strong>${esc(o.title)}</strong></p>
    <div class="ov-meta">
      <span class="pill" style="background:${toneOf(o.level)}">命宮 ${o.score} 分・${esc(o.level && o.level.label)}</span>
      ${o.bodyPalace ? `<span>身宮在${esc(palName(o.bodyPalace))}</span>` : ''}
    </div>
    ${o.keywords && o.keywords.length ? `<div class="tags" aria-label="關鍵字">${o.keywords.map((k) => `<span>${esc(k)}</span>`).join('')}</div>` : ''}
    ${line ? `<p class="ov-line">${line}</p>` : ''}
    <details class="more">
      <summary>看命格詳細解說</summary>
      <div class="prose">
        ${(o.paragraphs || []).map((t) => `<p>${esc(t)}</p>`).join('')}
        ${o.soulText ? `<p>${esc(o.soulText)}</p>` : ''}
        ${o.shenText ? `<p>${esc(o.shenText)}</p>` : ''}
      </div>
    </details>
    ${pats.length ? `<details class="more">
      <summary>命盤格局（${pats.length} 個）</summary>
      ${pats.map((p) => `<div class="pat ${esc(p.level)}"><b>${esc(p.name)}</b>
        <span class="pill" style="background:${p.level === 'great' ? TONE.great : p.level === 'good' ? TONE.good : p.level === 'mixed' ? TONE.warn : TONE.bad};margin-left:6px">${esc(PAT_LEVEL[p.level] || '')}</span>
        <p>${esc(p.desc)}</p></div>`).join('')}
    </details>` : ''}
    <p class="redo"><button type="button" class="btn-text" data-redo>改生日重新排（也可以幫家人排）</button></p>`;
}

function renderAspectCharts(w) {
  const an = cur.analysis;
  const { list, ex, hi } = aspectExtremes(an);
  const axes = ASPECT_KEYS.map((k) => ({ key: k, label: k, value: an.aspects[k] ? an.aspects[k].score : 0 }));
  // 同分就一起標金色；五個都一樣就都不標
  const highlightKey = hi.map((a) => a.key);
  $('#radar').innerHTML = chartHtml(() => radarChart({ axes, size: Math.round(clamp(w.radar, 240, 340)), title: '五大面向分數', highlightKey }));
  const sorted = list.slice().sort((a, b) => b.score - a.score);
  const items = sorted.map((a) => ({ label: a.key, value: a.score, sub: a.level && a.level.label }));
  $('#aspect-bars').innerHTML = chartHtml(() => barChart({ items, width: Math.round(clamp(w.abar, 260, 520)), max: 100, highlightMax: !ex.flat, title: '五大面向分數排序' }));
  const cap = $('#abar-note');
  if (cap) {
    cap.textContent = ex.flat
      ? '由高到低排序；五個面向同分，所以沒有標金色'
      : hi.length > 1 ? '由高到低排序，金色是分數最高的（同分並列）' : '由高到低排序，金色是分數最高的一項';
  }
}

function topPalaceNames(an, n) {
  return topWithTies(an.palaces.map((p) => p.score), n).map((i) => an.palaces[i].name);
}

function renderPalaceStar(w) {
  const an = cur.analysis;
  const palaces = an.palaces.map((p) => ({ name: p.name, score: p.score }));
  const want = Math.round(clamp(w.star, 260, 360));
  // 星狀圖會為了放宮名把畫布撐寬，再被縮回容器寬 → 點和字都變小。
  // 先量一次撐寬多少，再用小一點的尺寸重畫，讓實際顯示接近 1:1。
  let svg = chartHtml(() => palaceStarChart({ palaces, size: want, top: 3 }));
  const vb = svg.match(/viewBox="[-\d.]+ [-\d.]+ ([\d.]+) /);
  const vbW = vb ? Number(vb[1]) : 0;
  if (vbW > w.star + 1) {
    const smaller = Math.max(240, Math.floor(want * (w.star / vbW)));
    if (smaller < want) svg = chartHtml(() => palaceStarChart({ palaces, size: smaller, top: 3 }));
  }
  $('#palace-star').innerHTML = svg;
  // 圖上的點也要能用鍵盤點
  $$('#palace-star [data-palace]').forEach((el) => {
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
    if (!el.hasAttribute('role')) el.setAttribute('role', 'button');
    el.style.cursor = 'pointer';
  });
}

function renderPalaceList() {
  const an = cur.analysis;
  const top = new Set(topPalaceNames(an, 3));
  $('#palace-list').innerHTML = an.palaces.map((p) => `<button type="button" class="pl-btn${top.has(p.name) ? ' top' : ''}" data-palace="${esc(p.name)}" aria-label="${esc(palName(p.name))} ${p.score} 分，看詳解">
      <span class="pl-n"><i class="dot" aria-hidden="true"></i>${esc(palName(p.name))}</span><span class="pl-s">${p.score}</span></button>`).join('');
}

function sortedDecadals(an) {
  return (an.decadals || []).slice().sort((a, b) => a.ageRange[0] - b.ageRange[0]);
}

// 虛歲：還沒出生（<= 0）或算不出來就當作沒有
function ageNow(an) {
  const a = an && an.year ? Number(an.year.ageName) : NaN;
  return Number.isFinite(a) && a > 0 ? a : null;
}

// 最好／要留意的十年：跟曲線圖同一個規則（只看 85 歲以前或目前年齡以前開始的大限，同分並列）
function decadePicks(decs, age) {
  const p = lifePicks(decs.map((d) => ({ ageStart: d.ageRange[0], score: d.score })), age);
  return { best: p.best.map((i) => decs[i]), worst: p.worst.map((i) => decs[i]), flat: p.flat, pool: p.pool.map((i) => decs[i]) };
}

function renderLifeCurve(w) {
  const an = cur.analysis;
  const decs = sortedDecadals(an);
  const points = decs.map((d) => ({
    ageStart: d.ageRange[0], ageEnd: d.ageRange[1], score: d.score, palace: palName(d.palaceName), summary: d.summary,
  }));
  const age = ageNow(an);
  const box = $('#life-curve');
  box.innerHTML = chartHtml(() => lifeCurve({ points, currentAge: age, width: Math.round(clamp(w.curve, 300, 680)), height: w.curve < 500 ? 240 : 260 }));

  const notes = [];
  if (decs.length) {
    const pk = decadePicks(decs, age);
    const seg = (d) => `${d.ageRange[0]}～${d.ageRange[1]} 歲（${esc(palName(d.palaceName))}，${d.score} 分）`;
    const segs = (arr) => arr.map((d) => `${seg(d)}：${esc(d.summary)}`).join('；');
    const gold = '<i class="sw" style="background:#b8860b" aria-hidden="true"></i>';
    if (!pk.flat) {
      notes.push(`<li>${gold}<span><span class="k">${pk.best.length > 1 ? '並列最好的十年' : '最好的十年'}</span> ${segs(pk.best)}</span></li>`);
      notes.push(`<li>${gold}<span><span class="k">${pk.worst.length > 1 ? '並列最需留意的十年' : '最需留意的十年'}</span> ${segs(pk.worst)}</span></li>`);
    } else if (pk.pool.length) {
      notes.push(`<li>${gold}<span><span class="k">每個十年</span> 分數都是 ${pk.pool[0].score} 分，起伏不大。</span></li>`);
    }
    if (age !== null) {
      const now = decs.find((d) => age >= d.ageRange[0] && age <= d.ageRange[1]);
      if (now) notes.push(`<li><i class="sw" style="background:#23211d" aria-hidden="true"></i><span><span class="k">你現在</span> 虛歲 ${age}，正走 ${seg(now)}：${esc(now.summary)}</span></li>`);
      else if (decs[0] && age < decs[0].ageRange[0]) notes.push(`<li><i class="sw" style="background:#23211d" aria-hidden="true"></i><span><span class="k">你現在</span> 虛歲 ${age}，大限（十年一運）從 ${decs[0].ageRange[0]} 歲才開始起算。</span></li>`);
    }
    notes.push(`<li class="fine"><span>圖上的年齡都是虛歲。最好／要留意只從 ${LIFE_PICK_MAX_START} 歲以前開始的十年裡挑，更後面的點一樣畫出來給你參考。</span></li>`);
  }
  $('#curve-notes').innerHTML = notes.join('');
}

function renderCareerBars(w) {
  const box = $('#career-bars');
  if (!box) return;
  const top = (cur.analysis.careers && cur.analysis.careers.top) || [];
  if (!top.length) { box.innerHTML = ''; return; }
  const items = top.map((c) => ({ label: c.category, value: c.score }));
  box.innerHTML = chartHtml(() => barChart({ items, width: Math.round(clamp(w.career, 260, 520)), max: 100, highlightMax: true, title: `適合的工作類型（前 ${top.length} 名）` }));
}

/* ───────── 命盤 4×4 ───────── */

function starHtml(s, cls) {
  return `<span class="st ${cls}">${esc(s.name)}` +
    (s.brightness ? `<i>${esc(s.brightness)}</i>` : '') +
    (s.mutagen ? `<b class="hua hua-${esc(s.mutagen)}">${esc(s.mutagen)}</b>` : '') + '</span>';
}

function renderGrid() {
  const c = cur.chart;
  const an = cur.analysis;
  const cells = c.palaces.map((p) => {
    const pos = GRID_POS[p.earthlyBranch];
    if (!pos) return '';
    const det = an.palaces.find((x) => x.name === p.name);
    const dec = p.decadal && p.decadal.range ? `${p.decadal.range[0]}-${p.decadal.range[1]}` : '';
    const others = p.minorStars.length + p.adjectiveStars.length;
    const majorNames = p.majorStars.map((s) => s.name).join('、') || '空宮';
    const label = `${palName(p.name)}${p.isBodyPalace ? '（身宮）' : ''}，${det ? `${det.score} 分，` : ''}主星：${majorNames}。點開看詳解`;
    return `<button type="button" class="cell${p.name === '命宮' ? ' is-ming' : ''}" data-palace="${esc(p.name)}" style="grid-row:${pos[0]};grid-column:${pos[1]}" aria-label="${esc(label)}">
      <span class="cell-stars">
        <span class="majors">${p.majorStars.map((s) => starHtml(s, 'major')).join('') || '<span class="st empty">空宮</span>'}</span>
        <span class="minors">${p.minorStars.map((s) => starHtml(s, 'minor')).join('')}</span>
        <span class="adjs">${p.adjectiveStars.slice(0, 8).map((s) => `<span class="st adj">${esc(s.name)}</span>`).join('')}</span>
        ${others ? `<span class="more-stars">另有 ${others} 顆星</span>` : ''}
      </span>
      <span class="cell-foot">
        <span class="foot-l"><span>${esc(dec)}</span><span class="cs">${esc(p.changsheng12 || '')}</span><span>${esc(p.heavenlyStem)}${esc(p.earthlyBranch)}</span></span>
        <span class="foot-r"><span class="pname${p.isBodyPalace ? ' body' : ''}">${esc(p.name)}${p.isBodyPalace ? '·身' : ''}</span>${det ? `<span class="pscore" style="color:${toneOf(det.level)}">${det.score}</span>` : ''}</span>
      </span></button>`;
  }).join('');

  const o = an.overview;
  const center = `<div class="cell center">
    <div class="c-name">${esc(cur.nick || '你的命盤')}</div>
    <div class="c-row"><span>性別</span><b>${esc(c.gender)}</b><span>生肖</span><b>${esc(c.zodiac)}</b></div>
    <div class="c-row"><span>國曆</span><b>${esc(c.solarDate)} ${esc(c.time)}</b></div>
    <div class="c-row"><span>農曆</span><b>${esc(tradLunar(c.lunarDate))}</b></div>
    <div class="c-row wide"><span>四柱</span><b>${esc(c.chineseDate)}</b></div>
    <div class="c-row"><span>五行局</span><b>${esc(c.fiveElementsClass)}</b></div>
    <div class="c-row"><span>命主</span><b>${esc(c.soul)}</b><span>身主</span><b>${esc(c.body)}</b></div>
    <div class="c-main">${esc(o.title)}　${o.score} 分</div>
  </div>`;
  $('#grid').innerHTML = cells + center;
}

/* ───────── 宮位詳解（底部彈出層） ───────── */

function findPalace(name) {
  if (!cur) return null;
  return cur.analysis.palaces.find((p) => p.name === name || p.full === name || samePalace(p.name, name)) || null;
}

function openPalace(name) {
  const p = findPalace(name);
  if (!p) return;
  const raw = cur.chart.palaces.find((x) => x.name === p.name);
  const dec = raw && raw.decadal && raw.decadal.range ? `大限 ${raw.decadal.range[0]}～${raw.decadal.range[1]} 歲` : '';
  const meta = [`${p.stem || ''}${p.branch || ''}`, p.role, dec].filter(Boolean).join('・');
  const majors = (p.majorStars || []).map((s) => starHtml(s, 'major')).join('');
  const minors = (p.minorStars || []).map((s) => starHtml(s, 'minor')).join('');
  const adjs = (p.adjectiveStars || []).map((s) => `<span class="st adj">${esc(s.name)}</span>`).join('');
  // 提示框不要浮在彈出層上面
  try { if (detach.tips && detach.tips.hide) detach.tips.hide(); } catch { /* 忽略 */ }
  // 標題與 × 在固定不動的頂列（捲到底也看得到），內文最後再放一顆「關閉」
  $('#sheet-title').textContent = `${palName(p.name)}${p.isBody ? '（身宮）' : ''}`;
  $('#sheet-body').innerHTML = `
    <p class="sh-meta">${esc(meta)}</p>
    <p><span class="pill" style="background:${toneOf(p.level)}">${p.score} 分・${esc(p.level && p.level.label)}</span></p>
    <p class="sh-meta" style="margin-top:8px">${esc(p.meaning)}</p>
    <div class="sh-stars">
      <div class="row"><span class="lab">主星</span>${majors || `<span class="st adj">本宮無主星${p.borrowed ? '，借對宮來看' : ''}</span>`}</div>
      ${minors ? `<div class="row"><span class="lab">輔星</span>${minors}</div>` : ''}
      ${adjs ? `<div class="row"><span class="lab">雜曜</span>${adjs}</div>` : ''}
    </div>
    <div class="prose">${(p.paragraphs || []).map((t) => `<p>${esc(t)}</p>`).join('')}</div>
    <button type="button" class="btn-ghost sh-close" data-close>關閉</button>`;
  const sheet = $('#sheet');
  if (sheet.hidden) lastSheetFocus = document.activeElement;
  sheet.hidden = false;
  document.body.classList.add('no-scroll');
  const panel = $('.sheet-panel', sheet);
  panel.scrollTop = 0;
  try { panel.focus({ preventScroll: true }); } catch { panel.focus(); }
}

function closeSheet() {
  const sheet = $('#sheet');
  if (sheet.hidden) return;
  sheet.hidden = true;
  document.body.classList.remove('no-scroll');
  if (lastSheetFocus && typeof lastSheetFocus.focus === 'function') {
    try { lastSheetFocus.focus({ preventScroll: true }); } catch { /* 忽略 */ }
  }
  lastSheetFocus = null;
}

function onSheetKey(e) {
  const sheet = $('#sheet');
  if (sheet.hidden) return;
  if (e.key === 'Escape') { e.preventDefault(); closeSheet(); return; }
  if (e.key === 'Tab') {
    // 焦點留在彈出層裡
    const panel = $('.sheet-panel', sheet);
    const f = $$('button, a[href], [tabindex]:not([tabindex="-1"])', panel);
    if (!f.length) { e.preventDefault(); return; }
    const first = f[0];
    const last = f[f.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === panel)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    else if (!panel.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
  }
}

/* ───────── 五大面向詳解（分頁） ───────── */

function renderAspectTabs() {
  const an = cur.analysis;
  $('#aspect-tabs').innerHTML = ASPECT_KEYS.filter((k) => an.aspects[k]).map((k) => {
    const on = k === aspectKey;
    return `<button type="button" class="tab" role="tab" id="tab-${esc(k)}" data-aspect="${esc(k)}" aria-selected="${on}" aria-controls="aspect-body" tabindex="${on ? 0 : -1}">${esc(k)}<small>${an.aspects[k].score} 分</small></button>`;
  }).join('');
  renderAspectBody();
}

function selectAspect(k, focus) {
  if (!cur || !cur.analysis.aspects[k]) return;
  aspectKey = k;
  $$('#aspect-tabs .tab').forEach((b) => {
    const on = b.getAttribute('data-aspect') === k;
    b.setAttribute('aria-selected', String(on));
    b.tabIndex = on ? 0 : -1;
    if (on && focus) b.focus();
  });
  renderAspectBody();
}

function onTabKey(e) {
  const keys = ASPECT_KEYS.filter((k) => cur && cur.analysis.aspects[k]);
  const i = keys.indexOf(aspectKey);
  let n = -1;
  if (e.key === 'ArrowRight') n = (i + 1) % keys.length;
  else if (e.key === 'ArrowLeft') n = (i - 1 + keys.length) % keys.length;
  else if (e.key === 'Home') n = 0;
  else if (e.key === 'End') n = keys.length - 1;
  if (n < 0) return;
  e.preventDefault();
  selectAspect(keys[n], true);
}

function renderAspectBody() {
  const a = cur.analysis.aspects[aspectKey];
  const body = $('#aspect-body');
  if (!a) { body.innerHTML = ''; return; }
  body.setAttribute('aria-labelledby', `tab-${aspectKey}`);
  const paras = a.paragraphs || [];
  const head = paras.slice(0, 2);
  const rest = paras.slice(2);
  body.innerHTML = `
    <div class="asp-head">
      <span class="t">${esc(a.key)}</span>
      <span class="sc" style="color:${toneOf(a.level)}">${a.score}<small>分</small></span>
      <span class="pill" style="background:${toneOf(a.level)}">${esc(a.level && a.level.label)}</span>
    </div>
    <p class="asp-meta">主看${esc(palName(a.mainPalace))}・${esc(a.mainPalaceDesc)}</p>
    <div class="prose">${head.map((t) => `<p>${esc(t)}</p>`).join('')}</div>
    ${rest.length ? `<details class="more"><summary>看完整解說（還有 ${rest.length} 段）</summary><div class="prose">${rest.map((t) => `<p>${esc(t)}</p>`).join('')}</div></details>` : ''}
    <div class="two">
      <div class="box good"><h3>優勢</h3><ul>${(a.strengths || []).map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>
      <div class="box risk"><h3>風險</h3><ul>${(a.risks || []).map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>
    </div>
    <div class="box act"><h3>現在可以做的事</h3><ol>${(a.actions || []).map((t) => `<li>${esc(t)}</li>`).join('')}</ol></div>
    ${(a.refs || []).length ? `<details class="more"><summary>一起參考的宮位</summary><ul class="refs">
      ${a.refs.map((r) => `<li><b>${esc(palName(r.palace))}</b><span>${esc(r.role)}</span><span>${esc(r.stars)}</span><span class="r-s">${r.score}（${esc(r.level)}）</span></li>`).join('')}
    </ul></details>` : ''}`;
}

/* ───────── 適合的工作 ───────── */

function renderCareers() {
  const c = cur.analysis.careers || { top: [], avoid: [], guanStars: [] };
  const guan = (c.guanStars || []).join('、') || '空宮';
  // 名次照分數算（同分同名次），跟長條圖「同分都金色」一致
  const rankOf = (r) => 1 + c.top.filter((x) => x.score > r.score).length;
  const sameScore = (r) => c.top.filter((x) => x.score === r.score).length > 1;
  const tied = c.top.filter((x) => rankOf(x) === 1).length > 1;
  $('#careers').innerHTML = `
    <h2 id="car-h" class="card-h">適合的工作</h2>
    <p class="card-sub">依官祿宮、命宮、財帛宮的星曜加權排序。官祿宮主星：<b>${esc(guan)}</b>${c.borrowed && c.borrowedFrom ? `（本宮無主星，借${esc(palName(c.borrowedFrom))}來看）` : ''}</p>
    ${c.top.length ? `<figure class="chart-box"><div class="chart" id="career-bars"></div>
      <figcaption class="chart-note">前 ${c.top.length} 類，${tied ? '金色是分數最高的（同分並列）' : '金色是分數最高的一類'}</figcaption></figure>
    <ol class="jobs">
      ${c.top.map((r) => `<li class="${rankOf(r) === 1 ? 'top' : ''}">
        <div class="j-h"><span class="j-rank">${sameScore(r) ? '並列 ' : ''}${rankOf(r)}</span><span class="j-cat">${esc(r.category)}</span><span class="j-sc">${r.score} 分</span></div>
        <p class="j-list">${esc((r.jobs || []).join('、'))}</p>
        <p class="j-why">${esc(r.reason)}</p></li>`).join('')}
    </ol>` : '<p class="card-sub">這張命盤沒有明顯對應的行業類型，重點在於選一個能長期累積的領域。</p>'}
    ${(c.avoid || []).length ? `<div class="box risk"><h3>建議避開</h3><ul>${c.avoid.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>` : ''}`;
}

/* ───────── 早年・中年・晚年、今年流年 ───────── */

// 各階段的「最好／要留意的一段」：跟人生曲線同一個規則（不挑 85 歲以後才開始的十年，同分並列）
function stageBestWorst(g) {
  const decs = (g.decadals || []).filter((d) => d && Array.isArray(d.ageRange));
  if (!decs.length) return '';
  const pk = decadePicks(decs, ageNow(cur.analysis));
  const segs = (arr) => arr.map((d) => `${d.ageRange[0]}～${d.ageRange[1]}歲`).join('、');
  if (pk.flat) return pk.pool.length > 1 ? `各段分數都是 ${pk.pool[0].score} 分` : '';
  return `最好的一段是 ${segs(pk.best)}（${pk.best[0].score}分${pk.best.length > 1 ? '，並列' : ''}）；`
    + `要留意的一段是 ${segs(pk.worst)}（${pk.worst[0].score}分${pk.worst.length > 1 ? '，並列' : ''}）`;
}

function renderStages() {
  const s = cur.analysis.stages || [];
  $('#stages').innerHTML = `
    <h2 id="st-h" class="card-h">早年・中年・晚年</h2>
    <p class="card-sub">把大限（十年一運）分成三段，各自評分。</p>
    ${s.map((g) => `<div class="stage">
      <div class="stage-h"><b>${esc(g.label)}</b>
        <span class="pill" style="background:${toneOf(g.level)}">${g.score} 分・${esc(g.level && g.level.label)}</span></div>
      <p class="hint">${esc(g.hint)}</p>
      ${stageBestWorst(g) ? `<p class="hint">${esc(stageBestWorst(g))}</p>` : ''}
      <div class="box act"><h3>這個階段的建議</h3><p>${esc(g.advice)}</p></div>
      ${(g.paragraphs || []).length ? `<details class="more"><summary>逐段說明</summary><div class="prose">${g.paragraphs.map((t) => `<p>${esc(t)}</p>`).join('')}</div></details>` : ''}
    </div>`).join('')}`;
}

function renderYearly() {
  const y = cur.analysis.year;
  const el = $('#yearly');
  const age = ageNow(cur.analysis);
  if (!y) { el.hidden = true; el.innerHTML = ''; return; }
  el.hidden = false;
  el.innerHTML = `
    <h2 id="yr-h" class="card-h">${esc(y.year)} 年流年</h2>
    <p class="y-lead">${age ? `今年虛歲 <b>${age}</b>，` : ''}流年命宮走到本命的<b>${esc(palName(y.yearlyPalace))}</b>${y.yearlyStars && y.yearlyStars.length ? `（${esc(y.yearlyStars.join('、'))}）` : ''}${y.decadalPalace ? `，同時處在<b>${esc(palName(y.decadalPalace))}</b>的大限之中` : ''}。</p>
    ${(y.notes || []).map((n) => `<div class="pat ${n.type === '忌' ? 'warn' : ''}"><b>化${esc(n.type)}</b><p>${esc(n.text)}</p></div>`).join('')}
    <p class="soft-cta">想知道今年適不適合買房、換屋？<button type="button" class="btn-text" data-goto="cta">可以找阿良聊聊</button></p>`;
}

/* ───────── 完整報告（Blob 開新分頁） ───────── */

function openReport() {
  const msgEl = $('#r-msg');
  msgEl.className = 'r-msg';
  msgEl.textContent = '';
  if (!cur) return;
  let html;
  try {
    html = renderReport(cur.chart, cur.analysis, { anonymous: $('#r-anon').checked });
  } catch (e) {
    console.warn('報告產生失敗', e);
    msgEl.className = 'r-msg err';
    msgEl.textContent = '報告產生失敗，請重新排盤後再試一次。';
    return;
  }
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
  const w = window.open(url, '_blank');
  if (w) {
    try { w.opener = null; } catch { /* 忽略 */ }
    msgEl.textContent = '報告已在新分頁打開。要存成 PDF：在報告頁按列印，印表機選「另存為 PDF」。';
  } else {
    msgEl.innerHTML = `瀏覽器擋掉了新分頁。<a href="${esc(url)}" target="_blank" rel="noopener">點這裡打開報告</a>`;
  }
  setTimeout(() => URL.revokeObjectURL(url), 10 * 60 * 1000);
}

/* ───────── 語音解說（speak.js） ───────── */

const V = { speaker: null, ready: false, chapter: 0, seg: -1, net: false, supported: false, reason: '' };

function vMsg(text, isErr) {
  const el = $('#v-msg');
  el.textContent = text || '';
  el.className = 'v-msg' + (isErr ? ' err' : '');
}

function vState() {
  try {
    const s = V.speaker && V.speaker.state();
    if (s && typeof s === 'object') return s;
  } catch { /* 忽略 */ }
  return { status: 'idle', chapter: V.chapter, seg: V.seg };
}

function initVoice() {
  try {
    V.speaker = createSpeaker({
      onState: (s) => {
        if (s && typeof s === 'object') {
          if ('networkVoice' in s) V.net = !!s.networkVoice;
          if (typeof s.reason === 'string' && hasCjk(s.reason)) V.reason = s.reason;
          const becameReady = s.ready === true && !V.ready;
          const supChanged = typeof s.supported === 'boolean' && s.supported !== V.supported;
          if (s.ready === true) V.ready = true;
          if (becameReady || supChanged) { refreshVoiceSupport(); return; }
        }
        syncVoice();
      },
      onSegment: (a, b) => {
        let ch;
        let sg;
        if (a && typeof a === 'object') {
          ch = a.chapter ?? a.chapterIndex;
          sg = a.seg ?? a.segIndex ?? a.segment;
        } else { ch = a; sg = b; }
        if (Number.isInteger(ch) && Number.isInteger(sg)) setVoicePos(ch, sg);
      },
      onError: (e) => vMsg(typeof e === 'string' ? e : (e && hasCjk(e.message) ? e.message : '語音播放出了問題，請再按一次播放。'), true),
    });
  } catch (e) {
    console.warn('語音初始化失敗', e);
    V.speaker = null;
  }

  $('#v-play').addEventListener('click', onPlay);
  $('#v-prev').addEventListener('click', () => stepChapter(-1));
  $('#v-next').addEventListener('click', () => stepChapter(1));
  $('#v-rate').addEventListener('change', (e) => {
    try { V.speaker && V.speaker.setRate(Number(e.target.value)); } catch { /* 忽略 */ }
  });
  $('#v-voice').addEventListener('change', (e) => {
    const id = e.target.value;
    try { V.speaker && V.speaker.setVoice(id); } catch { /* 忽略 */ }
    updateNetNote();
  });
  $('#v-chapters').addEventListener('click', (e) => {
    const b = e.target.closest('[data-ch]');
    if (!b || !V.speaker) return;
    const i = Number(b.getAttribute('data-ch'));
    V.chapter = i;
    V.seg = -1;
    renderVoiceText();
    try { V.speaker.play(i, 0); } catch (err) { vMsg('語音播放出了問題，請再按一次播放。', true); }
    syncVoice();
  });
  $('#v-text').addEventListener('click', (e) => {
    const s = e.target.closest('[data-seg]');
    if (!s || !V.speaker) return;
    try { V.speaker.play(V.chapter, Number(s.getAttribute('data-seg'))); } catch { /* 忽略 */ }
    syncVoice();
  });

  // 很多瀏覽器的聲音清單要等一下才出來；等 2 秒多再做最後判定
  setTimeout(() => { V.ready = true; refreshVoiceSupport(); }, 2300);
  refreshVoiceSupport();
}

function unsupportedReason() {
  if (V.reason) return `${V.reason}上面的文字分析一樣完整。`;
  if (!('speechSynthesis' in window)) return '這個瀏覽器沒有內建語音朗讀，所以沒辦法念給你聽。可以改用 Chrome、Edge 或 Safari 打開這一頁；上面的文字分析一樣完整。';
  return '這台裝置找不到中文語音，所以沒辦法念給你聽。可以到手機或電腦的設定裡加裝「中文（台灣）」語音，再重新整理這一頁；上面的文字分析一樣完整。';
}

function refreshVoiceSupport() {
  let ok = false;
  try { ok = !!(V.speaker && V.speaker.supported()); } catch { ok = false; }
  V.supported = ok;
  const ui = $('#v-ui');
  const un = $('#v-unsup');
  if (!cur || !cur.narration) {
    if (cur) {
      ui.hidden = true;
      un.hidden = false;
      un.textContent = '這次的語音講稿沒有產生成功，其他分析不受影響。';
    }
    return;
  }
  if (ok) {
    ui.hidden = false;
    un.hidden = true;
    fillVoices();
    $('#v-play').disabled = false;
    if ($('#v-msg').textContent === '正在準備語音…') vMsg('');
  } else if (!V.ready) {
    ui.hidden = false;
    un.hidden = true;
    $('#v-play').disabled = true;
    vMsg('正在準備語音…');
  } else {
    ui.hidden = true;
    un.hidden = false;
    un.textContent = unsupportedReason();
  }
  syncVoice();
}

function fillVoices() {
  let list = [];
  try { list = V.speaker.voices() || []; } catch { list = []; }
  const sel = $('#v-voice');
  const keep = sel.value;
  sel.innerHTML = list.map((v) => `<option value="${esc(v.id)}" data-local="${v.local ? 1 : 0}">${v.local ? '裝置內建' : '線上'}・${esc(v.name)}</option>`).join('');
  if (keep && list.some((v) => String(v.id) === keep)) sel.value = keep;
  $('#v-voice-wrap').hidden = list.length < 2;
  updateNetNote();
}

function updateNetNote() {
  const opt = $('#v-voice').selectedOptions && $('#v-voice').selectedOptions[0];
  const selNet = opt ? opt.getAttribute('data-local') === '0' : false;
  $('#v-net').hidden = !(V.net || selNet);
}

function loadVoice() {
  V.chapter = 0;
  V.seg = -1;
  const n = cur && cur.narration;
  if (n && V.speaker) {
    try { V.speaker.load(n); } catch (e) { console.warn('講稿載入失敗', e); }
  }
  const mins = n ? Math.max(1, Math.round((n.estSeconds || 0) / 60)) : 0;
  $('#v-intro').textContent = n
    ? `用你裝置內建的語音，把這份分析念給你聽，全部大約 ${mins} 分鐘。可以直接點章節或句子跳著聽。`
    : '用你裝置內建的語音，把這份分析念給你聽。';
  vMsg('');
  renderVoiceChapters();
  renderVoiceText();
  refreshVoiceSupport();
}

function renderVoiceChapters() {
  const n = cur && cur.narration;
  $('#v-chapters').innerHTML = n ? n.chapters.map((c, i) =>
    `<button type="button" class="v-chip${i === V.chapter ? ' on' : ''}" data-ch="${i}">${esc(c.title)}</button>`).join('') : '';
}

function renderVoiceText() {
  const n = cur && cur.narration;
  const ch = n && n.chapters[V.chapter];
  const box = $('#v-text');
  box.innerHTML = ch ? ch.segments.map((s, i) =>
    `<span class="v-seg${i === V.seg ? ' now' : ''}" data-seg="${i}">${esc(s.text)}</span>`).join('') : '';
  box.scrollTop = 0;
  $$('#v-chapters .v-chip').forEach((b) => b.classList.toggle('on', Number(b.getAttribute('data-ch')) === V.chapter));
}

function setVoicePos(ch, seg) {
  const n = cur && cur.narration;
  if (!n || !n.chapters[ch]) return;
  if (ch !== V.chapter) {
    V.chapter = ch;
    V.seg = seg;
    renderVoiceText();
  } else {
    V.seg = seg;
  }
  const box = $('#v-text');
  $$('.v-seg.now', box).forEach((x) => x.classList.remove('now'));
  const el = $(`.v-seg[data-seg="${seg}"]`, box);
  if (el) {
    el.classList.add('now');
    // 只捲動講稿框本身，不要把整頁拉走
    const top = el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop;
    if (top < box.scrollTop + 8 || top > box.scrollTop + box.clientHeight - 40) box.scrollTop = Math.max(0, top - 40);
  }
  const chip = $(`#v-chapters .v-chip[data-ch="${ch}"]`);
  if (chip) {
    const wrap = $('#v-chapters');
    const left = chip.getBoundingClientRect().left - wrap.getBoundingClientRect().left + wrap.scrollLeft;
    if (left < wrap.scrollLeft || left + chip.offsetWidth > wrap.scrollLeft + wrap.clientWidth) wrap.scrollLeft = Math.max(0, left - 16);
  }
}

function syncVoice() {
  const st = vState();
  const play = $('#v-play');
  const label = st.status === 'playing' ? '暫停' : st.status === 'paused' ? '繼續' : st.status === 'ended' ? '重新播放' : '播放';
  play.textContent = label;
  play.setAttribute('aria-pressed', String(st.status === 'playing'));
  if ((st.status === 'playing' || st.status === 'paused') && Number.isInteger(st.chapter) && Number.isInteger(st.seg)) {
    if (st.chapter !== V.chapter || st.seg !== V.seg) setVoicePos(st.chapter, st.seg);
  }
  if (st.status === 'ended') {
    $$('#v-text .v-seg.now').forEach((x) => x.classList.remove('now'));
    V.seg = -1;
  }
  const total = cur && cur.narration ? cur.narration.chapters.length : 0;
  const idle = st.status !== 'playing' && st.status !== 'paused';
  $('#v-prev').disabled = idle && V.chapter <= 0;
  $('#v-next').disabled = idle && V.chapter >= total - 1;
  updateNetNote();
}

// 要在點擊事件裡「同步」呼叫 play()，iOS 才肯出聲
function onPlay() {
  if (!V.speaker || !cur || !cur.narration) return;
  const st = vState();
  vMsg('');
  try {
    if (st.status === 'playing') V.speaker.pause();
    else if (st.status === 'paused') V.speaker.resume();
    else if (st.status === 'ended') { V.chapter = 0; V.seg = -1; renderVoiceText(); V.speaker.play(0, 0); }
    else V.speaker.play(V.chapter, V.seg > 0 ? V.seg : 0);
  } catch (e) {
    vMsg('語音播放出了問題，請再按一次播放。', true);
  }
  syncVoice();
}

function stepChapter(dir) {
  if (!cur || !cur.narration) return;
  const st = vState();
  const total = cur.narration.chapters.length;
  if (V.speaker && (st.status === 'playing' || st.status === 'paused')) {
    try { if (dir > 0) V.speaker.next(); else V.speaker.prev(); } catch { /* 忽略 */ }
  } else {
    const n = clamp(V.chapter + dir, 0, total - 1);
    if (n === V.chapter) return;
    V.chapter = n;
    V.seg = -1;
    renderVoiceText();
  }
  syncVoice();
}

/* ───────── 開始 ───────── */

init();
