// 排盤核心：包裝 iztro，產生統一的命盤物件與分析用 context
import { astro } from '../iztro-shim.js?v=e69bf8b5';

export const PALACE_ORDER = ['命宮', '兄弟', '夫妻', '子女', '財帛', '疾厄', '遷移', '僕役', '官祿', '田宅', '福德', '父母'];

export const PALACE_MEANING = {
  命宮: { full: '命宮', role: '本命', desc: '一生的個性、天賦、格局與人生主軸。看這個人「是誰」。' },
  兄弟: { full: '兄弟宮', role: '手足合夥', desc: '兄弟姊妹、平輩、合夥人的關係與助力。也看創業夥伴與資金往來。' },
  夫妻: { full: '夫妻宮', role: '感情婚姻', desc: '配偶的樣貌與性格、婚姻品質、感情的模式與課題。' },
  子女: { full: '子女宮', role: '子嗣桃花', desc: '子女緣分與親子關係。也看合夥、投資、桃花與性生活。' },
  財帛: { full: '財帛宮', role: '財源', desc: '賺錢的方式、金錢觀、現金流的順逆。看「錢怎麼來」。' },
  疾厄: { full: '疾厄宮', role: '健康', desc: '體質、易生的疾病、意外傷害與情緒對身體的影響。' },
  遷移: { full: '遷移宮', role: '外出際遇', desc: '出外的際遇、貴人、社會給你的評價。也看搬遷與外派。' },
  僕役: { full: '僕役宮', role: '人際部屬', desc: '朋友、同事、部屬的品質與助力。看「誰在你身邊」。' },
  官祿: { full: '官祿宮', role: '事業', desc: '事業型態、工作能力、職場成就與適合的行業。' },
  田宅: { full: '田宅宮', role: '不動產家運', desc: '房產、家宅、居住環境與家庭的整體氣場。也是財庫。' },
  福德: { full: '福德宮', role: '內心福報', desc: '精神生活、興趣嗜好、內心的安定與享受。也看祖德與晚年心境。' },
  父母: { full: '父母宮', role: '長輩上司', desc: '父母緣分、與長輩上司的關係、受庇蔭的程度。也是文書宮。' },
};

const LUCKY = ['文昌', '文曲', '左輔', '右弼', '天魁', '天鉞'];
const TOUGH = ['擎羊', '陀羅', '火星', '鈴星', '地空', '地劫'];
const BRIGHT_SCORE = { 廟: 2, 旺: 1.5, 得: 1, 利: 0.5, 平: 0, 閑: -0.5, 陷: -1.5 };

/** 主入口：排盤 */
export function buildChart(input) {
  const { date, hourIndex, gender, calendar = 'solar', isLeap = true, name = '' } = input;
  validate(input);
  const a = calendar === 'lunar'
    ? astro.byLunar(date, Number(hourIndex), gender, !!isLeap, true, 'zh-TW')
    : astro.bySolar(date, Number(hourIndex), gender, true, 'zh-TW');

  const palaces = a.palaces.map((p) => ({
    index: p.index,
    name: p.name,
    isBodyPalace: p.isBodyPalace,
    isOriginalPalace: p.isOriginalPalace,
    heavenlyStem: p.heavenlyStem,
    earthlyBranch: p.earthlyBranch,
    majorStars: p.majorStars.map(cleanStar),
    minorStars: p.minorStars.map(cleanStar),
    adjectiveStars: p.adjectiveStars.map(cleanStar),
    changsheng12: p.changsheng12,
    boshi12: p.boshi12,
    jiangqian12: p.jiangqian12,
    suiqian12: p.suiqian12,
    decadal: p.decadal,
    ages: p.ages,
  }));

  const decadals = a.decadalList().map((d) => ({
    index: d.index,
    palaceName: d.palaceName,
    ageRange: d.ageRange,
    yearRange: d.yearRange,
    heavenlyStem: d.heavenlyStem,
    earthlyBranch: d.earthlyBranch,
    mutagen: d.mutagen,
  })).sort((x, y) => x.ageRange[0] - y.ageRange[0]);

  return {
    name,
    gender: a.gender,
    calendar,
    solarDate: a.solarDate,
    lunarDate: a.lunarDate,
    chineseDate: a.chineseDate,
    time: a.time,
    timeRange: a.timeRange,
    hourIndex: Number(hourIndex),
    sign: a.sign,
    zodiac: a.zodiac,
    soul: a.soul,
    body: a.body,
    fiveElementsClass: a.fiveElementsClass,
    soulBranch: a.earthlyBranchOfSoulPalace,
    bodyBranch: a.earthlyBranchOfBodyPalace,
    palaces,
    decadals,
    _astro: a,
  };
}

function cleanStar(s) {
  return { name: s.name, type: s.type, brightness: s.brightness || '', mutagen: s.mutagen || '' };
}

function validate(input) {
  const { date, hourIndex, gender } = input;
  if (!/^\d{4}-\d{1,2}-\d{1,2}$/.test(String(date || ''))) throw new Error('日期格式須為 YYYY-M-D');
  const y = Number(String(date).split('-')[0]);
  if (y < 1900 || y > 2100) throw new Error('年份僅支援 1900 至 2100');
  const h = Number(hourIndex);
  if (!Number.isInteger(h) || h < 0 || h > 12) throw new Error('時辰序號須為 0 到 12');
  if (!['男', '女'].includes(gender)) throw new Error('性別須為 男 或 女');
}

/** 三方四正：本宮 + 對宮 + 三合兩宮 */
export function sanfangIndexes(idx) {
  return [idx, (idx + 6) % 12, (idx + 4) % 12, (idx + 8) % 12];
}

/** 建立格局判定用的 context */
export function makeContext(chart) {
  const byName = {};
  for (const p of chart.palaces) byName[p.name] = p;
  const at = (i) => chart.palaces.find((p) => p.index === ((i % 12) + 12) % 12);

  const allNames = (p) => p ? [...p.majorStars, ...p.minorStars, ...p.adjectiveStars].map((s) => s.name) : [];

  return {
    palaceOf: (n) => byName[n],
    palaceAt: at,
    majorsIn: (n) => (byName[n]?.majorStars || []).map((s) => s.name),
    minorsIn: (n) => (byName[n]?.minorStars || []).map((s) => s.name),
    starsIn: (n) => allNames(byName[n]),
    majorsAtIndex: (i) => (at(i)?.majorStars || []).map((s) => s.name),
    minorsAtIndex: (i) => (at(i)?.minorStars || []).map((s) => s.name),
    adjAtIndex: (i) => (at(i)?.adjectiveStars || []).map((s) => s.name),
    mutagensAtIndex: (i) => {
      const p = at(i);
      if (!p) return [];
      return [...p.majorStars, ...p.minorStars].map((s) => s.mutagen).filter(Boolean);
    },
    sanfangStars: (n) => {
      const p = byName[n];
      if (!p) return [];
      return sanfangIndexes(p.index).flatMap((i) => allNames(at(i)));
    },
    sanfangMutagens: (n) => {
      const p = byName[n];
      if (!p) return [];
      return sanfangIndexes(p.index).flatMap((i) => {
        const q = at(i);
        return q ? [...q.majorStars, ...q.minorStars].map((s) => s.mutagen).filter(Boolean) : [];
      });
    },
    findStar: (starName) => {
      for (const p of chart.palaces) {
        const hit = [...p.majorStars, ...p.minorStars, ...p.adjectiveStars].find((s) => s.name === starName);
        if (hit) return { ...hit, palace: p.name, index: p.index };
      }
      return null;
    },
    palaceIndexOf: (starName, palaceName) => {
      if (palaceName) return byName[palaceName]?.index ?? -1;
      for (const p of chart.palaces) {
        if ([...p.majorStars, ...p.minorStars, ...p.adjectiveStars].some((s) => s.name === starName)) return p.index;
      }
      return -1;
    },
    sameStar: (a, b) => {
      for (const p of chart.palaces) {
        const names = allNames(p);
        if (a === '化祿星' || b === '化祿星') {
          const other = a === '化祿星' ? b : a;
          const hasLu = [...p.majorStars, ...p.minorStars].some((s) => s.mutagen === '祿');
          if (hasLu && names.includes(other)) return true;
          continue;
        }
        if (names.includes(a) && names.includes(b)) return true;
      }
      return false;
    },
  };
}

/** 計算某宮的吉凶分數（0-100） */
export function scorePalace(chart, palaceName) {
  const ctx = makeContext(chart);
  const p = ctx.palaceOf(palaceName);
  if (!p) return { score: 50, detail: [] };
  const detail = [];
  let raw = 0;

  // 主星亮度
  for (const s of p.majorStars) {
    const b = BRIGHT_SCORE[s.brightness] ?? 0;
    raw += b * 4;
    if (s.brightness) detail.push(`${s.name}${s.brightness}${b >= 1 ? '（力量強）' : b < 0 ? '（力量弱）' : ''}`);
  }
  if (p.majorStars.length === 0) {
    raw -= 2;
    detail.push('本宮無主星，需借對宮');
  }

  // 三方四正 吉星煞星
  const sf = ctx.sanfangStars(palaceName);
  const luckyHit = LUCKY.filter((s) => sf.includes(s));
  const toughHit = TOUGH.filter((s) => sf.includes(s));
  raw += luckyHit.length * 4;
  raw -= toughHit.length * 4;
  if (luckyHit.length) detail.push(`三方見吉星：${luckyHit.join('、')}`);
  if (toughHit.length) detail.push(`三方見煞星：${toughHit.join('、')}`);

  // 本宮煞星更重
  const ownTough = TOUGH.filter((s) => ctx.starsIn(palaceName).includes(s));
  raw -= ownTough.length * 3;
  if (ownTough.length) detail.push(`本宮坐煞：${ownTough.join('、')}`);

  // 祿存
  if (sf.includes('祿存')) { raw += 6; detail.push('三方見祿存，主財祿'); }
  if (ctx.starsIn(palaceName).includes('祿存')) { raw += 4; detail.push('本宮坐祿存'); }

  // 四化
  const mut = ctx.sanfangMutagens(palaceName);
  const ownMut = ctx.mutagensAtIndex(p.index);
  for (const m of mut) {
    if (m === '祿') raw += 5;
    else if (m === '權') raw += 4;
    else if (m === '科') raw += 3;
    else if (m === '忌') raw -= 6;
  }
  for (const m of ownMut) {
    if (m === '忌') { raw -= 3; detail.push('本宮見化忌，是這一生較執著、較易卡關的地方'); }
    else detail.push(`本宮見化${m}`);
  }

  const score = Math.max(5, Math.min(98, Math.round(50 + raw * 1.35)));
  return { score, detail };
}

export function levelOf(score) {
  if (score >= 82) return { label: '極佳', tone: 'great' };
  if (score >= 70) return { label: '良好', tone: 'good' };
  if (score >= 55) return { label: '平順', tone: 'ok' };
  if (score >= 42) return { label: '起伏', tone: 'warn' };
  return { label: '辛苦', tone: 'bad' };
}
