import { describe, expect, it } from 'vitest';
import { roleForTask, resolveModelChoice, isFrontierEntitled, FRONTIER_MODEL, ECONOMY_MODEL } from './modelRouting';

describe('roleForTask', () => {
  it('sends a fresh generation to the frontier model by default', () => {
    expect(roleForTask({ preference: 'auto', isInitialGeneration: true })).toBe('frontier');
  });

  it('sends edits and repairs to the economy model', () => {
    expect(roleForTask({ preference: 'auto', isInitialGeneration: false })).toBe('economy');
    expect(roleForTask({ preference: 'auto', isInitialGeneration: true, isRepair: true })).toBe('economy');
  });

  it('honors explicit fast and quality preferences', () => {
    expect(roleForTask({ preference: 'fast', isInitialGeneration: true })).toBe('economy');
    expect(roleForTask({ preference: 'quality', isInitialGeneration: false })).toBe('frontier');
  });
});

describe('resolveModelChoice', () => {
  it('downgrades frontier when a free user has no key', () => {
    const choice = resolveModelChoice({ preference: 'quality', isInitialGeneration: true, plan: 'free', hasByok: false });
    expect(choice).toMatchObject({ requestedRole: 'frontier', role: 'economy', downgraded: true, entitled: false, model: ECONOMY_MODEL });
  });

  it('keeps frontier for a Pro plan', () => {
    const choice = resolveModelChoice({ preference: 'quality', isInitialGeneration: true, plan: 'pro', hasByok: false });
    expect(choice).toMatchObject({ role: 'frontier', downgraded: false, model: FRONTIER_MODEL });
  });

  it('keeps frontier for a free user with a BYOK key', () => {
    const choice = resolveModelChoice({ preference: 'quality', isInitialGeneration: true, plan: 'free', hasByok: true });
    expect(choice).toMatchObject({ role: 'frontier', entitled: true });
  });
});

describe('isFrontierEntitled', () => {
  it('accepts pro, team, and BYOK; rejects free without a key', () => {
    expect(isFrontierEntitled('pro', false)).toBe(true);
    expect(isFrontierEntitled('Team', false)).toBe(true);
    expect(isFrontierEntitled('free', true)).toBe(true);
    expect(isFrontierEntitled('free', false)).toBe(false);
    expect(isFrontierEntitled(undefined, false)).toBe(false);
  });
});
