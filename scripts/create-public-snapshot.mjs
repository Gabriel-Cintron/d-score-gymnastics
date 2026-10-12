import { execFileSync } from 'node:child_process';
import { lstat, mkdir } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';

import { runPnpm } from './lib/run-pnpm.mjs';

const root = resolve(import.meta.dirname, '..');
const output = outputArgument(globalThis.process.argv.slice(2));
const outputPath = isAbsolute(output) ? output : resolve(root, output);

if (!outputPath.endsWith('.tar.gz')) {
  throw new Error('The public snapshot output must end in .tar.gz.');
}
if (isInside(root, outputPath)) {
  throw new Error('Write the public snapshot outside the working repository, such as under /tmp.');
}
try {
  await lstat(outputPath);
  throw new Error(`Refusing to overwrite existing snapshot ${outputPath}.`);
} catch (error) {
  if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
}

const status = git(['status', '--porcelain=v1']);
if (status.trim().length > 0) {
  throw new Error(
    'Commit or remove every working-tree change before creating the public snapshot.',
  );
}
runPnpm(['publication:check', '--', 'web', 'open-source-repository'], { cwd: root });
await mkdir(dirname(outputPath), { recursive: true });
execFileSync('git', ['archive', '--format=tar.gz', `--output=${outputPath}`, 'HEAD'], {
  cwd: root,
  stdio: 'inherit',
});

const entries = execFileSync('tar', ['-tzf', outputPath], { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean);
const forbidden = entries.filter(
  (entry) =>
    entry === '.git' ||
    entry.startsWith('.git/') ||
    entry === '.private' ||
    entry.startsWith('.private/') ||
    entry.split('/').some((segment) => ['node_modules', 'generated'].includes(segment)) ||
    entry === 'easyscore' ||
    /(?:^|\/)\.env(?:\.|$)/u.test(entry) ||
    /\.(?:pdf|pem|key|p12|mobileprovision)$/iu.test(entry) ||
    /(?:^|\/)[^/]*backup[^/]*\.json$/iu.test(entry),
);
if (forbidden.length > 0) {
  throw new Error(`Public snapshot contains forbidden paths: ${forbidden.join(', ')}`);
}

globalThis.process.stdout.write(
  `Created sanitized public snapshot for ${git(['rev-parse', 'HEAD']).trim()} at ${outputPath}.\n`,
);

function git(arguments_) {
  return execFileSync('git', arguments_, { cwd: root, encoding: 'utf8' });
}

function outputArgument(arguments_) {
  if (arguments_[0] === '--') arguments_ = arguments_.slice(1);
  if (arguments_.length !== 2 || arguments_[0] !== '--output' || arguments_[1] === undefined) {
    throw new Error(
      'Usage: pnpm release:snapshot -- --output /tmp/d-score-gymnastics-v1.0.0.tar.gz',
    );
  }
  return arguments_[1];
}

function isInside(directory, path) {
  const child = relative(directory, path);
  return child.length === 0 || (!child.startsWith('..') && !isAbsolute(child));
}
