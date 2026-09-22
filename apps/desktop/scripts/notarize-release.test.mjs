import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, test } from 'vitest'

import {
  collectNotarizableArtifacts,
  notarizeReleaseArtifacts,
  planNotarization,
  writeNotarizationReport
} from '../scripts/notarize-release.mjs'

let dir = ''

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'notarize-release-test-'))
})

afterEach(() => {
  fs.rmSync(dir, { force: true, recursive: true })
})

function writeArtifact(name) {
  fs.writeFileSync(path.join(dir, name), Buffer.alloc(16, 3))
}

describe('planNotarization', () => {
  test('skips when no Apple credentials are configured', () => {
    const plan = planNotarization({})
    assert.equal(plan.mode, 'skip')
    assert.match(plan.reason, /no Apple notarization credentials/)
  })

  test('a keychain profile wins over API keys', () => {
    const plan = planNotarization({
      APPLE_NOTARY_PROFILE: 'jarvis',
      APPLE_API_KEY: 'k',
      APPLE_API_KEY_ID: 'id',
      APPLE_API_ISSUER: 'iss'
    })
    assert.equal(plan.mode, 'keychain-profile')
  })

  test('API-key mode needs all three variables', () => {
    assert.equal(planNotarization({ APPLE_API_KEY: 'k', APPLE_API_KEY_ID: 'id', APPLE_API_ISSUER: 'iss' }).mode, 'api-key')
    assert.throws(
      () => planNotarization({ APPLE_API_KEY: 'k', APPLE_API_KEY_ID: 'id' }),
      /Incomplete Apple notarization config/
    )
  })

  test('HERMES_REQUIRE_SIGNING is carried into the plan', () => {
    assert.equal(planNotarization({ HERMES_REQUIRE_SIGNING: '1' }).required, true)
  })
})

describe('collectNotarizableArtifacts', () => {
  test('takes the download and the update payload, ignores the rest', () => {
    writeArtifact('Jarvis-mac-arm64.dmg')
    writeArtifact('Jarvis-mac-arm64.zip')
    writeArtifact('Jarvis-linux-x64.AppImage')
    writeArtifact('latest-mac.yml')

    assert.deepEqual(collectNotarizableArtifacts(dir).map(f => path.basename(f)), [
      'Jarvis-mac-arm64.dmg',
      'Jarvis-mac-arm64.zip'
    ])
  })

  test('a missing directory yields nothing instead of throwing', () => {
    assert.deepEqual(collectNotarizableArtifacts(path.join(dir, 'nope')), [])
  })
})

describe('notarizeReleaseArtifacts', () => {
  test('an unconfigured build skips cleanly', async () => {
    writeArtifact('Jarvis-mac-arm64.dmg')
    const report = await notarizeReleaseArtifacts({ dir, plan: planNotarization({}) })

    assert.equal(report.mode, 'skip')
    assert.deepEqual(report.notarized, [])
  })

  test('a required build fails instead of shipping unnotarized', async () => {
    writeArtifact('Jarvis-mac-arm64.dmg')
    await assert.rejects(
      notarizeReleaseArtifacts({ dir, plan: planNotarization({ HERMES_REQUIRE_SIGNING: '1' }) }),
      /macOS notarization is required/
    )
  })

  // An accepted submission that never got stapled still trips Gatekeeper on
  // an offline machine, so the ticket is validated on the published file.
  test('each artifact is notarized and then staple-validated', async () => {
    writeArtifact('Jarvis-mac-arm64.dmg')
    writeArtifact('Jarvis-mac-x64.dmg')

    const calls = []
    const report = await notarizeReleaseArtifacts({
      dir,
      plan: planNotarization({ APPLE_NOTARY_PROFILE: 'jarvis' }),
      scriptPath: '/fake/notarize-artifact.mjs',
      run: async (command, args) => {
        calls.push(command === process.execPath ? 'notarize' : `${command} ${args[0]} ${args[1]}`)

        return { stdout: '', stderr: '' }
      }
    })

    assert.deepEqual(report.notarized, ['Jarvis-mac-arm64.dmg', 'Jarvis-mac-x64.dmg'])
    assert.deepEqual(calls, [
      'notarize',
      'xcrun stapler validate',
      'notarize',
      'xcrun stapler validate'
    ])
  })

  test('configured notarization with no artifacts is an error', async () => {
    await assert.rejects(
      notarizeReleaseArtifacts({ dir, plan: planNotarization({ APPLE_NOTARY_PROFILE: 'jarvis' }) }),
      /No notarizable macOS artifacts/
    )
  })

  test('a stapling failure aborts the release', async () => {
    writeArtifact('Jarvis-mac-arm64.dmg')
    await assert.rejects(
      notarizeReleaseArtifacts({
        dir,
        plan: planNotarization({ APPLE_NOTARY_PROFILE: 'jarvis' }),
        scriptPath: '/fake/notarize-artifact.mjs',
        run: async (command, args) => {
          if (args[0] === 'stapler') throw new Error('staple failed')

          return { stdout: '', stderr: '' }
        }
      }),
      /staple failed/
    )
  })
})

describe('writeNotarizationReport', () => {
  test('writes the file release-manifest.mjs reads', () => {
    writeNotarizationReport(dir, { mode: 'api-key', notarized: ['a.dmg'] })
    const parsed = JSON.parse(fs.readFileSync(path.join(dir, '.notarization-report.json'), 'utf8'))

    assert.deepEqual(parsed, { mode: 'api-key', notarized: ['a.dmg'] })
  })
})
