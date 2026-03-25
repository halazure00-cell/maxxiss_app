export function getMigratedStorageItem(key: string, legacyKey?: string): string | null {
  const currentValue = localStorage.getItem(key);
  if (currentValue !== null) {
    return currentValue;
  }

  if (!legacyKey) {
    return null;
  }

  const legacyValue = localStorage.getItem(legacyKey);
  if (legacyValue !== null) {
    localStorage.setItem(key, legacyValue);
    return legacyValue;
  }

  return null;
}

export function setStorageItem(key: string, value: string, legacyKey?: string) {
  localStorage.setItem(key, value);

  if (legacyKey) {
    localStorage.removeItem(legacyKey);
  }
}
