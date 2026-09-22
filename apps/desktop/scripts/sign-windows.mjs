#!/usr/bin/env node
/**
 * sign-windows.mjs — Authenticode signing for the packaged Windows artifacts.
 *
 * WHY THIS IS A STANDALONE POST-BUILD STEP
 * ----------------------------------------
 * `build.win.signAndEditExecutable = false` in package.json is load-bearing
 * (see set-exe-identity.mjs): flipping it on re-enables electron-builder's own
 * signtool path, which fetches winCodeSign-2.6.0.7z, whose macOS symlinks
 * crash 7-Zip on non-admin Windows. We are not allowed to turn that back on,
 * so signing happens HERE — after electron-builder has produced release/ —
 * using the signtool.exe that already ships with the Windows SDK on the
 * runner, or Azure Trusted Signing's own CLI. No winCodeSign, no symlinks.
 *
 * MODES (first configured one wins)
 * ---------------------------------
 *   azure   AZURE_TRUSTED_SIGNING_ENDPOINT + _ACCOUNT + _CERT_PROFILE
 *           (plus the standard AZURE_CLIENT_ID / _TENANT_ID / _CLIENT_SECRET)
 *   pfx     WINDOWS_CERT_BASE64 + WINDOWS_CERT_PASSWORD — a base64 .pfx that
 *           is materialised to a 0600 temp file and shredded in `finally`.
 *   store   WINDOWS_CERT_SUBJECT or WINDOWS_CERT_SHA1 — a cert already in the
 *           machine/user store (self-hosted signing runners).
 *   skip    nothing configured. Unsigned artifacts are a legitimate outcome
 *           for PR builds and local `npm run dist:win`, so this exits 0 —
 *           UNLESS HERMES_REQUIRE_SIGNING=1, which is what the release
 *           workflow sets so a missing secret fails loudly instead of
 *           shipping an unsigned installer.
 *
 * OUTPUT
 * ------
 * Writes release/.signing-report.json. release-manifest.mjs folds that into
 * the published manifest, and verify-release-gate.mjs refuses to pass a
 * release whose Windows artifacts are not in it.
 *
 * Usage:
 *   node scripts/sign-windows.mjs [--dir release] [--require]
 */

import { execFile } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { randomBytes } from 'node:crypto'

import { isMain } from './utils.mjs'

/** Extensions Authenticode actually covers. Anything else is left alone. */
export const SIGNABLE_EXTENSIONS = ['.exe', '.msi', '.dll', '.appx', '.msix']

/** RFC 3161 timestamp authority. Without one, signatures die with the cert. */
export const DEFAULT_TIMESTAMP_URL = 'http://timestamp.digicert.com'

/**
 * Decide how (or whether) to sign, from the environment alone.
 *
 * Pure: no filesystem, no spawning. Returns a plan the caller executes, so
 * the mode-selection precedence is unit-testable without a Windows runner or
 * a real certificate.
 */
export function planWindowsSigning(env = process.env) {
  const read = name => String(env[name] || '').trim()
  const timestampUrl = read('WINDOWS_TIMESTAMP_URL') || DEFAULT_TIMESTAMP_URL
  const required = read('HERMES_REQUIRE_SIGNING') === '1'

  const azureEndpoint = read('AZURE_TRUSTED_SIGNING_ENDPOINT')
  const azureAccount = read('AZURE_TRUSTED_SIGNING_ACCOUNT')
  const azureProfile = read('AZURE_TRUSTED_SIGNING_CERT_PROFILE')
  if (azureEndpoint || azureAccount || azureProfile) {
    // Partial Azure config is a misconfiguration, not a "fall through to the
    // next mode" — a release that silently downgraded from Trusted Signing to
    // unsigned because one variable was misspelled is exactly the failure this
    // gate exists to prevent.
    if (!azureEndpoint || !azureAccount || !azureProfile) {
      throw new Error(
        'Incomplete Azure Trusted Signing config: AZURE_TRUSTED_SIGNING_ENDPOINT, ' +
          'AZURE_TRUSTED_SIGNING_ACCOUNT and AZURE_TRUSTED_SIGNING_CERT_PROFILE must all be set'
      )
    }

    return {
      mode: 'azure',
      required,
      timestampUrl,
      endpoint: azureEndpoint,
      account: azureAccount,
      certProfile: azureProfile
    }
  }

  const pfx = read('WINDOWS_CERT_BASE64')
  if (pfx) {
    const password = String(env.WINDOWS_CERT_PASSWORD || '')
    if (!password) {
      throw new Error('WINDOWS_CERT_BASE64 is set but WINDOWS_CERT_PASSWORD is empty')
    }

    return { mode: 'pfx', required, timestampUrl, certBase64: pfx, password }
  }

  const subject = read('WINDOWS_CERT_SUBJECT')
  const sha1 = read('WINDOWS_CERT_SHA1')
  if (subject || sha1) {
    return { mode: 'store', required, timestampUrl, subject, sha1 }
  }

  return {
    mode: 'skip',
    required,
    timestampUrl,
    reason:
      'no signing credentials configured (set AZURE_TRUSTED_SIGNING_*, ' +
      'WINDOWS_CERT_BASE64 + WINDOWS_CERT_PASSWORD, or WINDOWS_CERT_SUBJECT/WINDOWS_CERT_SHA1)'
  }
}

/** Every artifact under `dir` that Authenticode can cover, newest first. */
export function collectSignableArtifacts(dir, readdir = fs.readdirSync, statFn = fs.statSync) {
  let entries
  try {
    entries = readdir(dir)
  } catch {
    return []
  }

  return entries
    .filter(name => SIGNABLE_EXTENSIONS.includes(path.extname(name).toLowerCase()))
    .map(name => path.join(dir, name))
    .filter(file => {
      try {
        return statFn(file).isFile()
      } catch {
        return false
      }
    })
    .sort()
}

/**
 * The signtool argv for one file. Split out so the flags — notably the
 * RFC 3161 `/tr` + `/td sha256` pair, whose absence produces a signature that
 * expires with the certificate — are asserted in tests rather than reviewed
 * by eye.
 */
export function signtoolArgs(plan, file, pfxPath = '') {
  const args = ['sign', '/fd', 'sha256', '/tr', plan.timestampUrl, '/td', 'sha256']

  if (plan.mode === 'pfx') {
    args.push('/f', pfxPath, '/p', plan.password)
  } else if (plan.mode === 'store') {
    if (plan.sha1) {
      args.push('/sha1', plan.sha1)
    } else {
      args.push('/n', plan.subject)
    }
    args.push('/a')
  } else {
    throw new Error(`signtoolArgs does not handle mode "${plan.mode}"`)
  }

  args.push(file)

  return args
}

/** The `trusted-signing-cli` argv for one file (Azure Trusted Signing). */
export function azureSignArgs(plan, file) {
  return [
    '-e',
    plan.endpoint,
    '-a',
    plan.account,
    '-c',
    plan.certProfile,
    '-t',
    plan.timestampUrl,
    file
  ]
}

function runner(command, args) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { maxBuffer: 16 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        // Never echo args: for the pfx mode they carry the cert password.
        reject(new Error(`${command} failed: ${stderr?.trim() || stdout?.trim() || error.message}`))

        return
      }
      resolve({ stdout, stderr })
    })
  })
}

/**
 * Materialise the .pfx to a private temp file. Written 0600 and removed by the
 * caller's `finally` so the key never outlives the signing step, and never
 * lands in the workspace where an artifact upload could sweep it up.
 */
function writeTempPfx(certBase64) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-sign-'))
  const pfxPath = path.join(dir, `${randomBytes(8).toString('hex')}.pfx`)
  fs.writeFileSync(pfxPath, Buffer.from(certBase64, 'base64'), { mode: 0o600 })

  return {
    pfxPath,
    cleanup: () => {
      try {
        fs.rmSync(dir, { force: true, recursive: true })
      } catch {
        // Best-effort: the runner is ephemeral anyway.
      }
    }
  }
}

/**
 * Sign every signable artifact under `dir`.
 *
 * Returns the report that lands in release/.signing-report.json. `run` is
 * injectable so tests can drive the whole flow — including the report shape
 * and the temp-pfx lifecycle — without signtool or a certificate.
 */
export async function signWindowsArtifacts({ dir, plan, run = runner, verify = true } = {}) {
  const files = collectSignableArtifacts(dir)

  if (plan.mode === 'skip') {
    if (plan.required) {
      throw new Error(
        `Windows signing is required (HERMES_REQUIRE_SIGNING=1) but ${plan.reason}`
      )
    }
    console.warn(`[sign-windows] skipping: ${plan.reason}`)

    return { mode: 'skip', reason: plan.reason, signed: [], signedAt: new Date().toISOString() }
  }

  if (files.length === 0) {
    // An empty release/ with signing configured means the build step did not
    // produce what we are about to publish. Treat it as an error rather than
    // reporting a vacuous success the gate would then accept.
    throw new Error(`No signable Windows artifacts found in ${dir}`)
  }

  let pfxPath = ''
  let cleanup = () => {}
  if (plan.mode === 'pfx') {
    ;({ pfxPath, cleanup } = writeTempPfx(plan.certBase64))
  }

  const signed = []
  try {
    for (const file of files) {
      if (plan.mode === 'azure') {
        await run('trusted-signing-cli', azureSignArgs(plan, file))
      } else {
        await run('signtool', signtoolArgs(plan, file, pfxPath))
      }

      if (verify && plan.mode !== 'azure') {
        // /pa = Authenticode policy: this is what Windows itself applies when
        // SmartScreen decides whether to show the blue "unknown publisher"
        // wall. Verifying with anything looser would pass locally and still
        // scare every user on first launch.
        await run('signtool', ['verify', '/pa', '/v', file])
      }

      console.log(`[sign-windows] signed ${path.basename(file)}`)
      signed.push(path.basename(file))
    }
  } finally {
    cleanup()
  }

  return {
    mode: plan.mode,
    signed,
    signedAt: new Date().toISOString(),
    timestampUrl: plan.timestampUrl
  }
}

export const SIGNING_REPORT_FILENAME = '.signing-report.json'

export function writeSigningReport(dir, report) {
  const target = path.join(dir, SIGNING_REPORT_FILENAME)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(target, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

  return target
}

/** Read back a signing report; `null` when the build never ran a signing step. */
export function readSigningReport(dir, readFile = fs.readFileSync) {
  try {
    return JSON.parse(readFile(path.join(dir, SIGNING_REPORT_FILENAME), 'utf8'))
  } catch {
    return null
  }
}

function parseArgs(argv) {
  const args = { dir: 'release', require: false }
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--dir' && argv[i + 1]) {
      args.dir = argv[i + 1]
      i += 1
    } else if (argv[i] === '--require') {
      args.require = true
    }
  }

  return args
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const dir = path.resolve(args.dir)
  const env = args.require ? { ...process.env, HERMES_REQUIRE_SIGNING: '1' } : process.env

  const plan = planWindowsSigning(env)
  const report = await signWindowsArtifacts({ dir, plan })
  writeSigningReport(dir, report)

  if (report.mode === 'skip') {
    console.log('[sign-windows] artifacts left UNSIGNED')
  } else {
    console.log(`[sign-windows] ${report.signed.length} artifact(s) signed via ${report.mode}`)
  }
}

if (isMain(import.meta.url)) {
  main().catch(err => {
    console.error(`[sign-windows] ${err.message}`)
    process.exit(1)
  })
}
