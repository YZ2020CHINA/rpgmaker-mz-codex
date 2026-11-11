import { build } from 'esbuild';
import { mkdir, cp, readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { localDefinitions } from '../local-tools.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'plugins/rpgmaker-mz-local');
await mkdir(out, { recursive: true });
await build({ entryPoints: [path.join(root, 'server.mjs')], outfile: path.join(out, 'server.mjs'),
  bundle: true, platform: 'node', target: 'node20', format: 'esm', packages: 'bundle',
  external: ['playwright-core'], legalComments: 'eof',
  banner: { js: "import { createRequire as __localCreateRequire } from 'node:module'; const require = __localCreateRequire(import.meta.url);" } });
for (const name of ['plugin.json', 'config.example.json', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'README.md'])
  await cp(path.join(root, name), path.join(out, name));
await cp(path.join(root, 'skills'), path.join(out, 'skills'), { recursive: true });
await cp(path.join(root, 'assets'), path.join(out, 'assets'), { recursive: true });
await cp(path.join(root, 'vendor/upstream/LICENSE'), path.join(out, 'UPSTREAM-LICENSE.txt'));
await mkdir(path.join(out, 'node_modules'), { recursive: true });
await cp(path.join(root, 'node_modules/playwright-core'), path.join(out, 'node_modules/playwright-core'), { recursive: true, dereference: true });
const manifest = { $schema: 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json', mcpServers: { 'rpgmaker-mz': { type: 'stdio', command: 'cmd.exe', args: ['/d', '/s', '/c', 'call', './launch-mcp.cmd'], cwd: './' } } };
// Codex requires a bare executable; install-plugin.ps1 rewrites launch-mcp.cmd with the local Node path.
await writeFile(path.join(out, 'launch-mcp.cmd'), '@echo off\r\nchcp 65001 >nul\r\nnode "%~dp0server.mjs"\r\n');
await writeFile(path.join(out, 'mcp.json'), JSON.stringify(manifest, null, 2));
const marketplace = { name: 'rpgmaker-mz-local-market', interface: { displayName: 'RPG Maker MZ 本地插件' }, plugins: [{ name: 'rpgmaker-mz-local', source: { source: 'local', path: './plugins/rpgmaker-mz-local' }, policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' }, category: 'Developer Tools' }] };
await mkdir(path.join(root, '.agents/plugins'), { recursive: true });
await writeFile(path.join(root, '.agents/plugins/marketplace.json'), JSON.stringify(marketplace, null, 2));
// Include runtime license texts for bundled JS, in addition to the retained source notices.
const notices = [];
for (const dir of await readdir(path.join(root, 'node_modules/.pnpm'))) {
  const container = path.join(root, 'node_modules/.pnpm', dir, 'node_modules');
  let children; try { children = await readdir(container, { withFileTypes: true }); } catch { continue; }
  for (const child of children) {
    if (!child.isDirectory()) continue;
    const packages = child.name.startsWith('@') ? (await readdir(path.join(container, child.name))).map(n => `${child.name}/${n}`) : [child.name];
    for (const pkg of packages) {
      const dir = path.join(container, pkg);
      for (const license of ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'license', 'LICENSE-MIT']) {
        try { const text = await readFile(path.join(dir, license), 'utf8'); notices.push(`=== ${pkg} ===\n${text}`); break; } catch {}
      }
    }
  }
}
await writeFile(path.join(out, 'DEPENDENCY-LICENSES.txt'), notices.join('\n\n'));
console.log(JSON.stringify({ runtime: out, tools: 128 + localDefinitions().length, portable: true, serverSha256: createHash('sha256').update(await readFile(path.join(out, 'server.mjs'))).digest('hex') }, null, 2));
