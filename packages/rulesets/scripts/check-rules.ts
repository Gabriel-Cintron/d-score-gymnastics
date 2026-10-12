import { fileURLToPath } from 'node:url';

import { APPARATUS_CODE_BY_ID, APPARATUS_IDS } from '@d-score-gymnastics/scoring';
import { formatValidationIssues } from '@d-score-gymnastics/rulesets';

import { countElementsByApparatus, loadRulesets } from './lib/load-rulesets';

const dataDirectory = fileURLToPath(new URL('../data/', import.meta.url));
const result = await loadRulesets(dataDirectory);

if (result.issues.length > 0) {
  console.error(
    `Rules data validation failed with ${result.issues.length} issue${result.issues.length === 1 ? '' : 's'}:\n${formatValidationIssues(result.issues)}`,
  );
  process.exitCode = 1;
} else {
  for (const source of result.sources) {
    const counts = countElementsByApparatus(source);
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    const apparatusSummary = APPARATUS_IDS.map(
      (apparatus) => `${APPARATUS_CODE_BY_ID[apparatus].toUpperCase()} ${counts[apparatus]}`,
    ).join(', ');
    console.log(
      `Validated ${source.manifest.id} ${source.manifest.dataVersion} (${source.manifest.status}): ${total} elements and ${source.fixtures.length} scoring fixture${source.fixtures.length === 1 ? '' : 's'} — ${apparatusSummary}.`,
    );
  }
}
