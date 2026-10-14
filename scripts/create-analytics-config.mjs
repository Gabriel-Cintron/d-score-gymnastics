import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const env = globalThis.process.env,
  target = env.ANALYTICS_TARGET;
if (!['preview', 'production'].includes(target)) throw new Error('Choose preview or production.');
for (const key of ['CLOUDFLARE_ACCOUNT_ID', 'ANALYTICS_ACCESS_AUD']) {
  if (!/^[a-f0-9]{32,64}$/.test(env[key] ?? '')) throw new Error(`Missing/invalid ${key}`);
}
if (!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(env.ANALYTICS_D1_ID ?? ''))
  throw new Error('Missing/invalid ANALYTICS_D1_ID');
if (!/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(env.ANALYTICS_ACCESS_TEAM ?? ''))
  throw new Error('Configure owner-only Access before deployment.');
const builds = [
  env.ANALYTICS_CANDIDATE_SHA,
  ...(env.ANALYTICS_PREVIOUS_BUILDS ?? '').split(',').filter(Boolean),
];
if (builds.length > 32 || builds.some((b) => !/^[a-f0-9]{40}$/.test(b ?? '')))
  throw new Error('Configure valid candidate/previous builds.');
const root = resolve(import.meta.dirname, '..');
const config = JSON.parse(
  await readFile(resolve(root, 'services/analytics/wrangler.jsonc'), 'utf8').then((s) =>
    s.replace(/,\s*([}\]])/g, '$1'),
  ),
);
const staging = target === 'preview';
config.name = staging ? 'dscore-analytics-staging' : 'dscore-analytics';
config.main = resolve(root, 'services/analytics/src/worker.ts');
config.account_id = env.CLOUDFLARE_ACCOUNT_ID;
config.d1_databases = [
  {
    binding: 'DB',
    database_name: staging ? 'dscore-analytics-staging' : 'dscore-analytics-production',
    database_id: env.ANALYTICS_D1_ID,
    migrations_dir: resolve(root, 'services/analytics/migrations'),
  },
];
config.vars = {
  ...config.vars,
  INGEST_ENABLED: 'true',
  ALLOWED_BUILDS: [...new Set(builds)].join(','),
  ACCESS_TEAM: env.ANALYTICS_ACCESS_TEAM,
  ACCESS_AUD: env.ANALYTICS_ACCESS_AUD,
  ADMIN_HOST: staging ? 'admin-staging.d-score.app' : 'admin.d-score.app',
  COLLECTOR_HOST: staging ? 'analytics-staging.d-score.app' : 'analytics.d-score.app',
};
config.routes = [config.vars.ADMIN_HOST, config.vars.COLLECTOR_HOST].map((pattern) => ({
  pattern,
  custom_domain: true,
}));
await mkdir(resolve(root, 'build'), { recursive: true });
await writeFile(
  resolve(root, 'build/analytics-config.json'),
  JSON.stringify(config, null, 2) + '\n',
);
globalThis.console.log(
  `Prepared ${target} analytics deployment for ${builds[0]}; no credentials written.`,
);
