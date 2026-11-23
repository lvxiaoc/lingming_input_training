import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { LINGMING_CHAMBER_BY_KEY, LINGMING_ROOT_MAP } from './lingming';
import { PALACE_PDF_CHAMBERS } from './palacePdfData';

const STORAGE_KEY = 'inkkey_keystroke_cloud_v1';

export function loadKeystrokeCloudEnabled(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'false') return false;
    if (raw === 'true') return true;
  } catch {
    // ignore storage errors
  }
  return true;
}

export function saveKeystrokeCloudEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(enabled));
  } catch {
    // ignore storage errors
  }
}

export interface KeystrokeCloudContextValue {
  enabled: boolean;
  setEnabled: (next: boolean) => void;
  toggle: () => void;
}

export const KeystrokeCloudContext = createContext<KeystrokeCloudContextValue>({
  enabled: true,
  setEnabled: () => {},
  toggle: () => {},
});

export function useKeystrokeCloud(): KeystrokeCloudContextValue {
  return useContext(KeystrokeCloudContext);
}

export function isPalaceChamberKey(key: string | null | undefined): boolean {
  if (!key) return false;
  const k = key.toLowerCase();
  return Boolean(LINGMING_CHAMBER_BY_KEY[k] && PALACE_PDF_CHAMBERS[k]);
}

function chamberContainsGlyph(chamberKey: string, glyph: string): boolean {
  if (!glyph) return false;
  const k = chamberKey.toLowerCase();
  const rootMeta = LINGMING_ROOT_MAP.get(glyph);
  if (rootMeta && rootMeta.chamberKey === k) return true;
  const pdf = PALACE_PDF_CHAMBERS[k];
  if (!pdf) return false;
  if (pdf.monument.displayChar === glyph || pdf.monument.rawChar === glyph) return true;
  return pdf.nodes.some(
    (n) => n.displayChar === glyph || n.rawChar === glyph || n.parentChar === glyph
  );
}

/**
 * Finds the best matching radical glyph from a character's decomposition list
 * for highlighting inside the given consonant key's Memory Palace cloud.
 */
export function resolveRadicalForChamberKey(
  roots: string[] | undefined,
  chamberKey: string,
  preferredIdx?: number
): string | null {
  if (!roots || roots.length === 0 || !isPalaceChamberKey(chamberKey)) return null;
  if (
    preferredIdx !== undefined &&
    preferredIdx >= 0 &&
    preferredIdx < roots.length &&
    chamberContainsGlyph(chamberKey, roots[preferredIdx])
  ) {
    return roots[preferredIdx];
  }
  for (const r of roots) {
    if (chamberContainsGlyph(chamberKey, r)) {
      return r;
    }
  }
  return null;
}

export interface KeystrokeCloudPulse {
  chamberKey: string;
  activeChar: string | null;
  status: 'hit' | 'miss' | 'pressed_only';
  pressedKey?: string;
  tick: number;
}

export function useKeystrokeCloudPulse(enabled: boolean) {
  const [pulse, setPulse] = useState<KeystrokeCloudPulse | null>(null);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const clear = useCallback(() => {
    clearTimer();
    setVisible((prev) => (prev ? false : prev));
  }, [clearTimer]);

  const trigger = useCallback(
    (
      chamberKey: string,
      activeChar: string | null,
      status: 'hit' | 'miss' | 'pressed_only' = 'hit',
      pressedKey?: string,
      holdMs?: number
    ) => {
      if (!enabled) return;
      const k = chamberKey.toLowerCase();
      if (!isPalaceChamberKey(k)) return;

      clearTimer();
      setPulse((prev) => ({
        chamberKey: k,
        activeChar,
        status,
        pressedKey: pressedKey?.toLowerCase(),
        tick: (prev?.tick ?? 0) + 1,
      }));
      setVisible(true);

      const duration = holdMs ?? (status === 'miss' ? 2800 : 2100);
      timerRef.current = window.setTimeout(() => {
        setVisible(false);
      }, duration);
    },
    [enabled, clearTimer]
  );

  useEffect(() => {
    if (!enabled) {
      clearTimer();
      setVisible((prev) => (prev ? false : prev));
    }
  }, [enabled, clearTimer]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  return { pulse, visible: enabled && visible && Boolean(pulse), trigger, clear };
}
