// Сборка живой 3D-сцены в один HTML (скрипт + модели base64) -> src/game3d/html.ts и game3d/dist/index.html
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const res = await build({
  entryPoints: [path.join(here, 'src', 'main.js')], bundle: true, minify: true, format: 'iife', write: false,
  target: ['safari15'], loader: { '.json': 'json' }, legalComments: 'none',
});
const js = res.outputFiles[0].text;
const models = ['fish', 'cats', 'env', 'items'].map((n) => {
  const b = fs.readFileSync(path.join(here, 'models', 'packed', n + '.glb'));
  return `<script type="application/octet-stream" id="m_${n}">${b.toString('base64')}</script>`;
}).join('\n');
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<style>html,body{margin:0;height:100%;overflow:hidden;background:#1b2a3a;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}canvas{display:block;width:100vw;height:100vh;touch-action:none}</style>
</head><body><canvas id="c"></canvas>
${models}
<script>${js.replace(/<\/script/g, '<\/script')}</script></body></html>`;
fs.mkdirSync(path.join(here, 'dist'), { recursive: true });
fs.writeFileSync(path.join(here, 'dist', 'index.html'), html);
fs.mkdirSync(path.join(root, 'src', 'game3d'), { recursive: true });
fs.writeFileSync(path.join(root, 'src', 'game3d', 'html.ts'), '// АВТОГЕНЕРАЦИЯ: game3d/build.mjs\nconst HTML: string = ' + JSON.stringify(html) + ';\nexport default HTML;\n');
console.log('html', Math.round(html.length / 1024), 'KB, js', Math.round(js.length / 1024), 'KB');
