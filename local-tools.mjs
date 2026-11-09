import { readFile, writeFile, mkdir, readdir, lstat, realpath, cp, rename, access } from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { z } from 'zod';
import { checkEditorProject, updatePluginManifest } from './editor-compat.mjs';

const exec = promisify(execFile);
const DEFAULT_INSTALL = 'D:\\steam\\steamapps\\common\\RPG Maker MZ';
export async function exists(p) { try { await access(p); return true; } catch { return false; } }
export async function json(p) { return JSON.parse((await readFile(p, 'utf8')).replace(/^\uFEFF/, '')); }
export async function atomicJson(p, value) {
  const tmp = `${p}.${randomUUID()}.tmp`;
  await writeFile(tmp, JSON.stringify(value), { flag: 'wx' });
  await rename(tmp, p);
}
export function within(root, child) {
  const rel = path.relative(root, child);
  return rel === '' || (!rel.startsWith(`..${path.sep}`) && rel !== '..' && !path.isAbsolute(rel));
}
export async function installation(config = {}) {
  const root = path.resolve(process.env.RPGMAKER_MZ_INSTALL || config.installPath || DEFAULT_INSTALL);
  const exe = path.join(root, 'RPGMZ.exe');
  const core = path.join(root, 'newdata/js/rmmz_core.js');
  const coreText = await readFile(core, 'utf8').catch(() => '');
  return { installPath: root, editorPath: exe, installed: await exists(exe),
    engineVersion: coreText.match(/rmmz_core\.js v([^\s]+)/)?.[1] ?? null,
    templatePath: path.join(root, 'newdata'), nwjsPath: path.join(root, 'nwjs-win/nw.exe'),
    chromiumPath: config.chromiumPath || process.env.RPGMAKER_MCP_CHROMIUM || null,
    connectionMode: 'project-files; editor reopened to load external changes',
    editorLiveAutomation: false };
}
export async function requireProject(root) {
  if (!root) throw new Error('No project selected. Call set_project or mz_create_project.');
  const p = await realpath(root);
  if (!await exists(path.join(p, 'game.rmmzproject'))) throw new Error('Missing game.rmmzproject');
  await json(path.join(p, 'data/System.json'));
  return p;
}
async function rejectInstallProject(root, config) {
  const install = await realpath((await installation(config)).installPath).catch(() => path.resolve(DEFAULT_INSTALL));
  if (within(install, root)) throw new Error('The MZ installation and templates cannot be used as a game project.');
}
export async function filesUnder(root, prefix = '') {
  const result = [];
  for (const item of await readdir(path.join(root, prefix), { withFileTypes: true })) {
    const rel = path.join(prefix, item.name);
    const stat = await lstat(path.join(root, rel));
    if (stat.isSymbolicLink()) throw new Error(`Symlinks/junctions are not supported in project operations: ${rel}`);
    if (stat.isDirectory()) result.push(...await filesUnder(root, rel));
    else if (stat.isFile()) result.push(rel);
  }
  return result.sort();
}
async function hashes(root) {
  const entries = [];
  for (const folder of ['data', 'js/plugins']) {
    if (!await exists(path.join(root, folder))) continue;
    for (const file of await filesUnder(path.join(root, folder))) {
      const rel = path.join(folder, file).replaceAll('\\', '/');
      entries.push([rel, createHash('sha256').update(await readFile(path.join(root, rel))).digest('hex')]);
    }
  }
  for (const rel of ['game.rmmzproject', 'js/plugins.js', 'package.json']) {
    if (await exists(path.join(root, rel))) entries.push([rel, createHash('sha256').update(await readFile(path.join(root, rel))).digest('hex')]);
  }
  return Object.fromEntries(entries);
}
export async function createProject({ destination, title, locale = 'zh_CN' }, config) {
  const target = path.resolve(destination);
  await rejectInstallProject(target, config);
  // mkdir without recursive refuses an existing directory, including an empty one.
  const parent = await realpath(path.dirname(target));
  const install = await installation(config);
  if (!install.installed) throw new Error(`MZ not installed: ${install.editorPath}`);
  const templateFiles = await filesUnder(install.templatePath);
  if (!templateFiles.includes(path.join('data', 'System.json'))) throw new Error('Invalid MZ template');
  const canonicalTarget = path.join(parent, path.basename(target));
  await rejectInstallProject(canonicalTarget, config);
  await mkdir(canonicalTarget);
  // Only the new directory is written. Partial failures retain it for inspection.
  for (const rel of templateFiles) {
    await mkdir(path.dirname(path.join(canonicalTarget, rel)), { recursive: true });
    await cp(path.join(install.templatePath, rel), path.join(canonicalTarget, rel), { force: false, errorOnExist: true });
  }
  const sys = await json(path.join(canonicalTarget, 'data/System.json'));
  sys.gameTitle = title; sys.locale = locale;
  // The Steam template predates the 1.10 runtime accessor; the editor normally supplies this default.
  sys.advanced.windowOpacity ??= 192;
  sys.advanced.gameId = Math.floor(10000000 + Math.random() * 89999999);
  await atomicJson(path.join(canonicalTarget, 'data/System.json'), sys);
  const mapInfos = await json(path.join(canonicalTarget, 'data/MapInfos.json'));
  for (const info of mapInfos.filter(Boolean)) {
    const p = path.join(canonicalTarget, `data/Map${String(info.id).padStart(3, '0')}.json`);
    const m = await json(p);
    // Steam newdata stores editor placeholders [] for an empty tile plane.
    if (Array.isArray(m.data) && m.data.length === 0) {
      m.data = Array(m.width * m.height * 6).fill(0); await atomicJson(p, m);
    }
  }
  // Project format version is independent of the core-script version.
  await writeFile(path.join(canonicalTarget, 'game.rmmzproject'), 'RPGMZ 1.0.0', { flag: 'wx' });
  await atomicJson(path.join(canonicalTarget, 'package.json'), {
    name: 'rmmz-game', main: 'index.html', 'chromium-args': '--force-color-profile=srgb',
    window: { title, width: 816, height: 624, position: 'center', icon: 'icon/icon.png' }
  });
  return { projectPath: canonicalTarget, gameTitle: title, locale, engineVersion: install.engineVersion,
    notice: 'New maps are blank; paint an opaque ground layer and verify passability before playing.' };
}
export async function checkpoint(root, label, config = {}) {
  root = await requireProject(root);
  await rejectInstallProject(root, config);
  const id = `${new Date().toISOString().replaceAll(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;
  for (const dir of ['.codex-mz', '.codex-mz/backups']) {
    const candidate = path.join(root, dir);
    if (await exists(candidate) && !within(root, await realpath(candidate))) throw new Error('Backup directory escapes project root');
  }
  const destination = path.join(root, '.codex-mz/backups', id);
  await mkdir(destination, { recursive: true });
  const manifest = { id, label, createdAt: new Date().toISOString(), projectPath: root, files: await hashes(root) };
  for (const rel of Object.keys(manifest.files)) {
    const real = await realpath(path.join(root, rel));
    if (!within(root, real)) throw new Error(`Project file escapes root: ${rel}`);
    await mkdir(path.dirname(path.join(destination, rel)), { recursive: true });
    await cp(real, path.join(destination, rel), { errorOnExist: true, force: false });
  }
  await atomicJson(path.join(destination, 'manifest.json'), manifest);
  return { id, backupPath: destination, fileCount: Object.keys(manifest.files).length,
    scope: 'data, js/plugins, js/plugins.js, game.rmmzproject, package.json; media/save files excluded' };
}
async function readCheckpoint(root, id) {
  if (!/^[\w.-]+$/.test(id)) throw new Error('Invalid checkpoint id');
  const backups = await realpath(path.join(root, '.codex-mz/backups'));
  if (!within(root, backups)) throw new Error('Backup directory escapes project root');
  const file = await realpath(path.join(backups, id, 'manifest.json'));
  if (!within(backups, file)) throw new Error('Checkpoint escapes backup directory');
  const manifest = await json(file);
  if (manifest.projectPath !== root) throw new Error('Checkpoint belongs to a different project');
  return manifest;
}
async function launch(executable, args, cwd) {
  if (!await exists(executable)) throw new Error(`Executable missing: ${executable}`);
  // These are user-facing interactive editors, so request a visible window.
  const child = spawn(executable, args, { cwd, shell: false, detached: true, stdio: 'ignore', windowsHide: false });
  await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
  await new Promise((resolve, reject) => {
    const onExit = (code, signal) => { clearTimeout(timer); reject(new Error(`Application exited during startup (code=${code}, signal=${signal})`)); };
    const timer = setTimeout(() => { child.off('exit', onExit); resolve(); }, 1500);
    child.once('exit', onExit);
  });
  child.unref();
  return { pid: child.pid, executable, args, launched: true, observedWindow: false };
}
async function processes() {
  if (process.platform !== 'win32') return [];
  const { stdout } = await exec('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    "Get-CimInstance Win32_Process -Filter \"Name='RPGMZ.exe' OR Name='nw.exe'\" | Select-Object ProcessId,Name,CommandLine | ConvertTo-Json -Compress"], { windowsHide: true, timeout: 15000 });
  if (!stdout.trim()) return [];
  const parsed = JSON.parse(stdout); return Array.isArray(parsed) ? parsed : [parsed];
}
export function localDefinitions(config = {}) {
  return [
    { name: 'mz_check_editor_project', requiresProject: false, description: 'Read-only editor preflight: validate project marker/core JSON, native plugins.js layout, literal plugin records and enabled script files. Does not execute game code or confirm editor loading.', inputSchema: {},
      handler: ctx => { if (!ctx.projectPath) throw new Error('No project selected. Call set_project or mz_create_project.'); return checkEditorProject(ctx.projectPath); } },
    { name: 'mz_update_plugin', mutates: true, description: 'Safely upsert one plugin in js/plugins.js or normalize its native MZ layout if no fields are provided. Preserves order, other records and existing parameter keys. Literal JSON manifests only; never executes arbitrary JS. dryRun previews without writing/backups; actual changes create a checkpoint. Save and close this project in MZ before external edits.',
      inputSchema: { name: z.string().min(1).optional(), enabled: z.boolean().optional(), description: z.string().optional(), parameters: z.record(z.string(), z.string()).optional(), dryRun: z.boolean().optional() },
      handler: (ctx, args) => updatePluginManifest(ctx.projectPath, args, () => checkpoint(ctx.projectPath, 'Before native plugin manifest update', config)) },
    { name: 'mz_installation', requiresProject: false, description: 'Inspect the local MZ installation, engine version and running editor/NW.js processes. Does not infer the active project from UI.', inputSchema: {},
      handler: async () => {
        const info = await installation(config);
        try { return { ...info, processes: await processes() }; }
        catch { return { ...info, processes: [], processInspectionAvailable: false, processInspectionNote: 'OS denied process inspection; installation detection is still available.' }; }
      } },
    { name: 'mz_create_project', requiresProject: false, description: 'Create and select a new MZ project from the locally licensed newdata template. Refuses an existing destination. Does not bundle RTP into the MCP plugin.',
      inputSchema: { destination: z.string().min(1), title: z.string().min(1), locale: z.enum(['zh_CN', 'en_US', 'ja_JP']).optional() },
      handler: async (ctx, args) => { const r = await createProject(args, config); ctx.setProjectPath(r.projectPath); return r; } },
    { name: 'mz_open_editor', description: 'Launch RPGMZ.exe and return the selected game.rmmzproject path. This MZ build may ignore the file argument; use File > Open Project if blank. Does not save, close or refresh existing editor state, and cannot confirm project loading.', inputSchema: {},
      handler: async (ctx) => { const root = await requireProject(ctx.projectPath); const preflight = await checkEditorProject(root); if (!preflight.ok) throw new Error(`Editor preflight failed: ${JSON.stringify(preflight.errors)}. Use mz_check_editor_project for details; use mz_update_plugin to normalize a literal plugins.js manifest.`); const projectFile = path.join(root, 'game.rmmzproject'); return { ...await launch((await installation(config)).editorPath, [projectFile], root), preflight, projectFile, projectLoadConfirmed: false, nextStep: 'If the editor is blank, choose File > Open Project and select projectFile.' }; } },
    { name: 'mz_launch_playtest', description: 'Launch this project with the installed NW.js runtime and test flag. For automated assertions/screenshots use run_playtest/render_map.', inputSchema: {},
      handler: async (ctx) => { const root = await requireProject(ctx.projectPath); await json(path.join(root, 'package.json')); return launch((await installation(config)).nwjsPath, [root, 'test'], root); } },
    { name: 'mz_checkpoint', description: 'Back up project data and JS plugins before editing. Excludes media, saves and engine. Returns a backup id for change inspection. Never overwrites an older checkpoint.', inputSchema: { label: z.string().default('Before Codex edits') },
      handler: (ctx, args) => checkpoint(ctx.projectPath, args.label, config) },
    { name: 'mz_list_checkpoints', description: 'List checkpoints for the selected project.', inputSchema: {},
      handler: async (ctx) => { const root = await requireProject(ctx.projectPath); const dir = path.join(root, '.codex-mz/backups'); if (!await exists(dir)) return []; const result = []; for (const entry of await readdir(dir, { withFileTypes: true })) { if (!entry.isDirectory()) continue; const m = await readCheckpoint(root, entry.name); result.push({ id: m.id, label: m.label, createdAt: m.createdAt, files: Object.keys(m.files).length }); } return result; } },
    { name: 'mz_changes_since', description: 'Compare current project data/plugin hashes with a checkpoint; reports added, changed and removed files. Does not restore or modify data.', inputSchema: { checkpointId: z.string() },
      handler: async (ctx, args) => { const root = await requireProject(ctx.projectPath); const old = (await readCheckpoint(root, args.checkpointId)).files; const current = await hashes(root); return { added: Object.keys(current).filter(k => !(k in old)), changed: Object.keys(current).filter(k => k in old && old[k] !== current[k]), removed: Object.keys(old).filter(k => !(k in current)) }; } },
    { name: 'mz_read_data', description: 'Read one JSON file under the selected project data directory. Accepts a basename such as System.json or Tilesets.json; no arbitrary paths.', inputSchema: { file: z.string().regex(/^[A-Za-z][A-Za-z0-9_]*\.json$/) },
      handler: async (ctx, args) => { const root = await requireProject(ctx.projectPath); const p = await realpath(path.join(root, 'data', args.file)); if (!within(root, p)) throw new Error('Data file escapes project root'); return json(p); } }
  ];
}
