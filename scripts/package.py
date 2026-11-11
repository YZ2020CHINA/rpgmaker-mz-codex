"""Package only redistributable integration files; never include RPG Maker assets."""
import hashlib
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / 'dist'
DIST.mkdir(exist_ok=True)
archive = DIST / 'rpgmaker-mz-local-plugin-1.0.0.zip'
files = [ROOT / p for p in ('install-plugin.ps1', 'uninstall-plugin.ps1', 'README.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md', '.agents/plugins/marketplace.json')]
files += [p for p in (ROOT / 'plugins').rglob('*') if p.is_file() and p.name != 'config.json']
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as bundle:
    for source in sorted(files):
        member = 'rpgmaker-mz-codex/' + source.relative_to(ROOT).as_posix()
        if source.name == 'launch-mcp.cmd':
            bundle.writestr(member, '@echo off\r\nchcp 65001 >nul\r\nnode "%~dp0server.mjs"\r\n')
        else:
            bundle.write(source, member)
digest = hashlib.sha256(archive.read_bytes()).hexdigest()
archive.with_suffix('.zip.sha256').write_text(digest + '  ' + archive.name + '\n', encoding='ascii')
print(f'{archive}\nsha256: {digest}\nfiles: {len(files)}\nbytes: {archive.stat().st_size}')

source_archive = DIST / 'rpgmaker-mz-local-source-1.0.0.zip'
source_files = [p for p in ROOT.iterdir() if p.is_file() and p.suffix in ('.mjs', '.json', '.md', '.ps1', '.yaml') and p.name not in ('reference-tree.json', 'config.json')]
source_files += [ROOT / 'LICENSE', ROOT / '.gitignore']
for folder in ('assets', 'skills', 'scripts', 'tests', 'vendor/upstream/src', 'vendor/upstream/test'):
    source_files += [p for p in (ROOT / folder).rglob('*') if p.is_file() and '__pycache__' not in p.parts]
source_files += [ROOT / 'vendor/upstream' / p for p in ('package.json', 'package-lock.json', 'tsconfig.json', 'vitest.config.ts', 'LICENSE')]
with zipfile.ZipFile(source_archive, 'w', zipfile.ZIP_DEFLATED) as bundle:
    for source in sorted(set(source_files)):
        bundle.write(source, 'rpgmaker-mz-codex/' + source.relative_to(ROOT).as_posix())
source_digest = hashlib.sha256(source_archive.read_bytes()).hexdigest()
source_archive.with_suffix('.zip.sha256').write_text(source_digest + '  ' + source_archive.name + '\n', encoding='ascii')
print(f'{source_archive}\nsha256: {source_digest}\nbytes: {source_archive.stat().st_size}')
