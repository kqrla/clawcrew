import { describe, expect, it } from 'vitest';
import { ScopedTool, consequence, judge } from '../src/domain/gateway.js';

/**
 * docs/38. the point of a guardrail is that it holds when the model does not want
 * it to, so every case here is a model trying something.
 */
// the grant scopes one string, `repo:branch`, because that is what a push actually
// addresses. `force` is not separately enforced, and pretending a scope covers an
// arg it never names would be worse than saying so.
const push: ScopedTool = { name: 'repo.push', surface: 'code.change', scopedArgs: ['repo'] };
const mail: ScopedTool = { name: 'inbox.reply', surface: 'support.inbox', scopedArgs: ['recipient'] };

const ctx = (over: Record<string, unknown> = {}) => ({
  seat: 'seat.code',
  surface: 'code.change',
  grant: { tools: ['repo.push'], spendUsdPerDay: 5 },
  scopes: { 'repo.push': ['kqrla/orchart:main'] },
  ...over,
});

describe('a guardrail holds when nobody is watching', () => {
  it('passes an argument that is inside the grant', () => {
    expect(judge({ tool: 'repo.push', args: { repo: 'kqrla/orchart:main' } }, push, ctx()).ok).toBe(true);
  });

  it('refuses a tool that is not in the grant, even though the catalogue has it', () => {
    const v = judge({ tool: 'inbox.reply', args: { recipient: 'a@b.c' } }, mail, ctx());
    expect(v).toMatchObject({ ok: false, code: 'tool_not_granted', fatal: true, escalate: true });
  });

  it('refuses a granted tool used from the wrong surface', () => {
    const v = judge({ tool: 'repo.push', args: {} }, push, ctx({ surface: 'design.asset' }));
    expect(v).toMatchObject({ ok: false, code: 'surface_not_held' });
    expect(v.detail).toEqual({ acting: 'design.asset', tool: 'repo.push', toolSurface: 'code.change' });
  });

  it('refuses a reach outside the granted scope: another repo, another branch, force', () => {
    const force = judge({ tool: 'repo.push', args: { repo: 'kqrla/orchart:main', force: true } }, push, ctx());
    expect(force.ok).toBe(true);
    const other = judge({ tool: 'repo.push', args: { repo: 'someone/else:main' } }, push, ctx());
    expect(other).toMatchObject({ ok: false, code: 'scope_outside_grant', escalate: true });
    expect(other.detail).toMatchObject({ value: 'someone/else:main' });
  });

  it('refuses a scoped tool reached with no scope on the grant at all', () => {
    const v = judge({ tool: 'repo.push', args: { repo: 'kqrla/orchart:main' } }, push, ctx({ scopes: {} }));
    expect(v).toMatchObject({ ok: false, code: 'scope_outside_grant', fatal: true });
  });

  it('refuses a scoped argument that is not a string, rather than coercing a shape it likes', () => {
    const v = judge({ tool: 'repo.push', args: { repo: { any: 'thing' } } }, push, ctx());
    expect(v).toMatchObject({ ok: false, code: 'arg_outside_scope' });
  });

  it('refuses the call that would cross the daily ceiling, and allows the one that lands on it', () => {
    const over = judge({ tool: 'repo.push', args: { repo: 'kqrla/orchart:main' } }, push, ctx({ spendUsedUsd: 4.9, spendPerCallUsd: 0.2 }));
    expect(over).toMatchObject({ ok: false, code: 'spend_not_reserved' });
    const exact = judge({ tool: 'repo.push', args: { repo: 'kqrla/orchart:main' } }, push, ctx({ spendUsedUsd: 4.8, spendPerCallUsd: 0.2 }));
    expect(exact.ok).toBe(true);
  });

  it('stops a seat that has already struck out, before it can try anything else', () => {
    const v = judge({ tool: 'repo.push', args: { repo: 'kqrla/orchart:main' } }, push, ctx({ strikes: 2 }));
    expect(v).toMatchObject({ ok: false, code: 'struck_out', fatal: true });
  });
});

describe('what the org does about a refusal', () => {
  it('freezes on reach, retries on arithmetic', () => {
    const reach = consequence(judge({ tool: 'inbox.reply', args: { recipient: 'a@b.c' } }, mail, ctx()));
    expect(reach).toMatchObject({ strike: true, freeze: true, retryable: false });

    const scope = consequence(judge({ tool: 'repo.push', args: { repo: 'x/y:main' } }, push, ctx()));
    expect(scope).toMatchObject({ strike: true, freeze: false, retryable: false });

    const spend = consequence(
      judge({ tool: 'repo.push', args: { repo: 'kqrla/orchart:main' } }, push, ctx({ spendUsedUsd: 9, spendPerCallUsd: 1 })),
    );
    expect(spend).toMatchObject({ strike: false, freeze: false, retryable: true });
  });
});
