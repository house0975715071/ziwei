// 命盤格局判定規則
// 每條規則：id / 名稱 / 等級(吉凶) / 判定函式 / 說明 / 對五大面向的影響
// ctx 提供：palaceOf(name) 取宮、starsIn(name) 取該宮所有星名、
//           sanfang(name) 取三方四正星名、hasStar(palace,star)

export const PATTERNS = [
  {
    id: 'ziwei-tianfu',
    name: '紫府同宮',
    level: 'great',
    test: (c) => c.majorsIn('命宮').includes('紫微') && c.majorsIn('命宮').includes('天府'),
    desc: '帝星與庫星同坐命宮，主一生格局大、有領導力也有守成力，兼具開創與累積的能力。是十四主星組合中相當上乘的格局。',
    effect: { 事業: 12, 財運: 12, 家庭: 4, 感情: 0, 健康: 2 },
  },
  {
    id: 'junchen',
    name: '君臣慶會',
    level: 'great',
    test: (c) => c.majorsIn('命宮').includes('紫微') &&
      ['左輔', '右弼', '文昌', '文曲', '天魁', '天鉞'].filter((s) => c.sanfangStars('命宮').includes(s)).length >= 2,
    desc: '紫微坐命且三方四正得左輔右弼、文昌文曲、天魁天鉞相輔，如君王得賢臣。主一生有貴人相助、能成大事，是紫微最需要的配置。',
    effect: { 事業: 15, 財運: 8, 家庭: 5, 感情: 3, 健康: 2 },
  },
  {
    id: 'gujun',
    name: '孤君無輔',
    level: 'warn',
    test: (c) => c.majorsIn('命宮').includes('紫微') &&
      ['左輔', '右弼', '天魁', '天鉞'].filter((s) => c.sanfangStars('命宮').includes(s)).length === 0,
    desc: '紫微坐命卻不見左輔右弼、天魁天鉞來輔。有帝王之心卻無班底，凡事親力親為、容易孤軍奮戰。此格局要特別注意培養人才與授權，否則做得再多也累。',
    effect: { 事業: -8, 財運: -3, 家庭: -2, 感情: -3, 健康: -5 },
  },
  {
    id: 'fuxiang',
    name: '府相朝垣',
    level: 'good',
    test: (c) => {
      const sf = c.sanfangStars('命宮');
      return sf.includes('天府') && sf.includes('天相');
    },
    desc: '天府與天相在三方四正拱照命宮，主一生衣食豐足、處事穩健得體，能得到他人信任與資源。是穩健致富的格局。',
    effect: { 事業: 8, 財運: 10, 家庭: 6, 感情: 4, 健康: 3 },
  },
  {
    id: 'jiyuetongliang',
    name: '機月同梁',
    level: 'good',
    test: (c) => {
      const sf = c.sanfangStars('命宮');
      return ['天機', '太陰', '天同', '天梁'].filter((s) => sf.includes(s)).length >= 3;
    },
    desc: '天機、太陰、天同、天梁四星會於三方四正，古訣云「機月同梁作吏人」。主適合公職、內勤、企劃、幕僚、專業技術等穩定性工作，靠專業與規劃立身，不宜衝鋒陷陣型的行業。',
    effect: { 事業: 6, 財運: 4, 家庭: 6, 感情: 3, 健康: 3 },
    careerHint: '公職、行政、企劃、財務、教育、專業技術、幕僚',
  },
  {
    id: 'shapolang',
    name: '殺破狼',
    level: 'mixed',
    test: (c) => {
      const sf = c.sanfangStars('命宮');
      return ['七殺', '破軍', '貪狼'].filter((s) => sf.includes(s)).length >= 2;
    },
    desc: '七殺、破軍、貪狼三星構成的動盪格局，主一生變動大、起伏大，但爆發力也最強。適合開創、業務、創業這類「敢衝才有得」的路。守成型的人生會壓抑這個格局的優點。切忌高槓桿一次押身家。',
    effect: { 事業: 8, 財運: 5, 家庭: -5, 感情: -6, 健康: -4 },
    careerHint: '創業、業務、開發、工程、不動產、需要開拓的行業',
  },
  {
    id: 'riyue-bingming',
    name: '日月並明',
    level: 'great',
    test: (c) => {
      const sun = c.findStar('太陽'), moon = c.findStar('太陰');
      if (!sun || !moon) return false;
      const bright = ['廟', '旺', '得'];
      return bright.includes(sun.brightness) && bright.includes(moon.brightness);
    },
    desc: '太陽太陰皆得廟旺，日月同時發光。主一生名利雙收、內外兼修，既有對外的名聲也有內在的財富累積，與父母緣分也佳。',
    effect: { 事業: 10, 財運: 10, 家庭: 8, 感情: 5, 健康: 4 },
  },
  {
    id: 'riyue-fanbei',
    name: '日月反背',
    level: 'warn',
    test: (c) => {
      const sun = c.findStar('太陽'), moon = c.findStar('太陰');
      if (!sun || !moon) return false;
      return sun.brightness === '陷' && moon.brightness === '陷';
    },
    desc: '太陽太陰俱落陷，日月失輝。主早年辛勞、付出多而回收慢，與父母緣分較磨。但此格局經過中年努力後常有厚積薄發的表現，重點是不要在年輕時就放棄。',
    effect: { 事業: -6, 財運: -6, 家庭: -8, 感情: -4, 健康: -4 },
  },
  {
    id: 'huotan',
    name: '火貪格',
    level: 'great',
    test: (c) => c.sameStar('貪狼', '火星'),
    desc: '貪狼與火星同宮，主橫發之財、意外的機會。這是紫微斗數中著名的暴發格局，能在短時間內爆發性成長。但「橫發橫破」是它的雙面性，賺到要立刻落袋、置產或轉為穩定資產，切忌把暴利再全部押回去。',
    effect: { 事業: 8, 財運: 14, 家庭: 0, 感情: -3, 健康: -3 },
  },
  {
    id: 'lingtan',
    name: '鈴貪格',
    level: 'great',
    test: (c) => c.sameStar('貪狼', '鈴星'),
    desc: '貪狼與鈴星同宮，同為暴發格局，但過程比火貪更煎熬、爆發前的醞釀期更長。一旦成勢力道強勁。同樣要防暴起暴落，見好就收。',
    effect: { 事業: 7, 財運: 12, 家庭: 0, 感情: -3, 健康: -4 },
  },
  {
    id: 'shuangluchaoyuan',
    name: '雙祿朝垣',
    level: 'great',
    test: (c) => {
      const sf = c.sanfangStars('命宮');
      const hasLu = sf.includes('祿存');
      const hasHualu = c.sanfangMutagens('命宮').includes('祿');
      return hasLu && hasHualu;
    },
    desc: '祿存與化祿同時會照命宮，是紫微斗數中最主財的格局之一。主一生財源不絕、衣食豐足，且遇困難常有資源化解。',
    effect: { 事業: 8, 財運: 16, 家庭: 5, 感情: 3, 健康: 4 },
  },
  {
    id: 'lumajiaochi',
    name: '祿馬交馳',
    level: 'good',
    test: (c) => c.sameStar('祿存', '天馬') || c.sameStar('天馬', '化祿星'),
    desc: '祿存與天馬同宮，主動中生財。這種格局的人靠跑動、靠外出、靠變化賺錢，越動越有財，守在家裡反而發不起來。適合業務、外派、跨區域經營。',
    effect: { 事業: 8, 財運: 10, 家庭: -3, 感情: -2, 健康: -2 },
    careerHint: '業務、外派、跨區經營、貿易、需要跑動的行業',
  },
  {
    id: 'caiyinjiayin',
    name: '財蔭夾印',
    level: 'great',
    test: (c) => {
      const idx = c.palaceIndexOf('天相');
      if (idx < 0) return false;
      const prev = c.majorsAtIndex((idx + 11) % 12).concat(c.minorsAtIndex((idx + 11) % 12));
      const next = c.majorsAtIndex((idx + 1) % 12).concat(c.minorsAtIndex((idx + 1) % 12));
      const pair = prev.concat(next);
      const hasLiang = pair.includes('天梁');
      const hasLu = pair.includes('祿存') || c.mutagensAtIndex((idx + 11) % 12).includes('祿') || c.mutagensAtIndex((idx + 1) % 12).includes('祿');
      return hasLiang && hasLu;
    },
    desc: '天相被化祿（或祿存）與天梁左右相夾，是天相最好的配置。主一生受庇蔭、有資源、被信任，能穩穩地累積地位與財富。',
    effect: { 事業: 12, 財運: 10, 家庭: 6, 感情: 4, 健康: 4 },
  },
  {
    id: 'xingjijiayin',
    name: '刑忌夾印',
    level: 'warn',
    test: (c) => {
      const idx = c.palaceIndexOf('天相');
      if (idx < 0) return false;
      const prevM = c.mutagensAtIndex((idx + 11) % 12);
      const nextM = c.mutagensAtIndex((idx + 1) % 12);
      const pair = c.majorsAtIndex((idx + 11) % 12).concat(c.minorsAtIndex((idx + 11) % 12),
        c.majorsAtIndex((idx + 1) % 12), c.minorsAtIndex((idx + 1) % 12));
      const hasJi = prevM.includes('忌') || nextM.includes('忌');
      const hasXing = pair.includes('擎羊') || pair.includes('天刑') || pair.includes('巨門');
      return hasJi && hasXing;
    },
    desc: '天相被化忌與刑星相夾，是天相最辛苦的配置。主容易被牽連、代人受過、扛不該扛的責任。要特別留意保證、背書、替人出頭這類事，白紙黑字比講義氣重要。',
    effect: { 事業: -8, 財運: -8, 家庭: -4, 感情: -4, 健康: -5 },
  },
  {
    id: 'yangliangchangl',
    name: '陽梁昌祿',
    level: 'great',
    test: (c) => {
      const sf = c.sanfangStars('命宮');
      return sf.includes('太陽') && sf.includes('天梁') && sf.includes('文昌') &&
        (sf.includes('祿存') || c.sanfangMutagens('命宮').includes('祿'));
    },
    desc: '太陽、天梁、文昌、祿存（或化祿）會於三方，古稱「陽梁昌祿，臚傳第一名」。主考試順利、學歷功名有成，最適合走專業證照、公職、學術、教育這條路。',
    effect: { 事業: 14, 財運: 8, 家庭: 5, 感情: 2, 健康: 3 },
    careerHint: '公職、教育、學術、專業證照、法律、醫療',
  },
  {
    id: 'shizhongyinyue',
    name: '石中隱玉',
    level: 'good',
    test: (c) => {
      const p = c.palaceOf('命宮');
      if (!p) return false;
      const ju = p.majorStars.find((s) => s.name === '巨門');
      return !!ju && ['廟', '旺'].includes(ju.brightness) && ['子', '午'].includes(p.earthlyBranch);
    },
    desc: '巨門廟旺坐命於子午，如石中藏玉。主外表不張揚但內有真才實學，靠專業與口才逐步顯露價值。這類人不適合速成，越沉得住氣越有成就。',
    effect: { 事業: 10, 財運: 7, 家庭: 3, 感情: 0, 健康: 2 },
  },
  {
    id: 'lingchangtuowu',
    name: '鈴昌陀武',
    level: 'bad',
    test: (c) => {
      const sf = c.sanfangStars('命宮');
      return ['鈴星', '文昌', '陀羅', '武曲'].every((s) => sf.includes(s));
    },
    desc: '鈴星、文昌、陀羅、武曲四星交會，古書視為凶格，主意外、限運不順、情緒困擾。現代解讀不必過度恐慌，但確實提醒：這類命盤要特別留意交通安全、投資決策不宜衝動、情緒低潮時不做重大決定。',
    effect: { 事業: -8, 財運: -10, 家庭: -4, 感情: -5, 健康: -10 },
  },
  {
    id: 'kongjiaming',
    name: '空劫夾命',
    level: 'warn',
    test: (c) => {
      const idx = c.palaceIndexOf(null, '命宮');
      if (idx < 0) return false;
      const prev = c.minorsAtIndex((idx + 11) % 12).concat(c.adjAtIndex((idx + 11) % 12));
      const next = c.minorsAtIndex((idx + 1) % 12).concat(c.adjAtIndex((idx + 1) % 12));
      const hasA = prev.includes('地空') || prev.includes('地劫');
      const hasB = next.includes('地空') || next.includes('地劫');
      return hasA && hasB;
    },
    desc: '地空地劫夾命宮，主想法容易不切實際、計畫趕不上變化、財來財去。此格局適合走技術、宗教、藝術、五術這類「不靠囤積」的路，投資理財要格外保守。',
    effect: { 事業: -5, 財運: -12, 家庭: -2, 感情: -3, 健康: -2 },
  },
  {
    id: 'yangtuo-jiaming',
    name: '羊陀夾忌',
    level: 'bad',
    test: (c) => {
      const idx = c.palaceIndexOf(null, '命宮');
      if (idx < 0) return false;
      const prev = c.minorsAtIndex((idx + 11) % 12);
      const next = c.minorsAtIndex((idx + 1) % 12);
      const dual = (prev.includes('擎羊') && next.includes('陀羅')) || (prev.includes('陀羅') && next.includes('擎羊'));
      return dual && c.mutagensAtIndex(idx).includes('忌');
    },
    desc: '命宮化忌又被擎羊陀羅相夾，是較辛苦的配置。主一生阻力較多、容易進退兩難。應對之道是「認一條路做到底」，把化忌的執著轉成專業的深度，反而能走出格局。',
    effect: { 事業: -10, 財運: -8, 家庭: -5, 感情: -6, 健康: -8 },
  },
  {
    id: 'wenxing-jiaming',
    name: '文星拱命',
    level: 'good',
    test: (c) => {
      const sf = c.sanfangStars('命宮');
      return sf.includes('文昌') && sf.includes('文曲');
    },
    desc: '文昌文曲同會命宮三方，主聰明好學、有文采與才藝，適合以知識、表達、創作為業。考試與文書方面順利。',
    effect: { 事業: 7, 財運: 4, 家庭: 3, 感情: 4, 健康: 2 },
  },
  {
    id: 'kuiyue-jiaming',
    name: '魁鉞拱命',
    level: 'good',
    test: (c) => {
      const sf = c.sanfangStars('命宮');
      return sf.includes('天魁') && sf.includes('天鉞');
    },
    desc: '天魁天鉞會照命宮，主一生貴人多、遇困難有人拉一把。這是很珍貴的配置，代表你的際遇往往比同樣努力的人更順。要懂得經營人脈、也要記得回報。',
    effect: { 事業: 9, 財運: 6, 家庭: 5, 感情: 4, 健康: 4 },
  },
  {
    id: 'zuoyou-jiaming',
    name: '左右同宮',
    level: 'good',
    test: (c) => c.starsIn('命宮').includes('左輔') && c.starsIn('命宮').includes('右弼'),
    desc: '左輔右弼同坐命宮，主一生得人相助、做事有人分擔，人緣與領導力俱佳。適合帶團隊、做需要協作的事業。',
    effect: { 事業: 10, 財運: 5, 家庭: 6, 感情: 4, 健康: 3 },
  },
  {
    id: 'ma-tou-dai-jian',
    name: '馬頭帶箭',
    level: 'mixed',
    test: (c) => {
      const p = c.palaceOf('命宮');
      if (!p) return false;
      return p.earthlyBranch === '午' && c.starsIn('命宮').includes('擎羊');
    },
    desc: '擎羊在午宮坐命，古稱馬頭帶箭。主性格剛烈、衝勁十足，適合在競爭激烈或紀律嚴明的環境（軍警、業務、運動、開創型事業）發揮。用對地方是猛將，用錯地方是傷己。',
    effect: { 事業: 8, 財運: 3, 家庭: -5, 感情: -6, 健康: -6 },
    careerHint: '軍警、業務前線、運動競技、開創型事業',
  },
  {
    id: 'sanqi-jiahui',
    name: '三奇加會',
    level: 'great',
    test: (c) => {
      const m = c.sanfangMutagens('命宮');
      return m.includes('祿') && m.includes('權') && m.includes('科');
    },
    desc: '化祿、化權、化科三吉化同時會照命宮，是相當難得的格局。主一生名利權三者兼得，機會、實權與名聲都能到手。要珍惜這個底子，把它用在值得長期投入的事情上。',
    effect: { 事業: 16, 財運: 12, 家庭: 6, 感情: 4, 健康: 5 },
  },
];

// 行業建議對照表：由主星組合與格局推導
export const INDUSTRY_MAP = {
  領導管理: { stars: ['紫微', '天府', '武曲', '七殺'], jobs: ['企業經營', '部門主管', '店長', '專案負責人', '創業'] },
  業務銷售: { stars: ['太陽', '貪狼', '廉貞', '七殺', '破軍'], jobs: ['不動產仲介', '保險', '汽車銷售', '精品業務', 'B2B業務'] },
  財務金融: { stars: ['武曲', '天府', '太陰', '天相'], jobs: ['會計', '財務主管', '銀行', '證券', '理財顧問', '資產管理'] },
  專業技術: { stars: ['天機', '文昌', '文曲', '巨門'], jobs: ['工程師', '設計師', '技師', '分析師', '研發'] },
  教育傳播: { stars: ['太陽', '天梁', '巨門', '文昌'], jobs: ['講師', '教師', '培訓', '媒體', '主持', '自媒體'] },
  醫療照護: { stars: ['天梁', '天同', '太陰', '廉貞'], jobs: ['醫護', '藥師', '復健治療', '長照', '心理諮商'] },
  公職法律: { stars: ['天梁', '天相', '巨門', '太陽'], jobs: ['公務員', '法務', '律師', '稽核', '警消'] },
  創意美學: { stars: ['廉貞', '太陰', '文曲', '貪狼'], jobs: ['設計', '影視', '攝影', '美容', '時尚', '室內裝修'] },
  服務生活: { stars: ['天同', '天相', '太陰'], jobs: ['餐飲', '旅遊', '零售', '客服', '行政'] },
  開創變革: { stars: ['破軍', '七殺', '貪狼'], jobs: ['新創', '轉型顧問', '業務開發', '工程營造', '貿易'] },
  不動產: { stars: ['太陰', '天府', '武曲', '紫微'], jobs: ['房仲', '代銷', '不動產投資', '建設', '包租代管', '估價'] },
};
