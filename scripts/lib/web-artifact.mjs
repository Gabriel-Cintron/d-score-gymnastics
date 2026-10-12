import { createHash } from 'node:crypto';
import { lstat, readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

export async function inventory(directory) {
  const files = {};
  const entries = (await readdir(directory, { recursive: true }))
    .map((entry) => entry.replaceAll('\\', '/'))
    .sort();
  for (const entry of entries) {
    const info = await lstat(resolve(directory, entry));
    if (info.isSymbolicLink()) throw new Error('Release artifacts cannot contain symlinks.');
    if (!info.isFile()) continue;
    if (info.size > 25 * 1024 * 1024) throw new Error(`Cloudflare asset exceeds 25 MiB: ${entry}`);
    files[entry] = createHash('sha256')
      .update(await readFile(resolve(directory, entry)))
      .digest('hex');
  }
  if (Object.keys(files).length > 20_000) throw new Error('Cloudflare Free file limit exceeded.');
  return files;
}

export function artifactDigest(files) {
  return `sha256:${createHash('sha256').update(JSON.stringify(files)).digest('hex')}`;
}
