import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, symlink } from 'node:fs/promises';
import path from 'node:path';
import { checkpoint, localDefinitions, atomicJson, json, within, createProject } from '../local-tools.mjs';

const temp = async () => { await mkdir('outputs/unit', { recursive: true }); return mkdtemp(path.resolve('outputs/unit/案例-')); };
const fixture = async () => {
  const root = await temp(); await mkdir(path.join(root, 'data'));
  await writeFile(path.join(root, 'game.rmmzproject'), 'RPGMZ 1.10.0');
  await atomicJson(path.join(root, 'data/System.json'), { gameTitle: '中文测试' });
  return root;
};
test('checkpoint retains original bytes and detects changed/added/removed files', async () => {
  const root = await fixture();
  const baseline = await readFile(path.join(root, 'data/System.json'));
  const result = await checkpoint(root, '初始');
  assert.deepEqual(await readFile(path.join(result.backupPath, 'data/System.json')), baseline);
  await atomicJson(path.join(root, 'data/System.json'), { gameTitle: '修改' });
  await atomicJson(path.join(root, 'data/Map001.json'), { width: 1 });
  const def = localDefinitions().find(x => x.name === 'mz_changes_since');
  assert.deepEqual(await def.handler({ projectPath: root }, { checkpointId: result.id }), {
    added: ['data/Map001.json'], changed: ['data/System.json'], removed: []
  });
  await assert.rejects(def.handler({ projectPath: root }, { checkpointId: '../escape' }), /Invalid checkpoint/);
});
test('data read schema refuses traversal and returns Chinese JSON intact', async () => {
  const root = await fixture(); const def = localDefinitions().find(x => x.name === 'mz_read_data');
  assert.equal(def.inputSchema.file.safeParse('../System.json').success, false);
  assert.equal((await def.handler({ projectPath: root }, { file: 'System.json' })).gameTitle, '中文测试');
  assert.equal(within(root, path.join(root, '..', 'other')), false);
});
test('create refuses existing destination without changing its contents', async () => {
  const root = await fixture();
  const original = await json(path.join(root, 'data/System.json'));
  await assert.rejects(createProject({ destination: root, title: 'Overwrite' }, {}), /EEXIST/);
  assert.deepEqual(await json(path.join(root, 'data/System.json')), original);
});
test('checkpoint refuses a junction pointing outside the project', async () => {
  const root = await fixture(); const outside = await temp();
  await symlink(outside, path.join(root, '.codex-mz'), 'junction');
  await assert.rejects(checkpoint(root, 'bad'), /escapes project root/);
});
test('editor preflight remains available for broken System.json and blocks launch before spawning', async () => {
  const root = await fixture();
  await writeFile(path.join(root, 'data/System.json'), '{');
  const check = localDefinitions().find(x => x.name === 'mz_check_editor_project');
  assert.equal(check.requiresProject, false);
  assert.equal((await check.handler({ projectPath: root })).ok, false);
  await writeFile(path.join(root, 'data/System.json'), '{}');
  const launch = localDefinitions().find(x => x.name === 'mz_open_editor');
  await assert.rejects(launch.handler({ projectPath: root }), /Editor preflight failed/);
});
