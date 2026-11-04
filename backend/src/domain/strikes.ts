/**
 * docs/39. a limit that nothing counts is a wish. this is the count.
 *
 * one column on the seat, one row per refusal, so "why is this seat frozen" is a
 * query rather than an archaeology expedition.
 */
import { Verdict, consequence } from './gateway.js';

export const STRIKE_LIMIT = 2;

export interface SeatStanding {
  seat: string;
  strikes: number;
  state: 'active' | 'frozen' | 'burned';
  /** the last thing that earned a strike, for the person who has to unfreeze it */
  lastStrike?: { code: string; at: string; tool?: string };
}

export interface StrikeOutcome {
  standing: SeatStanding;
  /** did this refusal push the seat over the line */
  froze: boolean;
  /** why no strike was recorded, when none was */
  spared?: 'not_a_strike' | 'already_frozen' | 'burned';
}

export function applyVerdict(standing: SeatStanding, verdict: Verdict, now: string): StrikeOutcome {
  if (standing.state === 'burned') return { standing, froze: false, spared: 'burned' };
  if (standing.state === 'frozen') return { standing, froze: false, spared: 'already_frozen' };

  const c = consequence(verdict);
  if (!c.strike) return { standing, froze: false, spared: 'not_a_strike' };

  const strikes = standing.strikes + 1;
  const froze = strikes >= STRIKE_LIMIT;
  return {
    standing: {
      seat: standing.seat,
      strikes,
      state: froze ? 'frozen' : 'active',
      lastStrike: { code: verdict.code ?? 'unknown', at: now, tool: String(verdict.detail?.tool ?? '') },
    },
    froze,
  };
}

/** strikes are cleared by a person looking, not by time passing or by good behaviour */
export function clearStrikes(standing: SeatStanding): SeatStanding {
  // burn has no inverse, so clearing is not a way back from it
  if (standing.state === 'burned') return standing;
  return { seat: standing.seat, strikes: 0, state: 'active' };
}
