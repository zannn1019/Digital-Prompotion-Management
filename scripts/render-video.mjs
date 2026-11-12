// Renders the product demo video (/video) to MP4, frame by frame.
//
//   1. npm run video:dev           (starts the studio on http://localhost:3100)
//   2. npm run video:render        (writes video/demo-poster-nfc.mp4)
//
// Options:
//   --url <address>     studio page (default http://localhost:3100/video?capture=1)
//   --out <file>        output file (default video/demo-poster-nfc.mp4)
//   --stills 2.5,8,12   save PNG stills at these seconds instead of a video (for checking)
//
// Each frame seeks the paused GSAP timeline, so the output is identical on every run.
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import ffmpegPath from 'ffmpeg-static'
import puppeteer from 'puppeteer-core'

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 ? process.argv[i + 1] : fallback
}
const url = arg('url', 'http://localhost:3100/video?capture=1')
const out = resolve(arg('out', 'video/demo-poster-nfc.mp4'))
const stills = arg('stills', '')

const BROWSERS = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean)
const executablePath = BROWSERS.find(p => existsSync(p))
if (!executablePath) throw new Error('No Chrome or Edge found. Set CHROME_PATH to a Chromium-based browser.')

// A throwaway profile, so an open browser window never blocks the launch.
const userDataDir = mkdtempSync(join(tmpdir(), 'video-render-'))
const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  userDataDir,
  args: ['--no-sandbox', '--no-first-run', '--hide-scrollbars', '--force-color-profile=srgb'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 })
await page.goto(url, { waitUntil: 'networkidle0', timeout: 120000 })
await page.waitForFunction('window.__video', { timeout: 120000 })
const { fps, duration } = await page.evaluate(() => ({ fps: window.__video.fps, duration: window.__video.duration }))

/** Seeks the timeline and waits until the DOM (and Vue) has caught up. */
async function frameAt(t) {
  await page.evaluate(async time => {
    window.__video.seek(time)
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
  }, t)
  return page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 1920, height: 1080 } })
}

if (stills) {
  const dir = resolve('video/stills')
  mkdirSync(dir, { recursive: true })
  for (const s of stills.split(',').map(Number)) {
    writeFileSync(`${dir}/t${s.toFixed(1)}.png`, await frameAt(s))
    console.log(`still ${s}s`)
  }
  await browser.close()
  process.exit(0)
}

mkdirSync(dirname(out), { recursive: true })
const total = Math.round(duration * fps)
const ff = spawn(
  ffmpegPath,
  [
    '-y',
    '-f',
    'image2pipe',
    '-framerate',
    String(fps),
    '-i',
    '-',
    '-c:v',
    'libx264',
    '-preset',
    'medium',
    '-crf',
    '18',
    '-pix_fmt',
    'yuv420p',
    '-r',
    String(fps),
    '-movflags',
    '+faststart',
    out,
  ],
  { stdio: ['pipe', 'ignore', 'inherit'] },
)
const t0 = Date.now()
for (let i = 0; i < total; i++) {
  const png = await frameAt(i / fps)
  if (!ff.stdin.write(png)) await new Promise(r => ff.stdin.once('drain', r))
  if (i % fps === 0) process.stdout.write(`\r${Math.round((i / total) * 100)}%  ${(i / fps).toFixed(0)}/${duration}s`)
}
ff.stdin.end()
await new Promise((r, j) => ff.on('close', code => (code === 0 ? r() : j(new Error(`ffmpeg exited with ${code}`)))))
await browser.close()
console.log(`\nSaved ${out} · ${total} frames · ${((Date.now() - t0) / 1000).toFixed(0)}s`)
