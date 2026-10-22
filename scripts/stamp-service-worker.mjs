import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// A new cache name per build makes the service worker drop the previous build's offline copy.
const dist = new URL('../dist/', import.meta.url);
const index = await readFile(new URL('index.html', dist), 'utf8');
if (!index.includes('/day-by-day/assets/'))
  throw new Error('Missing repository base path in build output.');
const version = createHash('sha256').update(index).digest('hex').slice(0, 12);
const sw = await readFile(new URL('sw.js', dist), 'utf8');
await writeFile(new URL('sw.js', dist), sw.replace('BUILD_VERSION', version));
