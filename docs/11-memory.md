# 11 · memory

## two kinds of durable state

- **the record**: decisions, handoffs, approvals, evidence, transcripts. append-only, hash-chained, in git or an equivalent. this is the source of truth.
- **memory**: derived, queryable, lossy, rebuildable. it is an index over the record plus externalized working notes.

if the memory store is lost, the org loses convenience, not truth. if the record is lost, the org loses its ability to explain itself.

## namespaces

```
mem://org/<objective-id>          shared, objective-scoped
mem://circle/<circle-id>          shared inside a circle
mem://seat/<seat-id>              private to one seat
mem://host/<circle-id>/<seat-id>  secondment scratch, host-owned
mem://sensitive/<domain>          separate store, never indexed with the rest
```

resolution order for a read: seat, host, circle, objective. first match wins, and the resolution is logged with the message that used it.

## rules

- **writes carry a source.** every memory write references the message or event it came from. unattributed memory is not admitted.
- **retrieval is logged.** which memories were injected into which message, so a bad decision can be traced to what the agent actually saw.
- **sensitive namespaces use separate stores.** filters over a shared store leak through search, embeddings and admin tools.
- **no secrets in memory, ever.** the adapter may not be trusted to redact, so secrets never enter.
- **host memory does not merge automatically.** it merges on acceptance by the home manager, with provenance. see [04](04-secondments.md).
- **expiry by default.** working memory in `host` and `seat` namespaces expires after 30 days unless promoted. the record keeps everything; memory should not.

## rebuild

a rebuild takes the record and re-derives the index. the acceptance test is:

```
rebuild(record, t) == live_memory(t)      # for a sampled set of queries
```

if it does not match, the memory has become a source of truth, which means two sources and no truth.

## adapters

the interface is deliberately small:

```ts
interface MemoryStore {
  write(ns: string, item: Item, source: EventId): Promise<void>
  query(ns: string[], q: string, k: number): Promise<Item[]>
  forget(ns: string, ids: string[]): Promise<void>   // for erasure, not editing
  rebuild(record: EventLog): Promise<void>
}
```

a local store is the default. hosted stores are adapters behind the same interface. any adapter that cannot support `rebuild` is a cache, and is labeled one in the ui.
