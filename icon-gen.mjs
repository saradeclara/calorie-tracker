import { chromium } from "playwright";
const svg = (pad) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<rect width="512" height="512" fill="#1d1b18"/>
<g transform="translate(256 256) scale(${pad})">
<circle r="150" fill="none" stroke="#3a3530" stroke-width="44"/>
<circle r="150" fill="none" stroke="#e4572e" stroke-width="44" stroke-linecap="round" stroke-dasharray="942" stroke-dashoffset="250" transform="rotate(-90)"/>
<circle r="52" fill="#f6f3ee"/>
</g></svg>`;
const b = await chromium.launch(); const p = await b.newPage();
for (const [name, size, pad] of [["icon-192.png",192,1],["icon-512.png",512,1],["apple-touch-icon.png",180,1],["icon-maskable-512.png",512,0.72]]) {
  await p.setViewportSize({width:size,height:size});
  await p.setContent(`<html><body style="margin:0">${svg(pad).replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await p.screenshot({path:`public/${name}`, omitBackground:false});
}
await b.close();
