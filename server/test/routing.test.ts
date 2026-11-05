import test from 'node:test';
import assert from 'node:assert/strict';
import { routeGeneration, publicRoute, FRONTIER_MODEL, ECONOMY_MODEL, MANAGED_MODEL } from '../routing.js';

test('downgrades frontier to economy when nothing entitles it', () => {
  const route = routeGeneration({ role: 'frontier', plan: 'free', credentials: {} });
  assert.equal(route.requestedRole, 'frontier');
  assert.equal(route.role, 'economy');
  assert.equal(route.downgraded, true);
  assert.equal(route.entitled, false);
  assert.equal(route.provider, 'deepseek-account');
  assert.equal(route.model, MANAGED_MODEL);
  assert.match(route.reason, /frontier/i);
});

test('uses the stored OpenRouter key for frontier work', () => {
  const route = routeGeneration({ role: 'frontier', plan: 'free', credentials: { openrouter: 'sk-or-stored-key' } });
  assert.equal(route.role, 'frontier');
  assert.equal(route.downgraded, false);
  assert.equal(route.provider, 'openrouter');
  assert.equal(route.model, FRONTIER_MODEL);
  assert.equal(route.apiKey, 'sk-or-stored-key');
  assert.equal(route.keySource, 'stored');
  assert.equal(route.entitled, true);
});

test('a Pro plan still needs a configured key before it can reach frontier', () => {
  const route = routeGeneration({ role: 'frontier', plan: 'pro', credentials: {} });
  assert.equal(route.role, 'economy');
  assert.equal(route.downgraded, true);
  assert.equal(route.provider, 'deepseek-account');
  assert.match(route.reason, /frontier/i);
});

test('a Pro plan with a managed engine key reaches the frontier model', () => {
  const route = routeGeneration({ role: 'frontier', plan: 'pro', credentials: { openrouter: 'sk-or-engine-key' } });
  assert.equal(route.role, 'frontier');
  assert.equal(route.downgraded, false);
  assert.equal(route.entitled, true);
});

test('economy requests never get the frontier model', () => {
  const route = routeGeneration({ role: 'economy', plan: 'pro', credentials: { openrouter: 'sk-or-stored-key' } });
  assert.equal(route.role, 'economy');
  assert.equal(route.model, ECONOMY_MODEL);
});

test('a request-scoped OpenRouter key wins and unlocks frontier even on free', () => {
  const route = routeGeneration({ role: 'frontier', plan: 'free', requestKey: 'sk-or-live-key', credentials: {} });
  assert.equal(route.provider, 'openrouter');
  assert.equal(route.model, FRONTIER_MODEL);
  assert.equal(route.keySource, 'request');
  assert.equal(route.downgraded, false);
});

test('a DeepSeek-only key downgrades frontier honestly instead of faking a model change', () => {
  const route = routeGeneration({ role: 'frontier', plan: 'free', credentials: { deepseek: 'sk-deepseek-key' } });
  assert.equal(route.role, 'economy');
  assert.equal(route.downgraded, true);
  assert.equal(route.provider, 'deepseek-official');
  assert.equal(route.model, MANAGED_MODEL);
  assert.equal(route.apiKey, 'sk-deepseek-key');
});

test('a saved model name is honored when it is safe', () => {
  const route = routeGeneration({ role: 'frontier', plan: 'pro', requestedModel: 'nvidia/custom-model', credentials: { openrouter: 'sk-or-engine-key' } });
  assert.equal(route.model, 'nvidia/custom-model');
});

test('publicRoute strips the secret', () => {
  const route = routeGeneration({ role: 'frontier', plan: 'pro', credentials: { openrouter: 'sk-or-secret-value' } });
  const safe = publicRoute(route);
  assert.equal(safe.apiKey, undefined);
  assert.equal(safe.role, 'frontier');
  assert.equal(JSON.stringify(safe).includes('sk-'), false);
});

