// E2E probe: build a known-good minimal Flutter project through the preview
// pipeline to verify the full path reaches `running` and serves the app.
const PROJECT = 'e2e-minimal-probe';
const BASE = 'http://127.0.0.1:8787';

const files = [
  {
    path: 'pubspec.yaml',
    content: `name: minimal_probe
description: Minimal E2E probe app
publish_to: 'none'
version: 1.0.0

environment:
  sdk: ">=3.0.0 <4.0.0"

dependencies:
  flutter:
    sdk: flutter

flutter:
  uses-material-design: true
`,
  },
  {
    path: 'lib/main.dart',
    content: `import 'package:flutter/material.dart';

void main() => runApp(const MinimalApp());

class MinimalApp extends StatelessWidget {
  const MinimalApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Minimal Probe',
      theme: ThemeData(colorSchemeSeed: Colors.teal, useMaterial3: true),
      home: const CounterPage(),
    );
  }
}

class CounterPage extends StatefulWidget {
  const CounterPage({super.key});

  @override
  State<CounterPage> createState() => _CounterPageState();
}

class _CounterPageState extends State<CounterPage> {
  int _count = 0;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Minimal Probe')),
      body: Center(child: Text('Count: $_count', style: Theme.of(context).textTheme.headlineMedium)),
      floatingActionButton: FloatingActionButton(
        onPressed: () => setState(() => _count++),
        child: const Icon(Icons.add),
      ),
    );
  }
}
`,
  },
];

const t0 = Date.now();
const res = await fetch(`${BASE}/api/preview/${PROJECT}/build`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ files, userId: PROJECT }),
});
const body = await res.text();
console.log(`build POST → HTTP ${res.status} (${((Date.now() - t0) / 1000).toFixed(1)}s): ${body.slice(0, 200)}`);
let sessionId;
try { sessionId = JSON.parse(body).sessionId; } catch {}
if (!sessionId) process.exit(1);

let last = '';
for (let i = 0; i < 320; i++) {
  await new Promise((r) => setTimeout(r, 1500));
  const s = await fetch(`${BASE}/api/preview/${sessionId}/status`);
  const data = await s.json().catch(() => null);
  if (!data) continue;
  if (data.status !== last) {
    last = data.status;
    const tail = (data.logs || []).slice(-1)[0] || '';
    console.log(`poll ${i}: ${data.status} ${tail.slice(0, 110)}`);
  }
  if (['running', 'failed', 'stopped'].includes(data.status)) {
    console.log(`final: ${JSON.stringify({ status: data.status, url: data.url, port: data.port })}`);
    if (data.status === 'failed') console.log('last logs:\n' + (data.logs || []).slice(-8).join('\n'));
    break;
  }
}
