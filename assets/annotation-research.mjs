import { externalLink } from "./knowledge.mjs";
// Only existing, source-aligned annotation triggers use these queries.
// This is a search aid, not a dictionary or an automatic plant identification.
const plants = [
  [
    "菉竹",
    "绿竹 王刍 萹竹 植物 对比 古籍",
    "古注对菉竹有不同解释，图片检索不能决定本句物种。",
  ],
  [
    "茱萸|紫萸|红萸",
    "重阳 佩茱萸 吴茱萸 植物 叶 果实",
    "古名与今名可能有差别；检索结果仅供观察外观。",
  ],
  ["杜若", "杜若 植物 叶 花 辨识"],
  ["菖蒲|菖浦", "菖蒲 植物 端午 叶 辨识"],
  ["艾|艾草", "艾草 植物 端午 叶 辨识"],
  ["红药|芍药", "芍药 植物 花 叶"],
  ["黄花|菊|菊花", "菊花 植物 花 重阳"],
  ["荷|荷花|芰荷|芙蕖|红衣|青盖", "荷花 荷叶 植物 辨识"],
  ["杜衡", "杜衡 植物 辨识"],
  ["兰芷|芳芷|白芷", "白芷 兰芷 古代 香草 植物"],
  ["蘼芜|蘼芜杜若", "蘼芜 杜若 古代 香草 植物 辨识"],
  ["蓼|红蓼", "红蓼 水蓼 植物 辨识"],
  ["苎|苎麻", "苎麻 植物 纤维"],
  ["莼|莼菜", "莼菜 水生植物 叶"],
  ["榆钱", "榆树 榆钱 翅果 植物"],
  ["荻|芦荻", "荻 芦苇 植物 区别"],
  ["莎|莎草", "莎草 植物 辨识"],
  ["菰|菰蒲", "菰 蒲 水生植物 辨识"],
  ["箬|箬叶", "箬竹 箬叶 粽叶 植物"],
  ["浮萍|萍", "浮萍 水生植物 辨识"],
  ["荠菜|荠麦", "荠菜 麦苗 植物 辨识"],
  ["凌霄", "凌霄 花 藤本 植物"],
  ["梧桐", "梧桐 植物 叶 果实 辨识"],
  ["木槿|朱槿", "木槿 朱槿 植物 区别"],
  ["紫薇|紫微", "紫薇 植物 花 辨识"],
  ["海棠", "海棠 植物 花"],
];
const objects = [
  [
    "盘铭",
    "古代 盥洗盘 铜盘 铭文 文物",
    "此为同类器物图像，不代表商汤铭盘有存世实物。",
  ],
  ["琵琶", "古代 琵琶 乐器 文物"],
  ["琴|古琴", "古琴 七弦琴 古代 乐器 文物"],
  ["瑟|宝瑟", "古代 瑟 乐器 文物"],
  ["筝|秦筝|十三弦", "古代 筝 十三弦 乐器 文物"],
  ["笙|笙箫", "古代 笙 箫 乐器 文物"],
  ["胡笳|胡茄", "古代 胡笳 乐器 形制"],
  ["羌笛|玉龙", "古代 笛 羌笛 乐器 文物"],
  ["画角|角", "古代 画角 号角 乐器 文物"],
  ["麈尾", "魏晋 麈尾 清谈 器物 文物"],
  ["如意", "古代 如意 器物 文物"],
  ["笏", "古代 笏板 朝服 文物"],
  ["榻|胡床", "古代 胡床 榻 坐具 形制 文物"],
  ["觞|离尊|尊|樽|芳尊|玉锺|金盏|翠尊", "古代 觞 樽 酒杯 酒器 文物"],
  [
    "簪|钗|翠翘|花钿|蛾儿雪柳|蛾儿|雪柳|春幡|燕股",
    "古代 簪 钗 花钿 节日 头饰 文物",
  ],
  ["辔|征辔|玉辔", "古代 马辔 缰绳 马具 文物"],
  ["裘|貂裘", "古代 裘服 服饰 文物"],
  ["履|芒鞋", "古代 履 草鞋 服饰 文物"],
  ["屏风|屏山|银屏|锦屏", "古代 屏风 家具 文物"],
  ["香炉|金猊|金兽|香鸭|香篝|篝", "古代 香炉 熏笼 兽形 香具 文物"],
  ["银釭|釭", "古代 灯 釭灯 文物"],
  ["漏|漏箭|壶箭|玉莲漏|金虬|银签", "古代 漏壶 水钟 计时器 文物"],
  ["纨扇|团扇", "古代 团扇 纨扇 文物"],
  ["障泥", "古代 障泥 马具 文物"],
  ["生绡|冰绡|鲛绡|绡", "古代 绡 绢 丝织物 文物"],
  ["衾|簟|鸳衾", "古代 衾 被褥 竹簟 竹席 文物"],
  ["宝奁|犀奁|奁", "古代 奁 梳妆盒 器物 文物"],
  ["鸾镜|菱花|鸾鉴|秦镜", "古代 铜镜 菱花镜 鸾镜 文物"],
  ["机杼", "古代 织机 机杼 纺织 工具"],
  ["砧杵|寒砧|砧杆", "古代 捣衣 砧杵 工具"],
  ["艾虎", "端午 艾虎 艾草 饰物 习俗"],
  ["角黍", "古代 角黍 粽子 端午"],
  ["瑞脑", "龙脑香 古代 香料 文物"],
  ["心字", "古代 心字香 盘香 香具"],
];
const terms = new Map();
for (const [type, entries] of [
  ["plant", plants],
  ["object", objects],
])
  for (const [
    words,
    query,
    hint = "图片仅供辅助观察，请结合本篇释义辨别。",
  ] of entries)
    for (const word of words.split("|")) terms.set(word, { type, query, hint });
export function annotationResearch(note) {
  if (!note?.word || !note.note) return null;
  const word = note.word.trim();
  if (word === "芙蓉") {
    const query = /木芙蓉/u.test(note.note)
      ? "木芙蓉 植物 花"
      : /荷花|荷的/u.test(note.note)
        ? "荷花 植物 花"
        : "芙蓉 荷花 木芙蓉 植物 对比";
    return result(word, {
      type: "plant",
      query,
      hint: "芙蓉有荷花、木芙蓉等用法，须结合本篇词义。",
    });
  }
  if (word === "玉壶") {
    if (/月亮|明月/u.test(note.note)) return null;
    return result(word, {
      type: "object",
      query: "古代 玉壶 壶 酒器 文物",
      hint: "图片展示器物外观，不能代替本篇比喻义。",
    });
  }
  if (["红衣", "青盖"].includes(word) && !/荷|莲/u.test(note.note)) return null;
  if (word === "黄花" && !/菊/u.test(note.note)) return null;
  if (word === "心字" && !/香/u.test(note.note)) return null;
  if (word === "玉龙" && !/笛/u.test(note.note)) return null;
  if (word === "金虬" && !/漏|计时/u.test(note.note)) return null;
  if (word === "如意" && !/器物|器具|手执|手持|搔|柄/u.test(note.note))
    return null;
  if (word === "角" && !/号角|乐器|军中|吹奏/u.test(note.note)) return null;
  if (["尊", "樽"].includes(word) && !/酒|杯|器/u.test(note.note)) return null;
  if (word === "篝" && !/熏|香|笼/u.test(note.note)) return null;
  if (word === "漏" && !/计时|滴水|时刻|报时|漏壶/u.test(note.note))
    return null;
  if (word === "釭" && !/灯|烛/u.test(note.note)) return null;
  const term = terms.get(word);
  if (!term) return null;
  // Some homographs are people, places or abstract uses rather than tangible things.
  if (
    /地名|人名|字为|星名|曲名/u.test(note.note) &&
    !/乐器|船|器物/u.test(note.note)
  )
    return null;
  if (word === "履" && !/鞋|足|穿|服/u.test(note.note)) return null;
  if (word === "紫微" && !/花|紫薇/u.test(note.note)) return null;
  return result(word, term);
}
function result(word, term) {
  return {
    word,
    type: term.type,
    query: term.query,
    hint: term.hint,
    label: `Google 图片 · ${term.type === "plant" ? "植物" : "名物"}：${word}`,
    url: externalLink({ type: term.type, searchQuery: term.query }),
  };
}
export function annotationResearchLinks(notes = []) {
  const seen = new Set();
  return notes.flatMap((note) => {
    const item = annotationResearch(note);
    if (!item || seen.has(item.url)) return [];
    seen.add(item.url);
    return [item];
  });
}
