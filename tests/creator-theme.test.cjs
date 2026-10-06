const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(file) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports: {} };
  new Function('module', 'exports', code)(mod, mod.exports);
  return mod.exports;
}
const themes = load('src/lib/creatorTheme.ts');
const websitePath = path.resolve('../fanbase-mvp/src/lib/creatorThemes.ts');
test('all mobile theme accents match the actual canonical backend mapping', { skip: !fs.existsSync(websitePath) }, () => {
  const website = load(websitePath);
  assert.deepEqual(Object.keys(themes.CREATOR_THEME_ACCENTS).sort(), Object.keys(website.CREATOR_THEMES).sort());
  for (const key of Object.keys(website.CREATOR_THEMES)) assert.equal(themes.creatorTheme(key).accent, website.getTheme(key).preview.accent);
});
function luminance(hex) {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(x => x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
  return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
}
const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
test('all theme and fallback buttons and secondary text retain at least 4.5:1 contrast', () => {
  for (const key of [...Object.keys(themes.CREATOR_THEME_ACCENTS), null]) {
    const t = themes.creatorTheme(key);
    assert.ok(contrast(t.accent, t.onAccent) >= 4.5, `Button contrast: ${key}`);
    assert.ok(contrast(t.textAccent, '#130C1C') >= 4.5, `Secondary text contrast: ${key}`);
  }
});
test('unknown keys use standard Vera purple and decorative tokens remain translucent', () => {
  for (const key of [null, undefined, '', 'garbage', '#ff0000', 'constructor']) {
    const t = themes.creatorTheme(key);
    assert.equal(t.key, null); assert.equal(t.accent, themes.VERA_ACCENT);
    assert.equal(t.soft, `${t.accent}14`); assert.equal(t.border, `${t.accent}29`); assert.equal(t.glow, `${t.accent}24`);
  }
});
