// 內建讀音字典（語音解說用）
// term：原文；say：送給語音引擎的替代寫法（全部用「只有一個讀音」的同音字）；
// reading：正確讀音（漢語拼音含聲調，台灣標準讀音）；note：說明與查證來源。
// notAfter / notBefore（選填）：前一個字／後一個字是這些時不替換。
//
// 查證原則：以教育部《重編國語辭典修訂本》為準（https://dict.revised.moe.edu.tw/）。
// 辭典沒有收的紫微術語，逐字核對各字在該意思下的讀音；查不到的不放。
// say 等於 term 的條目＝電腦語音本來就念得對，只當讀音備查。

export const PRONOUNCE_VERSION = 1;

// 「X得地位」這類「動詞＋得」後面接「地」開頭的詞，不是紫微的「得地」
const DE_NOT_AFTER = ['使', '覺', '顯', '值', '變', '懂', '記', '曉', '免', '省', '難', '怪', '捨', '獲', '取', '贏', '見', '顧', '說', '做', '過', '來', '弄', '搞', '落', '長', '覓'];
const DE_NOT_BEFORE = ['位', '方', '區', '點', '址', '段', '球', '圖', '震', '板', '毯', '帶', '理', '勢', '形', '主', '產', '價', '皮', '面', '基', '盤', '標', '租', '域', '底', '下', '上', '道', '質', '獄', '鐵', '瓜'];

// 「成長生活」「家長生日」：長念ㄓㄤˇ，不是「長生」
const CHANG_NOT_AFTER = ['成', '增', '助', '家', '校', '班', '股', '部', '院', '社', '局', '處', '科', '組', '隊', '市', '縣', '署', '師', '首', '兄', '族', '酋', '村', '里', '船', '機', '店', '會', '課', '所', '團', '董', '議', '司', '庭', '學', '官', '總', '營', '連', '排', '省', '區', '鎮', '州', '廳', '館', '警', '艦'];

// 「即將星期」「也將星光」：將念ㄐㄧㄤ，不是「將星」
const JIANG_NOT_AFTER = ['即', '將', '必', '終', '又', '也', '就', '才', '都', '還', '卻', '仍', '勢', '並', '亦', '恐', '行', '已', '若', '便', '皆', '均'];
const JIANG_NOT_BEFORE = ['期', '球', '座', '系', '空', '光', '際', '雲', '辰', '夜'];

export const PRONOUNCE = [
  // ── 主星與輔星 ──
  { term: '天相', say: '天象', reading: 'tiān xiàng', note: '宰相的相，四聲（教育部辭典「吉人天相」「宰相」皆念ㄒㄧㄤˋ）', notBefore: ['助'] },
  { term: '文曲星', say: '文屈星', reading: 'wén qū xīng', note: '教育部辭典「文曲星」念ㄨㄣˊ ㄑㄩ ㄒㄧㄥ，曲是一聲' },
  { term: '文曲', say: '文屈', reading: 'wén qū', note: '同「文曲星」，曲念一聲ㄑㄩ（台灣標準讀音）' },
  { term: '武曲星', say: '武屈星', reading: 'wǔ qū xīng', note: '教育部辭典「武曲星」念ㄨˇ ㄑㄩ ㄒㄧㄥ，曲是一聲' },
  { term: '武曲', say: '武屈', reading: 'wǔ qū', note: '同「武曲星」，曲念一聲ㄑㄩ' },
  { term: '陀羅', say: '陀羅', reading: 'tuó luó', note: '兩字都只有一個讀音，念得對，備查' },
  { term: '天鉞', say: '天越', reading: 'tiān yuè', note: '鉞念ㄩㄝˋ（教育部辭典），字少見，換成同音的越' },
  { term: '擎羊', say: '擎羊', reading: 'qíng yáng', note: '擎念ㄑㄧㄥˊ，念得對，備查' },
  { term: '紅鸞', say: '紅鸞', reading: 'hóng luán', note: '教育部辭典「紅鸞」念ㄏㄨㄥˊ ㄌㄨㄢˊ，備查' },
  { term: '天姚', say: '天姚', reading: 'tiān yáo', note: '姚念ㄧㄠˊ，只有一個讀音，備查' },
  { term: '華蓋', say: '華蓋', reading: 'huá gài', note: '教育部辭典「華蓋」念ㄏㄨㄚˊ ㄍㄞˋ，備查' },
  { term: '將星', say: '匠星', reading: 'jiàng xīng', note: '將領的將，四聲（教育部辭典「將星」念ㄐㄧㄤˋ ㄒㄧㄥ）', notAfter: JIANG_NOT_AFTER, notBefore: JIANG_NOT_BEFORE },
  { term: '化氣為將', say: '化氣圍匠', reading: 'huà qì wéi jiàng', note: '為念二聲ㄨㄟˊ（成為），將念四聲ㄐㄧㄤˋ（將領）' },
  { term: '長生', say: '常生', reading: 'cháng shēng', note: '十二長生的長，念ㄔㄤˊ（教育部辭典「長生」）', notAfter: CHANG_NOT_AFTER },
  { term: '臚傳', say: '爐船', reading: 'lú chuán', note: '教育部辭典「臚傳」念ㄌㄨˊ ㄔㄨㄢˊ；臚字少見、傳有兩個讀音，換同音字' },

  // ── 亮度、格局、宮位 ──
  { term: '得地', say: '德地', reading: 'dé dì', note: '得念二聲ㄉㄜˊ（教育部辭典「不得地」念ㄅㄨˋ ㄉㄜˊ ㄉㄧˋ）', notAfter: DE_NOT_AFTER, notBefore: DE_NOT_BEFORE },
  { term: '廟旺', say: '廟旺', reading: 'miào wàng', note: '念得對，備查' },
  { term: '落陷', say: '洛陷', reading: 'luò xiàn', note: '落念ㄌㄨㄛˋ（教育部辭典「陷落」念ㄒㄧㄢˋ ㄌㄨㄛˋ），避免念成ㄌㄚˋ' },
  { term: '僕役', say: '僕役', reading: 'pú yì', note: '教育部辭典「僕役」念ㄆㄨˊ ㄧˋ，備查' },
  { term: '殺破狼', say: '殺破狼', reading: 'shā pò láng', note: '念得對，備查' },
  { term: '君臣慶會', say: '君臣慶會', reading: 'jūn chén qìng huì', note: '會念ㄏㄨㄟˋ，念得對，備查' },
  { term: '府相朝垣', say: '府象潮垣', reading: 'fǔ xiàng cháo yuán', note: '府相＝天府天相，相念四聲；朝念ㄔㄠˊ（朝向、朝拜）' },
  { term: '朝垣', say: '潮垣', reading: 'cháo yuán', note: '朝念ㄔㄠˊ（教育部辭典「朝拜」念ㄔㄠˊ），垣念ㄩㄢˊ；不是早上的ㄓㄠ' },
  { term: '相夾', say: '香頰', reading: 'xiāng jiá', note: '夾念ㄐㄧㄚˊ（教育部辭典「夾擊」「夾雜」皆念ㄐㄧㄚˊ，台灣標準讀音）' },
  { term: '夾印', say: '頰印', reading: 'jiá yìn', note: '刑忌夾印、財蔭夾印的夾，念ㄐㄧㄚˊ（同「夾擊」）' },
  { term: '夾忌', say: '頰忌', reading: 'jiá jì', note: '羊陀夾忌的夾，念ㄐㄧㄚˊ（同「夾擊」）' },
  { term: '夾命', say: '頰命', reading: 'jiá mìng', note: '左右夾命的夾，念ㄐㄧㄚˊ（同「夾擊」）' },
  { term: '刑剋', say: '刑克', reading: 'xíng kè', note: '教育部辭典「刑剋」念ㄒㄧㄥˊ ㄎㄜˋ' },
  { term: '剋', say: '克', reading: 'kè', note: '教育部辭典「剋」只收ㄎㄜˋ，避免念成ㄎㄟ' },
  { term: '空劫', say: '空劫', reading: 'kōng jié', note: '地空地劫，空念一聲，備查' },
  { term: '大限', say: '大限', reading: 'dà xiàn', note: '教育部辭典「大限」念ㄉㄚˋ ㄒㄧㄢˋ，備查' },
  { term: '小限', say: '小限', reading: 'xiǎo xiàn', note: '念得對，備查' },
  { term: '流年', say: '流年', reading: 'liú nián', note: '教育部辭典「流年」念ㄌㄧㄡˊ ㄋㄧㄢˊ，備查' },
  { term: '身宮', say: '身宮', reading: 'shēn gōng', note: '念得對，備查' },
  { term: '命主', say: '命主', reading: 'mìng zhǔ', note: '念得對，備查' },
  { term: '身主', say: '身主', reading: 'shēn zhǔ', note: '念得對，備查' },

  // ── 一般用語裡的多音字 ──
  { term: '行業', say: '航業', reading: 'háng yè', note: '教育部辭典「行業」念ㄏㄤˊ ㄧㄝˋ；「執行業務」這類的行念ㄒㄧㄥˊ，不替換', notAfter: ['執', '進', '運', '推', '實', '施', '奉', '履', '發', '流', '旅', '先', '可', '自'] },
  { term: '銀行', say: '銀航', reading: 'yín háng', note: '行念ㄏㄤˊ（教育部辭典「私人銀行業務」）' },
  { term: '長輩', say: '掌輩', reading: 'zhǎng bèi', note: '教育部辭典「長輩」念ㄓㄤˇ ㄅㄟˋ' },
  { term: '重視', say: '重視', reading: 'zhòng shì', note: '教育部辭典「重視」念ㄓㄨㄥˋ ㄕˋ，念得對，備查' },
  { term: '還是', say: '還是', reading: 'hái shi', note: '教育部辭典「還是」念ㄏㄞˊ ˙ㄕ，念得對，備查' },
  { term: '教養', say: '叫養', reading: 'jiào yǎng', note: '教育部辭典「教養」念ㄐㄧㄠˋ ㄧㄤˇ，避免念成一聲' },
  { term: '樂於', say: '樂於', reading: 'lè yú', note: '樂念ㄌㄜˋ（同教育部辭典「樂意」），念得對，備查' },
  { term: '差距', say: '插距', reading: 'chā jù', note: '教育部辭典「差距」念ㄔㄚ ㄐㄩˋ，避免念成ㄔㄚˋ' },
  { term: '調整', say: '條整', reading: 'tiáo zhěng', note: '教育部辭典「調整」念ㄊㄧㄠˊ ㄓㄥˇ，避免念成ㄉㄧㄠˋ' },
  { term: '參與', say: '餐預', reading: 'cān yù', note: '教育部辭典「參與」念ㄘㄢ ㄩˋ（台灣標準讀音，與念四聲）' },
  { term: '便宜', say: '便宜', reading: 'pián yi', note: '價錢低的意思念ㄆㄧㄢˊ ˙ㄧ（教育部辭典）；念得對，備查' },
  { term: '厚積薄發', say: '厚積博發', reading: 'hòu jī bó fā', note: '教育部辭典「厚積薄發」的薄念ㄅㄛˊ，避免念成ㄅㄠˊ' },
  { term: '處理', say: '楚理', reading: 'chǔ lǐ', note: '教育部辭典「處理」念ㄔㄨˇ ㄌㄧˇ，避免念成ㄔㄨˋ' },
];
