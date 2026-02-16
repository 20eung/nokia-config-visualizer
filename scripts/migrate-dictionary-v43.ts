/**
 * Dictionary Migration Script v4.2 → v4.3
 *
 * 이 스크립트는 이름 사전 구조를 v4.2 (6 필드)에서 v4.3 (2 필드)로 마이그레이션합니다.
 *
 * 변경 사항:
 * - Before: { originalToken, shortName, longName, koreanName, aliases[], category }
 * - After:  { originalToken, aliases[] }
 *
 * 실행 방법:
 *   node scripts/migrate-dictionary-v43.js <fingerprint>
 *
 * 또는 package.json에 스크립트 추가 후:
 *   npm run migrate:dictionary <fingerprint>
 */

import * as fs from 'fs';
import * as path from 'path';

// 환경변수 또는 기본 경로
const DICT_DATA_DIR = process.env.DICT_DATA_DIR || '/app/data/dictionaries';

/** v4.2 Dictionary Entry (Old) */
interface OldDictionaryEntry {
  originalToken: string;
  shortName: string;
  longName: string;
  koreanName: string;
  aliases: string[];
  category: 'customer' | 'location' | 'service' | 'device' | 'other';
}

/** v4.3 Dictionary Entry (New) */
interface NewDictionaryEntry {
  originalToken: string;
  aliases: string[];
}

/** v4.2 Dictionary */
interface OldDictionary {
  version?: string;
  entries: OldDictionaryEntry[];
}

/** v4.3 Dictionary */
interface NewDictionary {
  version: string;
  entries: NewDictionaryEntry[];
}

/**
 * 개별 항목 변환 (v4.2 → v4.3)
 */
function transformEntry(oldEntry: OldDictionaryEntry): NewDictionaryEntry {
  // 1. 모든 이름 변형 수집
  const allNames: string[] = [
    oldEntry.shortName,
    oldEntry.longName,
    oldEntry.koreanName,
    ...oldEntry.aliases
  ];

  // 2. 중복 제거 (대소문자 무시)
  const uniqueAliases = deduplicateAliases(allNames);

  // 3. 빈 문자열 제거
  const cleanAliases = uniqueAliases.filter(alias => alias.trim().length > 0);

  return {
    originalToken: oldEntry.originalToken,
    aliases: cleanAliases
  };
}

/**
 * 중복 제거 (대소문자 무시)
 */
function deduplicateAliases(aliases: string[]): string[] {
  return aliases.filter((alias, index, self) => {
    if (!alias) return false;
    return self.findIndex(a =>
      a.toLowerCase() === alias.toLowerCase()
    ) === index;
  });
}

/**
 * Dictionary 파일 로드
 */
function loadDictionary(fingerprint: string): OldDictionary | null {
  const filePath = path.join(DICT_DATA_DIR, `${fingerprint}.json`);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content) as OldDictionary;
}

/**
 * Dictionary 파일 저장
 */
function saveDictionary(fingerprint: string, dictionary: NewDictionary): void {
  const filePath = path.join(DICT_DATA_DIR, `${fingerprint}.json`);
  fs.writeFileSync(filePath, JSON.stringify(dictionary, null, 2), 'utf-8');
}

/**
 * 백업 파일 생성
 */
function backupDictionary(fingerprint: string, dictionary: OldDictionary): void {
  const backupPath = path.join(DICT_DATA_DIR, `${fingerprint}.backup.json`);
  fs.writeFileSync(backupPath, JSON.stringify(dictionary, null, 2), 'utf-8');
  console.log(`📦 Backup created: ${backupPath}`);
}

/**
 * 마이그레이션 실행
 */
async function migrateDictionary(fingerprint: string): Promise<void> {
  console.log(`\n🔄 Starting migration for: ${fingerprint}`);

  // 1. 기존 dictionary 로드
  const oldDict = loadDictionary(fingerprint);
  if (!oldDict) {
    throw new Error(`Dictionary not found: ${fingerprint}`);
  }

  console.log(`✅ Loaded dictionary: ${oldDict.entries.length} entries`);

  // 2. 백업 생성
  backupDictionary(fingerprint, oldDict);

  // 3. 항목별 변환
  const newEntries = oldDict.entries.map(entry => transformEntry(entry));

  // 4. 통계 출력
  const totalAliases = newEntries.reduce((sum, e) => sum + e.aliases.length, 0);
  const avgAliasesPerEntry = (totalAliases / newEntries.length).toFixed(1);

  console.log(`\n📊 Migration Statistics:`);
  console.log(`  - Total entries: ${newEntries.length}`);
  console.log(`  - Total aliases: ${totalAliases}`);
  console.log(`  - Average aliases per entry: ${avgAliasesPerEntry}`);

  // 5. 새 dictionary 저장
  const newDict: NewDictionary = {
    version: '4.3.0',
    entries: newEntries
  };

  saveDictionary(fingerprint, newDict);

  console.log(`\n✅ Migration completed successfully!`);
  console.log(`   New dictionary saved: ${path.join(DICT_DATA_DIR, `${fingerprint}.json`)}`);
}

/**
 * 백업에서 복원
 */
async function restoreDictionary(fingerprint: string): Promise<void> {
  const backupPath = path.join(DICT_DATA_DIR, `${fingerprint}.backup.json`);
  const filePath = path.join(DICT_DATA_DIR, `${fingerprint}.json`);

  if (!fs.existsSync(backupPath)) {
    throw new Error(`Backup not found: ${backupPath}`);
  }

  fs.copyFileSync(backupPath, filePath);
  console.log(`✅ Restored from backup: ${backupPath} → ${filePath}`);
}

/**
 * 전체 디렉토리 마이그레이션
 */
async function migrateAllDictionaries(): Promise<void> {
  console.log(`\n🔄 Migrating all dictionaries in: ${DICT_DATA_DIR}\n`);

  if (!fs.existsSync(DICT_DATA_DIR)) {
    throw new Error(`Dictionary directory not found: ${DICT_DATA_DIR}`);
  }

  const files = fs.readdirSync(DICT_DATA_DIR);
  const jsonFiles = files.filter(f => f.endsWith('.json') && !f.includes('.backup'));

  if (jsonFiles.length === 0) {
    console.log('No dictionary files found.');
    return;
  }

  console.log(`Found ${jsonFiles.length} dictionary files.\n`);

  for (const file of jsonFiles) {
    const fingerprint = path.basename(file, '.json');
    try {
      await migrateDictionary(fingerprint);
    } catch (error) {
      console.error(`❌ Failed to migrate ${fingerprint}:`, error);
    }
  }

  console.log(`\n✅ All migrations completed!`);
}

// CLI 실행
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
Usage:
  node scripts/migrate-dictionary-v43.js <fingerprint>     Migrate specific dictionary
  node scripts/migrate-dictionary-v43.js --all             Migrate all dictionaries
  node scripts/migrate-dictionary-v43.js --restore <fp>    Restore from backup

Examples:
  node scripts/migrate-dictionary-v43.js abc123xyz
  node scripts/migrate-dictionary-v43.js --all
  node scripts/migrate-dictionary-v43.js --restore abc123xyz
`);
    process.exit(1);
  }

  const command = args[0];

  if (command === '--all') {
    migrateAllDictionaries().catch(err => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
  } else if (command === '--restore') {
    if (args.length < 2) {
      console.error('Error: fingerprint required for --restore');
      process.exit(1);
    }
    const fingerprint = args[1];
    restoreDictionary(fingerprint).catch(err => {
      console.error('Restore failed:', err);
      process.exit(1);
    });
  } else {
    const fingerprint = command;
    migrateDictionary(fingerprint).catch(err => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
  }
}

// Export for testing
export {
  transformEntry,
  deduplicateAliases,
  migrateDictionary,
  restoreDictionary,
  migrateAllDictionaries
};
