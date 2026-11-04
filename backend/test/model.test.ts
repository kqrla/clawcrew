import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { createServer, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { ModelError, anthropic, fromEnv, openAICompatible, scripted } from '../src/ports/model.js';

/**
 * docs/42. a model is proven by what the adapter does with what comes back, and every
 * failure mode here is one a model really produces: prose instead of json, a call to a
 * tool it was not given, and silence.
 */
let server: Server;
let mode: 'good' | 'prose' | 'tool' | 'slow' = 'good';
let baseUrl = '';

beforeAll(async () => {
  server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      if (mode === 'slow') {
        setTimeout(() => res.end('{}'), 500);
        return;
      }
      const anthropicShape = req.url?.includes('/messages');
      const payload =
        mode === 'good'
          ? { outcome: 'advance', tool: 'inbox.reply', args: { recipient: 'inbox' }, reply: 'we sent a replacement', claims: [] }
          : mode === 'tool'
            ? { outcome: 'advance', tool: 'stripe.charge', args: { amount: 100 }, reply: 'charged', claims: [] }
            : 'I have replied to the customer and the matter is resolved.';
      const content = typeof payload === 'string' ? payload : JSON.stringify(payload);
      res.setHeader('content-type', 'application/json');
      res.end(
        JSON.stringify(
          anthropicShape ? { content: [{ type: 'text', text: content }] } : { choices: [{ message: { content } }] },
        ),
      );
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()));
});

const prompt = { task: { id: 'tkt.1', slice: 'support', kind: 'support' }, tools: ['inbox.reply'], claims: [] };

describe('a model answer becomes a proposal, or it becomes an error', () => {
  it('reads the call the model asked to make', async () => {
    mode = 'good';
    const p = await openAICompatible({ baseUrl, apiKey: 'k', model: 'm' }).propose(prompt);
    expect(p.outcome).toBe('advance');
    expect(p.calls).toEqual([{ tool: 'inbox.reply', args: { recipient: 'inbox' } }]);
    expect(p.artifacts?.[0]).toMatch(/^reply:/);
  });

  it('keeps a call to a tool it was never given, so the audit can refuse it', async () => {
    mode = 'tool';
    const p = await openAICompatible({ baseUrl, apiKey: 'k', model: 'm' }).propose(prompt);
    expect(p.calls[0]?.tool).toBe('stripe.charge');
  });

  it('refuses prose, because a paragraph is not a proposal', async () => {
    mode = 'prose';
    await expect(openAICompatible({ baseUrl, apiKey: 'k', model: 'm' }).propose(prompt)).rejects.toThrow(ModelError);
  });

  it('reads the anthropic shape too', async () => {
    mode = 'good';
    const p = await anthropic({ baseUrl, apiKey: 'k', model: 'm' }).propose(prompt);
    expect(p.calls[0]?.tool).toBe('inbox.reply');
  });

  it('gives up rather than hanging, and says it was time', async () => {
    mode = 'slow';
    await expect(
      openAICompatible({ baseUrl, apiKey: 'k', model: 'm', timeoutMs: 50 }).propose(prompt),
    ).rejects.toMatchObject({ code: 'timeout' });
  });

  it('refuses a server that is not there', async () => {
    await expect(
      openAICompatible({ baseUrl: 'http://127.0.0.1:1', apiKey: 'k', model: 'm' }).propose(prompt),
    ).rejects.toMatchObject({ code: 'http' });
  });
});

describe('which provider a machine actually has', () => {
  it('finds nothing when no key is set, and says so as null rather than pretending', () => {
    expect(fromEnv({})).toBeNull();
  });

  it('labels itself, so a template is never read as a model', async () => {
    const p = scripted();
    expect(p.label).toBe('scripted:no-key');
    const out = await p.propose({ ...prompt, task: { ...prompt.task, body: 'the seam is split' } as never });
    expect(out.calls[0]?.tool).toBe('inbox.reply');
  });
});
