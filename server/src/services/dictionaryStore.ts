import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const DICT_DIR = process.env.DICT_DATA_DIR || '/app/data/dictionaries';
const FINGERPRINT_RE = /^[a-z0-9-]+$/;

function ensureDir(): void {
  if (!existsSync(DICT_DIR)) {
    mkdirSync(DICT_DIR, { recursive: true });
  }
}

function validateFingerprint(fingerprint: string): boolean {
  return FINGERPRINT_RE.test(fingerprint);
}

export function loadDictionary(fingerprint: string): unknown | null {
  if (!validateFingerprint(fingerprint)) return null;

  const filePath = join(DICT_DIR, `${fingerprint}.json`);
  if (!existsSync(filePath)) return null;

  try {
    const raw = readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export function saveDictionary(fingerprint: string, data: unknown): boolean {
  if (!validateFingerprint(fingerprint)) return false;

  ensureDir();
  const filePath = join(DICT_DIR, `${fingerprint}.json`);

  try {
    writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('[dictionaryStore] Failed to write:', err);
    return false;
  }
}
