// ═══════════════════════════════════════════════════════════
//  Carte de suivi en direct (client) — OpenStreetMap dans une WebView.
//  Affiche la position du livreur, le lieu de livraison et l'itinéraire
//  routier entre les deux (OSRM). Gratuit, sans clé API.
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import type { GeoPointDTO } from '../services/dto';
import { LEAFLET_HEAD, tileLayerJs } from '../lib/leaflet';
import { bodyFont } from './ui';

interface Props {
  driver: GeoPointDTO | null;
  destination: GeoPointDTO | null;
  dark: boolean;
}

const ACCENT = '#E8591C';
const GREEN = '#2f8f4e';

function buildHtml(dark: boolean): string {
  return `<!DOCTYPE html><html><head>${LEAFLET_HEAD}</head><body>
<div id="map"></div>
<script>
  var map = L.map('map', { zoomControl:false, attributionControl:true }).setView([4.05, 9.70], 13);
  ${tileLayerJs(dark)}

  var driverMarker=null, destMarker=null, destPulse=null, routeCasing=null, routeLine=null, fitted=false;

  // Livreur : pastille verte avec halo blanc + ombre portée.
  var bikeIcon = L.divIcon({ className:'', iconSize:[44,44], iconAnchor:[22,22], html:
    '<div class="drop-in" style="position:relative;width:44px;height:44px;">'
    + '<div style="position:absolute;inset:0;border-radius:50%;background:${GREEN};opacity:0.18;"></div>'
    + '<div style="position:absolute;left:5px;top:5px;width:34px;height:34px;border-radius:50%;background:${GREEN};'
      + 'border:3px solid #fff;box-shadow:0 6px 14px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;">'
    + '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">'
      + '<circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6h3l-3 8H8l-2-4h9"/></svg></div></div>' });

  // Destination : pin orange net + anneau qui pulse dessous.
  var pinIcon = L.divIcon({ className:'', iconSize:[34,46], iconAnchor:[17,44], html:
    '<div class="drop-in"><svg viewBox="0 0 24 24" width="34" height="46" fill="${ACCENT}" stroke="#fff" stroke-width="1.5" '
      + 'style="filter:drop-shadow(0 5px 8px rgba(0,0,0,.35));"><path d="M12 22s8-6 8-12a8 8 0 0 0-16 0c0 6 8 12 8 12z"/>'
      + '<circle cx="12" cy="10" r="3" fill="#fff"/></svg></div>' });
  var pulseIcon = L.divIcon({ className:'', iconSize:[26,26], iconAnchor:[13,13], html:
    '<div class="pulse-ring" style="width:26px;height:26px;background:${ACCENT};"></div>' });

  function toLL(p){ return [p.lat, p.lon]; }

  async function drawRoute(from, to){
    var latlngs = [toLL(from), toLL(to)]; // repli : ligne droite
    try {
      var url = 'https://router.project-osrm.org/route/v1/driving/'
        + from.lon + ',' + from.lat + ';' + to.lon + ',' + to.lat + '?overview=full&geometries=geojson';
      var r = await fetch(url); var d = await r.json();
      if (d.routes && d.routes[0]) latlngs = d.routes[0].geometry.coordinates.map(function(c){ return [c[1], c[0]]; });
    } catch(e) {}
    if (routeCasing) map.removeLayer(routeCasing);
    if (routeLine) map.removeLayer(routeLine);
    // Casing (contour) sous le trait de couleur → rendu « navigation » pro.
    routeCasing = L.polyline(latlngs, { color:'#ffffff', weight:9, opacity:0.9, lineJoin:'round', lineCap:'round' }).addTo(map);
    routeLine = L.polyline(latlngs, { color:'${ACCENT}', weight:5, opacity:1, lineJoin:'round', lineCap:'round' }).addTo(map);
  }

  window.__update = function(data){
    var driver = data.driver, dest = data.destination;
    if (dest){
      if (!destMarker){
        destPulse = L.marker(toLL(dest), { icon:pulseIcon, interactive:false, zIndexOffset:-100 }).addTo(map);
        destMarker = L.marker(toLL(dest), { icon:pinIcon }).addTo(map);
      } else { destMarker.setLatLng(toLL(dest)); destPulse.setLatLng(toLL(dest)); }
    }
    if (driver){
      if (!driverMarker) driverMarker = L.marker(toLL(driver), { icon:bikeIcon, zIndexOffset:200 }).addTo(map);
      else driverMarker.setLatLng(toLL(driver));
    }
    if (driver && dest) drawRoute(driver, dest);
    // Recadre une seule fois (ne pas rezoomer à chaque mouvement du livreur).
    if (!fitted){
      var pts = [];
      if (driver) pts.push(toLL(driver));
      if (dest) pts.push(toLL(dest));
      if (pts.length >= 2){ map.fitBounds(pts, { padding:[50,50], maxZoom:16 }); fitted = true; }
      else if (pts.length === 1){ map.setView(pts[0], 15); }
    }
  };
</script></body></html>`;
}

export function LiveDeliveryMap({ driver, destination, dark }: Props) {
  const webRef = useRef<WebView>(null);
  const html = useMemo(() => buildHtml(dark), [dark]);

  const push = () => {
    webRef.current?.injectJavaScript(
      `window.__update && window.__update(${JSON.stringify({ driver, destination })}); true;`,
    );
  };

  // Repousse les positions à chaque changement (le livreur bouge ~toutes les 5 s).
  useEffect(() => {
    push();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driver?.lat, driver?.lon, destination?.lat, destination?.lon]);

  if (!driver && !destination) {
    return (
      <View style={[styles.fallback, { backgroundColor: dark ? '#0f1a13' : '#e9efe9' }]}>
        <Text style={[bodyFont(12.5, '600'), { color: '#8a938c' }]}>
          Position du livreur bientôt disponible…
        </Text>
      </View>
    );
  }

  return (
    <WebView
      ref={webRef}
      source={{ html }}
      style={StyleSheet.absoluteFill}
      originWhitelist={['*']}
      javaScriptEnabled
      domStorageEnabled
      scrollEnabled={false}
      onLoadEnd={push}
    />
  );
}

const styles = StyleSheet.create({
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
