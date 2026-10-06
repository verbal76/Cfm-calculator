// Verifies the built web bundle ships the canonical Hot Attic Games logo byte-for-byte and the page references it.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';

const NAME = 'Hot_Attic_Games_Master_Logo_ALPHA_FINAL';
const sha = (b) => createHash('sha256').update(b).digest('hex');
const canonical = sha(readFileSync(`${NAME}.png`));
const built = readdirSync('dist/assets').filter((f) => f.startsWith(NAME) && f.endsWith('.png'));
if (built.length !== 1) { console.error(`FAIL: expected exactly one built ${NAME}*.png in dist/assets, found ${built.length}`); process.exit(1); }
const builtSha = sha(readFileSync(`dist/assets/${built[0]}`));
if (builtSha !== canonical) { console.error(`FAIL: built logo differs from the canonical file (${builtSha} vs ${canonical})`); process.exit(1); }
const html = readFileSync('dist/index.html', 'utf8');
if (!html.includes(`assets/${built[0]}`)) { console.error('FAIL: dist/index.html does not reference the built logo'); process.exit(1); }
console.log(`PASS: dist/assets/${built[0]} is byte-identical to ${NAME}.png (sha256 ${canonical}) and is referenced by index.html`);
