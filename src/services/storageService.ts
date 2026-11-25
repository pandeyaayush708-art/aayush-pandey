import { createDemoDatabase } from '../data/demoData';
import { FarmDatabase } from '../types/dairy';

const STORAGE_KEY = 'dairymitra_ai_2_db_v1';

export function loadDatabase(): FarmDatabase {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const demo = createDemoDatabase();
      saveDatabase(demo);
      return demo;
    }
    const parsed = JSON.parse(raw) as FarmDatabase;
    if (!parsed || !Array.isArray(parsed.cows) || !parsed.settings) {
      throw new Error('Invalid stored schema');
    }
    if (!Array.isArray(parsed.unusualMilkReviews)) {
      parsed.unusualMilkReviews = [];
    }
    return parsed;
  } catch {
    const demo = createDemoDatabase();
    saveDatabase(demo);
    return demo;
  }
}

export function saveDatabase(db: FarmDatabase): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch (err) {
    console.error('Failed to persist DairyMitra database:', err);
  }
}

export function validateImportedDatabase(jsonText: string): FarmDatabase {
  const parsed = JSON.parse(jsonText);
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !Array.isArray(parsed.cows) ||
    !Array.isArray(parsed.milkRecords) ||
    !Array.isArray(parsed.treatments) ||
    !parsed.settings
  ) {
    throw new Error('JSON file does not match DairyMitra AI 2.0 backup structure.');
  }
  if (!Array.isArray(parsed.unusualMilkReviews)) {
    parsed.unusualMilkReviews = [];
  }
  return parsed as FarmDatabase;
}
