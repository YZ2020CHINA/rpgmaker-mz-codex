import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const runtime = path.resolve(process.env.MZ_TEST_RUNTIME || 'plugins/rpgmaker-mz-local/server.mjs');
const out = path.resolve('outputs'); await mkdir(out, { recursive: true });
const destination = path.join(out, `中文验证工程-${Date.now()}`);
const transport = new StdioClientTransport({ command: process.execPath, args: [runtime], stderr: 'pipe' });
const client = new Client({ name: 'rpgmaker-mz-integration', version: '1.0' });
let errors = ''; transport.stderr?.on('data', x => { errors += x; });
const evidence = { runtime, startedAt: new Date().toISOString(), checks: [] };
async function call(name, args = {}) {
  const response = await client.callTool({ name, arguments: args }, undefined, { timeout: 300000, resetTimeoutOnProgress: true });
  assert.equal(response.isError, undefined, `${name}: ${response.content?.[0]?.text}`);
  return JSON.parse(response.content[0].text);
}
try {
  await client.connect(transport);
  const tools = await client.listTools(); assert.equal(tools.tools.length, 138);
  assert.ok(tools.tools.some(t => t.name === 'mz_check_editor_project'));
  assert.ok(tools.tools.some(t => t.name === 'mz_update_plugin'));
  evidence.checks.push({ name: 'MCP initialize and tool discovery', count: tools.tools.length });
  assert.equal((await call('get_project')).valid, false);
  const install = await call('mz_installation'); assert.equal(install.installed, true);
  evidence.install = install;
  const created = await call('mz_create_project', { destination, title: 'Codex 中文验证小镇', locale: 'zh_CN' });
  evidence.project = created;
  assert.equal((await call('mz_check_editor_project')).ok, true);
  const manifestPath = path.join(destination, 'js/plugins.js');
  const manifestBefore = await readFile(manifestPath, 'utf8');
  const previewPlugin = await call('mz_update_plugin', { name: 'DisabledTest', enabled: false, parameters: { message: '中文参数' }, dryRun: true });
  assert.equal(previewPlugin.dryRun, true);
  assert.equal(await readFile(manifestPath, 'utf8'), manifestBefore);
  await call('mz_update_plugin', { name: 'DisabledTest', enabled: false, parameters: { message: '中文参数' } });
  assert.equal((await call('mz_check_editor_project')).ok, true);
  evidence.checks.push({ name: 'Editor preflight and safe plugin manifest update/dryRun', passed: true });
  assert.equal((await call('get_project')).projectPath, destination);
  const sys = await call('mz_read_data', { file: 'System.json' }); assert.equal(sys.locale, 'zh_CN');
  const map = await call('mz_read_data', { file: 'Map001.json' });
  assert.equal(map.data.length, map.width * map.height * 6);
  const tiles = await call('find_tile', { tilesetId: map.tilesetId, query: 'Grassland' });
  const tile = tiles.matches.find(t => !t.transparent); assert.ok(tile, JSON.stringify(tiles));
  const before = await readFile(path.join(destination, 'data/Map001.json'), 'utf8');
  const preview = await call('fill_area', { mapId: 1, x: 0, y: 0, width: map.width, height: map.height, tileId: tile.tileId, dryRun: true });
  assert.equal(preview.dryRun, true); assert.equal(await readFile(path.join(destination, 'data/Map001.json'), 'utf8'), before);
  await call('fill_area', { mapId: 1, x: 0, y: 0, width: map.width, height: map.height, tileId: tile.tileId });
  const npc = await call('create_npc', { mapId: 1, x: 8, y: 5, name: '向导', characterName: 'Actor1', characterIndex: 0, text: ['你好，欢迎来到验证小镇！', 'Codex 已经连上 RPG Maker MZ。'], speakerName: '向导' });
  evidence.npc = npc;
  const checkpoints = await call('mz_list_checkpoints'); assert.ok(checkpoints.length >= 1);
  const mapCheckpoint = (await Promise.all(checkpoints.map(async c => ({ ...c, map: await readFile(path.join(destination, '.codex-mz/backups', c.id, 'data/Map001.json'), 'utf8') })))).find(c => c.map === before);
  assert.ok(mapCheckpoint, 'a pre-paint checkpoint must retain the original map');
  const changes = await call('mz_changes_since', { checkpointId: mapCheckpoint.id }); assert.ok(changes.changed.includes('data/Map001.json'));
  evidence.checks.push({ name: 'Chinese project, dryRun, painting, NPC, automatic checkpoint and file changes', changes });
  const invalid = await client.callTool({ name: 'mz_read_data', arguments: { file: '../package.json' } }); assert.equal(invalid.isError, true);
  const validation = await call('validate_project'); const refs = await call('validate_references'); assert.equal(refs.ok, true);
  evidence.validation = { validation, refs };
  const render = await call('render_map', { mapId: 1, out: path.join(out, 'map-preview.png') });
  evidence.render = render; assert.equal(render.problems?.length ?? 0, 0, JSON.stringify(render));
  const play = await call('run_playtest', { out: path.join(out, 'playtest'), steps: [
    { action: 'load', mapId: 1, x: 8, y: 7, direction: 'up' },
    { action: 'walk', direction: 'up', steps: 1 },
    { action: 'press', button: 'ok' },
    { action: 'wait', ms: 900 },
    { action: 'screenshot', name: '中文NPC对话' },
    { action: 'advanceText' }
  ] });
  evidence.playtest = play;
  assert.equal(play.problems?.length ?? 0, 0, JSON.stringify(play));
  assert.ok(JSON.stringify(play).includes('欢迎来到验证小镇'), 'NPC must be reached and show Chinese dialogue');
  for (const step of play.steps ?? []) assert.notEqual(step.ok, false, JSON.stringify(step));
  evidence.checks.push({ name: 'Engine-rendered map and real player interaction with Chinese NPC', passed: true });
  if (process.env.MZ_TEST_LAUNCH === '1') {
    evidence.editorLaunch = await call('mz_open_editor');
    evidence.nwjsLaunch = await call('mz_launch_playtest');
    assert.equal(evidence.editorLaunch.launched, true);
    assert.equal(evidence.nwjsLaunch.launched, true);
  }
  evidence.passed = true;
} catch (error) { evidence.passed = false; evidence.error = error.stack; process.exitCode = 1; }
finally { await client.close().catch(() => {}); evidence.stderr = errors; await writeFile(path.join(out, 'verification.json'), JSON.stringify(evidence, null, 2)); console.log(JSON.stringify(evidence, null, 2)); }
