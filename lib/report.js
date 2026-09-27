// 產生可列印、可存檔的完整解析報告（單一 HTML 檔）
// anonymous = true 時隱去姓名與完整生日，只留分析內容（用於對外分享時去識別化）

const palName = (n) => (!n ? '' : (String(n).endsWith('宮') ? String(n) : String(n) + '宮'));

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const HOURS = ['早子時 23:00-01:00', '丑時 01:00-03:00', '寅時 03:00-05:00', '卯時 05:00-07:00',
  '辰時 07:00-09:00', '巳時 09:00-11:00', '午時 11:00-13:00', '未時 13:00-15:00',
  '申時 15:00-17:00', '酉時 17:00-19:00', '戌時 19:00-21:00', '亥時 21:00-23:00', '晚子時 23:00-01:00'];

// 命盤十二格的畫面位置（文墨天機式 4x4，中央為中宮）
const GRID_POS = {
  巳: [0, 0], 午: [0, 1], 未: [0, 2], 申: [0, 3],
  辰: [1, 0], 酉: [1, 3],
  卯: [2, 0], 戌: [2, 3],
  寅: [3, 0], 丑: [3, 1], 子: [3, 2], 亥: [3, 3],
};

function toneColor(tone) {
  return ({ great: '#b8860b', good: '#2e7d5b', ok: '#4a5568', warn: '#b7791f', bad: '#9b2c2c' })[tone] || '#4a5568';
}

function palaceCell(p, chart, an) {
  const majors = p.majorStars.map((s) =>
    `<span class="st major">${esc(s.name)}${s.brightness ? `<i>${esc(s.brightness)}</i>` : ''}${s.mutagen ? `<b class="hua hua-${s.mutagen}">${esc(s.mutagen)}</b>` : ''}</span>`).join('');
  const minors = p.minorStars.map((s) =>
    `<span class="st minor">${esc(s.name)}${s.mutagen ? `<b class="hua hua-${s.mutagen}">${esc(s.mutagen)}</b>` : ''}</span>`).join('');
  const adj = p.adjectiveStars.slice(0, 8).map((s) => `<span class="st adj">${esc(s.name)}</span>`).join('');
  const det = an.palaces.find((x) => x.name === p.name);
  const dec = p.decadal ? `${p.decadal.range[0]}-${p.decadal.range[1]}` : '';
  return `<div class="cell" style="grid-row:${GRID_POS[p.earthlyBranch][0] + 1};grid-column:${GRID_POS[p.earthlyBranch][1] + 1}">
    <div class="cell-stars"><div class="majors">${majors || '<span class="st empty">（空宮）</span>'}</div>
    <div class="minors">${minors}</div><div class="adjs">${adj}</div></div>
    <div class="cell-foot">
      <div class="foot-l"><span class="dec">${esc(dec)}</span><span class="cs">${esc(p.changsheng12 || '')}</span></div>
      <div class="foot-r">
        <span class="pname${p.isBodyPalace ? ' body' : ''}">${esc(p.name)}${p.isBodyPalace ? '·身' : ''}</span>
        <span class="gz">${esc(p.heavenlyStem)}${esc(p.earthlyBranch)}</span>
        ${det ? `<span class="pscore" style="color:${toneColor(det.level.tone)}">${det.score}</span>` : ''}
      </div>
    </div>
  </div>`;
}

function centerCell(chart, an, opt) {
  const name = opt.anonymous ? '（不具名）' : (chart.name || '未命名');
  const birth = opt.anonymous ? '（已隱去）' : `${esc(chart.solarDate)}　${esc(chart.time)}`;
  const lunar = opt.anonymous ? '' : esc(String(chart.lunarDate ?? '').replace(/闰/g, '閏').replace(/腊/g, '臘'));
  return `<div class="cell center">
    <div class="c-name">${esc(name)}</div>
    <div class="c-row"><span>性別</span><b>${esc(chart.gender)}</b></div>
    <div class="c-row"><span>國曆</span><b>${birth}</b></div>
    ${lunar ? `<div class="c-row"><span>農曆</span><b>${lunar}</b></div>` : ''}
    ${opt.anonymous ? '' : `<div class="c-row"><span>四柱</span><b>${esc(chart.chineseDate)}</b></div>`}
    <div class="c-row"><span>五行局</span><b>${esc(chart.fiveElementsClass)}</b></div>
    <div class="c-row"><span>命主</span><b>${esc(chart.soul)}</b><span>身主</span><b>${esc(chart.body)}</b></div>
    ${opt.anonymous ? '' : `<div class="c-row"><span>生肖</span><b>${esc(chart.zodiac)}</b><span>星座</span><b>${esc(chart.sign)}</b></div>`}
    <div class="c-main">${esc(an.overview.title)}</div>
  </div>`;
}

function aspectBlock(a) {
  return `<section class="asp">
    <h3><span class="asp-name">${esc(a.key)}</span>
      <span class="asp-score" style="color:${toneColor(a.level.tone)}">${a.score}<small>分</small></span>
      <span class="asp-lv" style="background:${toneColor(a.level.tone)}">${esc(a.level.label)}</span></h3>
    <p class="asp-meta">主看${esc(a.mainPalace)}　${esc(a.mainPalaceDesc)}</p>
    ${a.paragraphs.map((t) => `<p>${esc(t)}</p>`).join('')}
    <div class="two">
      <div class="box good"><h4>優勢</h4><ul>${a.strengths.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>
      <div class="box risk"><h4>風險</h4><ul>${a.risks.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>
    </div>
    <div class="box act"><h4>現在可以做的事</h4><ol>${a.actions.map((t) => `<li>${esc(t)}</li>`).join('')}</ol></div>
    <table class="reftab"><thead><tr><th>參考宮位</th><th>看什麼</th><th>星曜</th><th>分數</th></tr></thead>
    <tbody>${a.refs.map((r) => `<tr><td>${esc(r.palace)}</td><td>${esc(r.role)}</td><td>${esc(r.stars)}</td><td>${r.score}（${esc(r.level)}）</td></tr>`).join('')}</tbody></table>
  </section>`;
}

export function renderReport(chart, an, opt = {}) {
  const cells = chart.palaces.map((p) => palaceCell(p, chart, an)).join('');
  const stamp = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 16).replace('T', ' ');

  return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(opt.anonymous ? '紫微斗數命盤解析' : (chart.name || '紫微斗數命盤解析'))}</title>
<style>
:root{--ink:#22201c;--sub:#6b6459;--line:#d9d2c5;--paper:#fdfbf6;--gold:#b8860b;--accent:#7a5c2e}
*{box-sizing:border-box}
body{margin:0;background:#efeae0;color:var(--ink);font:15px/1.85 "Noto Serif TC","Songti TC",Georgia,"Microsoft JhengHei",serif}
.wrap{max-width:1000px;margin:0 auto;padding:28px 22px 60px;background:var(--paper);box-shadow:0 0 30px rgba(0,0,0,.07)}
h1{font-size:26px;margin:0 0 4px;letter-spacing:2px}
h2{font-size:20px;margin:34px 0 12px;padding:8px 0 8px 12px;border-left:5px solid var(--gold);background:#f7f2e6;letter-spacing:1px}
h3{font-size:17px;margin:20px 0 8px;display:flex;align-items:center;gap:10px}
h4{font-size:14px;margin:0 0 6px;color:var(--accent)}
p{margin:8px 0}
.hdr-sub{color:var(--sub);font-size:13px;margin-bottom:18px}
.grid{display:grid;grid-template-columns:repeat(4,1fr);grid-template-rows:repeat(4,minmax(132px,auto));gap:3px;background:var(--line);border:2px solid var(--accent);padding:3px;margin:14px 0 26px}
.cell{background:#fffdf8;padding:5px 6px;display:flex;flex-direction:column;justify-content:space-between;min-height:132px;position:relative}
.cell.center{grid-row:2/4;grid-column:2/4;background:#fbf6ea;justify-content:flex-start;padding:14px 16px}
.cell-stars{font-size:12px;line-height:1.5}
.majors .st{font-size:14px;font-weight:700;color:#1a4d8f;margin-right:5px;display:inline-block}
.minors .st{font-size:12px;color:#8a5a1a;margin-right:4px;display:inline-block}
.adjs .st{font-size:11px;color:#93897a;margin-right:4px;display:inline-block}
.st.empty{color:#b0a89a;font-weight:400;font-size:12px}
.st i{font-style:normal;font-size:10px;color:#6b6459;margin-left:1px}
.hua{font-size:10px;color:#fff;border-radius:2px;padding:0 2px;margin-left:2px;font-weight:700}
.hua-祿{background:#2e7d5b}.hua-權{background:#1a4d8f}.hua-科{background:#8a6d1a}.hua-忌{background:#9b2c2c}
.cell-foot{display:flex;justify-content:space-between;align-items:flex-end;border-top:1px dashed var(--line);padding-top:3px;margin-top:4px;font-size:11px}
.foot-l{display:flex;flex-direction:column;color:#8a8274}
.foot-r{display:flex;align-items:center;gap:5px}
.pname{font-size:13px;font-weight:700;color:var(--accent)}
.pname.body{color:#9b2c2c}
.gz{color:#8a8274}
.pscore{font-weight:700;font-size:13px}
.c-name{font-size:20px;font-weight:700;letter-spacing:2px;margin-bottom:8px;text-align:center;color:var(--accent)}
.c-row{font-size:12px;display:flex;gap:6px;align-items:baseline;margin:2px 0}
.c-row span{color:var(--sub);min-width:38px}
.c-row b{font-weight:600}
.c-main{margin-top:10px;text-align:center;font-size:15px;font-weight:700;color:#1a4d8f;border-top:1px solid var(--line);padding-top:8px}
.asp{border:1px solid var(--line);background:#fffdf8;padding:14px 18px;margin:14px 0;border-radius:3px}
.asp-name{font-size:19px;letter-spacing:3px}
.asp-score{font-size:26px;font-weight:700}
.asp-score small{font-size:12px;font-weight:400}
.asp-lv{color:#fff;font-size:12px;padding:2px 9px;border-radius:10px}
.asp-meta{color:var(--sub);font-size:13px;margin:2px 0 10px}
.two{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:12px 0}
.box{border:1px solid var(--line);padding:10px 12px;border-radius:3px;background:#fdfaf3}
.box.good{border-left:4px solid #2e7d5b}
.box.risk{border-left:4px solid #9b2c2c}
.box.act{border-left:4px solid var(--gold);background:#fbf6e8}
.box ul,.box ol{margin:0;padding-left:20px}
.box li{margin:4px 0;font-size:14px}
table{width:100%;border-collapse:collapse;margin:10px 0;font-size:13px}
th,td{border:1px solid var(--line);padding:5px 8px;text-align:left}
th{background:#f4eee0;font-weight:600}
.reftab{margin-top:12px}
.stage{border:1px solid var(--line);padding:14px 18px;margin:12px 0;background:#fffdf8}
.stage-h{display:flex;align-items:center;gap:12px;margin-bottom:6px}
.stage-h b{font-size:18px}
.pill{display:inline-block;padding:2px 10px;border-radius:10px;color:#fff;font-size:12px}
.tags span{display:inline-block;background:#f0e8d5;color:var(--accent);padding:2px 9px;border-radius:10px;font-size:12px;margin:3px 4px 3px 0}
.pat{border:1px solid var(--line);padding:10px 14px;margin:8px 0;background:#fffdf8;border-left:4px solid var(--gold)}
.pat.warn,.pat.bad{border-left-color:#9b2c2c}
.pat.mixed{border-left-color:#b7791f}
.pat b{font-size:15px}
.note{background:#f7f2e6;border:1px dashed var(--line);padding:10px 14px;font-size:13px;color:var(--sub);margin:16px 0}
.foot{margin-top:34px;padding-top:14px;border-top:1px solid var(--line);color:var(--sub);font-size:12px;text-align:center}
@media print{body{background:#fff}.wrap{box-shadow:none;max-width:100%}h2{break-after:avoid}.asp,.stage{break-inside:avoid}}
@media (max-width:760px){.two{grid-template-columns:1fr}.grid{grid-template-rows:repeat(4,minmax(112px,auto))}}
</style></head><body><div class="wrap">

<h1>紫微斗數 命盤精算解析</h1>
<div class="hdr-sub">產生時間 ${esc(stamp)}　·　本報告在你的瀏覽器裡產生，生日資料沒有上傳</div>

<div class="grid">${cells}${centerCell(chart, an, opt)}</div>

<h2>一、命格總論</h2>
<div class="stage">
  <div class="stage-h"><b>${esc(an.overview.title)}</b>
    <span class="pill" style="background:${toneColor(an.overview.level.tone)}">${an.overview.score} 分　${esc(an.overview.level.label)}</span></div>
  <div class="tags">${an.overview.keywords.map((k) => `<span>${esc(k)}</span>`).join('')}</div>
  ${an.overview.paragraphs.map((t) => `<p>${esc(t)}</p>`).join('')}
  <p>${esc(an.overview.soulText)}</p>
  <p>${esc(an.overview.shenText)}</p>
</div>

${an.patterns.length ? `<h2>二、命盤格局</h2>
${an.patterns.map((p) => `<div class="pat ${esc(p.level)}"><b>${esc(p.name)}</b>　<span class="pill" style="background:${p.level === 'great' ? '#b8860b' : p.level === 'good' ? '#2e7d5b' : p.level === 'mixed' ? '#b7791f' : '#9b2c2c'}">${p.level === 'great' ? '上格' : p.level === 'good' ? '吉格' : p.level === 'mixed' ? '雙面' : '留意'}</span><p>${esc(p.desc)}</p></div>`).join('')}` : ''}

<h2>三、五大面向分析</h2>
<table><thead><tr><th>面向</th><th>分數</th><th>評等</th><th>主看宮位</th></tr></thead><tbody>
${Object.values(an.aspects).map((a) => `<tr><td><b>${esc(a.key)}</b></td><td style="color:${toneColor(a.level.tone)};font-weight:700">${a.score}</td><td>${esc(a.level.label)}</td><td>${esc(a.mainPalace)}</td></tr>`).join('')}
</tbody></table>
${Object.values(an.aspects).map(aspectBlock).join('')}

<h2>四、適合的工作與行業</h2>
<table><thead><tr><th>排名</th><th>類型</th><th>評分</th><th>具體職業</th><th>依據</th></tr></thead><tbody>
${an.careers.top.map((c) => `<tr><td>${c.rank}</td><td><b>${esc(c.category)}</b></td><td style="font-weight:700;color:${c.score >= 85 ? '#b8860b' : '#4a5568'}">${c.score}</td><td>${esc(c.jobs.join('、'))}</td><td>${esc(c.reason)}</td></tr>`).join('')}
</tbody></table>
<div class="box risk"><h4>建議避開的類型</h4><ul>${an.careers.avoid.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>

<h2>五、早年 · 中年 · 晚年</h2>
${an.stages.map((s) => `<div class="stage">
  <div class="stage-h"><b>${esc(s.label)}</b><span class="pill" style="background:${toneColor(s.level.tone)}">${s.score} 分　${esc(s.level.label)}</span></div>
  <p style="color:var(--sub);font-size:13px">${esc(s.hint)}　${esc(s.best)}　${esc(s.worst)}</p>
  ${s.paragraphs.map((t) => `<p>${esc(opt.anonymous ? String(t).replace(/（\d{4}～\d{4}年）/g, '') : t)}</p>`).join('')}
  <div class="box act"><h4>這個階段的建議</h4><p style="margin:0">${esc(s.advice)}</p></div>
</div>`).join('')}

<h2>六、大限逐段（十年一運）</h2>
<table><thead><tr><th>年齡</th>${opt.anonymous ? '' : '<th>西元</th>'}<th>大限宮</th><th>主星</th><th>分數</th><th>走勢</th></tr></thead><tbody>
${an.decadals.map((d) => `<tr><td>${d.ageRange[0]}-${d.ageRange[1]}</td>${opt.anonymous ? '' : `<td>${d.yearRange[0]}-${d.yearRange[1]}</td>`}<td>${esc(d.palaceName)}</td><td>${esc(d.stars.join('、') || '空宮')}</td><td style="color:${toneColor(d.level.tone)};font-weight:700">${d.score}</td><td>${esc(d.summary)}</td></tr>`).join('')}
</tbody></table>
${an.decadals.filter((d) => d.notes.length).map((d) => `<div class="pat"><b>${d.ageRange[0]}-${d.ageRange[1]}歲</b><p>${d.notes.map(esc).join('<br>')}</p></div>`).join('')}

${an.year ? `<h2>七、${an.year.year} 年流年</h2>
<div class="stage">
  <p>${opt.anonymous || !(Number(an.year.ageName) > 0) ? '' : `今年虛歲 ${esc(an.year.ageName)}，`}流年命宮走到本命的<b>${esc(palName(an.year.yearlyPalace))}</b>${an.year.yearlyStars.length ? `（${esc(an.year.yearlyStars.join('、'))}）` : ''}${an.year.decadalPalace ? `，同時處於<b>${esc(palName(an.year.decadalPalace))}</b>的大限之中` : ''}。</p>
  ${an.year.notes.map((n) => `<p>${esc(n.text)}</p>`).join('')}
</div>` : ''}

<h2>八、十二宮逐宮明細</h2>
${an.palaces.map((p) => `<div class="stage">
  <div class="stage-h"><b>${esc(p.full)}${p.isBody ? '（身宮）' : ''}</b>
    <span style="color:var(--sub);font-size:13px">${esc(p.stem)}${esc(p.branch)}　${esc(p.role)}</span>
    <span class="pill" style="background:${toneColor(p.level.tone)}">${p.score}</span></div>
  <p style="color:var(--sub);font-size:13px">${esc(p.meaning)}</p>
  ${p.paragraphs.map((t) => `<p>${esc(t)}</p>`).join('')}
</div>`).join('')}

<div class="note">
  <b>使用說明</b>：本報告以紫微斗數傳統論法（十四主星、六吉六煞、四化、三方四正、大限流年）搭配規則式評分產生，
  分數是為了讓強弱一眼可比，並非吉凶的絕對值。命理是提供決策參考的一種角度，
  重大決定仍應結合實際狀況、專業意見與家人共識。健康部分僅為體質傾向提醒，不能取代醫療診斷。
</div>

<div class="foot">紫微斗數精算命盤 · 網頁版　·　排盤核心 iztro　·　生日只在你的瀏覽器裡計算，沒有上傳也沒有儲存</div>
</div></body></html>`;
}

export { HOURS };
