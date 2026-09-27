// 命盤分析 → 口語講稿（語音解說用）
// 規格：docs/voice-contract.md 第 4 節。
// 原則：不是把報告照念，而是「阿良在跟一個人說話」：第一人稱、短句、台灣口語。
// 所有數字（分數、年齡）都從結構化欄位來，交給 toSpeakable 轉成中文念法。
// 不用亂數、不看現在時間：同樣的輸入一定產生同樣的講稿。
import { splitSentences, toSpeakable, estimateSeconds } from './speech-text.js?v=e69bf8b5';
import { MAJOR_STARS } from '../kb/stars.js?v=e69bf8b5';
import { STAR_PALACE_A } from '../kb/star-palace-a.js?v=e69bf8b5';
import { STAR_PALACE_B } from '../kb/star-palace-b.js?v=e69bf8b5';
import { MUTAGEN_PALACE } from '../kb/aux.js?v=e69bf8b5';

export const NARRATION_VERSION = 1;
export const CHAPTER_ORDER = ['intro', 'overview', 'career', 'wealth', 'family', 'love', 'health', 'work', 'stages', 'year', 'outro'];

const STAR_PALACE = { ...STAR_PALACE_A, ...STAR_PALACE_B };

const CHAPTER_TITLES = {
  intro: '開場', overview: '整體命格', career: '事業', wealth: '財運', family: '家庭',
  love: '感情', health: '健康', work: '適合的工作', stages: '人生三階段', year: '今年運勢', outro: '結語',
};

const ASPECT_OF = { career: '事業', wealth: '財運', family: '家庭', love: '感情', health: '健康' };

const CALL_SUFFIX = ['先生', '小姐', '太太', '大哥', '大姐', '哥', '姐', '老師', '醫師', '董', '總'];

/* ───────── 口語對照表 ───────── */

const BRIGHT_SPOKEN = {
  廟: '在廟位，力量很強',
  旺: '在旺位，力量強',
  得: '在得地的位置，力量中上',
  利: '在利位，力量中等偏好',
  平: '在平位，力量中性',
  閑: '在閑位，力量稍微弱一點',
  陷: '落陷，優點比較不容易發揮',
};

const LEVEL_SPOKEN = {
  極佳: '非常好', 良好: '算是不錯', 平順: '屬於平順', 起伏: '會有一些起伏', 辛苦: '相對辛苦一點',
};
// 跟上一章同一個等級時，換個說法（「也是平順」），聽起來才不像在念表格
const LEVEL_SPOKEN_ALSO = {
  極佳: '一樣非常好', 良好: '也算不錯', 平順: '也是平順', 起伏: '一樣有些起伏', 辛苦: '一樣比較辛苦',
};

// 宮位在口語裡代表什麼
const ROLE_SPOKEN = {
  // 子女不放「桃花」：語音是要寄給客人的，已婚的人聽到「桃花可以主動一點」很尷尬
  命宮: '你自己的狀態和想法', 兄弟: '兄弟姊妹和合夥', 夫妻: '感情和婚姻', 子女: '子女和晚輩',
  財帛: '賺錢和現金流', 疾厄: '健康', 遷移: '出外發展', 僕役: '朋友和同事',
  官祿: '工作事業', 田宅: '房子和家運', 福德: '心情和精神生活', 父母: '長輩和上司',
};

const LUCKY_SPOKEN = {
  文昌: '做事有條理，文書和合約比較順',
  文曲: '表達力好，說話有溫度',
  左輔: '身邊有得力的幫手',
  右弼: '常常有人在背後幫你',
  天魁: '遇到困難，會有長輩或上司拉你一把',
  天鉞: '常常有意想不到的援手',
};

const TOUGH_SPOKEN = {
  擎羊: '容易有衝突，做事也比較衝',
  陀羅: '事情容易拖、容易反覆',
  火星: '脾氣比較急，變化也來得突然',
  鈴星: '表面平靜，心裡容易焦躁',
  地空: '想法容易太理想，計畫趕不上變化',
  地劫: '容易有預期之外的支出或損失',
};

// 健康章的吉星、煞星要講身體，不是講人際
const HEALTH_LUCKY = '身體出狀況的時候，比較容易遇到好醫生、及時化解';
const HEALTH_TOUGH = {
  // 不說「開刀」：語音是要給客人聽的，房仲念出開刀兩個字只會嚇人
  擎羊: '平常開車、運動要多注意安全，小傷口也別輕忽',
  陀羅: '慢性的小毛病容易拖著不好',
  火星: '容易有發炎或突發的急症',
  鈴星: '壓力容易悶在心裡，變成身體的負擔',
  地空: '體力容易虛耗，要記得休息',
  地劫: '體力容易透支，不要硬撐',
};

// 找不到具體優勢／風險時，各章自己的說法
const GENERIC = {
  career: { both: '成果主要看你自己怎麼累積', good: '這方面外力加持不多，成果要靠你自己一步一步累積', risk: '這方面沒有明顯的煞星干擾' },
  wealth: { both: '錢主要靠你自己一點一滴存下來', good: '錢要靠你自己一點一滴累積，外力幫忙不多', risk: '沒有明顯的破財訊號' },
  family: { both: '家裡大致平穩，用心經營就好', good: '家裡的事比較要靠你自己用心經營', risk: '家裡沒有明顯的沖破' },
  love: { both: '關係大致平穩，用心經營就好', good: '感情要靠你自己用心經營，外力幫忙不多', risk: '感情上沒有明顯的沖破' },
  health: { both: '只要作息正常，底子不差', good: '', risk: '沒有明顯的煞星干擾，只要作息正常，底子不差' },
};

// 流年四化落在各宮，各宮自己的說法（同一句套在每一宮會出現「健康這方面可以主動一點」這種怪話）
const YEAR_SPOKEN = {
  命宮: {
    祿: '你自己的狀態會比較順，人緣和機會都不錯，可以主動一點',
    權: '你會比較有主見，也容易被交付責任，壓力要記得自己調節',
    科: '你的形象和口碑會加分，做事容易被看見',
    忌: '你心裡容易糾結、想得比較多，重大決定記得放慢一點',
  },
  兄弟: {
    祿: '跟兄弟姊妹、合作夥伴的互動比較順，合作有機會帶來收穫',
    權: '跟兄弟姊妹或合夥人之間，你比較有主導權，但也容易意見不合',
    科: '兄弟姊妹或合作夥伴當中，容易有人幫你說話',
    忌: '跟兄弟姊妹或合夥人比較容易有誤會，金錢往來要講清楚',
  },
  夫妻: {
    祿: '感情和婚姻比較甜，另一半也可能帶來助力',
    權: '感情裡誰做主的問題會比較明顯，記得多聽對方的想法',
    科: '感情和婚姻比較和諧，另一半容易是你的助力',
    忌: '感情和婚姻比較容易有糾結，有話要好好說，不要悶著',
  },
  子女: {
    祿: '子女和晚輩方面有好消息，家裡的小事也比較順心',
    權: '子女和晚輩的事情，你會花比較多心力去安排',
    科: '子女和晚輩容易有讓你高興的表現',
    忌: '子女和晚輩的事情比較讓你操心，多一點耐心溝通',
  },
  財帛: {
    祿: '賺錢的機會比較多，現金流也比較順，可以積極一點',
    權: '你對錢比較有掌控力，收入有機會增加，但花費也會跟著變大',
    科: '財務比較穩，理財規劃容易有好結果',
    忌: '現金流比較容易卡，投資和借貸要保守，大筆花費放慢一點',
  },
  疾厄: {
    祿: '身體的恢復力比較好，很適合趁今年養成運動和作息的好習慣',
    權: '體力不錯，但容易逞強，記得不要過度操勞',
    科: '身體有狀況時比較容易遇到好醫生，定期健檢會有幫助',
    忌: '身體比較容易累積小毛病，作息要規律，不舒服就早點看醫生',
  },
  遷移: {
    祿: '出外發展、跑外務、出差旅行比較有收穫，可以多往外走',
    權: '在外面比較有舞台和話語權，但也比較忙碌奔波',
    科: '在外面容易遇到貴人，口碑也比較好',
    忌: '出外比較容易不順，交通安全要多留意，遠行計畫放慢一點',
  },
  僕役: {
    祿: '朋友和同事的助力比較多，人脈值得多經營',
    權: '在朋友和同事之間你比較有影響力，但要留意不要太強勢',
    科: '朋友和同事當中，容易有人幫你一把',
    忌: '跟朋友和同事比較容易有誤會，作保和借錢要特別小心',
  },
  官祿: {
    祿: '工作事業有機會，也有收穫，可以主動爭取',
    權: '工作上你拿得到主導權，但壓力也比較大',
    科: '工作上容易被看見，有好的評價',
    忌: '工作上比較容易有糾結和阻礙，換工作或大決策記得放慢一點',
  },
  田宅: {
    祿: '房子和家運比較順，置產或整理居家都是好時機',
    權: '家裡的大小事比較需要你出面做主',
    科: '家裡比較和睦，居家的事情容易有好的安排',
    忌: '房子和家裡的事情比較容易有狀況，買賣房產要多比較、多確認',
  },
  福德: {
    祿: '心情比較開朗，也比較懂得享受生活',
    權: '想法比較堅定，但也容易給自己太多壓力',
    科: '心境比較平穩，適合學習和沉澱',
    忌: '心裡容易想太多、睡不好，記得給自己留一點放鬆的時間',
  },
  父母: {
    祿: '跟長輩和上司的關係比較好，容易得到照顧',
    權: '長輩或上司對你的要求比較多，也可能交給你重要的任務',
    科: '長輩和上司容易欣賞你，文書和證照方面也比較順',
    忌: '跟長輩或上司比較容易有摩擦，文書合約要看仔細',
  },
};

// 格局 → 一句白話（對你有什麼意義）
const PATTERN_SPOKEN = {
  'ziwei-tianfu': '一生格局大，既能開創，也守得住',
  junchen: '一生貴人多，身邊有能幫你成事的人',
  gujun: '你容易什麼事都自己扛，要刻意培養人手、學會授權',
  fuxiang: '一生衣食不缺，做事穩健，容易得到別人的信任和資源',
  jiyuetongliang: '適合穩定、靠專業和規劃立足的工作，不適合衝鋒陷陣',
  shapolang: '人生變動大、起伏大，但爆發力也最強，敢衝才有收穫，只是千萬不要一次押上身家',
  'riyue-bingming': '名聲和財富都有機會兼得，跟父母的緣分也好',
  'riyue-fanbei': '年輕時比較辛苦，付出多、回收慢，但中年以後常常厚積薄發',
  huotan: '容易有突然爆發的機會和財運，賺到了要馬上落袋，不要再全部押回去',
  lingtan: '一樣有爆發的機會，只是醞釀比較久、過程比較磨人，見好就要收',
  shuangluchaoyuan: '財源不斷，遇到困難常常有資源可以化解',
  lumajiaochi: '越動越有財，適合往外跑、跨區域發展',
  caiyinjiayin: '一生受照顧、被信任，可以穩穩累積地位和財富',
  xingjijiayin: '容易被牽連、替人扛責任，作保和背書要特別小心',
  yangliangchangl: '考試和證照運好，走專業、公職、教育這條路很有利',
  shizhongyinyue: '外表低調但有真本事，越沉得住氣越有成就',
  lingchangtuowu: '要特別留意交通安全，情緒低潮的時候不要做重大決定',
  kongjiaming: '想法容易太理想，錢也容易來了又走，投資理財要格外保守',
  'yangtuo-jiaming': '阻力比較多，最好的方法是認定一條路走到底，把執著變成專業',
  'wenxing-jiaming': '聰明好學，有文采也有才藝，適合靠知識和表達吃飯',
  'kuiyue-jiaming': '一生貴人多，遇到困難常常有人拉你一把',
  'zuoyou-jiaming': '做事有人幫忙分擔，人緣好，適合帶團隊',
  'ma-tou-dai-jian': '個性剛烈、衝勁十足，放在競爭激烈的舞台就是猛將',
  'sanqi-jiahui': '機會、實權和名聲都有機會到手，是很難得的底子',
};

// 各章用不同的起頭與轉折，避免每章都一樣
const ASPECT_STYLE = {
  career: {
    score: (s, lv) => `先從事業開始，你的事業是${s}分，${lv}。`,
    // 不要寫「宮坐的是」：宮坐念起來跟「工作」完全同音，客人會聽成「事業工作的是」
    stars: (p, names) => `${p}，也就是事業宮，主星是${names}`,
    good: '你的優勢是，', warn: '要留意的是，', act: '我的建議是，', act2: '另外，',
  },
  wealth: {
    score: (s, lv) => `財運的部分，${s}分，${lv}。`,
    stars: (p, names) => `管錢的${p}，主星是${names}`,
    good: '加分的地方是，', warn: '比較要小心的是，', act: '具體的做法，', act2: '還有，',
  },
  family: {
    score: (s, lv) => `再來聊家庭，這一塊是${s}分，${lv}。`,
    stars: (p, names) => `代表家運的${p}，是${names}`,
    good: '好的一面是，', warn: '需要注意的是，', act: '在家裡，你可以這樣做，', act2: '另外，',
  },
  love: {
    score: (s, lv) => `接下來是感情，分數是${s}分，${lv}。`,
    stars: (p, names) => `你的${p}，主星是${names}`,
    good: '幫你加分的是，', warn: '容易卡住的地方是，', act: '給你一個建議，', act2: '也提醒你，',
  },
  health: {
    score: (s, lv) => `最後一個面向是健康，${s}分，${lv}。`,
    stars: (p, names) => `${p}的主星是${names}`,
    good: '比較好的是，', warn: '要多注意的是，', act: '保養上，', act2: '還有，',
  },
};

/* ───────── 小工具 ───────── */

const pal = (n) => (!n ? '' : (String(n).endsWith('宮') ? String(n) : String(n) + '宮'));
const bare = (n) => (String(n || '') === '命宮' ? '命宮' : String(n || '').replace(/宮$/, ''));
const joinAnd = (arr) => (arr.length <= 1 ? (arr[0] || '') : `${arr.slice(0, -1).join('、')}和${arr[arr.length - 1]}`);
const levelLabel = (lv) => (lv && typeof lv === 'object' ? lv.label : lv) || '';
const levelWord = (label, also) => (also ? LEVEL_SPOKEN_ALSO[label] : LEVEL_SPOKEN[label]) || '屬於平順';

function endSentence(s) {
  const t = String(s || '').trim().replace(/[，、：；,]+$/, '');
  if (!t) return '';
  return /[。！？]$/.test(t) ? t : t + '。';
}

// 去掉句尾標點，方便接在別的句子裡
function stripEnd(s) {
  return String(s || '').trim().replace(/[。！？，、：；]+$/, '');
}

// 第三人稱的「他」改成跟對方說話的「你」（「他人」「他們」不動）
function toYou(s) {
  return String(s || '').replace(/[他她](?=人生)/g, '你').replace(/[他她](?![人們])/g, '你');
}

// 書面標記清掉：引號、破折號、亮度括號、書面術語
function cleanWritten(s) {
  return String(s || '')
    .replace(/[「」『』]/g, '')
    .replace(/SOP/g, '標準流程')
    .replace(/[A-Za-z0-9]*[A-Za-z][A-Za-z0-9]*/g, '') // 知識庫偶爾夾英文縮寫，念出來會變成字母
    .replace(/——|—/g, '，')
    .replace(/[（(][廟旺得利平閑陷][）)]/g, '')
    .replace(/所坐星曜對應的器官/g, '對應的部位')
    .replace(/本命帶祿/g, '命宮帶化祿')
    .replace(/但也主/g, '但也代表')
    .replace(/，也主/g, '，也代表')
    // 書面語轉口語：「交易易有」念起來像結巴，易有／需／務必都是寫報告的說法
    .replace(/(?<!容)易有/g, '容易有')
    .replace(/需(?![要求])/g, '需要')
    .replace(/務必/g, '一定要')
    .replace(/。；/g, '；')
    .replace(/。{2,}/g, '。');
}

// 句子層級要整句拿掉的（條件句、術語句，念出來會誤導）
const JARGON_SENTENCE = /(若|廟旺者|落陷者|化祿主|化忌則|財蔭夾|刑忌夾|遇煞星|坐.{2}宮主|宮見.{1,3}主)/;
// 子句層級要拿掉的
const JARGON_CLAUSE = /(落陷|廟旺|十四星|次桃花|坐.{2}宮|宮見|星坐)/;

/**
 * 從知識庫的解說裡抽出「可以直接念」的重點句
 * @param {string} text 原文
 * @param {number} maxSent 最多幾句
 * @param {number} maxChars 最多幾個字（至少保留一句）
 */
function gist(text, maxSent = 2, maxChars = 90) {
  const t = cleanWritten(text);
  const sents = t.split(/(?<=[。！？])/).map((s) => s.trim()).filter(Boolean);
  const out = [];
  let len = 0;
  for (const s of sents) {
    if (JARGON_SENTENCE.test(s)) continue;
    const body = s.replace(/[。！？]$/, '');
    const clauses = body.split('，').filter((c) => c && !JARGON_CLAUSE.test(c));
    if (!clauses.length) continue;
    let kept = clauses.join('，');
    if (/^(這是|是)/.test(kept)) continue;
    kept = kept.replace(/^但/, '');
    if (kept.length < 5) continue;
    const sentence = kept + '。';
    if (out.length && len + sentence.length > maxChars) break;
    out.push(sentence);
    len += sentence.length;
    if (out.length >= maxSent) break;
  }
  return out.join('');
}

function firstSentence(text) {
  const s = cleanWritten(text).split(/(?<=[。！？])/)[0] || '';
  return s.trim();
}

function patternMeaning(p) {
  if (PATTERN_SPOKEN[p.id]) return PATTERN_SPOKEN[p.id];
  const m = /[，。]主([^。]+)。/.exec(p.desc || '');
  if (m) return m[1];
  return stripEnd(firstSentence(p.desc || ''));
}

function starBright(s) {
  if (!s || !s.brightness || !BRIGHT_SPOKEN[s.brightness]) return '';
  return `${s.name}${BRIGHT_SPOKEN[s.brightness]}`;
}

// 客人的虛歲；流年資料沒有就是 null
function ageOf(analysis) {
  const a = analysis?.year?.ageName;
  return Number.isFinite(a) ? a : null;
}

// 「宜晚婚、早婚易生變」只對還年輕的人有意義；三十歲以上（或不知道年齡）就整句拿掉
function dropMarriageTiming(text, analysis) {
  const age = ageOf(analysis);
  if (age !== null && age < 30) return text;
  return String(text || '').split(/(?<=[。！？])/).filter((x) => !/晚婚|早婚/.test(x)).join('');
}

function palaceByName(chart, name) {
  return (chart?.palaces || []).find((p) => p.name === name) || null;
}

function oppositeOf(chart, palace) {
  if (!palace) return null;
  return (chart?.palaces || []).find((p) => p.index === (palace.index + 6) % 12) || null;
}

/* ───────── 稱呼 ───────── */

function sanitizeName(s) {
  return String(s ?? '')
    .replace(/[\s<>{}[\]\\/"'`&;|$]/g, '')
    .slice(0, 12);
}

// 回傳念出來的稱呼，或 ''（代表只說「你好」）
// useChartName 為 false：呼叫端（面板的稱呼欄）已經決定好稱呼，空白就是「不要叫名字」，不再退回排盤姓名
export function resolveCallName(callName, chartName, { useChartName = true } = {}) {
  const c = sanitizeName(callName);
  if (c) return c;
  if (useChartName === false) return '';
  const n = sanitizeName(chartName);
  if (!n || n.length > 8) return '';
  for (const suf of CALL_SUFFIX) {
    if (n.endsWith(suf) && n.length > suf.length) return n;
  }
  return '';
}

/* ───────── 優勢／風險 字串轉口語 ───────── */
// analyze.mjs 產生的優勢、風險是固定句型的字串，這裡依句型轉成口語，並排優先順序。

function mutagenLine(star, m, palaceName) {
  const mp = MUTAGEN_PALACE[m]?.[palaceName];
  return mp ? stripEnd(firstSentence(mp)) : '';
}

function strengthSpoken(str, ctx) {
  const s = String(str || '');
  const health = ctx.chapterId === 'health';
  let m;
  if ((m = /^(.+?)化(祿|權|科)：/.exec(s))) {
    const line = mutagenLine(m[1], m[2], ctx.palace);
    return { rank: 0, star: m[1], text: `${m[1]}化${m[2]}就在這裡，${line || '是這方面最主要的助力'}` };
  }
  if ((m = /^(.+?)坐守.+?：/.exec(s)) && LUCKY_SPOKEN[m[1]]) return { rank: 1, key: m[1], text: `有${m[1]}坐守，${health ? HEALTH_LUCKY : LUCKY_SPOKEN[m[1]]}` };
  // 「財源」念起來跟「裁員」同音，改說「收入來源」
  if (/^祿存坐守/.test(s)) return { rank: 1, key: '祿存', text: health ? '有祿存坐守，體質的底子比較穩' : '有祿存坐守，這方面有穩定的收入來源和底氣' };
  // 祿馬交馳講的是往外跑賺錢，放在健康、感情、家庭章都答非所問
  if (/^祿馬交馳/.test(s)) return ['health', 'love', 'family'].includes(ctx.chapterId) ? null : { rank: 2, text: '你有祿馬交馳，越往外跑越有收穫' };
  if ((m = /^(.+?)(廟|旺)：/.exec(s)) && LUCKY_SPOKEN[m[1]]) return { rank: 3, name: m[1], text: `${m[1]}${BRIGHT_SPOKEN[m[2]]}，${health ? HEALTH_LUCKY : LUCKY_SPOKEN[m[1]]}` };
  if (/^三方會祿存/.test(s)) return { rank: 4, key: '祿存', text: health ? '有祿存在旁邊照應，體質的底子比較穩' : '有祿存在旁邊支援，這方面有穩定的收入來源和底氣' };
  if ((m = /^三方會(.+?)：/.exec(s)) && LUCKY_SPOKEN[m[1]]) return { rank: 5, key: m[1], text: `有${m[1]}在旁邊幫忙，${health ? HEALTH_LUCKY : LUCKY_SPOKEN[m[1]]}` };
  if (/^本宮無明顯吉星/.test(s)) return { rank: 9, generic: true, text: GENERIC[ctx.chapterId].good };
  return null; // 主星廟旺：前面介紹主星時已經講過，不重複
}

function riskSpoken(str, ctx) {
  const s = String(str || '');
  const health = ctx.chapterId === 'health';
  let m;
  if ((m = /^(.+?)化忌：/.exec(s))) {
    const line = mutagenLine(m[1], '忌', ctx.palace);
    return { rank: 0, star: m[1], text: `${m[1]}化忌落在這裡，${line || '這是你最放不下、也最容易卡住的地方'}` };
  }
  if ((m = /^(.+?)坐守.+?：/.exec(s)) && TOUGH_SPOKEN[m[1]]) return { rank: 1, key: m[1], text: `${m[1]}就在這裡，${health ? HEALTH_TOUGH[m[1]] : TOUGH_SPOKEN[m[1]]}` };
  if ((m = /^(.+?)落陷：/.exec(s))) {
    if (ctx.mainStars.includes(m[1])) return null; // 主星落陷前面已經講過
    return { rank: 2, name: m[1], text: `${m[1]}落陷，優點比較不容易發揮，要靠後天多努力補` };
  }
  if ((m = /^(.+?)：/.exec(s)) && ctx.patternsByName[m[1]]) {
    if (health) return null; // 格局講的是做人做事，放在健康章會答非所問
    // 前面已經講過的格局，不再整段重講，只點一下（排序也往後放）
    if (ctx.said && ctx.said.has(m[1])) return { rank: 6, pattern: m[1], text: `前面提到的${m[1]}，在這方面也要留意` };
    return { rank: 3, pattern: m[1], text: `你有${m[1]}這個格局，${patternMeaning(ctx.patternsByName[m[1]])}` };
  }
  if ((m = /^三方會(.+?)：/.exec(s)) && TOUGH_SPOKEN[m[1]]) return { rank: 4, key: m[1], text: `旁邊有${m[1]}的影響，${health ? HEALTH_TOUGH[m[1]] : TOUGH_SPOKEN[m[1]]}` };
  if (/^此領域未見明顯煞忌/.test(s)) return { rank: 9, generic: true, text: GENERIC[ctx.chapterId].risk };
  return null;
}

// 健康章好幾顆吉星的說法都一樣，合成一句
function mergeHealthLucky(items) {
  const hits = items.filter((r) => r.key && r.text.endsWith(HEALTH_LUCKY));
  if (hits.length < 2) return items;
  const merged = { ...hits[0], text: `有${joinAnd(hits.map((r) => r.key))}照應，${HEALTH_LUCKY}` };
  return items.filter((r) => !hits.includes(r) || r === hits[0]).map((r) => (r === hits[0] ? merged : r));
}

function pickSpoken(list, fn, n, ctx) {
  const out = [];
  (Array.isArray(list) ? list : []).forEach((x, i) => {
    const r = fn(x, ctx);
    if (r && r.text) out.push({ ...r, i });
  });
  // 別的章已經用過同一顆輔星的說法，就往後排，換一個講，聽起來才不會一直重複
  if (ctx.said && !ctx.full && ctx.chapterId !== 'health') for (const r of out) if (r.key && ctx.said.has('star:' + r.key)) r.rank += 5;
  out.sort((a, b) => a.rank - b.rank || a.i - b.i);
  const seen = new Set();
  const uniq = [];
  for (const r of out) {
    if (seen.has(r.text)) continue; // 同一種說法不要重複
    seen.add(r.text);
    uniq.push(r);
  }
  return uniq.slice(0, n);
}

// 建議句：書面標記轉口語
// age：虛歲（analysis.year.ageName），不知道就是 null
function actionSpoken(a, age = null) {
  let t = cleanWritten(a);
  const late = /這組星曜宜晚婚（建議\s*(\d+)\s*歲以後）/.exec(t);
  // 「宜晚婚、三十歲以後」只對還沒到那個年紀的人有意義；已經過了（或不知道年齡）就換成不分年齡都成立的說法
  if (late && !(age !== null && age < Number(late[1]))) {
    return '感情裡要先把自己的重心和脾氣穩下來，有話慢慢說，關係才走得長久。';
  }
  // 家庭建議原句沒有動詞，逗號後面又接另一件事，念起來像斷在半句
  t = t.replace(/每週固定一個不談事情只相處的時段，家庭問題多半不是事情本身，是相處密度不夠。/, '每週固定安排一個不談事情、只相處的時段。家裡的問題，多半不是事情本身，而是相處的時間不夠。');
  return t
    .replace(/這組星曜宜晚婚（建議\s*(\d+)\s*歲以後）/, '你的感情宜晚婚，最好$1歲以後')
    .replace(/\s*(\d+)\s*/g, '$1')
    .replace(/[（(]([^）)]*)[）)]/g, '，$1，')
    .replace(/：/g, '，')
    .replace(/，，+/g, '，')
    .replace(/，([。！？；])/g, '$1');
}

/* ───────── 各章內容 ───────── */

function buildOverview(chart, analysis, full, said) {
  const ov = analysis.overview || {};
  const ming = palaceByName(chart, '命宮');
  const majors = ming?.majorStars || [];
  const lines = [];
  const hasScore = Number.isFinite(ov.score);
  const scoreLine = hasScore ? `命宮的分數是${ov.score}分，${levelWord(levelLabel(ov.level))}` : '';

  let stars = majors;
  let borrowedFrom = null;
  if (!majors.length) {
    const opp = oppositeOf(chart, ming);
    stars = opp?.majorStars || [];
    borrowedFrom = opp;
  }

  if (!borrowedFrom) {
    lines.push(`先講結論。你是${joinAnd(majors.map((s) => s.name))}坐命的人${scoreLine ? `，${scoreLine}` : ''}。`);
    const b = majors.filter((s) => s.brightness !== '陷').map((s) => starBright(s)).filter(Boolean); // 落陷在後面另外講
    if (b.length) lines.push(`${b.join('；')}。`);
    // 分數偏低、主星卻很強：不補一句，客人會覺得前後矛盾
    if (hasScore && ov.score < 55 && majors.some((s) => s.brightness === '廟' || s.brightness === '旺')) {
      lines.push('主星本身是有力量的，分數不高，是因為命宮還受到其他星曜的牽制。');
    }
  } else {
    lines.push(`先講結論。${hasScore ? `你的命宮分數是${ov.score}分，${levelWord(levelLabel(ov.level))}。` : ''}`);
    if (stars.length) {
      lines.push(`你的命宮沒有主星，要借對面遷移宮的${joinAnd(stars.map((s) => s.name))}來看。`);
      lines.push('空宮不代表不好，意思是你的可塑性很高，也比較容易受環境和身邊的人影響。');
    } else {
      lines.push('你的命宮沒有主星，可塑性很高，也比較容易受環境和身邊的人影響。');
    }
  }

  const kws = (ov.keywords || []).filter((k) => k && k !== '受夾').slice(0, 3);
  if (kws.length >= 2 && (full || stars.length < 2)) lines.push(`如果用幾個詞來形容你，就是${joinAnd(kws)}。`);

  const two = stars.length > 1;
  stars.slice(0, 2).forEach((s, i) => {
    const sp = STAR_PALACE[s.name]?.命宮;
    if (!sp) return;
    let g;
    if (full) g = gist(sp, 4, 200);
    else if (!two) g = gist(sp, 2, 90);
    else g = gist(sp, 1, 60);
    if (!g) return;
    const lead = two ? (i === 0 ? `從${s.name}來看，` : `再加上${s.name}，`) : `${s.name}坐命的人，`;
    lines.push(lead + g);
  });
  if (!borrowedFrom) {
    const weak = majors.filter((s) => s.brightness === '陷').map((s) => s.name);
    if (weak.length) lines.push(`只是${joinAnd(weak)}落陷，這些優點要靠後天多花力氣，才會真正發揮出來。`);
  }

  // 命宮本身的四化
  for (const s of [...majors, ...(ming?.minorStars || [])]) {
    if (!s.mutagen) continue;
    if (!full && !majors.includes(s)) continue;
    const line = mutagenLine(s.name, s.mutagen, '命宮');
    if (line) lines.push(`另外，${s.name}化${s.mutagen}就在你的命宮，${line}。`);
  }

  if (full && ming) {
    const own = (ming.minorStars || []).map((x) => x.name);
    for (const k of own.filter((x) => LUCKY_SPOKEN[x])) lines.push(`你的命宮有${k}，${LUCKY_SPOKEN[k]}。`);
    for (const k of own.filter((x) => TOUGH_SPOKEN[x])) lines.push(`命宮裡也有${k}，${TOUGH_SPOKEN[k]}。`);
    const opp = oppositeOf(chart, ming);
    if (opp?.majorStars?.length && !borrowedFrom) {
      const core = MAJOR_STARS[opp.majorStars[0].name]?.core;
      lines.push(`再看對面的遷移宮，是${joinAnd(opp.majorStars.map((s) => s.name))}，代表你在外面給人的樣子。${core ? toYou(firstSentence(core)) : ''}`);
    }
  }

  // 身宮
  const body = bare(ov.bodyPalace);
  if (ov.bodyPalace) {
    if (body === '命宮' || body === '命') {
      lines.push('你的身宮跟命宮在同一個位置，代表你這一生的重心就是經營你自己，個性會越走越鮮明。');
    } else {
      lines.push(`你的身宮在${pal(body)}，代表你後天努力的重心，會放在${ROLE_SPOKEN[body] || pal(body)}上面，三十歲以後會越來越明顯。`);
    }
  }
  if (full && chart.soul && chart.body && chart.fiveElementsClass) {
    lines.push(`補充一下，你的命主是${chart.soul}，身主是${chart.body}，五行局是${chart.fiveElementsClass}。`);
  }

  // 格局
  const pats = Array.isArray(analysis.patterns) ? analysis.patterns : [];
  const good = pats.filter((p) => ['great', 'good'].includes(p.level));
  const mixed = pats.filter((p) => p.level === 'mixed');
  const bad = pats.filter((p) => ['warn', 'bad'].includes(p.level));
  const goodShow = full ? good : good.slice(0, 1);
  if (goodShow.length) {
    const first = goodShow[0];
    if (good.length === 1) lines.push(`你的命盤有一個好格局，叫做${first.name}，意思是${patternMeaning(first)}。`);
    else lines.push(`你的命盤有${good.length}個好格局，最值得一提的是${first.name}，意思是${patternMeaning(first)}。`);
    for (const p of goodShow.slice(1)) lines.push(`還有${p.name}，${patternMeaning(p)}。`);
  }
  const mixedShow = full ? mixed : (goodShow.length && bad.length ? [] : mixed.slice(0, 1));
  for (const p of mixedShow) lines.push(goodShow.length ? `另外還有${p.name}的格局，${patternMeaning(p)}。` : `你的命盤有${p.name}的格局，${patternMeaning(p)}。`);
  const badShow = full ? bad : bad.slice(0, 1);
  badShow.forEach((p, i) => {
    lines.push(`${i === 0 ? '另外有一個要留意的格局，' : '還有，'}叫做${p.name}，${patternMeaning(p)}。`);
  });
  for (const p of [...goodShow, ...mixedShow, ...badShow]) said.add(p.name);
  if (badShow.length) lines.push('這不是宿命，是提醒你哪裡容易踩坑，知道了就能避開。');

  return lines.join('');
}

function buildAspect(chapterId, chart, analysis, full, prevLabel, said) {
  const key = ASPECT_OF[chapterId];
  const a = analysis.aspects?.[key];
  if (!a) return { text: '', label: prevLabel };
  const st = ASPECT_STYLE[chapterId];
  const lines = [];
  const mainName = bare(a.mainPalace);
  const mainSpoken = pal(mainName);
  const label = levelLabel(a.level);

  lines.push(st.score(a.score, levelWord(label, label && label === prevLabel)));
  const healthBrief = chapterId === 'health' && !full;
  // 健康分數在「良好」以上：先講好的一面，弱點最多一個
  const healthGood = healthBrief && ['極佳', '良好'].includes(label);
  let healthWeak = '';

  // 主軸：主宮主星
  const stars = Array.isArray(a.stars) ? a.stars : [];
  if (stars.length) {
    const names = joinAnd(stars.map((s) => s.name));
    if (a.borrowed) {
      const opp = oppositeOf(chart, palaceByName(chart, mainName));
      const from = opp ? pal(opp.name) : '對宮';
      lines.push(`${mainSpoken}本身沒有主星，要借對面${from}的${names}來看。`);
    } else {
      const strong = stars.filter((s) => (full ? s.brightness && s.brightness !== '陷' : ['廟', '旺'].includes(s.brightness)));
      const b = strong.map((s) => starBright(s));
      lines.push(`${st.stars(mainSpoken, names)}${b.length ? `，${b.join('；')}` : ''}。`);
    }
    // 精華版健康章只講一顆主星的弱點：兩顆星各念一串器官，客人聽起來像全身都有問題
    const gistStars = !full && healthBrief ? stars.slice(0, 1) : stars.slice(0, 2);
    gistStars.forEach((s, i) => {
      const txt = STAR_PALACE[s.name]?.[mainName];
      if (!txt) return;
      const two = gistStars.length > 1;
      let g = full ? gist(txt, 3, 160) : (two || healthBrief ? gist(txt, 1, 60) : gist(txt, 2, 75));
      g = dropMarriageTiming(g, analysis);
      if (!g) return;
      if (chart.gender === '男') g = g.replace(/婦科或/g, '').replace(/、婦科/g, '');
      if (!two && /^適合/.test(g)) g = '你' + g;
      let lead = two ? (i === 0 ? `從${s.name}來看，` : `再加上${s.name}，`) : '';
      if (healthBrief && stars.length > 1) lead = `從${s.name}來看，`;
      if (healthGood) {
        // 健康分數好：弱點延後到優點之後再講，而且先講底子不錯
        healthWeak = `底子雖然不錯，還是要留意，${lead}${g}`;
        return;
      }
      lines.push(lead + g);
    });
    if (!a.borrowed) {
      const weak = stars.filter((s) => s.brightness === '陷').map((s) => s.name);
      if (weak.length) lines.push(`只是${joinAnd(weak)}落陷，這方面要多靠後天的努力。`);
    }
  }

  // 優勢、風險
  const patternsByName = {};
  for (const p of analysis.patterns || []) patternsByName[p.name] = p;
  const ctx = { chapterId, palace: mainName, mainStars: stars.map((s) => s.name), patternsByName, said, full };
  const goodsAll = pickSpoken(a.strengths, strengthSpoken, 6, ctx);
  const risksAll = pickSpoken(a.risks, riskSpoken, 6, ctx);

  // 借來的主星帶四化：優勢／風險清單只看本宮，這裡補講
  const mentioned = new Set([...goodsAll, ...risksAll].map((r) => r.star).filter(Boolean));
  if (a.borrowed || full) {
    for (const s of stars) {
      if (!s.mutagen || mentioned.has(s.name)) continue;
      if (!full && chapterId === 'health' && s.mutagen !== '忌') continue;
      const line = mutagenLine(s.name, s.mutagen, mainName);
      if (!line) continue;
      lines.push(s.mutagen === '忌' ? `要特別說的是，${s.name}化忌，${line}。` : `而且${s.name}化${s.mutagen}，${line}。`);
    }
  }

  // 同一顆星不要前一句誇、下一句又說它化忌或落陷：風險清單裡出現的星，就不拿來當優勢講
  const riskNames = new Set(risksAll.flatMap((r) => [r.key, r.star, r.name]).filter(Boolean));
  const clash = (g) => [g.key, g.star, g.name].some((x) => x && riskNames.has(x));
  const specificGood = mergeHealthLucky(goodsAll.filter((g) => !g.generic && !clash(g)));
  let specificRisk = risksAll.filter((r) => !r.generic);
  // 健康分數好的時候，已經講了一個主星弱點，就不再疊「旁邊有煞星」這種間接影響；
  // 煞星、化忌直接落在疾厄宮（rank 0、1）才講
  const healthSideDropped = healthGood && !!healthWeak && specificRisk.length > 0 && specificRisk.every((r) => r.rank > 1);
  if (healthSideDropped) specificRisk = [];
  const nShow = full ? 3 : 1;
  if (!specificGood.length && !specificRisk.length) {
    if (healthWeak) lines.push(healthWeak);
    else lines.push(`這方面沒有特別的吉星幫忙，也沒有煞星干擾，${GENERIC[chapterId].both}。`);
  } else {
    if (specificGood.length) {
      lines.push(`${st.good}${specificGood.slice(0, nShow).map((g) => g.text).join('；')}。`);
    } else if (full && GENERIC[chapterId].good) {
      lines.push(`${GENERIC[chapterId].good}。`);
    }
    if (healthWeak) lines.push(healthWeak);
    if (specificRisk.length) lines.push(`${st.warn}${specificRisk.slice(0, nShow).map((r) => r.text).join('；')}。`);
    else if (!healthSideDropped) lines.push(`${specificGood.length && !healthWeak ? '而且' : ''}${GENERIC[chapterId].risk}。`);
    if (!full && chapterId !== 'health') {
      for (const r of [...specificGood.slice(0, nShow), ...specificRisk.slice(0, nShow)]) if (r.key) said.add('star:' + r.key);
    }
  }

  if (full) {
    const mingStars = palaceByName(chart, '命宮')?.majorStars || [];
    for (const s of mingStars) {
      const t = MAJOR_STARS[s.name]?.[chapterId];
      if (!t) continue;
      let g = dropMarriageTiming(toYou(gist(t, 3, 160)), analysis);
      if (chart.gender === '男') g = g.replace(/婦科或/g, '').replace(/、婦科/g, '');
      if (g) lines.push(`從你本命的${s.name}來看，${chapterId === 'health' ? '要留意' : ''}${g}`);
    }
    const plus = [];
    const minus = [];
    for (const p of analysis.patterns || []) {
      const e = p.effect?.[key];
      if (e && Math.abs(e) >= 6) (e > 0 ? plus : minus).push(p.name);
    }
    const these = (n) => (n > 2 ? '這幾個格局' : n === 2 ? '這兩個格局' : '這個格局');
    if (plus.length) lines.push(`${joinAnd(plus)}${these(plus.length)}，對你的${key}是加分的${minus.length ? `；${joinAnd(minus)}則是減分` : ''}。`);
    else if (minus.length) lines.push(`${joinAnd(minus)}${these(minus.length)}，對你的${key}是減分的。`);
  }

  // 建議
  const acts = (a.actions || []).filter((x) => !/^依命盤星曜/.test(x));
  const connectors = [st.act2, '還有，', '最後，'];
  acts.slice(0, full ? acts.length : 1).forEach((x, i) => {
    const lead = i === 0 ? st.act : connectors[Math.min(i - 1, connectors.length - 1)];
    lines.push(`${lead}${endSentence(actionSpoken(x, ageOf(analysis)))}`);
  });

  if (chapterId === 'health') lines.push('提醒你，這只是體質傾向，不能取代醫生的診斷。');
  return { text: lines.join(''), label };
}

function buildWork(analysis, full) {
  const c = analysis.careers;
  if (!c || !Array.isArray(c.top) || !c.top.length) return '';
  const ord = ['第一名', '第二名', '第三名', '第四名', '第五名'];
  const top = c.top.slice(0, full ? 5 : 3);
  const lines = [`再來講適合你的工作，我幫你排了前${top.length}名。`];
  const parts = top.map((r, i) => {
    const jobs = (r.jobs || []).filter((j) => !/[A-Za-z]/.test(j)).slice(0, full ? 5 : 3);
    const scorePart = full ? `，${r.score}分` : '';
    return `${ord[i]}是${r.category}${scorePart}${jobs.length ? `，像${joinAnd(jobs)}` : ''}`;
  });
  lines.push(parts.join('；') + '。');
  const matched = [...new Set(top.flatMap((r) => r.matched || []))].filter(Boolean).slice(0, 3);
  if (matched.length) lines.push(`這是依照你命盤裡的${joinAnd(matched)}排出來的。`);
  const avoid = (c.avoid || []).filter(Boolean);
  if (avoid.length) {
    if (/^沒有特別要避開/.test(avoid[0])) {
      lines.push('至於要避開的類型，你倒是沒有特別的禁忌，重點是選一個能長期累積的領域。');
    } else {
      const shown = avoid.slice(0, full ? avoid.length : 1).map((x) => stripEnd(cleanWritten(x)));
      lines.push(`比較不建議的，是${shown.join('；還有')}。`);
    }
  }
  return lines.join('');
}

const STAGE_INFO = {
  早年: { speak: '早年，大約是35歲以前', start: 0, end: 35 },
  中年: { speak: '中年，也就是36到60歲', start: 36, end: 60 },
  晚年: { speak: '晚年，61歲以後', start: 61, end: 999 },
};

function decadalSummary(d) {
  const s = String(d.summary || '');
  if (s.startsWith('這段')) return s.replace(/^這段/, '這十年');
  return '這十年' + s;
}

function buildStages(analysis, full) {
  const stages = Array.isArray(analysis.stages) ? analysis.stages : [];
  if (!stages.length) return '';
  const age = Number.isFinite(analysis.year?.ageName) ? analysis.year.ageName : null;
  const lines = ['接下來，人生分成三個階段來看。'];
  const pastHeads = [];
  const spokenDecadals = new Set();

  // 精華版只給「現在這個階段」建議；年齡不明時給第一個階段
  let focusKey = stages[0]?.key;
  if (age !== null) {
    const cur = stages.find((s) => STAGE_INFO[s.key] && age >= STAGE_INFO[s.key].start && age <= STAGE_INFO[s.key].end);
    if (cur) focusKey = cur.key;
  }

  for (const st of stages) {
    const info = STAGE_INFO[st.key];
    if (!info) continue;
    const past = age !== null && age > info.end;
    const head = `${info.speak}，平均${st.score}分，${levelWord(levelLabel(st.level))}`;
    if (past && !full) {
      pastHeads.push(`${info.speak.split('，')[0]}平均${st.score}分`);
      continue;
    }
    if (pastHeads.length) {
      lines.push(`${pastHeads.join('，')}，${pastHeads.length > 1 ? '這兩段你都已經走過來了' : '這段你已經走過來了'}。`);
      pastHeads.length = 0;
    }
    // 已經過了中年，就不要再說「中年就要準備好」這種話
    const adv = cleanWritten(st.advice).split(/(?<=。)/).map((x) => x.trim()).filter(Boolean);
    let advice = '';
    if (full) advice = adv.join('');
    else if (st.key === focusKey) {
      // 第一句只是重複分數等級，精華版只念第二句（真正的建議）
      const tip = adv.length > 1 ? adv[1] : '';
      if (!(age !== null && age > 60 && /中年/.test(tip))) advice = tip;
    }
    // 已經走進這個階段的人，不要再叫他「提早」規劃
    if (age !== null && age >= info.start) advice = advice.replace(/提早/g, '');
    lines.push(`${head}。${advice}`);
    if (full) {
      for (const d of st.decadals || []) {
        // 大限會跨兩個階段，同一段只講一次
        if (d.ageRange[0] > 95 || spokenDecadals.has(d.ageRange[0])) continue;
        spokenDecadals.add(d.ageRange[0]);
        lines.push(`${d.ageRange[0]}到${d.ageRange[1]}歲，${d.score}分，${decadalSummary(d)}`);
      }
    }
  }

  const all = Array.isArray(analysis.decadals) ? analysis.decadals.slice().sort((x, y) => x.ageRange[0] - y.ageRange[0]) : [];
  // 最好／要留意的十年只往後看二十五年左右，而且不提八十歲以後才開始的大運（對客人講八九十歲的分數很奇怪）
  let pool = all.filter((d) => d.ageRange[0] < 80);
  let lead = '整體來看，';
  if (age !== null) {
    pool = pool.filter((d) => d.ageRange[0] <= age + 25);
    const cur = all.find((d) => d.ageRange[0] <= age && age <= d.ageRange[1]);
    if (cur) {
      lines.push(`你現在正走在${cur.ageRange[0]}到${cur.ageRange[1]}歲這步大運，分數是${cur.score}分，${decadalSummary(cur)}`);
      pool = pool.filter((d) => d.ageRange[0] > cur.ageRange[0]);
    } else {
      pool = pool.filter((d) => d.ageRange[1] >= age);
    }
    // 候選只到往後二十五年左右，要說出範圍，不然聽起來像「這輩子最好的十年」，跟前面晚年平均分數對不起來
    lead = '接下來這幾步大運裡，';
  }
  if (pool.length >= 2) {
    const best = pool.slice().sort((x, y) => y.score - x.score || x.ageRange[0] - y.ageRange[0])[0];
    const worst = pool.slice().sort((x, y) => x.score - y.score || x.ageRange[0] - y.ageRange[0])[0];
    lines.push(`${lead}最好的十年是${best.ageRange[0]}到${best.ageRange[1]}歲，有${best.score}分，可以好好把握。`);
    if (worst !== best && worst.score < best.score) {
      if (worst.score < 55) lines.push(`要特別留意的是${worst.ageRange[0]}到${worst.ageRange[1]}歲，只有${worst.score}分，那段時間記得多留一點退路。`);
      else lines.push(`相對低一點的是${worst.ageRange[0]}到${worst.ageRange[1]}歲，也有${worst.score}分，不算差，穩穩走就好。`);
    }
  } else if (pool.length === 1) {
    const d = pool[0];
    lines.push(`下一個十年是${d.ageRange[0]}到${d.ageRange[1]}歲，有${d.score}分，${decadalSummary(d)}`);
  }
  return lines.join('');
}

function buildYear(analysis, full) {
  const y = analysis.year;
  if (!y || !Array.isArray(y.notes) || !y.notes.length) return '';
  const parsed = [];
  for (const n of y.notes) {
    const m = /^流年(.+?)化(祿|權|科|忌)入(.+?)：/.exec(String(n.text || ''));
    if (!m) continue;
    parsed.push({ type: m[2], star: m[1], palace: bare(m[3]) });
  }
  if (!parsed.length) return '';
  const lines = [];
  lines.push(Number.isFinite(y.year) ? `再來看今年，也就是${y.year}年。` : '再來看今年的運勢。');
  if (full && y.yearlyPalace) lines.push(`今年的流年命宮走到你的${pal(y.yearlyPalace)}，重心會跟${ROLE_SPOKEN[bare(y.yearlyPalace)] || pal(y.yearlyPalace)}有關。`);
  const order = full ? ['祿', '權', '科', '忌'] : ['祿', '忌'];
  let first = true;
  for (const t of order) {
    const p = parsed.find((x) => x.type === t);
    if (!p) continue;
    const role = ROLE_SPOKEN[p.palace] || pal(p.palace);
    const today = first ? '今年' : '';
    first = false;
    const own = YEAR_SPOKEN[p.palace]?.[t];
    if (t === '祿') lines.push(`好消息是，${today}${p.star}化祿落在${pal(p.palace)}，${own || `${role}這方面有機會，也有收穫`}。`);
    if (t === '權') lines.push(`${today}${p.star}化權落在${pal(p.palace)}，${own || `${role}這方面你拿得到主導權，但壓力也比較大`}。`);
    if (t === '科') lines.push(`${today}${p.star}化科落在${pal(p.palace)}，${own || `${role}這方面有貴人，也容易有好口碑`}。`);
    if (t === '忌') lines.push(`要提醒你的是，${today}${p.star}化忌落在${pal(p.palace)}，${own || `${role}這方面比較容易有糾結和阻礙，重大決定記得放慢一點`}。`);
  }
  return lines.join('');
}

function buildOutro(analysis, ctx) {
  const lines = ['好，最後幫你總結一下。'];
  const asp = ['事業', '財運', '家庭', '感情', '健康']
    .map((k) => ({ k, s: analysis.aspects?.[k]?.score }))
    .filter((x) => Number.isFinite(x.s));
  const title = String(analysis.overview?.title || '');
  const who = title && title !== '空宮坐命' ? `你是${joinAnd(title.replace(/坐命$/, '').split('、'))}坐命的人，` : '';
  if (asp.length >= 2) {
    const max = Math.max(...asp.map((x) => x.s));
    const min = Math.min(...asp.map((x) => x.s));
    const hi = asp.filter((x) => x.s === max).map((x) => x.k);
    const lo = asp.filter((x) => x.s === min).map((x) => x.k);
    if (max - min < 5) lines.push(`${who}五個面向的分數很接近，沒有特別的短板，重點是把你的優勢用出來。`);
    else lines.push(`${who}五個面向裡，${joinAnd(hi)}相對最好，${joinAnd(lo)}比較需要多花一點心思。`);
  } else if (who) {
    lines.push(`${who}把你的優勢用出來就對了。`);
  }
  lines.push('命理是幫你看清楚自己的一個角度，不是保證，重大決定還是要配合實際狀況、跟家人商量。');
  if (ctx.cta) lines.push(endSentence(ctx.cta));
  lines.push(`${ctx.callName ? `${ctx.callName}，` : ''}謝謝你聽到這裡，我是${ctx.speaker}，祝你一切順利，我們下次再聊。`);
  return lines.join('');
}

function buildIntro(ctx, chapterIds, minutes) {
  const lines = [];
  lines.push(`${ctx.callName ? `${ctx.callName}，你好` : '你好'}，我是${ctx.speaker}。`);
  if (ctx.disclosure) {
    if (ctx.voiceKind === 'clone') lines.push('先跟你說明，這段是用人工智慧模擬我的聲音念的，內容是我用紫微斗數幫你整理的重點。');
    else lines.push('這段先用電腦語音幫我念，內容是我用紫微斗數幫你整理的重點。');
  } else {
    lines.push('今天我用紫微斗數，幫你把命盤的重點整理了一下。');
  }

  const has = (id) => chapterIds.includes(id);
  const parts = [];
  if (has('overview')) parts.push('你整體的命格');
  const nAspects = ['career', 'wealth', 'family', 'love', 'health'].filter(has).length;
  if (nAspects === 5) parts.push('事業、財運、家庭、感情、健康五個面向');
  else if (nAspects) parts.push(['career', 'wealth', 'family', 'love', 'health'].filter(has).map((id) => ASPECT_OF[id]).join('、'));
  if (has('work')) parts.push('適合的工作');
  if (has('stages')) parts.push('人生三個階段');
  if (has('year')) parts.push('今年的運勢');
  const len = minutes >= 1 ? `全部聽完大約${minutes}分鐘` : '全部聽完不到一分鐘';
  if (parts.length === 5 && nAspects === 5) lines.push(`${len}，從整體命格、五大面向，一路講到適合的工作、人生階段和今年運勢。`);
  else if (parts.length > 1) lines.push(`${len}，會依序講${parts.slice(0, -1).join('、')}，還有${parts[parts.length - 1]}。`);
  else if (parts.length === 1) lines.push(`${len}，會講${parts[0]}。`);
  else lines.push(`${len}。`);
  return lines.join('');
}

/* ───────── 組裝 ───────── */

function makeChapter(id, text, dict) {
  const segments = [];
  let chars = 0;
  let secs = 0;
  for (const piece of splitSentences(text)) {
    const speak = toSpeakable(piece, dict ? { dict } : {});
    if (!speak || !/[\p{L}\p{N}]/u.test(speak)) continue;
    segments.push({ id: `${id}-${String(segments.length + 1).padStart(3, '0')}`, text: piece, speak });
    chars += speak.replace(/\s/g, '').length;
    secs += estimateSeconds(speak);
  }
  if (!segments.length) return null;
  return { id, index: 0, title: CHAPTER_TITLES[id], segments, chars, estSeconds: Math.round(secs), _secs: secs };
}

/**
 * 產生講稿
 * @param {object} chart buildChart() 的結果
 * @param {object} analysis analyze(chart) 的結果
 * @param {object} opts { mode, callName, speaker, voiceKind, disclosure, cta, pronounceDict }
 */
export function buildNarration(chart, analysis, opts = {}) {
  if (!chart || typeof chart !== 'object' || !Array.isArray(chart.palaces)) throw new Error('缺少命盤資料，無法產生講稿');
  if (!analysis || typeof analysis !== 'object') throw new Error('缺少命盤分析資料，無法產生講稿');
  const o = opts && typeof opts === 'object' ? opts : {};
  const mode = o.mode === 'full' ? 'full' : 'brief';
  const full = mode === 'full';
  const speakerRaw = sanitizeName(o.speaker);
  const speaker = speakerRaw && speakerRaw.length <= 10 ? speakerRaw : '阿良';
  const voiceKind = o.voiceKind === 'clone' ? 'clone' : 'generic';
  const disclosure = o.disclosure !== false;
  const callName = resolveCallName(o.callName, chart.name, { useChartName: o.useChartName !== false });
  const cta = typeof o.cta === 'string' ? o.cta.replace(/[\r\n<>]+/g, ' ').trim().slice(0, 200) : '';
  const dict = Array.isArray(o.pronounceDict) ? o.pronounceDict : undefined;
  const ctx = { speaker, voiceKind, disclosure, callName, cta };

  const said = new Set(); // 已經講過的格局
  const texts = { overview: buildOverview(chart, analysis, full, said) };
  let prevLabel = '';
  for (const id of ['career', 'wealth', 'family', 'love', 'health']) {
    const r = buildAspect(id, chart, analysis, full, prevLabel, said);
    texts[id] = r.text;
    if (r.text) prevLabel = r.label;
  }
  texts.work = buildWork(analysis, full);
  texts.stages = buildStages(analysis, full);
  texts.year = buildYear(analysis, full);
  texts.outro = buildOutro(analysis, ctx);

  const body = {};
  for (const id of CHAPTER_ORDER) {
    if (id === 'intro' || !texts[id]) continue;
    const ch = makeChapter(id, texts[id], dict);
    if (ch) body[id] = ch;
  }
  const bodyIds = Object.keys(body);
  const bodySecs = bodyIds.reduce((s, id) => s + body[id]._secs, 0);

  // 開場要講「大約幾分鐘」：先用暫定長度算一次，再用實際長度定案
  let intro = makeChapter('intro', buildIntro(ctx, bodyIds, Math.round((bodySecs + 30) / 60)), dict);
  const minutes = Math.round((bodySecs + (intro ? intro._secs : 0)) / 60);
  intro = makeChapter('intro', buildIntro(ctx, bodyIds, minutes), dict);

  const chapters = [];
  let totalSecs = 0;
  for (const id of CHAPTER_ORDER) {
    const ch = id === 'intro' ? intro : body[id];
    if (!ch) continue;
    const { _secs, ...clean } = ch;
    totalSecs += _secs;
    clean.index = chapters.length;
    chapters.push(clean);
  }

  return {
    version: NARRATION_VERSION,
    mode,
    speaker,
    callName,
    voiceKind,
    chapters,
    totalChars: chapters.reduce((s, c) => s + c.chars, 0),
    estSeconds: Math.round(totalSecs),
  };
}
