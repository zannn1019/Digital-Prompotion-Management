// Waits until a real screen has rendered its data (the admin pages load it from the dev API).
export function until(check: () => boolean, timeout = 10000) {
  return new Promise<void>((resolve, reject) => {
    const t0 = performance.now()
    const tick = () => {
      if (check()) return resolve()
      if (performance.now() - t0 > timeout) return reject(new Error('Video: screen did not load in time'))
      setTimeout(tick, 50)
    }
    tick()
  })
}
