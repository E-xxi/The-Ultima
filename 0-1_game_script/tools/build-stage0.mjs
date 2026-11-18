// 사용법: node tools/build-stage0.mjs → stage0/index.html (단일 파일, 외부 의존 없음)
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

const renderer = read('src/scriptRenderer.mjs').replace(/^export /gm, '');
const data = [
  `const G = ${read('data/graphemes.json')};`,
  `const P = ${read('data/phonemes.sample.json')};`,
  `const S = ${read('data/stage0.json')};`,
].join('\n');

const html = read('stage0/template.html')
  .replace('/*__RENDERER__*/', () => renderer)
  .replace('/*__DATA__*/', () => data);
writeFileSync(join(root, 'stage0/index.html'), html);
console.log('stage0/index.html', html.length, 'bytes');
