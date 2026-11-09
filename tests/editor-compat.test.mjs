import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, symlink } from 'node:fs/promises';
import path from 'node:path';
import { checkEditorProject, parsePluginManifest, serializePluginManifest, updatePluginManifest } from '../editor-compat.mjs';
const record = (name, status = true) => ({ name, status, description: '中文说明', parameters: { kept: '原值' }, custom: { retained: true } });
async function fixture() {
  await mkdir('outputs/editor-tests', { recursive: true });
  const root = await mkdtemp(path.resolve('outputs/editor-tests/工程-'));
  for (const dir of ['data', 'js/plugins']) await mkdir(path.join(root, dir), { recursive: true });
  for (const [file, value] of Object.entries({ 'game.rmmzproject': 'RPGMZ 1.0.0', 'data/System.json': '{}', 'data/MapInfos.json': '[null]', 'package.json': '{}', 'index.html': '<html/>', 'js/main.js': '// main', 'js/rmmz_core.js': '// core', 'js/plugins/Test.js': '// fixture plugin', 'js/plugins.js': serializePluginManifest([record('Test')]) })) await writeFile(path.join(root, file), value);
  return root;
}
test('native empty/Chinese manifests, BOM and CRLF parse without executing JS', () => {
  for (const records of [[], [record('测试')]]) {
    const source = serializePluginManifest(records);
    assert.deepEqual(parsePluginManifest(source), records);
    assert.deepEqual(parsePluginManifest('\uFEFF' + source.replaceAll('\n', '\r\n')), records);
  }
  assert.throws(() => parsePluginManifest('var $plugins = []; process.exit(1);'), /arbitrary JavaScript/);
  assert.throws(() => parsePluginManifest('var $plugins = [malicious()];'));
  assert.throws(() => parsePluginManifest('var $plugins = [{"name":"x"}];'));
  assert.throws(() => serializePluginManifest([record('../escape')]));
  assert.throws(() => serializePluginManifest([record('Test'), record('test')]));
});
test('preflight catches runtime-valid single-line manifests and missing enabled files', async () => {
  const root = await fixture();
  assert.equal((await checkEditorProject(root)).ok, true);
  await writeFile(path.join(root, 'js/plugins.js'), 'var $plugins = ' + JSON.stringify([record('Test')]) + ';');
  let report = await checkEditorProject(root);
  assert.equal(report.ok, false); assert.match(report.errors[0].message, /native MZ/);
  await updatePluginManifest(root);
  assert.equal((await checkEditorProject(root)).ok, true);
  await writeFile(path.join(root, 'js/plugins.js'), serializePluginManifest([record('Missing')]));
  report = await checkEditorProject(root);
  assert.equal(report.ok, false); assert.equal(report.errors[0].file, 'js/plugins/Missing.js');
  await writeFile(path.join(root, 'js/plugins.js'), serializePluginManifest([record('Missing', false)]));
  assert.equal((await checkEditorProject(root)).ok, true);
  await writeFile(path.join(root, 'data/System.json'), '{');
  assert.equal((await checkEditorProject(root)).errors[0].file, 'data/System.json');
});
test('updates preserve order, unknown fields, disabled entries and parameter keys; dryRun makes no backup/write', async () => {
  const root = await fixture(), file = path.join(root, 'js/plugins.js');
  await writeFile(file, serializePluginManifest([record('Disabled', false), record('Test')]));
  const original = await readFile(file, 'utf8'); let backups = 0;
  const beforeWrite = async () => { backups++; assert.equal(await readFile(file, 'utf8'), original); return { id: 'backup' }; };
  const args = { name: 'Test', parameters: { added: '新值' }, description: '新说明' };
  const dry = await updatePluginManifest(root, { ...args, dryRun: true }, beforeWrite);
  assert.equal(dry.changed, true); assert.equal(backups, 0); assert.equal(await readFile(file, 'utf8'), original);
  const applied = await updatePluginManifest(root, args, beforeWrite);
  assert.equal(backups, 1); assert.equal(applied.checkpoint.id, 'backup');
  const entries = parsePluginManifest(await readFile(file, 'utf8'));
  assert.deepEqual(entries.map(e => e.name), ['Disabled', 'Test']);
  assert.deepEqual(entries[1].parameters, { kept: '原值', added: '新值' }); assert.deepEqual(entries[1].custom, { retained: true });
  assert.equal((await updatePluginManifest(root, args, async () => { throw Error('unexpected backup'); })).changed, false);
});
test('missing enabled scripts, unsafe names and nonliteral JS refuse write', async () => {
  const root = await fixture(), file = path.join(root, 'js/plugins.js');
  const original = await readFile(file, 'utf8');
  await assert.rejects(updatePluginManifest(root, { name: 'Missing', enabled: true }));
  await assert.rejects(updatePluginManifest(root, { name: '../outside', enabled: false }));
  await assert.rejects(updatePluginManifest(root, { enabled: false }), /name is required/);
  assert.equal(await readFile(file, 'utf8'), original);
  await writeFile(file, 'var $plugins = []; throw Error("must not execute");');
  await assert.rejects(updatePluginManifest(root), /arbitrary JavaScript/);
});
test('refuses files escaping root through directory junctions', async () => {
  const root = await fixture(), outside = await fixture();
  await symlink(path.join(outside, 'js/plugins'), path.join(root, 'linked'), 'junction');
  const { projectFile } = await import('../editor-compat.mjs');
  await assert.rejects(projectFile(root, 'linked/Test.js'), /escapes project root/);
});
test('concurrent manifest change after backup is preserved instead of overwritten', async () => {
  const root = await fixture(), file = path.join(root, 'js/plugins.js');
  const external = serializePluginManifest([record('Test'), record('Other', false)]);
  await assert.rejects(updatePluginManifest(root, { name: 'Test', description: 'changed' }, async () => { await writeFile(file, external); }), /changed during preparation/);
  assert.equal(await readFile(file, 'utf8'), external);
});
