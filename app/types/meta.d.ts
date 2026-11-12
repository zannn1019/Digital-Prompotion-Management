declare module '#app' {
  interface PageMeta {
    /** Shown in the top bar and the browser tab. */
    title?: string
    /** Only Super Admin may open this page. */
    superOnly?: boolean
  }
}

export {}
