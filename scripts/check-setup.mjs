// Prüft Voraussetzungen für den Start (wird von start.bat/dev.bat aufgerufen).
// Exit-Code 0 = alles bereit, 2 = Abhängigkeiten müssen (neu) installiert werden, 1 = Node.js zu alt.
import { existsSync, statSync } from 'node:fs';

const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 13)) {
  console.error(`Node.js ${process.versions.node} ist zu alt. Benoetigt wird mindestens Version 22.13 (empfohlen: aktuelle LTS-Version).`);
  process.exit(1);
}

const marker = 'node_modules/.package-lock.json';
if (!existsSync(marker)) process.exit(2);
if (existsSync('package-lock.json') && statSync('package-lock.json').mtimeMs > statSync(marker).mtimeMs + 1000) process.exit(2);
process.exit(0);
