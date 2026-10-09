/**
 * Po `vite build` vytvorí z dist/index.html samostatný súbor so všetkým kódom vo vnútri:
 *   dist/elektrolab.html – otvoríš ho dvojklikom, netreba server ani internet (okrem písma).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
let html = readFileSync(join(dist, 'index.html'), 'utf8');

html = html.replace(/<link rel="stylesheet"[^>]*href="\.\/(assets\/[^"]+\.css)"[^>]*>/g, (_, file) => {
  const css = readFileSync(join(dist, file), 'utf8');
  return `<style>\n${css}\n</style>`;
});

html = html.replace(/<script type="module"[^>]*src="\.\/(assets\/[^"]+\.js)"[^>]*><\/script>/g, (_, file) => {
  const js = readFileSync(join(dist, file), 'utf8').replace(/<\/script/gi, '<\\/script');
  return `<script type="module">\n${js}\n</script>`;
});

if (/src="\.\/assets|href="\.\/assets/.test(html)) {
  throw new Error('V dist/index.html zostal odkaz na assets – vkladanie zlyhalo.');
}

writeFileSync(join(dist, 'elektrolab.html'), html);
console.log(`dist/elektrolab.html (${Math.round(html.length / 1024)} kB)`);
