import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// WCAG relative luminance, measured against the current light-theme tokens.
const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
const token = name => {
  const values = [...css.matchAll(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})\\s*;`, 'gi'))];
  assert.ok(values.length, `Falta el token ${name}`);
  return values.at(-1)[1];
};
const rgb = hex => hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255);
const luminance = values => values.map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
  .reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
const contrast = (a, b) => {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
};
assert.equal(contrast(rgb('#000000'), rgb('#ffffff')), 21);
const pairs = [
  ['Texto principal / fondo', 'foreground', 'background', 4.5],
  ['Texto principal / tarjeta', 'foreground', 'card', 4.5],
  ['Ayuda / tarjeta', 'muted-foreground', 'card', 4.5],
  ['Ayuda / fondo', 'muted-foreground', 'background', 4.5],
  ['Ayuda / superficie secundaria', 'muted-foreground', 'secondary', 4.5],
  ['Acción principal', 'primary-foreground', 'primary', 4.5],
  ['Acción secundaria', 'secondary-foreground', 'secondary', 4.5],
  ['Error / tarjeta', 'destructive', 'card', 4.5],
  ['Error / fondo', 'destructive', 'background', 4.5],
  ['Borde de campo / tarjeta', 'input', 'card', 3],
  ['Borde de campo / fondo', 'input', 'background', 3],
  ['Borde de control / selección', 'input', 'primary', 3],
  ['Foco / tarjeta', 'ring', 'card', 3],
  ['Foco / fondo', 'ring', 'background', 3],
  ['Foco / acción principal', 'ring', 'primary', 3],
  ['Texto de navegación', 'sidebar-foreground', 'sidebar', 4.5],
  ['Texto de navegación seleccionado', 'sidebar-primary-foreground', 'sidebar-primary', 4.5],
  ['Foco de navegación', 'sidebar-ring', 'sidebar', 3],
];
// These two selectors override the navigation token; measure their actual colors.
const navigationColor = css.match(/\[data-slot=sidebar-menu-button\]\s*\{[^}]*color:\s*(#[0-9a-f]{6})/i)?.[1];
const sectionColor = css.match(/\.nav-section-label,\.nav-section-trigger\s*\{[^}]*color:\s*(#[0-9a-f]{6})/i)?.[1];
assert.ok(navigationColor && sectionColor, 'Faltan los colores de navegación renderizados');
pairs.push(['Enlaces de navegación renderizados', navigationColor, 'sidebar', 4.5]);
pairs.push(['Secciones de navegación renderizadas', sectionColor, 'sidebar', 4.5]);
const color = value => value.startsWith('#') ? value : token(value);
for (const [name, foreground, background, minimum] of pairs) {
  const ratio = contrast(rgb(color(foreground)), rgb(color(background)));
  console.log(`${ratio >= minimum ? 'OK' : 'ERROR'} ${name}: ${ratio.toFixed(3)}:1 (mínimo ${minimum}:1)`);
  assert.ok(ratio >= minimum, `Contraste insuficiente: ${name}`);
}
const oldFocus = rgb(token('ring')).map((value, index) => value * .5 + rgb(token('card'))[index] * .5);
console.log(`Referencia de foco anterior al 50 %: ${contrast(oldFocus, rgb(token('card'))).toFixed(3)}:1. El foco actual usa contorno opaco.`);
console.log(`${pairs.length} pares del tema claro verificados; complementar con estilos renderizados y recorrido de teclado.`);
