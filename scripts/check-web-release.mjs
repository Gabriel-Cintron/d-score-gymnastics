import { runPnpm } from './lib/run-pnpm.mjs';

const preflight = globalThis.process.argv.includes('--preflight');
runPnpm(['check']);
runPnpm(['release:web:validate']);
runPnpm([preflight ? 'publication:preflight' : 'publication:check']);
const env = { ...globalThis.process.env, DSCORE_USE_EXISTING_BUILD: '1' };
runPnpm(['test:e2e'], { env });
runPnpm(['test:lighthouse'], { env });
