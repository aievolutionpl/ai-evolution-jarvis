import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { test } from 'vitest'

const releaseScript = path.resolve(import.meta.dirname, '../../../.github/scripts/update-desktop-draft.sh')

function runRelease(state: string) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-release-test-'))

  try {
    const bin = path.join(home, 'bin')
    fs.mkdirSync(bin)
    fs.mkdirSync(path.join(home, 'staging'))
    fs.writeFileSync(path.join(home, 'staging', 'installer.bin'), 'installer')
    fs.writeFileSync(path.join(home, 'notes.md'), 'release notes')
    const gh = path.join(bin, 'gh')
    fs.writeFileSync(
      gh,
      '#!/usr/bin/env bash\n' +
        'printf "%s\\n" "$*" >> "$GH_CALLS"\n' +
        'if [[ "$1 $2" == "release view" ]]; then\n' +
        '  if [[ "$RELEASE_STATE" == missing ]]; then exit 1; fi\n' +
        '  printf "%s\\n" "$RELEASE_STATE"\n' +
        'fi\n'
    )
    fs.chmodSync(gh, 0o755)
    const callsPath = path.join(home, 'calls')

    const result = spawnSync('bash', [releaseScript], {
      cwd: home,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${bin}${path.delimiter}${process.env.PATH}`,
        GH_CALLS: callsPath,
        RELEASE_STATE: state,
        TAG: 'v1.2.3',
        VERSION: '1.2.3',
        GITHUB_REPOSITORY: 'owner/repo'
      }
    })

    const calls = fs.existsSync(callsPath) ? fs.readFileSync(callsPath, 'utf8').trim().split('\n') : []

    return { result, calls }
  } finally {
    fs.rmSync(home, { recursive: true, force: true })
  }
}

test('published desktop releases are never edited or given replacement assets', () => {
  const { result, calls } = runRelease('false')

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /Refusing to change published release/)
  assert.equal(calls.length, 1)
  assert.match(calls[0], /^release view /)
})

test('drafts may replace assets; a new release uploads without clobber', () => {
  const draft = runRelease('true')
  const fresh = runRelease('missing')

  assert.equal(draft.result.status, 0)
  assert.ok(draft.calls.some(call => call.startsWith('release edit ')))
  assert.ok(draft.calls.some(call => call.startsWith('release upload ') && call.includes('--clobber')))
  assert.equal(fresh.result.status, 0)
  assert.ok(fresh.calls.some(call => call.startsWith('release create ') && call.includes('--draft')))
  assert.ok(fresh.calls.some(call => call.startsWith('release upload ') && !call.includes('--clobber')))
})
