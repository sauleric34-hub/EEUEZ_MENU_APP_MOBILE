// ═══════════════════════════════════════════════════════════
//  Génère data/geo/ (pays + villes) depuis le paquet country-state-city.
//  Données compactées : seuls les noms des villes sont gardés, groupés par
//  pays, pour alléger le bundle (≈ 8 Mo → quelques Mo).
//  Usage : node scripts/generate-geo.js
// ═══════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const countries = require('country-state-city/lib/assets/country.json');
const cities = require('country-state-city/lib/assets/city.json');

const outDir = path.join(__dirname, '..', 'data', 'geo');
fs.mkdirSync(outDir, { recursive: true });

const frNames = new Intl.DisplayNames(['fr'], { type: 'region' });
const collator = new Intl.Collator('fr', { sensitivity: 'base' });

const countryList = countries
  .map(c => {
    let name = c.name;
    try { name = frNames.of(c.isoCode) || c.name; } catch { /* code inconnu d'ICU */ }
    return { code: c.isoCode, name };
  })
  .sort((a, b) => collator.compare(a.name, b.name));

const byCountry = {};
for (const [name, code] of cities) {
  (byCountry[code] ||= new Set()).add(name.trim());
}
const cityMap = {};
for (const code of Object.keys(byCountry).sort()) {
  cityMap[code] = [...byCountry[code]].sort(collator.compare);
}

fs.writeFileSync(
  path.join(outDir, 'countries.ts'),
  '// Fichier généré par scripts/generate-geo.js — ne pas modifier à la main.\n' +
  'export const COUNTRIES: { code: string; name: string }[] = [\n' +
  countryList.map(c => `  { code: '${c.code}', name: ${JSON.stringify(c.name)} },`).join('\n') +
  '\n];\n',
);
fs.writeFileSync(path.join(outDir, 'cities.json'), JSON.stringify(cityMap));

console.log(`${countryList.length} pays, ${cities.length} villes → ${outDir}`);
