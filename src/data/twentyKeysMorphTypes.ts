export interface MorphPt {
  x: number; // 0..1 normalized ink-box coordinate
  y: number; // 0..1 normalized ink-box coordinate
  p: number; // brush pressure 0.12 (hairline) .. 1.0 (heavy dunbi press)
}

export interface MorphBrushStroke {
  points: MorphPt[];
  dunbiStart?: boolean;
  flickEnd?: boolean;
}

export interface RadicalMorphNode {
  id: string;
  radical: string;
  code: string; // Real Lingming Simplified code, e.g. 'R J E'
  tag: string; // 4-char morphological role
  title: string;
  insight: string;
  // Vermilion topological invariant strokes (1 or 2 strokes, consistent per key)
  coreStrokes: MorphBrushStroke[];
  // Accompanying sumi-ink strokes that bloom around the vermilion core
  extraStrokes: MorphBrushStroke[];
}

export interface KeyTopologyMorphSpec {
  key: string; // lowercase consonant key
  hand: 'L' | 'R';
  row: 'top' | 'home' | 'bot';
  homeKey: 'A' | 'S' | 'D' | 'F' | 'J' | 'K' | 'L' | ';';
  fingerLabel: string;
  reachLabel: string;
  techniqueName: string; // 100% unique 4-char calligraphy technique
  sealText: [string, string]; // 2-char traditional corner seal stamp
  topoSymbol: string;
  topoInvariant: string; // Short invariant summary
  nodes: RadicalMorphNode[];
}
