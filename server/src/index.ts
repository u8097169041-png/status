// Einstiegspunkt: Zuerst wird die SQLite-Experimentalwarnung unterdrückt, dann die eigentliche Anwendung geladen.
// Der dynamische Import ist nötig, weil statische Imports von node:sqlite bereits beim Verlinken geladen würden.
import './suppress-warnings';

await import('./main');
