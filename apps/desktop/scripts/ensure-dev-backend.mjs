import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const venv = path.join(root, '.venv')
const python = path.join(venv, process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python')
const probe = 'import yaml, dotenv, hermes_logging, hermes_cli.config'
const env = { ...process.env, PYTHONPATH: [root, process.env.PYTHONPATH].filter(Boolean).join(path.delimiter) }

function run(command, args, options = {}) {
  return spawnSync(command, args, { cwd: root, env, stdio: options.quiet ? 'ignore' : 'inherit', shell: process.platform === 'win32' && /\.cmd$/i.test(command) }).status === 0
}

if (existsSync(python) && run(python, ['-c', probe], { quiet: true })) {
  console.log('[desktop] Python backend ready')
  process.exit(0)
}

const candidates = process.platform === 'win32'
  ? [['py', '-3.12'], ['py', '-3.11'], ['py', '-3.13'], ['python']]
  : [['python3.12'], ['python3.11'], ['python3.13'], ['python3']]
const candidate = candidates.find(([command, ...args]) =>
  run(command, [...args, '-c', 'import sys; assert (3, 11) <= sys.version_info[:2] <= (3, 13)'], { quiet: true })
)
if (!candidate) {
  console.error('[desktop] Python 3.11–3.13 is required for the backend')
  process.exit(1)
}

if (!existsSync(python)) {
  console.log('[desktop] Creating Python virtual environment')
  if (!run(candidate[0], [...candidate.slice(1), '-m', 'venv', venv])) process.exit(1)
}

console.log('[desktop] Installing Python backend dependencies')
const installed = run('uv', ['pip', 'install', '--system-certs', '--python', python, '-e', root], { quiet: true })
  || run(python, ['-m', 'pip', 'install', '-e', root])
if (!installed || !run(python, ['-c', probe], { quiet: true })) {
  console.error('[desktop] Backend setup failed; inspect the install output above')
  process.exit(1)
}
console.log('[desktop] Python backend ready')
