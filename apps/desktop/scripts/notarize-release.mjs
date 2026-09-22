#!/usr/bin/env node
/**
 * notarize-release.mjs — notarize + staple every macOS artifact in release/
 * and record what actually got through.
 *
 * WHY THIS EXISTS ALONGSIDE notarize.mjs
 * --------------------------------------
 * `build.afterSign` (notarize.mjs) notarizes the .app bundle — which is what
 * Gatekeeper checks once the app is installed. But the thing a user downloads
 * is the .dmg, and an unstapled .dmg still shows "cannot be opened because the
 * developer cannot be verified" on a machine that is offline or behind a
 * captive portal. The dmg is built AFTER afterSign runs, so it has to be
 * notarized here, once the release/ directory is complete.
 *
 * It also writes release/.notarization-report.json, which is what
 * release-manifest.mjs reads to mark mac artifacts as signed. Without a
 * report, the gate treats them as unsigned — a missing notarization step
 * fails the release instead of quietly shipping.
 *
 * Usage:
 *   node scripts/notarize-release.mjs [--dir release] [--require]
 */

import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import { isMain } from './utils.mjs'

export const NOTARIZATION_REPORT_FILENAME = '.notarization-report.json'

/** dmg is the download; zip is the auto-update payload. Both need stapling. */
export const NOTARIZABLE_EXTENSIONS = ['.dmg', '.zip', '.pkg']

/**
 * Which Apple credential set is configured, without touching the filesystem.
 *
 * A keychain profile (local release machine) wins over App Store Connect API
 * keys (CI), because a developer who has set one up explicitly means to use it.
 */
export function planNotarization(env = process.env) {
  const read = name => String(env[name] || '').trim()
  const required = read('HERMES_REQUIRE_SIGNING') === '1'

  const profile = read('APPLE_NOTARY_PROFILE')
  if (profile) {
    return { mode: 'keychain-profile', required }
  }

  const keyId = read('APPLE_API_KEY_ID')
  const issuer = read('APPLE_API_ISSUER')
  const key = String(env.APPLE_API_KEY || '').trim()
  if (key || keyId || issuer) {
    if (!key || !keyId || !issuer) {
      throw new Error(
        'Incomplete Apple notarization config: APPLE_API_KEY, APPLE_API_KEY_ID and ' +
          'APPLE_API_ISSUER must all be set'
      )
    }

    return { mode: 'api-key', required }
  }

  return {
    mode: 'skip',
    required,
    reason:
      'no Apple notarization credentials configured (set APPLE_NOTARY_PROFILE, or ' +
      'APPLE_API_KEY + APPLE_API_KEY_ID + APPLE_API_ISSUER)'
  }
}

export function collectNotarizableArtifacts(dir, readdir = fs.readdirSync, statFn = fs.statSync) {
  let entries
  try {
    entries = readdir(dir)
  } catch {
    return []
  }

  return entries
    .filter(name => NOTARIZABLE_EXTENSIONS.includes(path.extname(name).toLowerCase()))
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

function runner(command, args) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { maxBuffer: 16 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        // notarize-artifact.mjs is careful never to echo credentials; keep the
        // same discipline here so a failure in CI logs stays safe to share.
        reject(new Error(`${command} failed: ${stderr?.trim() || stdout?.trim() || error.message}`))

        return
      }
      resolve({ stdout, stderr })
    })
  })
}

/**
 * Notarize every mac artifact under `dir`.
 *
 * Delegates the actual notarytool call to the existing notarize-artifact.mjs
 * so the credential handling (inline .p8 → 0600 temp file → shred) lives in
 * exactly one place. `run` is injectable so the orchestration — including the
 * "configured but nothing to notarize" error — is testable off a Mac.
 */
export async function notarizeReleaseArtifacts({ dir, plan, run = runner, scriptPath } = {}) {
  if (plan.mode === 'skip') {
    if (plan.required) {
      throw new Error(`macOS notarization is required (HERMES_REQUIRE_SIGNING=1) but ${plan.reason}`)
    }
    console.warn(`[notarize-release] skipping: ${plan.reason}`)

    return { mode: 'skip', reason: plan.reason, notarized: [], notarizedAt: new Date().toISOString() }
  }

  const files = collectNotarizableArtifacts(dir)
  if (files.length === 0) {
    throw new Error(`No notarizable macOS artifacts found in ${dir}`)
  }

  const artifactScript = scriptPath || path.join(import.meta.dirname, 'notarize-artifact.mjs')
  const notarized = []
  for (const file of files) {
    await run(process.execPath, [artifactScript, file])
    // `stapler validate` is the offline check: it proves the ticket is
    // attached to the file we are about to publish, not merely that Apple
    // accepted a submission somewhere.
    await run('xcrun', ['stapler', 'validate', file])
    console.log(`[notarize-release] notarized ${path.basename(file)}`)
    notarized.push(path.basename(file))
  }

  return { mode: plan.mode, notarized, notarizedAt: new Date().toISOString() }
}

export function writeNotarizationReport(dir, report) {
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(
    path.join(dir, NOTARIZATION_REPORT_FILENAME),
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8'
  )
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

  const plan = planNotarization(env)
  const report = await notarizeReleaseArtifacts({ dir, plan })
  writeNotarizationReport(dir, report)

  if (report.mode === 'skip') {
    console.log('[notarize-release] artifacts left UNNOTARIZED')
  } else {
    console.log(`[notarize-release] ${report.notarized.length} artifact(s) notarized via ${report.mode}`)
  }
}

if (isMain(import.meta.url)) {
  main().catch(err => {
    console.error(`[notarize-release] ${err.message}`)
    process.exit(1)
  })
}
