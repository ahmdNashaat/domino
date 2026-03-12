interface StoredSnapshot<T> {
  data: T;
  savedAt: number;
}

const DEFAULT_MAX_AGE_MS = 10 * 60 * 1000;

export function saveScoreSnapshot<T>(key: string, data: T): void {
  try {
    const payload: StoredSnapshot<T> = { data, savedAt: Date.now() };
    sessionStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // Ignore storage errors (private mode, quotas, etc.)
  }
}

export function loadScoreSnapshot<T>(key: string, maxAgeMs: number = DEFAULT_MAX_AGE_MS): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSnapshot<T>>;
    if (!parsed || typeof parsed.savedAt !== 'number' || !('data' in parsed)) {
      return null;
    }
    if (Date.now() - parsed.savedAt > maxAgeMs) {
      sessionStorage.removeItem(key);
      return null;
    }
    return parsed.data as T;
  } catch {
    return null;
  }
}

export function clearScoreSnapshot(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // Ignore storage errors
  }
}
