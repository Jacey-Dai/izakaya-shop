/*
 * 小舟 · 店铺数据
 * 想加鱼、加菜、改台词，只需要改这个文件。
 *
 * 鱼 (fish) 字段说明：
 *   id        唯一标识（英文）
 *   name      中文名
 *   jp        日语名（假名）
 *   kanji     日语汉字写法
 *   romaji    罗马音
 *   en        英文名
 *   rarity    稀有度 1-4（见 rarity）
 *   price     刺身一份（3 切）价格
 *   color / color2  画鱼片用的主色 / 纹理色
 *   shape     鱼片形状：slice | round | shrimp | roe | pearl
 *   season    旬（最好吃的季节）
 *   texture   口感
 *   flavor    风味
 *   desc      一句话介绍
 *   omakaseOnly  true = 菜单上没有，只能通过师傅推荐获得
 */
window.SHOP_DATA = {
  shop: {
    name: "小舟",
    jp: "こぶね",
    en: "Kobune Sushi",
    chef: "春田师傅",
    chefJp: "春田さん",
  },

  rarity: {
    1: { label: "並", zh: "普通", color: "#7d8b6a" },
    2: { label: "上", zh: "精选", color: "#3d6e9e" },
    3: { label: "特上", zh: "稀有", color: "#a0522d" },
    4: { label: "幻", zh: "传说", color: "#b8860b" },
  },

  fish: [
    { id: "akami", name: "金枪鱼赤身", jp: "マグロ赤身", kanji: "鮪 赤身", romaji: "maguro akami", en: "Lean Tuna", rarity: 1, price: 480, color: "#b3202f", color2: "#951a27", shape: "slice", season: "全年", texture: "紧实、细腻、几乎不油", flavor: "清爽的肉香和淡淡的铁质甜味", desc: "金枪鱼背部的瘦肉，寿司店最经典的一口。" },
    { id: "chutoro", name: "金枪鱼中腹", jp: "中トロ", kanji: "中とろ", romaji: "chūtoro", en: "Medium Fatty Tuna", rarity: 2, price: 880, color: "#de5f6a", color2: "#f4baba", shape: "slice", season: "冬", texture: "柔软、带油花、入口微融", flavor: "赤身的鲜和大腹的甜恰好平衡", desc: "介于赤身与大腹之间，很多师傅心中的最佳部位。" },
    { id: "otoro", name: "金枪鱼大腹", jp: "大トロ", kanji: "大とろ", romaji: "ōtoro", en: "Fatty Tuna Belly", rarity: 3, price: 1480, color: "#f09aa0", color2: "#fde6e6", shape: "slice", season: "冬", texture: "如奶油般入口即化", flavor: "浓郁油脂香，回味甘甜", desc: "腹部脂肪最丰富的部位，一条鱼只能切出很少一部分。" },
    { id: "honmaguro", name: "本鲔极上大腹", jp: "本マグロ極上大トロ", kanji: "本鮪 極上大とろ", romaji: "hon-maguro gokujō ōtoro", en: "Premium Bluefin Toro", rarity: 4, price: 2800, color: "#f5b4b9", color2: "#ffffff", shape: "slice", season: "隆冬", texture: "雪花般细密的油脂，舌尖一碰就化", flavor: "极致的甜与鲜，余韵很长", desc: "春田师傅只在遇到好鱼时才拿出来的珍品。", omakaseOnly: true },
    { id: "salmon", name: "三文鱼", jp: "サーモン", kanji: "鮭", romaji: "sāmon", en: "Salmon", rarity: 1, price: 420, color: "#f28a36", color2: "#fff0de", shape: "slice", season: "秋", texture: "软嫩多汁、油脂均匀", flavor: "奶油般的柔和鲜甜", desc: "白色脂肪纹路漂亮，最受欢迎的入门鱼生。" },
    { id: "hamachi", name: "油甘鱼", jp: "ハマチ", kanji: "魬", romaji: "hamachi", en: "Young Yellowtail", rarity: 1, price: 520, color: "#f2d2c1", color2: "#e09d93", shape: "slice", season: "冬", texture: "弹牙而顺滑", flavor: "清甜中带一点油香", desc: "鰤鱼的幼鱼，冬天油脂最足。" },
    { id: "tai", name: "真鲷", jp: "マダイ", kanji: "真鯛", romaji: "madai", en: "Red Sea Bream", rarity: 2, price: 580, color: "#f6ece6", color2: "#f0aea8", shape: "slice", season: "春", texture: "Q 弹、有嚼劲", flavor: "干净高雅的淡甜", desc: "日本人眼中的“鱼之王”，喜庆场合必备。" },
    { id: "hirame", name: "比目鱼", jp: "ヒラメ", kanji: "鮃", romaji: "hirame", en: "Olive Flounder", rarity: 2, price: 620, color: "#f8f4ef", color2: "#e6ded4", shape: "slice", season: "冬", texture: "薄切爽脆，越嚼越香", flavor: "非常清淡，适合配柑橘醋", desc: "白身鱼代表，通常切得很薄。" },
    { id: "aji", name: "竹荚鱼", jp: "アジ", kanji: "鯵", romaji: "aji", en: "Horse Mackerel", rarity: 1, price: 380, color: "#dcc4c6", color2: "#8fa0b3", shape: "slice", season: "夏", texture: "柔软带一点脂", flavor: "青背鱼特有的鲜香，配姜葱最佳", desc: "“味道好”所以叫アジ（味），平民美味。" },
    { id: "saba", name: "醋腌青花鱼", jp: "しめ鯖", kanji: "〆鯖", romaji: "shime saba", en: "Cured Mackerel", rarity: 1, price: 400, color: "#ead9d2", color2: "#5f7895", shape: "slice", season: "秋冬", texture: "外层微紧，内里柔润", flavor: "醋香和鱼油香交织", desc: "用盐和醋腌制过的青花鱼，酸香开胃。" },
    { id: "kanpachi", name: "红甘", jp: "カンパチ", kanji: "間八", romaji: "kanpachi", en: "Greater Amberjack", rarity: 2, price: 680, color: "#f4dccf", color2: "#d6978b", shape: "slice", season: "夏", texture: "紧致爽脆", flavor: "清新微甜，油脂含量适中", desc: "夏天的高级白身鱼，口感比油甘鱼更利落。" },
    { id: "katsuo", name: "炙烤鲣鱼", jp: "カツオのたたき", kanji: "鰹", romaji: "katsuo tataki", en: "Seared Bonito", rarity: 2, price: 560, color: "#9b2a32", color2: "#4a3a35", shape: "slice", season: "初夏 / 秋", texture: "外层焦香，内里生嫩", flavor: "浓郁的红肉味，带烟熏香", desc: "表面用稻草火快速炙烤，配大蒜片和葱。" },
    { id: "kinmedai", name: "金目鲷", jp: "キンメダイ", kanji: "金目鯛", romaji: "kinmedai", en: "Splendid Alfonsino", rarity: 3, price: 980, color: "#f7e6df", color2: "#e2584a", shape: "slice", season: "冬", texture: "皮下油脂丰富，柔软", flavor: "甘甜浓厚，炙烤后更香", desc: "红色外皮和金色大眼睛，深海里的美人。" },
    { id: "nodoguro", name: "喉黑", jp: "ノドグロ", kanji: "赤鯥", romaji: "nodoguro", en: "Blackthroat Seaperch", rarity: 4, price: 2400, color: "#fae9e2", color2: "#d9483b", shape: "slice", season: "秋冬", texture: "油脂丰盈，炙烤后皮脆肉化", flavor: "被称为“白身鱼中的大腹”", desc: "喉咙内部是黑色的，因此得名。极难遇到。", omakaseOnly: true },
    { id: "hotate", name: "北海道扇贝", jp: "ホタテ", kanji: "帆立", romaji: "hotate", en: "Hokkaido Scallop", rarity: 1, price: 520, color: "#fbf3e6", color2: "#f0d6b2", shape: "round", season: "冬春", texture: "厚实柔软，微微黏糯", flavor: "浓郁的贝类甜味", desc: "来自寒冷海域，越冷越甜。" },
    { id: "amaebi", name: "甜虾", jp: "甘エビ", kanji: "甘海老", romaji: "ama ebi", en: "Sweet Shrimp", rarity: 1, price: 480, color: "#f7a08a", color2: "#fde2d6", shape: "shrimp", season: "冬", texture: "黏糯滑溜", flavor: "名副其实的甜", desc: "生吃最能吃出它的甜，虾头可以炸成虾饼。" },
    { id: "botanebi", name: "牡丹虾", jp: "ボタンエビ", kanji: "牡丹海老", romaji: "botan ebi", en: "Botan Shrimp", rarity: 3, price: 1280, color: "#ee7d69", color2: "#fbd1c3", shape: "shrimp", season: "冬春", texture: "肉厚饱满、弹中带糯", flavor: "甜味浓厚，虾膏香", desc: "个头大、颜色像牡丹花一样艳丽的高级虾。" },
    { id: "ika", name: "墨鱼", jp: "イカ", kanji: "烏賊", romaji: "ika", en: "Squid", rarity: 1, price: 360, color: "#fbfaf5", color2: "#e6e3da", shape: "slice", season: "夏", texture: "黏糯有弹性", flavor: "清甜，配盐和柠檬也好吃", desc: "师傅会在表面划上细密花刀，更容易咬断。" },
    { id: "tako", name: "章鱼", jp: "タコ", kanji: "蛸", romaji: "tako", en: "Octopus", rarity: 1, price: 380, color: "#f3e9e1", color2: "#b8364a", shape: "slice", season: "夏", texture: "脆弹、有嚼劲", flavor: "越嚼越鲜", desc: "通常先轻轻煮过再切，外红内白。" },
    { id: "uni", name: "海胆", jp: "ウニ", kanji: "雲丹", romaji: "uni", en: "Sea Urchin", rarity: 3, price: 1680, color: "#f4a52a", color2: "#e2850f", shape: "roe", season: "夏", texture: "绵密如奶油", flavor: "海潮味和浓厚甜味", desc: "一只海胆只能取出五小条，非常珍贵。" },
    { id: "ikura", name: "三文鱼籽", jp: "イクラ", kanji: "いくら", romaji: "ikura", en: "Salmon Roe", rarity: 2, price: 760, color: "#f0551e", color2: "#ff9d5c", shape: "pearl", season: "秋", texture: "一颗颗在嘴里爆开", flavor: "咸鲜带甜", desc: "用酱油腌渍过的鲑鱼卵，像小宝石。" },
    { id: "awabi", name: "鲍鱼", jp: "アワビ", kanji: "鮑", romaji: "awabi", en: "Abalone", rarity: 3, price: 1380, color: "#e9dcb8", color2: "#a89a6c", shape: "round", season: "夏", texture: "生吃爽脆，蒸后柔软", flavor: "淡淡海香，越嚼越甘", desc: "贝类中的高级食材，生鲍鱼口感清脆。" },
  ],

  // 菜单分类。sashimi 分类会根据上面的 fish 自动生成，不用手写。
  menu: [
    { id: "sashimi", name: "刺身", jp: "お刺身", auto: true },
    {
      id: "sushi", name: "握寿司", jp: "握り",
      items: [
        { id: "n-akami", name: "赤身握", jp: "赤身", price: 360, fish: ["akami"], desc: "一贯两件" },
        { id: "n-chutoro", name: "中腹握", jp: "中トロ", price: 620, fish: ["chutoro"], desc: "一贯两件" },
        { id: "n-salmon", name: "炙烤三文鱼握", jp: "炙りサーモン", price: 380, fish: ["salmon"], desc: "表面微炙，油香四溢" },
        { id: "n-tai", name: "真鲷握", jp: "真鯛", price: 420, fish: ["tai"], desc: "配一点盐和柚子皮" },
        { id: "n-aji", name: "竹荚鱼握", jp: "鯵", price: 300, fish: ["aji"], desc: "姜蓉葱花" },
        { id: "n-hotate", name: "扇贝握", jp: "帆立", price: 400, fish: ["hotate"], desc: "" },
        { id: "g-ikura", name: "三文鱼籽军舰", jp: "いくら軍艦", price: 560, fish: ["ikura"], desc: "" },
        { id: "g-uni", name: "海胆军舰", jp: "雲丹軍艦", price: 1200, fish: ["uni"], desc: "" },
        { id: "r-tekka", name: "铁火卷", jp: "鉄火巻", price: 480, fish: ["akami"], desc: "金枪鱼细卷" },
      ],
    },
    {
      id: "hot", name: "一品料理", jp: "一品",
      items: [
        { id: "tempura", name: "天妇罗拼盘", jp: "天ぷら盛り合わせ", price: 880, desc: "虾两只 + 时令蔬菜" },
        { id: "yakitori", name: "盐烤鸡肉串", jp: "焼き鳥", price: 420, desc: "两串，炭火" },
        { id: "chawanmushi", name: "茶碗蒸", jp: "茶碗蒸し", price: 380, desc: "嫩滑蛋羹，内藏银杏" },
        { id: "agedashi", name: "扬出豆腐", jp: "揚げ出し豆腐", price: 420, desc: "高汤炸豆腐" },
        { id: "edamame", name: "盐水毛豆", jp: "枝豆", price: 280, desc: "" },
        { id: "misoshiru", name: "味噌汤", jp: "味噌汁", price: 200, desc: "今日：蚬贝" },
      ],
    },
    {
      id: "sweet", name: "甜品", jp: "甘味",
      items: [
        { id: "matcha-ice", name: "抹茶冰淇淋", jp: "抹茶アイス", price: 380, desc: "" },
        { id: "warabi", name: "蕨饼", jp: "わらび餅", price: 420, desc: "黄豆粉 + 黑蜜" },
      ],
    },
    {
      id: "drinks", name: "饮品", jp: "お飲み物",
      items: [
        { id: "sake", name: "纯米吟酿", jp: "純米吟醸", price: 780, desc: "一合，冷酒", bottle: "#e8eef0" },
        { id: "umeshu", name: "梅酒", jp: "梅酒", price: 520, desc: "加冰 / 苏打", bottle: "#c98a2e" },
        { id: "beer", name: "生啤", jp: "生ビール", price: 580, desc: "中杯", bottle: "#e9b73a" },
        { id: "matcha", name: "抹茶", jp: "抹茶", price: 480, desc: "附和果子", bottle: "#6a8a3a" },
        { id: "yuzu", name: "柚子苏打", jp: "柚子ソーダ", price: 420, desc: "无酒精", bottle: "#f2d04a" },
        { id: "hojicha", name: "焙茶", jp: "ほうじ茶", price: 0, desc: "免费续杯", bottle: "#8a5a32" },
      ],
    },
  ],

  seats: [
    { id: "counter", name: "吧台席", jp: "カウンター席", desc: "坐在师傅正前方，看着他切鱼。师傅会多和你聊几句。", marker: [630, 546] },
    { id: "tatami", name: "和室座敷", jp: "座敷", desc: "脱鞋坐在榻榻米上，矮桌和坐垫，适合慢慢吃。", marker: [1000, 636] },
  ],

  // 客人形象：选座后坐在座位上（背影，面向师傅）。每组第一项是默认值。
  guest: {
    hairStyle: [
      { id: "short", name: "短发" },
      { id: "bun", name: "丸子头" },
      { id: "ponytail", name: "马尾" },
      { id: "long", name: "长发" },
    ],
    hairColor: [
      { id: "black", name: "乌黑", color: "#2b2622" },
      { id: "brown", name: "栗色", color: "#6b3f22" },
      { id: "gold", name: "亚麻金", color: "#c9a25a" },
      { id: "silver", name: "银灰", color: "#a9a9b0" },
    ],
    outfit: [
      { id: "ai", name: "靛蓝", color: "#2c3e60" },
      { id: "shu", name: "朱红", color: "#b23a2e" },
      { id: "matcha", name: "抹茶", color: "#6a8a3a" },
      { id: "sakura", name: "樱粉", color: "#e8a3b0" },
      { id: "kuro", name: "墨黑", color: "#33302d" },
    ],
    accessory: [
      { id: "none", name: "无" },
      { id: "kanzashi", name: "发簪" },
      { id: "hat", name: "帽子" },
    ],
  },

  // 鼠标悬停时显示的提示
  hotspots: {
    noren: { title: "暖帘 · のれん", hint: "店铺介绍和玩法说明" },
    board: { title: "门口立牌 · 本日のおすすめ", hint: "看看今天的鲜货" },
    tags: { title: "墙上木札 · お品書き", hint: "一品料理与甜品" },
    drinks: { title: "酒架 · お飲み物", hint: "清酒、梅酒和茶" },
    chef: { title: "春田师傅 · 板前", hint: "和师傅聊聊，或请他推荐" },
    guest: { title: "你 · お客さん", hint: "换个发型或衣服" },
    fishcase: { title: "鱼柜 · ネタケース", hint: "自选鱼生，亲手拼一盘" },
    seats: { title: "座位 · お席", hint: "选择你的座位" },
    tablemenu: { title: "桌面菜单 · メニュー", hint: "翻开完整菜单点菜" },
    zukan: { title: "挂轴 · 鱼图鉴", hint: "查看你收集到的鱼生" },
    neko: { title: "招财猫 · 招き猫", hint: "摸一摸，抽一支签" },
  },

  // 厨师形象。春田师傅默认男性；以后玩家“当厨师”（PRD T-10）时可以选男 / 女。
  // 调试预览：在网址后加 ?chef=female
  chefLooks: [
    { id: "male", name: "男" },
    { id: "female", name: "女" },
  ],

  chef: {
    greetings: [
      "いらっしゃい！今天的鱼都很精神哦。",
      "来啦。想吃点什么？不知道的话，交给我也行。",
      "今天早上去市场挑了几条好鱼，要不要看看？",
      "坐吧坐吧。先来杯热茶暖暖身子。",
    ],
    counterExtra: [
      "坐吧台的客人有口福，我切的时候你可以看仔细。",
      "你看这块的油花，像不像雪？",
      "吃刺身的时候，酱油蘸鱼肉那一面，别蘸饭。",
    ],
    omakaseIntro: "好，那就交给我吧。",
    legendary: "……今天运气不错，这条鱼可不常见。",
    afterOrder: ["はい、お待ち！", "请慢用～", "这盘我很满意，你尝尝。"],
  },

  omikuji: [
    { result: "大吉", text: "今日鱼运极佳！师傅推荐里出现传说之鱼的概率大幅提升。", luck: 3 },
    { result: "中吉", text: "好鱼正在路上。师傅推荐的稀有度略有提升。", luck: 2 },
    { result: "小吉", text: "平平淡淡也是福，来盘三文鱼吧。", luck: 1 },
    { result: "吉", text: "适合尝试一种没吃过的鱼。", luck: 1 },
    { result: "末吉", text: "慢慢来，图鉴总会集满的。", luck: 0 },
  ],
};
