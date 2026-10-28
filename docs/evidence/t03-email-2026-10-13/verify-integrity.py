from pathlib import Path
import hashlib, json, re, subprocess, datetime, sys

sys.stdout.reconfigure(encoding='utf-8')
root = Path(__file__).resolve().parents[3]
receipt = json.loads((root/'docs/T03_EMAIL_CHECKS_2026-10-13.json').read_text(encoding='utf-8'))
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
files = []
for base in ['apps', 'packages', 'scripts', 'tests', '.github']:
    for path in (root/base).rglob('*'):
        if not path.is_file() or any(part in {'node_modules','dist','.next','generated','.git','.tools'} for part in path.parts): continue
        if path.suffix.lower() in {'.ts','.tsx','.js','.jsx','.mjs','.cjs','.json','.yaml','.yml','.prisma'} or path.name == 'Dockerfile': files.append(path)
for name in ['package.json','package-lock.json','.env.example','docker-compose.yml','docker-compose.yaml','docs/evaluation/T10_INTENT_CASES_V1.json']:
    path = root/name
    if path.is_file(): files.append(path)
current = {p.relative_to(root).as_posix():sha(p) for p in sorted(set(files))}
changed = sorted(p for p in current.keys() | receipt['after'].keys() if current.get(p) != receipt['after'].get(p))
logs_match = all(sha(root/check['log']) == check['logSha256'] for check in receipt['checks'])
preview = json.loads((root/'docs/evidence/t10-proposal-2026-10-13/preview-build.json').read_text(encoding='utf-8'))
preview_match = all(sha(root/name) == value for name, value in preview['hashes'].items())
probe = json.loads((root/'docs/evidence/t03-availability-2026-10-13/probe-report-current.json').read_text(encoding='utf-8-sig'))
probe_match = all(sha(root/name) == value for group in ['sourceHashes','artifactHashes'] for name,value in probe[group].items())
obs = json.loads((root/'docs/evidence/t03-email-2026-10-13/obsidian-readback.json').read_text(encoding='utf-8'))
obs_match = obs['allMatch'] and all(sha(root/note['path']) == note['sourceSha256'] for note in obs['notes'])
manifest = json.loads((root/'docs/AI_MEMORY_SYNC_PENDING_2026-10-12.json').read_text(encoding='utf-8'))
manifest_match = all(sha(root/page['source']) == page['sourceSha256'] and hashlib.sha256((root/page['source']).read_text(encoding='utf-8-sig').replace('\r\n','\n').encode('utf-8')).hexdigest() == page['bodySha256'] for page in manifest['pages'])
docs = ['README.md','plan.md','docs/MEMORIA.md','docs/AI_MEMORY.md','docs/AI_EVALUATION.md','docs/WORKFLOW_CONTRACT.md',
        'docs/QA_SECURITY_MATRIX.md','docs/T10_AI_ARCHITECTURE.md','docs/T03_NODE_SCHEMA_REVIEW.md','docs/EXECUTION_SEMANTICS.md',
        'docs/T03_AVAILABILITY_PROPOSAL.md','docs/T03_RESOURCE_PROPOSAL.md','docs/VALIDATION_T03_REFERENCE_2026-10-13.md',
        'docs/VALIDATION_T10_PROPOSAL_2026-10-13.md','docs/VALIDATION_T03_EMAIL_2026-10-13.md']
broken = []
encoding_errors = []
for name in docs:
    path = root/name
    body = path.read_text(encoding='utf-8')
    if '\ufffd' in body: encoding_errors.append(name)
    for match in re.finditer(r'\[[^\]]*\]\(([^)]+)\)', body):
        target = match.group(1).strip().strip('<>')
        if re.match(r'^[a-zA-Z][a-zA-Z0-9+.-]*:', target) or target.startswith('#'): continue
        relative = target.split('#',1)[0]
        if relative and not (path.parent/relative).exists(): broken.append({'source':name,'target':target})
git = subprocess.run(['git','-c','safe.directory=C:/Users/jv883/Documents/Codex/FlowMind-AI/Flowmind-AI','diff','--check'],cwd=root,capture_output=True,text=True)
result = {'checkedAtUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(), 'snapshotAccepted':receipt['snapshotAccepted'],
          'sourceStableSinceAcceptedSnapshot':not changed,'inputCount':len(current),'changedInputs':changed,
          'logsAndDiagnosticHashesMatch':logs_match and preview_match and probe_match,
          'obsidianReadbackMatches':obs_match,'pendingAiMemoryPages':len(manifest['pages']),
          'pendingManifestMatches':manifest_match,'markdownLinksMatch':not broken,'brokenLinks':broken,
          'encodingErrors':encoding_errors,'gitDiffCheckExitCode':git.returncode,
          'dependenciesEvidence':'manifests/lockfile included; installed node_modules/.tools/generated tree not exhaustively hashed',
          'reviewVerdict':'no material findings in bounded local review; operational gates pending'}
result['allMatch'] = all([receipt['snapshotAccepted'],not changed,logs_match,preview_match,probe_match,obs_match,manifest_match,not broken,not encoding_errors,git.returncode == 0])
(root/'docs/evidence/t03-email-2026-10-13/final-integrity.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(result,ensure_ascii=False))
sys.exit(0 if result['allMatch'] else 1)
