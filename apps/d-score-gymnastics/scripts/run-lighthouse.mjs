import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { chromium } from '@playwright/test';

const require = createRequire(import.meta.url);
const executable = require.resolve('@lhci/cli/src/cli.js');
// GitHub's packaged Chrome has a working sandbox policy; downloaded Playwright Chrome may not.
const chromePath =
  globalThis.process.env.CHROME_PATH ??
  (globalThis.process.env.CI === 'true' ? undefined : chromium.executablePath());
const result = spawnSync(
  globalThis.process.execPath,
  [executable, 'autorun', '--config=lighthouserc.cjs'],
  {
    env: {
      ...globalThis.process.env,
      ...(chromePath === undefined ? {} : { CHROME_PATH: chromePath }),
    },
    stdio: 'inherit',
  },
);

if (result.error !== undefined) throw result.error;
globalThis.process.exitCode = result.status ?? 1;
