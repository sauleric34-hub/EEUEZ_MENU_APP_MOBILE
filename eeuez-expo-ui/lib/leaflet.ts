// ═══════════════════════════════════════════════════════════
//  Helpers pour les cartes Leaflet / OpenStreetMap (dans une WebView)
//  Tuiles CARTO (OSM) + itinéraires OSRM (gratuit, sans clé, pour OSRM).
//  Style « Voyager » (clair) / « Dark Matter » (sombre) — rendu pro.
//  Depuis 2025, CARTO exige une clé API sur ses tuiles basemaps.cartocdn.com
//  (sinon filigrane "API KEY REQUIRED") — clé gratuite jusqu'à 5M req/mois :
//  https://carto.com/basemaps/apikey/ — à définir dans EXPO_PUBLIC_CARTO_API_KEY.
// ═══════════════════════════════════════════════════════════

const CARTO_API_KEY = process.env.EXPO_PUBLIC_CARTO_API_KEY || '';

/** Balises <head> : Leaflet + styles de base partagés (pins, pulses…). */
export const LEAFLET_HEAD = `
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  html, body, #map { margin:0; padding:0; height:100%; width:100%; }
  #map { background:#e7ecef; }
  .leaflet-container { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  .leaflet-control-attribution {
    font-size:9px; background:rgba(255,255,255,0.65)!important; color:#6b7280!important;
    padding:1px 5px; border-radius:6px 0 0 0;
  }
  .leaflet-bar a { border-radius:10px!important; }
  .leaflet-popup-content-wrapper {
    background:#ffffff; color:#12331f; border-radius:14px; box-shadow:0 10px 30px rgba(0,0,0,0.18);
  }
  .leaflet-popup-tip { background:#ffffff; }

  /* Anneau qui pulse (destination / arrivée) */
  .pulse-ring { border-radius:50%; animation:pulse 1.8s ease-out infinite; }
  @keyframes pulse {
    0%   { transform:scale(0.6); opacity:0.55; }
    70%  { transform:scale(1.9); opacity:0; }
    100% { transform:scale(1.9); opacity:0; }
  }
  /* Apparition douce des marqueurs */
  .drop-in { animation:dropIn 0.35s cubic-bezier(0.16,1,0.3,1) both; }
  @keyframes dropIn { from { transform:translateY(-10px); opacity:0; } to { transform:translateY(0); opacity:1; } }
</style>`;

/** URL des tuiles selon le thème (CARTO, basé sur OpenStreetMap). */
export const tileUrl = (dark: boolean): string => {
  const base = dark
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
  return CARTO_API_KEY ? `${base}?key=${encodeURIComponent(CARTO_API_KEY)}` : base;
};

/** Extrait de code JS qui pose la couche de tuiles (rétine incluse) sur `map`. */
export const tileLayerJs = (dark: boolean): string =>
  `L.tileLayer('${tileUrl(dark)}', {
     attribution:'© OpenStreetMap © CARTO', maxZoom:20, detectRetina:true, subdomains:'abcd'
   }).addTo(map);`;
