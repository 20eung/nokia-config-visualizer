import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname } from 'path';

const DICT_FILE = process.env.DICT_DATA_FILE || '/app/data/dictionary.json';

function ensureDir(): void {
  const dir = dirname(DICT_FILE);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export function loadDictionary(): unknown | null {
  if (!existsSync(DICT_FILE)) return null;

  try {
    const raw = readFileSync(DICT_FILE, 'utf-8');
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export function saveDictionary(data: unknown): boolean {
  ensureDir();

  try {
    writeFileSync(DICT_FILE, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('[dictionaryStore] Failed to write:', err);
    return false;
  }
}
