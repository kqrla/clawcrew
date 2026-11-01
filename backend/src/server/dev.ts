import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { sqlSource } from '../plugins/sources/sql.js';
import { weeklyAuditor } from '../plugins/auditors/weekly.js';
import { PluginRegistry, configFor } from '../plugins/registry.js';

const plugins = [sqlSource(), weeklyAuditor()];
const registry = PluginRegistry.fromConfig(configFor(plugins), plugins);

const app = createApp({
  policy: { spendApprovalThresholdUsd: Number(process.env.ORCHART_SPEND_APPROVAL_USD ?? 50) },
  registry,
  // a three-level demo org, mirroring diagrams/org-model.svg
  seats: {
    'seat.content': {
      chain: [
        { id: 'root', ceiling: { tools: ['git.read', 'git.write', 'ci.run', 'ad.publish', 'asset.write', 'bank.read'], spendUsdPerDay: 500 } },
        { id: 'brand', ceiling: { tools: ['git.read', 'ad.publish', 'asset.write'], spendUsdPerDay: 120 } },
        { id: 'brand.social', ceiling: { tools: ['ad.publish', 'asset.write', 'brand.voice'], spendUsdPerDay: 40 } },
      ],
      grants: { tools: ['asset.write', 'ad.publish', 'bank.read'], spendUsdPerDay: 10 },
    },
  },
  objectives: [],
});

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`orchart backend on http://localhost:${info.port}`);
});
