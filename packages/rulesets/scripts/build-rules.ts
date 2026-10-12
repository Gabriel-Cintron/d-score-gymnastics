import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import {
  compileRuleset,
  formatValidationIssues,
  type CompiledRuleset,
} from '@d-score-gymnastics/rulesets';

import { loadRulesets } from './lib/load-rulesets';

const dataDirectory = fileURLToPath(new URL('../data/', import.meta.url));
const outputDirectory = fileURLToPath(new URL('../generated/', import.meta.url));
const result = await loadRulesets(dataDirectory);

if (result.issues.length > 0) {
  console.error(
    `Rules data compilation stopped with ${result.issues.length} validation issue${result.issues.length === 1 ? '' : 's'}:\n${formatValidationIssues(result.issues)}`,
  );
  process.exitCode = 1;
} else {
  await mkdir(outputDirectory, { recursive: true });

  const compiledRulesets: CompiledRuleset[] = [];
  for (const source of result.sources) {
    if (source.manifest.catalogWording.profile !== 'independent-public') {
      throw new Error(
        `Normal rules builds require independent-public catalog wording; ${source.manifest.id} is ${source.manifest.catalogWording.profile}.`,
      );
    }
    const compiled = compileRuleset(source);
    compiledRulesets.push(compiled);
    const outputFile = new URL(`../generated/${compiled.id}.json`, import.meta.url);
    await writeFile(outputFile, `${JSON.stringify(compiled, null, 2)}\n`, 'utf8');
    console.log(`Built generated/${compiled.id}.json (${compiled.elements.length} elements).`);
  }

  const indexFile = new URL('../generated/index.json', import.meta.url);
  const index = compiledRulesets.map(
    ({ catalogWording, dataRevision, dataVersion, id, status }) => ({
      catalogWording,
      dataRevision,
      dataVersion,
      id,
      status,
    }),
  );
  await writeFile(indexFile, `${JSON.stringify(index, null, 2)}\n`, 'utf8');
}
