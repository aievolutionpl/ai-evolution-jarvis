/**
 * What Jarvis can be connected to, and how — one table for the onboarding
 * step and the Połączenia page.
 *
 * Every entry is backed by something that already exists in Hermes: a skill
 * the agent drives (Google Workspace, e-mail, Notion, GitHub, smart home), a
 * settings surface (Messaging platforms, the API server, notifications) or the
 * MCP catalog. Nothing here connects anything by itself: `agent` entries start
 * a guided setup in the composer (the person reads the request before Jarvis
 * gets it), `page` entries open the real settings page.
 *
 * The words live in i18n (`jarvisConnections`); this file only says what each
 * entry is and where it goes.
 */

import { MESSAGING_ROUTE, SETTINGS_ROUTE, SKILLS_ROUTE } from '../routes'

export const JARVIS_CONNECTION_IDS = [
  'google',
  'email',
  'messaging',
  'phone',
  'notion',
  'github',
  'smartHome',
  'mcp'
] as const

export type JarvisConnectionId = (typeof JARVIS_CONNECTION_IDS)[number]

/** How the person proves who they are to the service — shown as a badge. */
export type JarvisConnectionAuth = 'appPassword' | 'botToken' | 'googleLogin' | 'token' | 'topic' | 'various'

export type JarvisConnectionSetup = { kind: 'agent' } | { kind: 'page'; route: string }

export interface JarvisConnection {
  auth: JarvisConnectionAuth
  id: JarvisConnectionId
  setup: JarvisConnectionSetup
  /** Where to get the credential, when there is one page for it. */
  credentialUrl?: string
}

export const JARVIS_CONNECTIONS: readonly JarvisConnection[] = [
  {
    auth: 'googleLogin',
    credentialUrl: 'https://console.cloud.google.com/apis/credentials',
    id: 'google',
    setup: { kind: 'agent' }
  },
  {
    auth: 'appPassword',
    credentialUrl: 'https://myaccount.google.com/apppasswords',
    id: 'email',
    setup: { kind: 'agent' }
  },
  { auth: 'botToken', id: 'messaging', setup: { kind: 'page', route: `${MESSAGING_ROUTE}?platform=telegram` } },
  { auth: 'topic', id: 'phone', setup: { kind: 'page', route: `${SETTINGS_ROUTE}?tab=notifications` } },
  {
    auth: 'token',
    credentialUrl: 'https://www.notion.so/my-integrations',
    id: 'notion',
    setup: { kind: 'agent' }
  },
  {
    auth: 'token',
    credentialUrl: 'https://github.com/settings/tokens',
    id: 'github',
    setup: { kind: 'agent' }
  },
  { auth: 'token', id: 'smartHome', setup: { kind: 'page', route: `${MESSAGING_ROUTE}?platform=homeassistant` } },
  { auth: 'various', id: 'mcp', setup: { kind: 'page', route: `${SKILLS_ROUTE}?tab=mcp` } }
]

export function isJarvisConnectionId(value: unknown): value is JarvisConnectionId {
  return typeof value === 'string' && (JARVIS_CONNECTION_IDS as readonly string[]).includes(value)
}

/** API keys for models and tools: which variable, and where the key is issued. */
export const JARVIS_API_KEYS = [
  { env: 'OPENROUTER_API_KEY', id: 'openrouter', kind: 'model', url: 'https://openrouter.ai/keys' },
  { env: 'OPENAI_API_KEY', id: 'openai', kind: 'model', url: 'https://platform.openai.com/api-keys' },
  { env: 'ANTHROPIC_API_KEY', id: 'anthropic', kind: 'model', url: 'https://console.anthropic.com/settings/keys' },
  { env: 'GEMINI_API_KEY', id: 'gemini', kind: 'model', url: 'https://aistudio.google.com/apikey' },
  { env: 'ELEVENLABS_API_KEY', id: 'elevenlabs', kind: 'tool', url: 'https://elevenlabs.io/app/settings/api-keys' },
  { env: 'TAVILY_API_KEY', id: 'tavily', kind: 'tool', url: 'https://app.tavily.com/home' }
] as const

export type JarvisApiKeyId = (typeof JARVIS_API_KEYS)[number]['id']

/** Settings pages where the two kinds of keys are pasted. */
export const JARVIS_KEY_ROUTES = {
  model: `${SETTINGS_ROUTE}?tab=providers&pview=keys`,
  tool: `${SETTINGS_ROUTE}?tab=keys&kview=tools`
} as const

/** Jarvis's own OpenAI-compatible API: the Messaging page owns its switch and key. */
export const JARVIS_API_SERVER = {
  baseUrl: 'http://127.0.0.1:8642/v1',
  model: 'hermes-agent',
  route: `${MESSAGING_ROUTE}?platform=api_server`
} as const

export function jarvisApiCurlExample(key = 'TWÓJ_API_SERVER_KEY'): string {
  return [
    `curl ${JARVIS_API_SERVER.baseUrl}/chat/completions \\`,
    `  -H "Authorization: Bearer ${key}" \\`,
    '  -H "Content-Type: application/json" \\',
    `  -d '{"model": "${JARVIS_API_SERVER.model}", "messages": [{"role": "user", "content": "Cześć Jarvis!"}]}'`
  ].join('\n')
}

export function jarvisApiPythonExample(key = 'TWÓJ_API_SERVER_KEY'): string {
  return [
    'from openai import OpenAI',
    '',
    `client = OpenAI(base_url="${JARVIS_API_SERVER.baseUrl}", api_key="${key}")`,
    'reply = client.chat.completions.create(',
    `    model="${JARVIS_API_SERVER.model}",`,
    '    messages=[{"role": "user", "content": "Podsumuj moje zadania na dziś"}],',
    ')',
    'print(reply.choices[0].message.content)'
  ].join('\n')
}
