import {
  KeyTopologyMorphSpec,
  RadicalMorphNode,
  TWENTY_KEY_MORPH_BY_KEY,
  TWENTY_KEY_MORPHS,
} from './twentyKeysMorph';
import {
  buildCornerConvergenceData,
  CornerConvergenceData,
} from './cornerConvergence';
import { KEY_MOTOR_PROFILES, KeyMotorProfile } from './kineticTwoBeat';
import {
  pickRandomCarrierForRadical,
  VariantHanziCarrier,
} from './palaceCloudTraining';
import { LINGMING_CHAR_SPLITS } from './lingming';
import { ScriptMode } from './scriptFilter';

export type TopologyVisualMode = 'converge_guide' | 'flash_reflex' | 'hanzi_xray';

export type TopologyMorphDirection = 'converge' | 'expand';

export type TopologyTriggerStyle = 'pace_flow' | 'key_strike';

export type TopologyDrillOrder =
  | 'sequential'
  | 'key_shuffle'
  | 'cross_key_jump'
  | 'group_drill'
  | 'custom_stream';

export type TopologyKeyScope = 'da' | 'full';

export interface WritingStreamPreset {
  id: string;
  label: string;
  text: string;
  brief: string;
}

export const WRITING_STREAM_PRESETS: WritingStreamPreset[] = [
  {
    id: 'poem_pine',
    label: '明月松间照清泉石上流',
    text: '明月松间照清泉石上流',
    brief: '经典诗句自动拆解为灵明字根流，检验连续写作思绪',
  },
  {
    id: 'classic_cosmos',
    label: '天地玄黄宇宙洪荒日月盈昃',
    text: '天地玄黄宇宙洪荒日月盈昃',
    brief: '千字文开篇，覆盖上下排与多类拓扑焦形',
  },
  {
    id: 'core_radicals',
    label: '木日月山水火口人女心手土金禾石',
    text: '木日月山水火口人女心手土金禾石',
    brief: '15 枚高频实义字根直出，纯净对照收敛与扩张体感',
  },
];

export type TopologyGroupPresetId =
  | 'all_20_core'
  | 'left_hand'
  | 'right_hand'
  | 'bottom_row'
  | 'mother_20';

export interface TopologyGroupPreset {
  id: TopologyGroupPresetId;
  label: string;
  brief: string;
  keys: string[];
  perKeyLimit?: number; // undefined = all radicals in each key
}

export const TOPOLOGY_GROUP_PRESETS: TopologyGroupPreset[] = [
  {
    id: 'mother_20',
    label: '20 键母形速热',
    brief: '每键 1 枚核心母形，快速打通 20 键全盘反射（20 题）',
    keys: TWENTY_KEY_MORPHS.map((s) => s.key),
    perKeyLimit: 1,
  },
  {
    id: 'all_20_core',
    label: '全 20 键跨跳',
    brief: '20 键各抽 2 枚代表字根，防相邻重复的高强度跨键跳跃（40 题）',
    keys: TWENTY_KEY_MORPHS.map((s) => s.key),
    perKeyLimit: 2,
  },
  {
    id: 'bottom_row',
    label: '下排 7 键专攻',
    brief: 'Z X C V B N M 下排收扣专项肌肉记忆',
    keys: ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
    perKeyLimit: 4,
  },
  {
    id: 'left_hand',
    label: '左手 10 键',
    brief: 'Q W R T S D F G Z X C V B 左手分工联训',
    keys: TWENTY_KEY_MORPHS.filter((s) => s.hand === 'L').map((s) => s.key),
    perKeyLimit: 3,
  },
  {
    id: 'right_hand',
    label: '右手 10 键',
    brief: 'Y P H J K L N M 右手分工联训',
    keys: TWENTY_KEY_MORPHS.filter((s) => s.hand === 'R').map((s) => s.key),
    perKeyLimit: 3,
  },
];

export interface TopologyDrillItem {
  uid: string;
  key: string;
  ma: string; // Full lowercase code, e.g. 'rje', 'qo'
  radical: string;
  tag: string;
  title: string;
  node: RadicalMorphNode;
  spec: KeyTopologyMorphSpec;
  motor: KeyMotorProfile;
  convergence: CornerConvergenceData;
  carrier: VariantHanziCarrier | null;
  sourceChar?: string; // Originating Hanzi when decomposed from a writing sentence
}

const convergenceMemo = new Map<string, CornerConvergenceData>();

export function getCachedConvergence(
  key: string,
  node: RadicalMorphNode
): CornerConvergenceData {
  const cacheKey = `${key}::${node.id}`;
  const hit = convergenceMemo.get(cacheKey);
  if (hit) return hit;
  const built = buildCornerConvergenceData(key, node);
  convergenceMemo.set(cacheKey, built);
  return built;
}

function sanitizeLingmingCode(rawCode: string, fallbackKey: string): string {
  const cleaned = rawCode.toLowerCase().replace(/[^a-z]/g, '');
  if (!cleaned) return `${fallbackKey}o`;
  if (cleaned[0] !== fallbackKey) {
    return `${fallbackKey}${cleaned.slice(1)}`;
  }
  return cleaned;
}

function createDrillItem(
  spec: KeyTopologyMorphSpec,
  node: RadicalMorphNode,
  scriptMode: ScriptMode,
  avoidCarrierChar?: string
): TopologyDrillItem {
  const ma = sanitizeLingmingCode(node.code, spec.key);
  const motor = KEY_MOTOR_PROFILES[spec.key] ?? KEY_MOTOR_PROFILES.q;
  const convergence = getCachedConvergence(spec.key, node);
  const carrier = pickRandomCarrierForRadical(
    node.radical,
    spec.key,
    ma,
    avoidCarrierChar,
    scriptMode
  );

  return {
    uid: `${spec.key}::${node.id}`,
    key: spec.key,
    ma,
    radical: node.radical,
    tag: node.tag,
    title: node.title,
    node,
    spec,
    motor,
    convergence,
    carrier,
  };
}

function fisherYates<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function antiClusterByKey(items: TopologyDrillItem[]): TopologyDrillItem[] {
  const list = [...items];
  for (let i = 1; i < list.length; i++) {
    if (list[i].key === list[i - 1].key) {
      for (let j = i + 1; j < list.length; j++) {
        if (list[j].key !== list[i - 1].key) {
          [list[i], list[j]] = [list[j], list[i]];
          break;
        }
      }
    }
  }
  return list;
}

export function buildSingleKeyTopologyDeck(
  key: string,
  shuffle: boolean,
  scriptMode: ScriptMode = 'simp',
  previousCarriers?: Record<string, string>
): TopologyDrillItem[] {
  const spec = TWENTY_KEY_MORPH_BY_KEY.get(key.toLowerCase()) ?? TWENTY_KEY_MORPHS[0];
  const items = spec.nodes.map((node) =>
    createDrillItem(spec, node, scriptMode, previousCarriers?.[`${spec.key}::${node.id}`])
  );
  if (!shuffle || items.length <= 1) return items;
  const shuffled = fisherYates(items);
  if (shuffled[0].uid === items[0].uid) {
    const swapIdx = 1 + Math.floor(Math.random() * (shuffled.length - 1));
    [shuffled[0], shuffled[swapIdx]] = [shuffled[swapIdx], shuffled[0]];
  }
  return shuffled;
}

export function buildGroupTopologyDeck(
  presetId: TopologyGroupPresetId,
  scriptMode: ScriptMode = 'simp',
  previousCarriers?: Record<string, string>
): TopologyDrillItem[] {
  const preset =
    TOPOLOGY_GROUP_PRESETS.find((p) => p.id === presetId) ?? TOPOLOGY_GROUP_PRESETS[1];
  const pool: TopologyDrillItem[] = [];

  for (const k of preset.keys) {
    const spec = TWENTY_KEY_MORPH_BY_KEY.get(k);
    if (!spec || spec.nodes.length === 0) continue;

    let chosenNodes: RadicalMorphNode[];
    if (preset.perKeyLimit === 1) {
      chosenNodes = [spec.nodes[0]];
    } else if (preset.perKeyLimit && preset.perKeyLimit < spec.nodes.length) {
      // Always include either mother archetype + random slice, or shuffled top slice for fresh variety
      const shuffledRest = fisherYates(spec.nodes.slice(1));
      const useMother = Math.random() < 0.72;
      chosenNodes = useMother
        ? [spec.nodes[0], ...shuffledRest.slice(0, preset.perKeyLimit - 1)]
        : fisherYates(spec.nodes).slice(0, preset.perKeyLimit);
    } else {
      chosenNodes = spec.nodes;
    }

    for (const node of chosenNodes) {
      pool.push(
        createDrillItem(
          spec,
          node,
          scriptMode,
          previousCarriers?.[`${spec.key}::${node.id}`]
        )
      );
    }
  }

  return antiClusterByKey(fisherYates(pool));
}

export function rerollSingleItemCarrier(
  item: TopologyDrillItem,
  scriptMode: ScriptMode = 'simp'
): TopologyDrillItem {
  const nextCarrier = pickRandomCarrierForRadical(
    item.radical,
    item.key,
    item.ma,
    item.carrier?.char,
    scriptMode
  );
  if (!nextCarrier) return item;
  return { ...item, carrier: nextCarrier };
}

export function getNextMorphKey(currentKey: string, delta = 1): string {
  const idx = TWENTY_KEY_MORPHS.findIndex((s) => s.key === currentKey.toLowerCase());
  const base = idx >= 0 ? idx : 0;
  return TWENTY_KEY_MORPHS[(base + delta + TWENTY_KEY_MORPHS.length) % TWENTY_KEY_MORPHS.length]
    .key;
}

export function computeMedianMs(samples: number[]): number {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? Math.round(sorted[mid])
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

// Fast lookup index from radical glyph -> (spec, node) and from Hanzi -> constituent radicals
let cachedMorphByRadical: Map<string, { spec: KeyTopologyMorphSpec; node: RadicalMorphNode }> | null =
  null;
let cachedSplitMap: Map<string, string[]> | null = null;

function getMorphByRadicalIndex() {
  if (cachedMorphByRadical) return cachedMorphByRadical;
  const map = new Map<string, { spec: KeyTopologyMorphSpec; node: RadicalMorphNode }>();
  for (const spec of TWENTY_KEY_MORPHS) {
    for (const node of spec.nodes) {
      if (!map.has(node.radical)) {
        map.set(node.radical, { spec, node });
      }
    }
  }
  cachedMorphByRadical = map;
  return map;
}

function getSplitIndex() {
  if (cachedSplitMap) return cachedSplitMap;
  cachedSplitMap = new Map<string, string[]>(LINGMING_CHAR_SPLITS);
  return cachedSplitMap;
}

/**
 * Resolve any user-entered string of radicals, Chinese sentences, or consonant keys
 * into a playable TopologyDrillItem stream for writing-speed cognition testing.
 */
export function buildCustomTextTopologyDeck(
  rawInput: string,
  scriptMode: ScriptMode = 'simp'
): { items: TopologyDrillItem[]; unmatchedChars: string[] } {
  const morphIndex = getMorphByRadicalIndex();
  const splitIndex = getSplitIndex();
  const items: TopologyDrillItem[] = [];
  const unmatchedChars: string[] = [];
  let seq = 0;

  const pushNode = (
    spec: KeyTopologyMorphSpec,
    node: RadicalMorphNode,
    sourceChar?: string
  ) => {
    const base = createDrillItem(spec, node, scriptMode);
    items.push({
      ...base,
      uid: `custom_${seq++}_${spec.key}::${node.id}`,
      sourceChar,
    });
  };

  for (const ch of Array.from(rawInput.trim())) {
    if (!ch.trim() || /[，。、！？；：「」『』（）(),.!?;:\s]/.test(ch)) continue;

    // 1. Direct match against all 249+ 20-key morph radicals
    const direct = morphIndex.get(ch);
    if (direct) {
      pushNode(direct.spec, direct.node);
      continue;
    }

    // 2. Compound Hanzi -> decompose via LINGMING_CHAR_SPLITS into constituent morph radicals
    const parts = splitIndex.get(ch);
    if (parts && parts.length > 0) {
      let matchedAny = false;
      for (const rad of parts) {
        const hit = morphIndex.get(rad);
        if (hit) {
          pushNode(hit.spec, hit.node, ch);
          matchedAny = true;
        }
      }
      if (matchedAny) continue;
    }

    // 3. Consonant key letter -> pick mother archetype (or random exemplar) for that key
    const lower = ch.toLowerCase();
    const keySpec = TWENTY_KEY_MORPH_BY_KEY.get(lower);
    if (keySpec && keySpec.nodes.length > 0) {
      pushNode(keySpec, keySpec.nodes[0]);
      continue;
    }

    unmatchedChars.push(ch);
  }

  return { items, unmatchedChars };
}

