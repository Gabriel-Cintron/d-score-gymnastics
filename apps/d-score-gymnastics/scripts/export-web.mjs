import { execFileSync, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const build = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (!/^[a-f0-9]{40}$/.test(build)) throw new Error('A verified Git build identity is required.');
const result = spawnSync(
  globalThis.process.execPath,
  [require.resolve('expo/bin/cli'), 'export', '--platform', 'web'],
  { stdio: 'inherit', env: { ...globalThis.process.env, EXPO_PUBLIC_DSCORE_BUILD_SHA: build } },
);
if (result.error) throw result.error;
globalThis.process.exit(result.status ?? 1);
