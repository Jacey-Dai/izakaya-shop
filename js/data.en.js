/*
 * 小舟 · 英文内容
 * 按 id 对应 js/data.js 里的条目。缺少的字段会显示中文。
 * 鱼的英文名直接用 data.js 里的 en 字段，这里不用重复。
 */
window.SHOP_DATA_EN = {
  rarity: {
    1: "Common", 2: "Select", 3: "Rare", 4: "Legendary",
  },

  fish: {
    akami: { season: "All year", texture: "Firm and fine, almost no fat", flavor: "Clean meaty taste with a light iron sweetness", desc: "Lean back meat of the tuna, the classic sushi bite." },
    chutoro: { season: "Winter", texture: "Soft and marbled, starts to melt on the tongue", flavor: "A balance of lean umami and belly sweetness", desc: "Between lean and fatty. Many chefs' favourite cut." },
    otoro: { season: "Winter", texture: "Melts like butter", flavor: "Rich fat with a sweet finish", desc: "The fattiest part of the belly. Each fish only gives a little." },
    honmaguro: { season: "Deep winter", texture: "Snowflake-fine fat that melts at a touch", flavor: "Deep sweetness and umami that lingers", desc: "A treasure Chef Haruta only brings out when he finds a perfect fish." },
    salmon: { season: "Autumn", texture: "Soft, juicy, evenly fatty", flavor: "Gentle, creamy sweetness", desc: "Beautiful white fat lines. The most popular first sashimi." },
    hamachi: { season: "Winter", texture: "Springy and smooth", flavor: "Clean sweetness with a little richness", desc: "Young yellowtail, fattiest in winter." },
    tai: { season: "Spring", texture: "Bouncy with a nice chew", flavor: "Clean, elegant, lightly sweet", desc: "The \"king of fish\" in Japan, a must at celebrations." },
    hirame: { season: "Winter", texture: "Thin and crisp, better with every chew", flavor: "Very delicate, lovely with citrus ponzu", desc: "The classic white fish, usually sliced very thin." },
    aji: { season: "Summer", texture: "Soft with a little fat", flavor: "Bright blue-fish flavor, best with ginger and scallion", desc: "Named for its taste (aji means flavor). An everyday favourite." },
    saba: { season: "Autumn–winter", texture: "Firm outside, silky inside", flavor: "Vinegar tang meets rich fish oil", desc: "Mackerel cured in salt and vinegar. Tangy and appetizing." },
    kanpachi: { season: "Summer", texture: "Firm and crisp", flavor: "Fresh and lightly sweet, moderately fatty", desc: "A premium summer white fish, cleaner than hamachi." },
    katsuo: { season: "Early summer / autumn", texture: "Charred outside, raw and tender inside", flavor: "Deep red-meat flavor with a smoky edge", desc: "Quickly seared over a straw fire, served with garlic and scallion." },
    kinmedai: { season: "Winter", texture: "Soft, with rich fat under the skin", flavor: "Sweet and deep, even better lightly seared", desc: "Red skin and big golden eyes, a beauty from the deep sea." },
    nodoguro: { season: "Autumn–winter", texture: "Generous fat; seared, the skin crisps and the flesh melts", flavor: "Called \"the toro of white fish\"", desc: "Its throat is black inside, hence the name. Very hard to come by." },
    hotate: { season: "Winter–spring", texture: "Thick, soft and slightly sticky", flavor: "Rich shellfish sweetness", desc: "From cold northern waters. The colder, the sweeter." },
    amaebi: { season: "Winter", texture: "Sticky and silky", flavor: "Exactly as sweet as the name says", desc: "Best raw. The heads can be fried into crackers." },
    botanebi: { season: "Winter–spring", texture: "Plump, bouncy and soft", flavor: "Deep sweetness and rich shrimp butter", desc: "A big, premium shrimp as bright as a peony." },
    ika: { season: "Summer", texture: "Sticky and elastic", flavor: "Clean sweetness, great with salt and lemon", desc: "The chef scores fine lines on top so it's easy to bite." },
    tako: { season: "Summer", texture: "Crunchy and chewy", flavor: "Gets more savoury the more you chew", desc: "Lightly boiled before slicing: red outside, white inside." },
    uni: { season: "Summer", texture: "Smooth as custard", flavor: "Ocean brine and deep sweetness", desc: "Each urchin gives only five small tongues. Very precious." },
    ikura: { season: "Autumn", texture: "Each pearl pops in your mouth", flavor: "Salty, savoury and sweet", desc: "Salmon roe marinated in soy sauce, like little jewels." },
    awabi: { season: "Summer", texture: "Crunchy raw, tender when steamed", flavor: "Light taste of the sea, sweeter as you chew", desc: "A luxury shellfish with a crisp bite when raw." },
  },

  categories: {
    sashimi: "Sashimi", sushi: "Nigiri", hot: "Small dishes", sweet: "Sweets", drinks: "Drinks",
  },

  menu: {
    "n-akami": { name: "Lean tuna nigiri", desc: "2 pieces" },
    "n-chutoro": { name: "Medium fatty tuna nigiri", desc: "2 pieces" },
    "n-salmon": { name: "Seared salmon nigiri", desc: "Lightly torched, rich and fragrant" },
    "n-tai": { name: "Sea bream nigiri", desc: "With a pinch of salt and yuzu zest" },
    "n-aji": { name: "Horse mackerel nigiri", desc: "Ginger and scallion" },
    "n-hotate": { name: "Scallop nigiri", desc: "" },
    "g-ikura": { name: "Salmon roe gunkan", desc: "" },
    "g-uni": { name: "Sea urchin gunkan", desc: "" },
    "r-tekka": { name: "Tekka maki", desc: "Thin tuna roll" },
    tempura: { name: "Tempura platter", desc: "2 shrimp + seasonal vegetables" },
    yakitori: { name: "Salted chicken skewers", desc: "2 skewers, charcoal grilled" },
    chawanmushi: { name: "Chawanmushi", desc: "Silky egg custard with ginkgo" },
    agedashi: { name: "Agedashi tofu", desc: "Fried tofu in dashi" },
    edamame: { name: "Edamame", desc: "" },
    misoshiru: { name: "Miso soup", desc: "Today: clams" },
    "matcha-ice": { name: "Matcha ice cream", desc: "" },
    warabi: { name: "Warabi mochi", desc: "Kinako + black sugar syrup" },
    sake: { name: "Junmai ginjo sake", desc: "1 gō, chilled" },
    umeshu: { name: "Plum wine", desc: "On the rocks / with soda" },
    beer: { name: "Draft beer", desc: "Medium" },
    matcha: { name: "Matcha", desc: "With a wagashi sweet" },
    yuzu: { name: "Yuzu soda", desc: "Non-alcoholic" },
    hojicha: { name: "Hojicha", desc: "Free refills" },
  },

  seats: {
    counter: { name: "Counter", desc: "Right in front of the chef, watching him slice. He'll chat with you a little more." },
    tatami: { name: "Tatami room", desc: "Shoes off, low table and floor cushions. Good for a slow meal." },
  },

  guest: {
    short: "Short", bun: "Bun", ponytail: "Ponytail", long: "Long",
    black: "Black", brown: "Chestnut", gold: "Flaxen", silver: "Silver",
    casual: "Casual", kimono: "Kimono", yukata: "Yukata",
    ai: "Indigo", shu: "Vermilion", matcha: "Matcha", sakura: "Sakura", kuro: "Ink black",
    none: "None", kanzashi: "Hairpin", hat: "Hat",
  },

  chefLooks: { male: "Male", female: "Female" },

  hotspots: {
    noren: { title: "Noren curtain", hint: "About the shop and how to play" },
    board: { title: "Sign · Today's picks", hint: "See today's fresh catch" },
    tags: { title: "Wooden menu tags", hint: "Small dishes and sweets" },
    drinks: { title: "Sake shelf", hint: "Sake, plum wine and tea" },
    chef: { title: "Chef Haruta", hint: "Chat, or ask for his recommendation" },
    guest: { title: "You", hint: "Change your hair or outfit" },
    fishcase: { title: "Fish case", hint: "Pick fish and build your own plate" },
    seats: { title: "Seats", hint: "Choose where to sit" },
    tablemenu: { title: "Table menu", hint: "Open the full menu" },
    zukan: { title: "Scroll · Fish book", hint: "See the fish you've collected" },
    neko: { title: "Lucky cat", hint: "Give it a pat and draw a fortune" },
    dish: { title: "Your order", hint: "Take another look at the receipt" },
  },

  chef: {
    greetings: [
      "Irasshai! The fish are in great shape today.",
      "Welcome. What would you like? If you're not sure, leave it to me.",
      "I picked out some good fish at the market this morning. Want a look?",
      "Have a seat. Some hot tea first to warm you up.",
    ],
    counterExtra: [
      "Counter guests are lucky. You can watch me slice up close.",
      "Look at the marbling on this piece. Like snow, isn't it?",
      "With sashimi, dip the fish side in soy sauce, not the rice.",
    ],
    omakaseIntro: "Alright, leave it to me.",
    legendary: " …You're lucky today. You don't see this fish often.",
    afterOrder: ["Hai, omachi!", "Enjoy!", "I'm proud of this plate. Give it a try."],
  },

  omikuji: [
    { result: "大吉", text: "Great luck with fish today! Legendary fish are much more likely in the chef's omakase." },
    { result: "中吉", text: "Good fish is on its way. The chef's picks are a little rarer." },
    { result: "小吉", text: "Small luck is still luck. How about some salmon?" },
    { result: "吉", text: "A good day to try a fish you've never had." },
  ],
};
