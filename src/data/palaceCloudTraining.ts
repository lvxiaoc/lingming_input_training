import {
  PALACE_PDF_CHAMBERS,
  PdfMonumentGlyph,
  PdfRadicalGlyph,
  PdfStrokeTier,
} from './palacePdfData';
import {
  getLingmingRadicalScript,
  LINGMING_CHAMBER_BY_KEY,
  LINGMING_CHAR_SPLITS,
  LINGMING_ROOT_MAP,
  getLingmingCharScript,
} from './lingming';
import { HUANGTING_CHAR_MAP } from './huangtingjing';
import {
  loadUserHuangtingOverrides,
  resolveHuangtingCharInfo,
} from './huangtingOverrides';
import { XRAY_HANZI_BY_CHAR, XRAY_HANZI_ENTRIES } from './xrayHanziData';
import { ALL_DRILL_CHARS } from './drillLexicon';
import { loadPalaceOverrides, PalaceOverridesMap } from './palaceEditor';
import { CharScript, matchesScript, ScriptMode } from './scriptFilter';

export type PalaceCloudTrainMode = 'template' | 'variant_cloud';
export type PalaceWalkOrder = 'sequential' | 'chamber_shuffle' | 'cross_key_jump';

export interface CloudWalkStep {
  nodeId: string;
  chamberKey: string;
  orderIndex: number;
  isMonument: boolean;
  char: string;
  rawChar: string;
  parentChar: string;
  ma: string;
  isXiao: boolean;
  tier: PdfStrokeTier;
  isVariant: boolean;
  isPua: boolean;
  path: string;
  cx: number;
  cy: number;
  r: number;
  pinyin: string;
  note: string;
  inScript: boolean;
  azimuthLabel: string;
}

export interface VariantHanziCarrier {
  char: string;
  matchedRadical: string;
  isVariantMatch: boolean;
  strokes?: string[];
  highlightIndices: number[];
  script: CharScript;
  fullCode: string;
}

// Bridge variant radical glyphs & Kangxi radicals to standard radical forms used in Hanzi decompositions
const VARIANT_RADICAL_ALIASES: Record<string, string[]> = {
  '⻍': ['辶'],
  '⻌': ['辶'],
  '辶': ['⻍', '⻌'],
  '⺮': ['竹'],
  '竹': ['⺮'],
  '⺡': ['氵', '水'],
  '氵': ['水', '⺡'],
  '水': ['氵'],
  '⺖': ['忄', '心'],
  '忄': ['心', '⺖'],
  '心': ['忄', '⺗'],
  '⺗': ['心'],
  '⺘': ['扌', '手'],
  '扌': ['手', '⺘'],
  '手': ['扌'],
  '⺨': ['犭', '犬'],
  '犭': ['犬', '⺨'],
  '犬': ['犭'],
  '⺙': ['攵', '攴'],
  '攵': ['攴', '⺙'],
  '灬': ['火'],
  '火': ['灬'],
  '爫': ['爪'],
  '爪': ['爫'],
  '⺧': ['牛'],
  '牛': ['⺧', '牜'],
  '牜': ['牛'],
  '⻊': ['足'],
  '足': ['⻊'],
  '⻗': ['雨'],
  '雨': ['⻗'],
  '⻖': ['阝'],
  '⻏': ['阝'],
  '阝': ['⻖', '⻏'],
  '⺬': ['礻', '示'],
  '礻': ['示', '⺬'],
  '⻂': ['衤', '衣'],
  '衤': ['衣', '⻂'],
  '⻠': ['食', '飠', '饣'],
  '飠': ['食', '饣'],
  '饣': ['食', '飠'],
  '⻞': ['食', '飠'],
  '⻡': ['飠', '食'],
  '⺳': ['罒', '网'],
  '罒': ['网', '⺳'],
  '覀': ['西', '襾'],
  '襾': ['覀', '西'],
  '⺪': ['疋'],
  '⺐': ['尤'],
  '⺁': ['厂'],
  '⺆': ['冂'],
  '⺇': ['几'],
  '⺈': ['刀'],
  '⺋': ['卩'],
  '⺍': ['小'],
  '⺎': ['尢'],
  '⺒': ['巳'],
  '⺓': ['幺'],
  '⺔': ['彐'],
  '⺕': ['彐'],
  '⺜': ['日'],
  '⺝': ['月'],
  '⺞': ['歹'],
  '⺥': ['爪'],
  '⺦': ['丬', '爿'],
  '丬': ['爿'],
  '⺩': ['王', '玉'],
  '王': ['⺩'],
  '⺫': ['目'],
  '⺭': ['礻'],
  '⺵': ['羊'],
  '⺶': ['羊'],
  '羊': ['⺶', '⺷'],
  '⺷': ['羊'],
  '⺸': ['羊'],
  '⺹': ['耂', '老'],
  '耂': ['老'],
  '⺽': ['臼'],
  '⺾': ['艹'],
  '艹': ['⺾', '⺿', '⻀'],
  '⻃': ['覀', '西'],
  '⻅': ['见'],
  '⻆': ['角'],
  '⻇': ['角'],
  '⻈': ['讠', '言'],
  '讠': ['言'],
  '言': ['讠'],
  '⻉': ['贝'],
  '⻋': ['车'],
  '⻔': ['门'],
  '⻕': ['阝'],
  '⻘': ['青'],
  '⻙': ['韦'],
  '⻚': ['页'],
  '⻛': ['风'],
  '⻜': ['飞'],
  '⻟': ['飠', '食'],
  '⻢': ['马'],
  '⻣': ['骨'],
  '⻤': ['鬼'],
  '⻥': ['鱼'],
  '⻦': ['鸟'],
  '⻨': ['麦'],
  '⻩': ['黄'],
  '⻫': ['齐'],
  '⻬': ['齊'],
  '⻭': ['齿'],
  '⻯': ['龙'],
  '⻰': ['龍'],
  '⻱': ['龟'],
  '龴': ['又', 'マ'],
  '⺀': ['冫', '二'],
  '冫': ['⺀', '二'],
  '乚': ['乙'],
  '亅': ['乙'],
  '镸': ['長'],
  '戸': ['户', '戶'],
  '戶': ['户', '戸'],
  '糸': ['糹', '纟'],
  '糹': ['糸'],
  '纟': ['糸'],
  '金': ['釒', '钅'],
  '釒': ['金'],
  '钅': ['金'],
};

function computeAzimuthLabel(
  cx: number,
  cy: number,
  anchorCx: number,
  anchorCy: number,
  isMonument: boolean
): string {
  if (isMonument) return '中央骨架';
  const dx = cx - anchorCx;
  const dy = cy - anchorCy;
  const dist = Math.hypot(dx, dy);
  if (dist < 10) return '主根心位';

  // Angle in screen SVG space (y increases downward)
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (angle >= -22.5 && angle < 22.5) return '正右翼';
  if (angle >= 22.5 && angle < 67.5) return '右下方';
  if (angle >= 67.5 && angle < 112.5) return '正下方';
  if (angle >= 112.5 && angle < 157.5) return '左下方';
  if (angle >= 157.5 || angle < -157.5) return '正左翼';
  if (angle >= -157.5 && angle < -112.5) return '左上方';
  if (angle >= -112.5 && angle < -67.5) return '正上方';
  return '右上方';
}

function resolveNodeScript(
  displayChar: string,
  parentChar: string,
  chamberKey: string,
  ma: string
): CharScript {
  const ds = getLingmingRadicalScript(displayChar, chamberKey, ma);
  if (ds !== 'common') return ds;
  return getLingmingRadicalScript(parentChar, chamberKey, ma);
}

export function buildCloudWalkSequence(
  chamberKey: string,
  scriptMode: ScriptMode,
  includeMonument = true,
  overridesInput?: PalaceOverridesMap
): CloudWalkStep[] {
  const key = chamberKey.toLowerCase();
  const pdf = PALACE_PDF_CHAMBERS[key];
  if (!pdf) return [];

  const overrides = overridesInput ?? loadPalaceOverrides();
  const mon: PdfMonumentGlyph = pdf.monument;
  const mOv = overrides[mon.id];
  const anchorCx = mon.cx + (mOv?.dx ?? 0);
  const anchorCy = mon.cy + (mOv?.dy ?? 0);
  const monCanonical = LINGMING_ROOT_MAP.get(mon.displayChar);
  const monMa = mon.ma || monCanonical?.ma || `${key}o`;

  const steps: CloudWalkStep[] = [];
  if (includeMonument) {
    steps.push({
      nodeId: mon.id,
      chamberKey: key,
      orderIndex: 0,
      isMonument: true,
      char: mon.displayChar,
      rawChar: mon.rawChar,
      parentChar: mon.displayChar,
      ma: monMa,
      isXiao: monMa.length === 2,
      tier: 'primary',
      isVariant: false,
      isPua: false,
      path: mon.path,
      cx: anchorCx,
      cy: anchorCy,
      r: mon.r * (mOv?.scale ?? 1),
      pinyin: mon.pinyin,
      note: monCanonical?.note || '主字根骨架',
      inScript: true,
      azimuthLabel: '中央骨架',
    });
  }

  const nodeSteps: CloudWalkStep[] = [];
  for (const n of pdf.nodes as PdfRadicalGlyph[]) {
    const ov = overrides[n.id];
    const effCx = n.cx + (ov?.dx ?? 0);
    const effCy = n.cy + (ov?.dy ?? 0);
    const effR = n.r * (ov?.scale ?? 1);
    const canonical = LINGMING_ROOT_MAP.get(n.displayChar) || LINGMING_ROOT_MAP.get(n.parentChar);
    const ma = n.ma || canonical?.ma || monMa;
    const radScript = resolveNodeScript(n.displayChar, n.parentChar, key, ma);
    const inScript = matchesScript(radScript, scriptMode);

    nodeSteps.push({
      nodeId: n.id,
      chamberKey: key,
      orderIndex: steps.length + nodeSteps.length,
      isMonument: false,
      char: n.displayChar,
      rawChar: n.rawChar,
      parentChar: n.parentChar,
      ma,
      isXiao: ma.length === 2,
      tier: n.tier,
      isVariant: n.isVariant,
      isPua: n.isPua,
      path: n.path,
      cx: effCx,
      cy: effCy,
      r: effR,
      pinyin: n.pinyin,
      note:
        n.isVariant && n.parentChar !== n.displayChar
          ? `「${n.parentChar}」變形根`
          : canonical?.note || (ma.length === 2 ? '小根 2 碼' : '大根 3 碼'),
      inScript,
      azimuthLabel: computeAzimuthLabel(effCx, effCy, anchorCx, anchorCy, false),
    });
  }

  // Keep in-script nodes in their native PDF stroke-order trajectory;
  // only fall back to all nodes if filtering leaves zero satellite nodes
  const inScriptNodes = nodeSteps.filter((s) => s.inScript);
  const chosenNodes = inScriptNodes.length > 0 ? inScriptNodes : nodeSteps;

  const combined = [...steps, ...chosenNodes];
  return combined.map((s, idx) => ({ ...s, orderIndex: idx }));
}

export function shuffleCloudSteps(steps: CloudWalkStep[]): CloudWalkStep[] {
  if (steps.length <= 1) return steps;
  const copy = [...steps];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  // Avoid starting on the exact same nodeId if we had >= 2 nodes
  if (copy[0].nodeId === steps[0].nodeId) {
    const swapIdx = 1 + Math.floor(Math.random() * (copy.length - 1));
    [copy[0], copy[swapIdx]] = [copy[swapIdx], copy[0]];
  }
  return copy;
}

export interface CrossKeyJumpDeck {
  stepsByKey: Record<string, CloudWalkStep[]>;
  deck: CloudWalkStep[];
  carriersByKey: Record<string, Record<string, VariantHanziCarrier | null>>;
}

export function buildCrossKeyJumpDeck(
  scriptMode: ScriptMode,
  includeMonument = false,
  overridesInput?: PalaceOverridesMap,
  previousCarriersByKey?: Record<string, Record<string, VariantHanziCarrier | null>>
): CrossKeyJumpDeck {
  const overrides = overridesInput ?? loadPalaceOverrides();
  const stepsByKey: Record<string, CloudWalkStep[]> = {};
  const carriersByKey: Record<string, Record<string, VariantHanziCarrier | null>> = {};
  const pool: CloudWalkStep[] = [];

  for (const key of Object.keys(PALACE_PDF_CHAMBERS)) {
    const seq = buildCloudWalkSequence(key, scriptMode, includeMonument, overrides);
    if (seq.length === 0) continue;
    stepsByKey[key] = seq;
    carriersByKey[key] = sampleEnhancedCloudCarriers(
      seq,
      key,
      scriptMode,
      previousCarriersByKey?.[key]
    );
    pool.push(...seq);
  }

  // Fisher-Yates shuffle across all 20 consonant chambers
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  // Anti-cluster pass: avoid consecutive items landing on the same palace key so each hit jumps across keys
  for (let i = 1; i < pool.length; i++) {
    if (pool[i].chamberKey === pool[i - 1].chamberKey) {
      for (let k = i + 1; k < pool.length; k++) {
        if (pool[k].chamberKey !== pool[i - 1].chamberKey) {
          [pool[i], pool[k]] = [pool[k], pool[i]];
          break;
        }
      }
    }
  }

  return { stepsByKey, deck: pool, carriersByKey };
}

// ==================== Offline Hanzi Carrier Index (Roots + Variants) ====================

type CarrierBucket = Map<string, VariantHanziCarrier[]>;
let cachedCarrierIndex: CarrierBucket | null = null;

function pushCarrier(
  bucket: CarrierBucket,
  radicalKey: string,
  item: VariantHanziCarrier,
  seenPerKey: Map<string, Set<string>>
) {
  if (!radicalKey) return;
  let seen = seenPerKey.get(radicalKey);
  if (!seen) {
    seen = new Set<string>();
    seenPerKey.set(radicalKey, seen);
  }
  if (seen.has(item.char)) return;
  seen.add(item.char);

  const arr = bucket.get(radicalKey);
  if (arr) {
    arr.push(item);
  } else {
    bucket.set(radicalKey, [item]);
  }
}

function getCarrierIndex(): CarrierBucket {
  if (cachedCarrierIndex) return cachedCarrierIndex;

  const bucket: CarrierBucket = new Map();
  const seenPerKey = new Map<string, Set<string>>();
  const userOverrides = loadUserHuangtingOverrides();

  // 1. Highest fidelity: XRAY_HANZI_ENTRIES (exact MakeMeAHanzi strokes + target strokeIndices)
  for (const entry of XRAY_HANZI_ENTRIES) {
    const script = getLingmingCharScript(entry.char);
    const ht = resolveHuangtingCharInfo(entry.char, userOverrides);
    const fullCode = ht?.code || '';
    for (const t of entry.targets) {
      pushCarrier(
        bucket,
        t.radical,
        {
          char: entry.char,
          matchedRadical: t.radical,
          isVariantMatch: false,
          strokes: entry.strokes,
          highlightIndices: t.strokeIndices,
          script,
          fullCode,
        },
        seenPerKey
      );
    }
  }

  // 2. HUANGTING_CHAR_MAP (hundreds of literary Hanzi with per-stroke root indices)
  for (const ch of Object.keys(HUANGTING_CHAR_MAP)) {
    const info = resolveHuangtingCharInfo(ch, userOverrides);
    if (!info || !info.roots || info.roots.length === 0) continue;
    const script = getLingmingCharScript(ch);

    // Build stroke index groupings per root slot
    const indicesBySlot = new Map<number, number[]>();
    if (info.strokes && info.strokeRootIndices) {
      info.strokeRootIndices.forEach((slotIdx, strokeIdx) => {
        if (slotIdx >= 0) {
          const list = indicesBySlot.get(slotIdx);
          if (list) list.push(strokeIdx);
          else indicesBySlot.set(slotIdx, [strokeIdx]);
        }
      });
    }

    info.roots.forEach((rad, slotIdx) => {
      const highlightIndices = indicesBySlot.get(slotIdx) ?? [];
      pushCarrier(
        bucket,
        rad,
        {
          char: ch,
          matchedRadical: rad,
          isVariantMatch: false,
          strokes: info.strokes,
          highlightIndices,
          script,
          fullCode: info.code,
        },
        seenPerKey
      );
    });
  }

  // 3. LINGMING_CHAR_SPLITS & ALL_DRILL_CHARS (enrich coverage; attach Xray strokes if available)
  for (const [ch, parts] of LINGMING_CHAR_SPLITS) {
    const xray = XRAY_HANZI_BY_CHAR.get(ch);
    const ht = resolveHuangtingCharInfo(ch, userOverrides);
    const script = getLingmingCharScript(ch);
    for (const rad of parts) {
      const xrayTarget = xray?.targets.find((t) => t.radical === rad);
      let htHighlights: number[] = [];
      if (ht?.roots && ht?.strokeRootIndices) {
        const slot = ht.roots.indexOf(rad);
        if (slot >= 0) {
          htHighlights = ht.strokeRootIndices
            .map((s, idx) => (s === slot ? idx : -1))
            .filter((idx) => idx >= 0);
        }
      }
      pushCarrier(
        bucket,
        rad,
        {
          char: ch,
          matchedRadical: rad,
          isVariantMatch: false,
          strokes: xray?.strokes ?? ht?.strokes,
          highlightIndices: xrayTarget?.strokeIndices ?? htHighlights,
          script,
          fullCode: ht?.code || '',
        },
        seenPerKey
      );
    }
  }

  for (const d of ALL_DRILL_CHARS) {
    const xray = XRAY_HANZI_BY_CHAR.get(d.char);
    const ht = resolveHuangtingCharInfo(d.char, userOverrides);
    const script = d.script ?? getLingmingCharScript(d.char);
    for (const rad of d.parts) {
      const xrayTarget = xray?.targets.find((t) => t.radical === rad);
      let htHighlights: number[] = [];
      if (ht?.roots && ht?.strokeRootIndices) {
        const slot = ht.roots.indexOf(rad);
        if (slot >= 0) {
          htHighlights = ht.strokeRootIndices
            .map((s, idx) => (s === slot ? idx : -1))
            .filter((idx) => idx >= 0);
        }
      }
      pushCarrier(
        bucket,
        rad,
        {
          char: d.char,
          matchedRadical: rad,
          isVariantMatch: false,
          strokes: xray?.strokes ?? ht?.strokes,
          highlightIndices: xrayTarget?.strokeIndices ?? htHighlights,
          script,
          fullCode: d.code || ht?.code || '',
        },
        seenPerKey
      );
    }
  }

  cachedCarrierIndex = bucket;
  return bucket;
}

export function getCarriersForCloudStep(
  step: CloudWalkStep,
  chamberKey: string,
  scriptMode: ScriptMode
): VariantHanziCarrier[] {
  const bucket = getCarrierIndex();
  const collected: VariantHanziCarrier[] = [];
  const seenChars = new Set<string>();

  const appendFromKey = (lookupKey: string, isVariantBridge: boolean) => {
    const list = bucket.get(lookupKey);
    if (!list) return;
    for (const item of list) {
      if (seenChars.has(item.char)) continue;
      // Avoid picking the exact isolated standalone radical itself unless no compound exists
      seenChars.add(item.char);
      collected.push({
        ...item,
        isVariantMatch: item.isVariantMatch || isVariantBridge || step.isVariant,
      });
    }
  };

  // Priority 1: Direct match on node's displayed form (captures direct variant glyphs like 艹, 扌, 氵, 灬)
  if (!step.isPua) {
    appendFromKey(step.char, step.isVariant);
    const directAliases = VARIANT_RADICAL_ALIASES[step.char];
    if (directAliases) {
      for (const a of directAliases) appendFromKey(a, true);
    }
  }

  // Priority 2: Bridge via canonical parentChar (captures PUA & merged variants like 龴→又, ⻍→辶, →又)
  if (step.parentChar) {
    appendFromKey(step.parentChar, step.isVariant || step.parentChar !== step.char);
    const parentAliases = VARIANT_RADICAL_ALIASES[step.parentChar];
    if (parentAliases) {
      for (const a of parentAliases) appendFromKey(a, true);
    }
  }

  // Priority 3: If still sparse, bridge to sibling radicals sharing the exact same Lingming code on this key
  if (collected.length < 3) {
    const chamber = LINGMING_CHAMBER_BY_KEY[chamberKey.toLowerCase()];
    if (chamber) {
      for (const cl of chamber.clusters) {
        for (const r of cl.radicals) {
          if (r.ma === step.ma) {
            appendFromKey(r.char, true);
            const sibAliases = VARIANT_RADICAL_ALIASES[r.char];
            if (sibAliases) {
              for (const a of sibAliases) appendFromKey(a, true);
            }
          }
        }
      }
    }
  }

  // Filter by scriptMode; fall back if empty
  const scriptFiltered = collected.filter((c) => matchesScript(c.script, scriptMode));
  const pool = scriptFiltered.length > 0 ? scriptFiltered : collected;

  // Prefer multi-stroke compound Hanzi with full MakeMeAHanzi X-Ray highlightIndices
  return [...pool].sort((a, b) => {
    const aCompound = a.char !== step.char && a.char !== step.parentChar ? 1 : 0;
    const bCompound = b.char !== step.char && b.char !== step.parentChar ? 1 : 0;
    if (aCompound !== bCompound) return bCompound - aCompound;

    const aXray = a.strokes && a.highlightIndices.length > 0 ? 1 : 0;
    const bXray = b.strokes && b.highlightIndices.length > 0 ? 1 : 0;
    if (aXray !== bXray) return bXray - aXray;

    const aHasStrokes = a.strokes && a.strokes.length > 0 ? 1 : 0;
    const bHasStrokes = b.strokes && b.strokes.length > 0 ? 1 : 0;
    return bHasStrokes - aHasStrokes;
  });
}

function pickRandomFromTopPool(
  candidates: VariantHanziCarrier[],
  avoidChars: Set<string>
): VariantHanziCarrier | null {
  if (candidates.length === 0) return null;
  // Restrict random draw to the highest-quality tier (e.g. compound + X-ray highlighted if available)
  const withXray = candidates.filter((c) => c.strokes && c.highlightIndices.length > 0);
  const topPool = withXray.length > 0 ? withXray : candidates;
  const freshPool = topPool.filter((c) => !avoidChars.has(c.char));
  const finalPool = freshPool.length > 0 ? freshPool : topPool;
  const idx = Math.floor(Math.random() * finalPool.length);
  return finalPool[idx];
}

export function sampleEnhancedCloudCarriers(
  steps: CloudWalkStep[],
  chamberKey: string,
  scriptMode: ScriptMode,
  avoidPrevious?: Record<string, VariantHanziCarrier | null>
): Record<string, VariantHanziCarrier | null> {
  const result: Record<string, VariantHanziCarrier | null> = {};
  const usedInCloud = new Set<string>();

  for (const step of steps) {
    if (step.isMonument) {
      result[step.nodeId] = null;
      continue;
    }
    const candidates = getCarriersForCloudStep(step, chamberKey, scriptMode);
    const prevChar = avoidPrevious?.[step.nodeId]?.char;
    const avoid = new Set<string>(usedInCloud);
    if (prevChar && candidates.length > 1) {
      avoid.add(prevChar);
    }
    const picked = pickRandomFromTopPool(candidates, avoid);
    result[step.nodeId] = picked;
    if (picked) {
      usedInCloud.add(picked.char);
    }
  }
  return result;
}
