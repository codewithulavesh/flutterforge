import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compareVersions,
  sanitizeSdkConstraint,
  sanitizeFlutterConstraint,
  fixInvalidPlainScalars,
  findInvalidPlainScalar,
} from '../harness/pubspecFix.mjs';

test('compareVersions orders dotted versions segment-wise', () => {
  assert.ok(compareVersions('3.13.4', '3.24.0') < 0);
  assert.ok(compareVersions('3.24.0', '3.13.4') > 0);
  assert.equal(compareVersions('3.13.4', '3.13.4'), 0);
  assert.ok(compareVersions('4.0.0', '3.99.0') > 0);
});

test('sanitizeSdkConstraint resets an impossible lower bound (Flutter version in Dart field)', () => {
  const input = 'environment:\n  sdk: ">=3.24.0 <4.0.0"\n  flutter: "3.24.0"\n';
  const result = sanitizeSdkConstraint(input, { dartVersion: '3.13.4' });
  assert.ok(result.changed);
  assert.match(result.content, /^  sdk: '>=3\.0\.0 <4\.0\.0'$/m);
  assert.ok(!result.content.includes('sdk: sdk:'));
  assert.ok(result.note.includes('exceeds the installed Dart'));
});

test('sanitizeSdkConstraint widens an upper bound that excludes the installed SDK', () => {
  const input = "environment:\n  sdk: '>=3.4.0 <3.10.0'\n";
  const result = sanitizeSdkConstraint(input, { dartVersion: '3.13.4' });
  assert.ok(result.changed);
  assert.match(result.content, /^  sdk: '>=3\.0\.0 <4\.0\.0'$/m);
});

test('sanitizeSdkConstraint repairs unparsable junk', () => {
  const result = sanitizeSdkConstraint('environment:\n  sdk: "flutter"\n', { dartVersion: '3.13.4' });
  assert.ok(result.changed);
  assert.match(result.content, /sdk: '>=3\.0\.0 <4\.0\.0'/);
});

test('sanitizeSdkConstraint leaves valid constraints untouched', () => {
  for (const input of [
    'environment:\n  sdk: ">=3.0.0 <4.0.0"\n',
    "environment:\n  sdk: '>=3.3.0 <4.0.0'\n",
    'environment:\n  sdk: ^3.5.0\n',
  ]) {
    const result = sanitizeSdkConstraint(input, { dartVersion: '3.13.4' });
    assert.equal(result.changed, false, input);
    assert.equal(result.content, input);
  }
});

test('sanitizeSdkConstraint tolerates unknown installed version for valid bounds', () => {
  const result = sanitizeSdkConstraint('environment:\n  sdk: ">=3.5.0 <4.0.0"\n', {});
  assert.equal(result.changed, false);
});

test('sanitizeFlutterConstraint drops a pin the installed Flutter cannot satisfy', () => {
  const input = 'environment:\n  sdk: ">=3.0.0 <4.0.0"\n  flutter: "4.99.0"\n';
  const result = sanitizeFlutterConstraint(input, { flutterVersion: '3.47.5' });
  assert.ok(result.changed);
  assert.ok(!/^  flutter:/m.test(result.content));
  assert.ok(result.content.includes('sdk: ">=3.0.0 <4.0.0"'));
});

test('sanitizeFlutterConstraint keeps satisfiable pins and valid files', () => {
  for (const input of [
    'environment:\n  sdk: ">=3.0.0 <4.0.0"\n  flutter: "3.24.0"\n',
    'environment:\n  sdk: ">=3.0.0 <4.0.0"\n',
  ]) {
    const result = sanitizeFlutterConstraint(input, { flutterVersion: '3.47.5' });
    assert.equal(result.changed, false, input);
  }
});

test('sanitizeSdkConstraint leaves a bare upper bound alone', () => {
  const result = sanitizeSdkConstraint('environment:\n  sdk: "<4.0.0"\n', { dartVersion: '3.13.4' });
  assert.equal(result.changed, false);
});

test('fixInvalidPlainScalars quotes a description with a colon', () => {
  const input = 'name: my_app\ndescription: A pomodoro timer: 25 minutes\nversion: 1.0.0\n';
  const result = fixInvalidPlainScalars(input);
  assert.ok(result.changed);
  assert.match(result.content, /^description: 'A pomodoro timer: 25 minutes'$/m);
  // Untouched lines stay byte-identical.
  assert.match(result.content, /^name: my_app$/m);
  assert.match(result.content, /^version: 1\.0\.0$/m);
});

test('fixInvalidPlainScalars escapes single quotes it introduces', () => {
  const input = "description: Bob's timer: 25 min\n";
  const result = fixInvalidPlainScalars(input);
  assert.ok(result.changed);
  assert.match(result.content, /^description: 'Bob''s timer: 25 min'$/m);
});

test('fixInvalidPlainScalars leaves valid YAML untouched', () => {
  for (const input of [
    'description: "A timer: 25 minutes"\n',
    "description: 'A timer: 25 minutes'\n",
    'description: A timer for 25 minutes\n',
    'description: |\n  A timer: 25 minutes\n',
    'dependencies:\n  flutter:\n    sdk: flutter\n',
    '- list: item\n',
  ]) {
    const result = fixInvalidPlainScalars(input);
    assert.equal(result.changed, false, input);
  }
});

test('findInvalidPlainScalar reports the offending line or null', () => {
  const bad = findInvalidPlainScalar('description: A timer: 25 min\n');
  assert.ok(bad?.includes('description:'));
  assert.equal(findInvalidPlainScalar('description: "ok: yes"\nname: x\n'), null);
  assert.equal(findInvalidPlainScalar('name: x\n'), null);
});

test('sanitizers handle quoted values and missing environment blocks safely', () => {
  assert.equal(sanitizeSdkConstraint('name: my_app\ndependencies:\n  flutter:\n    sdk: flutter\n', { dartVersion: '3.13.4' }).changed, false);
});
