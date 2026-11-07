/** docs/50 addendum. their avatars, not mine: the package is the product, this is the mount. */
import { createRoot } from 'react-dom/client';
import { BotAvatar, BotAvatarType } from 'bot-avatars';

const TYPES: BotAvatarType[] = [
  'clover', 'flower', 'triangle', 'square', 'blob', 'ghost', 'circle', 'drop', 'star',
  'droid', 'mech', 'alien', 'hexagon', 'cat', 'cloud', 'pill', 'pebble', 'puddle',
];

function typeFor(id: string): BotAvatarType {
  let h = 2166136261;
  for (let i = 0; i < id.length; i += 1) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); }
  return TYPES[(h >>> 0) % TYPES.length]!;
}

function mount(): void {
  for (const host of Array.from(document.querySelectorAll('[data-bot]')) as HTMLElement[]) {
    const id = host.dataset.bot!;
    const state = (host.dataset.state as 'default' | 'working' | 'sleeping') ?? 'default';
    host.innerHTML = '';
    createRoot(host).render(
      <BotAvatar type={typeFor(id)} size={30} state={state} interactive={false} seed={0.37} />,
    );
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
else mount();
