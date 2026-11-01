// risk is classified by deterministic code. a model may propose a class;
// it may not decide one. disagreement is recorded, not resolved in the model's favour.
export type ApprovalClass = 'a0' | 'a1' | 'a2' | 'a3' | 'a4';
export type Sensitivity = 'public' | 'internal' | 'sensitive';
export type SurfaceKind =
  | 'repo_path'
  | 'db_table'
  | 'endpoint'
  | 'domain'
  | 'ad_account'
  | 'bank_account'
  | 'document'
  | 'queue';

export interface ActionSurface {
  kind: SurfaceKind;
  sensitivity: Sensitivity;
  ownerTier: string;
}

export interface Action {
  verb: string;
  actorTier: string;
  surface?: ActionSurface;
  economic?: { direction: 'in' | 'out'; amountUsd: number };
  external?: boolean;
  reversible?: boolean;
  write?: boolean;
}

export interface PolicyConfig {
  spendApprovalThresholdUsd: number;
}

export interface Classification {
  cls: ApprovalClass;
  reason: string;
  rule: number;
}

export type GateDecision = 'allow' | 'notify' | 'approval' | 'block';

export interface GateResult {
  decision: GateDecision;
  classification: Classification;
  override?: { proposed: ApprovalClass; applied: ApprovalClass; actor: string };
}

const DECISION_BY_CLASS: Record<ApprovalClass, GateDecision> = {
  a0: 'allow',
  a1: 'notify',
  a2: 'approval',
  a3: 'approval',
  a4: 'block',
};

export function classify(action: Action, config: PolicyConfig): Classification {
  // 1. money leaving the entity is never unattended
  if (action.economic?.direction === 'out' && action.economic.amountUsd > 0) {
    return { cls: 'a4', reason: 'money_out_of_entity', rule: 1 };
  }
  // 2. irreversible external publication
  if (action.external === true && action.reversible === false) {
    return { cls: 'a3', reason: 'irreversible_external', rule: 2 };
  }
  // 3. sensitive surfaces
  if (action.surface?.sensitivity === 'sensitive') {
    return { cls: 'a3', reason: 'sensitive_surface', rule: 3 };
  }
  // 4. spend above threshold
  if (
    action.economic !== undefined &&
    action.economic.amountUsd > config.spendApprovalThresholdUsd
  ) {
    return { cls: 'a2', reason: 'spend_above_threshold', rule: 4 };
  }
  // 5. writing to a surface another tier owns
  if (action.surface && action.surface.ownerTier !== action.actorTier) {
    return { cls: 'a2', reason: 'cross_tier_write', rule: 5 };
  }
  // 6. ordinary writes to owned surfaces
  if (action.surface && action.write !== false) {
    return { cls: 'a1', reason: 'owned_surface_write', rule: 6 };
  }
  // 7. reads and internal state
  return { cls: 'a0', reason: 'internal_or_read', rule: 7 };
}

export function gate(
  action: Action,
  config: PolicyConfig,
  modelProposed?: { cls: ApprovalClass; actor: string },
): GateResult {
  const classification = classify(action, config);
  const result: GateResult = {
    decision: DECISION_BY_CLASS[classification.cls],
    classification,
  };
  if (modelProposed && modelProposed.cls !== classification.cls) {
    result.override = {
      proposed: modelProposed.cls,
      applied: classification.cls,
      actor: modelProposed.actor,
    };
  }
  return result;
}

export function requiresHuman(cls: ApprovalClass): boolean {
  return cls === 'a2' || cls === 'a3' || cls === 'a4';
}
