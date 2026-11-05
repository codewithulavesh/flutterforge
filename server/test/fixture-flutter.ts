#!/usr/bin/env -S npx tsx
/**
 * Test double for the Flutter SDK.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);

if (args.includes('--version')) {
  process.stdout.write('Flutter 9.9.9-fixture • fixture\n');
  process.exit(0);
}

if (args[0] === 'create') {
  const target = args[args.length - 1];
  const web = path.join(target, 'web');
  await fs.mkdir(web, { recursive: true });
  await fs.writeFile(
    path.join(web, 'index.html'),
    '<!DOCTYPE html><html><body><script src="flutter_bootstrap.js"></script></body></html>\n',
    'utf8',
  );
  process.stdout.write('Created fixture web runner\n');
  process.exit(0);
}

if (args[0] === 'pub') {
  process.stdout.write('Resolving dependencies (fixture)...\n');
  process.exit(0);
}

if (args[0] === 'build' && args[1] === 'web') {
  const out = path.join(process.cwd(), 'build', 'web');
  await fs.mkdir(path.join(out, 'assets'), { recursive: true });
  await fs.writeFile(
    path.join(out, 'index.html'),
    '<!DOCTYPE html><html><body><h1>PREVIEW_OK</h1></body></html>\n',
    'utf8',
  );
  await fs.writeFile(path.join(out, 'flutter_bootstrap.js'), '// fixture\n', 'utf8');
  process.stdout.write('✓ Built build/web\n');
  process.exit(0);
}

if (args[0] === 'run') {
  const http = await import('node:http');
  const portIndex = args.indexOf('--web-port');
  const port = portIndex >= 0 ? Number(args[portIndex + 1]) : 8080;
  http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<!DOCTYPE html><html><body><h1>PREVIEW_OK</h1></body></html>');
  }).listen(port, '127.0.0.1', () => {
    process.stdout.write(`lib/main.dart is being served at http://127.0.0.1:${port}/\n`);
  });
  setInterval(() => {}, 60_000);
} else {
  process.stderr.write(`fixture flutter: unsupported args ${args.join(' ')}\n`);
  process.exit(1);
}
