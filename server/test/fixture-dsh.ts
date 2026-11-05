#!/usr/bin/env -S npx tsx
/**
 * Test double for the `dsh` runtime.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
if (args.includes('--version')) {
  process.stdout.write('9.9.9-fixture\n');
  process.exit(0);
}

let task = '';
for await (const chunk of process.stdin) task += chunk;

if (args.includes('--from-default-profile')) {
  const profileIndex = args.indexOf('--profile');
  const profile = profileIndex >= 0 ? args[profileIndex + 1] : 'fixture';
  const home = process.env.DSH_HOME || path.join(process.cwd(), '.dsh');
  const dir = path.join(home, 'profiles', profile);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'cordis.yml'), '[]\n');
  process.stdout.write('- id: fixture\n');
  process.exit(0);
}

const files: Record<string, string> = {
  'pubspec.yaml': [
    'name: fixture_app',
    'description: Fixture app',
    'publish_to: "none"',
    'version: 1.0.0+1',
    'environment:',
    '  sdk: ">=3.3.0 <4.0.0"',
    'dependencies:',
    '  flutter:',
    '    sdk: flutter',
    '',
  ].join('\n'),
  'lib/main.dart': [
    "import 'package:flutter/material.dart';",
    '',
    'void main() => runApp(const FixtureApp());',
    '',
    'class FixtureApp extends StatelessWidget {',
    '  const FixtureApp({super.key});',
    '  @override',
    '  Widget build(BuildContext context) =>',
    "      const MaterialApp(home: Scaffold(body: Center(child: Text('Fixture OK'))));",
    '}',
    '',
  ].join('\n'),
};

function emit(event: Record<string, any>) {
  process.stdout.write(`${JSON.stringify(event)}\n`);
}

emit({ type: 'session', sessionId: 'session-fixture-1', cwd: process.cwd() });
emit({ type: 'status', phase: 'turn_start', turn: 1 });
emit({ type: 'status', phase: 'step_start', turn: 1, step: 1 });

let call = 0;
for (const [filePath, content] of Object.entries(files)) {
  call += 1;
  const callId = `call-${call}`;
  emit({ type: 'tool_call', callId, tool: 'write', input: { file_path: filePath, content } });
  const absolute = path.resolve(process.cwd(), filePath);
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, content, 'utf8');
  emit({ type: 'tool_result', callId, status: 'completed', result: `Created file ${filePath}` });
}

emit({ type: 'text', text: 'Created a fixture Flutter app.' });
emit({ type: 'status', phase: 'step_end', turn: 1, step: 1, usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } });
emit({ type: 'status', phase: 'turn_end', turn: 1, reason: { kind: 'completed' } });
emit({ type: 'final', text: `Fixture complete for: ${task.slice(0, 80)}` });
process.exit(0);
