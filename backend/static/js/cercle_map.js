// ═══════════════════════════════════════════════════════════
//  Carte « cercle » — ciblage des bannières (admin)
//  Un clic place le centre, le rayon (km) se règle dans un champ ;
//  le marqueur se déplace en le faisant glisser. Les valeurs sont
//  recopiées dans des champs cachés du formulaire.
// ═══════════════════════════════════════════════════════════

function cartoTileUrlCercle() {
  const key = window.CARTO_API_KEY || '';
  return `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png${key ? `?key=${encodeURIComponent(key)}` : ''}`;
}

/**
 * @param {object} o
 * @param {string} o.mapId       conteneur de la carte
 * @param {string} o.latId       champ latitude
 * @param {string} o.lonId       champ longitude
 * @param {string} o.rayonId     champ rayon (km)
 * @param {string} [o.clearId]   bouton « effacer le cercle »
 * @param {string} [o.infoId]    zone de texte d'état
 * @param {string} [o.color]
 * @returns {{ map: L.Map, addReference: Function }}
 */
function initCercleMap(o) {
  const latInput = document.getElementById(o.latId);
  const lonInput = document.getElementById(o.lonId);
  const rayonInput = document.getElementById(o.rayonId);
  const info = o.infoId ? document.getElementById(o.infoId) : null;
  const color = o.color || '#f26a1b';

  const map = L.map(o.mapId, { zoomControl: true }).setView([4.05, 9.7], 11); // Douala par défaut
  L.tileLayer(cartoTileUrlCercle(), {
    attribution: '© OpenStreetMap © CARTO', subdomains: 'abcd', maxZoom: 19,
  }).addTo(map);

  let marker = null, circle = null;

  function rayonKm() {
    const r = parseFloat(String(rayonInput.value).replace(',', '.'));
    return r > 0 ? r : 0;
  }

  function majInfo() {
    if (!info) return;
    info.textContent = marker
      ? `Centre : ${(+latInput.value).toFixed(5)}, ${(+lonInput.value).toFixed(5)} — rayon ${rayonKm() || '?'} km`
      : 'Cliquez sur la carte pour placer le centre du cercle.';
  }

  function dessiner(lat, lon, fit) {
    latInput.value = lat.toFixed(6);
    lonInput.value = lon.toFixed(6);
    if (!rayonKm()) rayonInput.value = 3;
    if (!marker) {
      marker = L.marker([lat, lon], { draggable: true }).addTo(map);
      marker.on('drag', e => {
        const p = e.target.getLatLng();
        latInput.value = p.lat.toFixed(6);
        lonInput.value = p.lng.toFixed(6);
        circle.setLatLng(p);
        majInfo();
      });
      circle = L.circle([lat, lon], {
        radius: rayonKm() * 1000, color, weight: 2, fillColor: color, fillOpacity: 0.18,
      }).addTo(map);
    } else {
      marker.setLatLng([lat, lon]);
      circle.setLatLng([lat, lon]);
    }
    circle.setRadius(rayonKm() * 1000);
    if (fit) map.fitBounds(circle.getBounds(), { padding: [30, 30] });
    majInfo();
  }

  function effacer() {
    if (marker) { map.removeLayer(marker); map.removeLayer(circle); }
    marker = circle = null;
    latInput.value = lonInput.value = rayonInput.value = '';
    majInfo();
  }

  map.on('click', e => dessiner(e.latlng.lat, e.latlng.lng, false));
  rayonInput.addEventListener('input', () => {
    if (circle) { circle.setRadius(rayonKm() * 1000); majInfo(); }
  });
  if (o.clearId) document.getElementById(o.clearId).addEventListener('click', effacer);

  // Valeurs existantes (édition)
  const lat0 = parseFloat(latInput.value), lon0 = parseFloat(lonInput.value);
  if (!isNaN(lat0) && !isNaN(lon0)) dessiner(lat0, lon0, true);
  else majInfo();

  // La carte peut être créée dans un conteneur qui vient d'apparaître
  setTimeout(() => map.invalidateSize(), 200);

  /** Cercle de référence (zone réutilisable) affiché en pointillés. */
  function addReference(lat, lon, rayon, label) {
    return L.circle([lat, lon], {
      radius: rayon * 1000, color: '#3b82f6', weight: 1.5, dashArray: '6 6', fillOpacity: 0.06,
    }).bindTooltip(label).addTo(map);
  }

  return { map, addReference };
}
