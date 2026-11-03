/**
 * docs/37. the whole method in one function: a seat reads a task, a model proposes,
 * the ledger decides whether the proposal counts.
 *
 * no framework appears here, and that is the point. the model is a port that takes a
 * prompt plus the seat's grant and returns a proposal; everything after that is rows,
 * refusals and receipts. swap the model and nothing above this line changes.
 */
import { Claim } from './discourse.js';
import { GrantSet } from './grants.js';
import { TaskKind } from './ontology.js';

export interface SeatTask {
  id: string;
  seat: string;
  slice: string;
  kind: TaskKind;
  objectiveRef: string;
  /** what success looks like, stated before the model runs, not after */
  acceptance: string;
}

export interface Proposal {
  claims: Claim[];
  calls: { tool: string; args: Record<string, unknown> }[];
  outcome: 'advance' | 'block' | 'refuse';
  /** required for block and refuse: a coded reason, not an adjective */
  reason?: string;
  /** at least one of these for advance: what a stranger could go and look at */
  artifacts?: string[];
}

export interface TurnFault {
  code:
    | 'tool_not_granted'
    | 'call_on_another_slice'
    | 'advance_without_artifact'
    | 'advance_without_claim'
    | 'block_without_a_reason'
    | 'refuse_without_a_reason'
    | 'claim_not_well_formed';
  detail: string;
}

/** a tool's reach, from the toolbox index. the seat may only use tools bound to its slice */
export interface ToolBinding {
  tool: string;
  surface: string;
}

export interface TurnContext {
  task: SeatTask;
  grant: GrantSet;
  bindings: ToolBinding[];
}

const REF = /^[a-z][a-z0-9]*:\s*\S/;

function claimFault(c: Claim): TurnFault | null {
  if (!c.id || !c.statement.trim() || !c.by) return { code: 'claim_not_well_formed', detail: `claim ${c.id || '(no id)'} has no id, statement or author` };
  if (typeof c.confidence !== 'number' || c.confidence < 0 || c.confidence > 1)
    return { code: 'claim_not_well_formed', detail: `claim ${c.id} has confidence outside 0..1` };
  if (c.kind === 'fact' && (!c.evidence || !REF.test(c.evidence)))
    return { code: 'claim_not_well_formed', detail: `fact ${c.id} carries no resolvable reference` };
  return null;
}

/**
 * the only gate a model has to pass. it runs *after* generation, because a proposal is
 * not a permission and a prompt is not a policy.
 */
export function auditProposal(p: Proposal, ctx: TurnContext): TurnFault[] {
  const faults: TurnFault[] = [];

  for (const call of p.calls) {
    if (!ctx.grant.tools.includes(call.tool)) {
      faults.push({ code: 'tool_not_granted', detail: `${call.tool} is not in this seat's grant` });
      continue;
    }
    const binding = ctx.bindings.find((b) => b.tool === call.tool);
    if (!binding) {
      faults.push({ code: 'tool_not_granted', detail: `${call.tool} is granted but bound to no surface` });
    } else if (binding.surface !== ctx.task.slice) {
      faults.push({
        code: 'call_on_another_slice',
        detail: `${call.tool} reaches ${binding.surface}, and this task is ${ctx.task.slice}`,
      });
    }
  }

  for (const c of p.claims) {
    const f = claimFault(c);
    if (f) faults.push(f);
  }

  if (p.outcome === 'advance') {
    if (!p.artifacts?.length) {
      faults.push({ code: 'advance_without_artifact', detail: 'advancing needs a reference somebody else can open' });
    }
    if (!p.claims.length) {
      faults.push({ code: 'advance_without_claim', detail: 'advancing says nothing about what is now true' });
    }
  }
  if (p.outcome === 'block' && !p.reason?.trim()) {
    faults.push({ code: 'block_without_a_reason', detail: 'a block names what is missing' });
  }
  if (p.outcome === 'refuse' && !p.reason?.trim()) {
    faults.push({ code: 'refuse_without_a_reason', detail: 'a refusal names the constraint it hit' });
  }

  return faults;
}

export interface TurnPorts {
  /** the model, or a fixture, or a person. the shape is the contract, not the vendor */
  propose(prompt: { task: SeatTask; tools: string[]; claims: Claim[] }): Promise<Proposal>;
}

export interface TurnResult {
  task: string;
  accepted: boolean;
  faults: TurnFault[];
  /** what the ledger would write, when accepted */
  effect: { outcome: Proposal['outcome']; artifacts: string[]; claims: number } | null;
  /** true when a retry could plausibly succeed: the fault names a fixable action */
  retryable: boolean;
  promptTokens: { tools: number; claims: number };
}

/**
 * a refused turn is not an error. it is a receipt: the seat learns the fault codes and can
 * try again, and the ledger has a record that something was attempted and why it did not
 * count. that is the difference between an agent that fails and an agent that lies.
 */
export async function runTurn(ctx: TurnContext, ports: TurnPorts, context: Claim[] = []): Promise<TurnResult> {
  const prompt = { task: ctx.task, tools: [...ctx.grant.tools].sort(), claims: context };
  let proposal: Proposal;
  try {
    proposal = await ports.propose(prompt);
  } catch (err) {
    return {
      task: ctx.task.id,
      accepted: false,
      faults: [{ code: 'refuse_without_a_reason', detail: `model failed: ${(err as Error).message}` }],
      effect: null,
      retryable: true,
      promptTokens: { tools: prompt.tools.length, claims: context.length },
    };
  }

  const faults = auditProposal(proposal, ctx);
  if (faults.length) {
    return {
      task: ctx.task.id,
      accepted: false,
      faults,
      effect: null,
      retryable: faults.every((f) => f.code !== 'call_on_another_slice'),
      promptTokens: { tools: prompt.tools.length, claims: context.length },
    };
  }

  return {
    task: ctx.task.id,
    accepted: true,
    faults: [],
    effect: { outcome: proposal.outcome, artifacts: proposal.artifacts ?? [], claims: proposal.claims.length },
    retryable: false,
    promptTokens: { tools: prompt.tools.length, claims: context.length },
  };
}
