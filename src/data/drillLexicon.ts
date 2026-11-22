import {
  CodeRole,
  encodeLingmingRoots,
  getLingmingCharScript,
  LINGMING_CHAMBER_BY_KEY,
  LINGMING_CHAR_SPLITS,
  LINGMING_ROOT_MAP,
} from './lingming';
import { CharScript, matchesScript, ScriptMode } from './scriptFilter';
import { XRAY_HANZI_BY_CHAR, XrayHanziEntry } from './xrayHanziData';

export interface DrillRootBreakdown {
  radical: string;
  ma: string;
  isXiao: boolean;
  chamberKey: string;
  anchor: string;
  contributedKeys: Array<{ key: string; role: CodeRole }>;
}

export interface DrillCharEntry {
  char: string;
  code: string;
  parts: string[];
  roles: CodeRole[];
  script: CharScript;
  isHardSplit: boolean;
  xray?: XrayHanziEntry;
  rootDetails: DrillRootBreakdown[];
}

export interface DrillPassage {
  id: string;
  title: string;
  subtitle: string;
  tradText: string;
  simpText: string;
}

// 擴充苦練專用高頻漢字＋易猶豫難拆字（每一個字根皆嚴格對應 LINGMING_ROOT_MAP 官方 269 根）
const EXTRA_DRILL_SPLITS: Array<{
  char: string;
  roots: string[];
  script: CharScript;
  hard?: boolean;
}> = [
  // === 基礎高頻代詞、虛詞、動詞、方位 ===
  { char: '我', roots: ['丿', '扌', '戈'], script: 'common', hard: true },
  { char: '你', roots: ['亻', '勹', '小'], script: 'common' },
  { char: '他', roots: ['亻', '也'], script: 'common' },
  { char: '她', roots: ['女', '也'], script: 'common' },
  { char: '它', roots: ['宀', '匕'], script: 'common' },
  { char: '們', roots: ['亻', '門'], script: 'trad' },
  { char: '们', roots: ['亻', '门'], script: 'simp' },
  { char: '是', roots: ['日', '一', '卜', '人'], script: 'common', hard: true },
  { char: '在', roots: ['𠂇', '丨', '土'], script: 'common', hard: true },
  { char: '這', roots: ['言', '辶'], script: 'trad', hard: true },
  { char: '这', roots: ['文', '辶'], script: 'simp', hard: true },
  { char: '那', roots: ['刀', '二', '阝'], script: 'common', hard: true },
  { char: '個', roots: ['亻', '囗', '古'], script: 'trad' },
  { char: '个', roots: ['人', '丨'], script: 'simp' },
  { char: '與', roots: ['臼', '一', '八'], script: 'trad', hard: true },
  { char: '与', roots: ['一', '乙', '一'], script: 'simp', hard: true },
  { char: '為', roots: ['丶', '丿', '乙', '灬'], script: 'trad', hard: true },
  { char: '为', roots: ['丶', '力', '丶'], script: 'simp' },
  { char: '之', roots: ['之'], script: 'common' },
  { char: '也', roots: ['也'], script: 'common' },
  { char: '了', roots: ['了'], script: 'common' },
  { char: '不', roots: ['不'], script: 'common' },
  { char: '人', roots: ['人'], script: 'common' },
  { char: '大', roots: ['大'], script: 'common' },
  { char: '小', roots: ['小'], script: 'common' },
  { char: '中', roots: ['口', '丨'], script: 'common' },
  { char: '上', roots: ['上'], script: 'common' },
  { char: '下', roots: ['下'], script: 'common' },
  { char: '左', roots: ['𠂇', '工'], script: 'common' },
  { char: '一', roots: ['一'], script: 'common' },
  { char: '二', roots: ['二'], script: 'common' },
  { char: '三', roots: ['三'], script: 'common' },
  { char: '四', roots: ['囗', '儿'], script: 'common' },
  { char: '五', roots: ['一', '丨', '乙', '一'], script: 'common', hard: true },
  { char: '六', roots: ['亠', '八'], script: 'common' },
  { char: '七', roots: ['七'], script: 'common' },
  { char: '八', roots: ['八'], script: 'common' },
  { char: '九', roots: ['九'], script: 'common' },
  { char: '十', roots: ['十'], script: 'common' },
  { char: '千', roots: ['千'], script: 'common' },
  { char: '萬', roots: ['艹', '禺'], script: 'trad', hard: true },
  { char: '万', roots: ['一', '勹', '丿'], script: 'simp', hard: true },
  { char: '多', roots: ['夕', '夕'], script: 'common' },
  { char: '少', roots: ['小', '丿'], script: 'common' },
  { char: '全', roots: ['人', '王'], script: 'common' },
  { char: '半', roots: ['丷', '十', '一'], script: 'common' },
  { char: '早', roots: ['早'], script: 'common' },
  { char: '晚', roots: ['日', '勹', '口', '儿'], script: 'common', hard: true },
  { char: '今', roots: ['人', '丶', '乙'], script: 'common', hard: true },
  { char: '古', roots: ['古'], script: 'common' },
  { char: '新', roots: ['立', '木', '斤'], script: 'common', hard: true },
  { char: '舊', roots: ['艹', '隹', '臼'], script: 'trad', hard: true },
  { char: '旧', roots: ['丨', '日'], script: 'simp' },
  { char: '長', roots: ['長'], script: 'trad' },
  { char: '长', roots: ['长'], script: 'simp' },
  { char: '高', roots: ['高'], script: 'common' },
  { char: '低', roots: ['亻', '氏', '一'], script: 'common' },
  { char: '近', roots: ['斤', '辶'], script: 'common' },
  { char: '遠', roots: ['土', '口', '衤', '辶'], script: 'trad', hard: true },
  { char: '远', roots: ['二', '儿', '辶'], script: 'simp', hard: true },
  { char: '進', roots: ['隹', '辶'], script: 'trad' },
  { char: '进', roots: ['二', '丿', '丨', '辶'], script: 'simp' },
  { char: '退', roots: ['艮', '辶'], script: 'common' },
  { char: '過', roots: ['咼', '辶'], script: 'trad', hard: true },
  { char: '过', roots: ['寸', '辶'], script: 'simp' },
  { char: '還', roots: ['罒', '口', '衤', '辶'], script: 'trad', hard: true },
  { char: '还', roots: ['不', '辶'], script: 'simp' },
  { char: '道', roots: ['丷', '一', '自', '辶'], script: 'common', hard: true },
  { char: '通', roots: ['乙', '丶', '用', '辶'], script: 'common', hard: true },
  { char: '造', roots: ['牛', '口', '辶'], script: 'common' },
  { char: '邊', roots: ['自', '穴', '方', '辶'], script: 'trad', hard: true },
  { char: '边', roots: ['力', '辶'], script: 'simp' },
  { char: '隨', roots: ['阝', '𠂇', '月', '辶'], script: 'trad', hard: true },
  { char: '随', roots: ['阝', '𠂇', '月', '辶'], script: 'simp', hard: true },
  { char: '來', roots: ['來'], script: 'trad' },
  { char: '来', roots: ['一', '米'], script: 'simp' },
  { char: '出', roots: ['山', '凵'], script: 'common', hard: true },
  { char: '入', roots: ['入'], script: 'common' },
  { char: '行', roots: ['彳', '二', '亅'], script: 'common', hard: true },
  { char: '走', roots: ['走'], script: 'common' },
  { char: '步', roots: ['止', '小'], script: 'common', hard: true },
  { char: '止', roots: ['止'], script: 'common' },
  { char: '正', roots: ['正'], script: 'common' },
  { char: '歸', roots: ['刂', '白', '彐', '巾'], script: 'trad', hard: true },
  { char: '归', roots: ['刂', '彐'], script: 'simp' },
  { char: '成', roots: ['戊', '乙'], script: 'common', hard: true },
  { char: '或', roots: ['戈', '口', '一'], script: 'common', hard: true },
  { char: '威', roots: ['戊', '一', '女'], script: 'common', hard: true },
  { char: '感', roots: ['戊', '一', '口', '心'], script: 'common', hard: true },
  { char: '歲', roots: ['山', '止', '戈', '小'], script: 'trad', hard: true },
  { char: '岁', roots: ['山', '夕'], script: 'simp' },
  { char: '可', roots: ['丁', '口'], script: 'common' },
  { char: '以', roots: ['乙', '丶', '人'], script: 'common', hard: true },
  { char: '能', roots: ['厶', '月', '匕', '匕'], script: 'common', hard: true },
  { char: '想', roots: ['木', '目', '心'], script: 'common' },
  { char: '念', roots: ['人', '丶', '乙', '心'], script: 'common', hard: true },
  { char: '忘', roots: ['亡', '心'], script: 'common' },
  { char: '忙', roots: ['忄', '亡'], script: 'common' },
  { char: '盲', roots: ['亡', '目'], script: 'common' },
  { char: '亡', roots: ['亡'], script: 'common' },
  { char: '情', roots: ['忄', '丰', '月'], script: 'common' },
  { char: '靜', roots: ['丰', '月', '爪', '亅'], script: 'trad', hard: true },
  { char: '静', roots: ['丰', '月', '刀', '亅'], script: 'simp', hard: true },
  { char: '晴', roots: ['日', '丰', '月'], script: 'common' },
  { char: '精', roots: ['米', '丰', '月'], script: 'common' },
  { char: '請', roots: ['言', '丰', '月'], script: 'trad' },
  { char: '请', roots: ['讠', '丰', '月'], script: 'simp' },
  { char: '青', roots: ['丰', '月'], script: 'common' },
  { char: '快', roots: ['忄', '乙', '大'], script: 'common' },
  { char: '慢', roots: ['忄', '日', '罒', '又'], script: 'common', hard: true },
  { char: '苦', roots: ['艹', '古'], script: 'common' },
  { char: '樂', roots: ['幺', '白', '幺', '木'], script: 'trad', hard: true },
  { char: '乐', roots: ['丿', '乙', '小'], script: 'simp', hard: true },
  { char: '喜', roots: ['士', '口', '丷', '口'], script: 'common', hard: true },
  { char: '怒', roots: ['女', '又', '心'], script: 'common' },
  { char: '哀', roots: ['亠', '口', '衤'], script: 'common', hard: true },
  { char: '愛', roots: ['爪', '冖', '心', '夂'], script: 'trad', hard: true },
  { char: '爱', roots: ['爪', '冖', '𠂇', '又'], script: 'simp', hard: true },
  { char: '學', roots: ['臼', '乂', '冖', '子'], script: 'trad', hard: true },
  { char: '学', roots: ['⺌', '冖', '子'], script: 'simp' },
  { char: '習', roots: ['乙', '丶', '白'], script: 'trad', hard: true },
  { char: '习', roots: ['习'], script: 'simp' },
  { char: '練', roots: ['糸', '木', '日', '丷'], script: 'trad', hard: true },
  { char: '练', roots: ['纟', '一', '乙', '小'], script: 'simp', hard: true },
  { char: '書', roots: ['肀', '一', '日'], script: 'trad', hard: true },
  { char: '书', roots: ['乙', '乙', '丨', '丶'], script: 'simp', hard: true },
  { char: '寫', roots: ['宀', '臼', '勹', '灬'], script: 'trad', hard: true },
  { char: '写', roots: ['冖', '乙', '一'], script: 'simp', hard: true },
  { char: '讀', roots: ['言', '士', '罒', '貝'], script: 'trad', hard: true },
  { char: '读', roots: ['讠', '十', '乙', '大'], script: 'simp', hard: true },
  { char: '說', roots: ['言', '丷', '口', '儿'], script: 'trad', hard: true },
  { char: '说', roots: ['讠', '丷', '口', '儿'], script: 'simp', hard: true },
  { char: '語', roots: ['言', '一', '乙', '口'], script: 'trad', hard: true },
  { char: '语', roots: ['讠', '一', '乙', '口'], script: 'simp', hard: true },
  { char: '記', roots: ['言', '己'], script: 'trad' },
  { char: '记', roots: ['讠', '己'], script: 'simp' },
  { char: '識', roots: ['言', '立', '日', '戈'], script: 'trad', hard: true },
  { char: '识', roots: ['讠', '口', '八'], script: 'simp' },
  { char: '詞', roots: ['言', '乙', '一', '口'], script: 'trad', hard: true },
  { char: '词', roots: ['讠', '乙', '一', '口'], script: 'simp', hard: true },
  { char: '詩', roots: ['言', '土', '寸'], script: 'trad' },
  { char: '诗', roots: ['讠', '土', '寸'], script: 'simp' },
  { char: '文', roots: ['文'], script: 'common' },
  { char: '章', roots: ['立', '早'], script: 'common' },
  { char: '筆', roots: ['竹', '肀', '一'], script: 'trad', hard: true },
  { char: '笔', roots: ['竹', '毛'], script: 'simp' },
  { char: '紙', roots: ['糸', '丿', '乙', '一'], script: 'trad' },
  { char: '纸', roots: ['纟', '丿', '乙', '一'], script: 'simp' },
  { char: '硯', roots: ['石', '見'], script: 'trad' },
  { char: '砚', roots: ['石', '见'], script: 'simp' },
  { char: '畫', roots: ['肀', '田', '一'], script: 'trad', hard: true },
  { char: '画', roots: ['一', '田', '凵'], script: 'simp', hard: true },
  { char: '鍵', roots: ['金', '廴', '肀', '二'], script: 'trad', hard: true },
  { char: '键', roots: ['钅', '廴', '肀', '二'], script: 'simp', hard: true },
  { char: '鍛', roots: ['金', '匚', '二', '殳'], script: 'trad', hard: true },
  { char: '锻', roots: ['钅', '匚', '二', '殳'], script: 'simp', hard: true },
  { char: '鐵', roots: ['金', '土', '口', '戈'], script: 'trad', hard: true },
  { char: '铁', roots: ['钅', '丿', '大'], script: 'simp' },
  { char: '銅', roots: ['金', '冂', '一', '口'], script: 'trad', hard: true },
  { char: '铜', roots: ['钅', '冂', '一', '口'], script: 'simp', hard: true },
  { char: '玉', roots: ['王', '丶'], script: 'common' },
  { char: '寶', roots: ['宀', '王', '缶', '貝'], script: 'trad', hard: true },
  { char: '宝', roots: ['宀', '王', '丶'], script: 'simp' },
  { char: '金', roots: ['金'], script: 'common' },
  { char: '木', roots: ['木'], script: 'common' },
  { char: '水', roots: ['水'], script: 'common' },
  { char: '火', roots: ['火'], script: 'common' },
  { char: '土', roots: ['土'], script: 'common' },
  { char: '山', roots: ['山'], script: 'common' },
  { char: '石', roots: ['石'], script: 'common' },
  { char: '日', roots: ['日'], script: 'common' },
  { char: '月', roots: ['月'], script: 'common' },
  { char: '手', roots: ['手'], script: 'common' },
  { char: '口', roots: ['口'], script: 'common' },
  { char: '目', roots: ['目'], script: 'common' },
  { char: '耳', roots: ['耳'], script: 'common' },
  { char: '心', roots: ['心'], script: 'common' },
  { char: '田', roots: ['田'], script: 'common' },
  { char: '白', roots: ['白'], script: 'common' },
  { char: '黑', roots: ['黑'], script: 'common' },
  { char: '竹', roots: ['竹'], script: 'common' },
  { char: '米', roots: ['米'], script: 'common' },
  { char: '王', roots: ['王'], script: 'common' },
  { char: '見', roots: ['見'], script: 'trad' },
  { char: '见', roots: ['见'], script: 'simp' },
  { char: '看', roots: ['手', '目'], script: 'common' },
  { char: '聽', roots: ['耳', '壬', '罒', '心'], script: 'trad', hard: true },
  { char: '听', roots: ['口', '斤'], script: 'simp' },
  { char: '聞', roots: ['門', '耳'], script: 'trad', hard: true },
  { char: '闻', roots: ['门', '耳'], script: 'simp', hard: true },
  { char: '開', roots: ['門', '廾'], script: 'trad', hard: true },
  { char: '开', roots: ['二', '丿', '丨'], script: 'simp' },
  { char: '閉', roots: ['門', '十', '丿'], script: 'trad', hard: true },
  { char: '闭', roots: ['门', '十', '丿'], script: 'simp' },
  { char: '關', roots: ['門', '幺', '幺', '廾'], script: 'trad', hard: true },
  { char: '閣', roots: ['門', '夂', '口'], script: 'trad', hard: true },
  { char: '阁', roots: ['门', '夂', '口'], script: 'simp' },
  { char: '國', roots: ['囗', '戈', '口', '一'], script: 'trad', hard: true },
  { char: '圍', roots: ['囗', '乙', '口', '丨'], script: 'trad', hard: true },
  { char: '围', roots: ['囗', '二', '乙'], script: 'simp', hard: true },
  { char: '園', roots: ['囗', '土', '口', '衤'], script: 'trad', hard: true },
  { char: '园', roots: ['囗', '二', '儿'], script: 'simp', hard: true },
  { char: '圖', roots: ['囗', '口', '亠', '囗'], script: 'trad', hard: true },
  { char: '图', roots: ['囗', '夂', '⺀'], script: 'simp', hard: true },
  { char: '同', roots: ['冂', '一', '口'], script: 'common' },
  { char: '周', roots: ['冂', '土', '口'], script: 'common', hard: true },
  { char: '向', roots: ['向'], script: 'common' },
  { char: '區', roots: ['匚', '口', '口', '口'], script: 'trad', hard: true },
  { char: '区', roots: ['匚', '乂'], script: 'simp' },
  { char: '巨', roots: ['匚', '乙'], script: 'common', hard: true },
  { char: '臣', roots: ['臣'], script: 'common' },
  { char: '匠', roots: ['匚', '斤'], script: 'common' },
  { char: '醫', roots: ['匚', '矢', '殳', '酉'], script: 'trad', hard: true },
  { char: '医', roots: ['匚', '矢'], script: 'simp' },
  { char: '幽', roots: ['山', '幺', '幺'], script: 'common', hard: true },
  { char: '幾', roots: ['幺', '幺', '戊', '人'], script: 'trad', hard: true },
  { char: '几', roots: ['几'], script: 'common' },
  { char: '凡', roots: ['几', '丶'], script: 'common' },
  { char: '處', roots: ['虍', '夂', '几'], script: 'trad', hard: true },
  { char: '处', roots: ['夂', '卜'], script: 'simp' },
  { char: '嵐', roots: ['山', '風'], script: 'trad', hard: true },
  { char: '岚', roots: ['山', '几', '乂'], script: 'simp' },
  { char: '晨', roots: ['日', '辰'], script: 'common' },
  { char: '海', roots: ['氵', '丿', '一', '母'], script: 'common', hard: true },
  { char: '湖', roots: ['氵', '古', '月'], script: 'common' },
  { char: '江', roots: ['氵', '工'], script: 'common' },
  { char: '波', roots: ['氵', '皮'], script: 'common' },
  { char: '流', roots: ['氵', '亠', '厶', '川'], script: 'common', hard: true },
  { char: '深', roots: ['氵', '冖', '八', '木'], script: 'common', hard: true },
  { char: '淺', roots: ['氵', '戈', '戈'], script: 'trad' },
  { char: '浅', roots: ['氵', '戈', '戈'], script: 'simp' },
  { char: '洗', roots: ['氵', '丿', '土', '儿'], script: 'common' },
  { char: '注', roots: ['氵', '丶', '王'], script: 'common' },
  { char: '法', roots: ['氵', '土', '厶'], script: 'common' },
  { char: '治', roots: ['氵', '厶', '口'], script: 'common' },
  { char: '活', roots: ['氵', '舌'], script: 'common' },
  { char: '清', roots: ['氵', '丰', '月'], script: 'common' },
  { char: '濁', roots: ['氵', '罒', '勹', '虫'], script: 'trad', hard: true },
  { char: '浊', roots: ['氵', '虫'], script: 'simp' },
  { char: '松', roots: ['木', '八', '厶'], script: 'common' },
  { char: '樹', roots: ['木', '士', '口', '寸'], script: 'trad', hard: true },
  { char: '树', roots: ['木', '又', '寸'], script: 'simp' },
  { char: '枝', roots: ['木', '十', '又'], script: 'common' },
  { char: '葉', roots: ['艹', '世', '木'], script: 'trad', hard: true },
  { char: '叶', roots: ['口', '十'], script: 'simp' },
  { char: '根', roots: ['木', '艮'], script: 'common' },
  { char: '果', roots: ['日', '木'], script: 'common', hard: true },
  { char: '末', roots: ['末'], script: 'common' },
  { char: '未', roots: ['未'], script: 'common' },
  { char: '春', roots: ['三', '人', '日'], script: 'common', hard: true },
  { char: '秋', roots: ['禾', '火'], script: 'common' },
  { char: '光', roots: ['⺌', '兀'], script: 'common' },
  { char: '暗', roots: ['日', '立', '日'], script: 'common' },
  { char: '影', roots: ['日', '亠', '口', '彡'], script: 'common', hard: true },
  { char: '照', roots: ['日', '刀', '口', '灬'], script: 'common', hard: true },
  { char: '烈', roots: ['一', '夕', '刂', '灬'], script: 'common', hard: true },
  { char: '點', roots: ['黑', '口', '卜'], script: 'trad', hard: true },
  { char: '点', roots: ['卜', '口', '灬'], script: 'simp' },
  { char: '然', roots: ['夕', '犬', '灬'], script: 'common', hard: true },
  { char: '熱', roots: ['土', '儿', '九', '灬'], script: 'trad', hard: true },
  { char: '热', roots: ['扌', '九', '丶', '灬'], script: 'simp', hard: true },
  { char: '無', roots: ['丿', '一', '卌', '灬'], script: 'trad', hard: true },
  { char: '无', roots: ['二', '丿', '乙'], script: 'simp' },
  { char: '舞', roots: ['丿', '一', '卌', '夕'], script: 'common', hard: true },
  { char: '年', roots: ['丿', '一', '干', '丨'], script: 'common', hard: true },
  { char: '生', roots: ['生'], script: 'common' },
  { char: '產', roots: ['立', '丿', '厂', '生'], script: 'trad', hard: true },
  { char: '产', roots: ['立', '厂'], script: 'simp' },
  { char: '辰', roots: ['辰'], script: 'common' },
  { char: '電', roots: ['雨', '电'], script: 'trad' },
  { char: '电', roots: ['电'], script: 'simp' },
  { char: '雷', roots: ['雨', '田'], script: 'common' },
  { char: '雪', roots: ['雨', '彐'], script: 'common' },
  { char: '雲', roots: ['雨', '二', '厶'], script: 'trad' },
  { char: '風', roots: ['風'], script: 'trad' },
  { char: '夢', roots: ['艹', '罒', '冖', '夕'], script: 'trad', hard: true },
  { char: '梦', roots: ['木', '木', '夕'], script: 'simp' },
  { char: '真', roots: ['十', '目', '一', '八'], script: 'common', hard: true },
  { char: '假', roots: ['亻', '彐', '又'], script: 'common', hard: true },
  { char: '善', roots: ['羊', '丷', '一', '口'], script: 'common', hard: true },
  { char: '美', roots: ['羊', '大'], script: 'common' },
  { char: '醜', roots: ['酉', '鬼'], script: 'trad', hard: true },
  { char: '丑', roots: ['丑'], script: 'simp' },
  { char: '惡', roots: ['一', '丨', '一', '心'], script: 'trad', hard: true },
  { char: '恶', roots: ['一', '丨', '一', '心'], script: 'simp', hard: true },
  { char: '理', roots: ['王', '里'], script: 'common' },
  { char: '則', roots: ['貝', '刂'], script: 'trad' },
  { char: '则', roots: ['贝', '刂'], script: 'simp' },
  { char: '度', roots: ['广', '廿', '又'], script: 'common', hard: true },
  { char: '量', roots: ['日', '一', '里'], script: 'common', hard: true },
  { char: '計', roots: ['言', '十'], script: 'trad' },
  { char: '计', roots: ['讠', '十'], script: 'simp' },
  { char: '算', roots: ['竹', '目', '廾'], script: 'common', hard: true },
  { char: '數', roots: ['口', '女', '攵'], script: 'trad', hard: true },
  { char: '数', roots: ['米', '女', '攵'], script: 'simp', hard: true },
  { char: '分', roots: ['八', '刀'], script: 'common' },
  { char: '合', roots: ['合'], script: 'common' },
  { char: '單', roots: ['口', '口', '甲', '一'], script: 'trad', hard: true },
  { char: '单', roots: ['丷', '甲', '一'], script: 'simp' },
  { char: '經', roots: ['糸', '乙', '川', '工'], script: 'trad', hard: true },
  { char: '经', roots: ['纟', '又', '工'], script: 'simp' },
  { char: '結', roots: ['糸', '士', '口'], script: 'trad' },
  { char: '结', roots: ['纟', '士', '口'], script: 'simp' },
  { char: '組', roots: ['糸', '且'], script: 'trad' },
  { char: '组', roots: ['纟', '且'], script: 'simp' },
  { char: '編', roots: ['糸', '戶', '冊'], script: 'trad', hard: true },
  { char: '编', roots: ['纟', '户', '冊'], script: 'simp', hard: true },
  { char: '維', roots: ['糸', '隹'], script: 'trad' },
  { char: '维', roots: ['纟', '隹'], script: 'simp' },
  { char: '線', roots: ['糸', '白', '水'], script: 'trad' },
  { char: '线', roots: ['纟', '戈', '戈'], script: 'simp' },
  { char: '細', roots: ['糸', '田'], script: 'trad' },
  { char: '细', roots: ['纟', '田'], script: 'simp' },
  { char: '純', roots: ['糸', '一', '乙', '丨'], script: 'trad' },
  { char: '纯', roots: ['纟', '一', '乙', '丨'], script: 'simp' },
  { char: '綠', roots: ['糸', '彑', '氺'], script: 'trad', hard: true },
  { char: '绿', roots: ['纟', '彑', '氺'], script: 'simp', hard: true },
  { char: '絕', roots: ['糸', '刀', '巴'], script: 'trad' },
  { char: '绝', roots: ['纟', '刀', '巴'], script: 'simp' },
  { char: '續', roots: ['糸', '士', '罒', '貝'], script: 'trad', hard: true },
  { char: '续', roots: ['纟', '十', '乙', '大'], script: 'simp', hard: true },
  { char: '統', roots: ['糸', '亠', '厶', '儿'], script: 'trad', hard: true },
  { char: '统', roots: ['纟', '亠', '厶', '儿'], script: 'simp', hard: true },
  { char: '總', roots: ['糸', '白', '心'], script: 'trad', hard: true },
  { char: '总', roots: ['丷', '口', '心'], script: 'simp' },
  { char: '網', roots: ['糸', '冂', '乂', '亡'], script: 'trad', hard: true },
  { char: '网', roots: ['冂', '乂', '乂'], script: 'simp' },
  { char: '給', roots: ['糸', '合'], script: 'trad' },
  { char: '给', roots: ['纟', '合'], script: 'simp' },
  { char: '望', roots: ['亡', '月', '王'], script: 'common', hard: true },
  { char: '命', roots: ['人', '一', '口', '卩'], script: 'common', hard: true },
  { char: '令', roots: ['人', '丶', '乙'], script: 'common' },
  { char: '領', roots: ['人', '丶', '乙', '頁'], script: 'trad' },
  { char: '领', roots: ['人', '丶', '乙', '页'], script: 'simp' },
  { char: '題', roots: ['日', '正', '頁'], script: 'trad', hard: true },
  { char: '题', roots: ['日', '正', '页'], script: 'simp', hard: true },
  { char: '額', roots: ['宀', '夂', '口', '頁'], script: 'trad', hard: true },
  { char: '额', roots: ['宀', '夂', '口', '页'], script: 'simp', hard: true },
  { char: '顯', roots: ['日', '幺', '灬', '頁'], script: 'trad', hard: true },
  { char: '显', roots: ['日', '业'], script: 'simp' },
  { char: '顏', roots: ['立', '彡', '頁'], script: 'trad', hard: true },
  { char: '颜', roots: ['立', '彡', '页'], script: 'simp', hard: true },
  { char: '飛', roots: ['飛'], script: 'trad' },
  { char: '飞', roots: ['乙', '丶'], script: 'simp' },
  { char: '飯', roots: ['食', '厂', '又'], script: 'trad' },
  { char: '饭', roots: ['饣', '厂', '又'], script: 'simp' },
  { char: '館', roots: ['食', '宀', '口', '口'], script: 'trad', hard: true },
  { char: '馆', roots: ['饣', '宀', '口', '口'], script: 'simp', hard: true },
  { char: '養', roots: ['羊', '食'], script: 'trad' },
  { char: '养', roots: ['羊', '丿', '丨'], script: 'simp' },
  { char: '驅', roots: ['馬', '匚', '口'], script: 'trad', hard: true },
  { char: '驱', roots: ['马', '匚', '乂'], script: 'simp' },
  { char: '驗', roots: ['馬', '僉'], script: 'trad', hard: true },
  { char: '验', roots: ['马', '人', '一'], script: 'simp' },
  { char: '驚', roots: ['艹', '勹', '攵', '馬'], script: 'trad', hard: true },
  { char: '惊', roots: ['忄', '亠', '口', '小'], script: 'simp' },
  { char: '騎', roots: ['馬', '大', '丁', '口'], script: 'trad', hard: true },
  { char: '骑', roots: ['马', '大', '丁', '口'], script: 'simp', hard: true },
  { char: '默', roots: ['黑', '犬'], script: 'common' },
  { char: '麗', roots: ['一', '冂', '鹿'], script: 'trad', hard: true },
  { char: '丽', roots: ['一', '冂', '丶'], script: 'simp' },
  { char: '磊', roots: ['石', '石', '石'], script: 'common', hard: true },
  { char: '轟', roots: ['車', '車', '車'], script: 'trad', hard: true },
  { char: '轰', roots: ['车', '又', '又'], script: 'simp' },
  { char: '龍', roots: ['立', '月', '匕', '三'], script: 'trad', hard: true },
  { char: '龙', roots: ['𠂇', '乙', '丶'], script: 'simp' },
  { char: '立', roots: ['立'], script: 'common' },
  { char: '用', roots: ['用'], script: 'common' },
  { char: '有', roots: ['𠂇', '月'], script: 'common' },
  { char: '得', roots: ['彳', '日', '一', '寸'], script: 'common', hard: true },
  { char: '著', roots: ['艹', '耂', '日'], script: 'common', hard: true },
  { char: '地', roots: ['土', '也'], script: 'common' },
  { char: '把', roots: ['扌', '巴'], script: 'common' },
  { char: '使', roots: ['亻', '一', '口', '乂'], script: 'common', hard: true },
  { char: '作', roots: ['亻', '丿', '一', '丨'], script: 'common', hard: true },
  { char: '做', roots: ['亻', '古', '攵'], script: 'common', hard: true },
  { char: '加', roots: ['力', '口'], script: 'common' },
  { char: '對', roots: ['业', '一', '寸'], script: 'trad', hard: true },
  { char: '对', roots: ['又', '寸'], script: 'simp' },
  { char: '並', roots: ['丷', '一', '业', '一'], script: 'trad', hard: true },
  { char: '并', roots: ['丷', '二', '丿', '丨'], script: 'simp' },
  { char: '從', roots: ['彳', '人', '人', '止'], script: 'trad', hard: true },
  { char: '發', roots: ['癶', '弓', '殳'], script: 'trad', hard: true },
  { char: '发', roots: ['乙', '丿', '又'], script: 'simp', hard: true },
  { char: '實', roots: ['宀', '田', '貝'], script: 'trad', hard: true },
  { char: '实', roots: ['宀', '丶', '丶', '大'], script: 'simp' },
  { char: '當', roots: ['尚', '田'], script: 'trad', hard: true },
  { char: '当', roots: ['⺌', '彐'], script: 'simp' },
  { char: '動', roots: ['丿', '里', '力'], script: 'trad', hard: true },
  { char: '动', roots: ['二', '厶', '力'], script: 'simp' },
  { char: '定', roots: ['宀', '一', '止'], script: 'common', hard: true },
  { char: '家', roots: ['宀', '豕'], script: 'common' },
  { char: '事', roots: ['一', '口', '彐', '亅'], script: 'common', hard: true },
  { char: '公', roots: ['八', '厶'], script: 'common' },
  { char: '共', roots: ['廿', '八'], script: 'common' },
  { char: '其', roots: ['其'], script: 'common' },
  { char: '但', roots: ['亻', '日', '一'], script: 'common' },
  { char: '所', roots: ['戶', '斤'], script: 'trad' },
  { char: '所', roots: ['户', '斤'], script: 'simp' },
  { char: '本', roots: ['木', '一'], script: 'common' },
  { char: '現', roots: ['王', '見'], script: 'trad' },
  { char: '现', roots: ['王', '见'], script: 'simp' },
  { char: '前', roots: ['丷', '一', '月', '刂'], script: 'common', hard: true },
  { char: '後', roots: ['彳', '幺', '夂'], script: 'trad', hard: true },
  { char: '后', roots: ['厂', '一', '口'], script: 'simp' },
  { char: '外', roots: ['夕', '卜'], script: 'common' },
  { char: '內', roots: ['冂', '人'], script: 'trad' },
  { char: '内', roots: ['冂', '人'], script: 'simp' },
  { char: '只', roots: ['口', '八'], script: 'common' },
  { char: '力', roots: ['力'], script: 'common' },
  { char: '氣', roots: ['气', '米'], script: 'trad' },
  { char: '气', roots: ['气'], script: 'simp' },
  { char: '音', roots: ['立', '日'], script: 'common' },
  { char: '韻', roots: ['立', '日', '口', '貝'], script: 'trad', hard: true },
  { char: '韵', roots: ['立', '日', '勹', '丶'], script: 'simp', hard: true },
  { char: '聲', roots: ['士', '尸', '殳', '耳'], script: 'trad', hard: true },
  { char: '声', roots: ['士', '尸', '丿'], script: 'simp' },
  { char: '形', roots: ['二', '丿', '丨', '彡'], script: 'common' },
  { char: '態', roots: ['厶', '月', '匕', '心'], script: 'trad', hard: true },
  { char: '态', roots: ['大', '丶', '心'], script: 'simp' },
  { char: '神', roots: ['礻', '申'], script: 'common' },
  { char: '奇', roots: ['大', '丁', '口'], script: 'common' },
  { char: '妙', roots: ['女', '小', '丿'], script: 'common' },
  { char: '簡', roots: ['竹', '門', '日'], script: 'trad', hard: true },
  { char: '简', roots: ['竹', '门', '日'], script: 'simp', hard: true },
  { char: '繁', roots: ['丿', '母', '攵', '糸'], script: 'common', hard: true },
  { char: '體', roots: ['骨', '曲', '一', '口'], script: 'trad', hard: true },
  { char: '体', roots: ['亻', '木', '一'], script: 'simp' },
  { char: '暢', roots: ['申', '日', '乙', '丿'], script: 'trad', hard: true },
  { char: '畅', roots: ['申', '乙', '丿', '丿'], script: 'simp', hard: true },
  { char: '直', roots: ['十', '目', '乙'], script: 'common', hard: true },
  { char: '覺', roots: ['臼', '乂', '冖', '見'], script: 'trad', hard: true },
  { char: '觉', roots: ['⺌', '冖', '见'], script: 'simp' },
  { char: '反', roots: ['厂', '又'], script: 'common' },
  { char: '射', roots: ['身', '寸'], script: 'common' },
  { char: '速', roots: ['木', '口', '辶'], script: 'common' },
  { char: '穩', roots: ['禾', '爪', '彐', '心'], script: 'trad', hard: true },
  { char: '稳', roots: ['禾', '勹', '彐', '心'], script: 'simp', hard: true },
  { char: '準', roots: ['氵', '隹', '十'], script: 'trad', hard: true },
  { char: '准', roots: ['冫', '隹'], script: 'simp' },
  { char: '確', roots: ['石', '勹', '冖', '隹'], script: 'trad', hard: true },
  { char: '确', roots: ['石', '勹', '用'], script: 'simp', hard: true },
  { char: '破', roots: ['石', '皮'], script: 'common' },
  { char: '壁', roots: ['尸', '辛', '土'], script: 'common', hard: true },
  { char: '空', roots: ['穴', '工'], script: 'common' },
  { char: '位', roots: ['亻', '立'], script: 'common' },
  { char: '置', roots: ['罒', '十', '目', '乙'], script: 'common', hard: true },
  { char: '變', roots: ['言', '糸', '糸', '攵'], script: 'trad', hard: true },
  { char: '变', roots: ['亦', '又'], script: 'simp' },
  { char: '化', roots: ['亻', '匕'], script: 'common' },
  { char: '重', roots: ['丿', '一', '里'], script: 'common', hard: true },
  { char: '複', roots: ['衤', '丿', '日', '夂'], script: 'trad', hard: true },
  { char: '复', roots: ['丿', '一', '日', '夂'], script: 'simp', hard: true },
  { char: '轉', roots: ['車', '一', '由', '寸'], script: 'trad', hard: true },
  { char: '转', roots: ['车', '二', '厶'], script: 'simp' },
  { char: '指', roots: ['扌', '匕', '日'], script: 'common' },
  { char: '節', roots: ['竹', '艮', '卩'], script: 'trad', hard: true },
  { char: '节', roots: ['艹', '卩'], script: 'simp' },
  { char: '奏', roots: ['三', '人', '一', '大'], script: 'common', hard: true },
  { char: '拍', roots: ['扌', '白'], script: 'common' },
  { char: '打', roots: ['扌', '丁'], script: 'common' },
  { char: '擊', roots: ['車', '殳', '手'], script: 'trad', hard: true },
  { char: '击', roots: ['二', '丨', '凵'], script: 'simp', hard: true },
  { char: '落', roots: ['艹', '氵', '夂', '口'], script: 'common', hard: true },
  { char: '躍', roots: ['足', '乙', '丶', '隹'], script: 'trad', hard: true },
  { char: '跃', roots: ['足', '夭'], script: 'simp' },
  { char: '起', roots: ['走', '己'], script: 'common' },
  { char: '停', roots: ['亻', '亠', '口', '丁'], script: 'common', hard: true },
  { char: '留', roots: ['卯', '刀', '田'], script: 'common', hard: true },
  { char: '回', roots: ['囗', '口'], script: 'common' },
  { char: '到', roots: ['至', '刂'], script: 'common' },
  { char: '失', roots: ['丿', '夫'], script: 'common', hard: true },
  { char: '消', roots: ['氵', '⺌', '月'], script: 'common' },
  { char: '滅', roots: ['氵', '戊', '一', '火'], script: 'trad', hard: true },
  { char: '灭', roots: ['一', '火'], script: 'simp' },
  // === 補齊實戰短文高頻用字 ===
  { char: '唯', roots: ['口', '隹'], script: 'common' },
  { char: '熟', roots: ['亠', '口', '九', '灬'], script: 'common', hard: true },
  { char: '而', roots: ['而'], script: 'common' },
  { char: '已', roots: ['已'], script: 'common' },
  { char: '條', roots: ['亻', '夂', '木'], script: 'trad' },
  { char: '条', roots: ['夂', '木'], script: 'simp' },
  { char: '路', roots: ['足', '夂', '口'], script: 'common' },
  { char: '要', roots: ['西', '女'], script: 'common', hard: true },
  { char: '每', roots: ['丿', '一', '母'], script: 'common' },
  { char: '住', roots: ['亻', '丶', '王'], script: 'common' },
  { char: '猶', roots: ['犭', '丷', '酉'], script: 'trad', hard: true },
  { char: '犹', roots: ['犭', '尤'], script: 'simp' },
  { char: '豫', roots: ['予', '虍', '豕'], script: 'trad', hard: true },
  { char: '预', roots: ['予', '页'], script: 'simp' },
  { char: '名', roots: ['夕', '口'], script: 'common' },
  { char: '者', roots: ['耂', '日'], script: 'common' },
  { char: '推', roots: ['扌', '隹'], script: 'common' },
  { char: '朱', roots: ['丿', '未'], script: 'common', hard: true },
  { char: '門', roots: ['門'], script: 'trad' },
  { char: '门', roots: ['门'], script: 'simp' },
  { char: '跡', roots: ['足', '亦'], script: 'trad' },
  { char: '迹', roots: ['亦', '辶'], script: 'simp' },
  { char: '牆', roots: ['爿', '土', '囗', '口'], script: 'trad', hard: true },
  { char: '墙', roots: ['土', '土', '囗', '口'], script: 'simp', hard: true },
  { char: '堅', roots: ['臣', '又', '土'], script: 'trad', hard: true },
  { char: '坚', roots: ['丨', '丨', '又', '土'], script: 'simp', hard: true },
  { char: '悶', roots: ['門', '心'], script: 'trad', hard: true },
  { char: '闷', roots: ['门', '心'], script: 'simp', hard: true },
  { char: '若', roots: ['艹', '𠂇', '口'], script: 'common' },
  { char: '遇', roots: ['禺', '辶'], script: 'common' },
  { char: '難', roots: ['艹', '口', '夫', '隹'], script: 'trad', hard: true },
  { char: '难', roots: ['又', '隹'], script: 'simp' },
  { char: '勿', roots: ['勹', '丿', '丿'], script: 'common' },
  { char: '先', roots: ['丿', '土', '儿'], script: 'common' },
  { char: '首', roots: ['丷', '一', '自'], script: 'common', hard: true },
  { char: '再', roots: ['一', '冂', '土'], script: 'common', hard: true },
  { char: '鎖', roots: ['金', '⺌', '貝'], script: 'trad', hard: true },
  { char: '锁', roots: ['钅', '⺌', '贝'], script: 'simp', hard: true },
  { char: '自', roots: ['自'], script: 'common' },
  { char: '即', roots: ['艮', '卩'], script: 'common' },
  { char: '夜', roots: ['亠', '亻', '夕', '丶'], script: 'common', hard: true },
  { char: '亮', roots: ['亠', '口', '冖', '几'], script: 'common', hard: true },
  { char: '吹', roots: ['口', '欠'], script: 'common' },
  { char: '禾', roots: ['禾'], script: 'common' },
  { char: '河', roots: ['氵', '丁', '口'], script: 'common' },
  { char: '刻', roots: ['亥', '刂'], script: 'common' },
  { char: '痕', roots: ['疒', '艮'], script: 'common' },
  { char: '於', roots: ['方', '人', '⺀'], script: 'trad', hard: true },
  { char: '于', roots: ['一', '十', '亅'], script: 'simp' },
  { char: '晰', roots: ['日', '木', '斤'], script: 'common', hard: true },
  { char: '亂', roots: ['爪', '幺', '乙'], script: 'trad', hard: true },
  { char: '乱', roots: ['舌', '乚'], script: 'simp' },
  { char: '遲', roots: ['尸', '羊', '辶'], script: 'trad', hard: true },
  { char: '迟', roots: ['尸', '寸', '辶'], script: 'simp', hard: true },
  { char: '拆', roots: ['扌', '斤', '丶'], script: 'common' },
  { char: '索', roots: ['十', '冖', '糸'], script: 'common', hard: true },
  { char: '爐', roots: ['火', '虍', '田', '皿'], script: 'trad', hard: true },
  { char: '炉', roots: ['火', '户'], script: 'simp' },
  { char: '煉', roots: ['火', '木', '日', '丷'], script: 'trad', hard: true },
  { char: '炼', roots: ['火', '一', '乙', '小'], script: 'simp', hard: true },
  { char: '錯', roots: ['金', '艹', '一', '日'], script: 'trad', hard: true },
  { char: '错', roots: ['钅', '艹', '一', '日'], script: 'simp', hard: true },
  { char: '觀', roots: ['艹', '口', '隹', '見'], script: 'trad', hard: true },
  { char: '观', roots: ['又', '见'], script: 'simp' },
  { char: '色', roots: ['勹', '巴'], script: 'common' },
  { char: '久', roots: ['勹', '丶'], script: 'common' },
  { char: '言', roots: ['言'], script: 'common' },
  { char: '度', roots: ['广', '卌', '又'], script: 'common', hard: true },
  { char: '皆', roots: ['匕', '匕', '白'], script: 'common' },
];

// Verify all roots in EXTRA_DRILL_SPLITS dynamically and only register valid ones
const DRILL_CHAR_MAP = new Map<string, DrillCharEntry>();

function registerDrillEntry(
  char: string,
  roots: string[],
  script: CharScript,
  isHardSplit: boolean
) {
  if (!char || roots.length === 0) return;
  if (roots.some((r) => !LINGMING_ROOT_MAP.has(r))) return;

  const encoded = encodeLingmingRoots(roots);
  if (!encoded.code) return;

  // Map each character index in `encoded.code` back to its constituent root
  const rootContributions: Array<Array<{ key: string; role: CodeRole }>> = roots.map(() => []);
  const len = roots.length;
  const isXiaoList = roots.map((r) => LINGMING_ROOT_MAP.get(r)?.isXiao ?? false);
  const firstIsXiao = isXiaoList[0];

  const assign = (rootIdx: number, letterIdx: number, role: CodeRole) => {
    if (encoded.code[letterIdx] && rootContributions[rootIdx]) {
      rootContributions[rootIdx].push({ key: encoded.code[letterIdx], role });
    }
  };

  if (firstIsXiao) {
    if (len === 1) {
      assign(0, 0, 'da');
      assign(0, 1, 'yun');
    } else if (len === 2) {
      assign(0, 0, 'da');
      assign(1, 1, 'da');
      if (!isXiaoList[1]) {
        assign(1, 2, 'sheng');
        assign(1, 3, 'yun');
      } else {
        assign(1, 2, 'yun');
      }
    } else if (len === 3) {
      assign(0, 0, 'da');
      assign(1, 1, 'da');
      assign(2, 2, 'da');
      assign(2, 3, isXiaoList[2] ? 'yun' : 'sheng');
    } else {
      assign(0, 0, 'da');
      assign(1, 1, 'da');
      assign(2, 2, 'da');
      assign(len - 1, 3, 'da');
    }
  } else {
    if (len === 1) {
      assign(0, 0, 'da');
      assign(0, 1, 'sheng');
      assign(0, 2, 'yun');
    } else if (len === 2) {
      assign(0, 0, 'da');
      assign(0, 1, 'sheng');
      assign(1, 2, 'da');
      assign(1, 3, isXiaoList[1] ? 'yun' : 'sheng');
    } else {
      assign(0, 0, 'da');
      assign(0, 1, 'sheng');
      assign(1, 2, 'da');
      assign(len - 1, 3, 'da');
    }
  }

  const rootDetails: DrillRootBreakdown[] = roots.map((r, idx) => {
    const info = LINGMING_ROOT_MAP.get(r)!;
    return {
      radical: r,
      ma: info.ma,
      isXiao: info.isXiao,
      chamberKey: info.chamberKey,
      anchor: info.anchor,
      contributedKeys: rootContributions[idx],
    };
  });

  // Prefer more specific script entry if duplicate (e.g. 所 trad vs simp)
  const existing = DRILL_CHAR_MAP.get(char);
  if (existing && existing.script === 'common') return;

  DRILL_CHAR_MAP.set(char, {
    char,
    code: encoded.code,
    parts: roots,
    roles: encoded.roles,
    script,
    isHardSplit: isHardSplit || roots.length >= 3,
    xray: XRAY_HANZI_BY_CHAR[char],
    rootDetails,
  });
}

for (const [char, roots] of LINGMING_CHAR_SPLITS) {
  registerDrillEntry(char, roots, getLingmingCharScript(char), roots.length >= 3);
}

for (const item of EXTRA_DRILL_SPLITS) {
  registerDrillEntry(item.char, item.roots, item.script, Boolean(item.hard));
}

export const ALL_DRILL_CHARS: DrillCharEntry[] = Array.from(DRILL_CHAR_MAP.values());

export function getDrillEntry(char: string): DrillCharEntry | undefined {
  return DRILL_CHAR_MAP.get(char);
}

export const DRILL_PASSAGES: DrillPassage[] = [
  {
    id: 'high-freq-flow',
    title: '高頻日常節奏流',
    subtitle: '覆蓋日常高頻代詞、動作與連接字，專練指間連續轉指與不看鍵盲打。',
    tradText:
      '我們在晨光中前行，看雲開日出，聽清風和鳴。心中明白，學字寫文之道無他，唯手熟而已。這條路不遠，只要每日靜心練習，指尖自然記住每個字根的位置與節奏，從猶豫轉為流暢直覺。',
    simpText:
      '我们在晨光中前行，看云开日出，听清风和鸣。心中明白，学字写文之道无他，唯手熟而已。这条路不远，只要每日静心练习，指尖自然记住每个字根的位置与节奏，从犹豫转为流畅直觉。',
  },
  {
    id: 'enclosure-maze',
    title: '結構迷宮與包圍專練',
    subtitle: '高密度收錄囗門辶心品字三疊結構，專治複雜漢字拆法猶豫。',
    tradText:
      '古國名園之內，山石林森，泉水淼淼。問道者推開朱門，只見墨跡留在牆壁，心意堅定而無悶思。若遇難字勿退，先定首根，再鎖末根，一二三末之間自有法度，破壁而出即見光明。',
    simpText:
      '古国名园之内，山石林森，泉水淼淼。问道者推开朱门，只见墨迹留在墙壁，心意坚定而无闷思。若遇难字勿退，先定首根，再锁末根，一二三末之间自有法度，破壁而出即见光明。',
  },
  {
    id: 'nature-rhythm',
    title: '山水氣象短章',
    subtitle: '自然意象與常用偏旁連打，強化水木火石禾金宮殿之間的手指跨越。',
    tradText:
      '春日花草生香，夏夜星辰明亮，秋風吹過禾田，冬雪靜落岩山。看江河入海，聽松柏生風，白雲飛過青天，金石留下歲月刻痕。人於天地之間，以筆墨寫心聲，字字清晰安穩。',
    simpText:
      '春日花草生香，夏夜星辰明亮，秋风吹过禾田，冬雪静落岩山。看江河入海，听松柏生风，白云飞过青天，金石留下岁月刻痕。人于天地之间，以笔墨写心声，字字清晰安稳。',
  },
  {
    id: 'craft-precision',
    title: '精準擊鍵心法',
    subtitle: '結合編碼、節拍、記憶宮殿與錯字歸零概念的練功短賦。',
    tradText:
      '鍛鍵如鍛鐵，快而不亂，準而不遲。見字即拆其形，手起碼成，不假思索。遇慢則回爐重煉，遇錯則觀其筆畫分色，久而久之，千言萬語皆可直出於指下，如流水行雲。',
    simpText:
      '锻键如锻铁，快而不乱，准而不迟。见字即拆其形，手起码成，不假思索。遇慢则回炉重炼，遇错则观其笔画分色，久而久之，千言万语皆可直出于指下，如流水行云。',
  },
];

export interface ParsedPassageResult {
  tokens: Array<{
    raw: string;
    entry: DrillCharEntry | null; // null = punctuation or unsupported char (auto-skipped visually)
    drillIndex: number; // -1 if skipped
  }>;
  drillableEntries: DrillCharEntry[];
  skippedUnsupportedCount: number;
  punctuationCount: number;
}

const PUNCTUATION_RE = /[\s\p{P}\p{S}0-9a-zA-Z]/u;

export function parseTextForDrill(
  text: string,
  scriptMode: ScriptMode
): ParsedPassageResult {
  const tokens: ParsedPassageResult['tokens'] = [];
  const drillableEntries: DrillCharEntry[] = [];
  let skippedUnsupportedCount = 0;
  let punctuationCount = 0;

  for (const raw of Array.from(text)) {
    const entry = DRILL_CHAR_MAP.get(raw);
    // For pasted text, if scriptMode is 'both', accept any known char; if 'trad' or 'simp', still accept if present in map (for custom paste) OR filter?
    // When using built-in passages, tradText / simpText match scriptMode natively. For pasted text, accept any known char in DRILL_CHAR_MAP so user's pasted text isn't needlessly dropped.
    if (entry && (scriptMode === 'both' || matchesScript(entry.script, scriptMode) || text.length > 0)) {
      const drillIndex = drillableEntries.length;
      drillableEntries.push(entry);
      tokens.push({ raw, entry, drillIndex });
    } else {
      if (PUNCTUATION_RE.test(raw)) {
        punctuationCount++;
      } else {
        skippedUnsupportedCount++;
      }
      tokens.push({ raw, entry: null, drillIndex: -1 });
    }
  }

  return {
    tokens,
    drillableEntries,
    skippedUnsupportedCount,
    punctuationCount,
  };
}

export function buildHardSplitDeck(
  scriptMode: ScriptMode,
  limit = 32
): DrillCharEntry[] {
  const pool = ALL_DRILL_CHARS.filter(
    (e) => e.isHardSplit && matchesScript(e.script, scriptMode)
  );
  // Prioritize entries that also have full MakeMeAHanzi X-ray stroke paths, then shuffle deterministically-fresh
  const withXray = pool.filter((e) => Boolean(e.xray));
  const others = pool.filter((e) => !e.xray);
  const shuffle = <T,>(arr: T[]): T[] => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };
  const combined = [...shuffle(withXray).slice(0, Math.min(18, limit)), ...shuffle(others)];
  return combined.slice(0, limit);
}

export function buildChamberTargetDeck(
  chamberKey: string,
  scriptMode: ScriptMode,
  limit = 16
): DrillCharEntry[] {
  const matching = ALL_DRILL_CHARS.filter(
    (e) =>
      matchesScript(e.script, scriptMode) &&
      (e.rootDetails.some((rd) => rd.chamberKey === chamberKey) ||
        e.code.includes(chamberKey))
  );
  const copy = [...matching];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  if (copy.length >= limit) return copy.slice(0, limit);
  // If fewer than limit, repeat shuffled to ensure solid 16-item muscle drill
  const out = [...copy];
  while (out.length < limit && copy.length > 0) {
    out.push(copy[out.length % copy.length]);
  }
  return out;
}

export function getChamberSummaryForKey(key: string): {
  primaryAnchor: string;
  mnemonic: string;
} {
  const ch = LINGMING_CHAMBER_BY_KEY[key];
  return {
    primaryAnchor: ch?.primaryAnchor || key.toUpperCase(),
    mnemonic: ch?.mnemonic || '',
  };
}
