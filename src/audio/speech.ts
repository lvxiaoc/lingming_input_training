// Instant low-latency Mandarin radical pronunciation engine using Web Speech API
// 100% aligned with official 宇浩·靈明輸入法 (shurufa.app/zigen-ling.csv) phonetic derivation:
// 1. Radicals with authentic Lingming readings preserve their real pronunciation (matching 聲碼/韻碼), e.g. 糸→系(xì), 辶→綽(chuò), 丶→主(zhǔ), 丨→一(yī).
// 2. Radicals merged under a parent radical (同X歸併) inherit the parent's official reading, e.g. 艹/廾/卅→細(xì, 同卌歸併).
// 3. Unpronounced / rare 「取o」 radicals (彐/肀/彑) speak pure vowel 「喔 (o)」.

import { LINGMING_ROOT_MAP } from '../data/lingming';

export interface RadicalReading {
  speak: string; // Clean Mandarin character guaranteed to be spoken clearly by zh TTS
  pinyin: string; // Official Lingming phonetic derivation label shown in Cloud Palace / hints
}

// Pure Mandarin single-vowel fallback for truly unpronounced / rare radicals
export const VOWEL_ONLY_READINGS: Record<string, RadicalReading> = {
  a: { speak: '啊', pinyin: 'a' },
  e: { speak: '鵝', pinyin: 'e' },
  i: { speak: '衣', pinyin: 'i' },
  o: { speak: '喔', pinyin: 'o（無音取 o）' },
  u: { speak: '烏', pinyin: 'u' },
};

// Complete official 靈明字根讀音表（核對自 shurufa.app/zigen-ling.csv）
// 每一項的發音均嚴格吻合其靈明韻碼（以及大根的聲碼）
export const LINGMING_OFFICIAL_READINGS: Record<string, RadicalReading> = {
  // ===== Q 宮殿 =====
  '卌': { speak: '細', pinyin: 'xì → i' }, // qi: Xì -> i
  '卅': { speak: '細', pinyin: 'xì（同卌 → i）' }, // qi: 同卌歸併
  '艹': { speak: '細', pinyin: 'xì（同卌 → i）' }, // qi: 同卌歸併
  '廾': { speak: '細', pinyin: 'xì（同卌 → i）' }, // qi: 同卌歸併
  '其': { speak: '其', pinyin: 'qí → ki' }, // qki: Q作K
  '又': { speak: '又', pinyin: 'yòu → o' }, // qo: Yòu -> o
  '龴': { speak: '又', pinyin: 'yòu（同又 → o）' }, // qo: 同又變體

  // ===== W 宮殿 =====
  '禾': { speak: '禾', pinyin: 'hé' }, // whe
  '夭': { speak: '夭', pinyin: 'yāo → ya' }, // wya
  '乙': { speak: '乙', pinyin: 'yǐ → i' }, // wi: Yǐ -> i
  '乚': { speak: '移', pinyin: 'yí → i' }, // wi: Yí -> i
  '亅': { speak: '乙', pinyin: 'yǐ（同乙 → i）' }, // wi: 折筆同乙歸併
  '辶': { speak: '綽', pinyin: 'chuò → o' }, // wo: Chuò -> o
  '⻍': { speak: '綽', pinyin: 'chuò（同辶 → o）' }, // wo: 同辶變體
  '犬': { speak: '犬', pinyin: 'quǎn → a' }, // wa: Quǎn -> a
  '片': { speak: '片', pinyin: 'piàn → pa' }, // wpa
  '爿': { speak: '盤', pinyin: 'pán → a' }, // wa: Pán -> a
  '乃': { speak: '乃', pinyin: 'nǎi → na' }, // wna
  '革': { speak: '革', pinyin: 'gé' }, // wge
  '卯': { speak: '卯', pinyin: 'mǎo → ma' }, // wma
  '禺': { speak: '雨', pinyin: 'yǔ' }, // wyu: Yǔ

  // ===== R 宮殿 =====
  '二': { speak: '二', pinyin: 'èr → je' }, // rje: 零聲母取J
  '⺀': { speak: '二', pinyin: 'èr（同二 → je）' }, // rje: 同二歸併
  '丬': { speak: '強', pinyin: 'qiáng → a' }, // ra: Qiáng -> a
  '疒': { speak: '訥', pinyin: 'nè' }, // rne: Nè
  '辰': { speak: '辰', pinyin: 'chén → ce' }, // rce
  '卜': { speak: '撲', pinyin: 'pū' }, // rpu: Pū
  '虎': { speak: '虎', pinyin: 'hǔ' }, // rhu
  '虍': { speak: '虎', pinyin: 'hǔ（同虎）' }, // rhu: 同虎歸併
  '鹵': { speak: '魯', pinyin: 'lǔ' }, // rlu
  '言': { speak: '言', pinyin: 'yán → a' }, // ra: Yán -> a
  '之': { speak: '之', pinyin: 'zhī → i' }, // ri: Zhī -> i
  '皿': { speak: '皿', pinyin: 'mǐn → mi' }, // rmi
  '罒': { speak: '網', pinyin: 'wǎng → wa' }, // rwa: Wǎng -> wa
  '羊': { speak: '羊', pinyin: 'yáng → ya' }, // rya
  '马': { speak: '馬', pinyin: 'mǎ' }, // rma
  '见': { speak: '見', pinyin: 'jiàn → ja' }, // rja
  '來': { speak: '來', pinyin: 'lái → la' }, // rla
  '业': { speak: '業', pinyin: 'yè' }, // rye
  '丂': { speak: '考', pinyin: 'kǎo → ka' }, // rka

  // ===== T 宮殿 =====
  '丶': { speak: '主', pinyin: 'zhǔ → u' }, // tu: Zhǔ -> u (點)
  '乀': { speak: '拂', pinyin: 'fú → u' }, // tu: Fú -> u (捺)
  '用': { speak: '用', pinyin: 'yòng → o' }, // to: Yòng -> o
  '匕': { speak: '比', pinyin: 'bǐ → i' }, // ti: Bǐ -> i
  '欠': { speak: '欠', pinyin: 'qiàn → ka' }, // tka: Q作K

  // ===== Y 宮殿 =====
  '大': { speak: '大', pinyin: 'dà' }, // yda
  '夫': { speak: '夫', pinyin: 'fū' }, // yfu
  '王': { speak: '王', pinyin: 'wáng → a' }, // ya: Wáng -> a
  '糸': { speak: '系', pinyin: 'xì → i' }, // yi: xì / sī / mì -> i
  '非': { speak: '非', pinyin: 'fēi → fe' }, // yfe
  '瓦': { speak: '瓦', pinyin: 'wǎ' }, // ywa

  // ===== P 宮殿 =====
  '火': { speak: '火', pinyin: 'huǒ → o' }, // po: Huǒ -> o
  '灬': { speak: '標', pinyin: 'biāo → ba' }, // pba: Biāo -> ba
  '儿': { speak: '兒', pinyin: 'ér → e' }, // pe: ér -> e
  '川': { speak: '川', pinyin: 'chuān → ca' }, // pca
  '巛': { speak: '川', pinyin: 'chuān（同川）' }, // pca: 同川歸併
  '巜': { speak: '川', pinyin: 'chuān（同川）' }, // pca: 同川變體
  '石': { speak: '石', pinyin: 'shí → si' }, // psi
  '勹': { speak: '包', pinyin: 'bāo → a' }, // pa: Bāo -> a
  '巴': { speak: '巴', pinyin: 'bā → a' }, // pa: Bā -> a
  '臼': { speak: '舊', pinyin: 'jiù → u' }, // pu: Jiù -> u

  // ===== S 宮殿 =====
  '土': { speak: '土', pinyin: 'tǔ → u' }, // su: Tǔ -> u
  '士': { speak: '士', pinyin: 'shì → i' }, // si: Shì -> i
  '牛': { speak: '牛', pinyin: 'niú → nu' }, // snu
  '耂': { speak: '老', pinyin: 'lǎo → la' }, // sla
  '山': { speak: '山', pinyin: 'shān → sa' }, // ssa
  '也': { speak: '也', pinyin: 'yě → e' }, // se: Yě -> e
  '九': { speak: '九', pinyin: 'jiǔ → ju' }, // sju
  '尤': { speak: '尤', pinyin: 'yóu → yo' }, // syo
  '尢': { speak: '尤', pinyin: 'yóu → o' }, // so: Yóu -> o (尤本字)
  '廴': { speak: '引', pinyin: 'yǐn → i' }, // si: Yǐn -> i
  '豕': { speak: '使', pinyin: 'shǐ → si' }, // ssi
  '黑': { speak: '黑', pinyin: 'hēi → he' }, // she
  '魚': { speak: '魚', pinyin: 'yú' }, // syu
  '鳥': { speak: '鳥', pinyin: 'niǎo → na' }, // sna
  '烏': { speak: '烏', pinyin: 'wū' }, // swu
  '乜': { speak: '咩', pinyin: 'miē → me' }, // sme: Miē -> Me
  // ===== D 宮殿 =====
  '口': { speak: '口', pinyin: 'kǒu → o' }, // do: Kǒu -> o
  '〇': { speak: '口', pinyin: 'kǒu（同口 → o）' }, // do: 同口歸併
  '目': { speak: '目', pinyin: 'mù' }, // dmu
  '早': { speak: '早', pinyin: 'zǎo → a' }, // da: Zǎo -> a
  '耳': { speak: '耳', pinyin: 'ěr → je' }, // dje: 零聲母取J
  '而': { speak: '而', pinyin: 'ér → e' }, // de: ér -> e
  '面': { speak: '面', pinyin: 'miàn → ma' }, // dma
  '雨': { speak: '雨', pinyin: 'yǔ' }, // dyu
  '曲': { speak: '曲', pinyin: 'qǔ → ku' }, // dku: Q作K
  '舟': { speak: '舟', pinyin: 'zhōu → vo' }, // dvo: zh作V
  '皮': { speak: '皮', pinyin: 'pí' }, // dpi
  '斤': { speak: '斤', pinyin: 'jīn → ji' }, // dji

  // ===== F 宮殿 =====
  '一': { speak: '一', pinyin: 'yī → i' }, // fi: Yī -> i
  '厂': { speak: '廠', pinyin: 'chǎng → a' }, // fa: Chǎng -> a
  '丆': { speak: '罕', pinyin: 'hǎn → a' }, // fa: Hǎn -> a
  '正': { speak: '正', pinyin: 'zhèng → e' }, // fe: Zhèng -> e
  '女': { speak: '女', pinyin: 'nǚ → u' }, // fu: Nǚ -> u
  '母': { speak: '母', pinyin: 'mǔ' }, // fmu
  '彑': { speak: '喔', pinyin: 'o（生僻取 o）' }, // fo: 生僻字取o
  '見': { speak: '見', pinyin: 'jiàn → ja' }, // fja
  '頁': { speak: '頁', pinyin: 'yè' }, // fye
  '足': { speak: '足', pinyin: 'zú → vu' }, // fvu: z作V
  '鸟': { speak: '鳥', pinyin: 'niǎo → na' }, // fna
  '乌': { speak: '烏', pinyin: 'wū' }, // fwu
  '世': { speak: '世', pinyin: 'shì → si' }, // fsi
  '牙': { speak: '牙', pinyin: 'yá' }, // fya
  '亥': { speak: '亥', pinyin: 'hài → ha' }, // fha

  // ===== G 宮殿 =====
  '田': { speak: '田', pinyin: 'tián → ta' }, // gta
  '由': { speak: '由', pinyin: 'yóu → yo' }, // gyo
  '申': { speak: '申', pinyin: 'shēn → se' }, // gse
  '电': { speak: '電', pinyin: 'diàn → da' }, // gda
  '鱼': { speak: '魚', pinyin: 'yú' }, // gyu
  '厶': { speak: '私', pinyin: 'sī → i' }, // gi: Sī -> i (私本字)
  '幺': { speak: '腰', pinyin: 'yāo → ya' }, // gya
  '弓': { speak: '弓', pinyin: 'gōng → go' }, // ggo
  '艮': { speak: '艮', pinyin: 'gěn → ge' }, // gge
  '工': { speak: '工', pinyin: 'gōng → o' }, // go: Gōng -> o
  '丰': { speak: '豐', pinyin: 'fēng → e' }, // ge: Fēng -> e
  '气': { speak: '氣', pinyin: 'qì → ki' }, // gki: Q作K
  '馬': { speak: '馬', pinyin: 'mǎ' }, // gma

  // ===== H 宮殿 =====
  '日': { speak: '日', pinyin: 'rì' }, // hri
  '曰': { speak: '約', pinyin: 'yuē → ye' }, // hye
  '了': { speak: '瞭', pinyin: 'liǎo → la' }, // hla
  '子': { speak: '子', pinyin: 'zǐ → vi' }, // hvi: z作V
  '孑': { speak: '潔', pinyin: 'jié → je' }, // hje
  '予': { speak: '予', pinyin: 'yǔ → u' }, // hu: Yǔ -> u
  '丁': { speak: '丁', pinyin: 'dīng → di' }, // hdi
  '丅': { speak: '丁', pinyin: 'dīng（同丁）' }, // hdi: 同丁歸併
  '下': { speak: '下', pinyin: 'xià → a' }, // ha: Xià -> a
  '長': { speak: '長', pinyin: 'cháng → ca' }, // hca
  '镸': { speak: '長', pinyin: 'cháng（同長）' }, // hca: 同長變體
  '身': { speak: '身', pinyin: 'shēn → se' }, // hse
  '髟': { speak: '標', pinyin: 'biāo → ba' }, // hba
  '广': { speak: '廣', pinyin: 'guǎng → ga' }, // hga
  '文': { speak: '文', pinyin: 'wén → we' }, // hwe
  '示': { speak: '示', pinyin: 'shì → si' }, // hsi
  '走': { speak: '走', pinyin: 'zǒu → vo' }, // hvo: z作V
  '隹': { speak: '追', pinyin: 'zhuī → i' }, // hi: Zhuī -> i

  // ===== J 宮殿 =====
  '三': { speak: '三', pinyin: 'sān → sa' }, // jsa
  '生': { speak: '生', pinyin: 'shēng → e' }, // je: Shēng -> e
  '凵': { speak: '坎', pinyin: 'kǎn → a' }, // ja: Kǎn -> a
  '屮': { speak: '草', pinyin: 'cǎo → ca' }, // jca
  '卩': { speak: '節', pinyin: 'jié → je' }, // jje
  '丩': { speak: '糾', pinyin: 'jiū → u' }, // ju: Jiū -> u
  '丱': { speak: '貫', pinyin: 'guàn → ga' }, // jga
  '寸': { speak: '寸', pinyin: 'cùn → cu' }, // jcu
  '夊': { speak: '志', pinyin: 'zhì → vi' }, // jvi: Zhì -> vi
  '攵': { speak: '志', pinyin: 'zhì（同夂 → vi）' }, // jvi: 同夂歸併
  '亠': { speak: '頭', pinyin: 'tóu → o' }, // jo: Tóu -> o
  '入': { speak: '入', pinyin: 'rù' }, // jru
  '風': { speak: '風', pinyin: 'fēng → fe' }, // jfe
  '向': { speak: '向', pinyin: 'xiàng → xa' }, // jxa

  // ===== K 宮殿 =====
  '丨': { speak: '一', pinyin: 'yī → i（豎）' }, // ki: Yī -> i (官方取一)
  '丿': { speak: '撇', pinyin: 'piě → e' }, // ke: Piě -> e
  '彳': { speak: '斥', pinyin: 'chì → i' }, // ki: Chì -> i
  '彡': { speak: '杉', pinyin: 'shān → a' }, // ka: Shān -> a
  '上': { speak: '上', pinyin: 'shàng → a' }, // ka: Shàng -> a
  '丄': { speak: '上', pinyin: 'shàng → a（上本字）' }, // ka: Shàng -> a
  '丑': { speak: '丑', pinyin: 'chǒu → co' }, // kco
  '宀': { speak: '棉', pinyin: 'mián → a（寶蓋）' }, // ka: Mián -> a
  '穴': { speak: '穴', pinyin: 'xué → xe' }, // kxe
  '尚': { speak: '尚', pinyin: 'shàng → sa' }, // ksa
  '亡': { speak: '亡', pinyin: 'wáng → wa' }, // kwa
  '白': { speak: '白', pinyin: 'bái → ba' }, // kba
  '力': { speak: '力', pinyin: 'lì' }, // kli
  '几': { speak: '幾', pinyin: 'jǐ' }, // kji
  '殳': { speak: '書', pinyin: 'shū → u' }, // ku: Shū -> u
  '骨': { speak: '骨', pinyin: 'gǔ' }, // kgu
  '至': { speak: '至', pinyin: 'zhì → vi' }, // kvi: zh作V
  '車': { speak: '車', pinyin: 'chē → ce' }, // kce
  '长': { speak: '長', pinyin: 'cháng → ca' }, // kca
  '矢': { speak: '矢', pinyin: 'shǐ → si' }, // ksi
  '缶': { speak: '否', pinyin: 'fǒu → fo' }, // kfo
  '亍': { speak: '觸', pinyin: 'chù → cu' }, // kcu: Chù
  '咼': { speak: '寡', pinyin: 'guǎ → a' }, // ka: Guǎ -> a

  // ===== L 宮殿 =====
  '十': { speak: '十', pinyin: 'shí → i' }, // li: Shí -> i
  '干': { speak: '干', pinyin: 'gān → ga' }, // lga
  '千': { speak: '千', pinyin: 'qiān → ka' }, // lka: Q作K
  '手': { speak: '手', pinyin: 'shǒu → so' }, // lso
  '毛': { speak: '毛', pinyin: 'máo → ma' }, // lma
  '古': { speak: '古', pinyin: 'gǔ' }, // lgu
  '舌': { speak: '舌', pinyin: 'shé → se' }, // lse
  '壬': { speak: '任', pinyin: 'rén → re' }, // lre
  '未': { speak: '未', pinyin: 'wèi → we' }, // lwe
  '末': { speak: '末', pinyin: 'mò' }, // lmo
  '飛': { speak: '飛', pinyin: 'fēi → fe' }, // lfe
  '月': { speak: '月', pinyin: 'yuè → e' }, // le: Yuè -> e
  '夕': { speak: '夕', pinyin: 'xī' }, // lxi
  '户': { speak: '戶', pinyin: 'hù' }, // lhu
  '戸': { speak: '戶', pinyin: 'hù（同戶）' }, // lhu
  '戶': { speak: '戶', pinyin: 'hù → u' }, // lu: Hù -> u
  '冂': { speak: '炯', pinyin: 'jiǒng → jo' }, // ljo
  '冊': { speak: '冊', pinyin: 'cè' }, // lce
  '甫': { speak: '甫', pinyin: 'fǔ' }, // lfu
  '鬥': { speak: '鬥', pinyin: 'dòu → do' }, // ldo
  '八': { speak: '八', pinyin: 'bā → a' }, // la: Bā -> a
  '不': { speak: '不', pinyin: 'bù' }, // lbu
  '止': { speak: '止', pinyin: 'zhǐ → vi' }, // lvi: zh作V
  '齒': { speak: '齒', pinyin: 'chǐ → ci' }, // lci

  // ===== X 宮殿 =====
  '木': { speak: '木', pinyin: 'mù → u' }, // xu: Mù -> u
  '朩': { speak: '木', pinyin: 'mù（同木 → u）' }, // xu: 同木歸併
  '甲': { speak: '甲', pinyin: 'jiǎ → ja' }, // xja
  '里': { speak: '里', pinyin: 'lǐ' }, // xli
  '匚': { speak: '方', pinyin: 'fāng → fa' }, // xfa
  '习': { speak: '習', pinyin: 'xí → i' }, // xi: Xí -> i

  // ===== C 宮殿 =====
  '己': { speak: '己', pinyin: 'jǐ' }, // cji
  '已': { speak: '已', pinyin: 'yǐ' }, // cyi
  '巳': { speak: '四', pinyin: 'sì' }, // csi
  '㔾': { speak: '節', pinyin: 'jié → je' }, // cje
  '贝': { speak: '貝', pinyin: 'bèi → be' }, // cbe
  '页': { speak: '頁', pinyin: 'yè' }, // cye
  '丷': { speak: '八', pinyin: 'bā → a' }, // ca: Bā -> a
  '丌': { speak: '基', pinyin: 'jī → i' }, // ci: Jī -> i
  '金': { speak: '金', pinyin: 'jīn → i' }, // ci: Jīn -> i
  '門': { speak: '門', pinyin: 'mén → me' }, // cme
  '高': { speak: '高', pinyin: 'gāo → ga' }, // cga
  '麻': { speak: '麻', pinyin: 'má' }, // cma
  '鹿': { speak: '鹿', pinyin: 'lù' }, // clu

  // ===== V 宮殿 =====
  '水': { speak: '水', pinyin: 'shuǐ → i' }, // vi: Shuǐ -> i
  '氺': { speak: '水', pinyin: 'shuǐ（同水 → i）' }, // vi: 同水歸併
  '米': { speak: '米', pinyin: 'mǐ' }, // vmi
  '刀': { speak: '刀', pinyin: 'dāo → a' }, // va: Dāo -> a
  '巾': { speak: '巾', pinyin: 'jīn → ji' }, // vji
  '且': { speak: '且', pinyin: 'qiě → ke' }, // vke: Q作K
  '亦': { speak: '亦', pinyin: 'yì' }, // vyi
  '鬼': { speak: '鬼', pinyin: 'guǐ → gi' }, // vgi
  '甶': { speak: '拂', pinyin: 'fú' }, // vfu

  // ===== B 宮殿 =====
  '立': { speak: '立', pinyin: 'lì' }, // bli
  '辛': { speak: '辛', pinyin: 'xīn → xi' }, // bxi
  '彐': { speak: '喔', pinyin: 'o（生僻取 o）' }, // bo: 生僻字取o
  '肀': { speak: '喔', pinyin: 'o（同彐取 o）' }, // bo: 同彐歸併
  '隶': { speak: '隸', pinyin: 'lì → i' }, // bi: Lì -> i
  '门': { speak: '門', pinyin: 'mén → me' }, // bme
  '虫': { speak: '蟲', pinyin: 'chóng → o' }, // bo: Chóng -> o
  '臣': { speak: '臣', pinyin: 'chén → e' }, // be: Chén -> e
  '冖': { speak: '冪', pinyin: 'mì → i' }, // bi: Mì -> i
  '乂': { speak: '義', pinyin: 'yì → i' }, // bi: Yì -> i

  // ===== N 宮殿 =====
  '人': { speak: '人', pinyin: 'rén → e' }, // ne: Rén -> e
  '合': { speak: '合', pinyin: 'hé' }, // nhe
  '食': { speak: '食', pinyin: 'shí → si' }, // nsi
  '僉': { speak: '簽', pinyin: 'qiān → a' }, // na: Qiān -> a
  '小': { speak: '小', pinyin: 'xiǎo → xa' }, // nxa
  '⺌': { speak: '小', pinyin: 'xiǎo → a' }, // na: Xiǎo -> a
  '竹': { speak: '竹', pinyin: 'zhú → u' }, // nu: Zhú -> u
  '囗': { speak: '圍', pinyin: 'wéi → we' }, // nwe
  '兀': { speak: '物', pinyin: 'wù' }, // nwu
  '西': { speak: '西', pinyin: 'xī → i' }, // ni: Xī -> i
  '酉': { speak: '友', pinyin: 'yǒu → yo' }, // nyo
  '自': { speak: '自', pinyin: 'zì → vi' }, // nvi: z作V
  '貝': { speak: '貝', pinyin: 'bèi → be' }, // nbe

  // ===== M 宮殿 =====
  '𠂇': { speak: '左', pinyin: 'zuǒ → vo（左本字）' }, // mvo: Zuǒ -> vo
  '戈': { speak: '戈', pinyin: 'gē' }, // mge
  '七': { speak: '七', pinyin: 'qī → i' }, // mi: Qī -> i
  '弋': { speak: '義', pinyin: 'yì' }, // myi
  '戊': { speak: '物', pinyin: 'wù' }, // mwu
  '车': { speak: '車', pinyin: 'chē → ce' }, // mce
  '心': { speak: '心', pinyin: 'xīn → xi' }, // mxi
  '忄': { speak: '心', pinyin: 'xīn → i（豎心）' }, // mi: Xīn -> i
  '方': { speak: '方', pinyin: 'fāng → fa' }, // mfa
  '尸': { speak: '師', pinyin: 'shī → si' }, // msi
  '爪': { speak: '爪', pinyin: 'zhuǎ → a' }, // ma: Zhuǎ -> a
  '瓜': { speak: '瓜', pinyin: 'guā → ga' }, // mga
  '豸': { speak: '志', pinyin: 'zhì → vi' }, // mvi: zh作V
  '癶': { speak: '撥', pinyin: 'bō → o' }, // mo: Bō -> o

  // ===== 高頻偏旁（官方 zigen-ling.csv 核對） =====
  '讠': { speak: '言', pinyin: 'yán → a（言字旁）' }, // wa
  '犭': { speak: '犬', pinyin: 'quǎn → ka（反犬旁）' }, // wka
  '冫': { speak: '二', pinyin: 'èr → je（兩點水）' }, // rje
  '扌': { speak: '手', pinyin: 'shǒu → o（提手旁）' }, // to
  '衤': { speak: '衣', pinyin: 'yī（衣字旁）' }, // fyi
  '阝': { speak: '府', pinyin: 'fǔ → u（掛耳旁）' }, // gu
  '礻': { speak: '示', pinyin: 'shì → si（示字旁）' }, // hsi
  '钅': { speak: '金', pinyin: 'jīn → i（金字旁）' }, // hi
  '亻': { speak: '人', pinyin: 'rén → e（單人旁）' }, // je
  '夂': { speak: '志', pinyin: 'zhì → vi（折文）' }, // jvi
  '饣': { speak: '食', pinyin: 'shí → si（食字旁）' }, // jsi
  '纟': { speak: '絲', pinyin: 'sī → i（絞絲旁）' }, // ci
  '氵': { speak: '水', pinyin: 'shuǐ → i（三點水）' }, // vi
  '刂': { speak: '刀', pinyin: 'dāo → da（立刀旁）' }, // vda
};

// Fallback readings for non-Lingming schemes (Cangjie / Wubi / Custom)
const GENERIC_RADICAL_READINGS: Record<string, RadicalReading> = {
  '艹': { speak: '草', pinyin: 'cǎo' },
  '亻': { speak: '單人', pinyin: 'rén' },
  '氵': { speak: '三點水', pinyin: 'shuǐ' },
  '扌': { speak: '提手', pinyin: 'shǒu' },
  '忄': { speak: '豎心', pinyin: 'xīn' },
  '讠': { speak: '言', pinyin: 'yán' },
  '饣': { speak: '食', pinyin: 'shí' },
  '纟': { speak: '絲', pinyin: 'sī' },
  '犭': { speak: '反犬', pinyin: 'quǎn' },
  '钅': { speak: '金', pinyin: 'jīn' },
  '阝': { speak: '耳', pinyin: 'ěr' },
  '礻': { speak: '示', pinyin: 'shì' },
  '衤': { speak: '衣', pinyin: 'yī' },
  '丨': { speak: '豎', pinyin: 'shù' },
  '丿': { speak: '撇', pinyin: 'piě' },
  '丶': { speak: '點', pinyin: 'diǎn' },
  '宀': { speak: '寶蓋', pinyin: 'mián' },
  '辶': { speak: '走之', pinyin: 'chuò' },
  '攵': { speak: '反文', pinyin: 'pū' },
};

export function getRadicalReading(
  char: string,
  options?: { isLingming?: boolean }
): RadicalReading {
  const isLingming = options?.isLingming ?? true;

  if (isLingming) {
    if (LINGMING_OFFICIAL_READINGS[char]) {
      return LINGMING_OFFICIAL_READINGS[char];
    }
    const lm = LINGMING_ROOT_MAP.get(char);
    if (lm) {
      const yun = lm.ma[lm.ma.length - 1]?.toLowerCase();
      if (yun && VOWEL_ONLY_READINGS[yun]) {
        return VOWEL_ONLY_READINGS[yun];
      }
    }
    return { speak: char, pinyin: '' };
  }

  return (
    GENERIC_RADICAL_READINGS[char] ||
    LINGMING_OFFICIAL_READINGS[char] || { speak: char, pinyin: '' }
  );
}

const STORAGE_KEY = 'inkkey_speech_enabled';

class DojoSpeech {
  private enabled = true;
  private preferredVoice: SpeechSynthesisVoice | null = null;
  private listenersReady = false;

  constructor() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved !== null) {
        this.enabled = saved === 'true';
      }
    } catch {
      this.enabled = true;
    }
    this.initVoices();
  }

  private initVoices(): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const pickVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      if (!voices || voices.length === 0) return;

      const zhVoices = voices.filter((v) =>
        v.lang.toLowerCase().startsWith('zh')
      );
      if (zhVoices.length === 0) return;

      const scoreVoice = (v: SpeechSynthesisVoice): number => {
        const lang = v.lang.toLowerCase();
        const name = v.name.toLowerCase();
        let score = 0;
        if (lang === 'zh-tw' || lang === 'zh_tw') score += 30;
        else if (lang === 'zh-cn' || lang === 'zh_cn') score += 28;
        else if (lang.startsWith('zh')) score += 15;
        if (
          name.includes('google') ||
          name.includes('natural') ||
          name.includes('tingting') ||
          name.includes('meijia') ||
          name.includes('xiaoxiao')
        ) {
          score += 20;
        }
        if (v.localService) score += 10;
        return score;
      };

      zhVoices.sort((a, b) => scoreVoice(b) - scoreVoice(a));
      this.preferredVoice = zhVoices[0];
    };

    pickVoice();
    if (!this.listenersReady) {
      this.listenersReady = true;
      window.speechSynthesis.addEventListener?.('voiceschanged', pickVoice);
    }
  }

  public isSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setEnabled(val: boolean): void {
    this.enabled = val;
    if (!val) {
      this.stop();
    }
    try {
      localStorage.setItem(STORAGE_KEY, String(val));
    } catch {
      // Ignore storage errors
    }
  }

  public speakGlyph(
    char: string,
    opts?: { rate?: number; isLingming?: boolean }
  ): void {
    if (!this.enabled || !char) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const reading = getRadicalReading(char, { isLingming: opts?.isLingming ?? true });
    if (!reading.speak) return;

    try {
      window.speechSynthesis.cancel();

      const utter = new SpeechSynthesisUtterance(reading.speak);
      if (this.preferredVoice) {
        utter.voice = this.preferredVoice;
        utter.lang = this.preferredVoice.lang;
      } else {
        utter.lang = 'zh-TW';
      }
      utter.rate = opts?.rate ?? 1.08;
      utter.pitch = 1.0;
      utter.volume = 0.92;
      window.speechSynthesis.speak(utter);
    } catch {
      // Ignore browser autoplay or synthesis errors
    }
  }

  public stop(): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
    } catch {
      // Ignore
    }
  }
}

export const speech = new DojoSpeech();
