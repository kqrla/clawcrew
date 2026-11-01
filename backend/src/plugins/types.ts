// the engine never imports a concrete adapter. everything that could change as the
// org grows more autonomous is a plugin behind one of these interfaces, so adding
// self-direction means registering a strategy, not patching the core.
export const ABI_VERSION = '1';

export type PluginKind =
  | 'objective_source'
  | 'auditor'
  | 'trigger'
  | 'tool_adapter'
  | 'memory_store'
  | 'model_router';

export interface PluginBase {
  id: string;
  kind: PluginKind;
  /** a plugin built for a different abi is refused at registration, not at runtime */
  abi: string;
  description?: string;
}

export interface MetricReading {
  value: number;
  computedAt: string;
  artifact?: string;
  /** where the number actually came from, for the audit */
  provenance: string;
}

export interface SourceContext {
  now: string;
  /** host-provided, read-only, connection-scoped. plugins never hold credentials. */
  runSql?: (sql: string) => Promise<Record<string, unknown>[]>;
  fetchJson?: (url: string) => Promise<unknown>;
  git?: (spec: string) => Promise<string>;
}

export interface ObjectiveSourcePlugin extends PluginBase {
  kind: 'objective_source';
  /** which `scheme:` prefixes this plugin handles, e.g. ['sql'] */
  schemes: string[];
  read(ref: string, ctx: SourceContext): Promise<MetricReading>;
}

export type Severity = 'info' | 'drift' | 'untraceable' | 'stall' | 'integrity';

export interface Finding {
  id: string;
  week: string;
  question: 'q1' | 'q2' | 'q3';
  claim: string;
  measured: number | null;
  expected: number | null;
  source: string | null;
  severity: Severity;
  ownerTier: string;
  actionRequired: string;
  status: 'open' | 'acknowledged' | 'closed';
}

export interface AuditInput {
  now: string;
  week: string;
  tasks: TaskRow[];
  objectives: ObjectiveRow[];
  evidence: EvidenceRow[];
}

export interface TaskRow {
  id: string;
  objectiveId: string | null;
  ownerTier: string;
  state: 'open' | 'in_progress' | 'done' | 'blocked';
  costUsd: number;
  completedAt?: string;
  claim?: { metric: string; value: number } | null;
}

export interface ObjectiveRow {
  id: string;
  ownerTier: string;
  metric: string;
  source: string;
  baseline: number;
  target: number;
  status: 'active' | 'met' | 'failed' | 'retired' | 'superseded';
  deadline: string;
  selfReported?: boolean;
}

export interface EvidenceRow {
  objective: string;
  source: string;
  value: number;
  computedAt: string;
  runBy: string;
}

export interface AuditorPlugin extends PluginBase {
  kind: 'auditor';
  run(input: AuditInput): Promise<Finding[]>;
}

export interface TriggerPlugin extends PluginBase {
  kind: 'trigger';
  /** cron-ish descriptor for display; the host decides actual scheduling */
  schedule: string;
  /** pure: does this trigger fire between the last tick and now? */
  due(lastTickAt: string, now: string): boolean;
}

export interface ToolDef {
  name: string;
  /** the grant a seat must hold to call this */
  grant: string;
  surfaceKind?: string;
  write: boolean;
}

export interface ToolAdapterPlugin extends PluginBase {
  kind: 'tool_adapter';
  tools(): ToolDef[];
  call(name: string, args: Record<string, unknown>, grant: string): Promise<unknown>;
}

export interface MemoryStorePlugin extends PluginBase {
  kind: 'memory_store';
  write(ns: string, item: unknown, sourceEventId: string): Promise<void>;
  query(namespaces: string[], q: string, k: number): Promise<unknown[]>;
  forget(ns: string, ids: string[]): Promise<void>;
  /** an adapter that cannot rebuild is a cache, and is labelled one in the ui */
  rebuild(events: unknown[]): Promise<void>;
}

export interface ModelRouterPlugin extends PluginBase {
  kind: 'model_router';
  route(seatId: string, stage: 'intake' | 'plan' | 'code' | 'audit'): { provider: string; model: string };
}

export type Plugin =
  | ObjectiveSourcePlugin
  | AuditorPlugin
  | TriggerPlugin
  | ToolAdapterPlugin
  | MemoryStorePlugin
  | ModelRouterPlugin;
