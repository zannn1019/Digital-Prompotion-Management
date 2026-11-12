// Response hardening that has to run after Nuxt renders:
// - HTML pages get a CSP that allows their own inline scripts by hash (no 'unsafe-inline').
// - The X-Powered-By header that names the framework is removed.
export default defineNitroPlugin(nitroApp => {
  nitroApp.hooks.hook('render:html', (html, { event }) => {
    if (import.meta.dev) return
    const all = [...html.head, ...html.bodyPrepend, ...html.body, ...html.bodyAppend].join('\n')
    setResponseHeader(event, 'Content-Security-Policy', cspHeader(inlineScriptHashes(all)))
  })
  nitroApp.hooks.hook('beforeResponse', event => {
    removeResponseHeader(event, 'x-powered-by')
  })
})
