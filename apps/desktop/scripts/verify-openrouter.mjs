#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'

const key = process.env.OPENROUTER_RELEASE_TEST_KEY
const receiptPath = process.env.OPENROUTER_RECEIPT || path.resolve('release/openrouter-receipt.json')

if (!key) {
  console.log('SKIP — OPENROUTER_RELEASE_TEST_KEY is not set; no live credential was used.')
  process.exit(0)
}

const model = process.env.OPENROUTER_RELEASE_TEST_MODEL || 'openai/gpt-5.5'
const endpoint = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1/chat/completions'
const startedAt = new Date().toISOString()

const response = await fetch(endpoint, {
  method: 'POST',
  headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
  body: JSON.stringify({
    model,
    max_tokens: 32,
    messages: [{ role: 'user', content: 'Reply with the single word: ready' }]
  })
})

const body = await response.json().catch(() => ({}))
const answer = body?.choices?.[0]?.message?.content
const receipt = {
  checked_at: new Date().toISOString(),
  started_at: startedAt,
  model,
  status: response.status,
  answered: typeof answer === 'string' && answer.trim().length > 0,
  key: 'redacted'
}

await fs.mkdir(path.dirname(receiptPath), { recursive: true })
await fs.writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8')

if (!response.ok || !receipt.answered) {
  console.error(`FAIL — OpenRouter did not return a provider answer (HTTP ${response.status}).`)
  process.exit(1)
}

console.log(`PASS — OpenRouter returned a provider answer; redacted receipt: ${receiptPath}`)
