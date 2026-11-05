import {Config} from '@remotion/cli/config';
import fs from 'fs';

// Use the pre-installed headless Chromium when it exists (cloud container).
const chrome =
  process.env.REMOTION_CHROME ??
  '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
if (fs.existsSync(chrome)) Config.setBrowserExecutable(chrome);

Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(95);
Config.setPixelFormat('yuv420p');
Config.setCodec('h264');
Config.setCrf(16);
