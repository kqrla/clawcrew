/**
 * docs/36. a seat reaches the world through a surface, and the surface is a slice's
 * contract. so "which tools" is not a stack question, it is a permissions question,
 * and the set is closed by the slice ontology rather than by what happens to be
 * convenient to install.
 *
 * this is the correction to a mistake worth keeping in the record: a plugin set full
 * of chat connectors looks like capability and is actually blast radius. nothing in
 * the slice set declares a chat surface, so nobody holds a grant to post anywhere.
 */
import { Composition } from './ontology.js';

export type ToolStatus = 'adopted' | 'candidate' | 'rejected';
export type ToolHolder = 'engine' | 'slice';

export interface ToolEntry {
  id: string;
  status: ToolStatus;
  /** the engine holds infrastructure; a slice holds reach */
  holder: ToolHolder;
  /** required for a slice-held tool, forbidden for an engine-held one */
  surface?: string | null;
  licence?: string;
  /** something this repo can point at that the tool produced */
  evidence?: string;
  /** required when rejected, so a refusal is not a shrug */
  why?: string;
  deterministic?: boolean;
}

export interface ToolFault {
  id: string;
  code: string;
  detail: Record<string, unknown>;
}

export interface ToolboxReport {
  ok: boolean;
  faults: ToolFault[];
  adopted: string[];
  candidates: string[];
  rejected: string[];
}

export function validateToolbox(entries: ToolEntry[], composition: Composition): ToolboxReport {
  const faults: ToolFault[] = [];
  const seen = new Set<string>();
  const provided = new Set(composition.provided);

  for (const t of entries) {
    if (seen.has(t.id)) faults.push({ id: t.id, code: 'duplicate_tool', detail: {} });
    seen.add(t.id);

    const surface = t.surface ?? null;

    // a slice-held tool is a grant, and a grant names the contract it serves
    // a rejection is the absence of a grant, so it does not need a surface to name
    if (t.holder === 'slice' && !surface && t.status !== 'rejected') {
      faults.push({ id: t.id, code: 'slice_tool_without_a_surface', detail: {} });
    }
    if (t.holder === 'engine' && surface) {
      faults.push({ id: t.id, code: 'engine_tool_claims_a_surface', detail: { surface } });
    }
    if (surface && !provided.has(surface)) {
      faults.push({ id: t.id, code: 'surface_not_in_the_slice_set', detail: { surface, provided: [...provided] } });
    }
    if (t.status === 'adopted') {
      if (!t.evidence) faults.push({ id: t.id, code: 'adopted_without_evidence', detail: {} });
      if (!t.licence) faults.push({ id: t.id, code: 'adopted_without_licence', detail: {} });
    }
    if (t.status === 'rejected' && !t.why) {
      faults.push({ id: t.id, code: 'rejection_without_a_reason', detail: {} });
    }
  }

  const pick = (s: ToolStatus) => entries.filter((e) => e.status === s).map((e) => e.id);
  return { ok: faults.length === 0, faults, adopted: pick('adopted'), candidates: pick('candidate'), rejected: pick('rejected') };
}

/** which tools a slice may actually reach: the ones naming a surface it provides */
export function toolsForSlice(slice: { provides?: string[] }, entries: ToolEntry[]): ToolEntry[] {
  const surfaces = new Set(slice.provides ?? []);
  return entries.filter((t) => t.status === 'adopted' && t.holder === 'slice' && t.surface && surfaces.has(t.surface));
}
