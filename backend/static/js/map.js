/* ===================== MENU ADMIN — MAP.JS ===================== */

// Tuiles CARTO : depuis 2025, une clé API est exigée (sinon filigrane
// "API KEY REQUIRED"). Clé injectée par le template via window.CARTO_API_KEY.
function cartoTileUrl() {
  const key = window.CARTO_API_KEY || '';
  return `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png${key ? `?api_key=${encodeURIComponent(key)}` : ''}`;
}

let map, allMarkers = [], markerGroup;

document.addEventListener('DOMContentLoaded', initMap);

function initMap() {
  const mapEl = document.getElementById('eeuez-map');
  if (!mapEl) return;

  map = L.map('eeuez-map', {
    center: [3.848, 11.502],
    zoom: 12,
    zoomControl: false,
    attributionControl: true,
  });

  L.control.zoom({ position: 'bottomright' }).addTo(map);

  L.tileLayer(cartoTileUrl(), {
    attribution: '© OpenStreetMap © CARTO',
    subdomains: 'abcd',
    maxZoom: 19,
  }).addTo(map);

  markerGroup = L.layerGroup().addTo(map);

  loadRestaurants();
  initMapFilters();
}

function loadRestaurants() {
  fetch('/admin-panel/api/restaurants/geojson/')
    .then(r => r.json())
    .then(data => {
      allMarkers = [];
      markerGroup.clearLayers();

      data.features.forEach(f => {
        const props = f.properties;
        const [lng, lat] = f.geometry.coordinates;

        const icon = L.divIcon({
          className: '',
          html: `<div class="map-marker" style="background:${props.color};box-shadow:0 0 12px ${props.color}80;">
                   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
                     <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                     <polyline points="9 22 9 12 15 12 15 22"/>
                   </svg>
                 </div>`,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        });

        const marker = L.marker([lat, lng], { icon });
        marker.props = props;

        marker.on('click', () => showSidePanel(props));
        markerGroup.addLayer(marker);
        allMarkers.push(marker);
      });

      updateMapStats(data.features.length);
    })
    .catch(err => console.error('GeoJSON error:', err));
}

function showSidePanel(props) {
  const panel = document.getElementById('map-panel');
  if (!panel) return;

  const statusLabel = props.is_verified && props.is_active ? 'Actif' : (!props.is_verified ? 'En attente' : 'Suspendu');
  const statusColor = props.color;
  const stars = '★'.repeat(Math.round(props.note)) + '☆'.repeat(5 - Math.round(props.note));

  panel.innerHTML = `
    <div class="map-panel-header">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
        <span style="width:10px;height:10px;border-radius:50%;background:${statusColor};display:inline-block;box-shadow:0 0 8px ${statusColor};"></span>
        <span style="font-size:0.7rem;color:${statusColor};text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">${statusLabel}</span>
      </div>
      <h3 style="font-size:1.1rem;font-weight:700;color:#F9FAFB;margin-bottom:4px;">${props.nom}</h3>
      <p style="font-size:0.8rem;color:#9CA3AF;">${props.adresse}, ${props.ville}</p>
    </div>
    <div style="padding:16px;display:flex;flex-direction:column;gap:10px;">
      <div style="color:#F59E0B;font-size:1rem;letter-spacing:2px;">${stars}
        <span style="color:#9CA3AF;font-size:0.75rem;margin-left:4px;">${props.note.toFixed(1)}/5</span>
      </div>
      <div class="stat-row">
        <span class="stat-row-label">Commandes</span>
        <span class="stat-row-value">${props.nb_commandes.toLocaleString('fr-FR')}</span>
      </div>
      <div class="stat-row">
        <span class="stat-row-label">CA Total</span>
        <span class="stat-row-value">${props.ca.toLocaleString('fr-FR')} FCFA</span>
      </div>
      <div class="stat-row">
        <span class="stat-row-label">Commission</span>
        <span class="stat-row-value" style="color:#10B981;">${props.commission_rate}%</span>
      </div>
      <div class="stat-row">
        <span class="stat-row-label">Statut ouverture</span>
        <span class="stat-row-value">${props.is_open ? '<span style="color:#10B981;">Ouvert</span>' : '<span style="color:#EF4444;">Fermé</span>'}</span>
      </div>
      <a href="${props.url}" class="btn btn-primary" style="margin-top:8px;justify-content:center;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        Voir le détail
      </a>
    </div>
  `;
  panel.classList.add('active');
}

function initMapFilters() {
  document.getElementById('filter-all')?.addEventListener('click', () => filterMarkers('all'));
  document.getElementById('filter-actif')?.addEventListener('click', () => filterMarkers('actif'));
  document.getElementById('filter-attente')?.addEventListener('click', () => filterMarkers('attente'));
  document.getElementById('filter-suspendu')?.addEventListener('click', () => filterMarkers('suspendu'));
  document.getElementById('map-panel-close')?.addEventListener('click', () => {
    document.getElementById('map-panel')?.classList.remove('active');
  });
}

function filterMarkers(type) {
  document.querySelectorAll('.map-filter-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('filter-' + type)?.classList.add('active');

  allMarkers.forEach(m => {
    const p = m.props;
    let show = true;
    if (type === 'actif') show = p.is_verified && p.is_active;
    else if (type === 'attente') show = !p.is_verified;
    else if (type === 'suspendu') show = !p.is_active && p.is_verified;

    if (show) markerGroup.addLayer(m);
    else markerGroup.removeLayer(m);
  });
}

function updateMapStats(total) {
  const el = document.getElementById('map-total');
  if (el) el.textContent = total;
}

// Mini-map for deliveries page
function initMiniMap(containerId, lat, lng, label = '') {
  const el = document.getElementById(containerId);
  if (!el || !lat || !lng) return;

  const miniMap = L.map(containerId, { zoomControl: false, dragging: false, scrollWheelZoom: false });
  L.tileLayer(cartoTileUrl(), { maxZoom: 17 }).addTo(miniMap);
  miniMap.setView([lat, lng], 14);

  L.circleMarker([lat, lng], {
    radius: 8, fillColor: '#38A169', color: '#fff', weight: 2, fillOpacity: 0.9
  }).bindPopup(label).addTo(miniMap);
}

window.MENU_MAP = { initMiniMap };
