"""Call the installed Aseprite MCP's diagnostic entrypoint with task-local files."""
import argparse
import json
from pathlib import Path
import subprocess
import sys

ROOT=Path(__file__).resolve().parents[1]
BRIDGE=ROOT.parent/'aseprite-mcp/plugins/aseprite-local/server.py'
HOME=ROOT.parent/'aseprite-mcp'
parser=argparse.ArgumentParser()
parser.add_argument('action',choices=['create','preview','export','inspect'])
args=parser.parse_args()
master=str(ROOT/'assets/punk-logo.aseprite')
if args.action=='create':
    name='aseprite_create'; params={'output':master,'overwrite':True,'spec':json.loads((ROOT/'assets/punk-logo.pixels.json').read_text(encoding='utf-8'))}
elif args.action=='preview':
    name='aseprite_preview';params={'input':master,'output':str(ROOT/'assets/punk-logo-preview.png'),'scale':8,'overwrite':True}
elif args.action=='export':
    name='aseprite_export';params={'input':master,'output':str(ROOT/'assets/logo.png'),'kind':'image','overwrite':True}
else:
    name='aseprite_inspect';params={'input':master}
subprocess.run([sys.executable,'-X','utf8',str(BRIDGE),'--home',str(HOME),'--call',name,'--args',json.dumps(params,ensure_ascii=False)],check=True)
