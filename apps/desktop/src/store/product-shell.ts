import { atom } from 'nanostores'

/**
 * True while the Jarvis product shell wraps the runtime and its rail owns the
 * destinations (Tasks, Messaging, Artifacts, Memory, Capabilities, Settings).
 * The runtime's sidebar then keeps only what is about conversations — "New
 * session" and the session list — so there is one navigation, not two.
 */
export const $productShellNav = atom(false)
