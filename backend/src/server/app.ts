import { Hono } from 'hono';
import { z } from 'zod';
import { ChainLevel, effectiveHome } from '../domain/authority.js';
import { Action, PolicyConfig, gate } from '../domain/policy.js';
import { Objective, validateObjective } from '../domain/objectives.js';
import { PluginRegistry } from '../plugins/registry.js';

export interface AppDeps {
  policy: PolicyConfig;
  /** demo wiring; a real deployment reads these from postgres projections */
  seats: Record<string, { chain: ChainLevel[]; grants: { tools: string[]; spendUsdPerDay?: number } }>;
  objectives: Objective[];
  registry?: PluginRegistry;
}

const ActionSchema = z.object({
  verb: z.string().min(1),
  actorTier: z.string().min(1),
  surface: z
    .object({
      kind: z.enum(['repo_path', 'db_table', 'endpoint', 'domain', 'ad_account', 'bank_account', 'document', 'queue']),
      sensitivity: z.enum(['public', 'internal', 'sensitive']),
      ownerTier: z.string(),
    })
    .optional(),
  economic: z.object({ direction: z.enum(['in', 'out']), amountUsd: z.number() }).optional(),
  external: z.boolean().optional(),
  reversible: z.boolean().optional(),
  write: z.boolean().optional(),
  modelProposed: z.object({ cls: z.enum(['a0', 'a1', 'a2', 'a3', 'a4']), actor: z.string() }).optional(),
});

export function createApp(deps: AppDeps) {
  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true, abi: '1' }));

  app.get('/seats/:id/authority', (c) => {
    const seat = deps.seats[c.req.param('id')];
    if (!seat) return c.json({ error: 'unknown_seat' }, 404);
    const result = effectiveHome(seat.chain, seat.grants);
    return c.json({ seat: c.req.param('id'), ...result });
  });

  app.post('/policy/evaluate', async (c) => {
    const parsed = ActionSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: 'invalid_action', issues: parsed.error.issues }, 400);
    const { modelProposed, ...action } = parsed.data;
    const result = gate(action as Action, deps.policy, modelProposed);
    return c.json(result);
  });

  app.get('/objectives', (c) => c.json({ objectives: deps.objectives }));

  app.post('/objectives', async (c) => {
    const parsed = ObjectiveInput.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: 'invalid_objective', issues: parsed.error.issues }, 400);
    const objective = { ...parsed.data, version: 1 } as Objective;
    const errors = validateObjective(objective);
    if (errors.length > 0) return c.json({ error: 'invalid_objective', errors }, 422);
    deps.objectives.push(objective);
    return c.json({ objective }, 201);
  });

  app.get('/plugins', (c) => {
    if (!deps.registry) return c.json({ plugins: [] });
    return c.json({
      plugins: deps.registry.list().map((p) => ({ id: p.id, kind: p.kind, abi: p.abi })),
    });
  });

  return app;
}

const ObjectiveInput = z.object({
  id: z.string().min(1),
  parent: z.string().nullable(),
  ownerTier: z.string().min(1),
  statement: z.string().min(1),
  metric: z.string().min(1),
  source: z.string().min(1),
  baseline: z.number(),
  target: z.number(),
  deadline: z.string(),
  status: z.literal('active').default('active'),
  selfReported: z.boolean().optional(),
});
