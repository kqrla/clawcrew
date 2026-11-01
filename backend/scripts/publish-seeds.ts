import { readFileSync, readdirSync } from 'node:fs';
import { SliceOntology, validate, versionHash } from '../src/domain/ontology.js';

const dir = 'ontology/';
for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
  const doc = JSON.parse(readFileSync(dir + file, 'utf8')) as SliceOntology;
  const faults = validate(doc);
  if (faults.length) {
    console.error(file, faults);
    process.exit(1);
  }
  const hash = versionHash(doc);
  const json = JSON.stringify(doc).replace(/'/g, "''");
  console.log(
    `insert into slice_ontology (id, slice, version, doc, doc_hash, author) values ('ont.${doc.slice}.v${doc.version}', '${doc.slice}', ${doc.version}, '${json}'::jsonb, '${hash}', 'operator.seed') on conflict (slice, version) do nothing;`,
  );
}
