import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, test } from 'vitest'

import {
  azureSignArgs,
  collectSignableArtifacts,
  DEFAULT_TIMESTAMP_URL,
  planWindowsSigning,
  readSigningReport,
  signtoolArgs,
  signWindowsArtifacts,
  writeSigningReport
} from '../scripts/sign-windows.mjs'

let dir = ''

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sign-windows-test-'))
})

afterEach(() => {
  fs.rmSync(dir, { force: true, recursive: true })
})

function writeArtifact(name, bytes = 16) {
  fs.writeFileSync(path.join(dir, name), Buffer.alloc(bytes, 1))
}

describe('planWindowsSigning', () => {
  test('skips when nothing is configured', () => {
    const plan = planWindowsSigning({})
    assert.equal(plan.mode, 'skip')
    assert.match(plan.reason, /no signing credentials/)
    assert.equal(plan.timestampUrl, DEFAULT_TIMESTAMP_URL)
  })

  test('Azure Trusted Signing wins over every other mode', () => {
    const plan = planWindowsSigning({
      AZURE_TRUSTED_SIGNING_ENDPOINT: 'https://weu.codesigning.azure.net',
      AZURE_TRUSTED_SIGNING_ACCOUNT: 'aievolution',
      AZURE_TRUSTED_SIGNING_CERT_PROFILE: 'jarvis',
      WINDOWS_CERT_BASE64: 'aGk=',
      WINDOWS_CERT_PASSWORD: 'pw'
    })
    assert.equal(plan.mode, 'azure')
    assert.equal(plan.account, 'aievolution')
  })

  // A typo'd Azure variable must not silently downgrade the release to
  // unsigned — that is the exact failure this gate exists to prevent.
  test('partial Azure config throws rather than falling through', () => {
    assert.throws(
      () => planWindowsSigning({ AZURE_TRUSTED_SIGNING_ENDPOINT: 'https://x', WINDOWS_CERT_BASE64: 'aGk=' }),
      /Incomplete Azure Trusted Signing config/
    )
  })

  test('pfx mode requires a password', () => {
    assert.throws(() => planWindowsSigning({ WINDOWS_CERT_BASE64: 'aGk=' }), /WINDOWS_CERT_PASSWORD is empty/)
  })

  test('store mode accepts a subject or a thumbprint', () => {
    assert.equal(planWindowsSigning({ WINDOWS_CERT_SUBJECT: 'AI Evolution' }).mode, 'store')
    assert.equal(planWindowsSigning({ WINDOWS_CERT_SHA1: 'abcd' }).mode, 'store')
  })

  test('HERMES_REQUIRE_SIGNING is carried into the plan', () => {
    assert.equal(planWindowsSigning({ HERMES_REQUIRE_SIGNING: '1' }).required, true)
  })

  test('a custom timestamp URL overrides the default', () => {
    const plan = planWindowsSigning({ WINDOWS_CERT_SUBJECT: 'x', WINDOWS_TIMESTAMP_URL: 'http://ts.example' })
    assert.equal(plan.timestampUrl, 'http://ts.example')
  })
})

describe('collectSignableArtifacts', () => {
  test('picks up installers and ignores everything else', () => {
    writeArtifact('AI-Evolution-Jarvis-0.17.2-win-x64.exe')
    writeArtifact('AI-Evolution-Jarvis-0.17.2-win-x64.msi')
    writeArtifact('AI-Evolution-Jarvis-0.17.2-linux-x64.AppImage')
    writeArtifact('latest.yml')

    const found = collectSignableArtifacts(dir).map(file => path.basename(file))
    assert.deepEqual(found, [
      'AI-Evolution-Jarvis-0.17.2-win-x64.exe',
      'AI-Evolution-Jarvis-0.17.2-win-x64.msi'
    ])
  })

  test('a missing directory yields nothing instead of throwing', () => {
    assert.deepEqual(collectSignableArtifacts(path.join(dir, 'nope')), [])
  })
})

describe('signtoolArgs', () => {
  // Without /tr + /td the signature expires with the certificate, which turns
  // every previously shipped installer into an "unknown publisher" warning.
  test('always requests an RFC 3161 countersignature', () => {
    const plan = planWindowsSigning({ WINDOWS_CERT_SUBJECT: 'AI Evolution' })
    const args = signtoolArgs(plan, 'C:\\out\\setup.exe')

    assert.equal(args[0], 'sign')
    assert.ok(args.includes('/tr'))
    assert.equal(args[args.indexOf('/tr') + 1], DEFAULT_TIMESTAMP_URL)
    assert.equal(args[args.indexOf('/td') + 1], 'sha256')
    assert.equal(args[args.indexOf('/fd') + 1], 'sha256')
    assert.equal(args.at(-1), 'C:\\out\\setup.exe')
  })

  test('pfx mode passes the materialised key path', () => {
    const plan = planWindowsSigning({ WINDOWS_CERT_BASE64: 'aGk=', WINDOWS_CERT_PASSWORD: 'secret' })
    const args = signtoolArgs(plan, 'setup.exe', '/tmp/key.pfx')

    assert.equal(args[args.indexOf('/f') + 1], '/tmp/key.pfx')
    assert.equal(args[args.indexOf('/p') + 1], 'secret')
  })

  test('thumbprint selection beats subject-name selection', () => {
    const plan = planWindowsSigning({ WINDOWS_CERT_SUBJECT: 'AI Evolution', WINDOWS_CERT_SHA1: 'DEADBEEF' })
    const args = signtoolArgs(plan, 'setup.exe')

    assert.equal(args[args.indexOf('/sha1') + 1], 'DEADBEEF')
    assert.ok(!args.includes('/n'))
  })
})

describe('azureSignArgs', () => {
  test('passes endpoint, account, profile and timestamp', () => {
    const plan = planWindowsSigning({
      AZURE_TRUSTED_SIGNING_ENDPOINT: 'https://weu.codesigning.azure.net',
      AZURE_TRUSTED_SIGNING_ACCOUNT: 'aievolution',
      AZURE_TRUSTED_SIGNING_CERT_PROFILE: 'jarvis'
    })

    assert.deepEqual(azureSignArgs(plan, 'setup.exe'), [
      '-e',
      'https://weu.codesigning.azure.net',
      '-a',
      'aievolution',
      '-c',
      'jarvis',
      '-t',
      DEFAULT_TIMESTAMP_URL,
      'setup.exe'
    ])
  })
})

describe('signWindowsArtifacts', () => {
  test('an unconfigured PR build skips cleanly', async () => {
    writeArtifact('setup.exe')
    const report = await signWindowsArtifacts({ dir, plan: planWindowsSigning({}) })

    assert.equal(report.mode, 'skip')
    assert.deepEqual(report.signed, [])
  })

  test('a required build fails instead of shipping unsigned', async () => {
    writeArtifact('setup.exe')
    await assert.rejects(
      signWindowsArtifacts({ dir, plan: planWindowsSigning({ HERMES_REQUIRE_SIGNING: '1' }) }),
      /Windows signing is required/
    )
  })

  test('signs and verifies every artifact', async () => {
    writeArtifact('setup.exe')
    writeArtifact('setup.msi')

    const calls = []
    const report = await signWindowsArtifacts({
      dir,
      plan: planWindowsSigning({ WINDOWS_CERT_SUBJECT: 'AI Evolution' }),
      run: async (command, args) => {
        calls.push([command, args[0]])

        return { stdout: '', stderr: '' }
      }
    })

    assert.deepEqual(report.signed, ['setup.exe', 'setup.msi'])
    assert.deepEqual(calls, [
      ['signtool', 'sign'],
      ['signtool', 'verify'],
      ['signtool', 'sign'],
      ['signtool', 'verify']
    ])
  })

  test('verification uses the Authenticode policy SmartScreen applies', async () => {
    writeArtifact('setup.exe')
    const verifyArgs = []
    await signWindowsArtifacts({
      dir,
      plan: planWindowsSigning({ WINDOWS_CERT_SUBJECT: 'x' }),
      run: async (command, args) => {
        if (args[0] === 'verify') verifyArgs.push(args)

        return { stdout: '', stderr: '' }
      }
    })

    assert.ok(verifyArgs[0].includes('/pa'))
  })

  test('the temp pfx is shredded even when signing fails', async () => {
    writeArtifact('setup.exe')
    let seenPfx = ''

    await assert.rejects(
      signWindowsArtifacts({
        dir,
        plan: planWindowsSigning({ WINDOWS_CERT_BASE64: 'aGk=', WINDOWS_CERT_PASSWORD: 'pw' }),
        run: async (_command, args) => {
          seenPfx = args[args.indexOf('/f') + 1]
          throw new Error('signtool exploded')
        }
      }),
      /signtool exploded/
    )

    assert.ok(seenPfx)
    assert.equal(fs.existsSync(seenPfx), false)
  })

  test('configured signing with no artifacts is an error, not a vacuous pass', async () => {
    await assert.rejects(
      signWindowsArtifacts({ dir, plan: planWindowsSigning({ WINDOWS_CERT_SUBJECT: 'x' }) }),
      /No signable Windows artifacts/
    )
  })
})

describe('signing report round-trip', () => {
  test('writes and reads back', () => {
    writeSigningReport(dir, { mode: 'store', signed: ['setup.exe'] })
    assert.deepEqual(readSigningReport(dir), { mode: 'store', signed: ['setup.exe'] })
  })

  test('a build that never signed reads as null', () => {
    assert.equal(readSigningReport(dir), null)
  })
})
