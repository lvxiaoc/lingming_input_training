import { LINGMING_ROOT_MAP, getLingmingRadicalScript } from './lingming';
import { TWENTY_KEY_MORPHS_PART1 } from './twentyKeysMorphPart1';
import { TWENTY_KEY_MORPHS_PART2 } from './twentyKeysMorphPart2';
import { TWENTY_KEY_MORPH_EXT1 } from './twentyKeysMorphExt1';
import { TWENTY_KEY_MORPH_EXT2 } from './twentyKeysMorphExt2';
import { KeyTopologyMorphSpec, RadicalMorphNode } from './twentyKeysMorphTypes';

export * from './twentyKeysMorphTypes';

const ALL_EXT_BY_KEY: Record<string, RadicalMorphNode[]> = {
  ...TWENTY_KEY_MORPH_EXT1,
  ...TWENTY_KEY_MORPH_EXT2,
};

function mergeKeySpec(base: KeyTopologyMorphSpec): KeyTopologyMorphSpec {
  const extras = ALL_EXT_BY_KEY[base.key] ?? [];
  const seen = new Set(base.nodes.map((n) => n.radical));
  const uniqueExtras = extras.filter((n) => !seen.has(n.radical));

  // Order newly appended radicals by real Lingming frequency rank while keeping base.nodes[0] mother archetype intact
  uniqueExtras.sort((a, b) => {
    const ra = LINGMING_ROOT_MAP.get(a.radical)?.rank ?? 999;
    const rb = LINGMING_ROOT_MAP.get(b.radical)?.rank ?? 999;
    return ra - rb;
  });

  return {
    ...base,
    nodes: [...base.nodes, ...uniqueExtras],
  };
}

export const TWENTY_KEY_MORPHS: KeyTopologyMorphSpec[] = [
  ...TWENTY_KEY_MORPHS_PART1,
  ...TWENTY_KEY_MORPHS_PART2,
].map(mergeKeySpec);

export const TOTAL_MORPH_RADICAL_COUNT: number = TWENTY_KEY_MORPHS.reduce(
  (sum, spec) => sum + spec.nodes.length,
  0
);

export const TWENTY_KEY_MORPH_BY_KEY = new Map<string, KeyTopologyMorphSpec>(
  TWENTY_KEY_MORPHS.map((spec) => [spec.key, spec])
);

const simpRadicalsCache = new Map<string, string[]>();

export function getSimpRadicalsForMorphKey(key: string): string[] {
  const cached = simpRadicalsCache.get(key);
  if (cached) return cached;
  const list: Array<{ rad: string; rank: number }> = [];
  for (const [rad, meta] of LINGMING_ROOT_MAP.entries()) {
    if (meta.chamberKey !== key) continue;
    if (getLingmingRadicalScript(rad) === 'trad') continue;
    list.push({ rad, rank: meta.rank });
  }
  list.sort((a, b) => a.rank - b.rank);
  const out = list.map((x) => x.rad);
  simpRadicalsCache.set(key, out);
  return out;
}
