// TypeScript shim for Svelte components so importing `.svelte` files in .astro/.ts doesn't trigger
// errors about ComponentConstructorOptions (like missing `target`).
declare module '*.svelte' {
  import type { SvelteComponentTyped } from 'svelte';
  export default class Component extends SvelteComponentTyped<any, any, any> {}
}
