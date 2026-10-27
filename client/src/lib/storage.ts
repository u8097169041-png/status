/** Sicherer Zugriff auf localStorage (z. B. im privaten Modus kann der Zugriff fehlschlagen). */
export function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignorieren – nur eine Komfortfunktion.
  }
}
