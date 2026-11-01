import {
  ABI_VERSION,
  AuditorPlugin,
  ObjectiveSourcePlugin,
  Plugin,
  PluginKind,
  TriggerPlugin,
} from './types.js';

export interface OrchartConfig {
  version: 1;
  plugins: { kind: PluginKind; id: string }[];
  /** deterministic thresholds, versioned with the config */
  policy: { spendApprovalThresholdUsd: number };
}

export class PluginRegistry {
  private byKey = new Map<string, Plugin>();
  private sources: ObjectiveSourcePlugin[] = [];

  register(plugin: Plugin): void {
    if (plugin.abi !== ABI_VERSION) {
      throw new Error(`plugin ${plugin.id}: abi ${plugin.abi} != ${ABI_VERSION}`);
    }
    const key = `${plugin.kind}:${plugin.id}`;
    if (this.byKey.has(key)) throw new Error(`plugin already registered: ${key}`);
    this.byKey.set(key, plugin);
    if (plugin.kind === 'objective_source') this.sources.push(plugin);
  }

  get<T extends Plugin>(kind: PluginKind, id: string): T | undefined {
    return this.byKey.get(`${kind}:${id}`) as T | undefined;
  }

  require<T extends Plugin>(kind: PluginKind, id: string): T {
    const found = this.get<T>(kind, id);
    if (!found) throw new Error(`missing plugin: ${kind}:${id}`);
    return found;
  }

  list(kind?: PluginKind): Plugin[] {
    const all = [...this.byKey.values()];
    return kind ? all.filter((p) => p.kind === kind) : all;
  }

  /** resolve `sql:analytics.activation_daily` to the plugin that owns the scheme */
  sourceFor(ref: string): ObjectiveSourcePlugin {
    const scheme = ref.split(':', 1)[0]!;
    const found = this.sources.find((s) => s.schemes.includes(scheme));
    if (!found) throw new Error(`no objective source registered for scheme "${scheme}"`);
    return found;
  }

  auditors(): AuditorPlugin[] {
    return this.list('auditor') as AuditorPlugin[];
  }

  triggers(): TriggerPlugin[] {
    return this.list('trigger') as TriggerPlugin[];
  }

  /**
   * config is the authority for what is enabled. a plugin present in code but
   * absent from config is inert, so enabling autonomy is a reviewable diff.
   */
  static fromConfig(config: OrchartConfig, available: Plugin[]): PluginRegistry {
    const registry = new PluginRegistry();
    const missing: string[] = [];
    for (const want of config.plugins) {
      const match = available.find((p) => p.kind === want.kind && p.id === want.id);
      if (!match) missing.push(`${want.kind}:${want.id}`);
      else registry.register(match);
    }
    if (missing.length > 0) throw new Error(`config references unknown plugins: ${missing.join(', ')}`);
    return registry;
  }
}

export function configFor(plugins: Plugin[], threshold = 50): OrchartConfig {
  return {
    version: 1,
    plugins: plugins.map((p) => ({ kind: p.kind, id: p.id })),
    policy: { spendApprovalThresholdUsd: threshold },
  };
}
