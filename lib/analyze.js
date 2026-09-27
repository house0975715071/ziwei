// 分析引擎：把命盤轉成五大面向的解析報告
import { makeContext, scorePalace, levelOf, PALACE_MEANING } from './chart.js?v=e69bf8b5';
import { MAJOR_STARS, EMPTY_PALACE_NOTE } from '../kb/stars.js?v=e69bf8b5';
import { STAR_PALACE_A } from '../kb/star-palace-a.js?v=e69bf8b5';
import { STAR_PALACE_B } from '../kb/star-palace-b.js?v=e69bf8b5';
import { LUCKY_STARS, TOUGH_STARS, ADJ_STARS, MUTAGEN_MEANING, MUTAGEN_PALACE } from '../kb/aux.js?v=e69bf8b5';
import { PATTERNS, INDUSTRY_MAP } from '../kb/patterns.js?v=e69bf8b5';

export const STAR_PALACE = { ...STAR_PALACE_A, ...STAR_PALACE_B };

/** 宮名標準化：命宮 -> 命宮；財帛 -> 財帛宮（避免出現「命宮宮」） */
export const pal = (n) => (!n ? '' : (String(n).endsWith('宮') ? String(n) : String(n) + '宮'));


// 五大面向 → 主宮 + 參考宮 + 權重
const ASPECTS = {
  事業: { main: '官祿', refs: [['命宮', 0.3], ['遷移', 0.2], ['財帛', 0.15]], icon: '事業' },
  財運: { main: '財帛', refs: [['田宅', 0.3], ['福德', 0.2], ['命宮', 0.15]], icon: '財運' },
  家庭: { main: '田宅', refs: [['父母', 0.3], ['兄弟', 0.2], ['子女', 0.2]], icon: '家庭' },
  感情: { main: '夫妻', refs: [['福德', 0.25], ['子女', 0.2], ['命宮', 0.15]], icon: '感情' },
  健康: { main: '疾厄', refs: [['命宮', 0.25], ['福德', 0.25], ['父母', 0.1]], icon: '健康' },
};

const ASPECT_FIELD = { 事業: 'career', 財運: 'wealth', 家庭: 'family', 感情: 'love', 健康: 'health' };

/** 取某宮的有效主星（空宮則借對宮） */
export function effectiveMajors(chart, palaceName) {
  const p = chart.palaces.find((x) => x.name === palaceName);
  if (!p) return { stars: [], borrowed: false, from: null };
  if (p.majorStars.length) return { stars: p.majorStars, borrowed: false, from: null };
  const opp = chart.palaces.find((x) => x.index === (p.index + 6) % 12);
  return { stars: opp ? opp.majorStars : [], borrowed: true, from: opp ? opp.name : null };
}

/** 主分析入口 */
export function analyze(chart) {
  const ctx = makeContext(chart);
  const patterns = detectPatterns(ctx);
  const aspects = {};
  for (const key of Object.keys(ASPECTS)) aspects[key] = analyzeAspect(chart, ctx, key, patterns);

  return {
    overview: buildOverview(chart, ctx, patterns),
    patterns,
    aspects,
    careers: recommendCareers(chart, ctx, patterns),
    stages: buildStages(chart, ctx),
    decadals: buildDecadalTable(chart, ctx),
    palaces: buildPalaceDetails(chart, ctx),
    year: buildYearly(chart),
  };
}

function detectPatterns(ctx) {
  const hits = [];
  for (const p of PATTERNS) {
    let ok = false;
    try { ok = !!p.test(ctx); } catch { ok = false; }
    if (ok) hits.push({ id: p.id, name: p.name, level: p.level, desc: p.desc, effect: p.effect, careerHint: p.careerHint || null });
  }
  const rank = { great: 0, good: 1, mixed: 2, warn: 3, bad: 4 };
  return hits.sort((a, b) => rank[a.level] - rank[b.level]);
}

/** 命格總論 */
function buildOverview(chart, ctx, patterns) {
  const ming = ctx.palaceOf('命宮');
  const shen = chart.palaces.find((p) => p.isBodyPalace);
  const eff = effectiveMajors(chart, '命宮');
  const paras = [];

  const starNames = eff.stars.map((s) => s.name);
  if (!starNames.length) {
    paras.push(EMPTY_PALACE_NOTE);
  } else if (eff.borrowed) {
    paras.push(`命宮無主星，借對宮「${eff.from}」的${starNames.join('、')}來看。${EMPTY_PALACE_NOTE}`);
  }

  for (const s of eff.stars) {
    const sp = STAR_PALACE[s.name]?.命宮;
    const bright = s.brightness ? `（${s.brightness}）` : '';
    if (sp) paras.push(`【${s.name}${bright}坐命】${sp}`);
    if (s.mutagen) {
      const mm = MUTAGEN_MEANING[s.mutagen];
      paras.push(`【${s.name}化${s.mutagen}】${mm.desc}${MUTAGEN_PALACE[s.mutagen]?.命宮 || ''}`);
    }
  }

  // 命宮的吉星煞星
  const own = ctx.starsIn('命宮');
  const luckyOwn = Object.keys(LUCKY_STARS).filter((k) => own.includes(k));
  const toughOwn = Object.keys(TOUGH_STARS).filter((k) => own.includes(k));
  if (luckyOwn.length) paras.push(`【命宮吉星】${luckyOwn.map((k) => `${k}：${LUCKY_STARS[k].desc}`).join(' ')}`);
  if (toughOwn.length) paras.push(`【命宮煞星】${toughOwn.map((k) => `${k}：${TOUGH_STARS[k].desc}`).join(' ')}`);

  // 三方四正
  if (ming) {
    const opp = ctx.palaceAt((ming.index + 6) % 12);
    if (opp?.majorStars.length) {
      const names = opp.majorStars.map((s) => `${s.name}${s.brightness ? `（${s.brightness}）` : ''}`).join('、');
      paras.push(`【對宮遷移宮：${names}】遷移宮是命宮的鏡子，代表外界怎麼看你、你在外面是什麼樣子。${opp.majorStars.map((s) => MAJOR_STARS[s.name]?.core).filter(Boolean)[0]?.slice(0, 60) || ''}——這股力量會補足或制衡你本命的個性。`);
    }
    const triA = ctx.palaceAt((ming.index + 4) % 12);
    const triB = ctx.palaceAt((ming.index + 8) % 12);
    const tri = [...(triA?.majorStars || []), ...(triB?.majorStars || [])];
    if (tri.length) {
      paras.push(`【三合財帛宮與官祿宮：${tri.map((s) => s.name).join('、')}】命宮的三合是財帛與官祿，這兩宮決定你「靠什麼吃飯、錢從哪來」。這組星曜的關鍵字是：${tri.flatMap((s) => MAJOR_STARS[s.name]?.keywords || []).slice(0, 6).join('、')}。`);
    }
  }

  // 格局總結
  if (patterns.length) {
    const good = patterns.filter((p) => ['great', 'good'].includes(p.level));
    const bad = patterns.filter((p) => ['warn', 'bad'].includes(p.level));
    if (good.length) paras.push(`【加分格局】命盤成立的好格局有：${good.map((p) => p.name).join('、')}。這是你先天的底子，要主動用出來。`);
    if (bad.length) paras.push(`【要留意的格局】命盤中也有：${bad.map((p) => p.name).join('、')}。這不是宿命，而是提醒你哪些地方特別容易踩坑，知道了就能避。`);
  }

  const shenText = shen
    ? `身宮落在${PALACE_MEANING[shen.name]?.full || shen.name}，代表你這一生的重心與後天努力的方向會放在「${PALACE_MEANING[shen.name]?.role || shen.name}」這個領域。三十歲之後，身宮的影響會越來越明顯。`
    : '';

  const soulText = `命主${chart.soul}、身主${chart.body}，五行局為${chart.fiveElementsClass}。命主代表先天的本質傾向，身主代表後天可修的方向，${chart.fiveElementsClass}決定了大限起運的年齡。`;

  const score = scorePalace(chart, '命宮');
  return {
    title: `${starNames.length ? starNames.join('、') : '空宮'}坐命`,
    mingBranch: ming?.earthlyBranch || '',
    bodyPalace: shen ? shen.name : '',
    score: score.score,
    level: levelOf(score.score),
    paragraphs: paras,
    shenText,
    soulText,
    keywords: starNames.flatMap((n) => MAJOR_STARS[n]?.keywords || []).slice(0, 8),
  };
}

/** 單一面向分析 */
function analyzeAspect(chart, ctx, aspectKey, patterns) {
  const cfg = ASPECTS[aspectKey];
  const field = ASPECT_FIELD[aspectKey];
  const mainScore = scorePalace(chart, cfg.main);

  // 加權分數
  let total = mainScore.score;
  let weightSum = 1;
  for (const [pName, w] of cfg.refs) {
    total += scorePalace(chart, pName).score * w;
    weightSum += w;
  }
  let score = total / weightSum;
  // 格局加成
  for (const pat of patterns) {
    const eff = pat.effect?.[aspectKey];
    if (eff) score += eff * 0.35;
  }
  score = Math.max(8, Math.min(97, Math.round(score)));

  const paras = [];
  const eff = effectiveMajors(chart, cfg.main);
  if (eff.borrowed) {
    paras.push(`${PALACE_MEANING[cfg.main].full}無主星，借對宮「${eff.from}」的${eff.stars.map((s) => s.name).join('、') || '星曜'}來看。這代表這個領域本身沒有固定的主軸，變化與可塑性都大，容易受環境與身邊的人影響。`);
  }

  // 主宮星曜解說
  for (const s of eff.stars) {
    const txt = STAR_PALACE[s.name]?.[cfg.main];
    const bright = s.brightness ? `（${s.brightness}）` : '';
    if (txt) paras.push(`【${s.name}${bright}在${PALACE_MEANING[cfg.main].full}】${txt}`);
    if (s.mutagen) {
      paras.push(`【${s.name}化${s.mutagen}於${PALACE_MEANING[cfg.main].full}】${MUTAGEN_PALACE[s.mutagen]?.[cfg.main] || MUTAGEN_MEANING[s.mutagen].desc}`);
    }
  }

  // 三方四正：對宮 + 三合宮
  const mainPalace = ctx.palaceOf(cfg.main);
  if (mainPalace) {
    const oppIdx = (mainPalace.index + 6) % 12;
    const opp = ctx.palaceAt(oppIdx);
    if (opp && opp.majorStars.length && !eff.borrowed) {
      const oppNames = opp.majorStars.map((s) => `${s.name}${s.brightness ? `（${s.brightness}）` : ''}`).join('、');
      const oppTrait = opp.majorStars.map((s) => MAJOR_STARS[s.name]?.[field]).filter(Boolean)[0];
      paras.push(`【對宮${PALACE_MEANING[opp.name]?.full || opp.name}：${oppNames}】對宮是這個領域的外在環境與另一半的力量。${oppTrait || ''}這代表你在${aspectKey}上會被這股力量牽動，順著它比硬拗容易。`);
    }
    const triA = ctx.palaceAt((mainPalace.index + 4) % 12);
    const triB = ctx.palaceAt((mainPalace.index + 8) % 12);
    const triStars = [...(triA?.majorStars || []), ...(triB?.majorStars || [])];
    if (triStars.length) {
      const triNames = triStars.map((s) => s.name).join('、');
      const triPal = [triA?.name, triB?.name].filter(Boolean).map((n) => PALACE_MEANING[n]?.full || n).join('與');
      paras.push(`【三合${triPal}：${triNames}】三合宮是這個領域的支援體系。${triStars.map((s) => MAJOR_STARS[s.name]?.keywords?.join('、')).filter(Boolean).join('；')}——這些特質會在你經營${aspectKey}時默默發揮作用。`);
    }
  }

  // 本命特質補充（從命宮主星的該面向特質）
  const mingEff = effectiveMajors(chart, '命宮');
  for (const s of mingEff.stars) {
    const t = MAJOR_STARS[s.name]?.[field];
    if (t) paras.push(`【本命${s.name}的${aspectKey}特質】${t}`);
  }

  // 格局對此面向的影響
  for (const pat of patterns) {
    const e = pat.effect?.[aspectKey];
    if (e && Math.abs(e) >= 6) {
      paras.push(`【格局：${pat.name}】${pat.desc}對${aspectKey}的影響為${e > 0 ? `加分（+${e}）` : `減分（${e}）`}。`);
    }
  }

  // 參考宮位提醒
  const refNotes = [];
  for (const [pName] of cfg.refs) {
    const rs = scorePalace(chart, pName);
    const e2 = effectiveMajors(chart, pName);
    const names = e2.stars.map((s) => s.name).join('、') || '空宮';
    refNotes.push({ palace: PALACE_MEANING[pName].full, role: PALACE_MEANING[pName].role, stars: names, score: rs.score, level: levelOf(rs.score).label });
  }

  return {
    key: aspectKey,
    score,
    level: levelOf(score),
    mainPalace: PALACE_MEANING[cfg.main].full,
    mainPalaceDesc: PALACE_MEANING[cfg.main].desc,
    stars: eff.stars.map((s) => ({ ...s })),
    borrowed: eff.borrowed,
    paragraphs: paras,
    refs: refNotes,
    strengths: collectStrengths(chart, ctx, cfg.main, aspectKey),
    risks: collectRisks(chart, ctx, cfg.main, aspectKey),
    actions: buildActions(chart, ctx, aspectKey, score, eff.stars),
    detail: mainScore.detail,
  };
}

function collectStrengths(chart, ctx, palaceName, aspectKey) {
  const out = [];
  const sf = ctx.sanfangStars(palaceName);
  const own = ctx.starsIn(palaceName);
  for (const k of Object.keys(LUCKY_STARS)) {
    if (own.includes(k)) out.push(`${k}坐守${PALACE_MEANING[palaceName].full}：${LUCKY_STARS[k].desc}`);
    else if (sf.includes(k)) out.push(`三方會${k}：${LUCKY_STARS[k].desc}`);
  }
  if (own.includes('祿存')) out.push(`祿存坐守：${ADJ_STARS.祿存.desc}`);
  else if (sf.includes('祿存')) out.push(`三方會祿存：主此領域有實質的財源與底氣。`);
  if (own.includes('天馬') && (own.includes('祿存') || sf.includes('祿存'))) out.push('祿馬交馳：越走動越有收穫，適合往外開拓。');

  const p = ctx.palaceOf(palaceName);
  if (p) {
    for (const s of [...p.majorStars, ...p.minorStars]) {
      if (s.mutagen && s.mutagen !== '忌') {
        out.push(`${s.name}化${s.mutagen}：${MUTAGEN_MEANING[s.mutagen].short}，這是此領域最主要的助力來源。`);
      }
      if (['廟', '旺'].includes(s.brightness)) out.push(`${s.name}${s.brightness}：此星的優點能充分發揮。`);
    }
  }
  if (!out.length) out.push('本宮無明顯吉星拱照，此領域的成果需要靠自己一步一步累積，不會有太多外力加持。');
  return out.slice(0, 6);
}

function collectRisks(chart, ctx, palaceName, aspectKey) {
  const out = [];
  const sf = ctx.sanfangStars(palaceName);
  const own = ctx.starsIn(palaceName);
  for (const k of Object.keys(TOUGH_STARS)) {
    if (own.includes(k)) out.push(`${k}坐守${PALACE_MEANING[palaceName].full}：${TOUGH_STARS[k].desc}`);
    else if (sf.includes(k)) out.push(`三方會${k}：此領域會受到${TOUGH_STARS[k].tag}的干擾，要有心理準備。`);
  }
  const p = ctx.palaceOf(palaceName);
  if (p) {
    for (const s of [...p.majorStars, ...p.minorStars]) {
      if (s.mutagen === '忌') out.push(`${s.name}化忌：這是你在${PALACE_MEANING[palaceName].full}最放不下、最容易卡住的地方。${MUTAGEN_PALACE.忌[palaceName] || ''}`);
      if (s.brightness === '陷') out.push(`${s.name}落陷：此星的缺點較明顯，優點不容易發揮，需要靠後天努力補。`);
    }
  }
  const badPat = PATTERNS.filter((x) => (x.level === 'bad' || x.level === 'warn'));
  for (const bp of badPat) {
    let ok = false; try { ok = !!bp.test(ctx); } catch { ok = false; }
    if (ok && bp.effect?.[aspectKey] < 0) out.push(`${bp.name}：${bp.desc}`);
  }
  if (!out.length) out.push('此領域未見明顯煞忌沖破，走勢相對平穩，主要風險來自個人的選擇與執行，而非外在的阻力。');
  return out.slice(0, 6);
}

/** 可執行建議：依面向 + 分數 + 星曜產生 */
function buildActions(chart, ctx, aspectKey, score, stars) {
  const names = stars.map((s) => s.name);
  const has = (n) => names.includes(n);
  const A = [];

  if (aspectKey === '事業') {
    if (has('紫微') || has('天府') || has('武曲')) A.push('往「有決策權、能負責損益」的位置移動，你在被管理的位置上會被埋沒。');
    if (has('七殺') || has('破軍') || has('貪狼')) A.push('選一個「有業績、有開拓空間」的舞台，並設定 3 年內要打下的具體目標；守成型工作會壓抑你的優勢。');
    if (has('天機') || has('文昌') || has('文曲')) A.push('把你的專業寫成可複製的方法（SOP、課程、內容），用腦力而非工時換錢。');
    if (has('太陽') || has('巨門')) A.push('經營「被看見」的管道（自媒體、講座、社群），你的財路要靠名聲與口碑打開。');
    if (has('天同') || has('天相') || has('天梁')) A.push('挑一個制度穩定、氣氛良好的平台深耕，你的價值在長期累積的信任，不在短期爆發。');
    if (score < 55) A.push('未來 12 個月不要頻繁換工作，先在現職做出一個可量化的成績，履歷才有籌碼。');
    A.push('每季檢視一次：這份工作有沒有讓你的「可帶走的能力」變強？沒有就該調整。');
  }

  if (aspectKey === '財運') {
    if (has('武曲') || has('天府') || has('太陰')) A.push('走「置產與長期持有」路線：把年收入的固定比例強制轉成不動產或穩定配息資產。');
    if (has('貪狼') || has('破軍') || has('七殺')) A.push('設定「落袋紀律」：暴發型的財要立刻轉一部分成不會動的資產，否則賺多少都會再吐回去。');
    if (has('廉貞') || has('巨門')) A.push('所有金錢往來白紙黑字，尤其是合夥、借貸、分潤。你的破財多半來自人情與口頭承諾。');
    if (has('天同') || has('天梁')) A.push('用制度存錢：定期定額、自動扣款，不要靠意志力，你的花費是溫水煮青蛙型的。');
    if (score < 55) A.push('先做一次完整的現金流盤點（收入、固定支出、負債、可動用現金），把最大的破口先堵起來。');
    A.push('保留至少 6 個月生活費的現金水位，這是你所有投資決策的地基。');
  }

  if (aspectKey === '家庭') {
    A.push('每週固定一個「不談事情只相處」的時段，家庭問題多半不是事情本身，是相處密度不夠。');
    if (has('太陽') || has('天梁')) A.push('與父親或長輩的關係是你人生的重要課題，主動安排定期探望或通話，不要等到有事才聯絡。');
    if (has('太陰')) A.push('與母親或家中女性長輩的緣分深，她們的狀態會直接影響你的心境，值得多投入時間。');
    if (has('七殺') || has('破軍') || has('巨門')) A.push('家中溝通要「先處理情緒，再處理事情」。你的直接會被家人解讀成不在乎。');
    if (score < 55) A.push('列出目前家庭中最讓你耗能的一件事，先處理那一件，不要五件一起扛。');
  }

  if (aspectKey === '感情') {
    if (has('七殺') || has('破軍') || has('貪狼') || has('廉貞')) A.push('這組星曜宜晚婚（建議 30 歲以後）。早婚不是不能，是要先把自己的重心與脾氣穩下來。');
    if (has('武曲') || has('天機')) A.push('你的問題不在不愛，在不說。每週至少一次把想法完整講出來，不要用做事代替表達。');
    if (has('太陰') || has('天同')) A.push('別把不滿悶著。你習慣默默付出、默默記帳，對方其實不知道你在意什麼。');
    if (has('巨門')) A.push('吵架時把「翻舊帳」這件事關掉。你講贏了，關係就輸了。');
    if (score < 55) A.push('如果目前感情有結，先各自把「最想要對方改的一件事」寫下來交換，比爭論誰對誰錯有效。');
    A.push('伴侶是重大決策的關鍵人，投資、置產、換工作都要先取得共識再行動。');
  }

  if (aspectKey === '健康') {
    const weak = stars.map((s) => MAJOR_STARS[s.name]?.health).filter(Boolean);
    if (weak.length) A.push(`依命盤星曜，你的體質弱點在：${weak.join('；')}。這幾項要納入年度健檢的必檢項目。`);
    A.push('固定運動比任何保養品有效。每週 3 次、每次 30 分鐘是最低門檻。');
    if (has('天機') || has('巨門') || has('太陰')) A.push('你的身體問題多半從「想太多」開始。睡眠品質是你的第一警訊，睡不好就代表要調整了。');
    if (has('七殺') || has('破軍') || has('武曲')) A.push('你的風險是硬撐。身體發出訊號時就去看醫生，不要等到撐不住。也要特別留意交通安全。');
    if (has('貪狼') || has('廉貞')) A.push('應酬與作息是你最大的健康殺手，設定每週應酬上限並確實執行。');
    if (score < 55) A.push('今年之內做一次完整健檢（含心血管、腸胃、代謝三大項），把基準線建立起來。');
  }

  return A.slice(0, 5);
}

/** 職業推薦：排名 + 評分 */
function recommendCareers(chart, ctx, patterns) {
  const mingEff = effectiveMajors(chart, '命宮');
  const guanEff = effectiveMajors(chart, '官祿');
  const caiEff = effectiveMajors(chart, '財帛');
  const weightMap = new Map();
  const addWeight = (starName, w) => weightMap.set(starName, (weightMap.get(starName) || 0) + w);
  for (const s of guanEff.stars) addWeight(s.name, 3 + brightBonus(s));
  for (const s of mingEff.stars) addWeight(s.name, 2.2 + brightBonus(s));
  for (const s of caiEff.stars) addWeight(s.name, 1.6 + brightBonus(s));
  // 三方輔星
  const sfGuan = ctx.sanfangStars('官祿');
  for (const s of ['文昌', '文曲', '左輔', '右弼', '天魁', '天鉞']) if (sfGuan.includes(s)) addWeight(s, 1.2);

  const rows = [];
  for (const [cat, cfg] of Object.entries(INDUSTRY_MAP)) {
    let raw = 0;
    const matched = [];
    for (const st of cfg.stars) {
      const w = weightMap.get(st);
      if (w) { raw += w; matched.push(st); }
    }
    if (!raw) continue;
    rows.push({ category: cat, raw, matched, jobs: cfg.jobs });
  }

  // 格局提示加權
  for (const pat of patterns) {
    if (!pat.careerHint) continue;
    for (const r of rows) {
      if (pat.careerHint.split('、').some((h) => r.jobs.some((j) => j.includes(h)) || r.category.includes(h))) r.raw += 2.5;
    }
  }

  rows.sort((a, b) => b.raw - a.raw);
  const max = rows.length ? rows[0].raw : 1;
  const scored = rows.map((r, i) => ({
    rank: i + 1,
    category: r.category,
    score: Math.max(45, Math.min(98, Math.round(55 + (r.raw / max) * 40))),
    matched: r.matched,
    jobs: r.jobs,
    reason: `命盤中的${r.matched.join('、')}對應此類工作的特質。`,
  }));

  const top = scored.slice(0, 5);
  const guanStars = guanEff.stars.map((s) => s.name);
  const avoid = buildAvoid(guanStars, mingEff.stars.map((s) => s.name));
  return { top, all: scored, avoid, guanStars, borrowed: guanEff.borrowed, borrowedFrom: guanEff.from };
}

function brightBonus(s) {
  return ({ 廟: 1.5, 旺: 1, 得: 0.6, 利: 0.3, 平: 0, 閑: -0.3, 陷: -1 })[s.brightness] ?? 0;
}

function buildAvoid(guanStars, mingStars) {
  const all = [...guanStars, ...mingStars];
  const out = [];
  if (all.includes('七殺') || all.includes('破軍')) out.push('高度重複、沒有變化的例行工作，會磨掉你的衝勁。');
  if (all.includes('紫微')) out.push('完全沒有決策權、只能聽命行事的位置。');
  if (all.includes('天同') || all.includes('天相')) out.push('高壓業績淘汰制、每天廝殺的環境，會壓掉你的優點。');
  if (all.includes('巨門')) out.push('需要八面玲瓏、完全不能得罪人的角色。');
  if (all.includes('天機')) out.push('十年如一日、沒有新東西可學的工作。');
  if (all.includes('武曲')) out.push('純靠交際圓融、沒有具體數字可衡量的職位。');
  if (all.includes('太陰') || all.includes('天梁')) out.push('速成、投機、需要走灰色地帶的行業。');
  if (!out.length) out.push('沒有特別要避開的類型，重點在於選一個能長期累積的領域。');
  return out.slice(0, 4);
}

/** 早年 / 中年 / 晚年 */
function buildStages(chart, ctx) {
  const groups = [
    { key: '早年', range: [0, 35], label: '早年運（約 0 至 35 歲）', hint: '奠定基礎、學習與試錯的階段' },
    { key: '中年', range: [36, 60], label: '中年運（約 36 至 60 歲）', hint: '收成與承擔的階段，事業與財富的主戰場' },
    { key: '晚年', range: [61, 120], label: '晚年運（約 61 歲以後）', hint: '守成、傳承與心境的階段' },
  ];

  return groups.map((g) => {
    const list = chart.decadals.filter((d) => d.ageRange[1] >= g.range[0] && d.ageRange[0] <= g.range[1]);
    const scores = list.map((d) => scoreDecadal(chart, ctx, d));
    const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b.score, 0) / scores.length) : 50;
    const best = scores.slice().sort((a, b) => b.score - a.score)[0];
    const worst = scores.slice().sort((a, b) => a.score - b.score)[0];

    const paras = [];
    for (const s of scores) {
      paras.push(`${s.ageRange[0]}～${s.ageRange[1]}歲（${s.yearRange[0]}～${s.yearRange[1]}年）走${pal(s.palaceName)}${s.starText}，${s.summary}`);
    }

    return {
      key: g.key,
      label: g.label,
      hint: g.hint,
      score: avg,
      level: levelOf(avg),
      decadals: scores,
      best: best ? `最好的一段是 ${best.ageRange[0]}～${best.ageRange[1]}歲（${best.score}分）` : '',
      worst: worst ? `要留意的一段是 ${worst.ageRange[0]}～${worst.ageRange[1]}歲（${worst.score}分）` : '',
      paragraphs: paras,
      advice: stageAdvice(g.key, avg),
    };
  });
}

function stageAdvice(key, score) {
  if (key === '早年') {
    if (score >= 70) return '早年運勢不錯，資源與機會相對到位。建議在這個階段大膽試錯、累積專業與人脈，不要太早求穩定。';
    if (score >= 55) return '早年平順但沒有特別加持，靠的是自己努力。重點是找到一個值得長期投入的領域，不要在低價值的事上耗太久。';
    return '早年較辛苦，資源少、阻力多。這個階段的價值在「把本事練起來」，不要跟同齡人比外在成就，比的是十年後誰站得住。';
  }
  if (key === '中年') {
    if (score >= 70) return '中年是你的主場，事業與財富的關鍵收成期。建議在這段時間把資源集中投入一到兩件事，並開始建立可以留下來的資產。';
    if (score >= 55) return '中年運勢平穩，適合穩紮穩打。不要在這個階段做太大的冒險，把現有的基礎做深、做寬比重新開始有利。';
    return '中年較有起伏，容易在事業或家庭上遇到考驗。建議降低槓桿、保留現金、專注在一條主線上，撐過這段會有厚積薄發的機會。';
  }
  if (score >= 70) return '晚年運勢佳，是享福與傳承的階段。建議提早規劃資產配置與健康管理，讓好運有東西可以承接。';
  if (score >= 55) return '晚年平順，重點在於健康與心境。建議在中年就把退休金流與醫療準備做好，晚年就能過得自在。';
  return '晚年較需留意健康與財務的穩定。建議中年時就開始強制儲蓄、定期健檢，並培養能安放心神的興趣。';
}

function scoreDecadal(chart, ctx, d) {
  const palace = chart.palaces.find((p) => p.index === d.index);
  const base = scorePalace(chart, palace ? palace.name : '命宮');
  let raw = base.score;

  // 大限四化：飛入本命十二宮
  const [lu, quan, ke, ji] = d.mutagen || [];
  const notes = [];
  const findPalaceOf = (starName) => {
    for (const p of chart.palaces) {
      if ([...p.majorStars, ...p.minorStars].some((s) => s.name === starName)) return p.name;
    }
    return null;
  };
  if (lu) { const at = findPalaceOf(lu); if (at) { raw += 6; notes.push(`大限${lu}化祿入${pal(at)}，這十年${at}方面有機會與資源`); } }
  if (quan) { const at = findPalaceOf(quan); if (at) { raw += 4; notes.push(`大限${quan}化權入${pal(at)}，這十年在${at}方面能掌握主導權`); } }
  if (ke) { const at = findPalaceOf(ke); if (at) { raw += 3; notes.push(`大限${ke}化科入${pal(at)}，這十年${at}方面有名聲與貴人`); } }
  if (ji) { const at = findPalaceOf(ji); if (at) { raw -= 7; notes.push(`大限${ji}化忌入${pal(at)}，這十年要特別留意${at}方面的執著與阻礙`); } }

  const score = Math.max(10, Math.min(96, Math.round(raw)));
  const stars = palace ? palace.majorStars.map((s) => s.name + (s.brightness ? `(${s.brightness})` : '')) : [];
  const starText = stars.length ? `（${stars.join('、')}）` : '（空宮）';

  let summary;
  if (score >= 78) summary = '是相當好的一段運，適合積極布局與擴張。';
  else if (score >= 65) summary = '運勢向上，努力有回報，可以主動出擊。';
  else if (score >= 52) summary = '運勢平穩，宜穩紮穩打、按部就班。';
  else if (score >= 40) summary = '運勢有起伏，決策要保守，不宜擴張與借貸。';
  else summary = '這段較為辛苦，重點是守成與健康，避免重大投資與冒險。';

  return {
    index: d.index, palaceName: d.palaceName, ageRange: d.ageRange, yearRange: d.yearRange,
    heavenlyStem: d.heavenlyStem, earthlyBranch: d.earthlyBranch,
    score, level: levelOf(score), stars, starText, summary, notes,
    mutagen: d.mutagen,
  };
}

function buildDecadalTable(chart, ctx) {
  return chart.decadals.map((d) => scoreDecadal(chart, ctx, d));
}

/** 十二宮逐宮明細 */
function buildPalaceDetails(chart, ctx) {
  return chart.palaces.slice().sort((a, b) => {
    const order = ['命宮', '兄弟', '夫妻', '子女', '財帛', '疾厄', '遷移', '僕役', '官祿', '田宅', '福德', '父母'];
    return order.indexOf(a.name) - order.indexOf(b.name);
  }).map((p) => {
    const s = scorePalace(chart, p.name);
    const eff = effectiveMajors(chart, p.name);
    const paras = [];
    if (eff.borrowed) paras.push(`本宮無主星，借對宮「${eff.from}」的${eff.stars.map((x) => x.name).join('、') || '星曜'}論斷。`);
    for (const st of eff.stars) {
      const txt = STAR_PALACE[st.name]?.[p.name];
      if (txt) paras.push(`【${st.name}${st.brightness ? `（${st.brightness}）` : ''}】${txt}`);
      if (st.mutagen) paras.push(`【${st.name}化${st.mutagen}】${MUTAGEN_PALACE[st.mutagen]?.[p.name] || MUTAGEN_MEANING[st.mutagen].desc}`);
    }
    const minors = p.minorStars.map((x) => x.name);
    for (const m of minors) {
      if (LUCKY_STARS[m]) paras.push(`【${m}】${LUCKY_STARS[m].desc}`);
      else if (TOUGH_STARS[m]) paras.push(`【${m}】${TOUGH_STARS[m].desc}`);
      else if (ADJ_STARS[m]) paras.push(`【${m}】${ADJ_STARS[m].desc}`);
    }
    const notable = p.adjectiveStars.map((x) => x.name).filter((n) => ADJ_STARS[n]);
    if (notable.length) {
      paras.push(`【雜曜】${notable.slice(0, 5).map((n) => `${n}：${ADJ_STARS[n].desc}`).join(' ')}`);
    }
    return {
      name: p.name,
      full: PALACE_MEANING[p.name]?.full || p.name,
      role: PALACE_MEANING[p.name]?.role || '',
      meaning: PALACE_MEANING[p.name]?.desc || '',
      branch: p.earthlyBranch,
      stem: p.heavenlyStem,
      isBody: p.isBodyPalace,
      score: s.score,
      level: levelOf(s.score),
      majorStars: p.majorStars,
      minorStars: p.minorStars,
      adjectiveStars: p.adjectiveStars,
      borrowed: eff.borrowed,
      paragraphs: paras,
    };
  });
}

/** 當年流年 */
function buildYearly(chart, targetDate) {
  const d = targetDate ? new Date(targetDate) : new Date();
  const iso = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  let h;
  try { h = chart._astro.horoscope(iso, 4); } catch { return null; }
  if (!h) return null;
  const yearly = h.yearly;
  const decadal = h.decadal;
  const findPalaceOf = (starName) => {
    for (const p of chart.palaces) {
      if ([...p.majorStars, ...p.minorStars].some((s) => s.name === starName)) return p.name;
    }
    return null;
  };
  const notes = [];
  const [lu, quan, ke, ji] = yearly?.mutagen || [];
  if (lu) { const at = findPalaceOf(lu); if (at) notes.push({ type: '祿', text: `流年${lu}化祿入${pal(at)}：今年在${PALACE_MEANING[at]?.role || at}方面有機會與收穫。` }); }
  if (quan) { const at = findPalaceOf(quan); if (at) notes.push({ type: '權', text: `流年${quan}化權入${pal(at)}：今年在${PALACE_MEANING[at]?.role || at}方面能掌握主導權，但壓力也大。` }); }
  if (ke) { const at = findPalaceOf(ke); if (at) notes.push({ type: '科', text: `流年${ke}化科入${pal(at)}：今年在${PALACE_MEANING[at]?.role || at}方面有貴人與名聲。` }); }
  if (ji) { const at = findPalaceOf(ji); if (at) notes.push({ type: '忌', text: `流年${ji}化忌入${pal(at)}：今年要特別留意${PALACE_MEANING[at]?.role || at}方面的糾結與阻礙，重大決定放慢。` }); }

  const yearPalace = chart.palaces.find((p) => p.index === yearly?.index);
  const dPalace = chart.palaces.find((p) => p.index === decadal?.index);
  return {
    year: d.getFullYear(),
    solarDate: iso,
    yearlyPalace: yearPalace ? yearPalace.name : '',
    yearlyStars: yearPalace ? yearPalace.majorStars.map((s) => s.name) : [],
    decadalPalace: dPalace ? dPalace.name : '',
    decadalRange: decadal ? `${decadal.heavenlyStem}${decadal.earthlyBranch}` : '',
    ageName: h.age?.nominalAge || null,
    notes,
  };
}

export { buildYearly };
