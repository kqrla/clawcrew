/**
 * docs/38. prevention in two layers, because detection alone is a postmortem.
 *
 * L1 is at issue time: a seat is handed its slice's tools and never learns the
 * others exist. L2 is here, at the point of invocation, where an argument can be
 * checked against the grant that allowed the tool rather than the prompt that
 * mentioned it. auditProposal stays as L3, and it can only ever see the past.
 *
 * the reason this lives in our code and not a framework's: a tool registry inside
 * a library is a second authority model, and two authority models means whichever
 * one is more permissive wins.
 */
import { GrantSet } from './grants.js';

export type RefusalCode =
  | 'tool_not_granted'
  | 'surface_not_held'
  | 'scope_outside_grant'
  | 'spend_not_reserved'
  | 'arg_outside_scope'
  | 'struck_out';

export interface ScopedTool {
  name: string;
  /** the slice surface this tool acts on. the ontology decides whether it exists */
  surface: string;
  /** arg names whose values must fall inside the grant's scope for that tool */
  scopedArgs?: string[];
}

export interface Invocation {
  tool: string;
  args: Record<string, unknown>;
}

export interface InvocationContext {
  seat: string;
  /** the surface the seat is acting under right now */
  surface: string;
  grant: GrantSet;
  /** per-tool scope, as issued. absence means the tool is unbounded, which is a fault */
  scopes?: Record<string, string[]>;
  /** spend already reserved for this seat today, in usd */
  spendUsedUsd?: number;
  spendPerCallUsd?: number;
  /** strikes already recorded against this seat */
  strikes?: number;
}

export interface Verdict {
  ok: boolean;
  code?: RefusalCode;
  detail?: Record<string, unknown>;
  /** true when the seat should be stopped rather than corrected and retried */
  escalate?: boolean;
  /** the call is not this seat's business at all, as opposed to malformed */
  fatal?: boolean;
}

/** two strikes and the seat stops. wandering is a symptom, not an input error. */
export const STRIKE_LIMIT = 2;

export function judge(inv: Invocation, tool: ScopedTool | undefined, ctx: InvocationContext): Verdict {
  if ((ctx.strikes ?? 0) >= STRIKE_LIMIT) {
    return { ok: false, code: 'struck_out', fatal: true, detail: { strikes: ctx.strikes } };
  }
  if (!tool) {
    return { ok: false, code: 'tool_not_granted', fatal: true, detail: { tool: inv.tool } };
  }
  if (!ctx.grant.tools.includes(tool.name)) {
    // the tool exists in the catalogue but not in this grant. that is a widening
    // attempt, not a typo, so it escalates.
    return { ok: false, code: 'tool_not_granted', fatal: true, escalate: true, detail: { tool: tool.name } };
  }
  if (tool.surface !== ctx.surface) {
    return {
      ok: false,
      code: 'surface_not_held',
      fatal: true,
      escalate: true,
      detail: { acting: ctx.surface, tool: tool.name, toolSurface: tool.surface },
    };
  }

  const allowed = ctx.scopes?.[tool.name];
  for (const arg of tool.scopedArgs ?? []) {
    const value = inv.args[arg];
    if (typeof value !== 'string') {
      return { ok: false, code: 'arg_outside_scope', detail: { arg, got: value ?? null } };
    }
    if (!allowed) {
      // a scoped tool reached with no scope on the grant is unbounded reach
      return { ok: false, code: 'scope_outside_grant', fatal: true, detail: { tool: tool.name, arg } };
    }
    if (!allowed.includes(value)) {
      // aiming outside the granted reach ends the turn. it is not correctable by
      // trying again with different arguments, and an org that coaches a seat to
      // retry after it aimed wrong is teaching it the boundary by braille.
      return {
        ok: false,
        code: 'scope_outside_grant',
        escalate: true,
        fatal: true,
        detail: { arg, value, allowed },
      };
    }
  }

  const cap = ctx.grant.spendUsdPerDay;
  if (cap !== undefined) {
    const used = ctx.spendUsedUsd ?? 0;
    const next = used + (ctx.spendPerCallUsd ?? 0);
    if (next > cap) {
      return { ok: false, code: 'spend_not_reserved', detail: { used, next, cap } };
    }
  }

  return { ok: true };
}

/** what the org does about a verdict, kept beside the verdict so it cannot drift */
export interface Consequence {
  strike: boolean;
  freeze: boolean;
  retryable: boolean;
  code?: RefusalCode;
}

export function consequence(v: Verdict): Consequence {
  if (v.ok) return { strike: false, freeze: false, retryable: false };
  const fatal = v.fatal === true;
  const freeze = fatal && (v.code === 'surface_not_held' || v.code === 'tool_not_granted');
  return {
    strike: fatal || v.escalate === true,
    freeze,
    // arg and spend problems are correctable; reach problems are not
    retryable: !fatal,
    code: v.code,
  };
}
