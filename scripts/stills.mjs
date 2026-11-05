// Renders a still every 0.5 s and at the start of every sentence into out/stills/.
// Usage: node scripts/stills.mjs [compositionId] [only=12.5,13.0,...]
import {bundle} from '@remotion/bundler';
import {openBrowser, renderStill, selectComposition} from '@remotion/renderer';
import fs from 'fs';
import path from 'path';

const id = process.argv[2] ?? 'napoleon';
const only = process.argv.find((a) => a.startsWith('only='));
const chrome = '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
const browserExecutable = fs.existsSync(chrome) ? chrome : null;
const settings = JSON.parse(fs.readFileSync(`settings/${id}.json`, 'utf8'));
const words = JSON.parse(fs.readFileSync(path.join('public', settings.audio.words), 'utf8')).words;

const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts')});
const browser = await openBrowser('chrome', {browserExecutable});
const composition = await selectComposition({serveUrl, id, puppeteerInstance: browser, browserExecutable});
const fps = composition.fps;
const last = (composition.durationInFrames - 1) / fps;

const shots = [];
if (only) {
  for (const v of only.slice(5).split(',')) shots.push({t: Number(v), tag: 'x'});
} else {
  for (let t = 0; t <= last + 1e-6; t += 0.5) shots.push({t, tag: 'h'});
  shots.push({t: last, tag: 'end'});
  words.forEach((w, i) => {
    if (i === 0 || /[.!?]$/.test(words[i - 1].text)) shots.push({t: settings.audio.offset + w.start, tag: `s${i}`});
  });
}
const outDir = 'out/stills';
fs.mkdirSync(outDir, {recursive: true});
for (const f of fs.readdirSync(outDir)) if (!only) fs.rmSync(path.join(outDir, f));
const list = [];
for (const s of shots) {
  const frame = Math.min(composition.durationInFrames - 1, Math.round(s.t * fps));
  const file = path.join(outDir, `${(frame / fps).toFixed(2).padStart(5, '0')}_${s.tag}.jpg`);
  await renderStill({serveUrl, composition, frame, output: file, imageFormat: 'jpeg', jpegQuality: 85,
    puppeteerInstance: browser, browserExecutable, overwrite: true});
  list.push(file);
}
await browser.close({silent: true});
console.log(`${list.length} stills in ${outDir}`);
