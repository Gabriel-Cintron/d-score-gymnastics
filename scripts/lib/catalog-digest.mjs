import { createHash } from 'node:crypto';

/** Catalog identity for build/deployment manifests; this is not a human approval record. */
export function publicWordingDigest(elements) {
  const canonical = [...elements]
    .sort((left, right) => left.id.localeCompare(right.id, 'en-US'))
    .map(({ aliases, apparatus, id, name }) => ({ aliases, apparatus, id, name }));
  return `sha256:${createHash('sha256').update(JSON.stringify(canonical)).digest('hex')}`;
}
