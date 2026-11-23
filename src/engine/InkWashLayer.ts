import type { ThemeMode } from '../data/theme';

export interface InkSplashOptions {
  x: number;
  y: number;
  char: string;
  glyphSize: number;
  glyphYOffset: number;
  themeMode: ThemeMode;
  accentHex?: string;
  intensity?: 'key' | 'complete' | 'milestone';
  xrayStrokes?: string[];
  xrayActiveIndices?: number[];
}

interface InkParticle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  drag: number;
  curlPhase: number;
  curlFreq: number;
  curlAmp: number;
  sizeStart: number;
  sizeEnd: number;
  age: number;
  duration: number;
  peakAlpha: number;
  r: number;
  g: number;
  b: number;
  seed: number;
  softness: number; // 0.0 = organic brush droplet, 1.0 = ultra-soft water-ink diffusion cloud
}

const MAX_INK_PARTICLES = 900;
const FLOATS_PER_VERTEX = 9; // x, y, size, alpha, r, g, b, seed, softness
const SAMPLER_SIZE = 96;

const VERT_SRC = `
precision mediump float;
attribute vec2 aPos;
attribute float aSize;
attribute float aAlpha;
attribute vec3 aColor;
attribute float aSeed;
attribute float aSoftness;

uniform vec2 uResolution;
uniform float uDpr;

varying float vAlpha;
varying vec3 vColor;
varying float vSeed;
varying float vSoftness;

void main() {
  vec2 clip = (aPos / uResolution) * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  gl_PointSize = max(1.0, aSize * uDpr);
  vAlpha = aAlpha;
  vColor = aColor;
  vSeed = aSeed;
  vSoftness = aSoftness;
}
`;

const FRAG_SRC = `
precision mediump float;

varying float vAlpha;
varying vec3 vColor;
varying float vSeed;
varying float vSoftness;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise2D(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float amp = 0.52;
  for (int i = 0; i < 3; i++) {
    v += amp * noise2D(p);
    p = p * 2.07 + vec2(13.7, 7.3);
    amp *= 0.48;
  }
  return v;
}

void main() {
  vec2 uv = gl_PointCoord * 2.0 - 1.0;
  float r = length(uv);
  if (r > 1.0) discard;

  // Organic calligraphic / capillary paper-fiber distortion (zero rigid circles or rings)
  vec2 seedOff = vec2(vSeed * 19.31, vSeed * 43.17);
  float n = fbm(uv * mix(3.4, 2.1, vSoftness) + seedOff);
  float paperGrain = noise2D(uv * 8.5 + seedOff * 1.7);

  // Anisotropic organic warp for ink splatter droplets vs smooth diffusion clouds
  float wobble = (n - 0.5) * mix(0.46, 0.24, vSoftness);
  float dist = clamp(r + wobble, 0.0, 1.0);

  // Strictly monotonic center-dense ink profile (deepest in center, feathered outward to 0)
  float coreEdge = mix(0.92, 1.0, vSoftness);
  float innerStart = mix(0.18, 0.0, vSoftness);
  float falloff = smoothstep(coreEdge, innerStart, dist);
  float density = pow(falloff, mix(1.35, 2.05, vSoftness));

  // Subtle Xuan-paper fiber absorption modulation
  float fiber = mix(0.84, 1.08, paperGrain);
  float outAlpha = clamp(density * fiber * vAlpha, 0.0, 1.0);
  if (outAlpha < 0.002) discard;

  // Premultiplied alpha output for clean blending on both Xuan paper and dark night ink
  gl_FragColor = vec4(vColor * outAlpha, outAlpha);
}
`;

function hexToRgb01(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return [0.09, 0.09, 0.085];
  const n = parseInt(clean, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function createShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

/**
 * Dedicated WebGL (with seamless Canvas 2D organic brush-stamp fallback) Ink-Wash Particle Layer.
 * Samples the actual strokes of the completed or struck Chinese radical/glyph and emits
 * organic "暈入淡出" (bleed-in & dissolve-out) calligraphic ink splatters and water-ink clouds.
 */
export class InkWashParticleLayer {
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext | null = null;
  private ctx2d: CanvasRenderingContext2D | null = null;
  private backend: 'webgl' | 'canvas2d' = 'canvas2d';

  // WebGL resources
  private program: WebGLProgram | null = null;
  private buffer: WebGLBuffer | null = null;
  private uResolution: WebGLUniformLocation | null = null;
  private uDpr: WebGLUniformLocation | null = null;
  private aPos = -1;
  private aSize = -1;
  private aAlpha = -1;
  private aColor = -1;
  private aSeed = -1;
  private aSoftness = -1;
  private vertexData = new Float32Array(MAX_INK_PARTICLES * FLOATS_PER_VERTEX);

  // Canvas 2D fallback organic noise-edged ink stamps
  private stampSprites: Map<string, HTMLCanvasElement[]> = new Map();

  // Reusable offscreen glyph pixel sampler
  private samplerCanvas: HTMLCanvasElement;
  private samplerCtx: CanvasRenderingContext2D | null;

  // Pooled particles (zero per-frame allocations)
  private particles: InkParticle[];
  private activeCount = 0;
  private width = 960;
  private height = 440;
  private dpr = 1;
  private reducedMotion = false;
  private contextLostHandler: ((e: Event) => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    this.samplerCanvas = document.createElement('canvas');
    this.samplerCanvas.width = SAMPLER_SIZE;
    this.samplerCanvas.height = SAMPLER_SIZE;
    this.samplerCtx = this.samplerCanvas.getContext('2d', { willReadFrequently: true });

    this.particles = Array.from({ length: MAX_INK_PARTICLES }, (): InkParticle => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      drag: 3.5,
      curlPhase: 0,
      curlFreq: 1.5,
      curlAmp: 8,
      sizeStart: 10,
      sizeEnd: 32,
      age: 0,
      duration: 0.8,
      peakAlpha: 0.25,
      r: 0.08,
      g: 0.08,
      b: 0.075,
      seed: 0,
      softness: 0.5,
    }));

    if (!this.initWebGL()) {
      this.initCanvas2D();
    }
  }

  public getBackend(): 'webgl' | 'canvas2d' {
    return this.backend;
  }

  private initWebGL(): boolean {
    try {
      const gl = this.canvas.getContext('webgl', {
        alpha: true,
        antialias: true,
        premultipliedAlpha: true,
        depth: false,
        stencil: false,
        preserveDrawingBuffer: false,
      });
      if (!gl) return false;

      const vs = createShader(gl, gl.VERTEX_SHADER, VERT_SRC);
      const fs = createShader(gl, gl.FRAGMENT_SHADER, FRAG_SRC);
      if (!vs || !fs) {
        if (vs) gl.deleteShader(vs);
        if (fs) gl.deleteShader(fs);
        return false;
      }

      const prog = gl.createProgram();
      if (!prog) return false;
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);

      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        gl.deleteProgram(prog);
        return false;
      }

      const buf = gl.createBuffer();
      if (!buf) {
        gl.deleteProgram(prog);
        return false;
      }

      this.gl = gl;
      this.program = prog;
      this.buffer = buf;
      this.uResolution = gl.getUniformLocation(prog, 'uResolution');
      this.uDpr = gl.getUniformLocation(prog, 'uDpr');
      this.aPos = gl.getAttribLocation(prog, 'aPos');
      this.aSize = gl.getAttribLocation(prog, 'aSize');
      this.aAlpha = gl.getAttribLocation(prog, 'aAlpha');
      this.aColor = gl.getAttribLocation(prog, 'aColor');
      this.aSeed = gl.getAttribLocation(prog, 'aSeed');
      this.aSoftness = gl.getAttribLocation(prog, 'aSoftness');

      gl.useProgram(prog);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.clearColor(0, 0, 0, 0);

      this.contextLostHandler = (e: Event) => {
        e.preventDefault();
        this.gl = null;
        this.program = null;
        this.buffer = null;
        this.initCanvas2D();
      };
      this.canvas.addEventListener('webglcontextlost', this.contextLostHandler, false);

      this.backend = 'webgl';
      return true;
    } catch {
      return false;
    }
  }

  private initCanvas2D(): void {
    this.ctx2d = this.canvas.getContext('2d');
    this.backend = 'canvas2d';
  }

  public resize(width: number, height: number, dpr: number): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.dpr = Math.min(Math.max(1, dpr), 2);
    const pw = Math.max(1, Math.floor(this.width * this.dpr));
    const ph = Math.max(1, Math.floor(this.height * this.dpr));
    if (this.canvas.width !== pw || this.canvas.height !== ph) {
      this.canvas.width = pw;
      this.canvas.height = ph;
    }
    if (this.gl) {
      this.gl.viewport(0, 0, pw, ph);
    }
  }

  public clear(): void {
    for (let i = 0; i < this.particles.length; i++) {
      this.particles[i].active = false;
    }
    this.activeCount = 0;
    if (this.gl) {
      this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    } else if (this.ctx2d) {
      this.ctx2d.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  private allocParticle(): InkParticle | null {
    for (let i = 0; i < this.particles.length; i++) {
      if (!this.particles[i].active) {
        return this.particles[i];
      }
    }
    // Recycle oldest particle if pool is full
    let oldest = this.particles[0];
    let maxRatio = -1;
    for (let i = 0; i < this.particles.length; i++) {
      const ratio = this.particles[i].age / this.particles[i].duration;
      if (ratio > maxRatio) {
        maxRatio = ratio;
        oldest = this.particles[i];
      }
    }
    return oldest;
  }

  /**
   * Samples inked pixel positions directly from the target radical/character silhouette
   * so ink-wash splash droplets & clouds emerge organically from the actual brush strokes.
   */
  private sampleGlyphStrokePoints(
    char: string,
    glyphSize: number,
    maxSamples: number,
    xrayStrokes?: string[],
    xrayActiveIndices?: number[]
  ): Array<{ dx: number; dy: number }> {
    const ctx = this.samplerCtx;
    if (!ctx) return [];

    ctx.clearRect(0, 0, SAMPLER_SIZE, SAMPLER_SIZE);
    ctx.save();
    ctx.fillStyle = '#000000';

    if (xrayStrokes && xrayActiveIndices && xrayActiveIndices.length > 0) {
      const u = (SAMPLER_SIZE * 0.78) / 1024;
      ctx.translate(SAMPLER_SIZE * 0.5, SAMPLER_SIZE * 0.5);
      ctx.scale(u, -u);
      ctx.translate(-512, -388);
      for (const idx of xrayActiveIndices) {
        const sp = xrayStrokes[idx];
        if (!sp) continue;
        ctx.fill(new Path2D(sp));
      }
    } else if (char === '𠂇') {
      const u = (SAMPLER_SIZE * 0.74) / 100;
      ctx.translate(SAMPLER_SIZE * 0.5, SAMPLER_SIZE * 0.5);
      ctx.scale(u, u);
      ctx.translate(-50, -52);
      ctx.beginPath();
      ctx.moveTo(12, 31.5);
      ctx.lineTo(77, 29.2);
      ctx.quadraticCurveTo(82, 28.8, 86.5, 32.5);
      ctx.quadraticCurveTo(87.5, 34.4, 85, 35.6);
      ctx.lineTo(14.5, 36.8);
      ctx.quadraticCurveTo(11.5, 36.2, 12, 31.5);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(51, 12.5);
      ctx.quadraticCurveTo(56.5, 14, 58.2, 18.2);
      ctx.bezierCurveTo(53.5, 37, 46, 58, 34.5, 73.5);
      ctx.bezierCurveTo(26.5, 83.5, 17.5, 89.5, 11.2, 92.2);
      ctx.bezierCurveTo(10.2, 91.2, 10.6, 89.4, 12.2, 88);
      ctx.bezierCurveTo(22.5, 79.5, 33.8, 63.5, 41.2, 44.5);
      ctx.bezierCurveTo(45.8, 32.5, 48.2, 21.5, 48.8, 14.5);
      ctx.quadraticCurveTo(49.2, 12.2, 51, 12.5);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.font = `700 ${Math.round(SAMPLER_SIZE * 0.72)}px "Noto Serif TC", Georgia, serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(char, SAMPLER_SIZE * 0.5, SAMPLER_SIZE * 0.52);
    }
    ctx.restore();

    const img = ctx.getImageData(0, 0, SAMPLER_SIZE, SAMPLER_SIZE).data;
    const candidates: Array<{ x: number; y: number }> = [];
    const stride = 2;
    for (let y = 2; y < SAMPLER_SIZE - 2; y += stride) {
      for (let x = 2; x < SAMPLER_SIZE - 2; x += stride) {
        const a = img[(y * SAMPLER_SIZE + x) * 4 + 3];
        if (a > 72) {
          candidates.push({ x, y });
        }
      }
    }

    if (candidates.length === 0) return [];

    // Reservoir-style shuffled sampling for even organic stroke coverage
    const step = Math.max(1, candidates.length / maxSamples);
    const scaleToScreen = glyphSize / (SAMPLER_SIZE * 0.72);
    const result: Array<{ dx: number; dy: number }> = [];

    for (let f = 0; f < candidates.length && result.length < maxSamples; f += step) {
      const idx = Math.min(
        candidates.length - 1,
        Math.floor(f + Math.random() * Math.min(step, 3))
      );
      const pt = candidates[idx];
      result.push({
        dx: (pt.x - SAMPLER_SIZE * 0.5 + (Math.random() - 0.5) * 1.6) * scaleToScreen,
        dy: (pt.y - SAMPLER_SIZE * 0.5 + (Math.random() - 0.5) * 1.6) * scaleToScreen,
      });
    }
    return result;
  }

  /**
   * Emits a glyph-shaped "暈入淡出" (bleed-in & dissolve-out) calligraphic ink splash
   * when the user hits a correct key or completes a radical.
   */
  public emitGlyphSplash(opts: InkSplashOptions): void {
    const {
      x,
      y,
      char,
      glyphSize,
      glyphYOffset,
      themeMode,
      accentHex = '#2EA87E',
      intensity = 'complete',
      xrayStrokes,
      xrayActiveIndices,
    } = opts;

    const isWash = themeMode === 'wash';
    const cy = y + glyphYOffset;
    const motionScale = this.reducedMotion ? 0.18 : 1;

    const strokeTargetCount =
      intensity === 'milestone' ? 105 : intensity === 'complete' ? 78 : 28;
    const splashCount =
      intensity === 'milestone' ? 38 : intensity === 'complete' ? 24 : 10;
    const cloudCount =
      intensity === 'milestone' ? 7 : intensity === 'complete' ? 5 : 2;

    const strokePoints = this.sampleGlyphStrokePoints(
      char,
      glyphSize,
      strokeTargetCount,
      xrayStrokes,
      xrayActiveIndices
    );

    const accentRgb = hexToRgb01(accentHex);

    const pickColor = (layer: 'stroke' | 'splash' | 'cloud'): [number, number, number] => {
      if (isWash) {
        // Pure monochrome sumi ink gradations (焦墨 -> 濃墨 -> 重墨 -> 淡墨)
        const tone =
          layer === 'stroke'
            ? 0.075 + Math.random() * 0.08
            : layer === 'splash'
              ? 0.06 + Math.random() * 0.14
              : 0.11 + Math.random() * 0.15;
        return [tone, tone, tone * 0.96];
      }
      // Night Ink Dojo: warm Xuan-ivory ink + jade/zone accent mist
      if (layer === 'cloud') {
        return [
          accentRgb[0] * 0.82 + 0.1,
          accentRgb[1] * 0.85 + 0.1,
          accentRgb[2] * 0.85 + 0.1,
        ];
      }
      if (Math.random() < 0.45) {
        return [0.95, 0.93, 0.89]; // warm ivory-gold ink
      }
      return [
        Math.min(1, accentRgb[0] * 1.12 + 0.08),
        Math.min(1, accentRgb[1] * 1.12 + 0.08),
        Math.min(1, accentRgb[2] * 1.12 + 0.08),
      ];
    };

    // 1. Stroke-Bound Ink Bleed Particles — the radical itself softens, blooms, and dissolves
    const fallbackCount = strokePoints.length > 0 ? strokePoints.length : strokeTargetCount;
    for (let i = 0; i < fallbackCount; i++) {
      const p = this.allocParticle();
      if (!p) break;
      const sp =
        strokePoints.length > 0
          ? strokePoints[i]
          : {
              dx: (Math.random() - 0.5) * glyphSize * 0.7,
              dy: (Math.random() - 0.5) * glyphSize * 0.7,
            };

      const distFromCenter = Math.hypot(sp.dx, sp.dy) || 1;
      const outX = sp.dx / distFromCenter;
      const outY = sp.dy / distFromCenter;
      const speed =
        (intensity === 'key' ? 16 + Math.random() * 26 : 30 + Math.random() * 58) * motionScale;

      const [r, g, b] = pickColor('stroke');
      p.active = true;
      p.x = x + sp.dx;
      p.y = cy + sp.dy;
      p.vx = outX * speed + (Math.random() - 0.5) * 18 * motionScale;
      p.vy = outY * speed + (Math.random() - 0.5) * 18 * motionScale - 5 * motionScale;
      p.drag = 2.8 + Math.random() * 1.4;
      p.curlPhase = Math.random() * Math.PI * 2;
      p.curlFreq = 2.2 + Math.random() * 2.0;
      p.curlAmp = (8 + Math.random() * 16) * motionScale;

      const baseSpot = Math.max(9, glyphSize * (intensity === 'key' ? 0.17 : 0.23));
      p.sizeStart = baseSpot * (0.65 + Math.random() * 0.55);
      p.sizeEnd = p.sizeStart * (intensity === 'key' ? 2.2 + Math.random() * 0.9 : 2.9 + Math.random() * 1.4);
      p.age = 0;
      p.duration = (intensity === 'key' ? 0.56 : 0.92) + Math.random() * 0.34;
      p.peakAlpha = isWash
        ? intensity === 'key'
          ? 0.22 + Math.random() * 0.10
          : 0.29 + Math.random() * 0.14
        : intensity === 'key'
          ? 0.28 + Math.random() * 0.12
          : 0.38 + Math.random() * 0.16;
      p.r = r;
      p.g = g;
      p.b = b;
      p.seed = Math.random();
      p.softness = 0.28 + Math.random() * 0.32;
    }

    // 2. Calligraphic Ink-Splatter Tendrils — fine organic droplets radiating with liquid drag
    for (let i = 0; i < splashCount; i++) {
      const p = this.allocParticle();
      if (!p) break;

      const anchor =
        strokePoints.length > 0
          ? strokePoints[Math.floor(Math.random() * strokePoints.length)]
          : { dx: 0, dy: 0 };
      const baseAngle =
        Math.hypot(anchor.dx, anchor.dy) > 4
          ? Math.atan2(anchor.dy, anchor.dx) + (Math.random() - 0.5) * 0.95
          : (Math.PI * 2 * i) / Math.max(1, splashCount) + (Math.random() - 0.5) * 0.6;

      const launchSpeed =
        (intensity === 'milestone'
          ? 125 + Math.random() * 185
          : intensity === 'complete'
            ? 92 + Math.random() * 150
            : 52 + Math.random() * 78) * motionScale;

      const [r, g, b] = pickColor('splash');
      p.active = true;
      p.x = x + anchor.dx;
      p.y = cy + anchor.dy;
      p.vx = Math.cos(baseAngle) * launchSpeed;
      p.vy = Math.sin(baseAngle) * launchSpeed;
      p.drag = 3.6 + Math.random() * 1.9; // Viscous water/paper fluid drag — never bounces!
      p.curlPhase = Math.random() * Math.PI * 2;
      p.curlFreq = 3.0 + Math.random() * 2.5;
      p.curlAmp = (11 + Math.random() * 18) * motionScale;

      p.sizeStart = 5.0 + Math.random() * 8.5;
      p.sizeEnd = p.sizeStart * (2.0 + Math.random() * 1.5);
      p.age = 0;
      p.duration = (intensity === 'key' ? 0.52 : 0.86) + Math.random() * 0.34;
      p.peakAlpha = isWash
        ? 0.34 + Math.random() * 0.22
        : 0.44 + Math.random() * 0.24;
      p.r = r;
      p.g = g;
      p.b = b;
      p.seed = Math.random();
      p.softness = 0.08 + Math.random() * 0.22; // Slightly crisper organic calligraphic droplets
    }

    // 3. Soft Ink-in-Water Diffusion Clouds — velvety tonal pool blooming & dissolving
    for (let i = 0; i < cloudCount; i++) {
      const p = this.allocParticle();
      if (!p) break;
      const theta = (Math.PI * 2 * i) / Math.max(1, cloudCount) + (Math.random() - 0.5) * 0.85;
      const offR = i === 0 ? 0 : (8 + Math.random() * glyphSize * 0.26);
      const drift = (i === 0 ? 4 : 14 + Math.random() * 22) * motionScale;

      const [r, g, b] = pickColor('cloud');
      p.active = true;
      p.x = x + Math.cos(theta) * offR;
      p.y = cy + Math.sin(theta) * offR * 0.82;
      p.vx = Math.cos(theta) * drift;
      p.vy = Math.sin(theta) * drift;
      p.drag = 2.6 + Math.random() * 0.9;
      p.curlPhase = Math.random() * Math.PI * 2;
      p.curlFreq = 1.1 + Math.random() * 0.8;
      p.curlAmp = (4 + Math.random() * 8) * motionScale;

      const cloudBase = glyphSize * (intensity === 'milestone' ? 1.05 : intensity === 'complete' ? 0.86 : 0.62);
      p.sizeStart = cloudBase * (0.55 + Math.random() * 0.25);
      p.sizeEnd = cloudBase * (2.35 + Math.random() * 0.85);
      p.age = 0;
      p.duration = (intensity === 'key' ? 0.66 : 0.98) + Math.random() * 0.30;
      p.peakAlpha = isWash
        ? intensity === 'key'
          ? 0.10 + Math.random() * 0.05
          : 0.14 + Math.random() * 0.06
        : intensity === 'key'
          ? 0.11 + Math.random() * 0.05
          : 0.15 + Math.random() * 0.07;
      p.r = r;
      p.g = g;
      p.b = b;
      p.seed = Math.random();
      p.softness = 0.85 + Math.random() * 0.15;
    }
  }

  public updateAndRender(dt: number): void {
    let count = 0;
    const clampedDt = Math.min(Math.max(dt, 0), 0.05);

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active) continue;

      p.age += clampedDt;
      if (p.age >= p.duration) {
        p.active = false;
        continue;
      }

      // Viscous fluid damping + gentle organic curl-like eddy drift
      const damp = Math.exp(-p.drag * clampedDt);
      p.vx *= damp;
      p.vy *= damp;
      const eddyAngle = p.curlPhase + p.age * p.curlFreq;
      const swirlX = Math.cos(eddyAngle) * p.curlAmp * (1 - p.age / p.duration);
      const swirlY = Math.sin(eddyAngle * 1.13) * p.curlAmp * (1 - p.age / p.duration);

      p.x += (p.vx + swirlX) * clampedDt;
      p.y += (p.vy + swirlY) * clampedDt;

      const t = p.age / p.duration;
      // Smooth bleed-in (暈入: 0 -> 0.18) and poetic water-ink dissolve-out (淡出: 0.18 -> 1.0)
      const alphaEnv =
        t < 0.18
          ? Math.sin((t / 0.18) * (Math.PI * 0.5))
          : Math.pow(1 - (t - 0.18) / 0.82, 1.65);
      const alpha = p.peakAlpha * alphaEnv;
      if (alpha <= 0.002) continue;

      const easeOut = 1 - Math.pow(1 - t, 2.25);
      const size = p.sizeStart + (p.sizeEnd - p.sizeStart) * easeOut;

      // Softness gently increases over life so droplets feather as they dissolve into water/paper
      const dynamicSoftness = Math.min(1, p.softness + t * 0.35);

      const base = count * FLOATS_PER_VERTEX;
      this.vertexData[base] = p.x;
      this.vertexData[base + 1] = p.y;
      this.vertexData[base + 2] = size;
      this.vertexData[base + 3] = alpha;
      this.vertexData[base + 4] = p.r;
      this.vertexData[base + 5] = p.g;
      this.vertexData[base + 6] = p.b;
      this.vertexData[base + 7] = p.seed;
      this.vertexData[base + 8] = dynamicSoftness;
      count++;
    }

    this.activeCount = count;

    if (this.gl && this.program && this.buffer) {
      this.renderWebGL(count);
    } else if (this.ctx2d) {
      this.renderCanvas2D(count);
    }
  }

  private renderWebGL(count: number): void {
    const gl = this.gl!;
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (count === 0) return;

    gl.useProgram(this.program);
    gl.uniform2f(this.uResolution, this.width, this.height);
    gl.uniform1f(this.uDpr, this.dpr);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      this.vertexData.subarray(0, count * FLOATS_PER_VERTEX),
      gl.DYNAMIC_DRAW
    );

    const stride = FLOATS_PER_VERTEX * 4;
    if (this.aPos >= 0) {
      gl.enableVertexAttribArray(this.aPos);
      gl.vertexAttribPointer(this.aPos, 2, gl.FLOAT, false, stride, 0);
    }
    if (this.aSize >= 0) {
      gl.enableVertexAttribArray(this.aSize);
      gl.vertexAttribPointer(this.aSize, 1, gl.FLOAT, false, stride, 2 * 4);
    }
    if (this.aAlpha >= 0) {
      gl.enableVertexAttribArray(this.aAlpha);
      gl.vertexAttribPointer(this.aAlpha, 1, gl.FLOAT, false, stride, 3 * 4);
    }
    if (this.aColor >= 0) {
      gl.enableVertexAttribArray(this.aColor);
      gl.vertexAttribPointer(this.aColor, 3, gl.FLOAT, false, stride, 4 * 4);
    }
    if (this.aSeed >= 0) {
      gl.enableVertexAttribArray(this.aSeed);
      gl.vertexAttribPointer(this.aSeed, 1, gl.FLOAT, false, stride, 7 * 4);
    }
    if (this.aSoftness >= 0) {
      gl.enableVertexAttribArray(this.aSoftness);
      gl.vertexAttribPointer(this.aSoftness, 1, gl.FLOAT, false, stride, 8 * 4);
    }

    gl.drawArrays(gl.POINTS, 0, count);
  }

  private getCanvas2DStamps(r: number, g: number, b: number): HTMLCanvasElement[] {
    const key = `${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)}`;
    const cached = this.stampSprites.get(key);
    if (cached) return cached;

    // Generate 3 organic multi-lobe ink-splatter stamps for Canvas 2D fallback
    const stamps: HTMLCanvasElement[] = [];
    const sz = 64;
    const half = sz / 2;
    const r255 = Math.round(r * 255);
    const g255 = Math.round(g * 255);
    const b255 = Math.round(b * 255);

    for (let v = 0; v < 3; v++) {
      const c = document.createElement('canvas');
      c.width = sz;
      c.height = sz;
      const ctx = c.getContext('2d');
      if (ctx) {
        const lobes = 5;
        for (let l = 0; l < lobes; l++) {
          const ang = (Math.PI * 2 * l) / lobes + v * 1.1;
          const dist = l === 0 ? 0 : 4 + ((l * 7 + v * 5) % 6);
          const lx = half + Math.cos(ang) * dist;
          const ly = half + Math.sin(ang) * dist;
          const lr = l === 0 ? half * 0.82 : half * (0.48 + ((l + v) % 3) * 0.1);
          const grad = ctx.createRadialGradient(lx, ly, 0, lx, ly, lr);
          grad.addColorStop(0, `rgba(${r255}, ${g255}, ${b255}, 0.55)`);
          grad.addColorStop(0.45, `rgba(${r255}, ${g255}, ${b255}, 0.22)`);
          grad.addColorStop(1, `rgba(${r255}, ${g255}, ${b255}, 0)`);
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(lx, ly, lr, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      stamps.push(c);
    }

    if (this.stampSprites.size > 16) {
      const firstKey = this.stampSprites.keys().next().value;
      if (firstKey) this.stampSprites.delete(firstKey);
    }
    this.stampSprites.set(key, stamps);
    return stamps;
  }

  private renderCanvas2D(count: number): void {
    const ctx = this.ctx2d!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (count === 0) return;

    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    for (let i = 0; i < count; i++) {
      const base = i * FLOATS_PER_VERTEX;
      const x = this.vertexData[base];
      const y = this.vertexData[base + 1];
      const size = this.vertexData[base + 2];
      const alpha = this.vertexData[base + 3];
      const r = this.vertexData[base + 4];
      const g = this.vertexData[base + 5];
      const b = this.vertexData[base + 6];
      const seed = this.vertexData[base + 7];

      const stamps = this.getCanvas2DStamps(r, g, b);
      const sprite = stamps[Math.floor(seed * stamps.length) % stamps.length];
      ctx.globalAlpha = alpha;
      ctx.drawImage(sprite, x - size * 0.5, y - size * 0.5, size, size);
    }

    ctx.restore();
  }

  public hasActiveParticles(): boolean {
    return this.activeCount > 0;
  }

  public dispose(): void {
    if (this.contextLostHandler) {
      this.canvas.removeEventListener('webglcontextlost', this.contextLostHandler);
      this.contextLostHandler = null;
    }
    if (this.gl) {
      if (this.buffer) this.gl.deleteBuffer(this.buffer);
      if (this.program) this.gl.deleteProgram(this.program);
    }
    this.gl = null;
    this.ctx2d = null;
    this.stampSprites.clear();
  }
}
