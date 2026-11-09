import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { allToolDefinitions } from './vendor/upstream/src/tools/allTools.ts';
import { buildRegistry, schemaFor, shapeResult } from './vendor/upstream/src/registry.ts';
import { commitStore } from './vendor/upstream/src/utils/commit.ts';
import { loadProjectTextMetrics } from './vendor/upstream/src/tools/projectConfig.ts';
import { setActiveTextMetrics } from './vendor/upstream/src/validation/textMetrics.ts';
import { localDefinitions, json, exists, within, requireProject, installation, checkpoint } from './local-tools.mjs';

const base = path.dirname(fileURLToPath(import.meta.url));
const config = await json(path.join(base, 'config.json')).catch(() => ({}));
if (!process.env.RPGMAKER_MCP_CHROMIUM) {
  const candidates = [config.chromiumPath, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].filter(Boolean);
  for (const candidate of candidates) if (await exists(candidate)) { process.env.RPGMAKER_MCP_CHROMIUM = candidate; break; }
}

export function buildServer(initialPath = process.env.RPGMAKER_PROJECT_PATH || config.projectPath || '', options = {}) {
  const cfg = { ...config, ...options };
  const server = new McpServer({ name: 'rpgmaker-mz-local', version: '1.0.0' });
  const defs = [...allToolDefinitions, ...localDefinitions(cfg)];
  buildRegistry(defs);
  let projectPath = initialPath;
  const protectedProjects = new Set();
  // MZ data/tools carry session state; serialize requests so concurrent calls cannot overwrite a file.
  let tail = Promise.resolve();
  for (const def of defs) {
    server.registerTool(def.name, { description: def.description, inputSchema: schemaFor(def),
      annotations: { readOnlyHint: !def.mutates && !['set_project', 'mz_create_project', 'mz_open_editor', 'mz_launch_playtest', 'mz_checkpoint'].includes(def.name), destructiveHint: !!def.mutates, openWorldHint: false } },
    (args, extra) => {
      const task = tail.then(async () => {
        try {
          if (def.requiresProject !== false) {
            projectPath = await requireProject(projectPath);
            const install = await installation(cfg);
            if (within(install.installPath, projectPath)) throw new Error('Refusing to operate on the MZ installation; select a game project.');
            setActiveTextMetrics(await loadProjectTextMetrics(projectPath));
          }
          if (def.mutates && args.dryRun !== true && !protectedProjects.has(projectPath)) {
            await checkpoint(projectPath, 'Automatic backup before first mutation in this MCP session', cfg);
            protectedProjects.add(projectPath);
          }
          let progress = -1;
          const token = extra?._meta?.progressToken;
          const ctx = { projectPath, setProjectPath: p => { projectPath = p; }, reportProgress: token === undefined ? undefined : (value, total, message) => {
            if (value <= progress) return; progress = value;
            extra.sendNotification({ method: 'notifications/progress', params: { progressToken: token, progress: value, total, message } }).catch(() => {});
          } };
          let result;
          if (def.mutates) {
            const commits = { dryRun: args.dryRun === true, commits: [] };
            const raw = await commitStore.run(commits, () => def.handler(ctx, args));
            result = shapeResult(def, raw, args);
            if (commits.dryRun) result = { dryRun: true, wouldReturn: result, wouldChange: commits.commits.map(c => ({ file: path.basename(c.path), changed: c.changed, deleted: c.deleted, diff: c.diff })) };
          } else result = shapeResult(def, await def.handler(ctx, args), args);
          const content = [{ type: 'text', text: JSON.stringify(result ?? null, null, 2) }];
          for (const file of def.images?.(result, args) || []) content.push({ type: 'image', mimeType: 'image/png', data: (await readFile(file)).toString('base64') });
          return { content };
        } catch (e) { return { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true }; }
      });
      tail = task.catch(() => {});
      return task;
    });
  }
  return server;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await buildServer().connect(new StdioServerTransport());
  console.error(`RPG Maker MZ local MCP ready (${allToolDefinitions.length + localDefinitions().length} tools).`);
}
