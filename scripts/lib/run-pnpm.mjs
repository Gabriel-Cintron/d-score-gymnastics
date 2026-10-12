import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/** Windows command shims are not executables. Run Corepack's Node entrypoint instead. */
export function runPnpm(args, options = {}) {
  const corepack = resolve(
    dirname(globalThis.process.execPath),
    'node_modules/corepack/dist/pnpm.js',
  );
  const command = globalThis.process.platform === 'win32' ? globalThis.process.execPath : 'pnpm';
  if (globalThis.process.platform === 'win32' && !existsSync(corepack)) {
    throw new Error('The pinned Windows Node toolchain must include Corepack.');
  }
  const result = spawnSync(
    command,
    globalThis.process.platform === 'win32' ? [corepack, ...args] : args,
    {
      stdio: 'inherit',
      ...options,
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`pnpm ${args.join(' ')} failed (${result.status}).`);
}
