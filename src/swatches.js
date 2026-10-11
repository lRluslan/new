// Small pixel-art previews for the element buttons.

import * as El from './elements.js';
import { rng } from './scenes.js';

const rgb = h => El.hexToRgb(h);
const mix = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];

export function drawSwatch(canvas, t) {
  const ctx = canvas.getContext('2d');
  const S = 10;
  canvas.width = S; canvas.height = S;
  const rand = rng(t * 97 + 3);
  const pal = El.ELEMENTS[t].c2.map(rgb);
  const img = ctx.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let c = pal[(rand() * pal.length) | 0];
    if (t === El.DIRT && y < 3) c = rgb(['#a6e05a', '#74c447', '#53a53d'][y]);
    else if (y === 0 && El.STATE[t] !== El.GAS) c = mix(c, [255, 244, 210], 0.3);
    if (t === El.FIRE) c = rgb(['#fff2b0', '#ffd04a', '#ff8a1f', '#e04a17'][Math.min(3, Math.floor((S - 1 - y) / 2.6) + (rand() < 0.3 ? 1 : 0))]);
    const o = (y * S + x) * 4;
    img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}
