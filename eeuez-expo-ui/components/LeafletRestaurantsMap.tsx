// ═══════════════════════════════════════════════════════════
//  Carte des restaurants (onglet Carte) — OpenStreetMap / WebView.
//  Pins riches (photo + note) rendus en HTML ; le tap remonte à
//  React Native. Gratuit, sans clé API.
// ═══════════════════════════════════════════════════════════

import React, { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { LEAFLET_HEAD, tileLayerJs } from '../lib/leaflet';

export interface RestoMarker {
  id: number;
  lat: number;
  lon: number;
  image?: string | null;
  rating: number | string;
  c1: string;   // couleur dégradé 1
  c2: string;   // couleur dégradé 2
}

export interface LeafletRestosHandle {
  animateTo: (lat: number, lng: number, zoom?: number) => void;
  recenter: (lat: number, lng: number) => void;
}

interface Props {
  markers: RestoMarker[];
  initialLat: number;
  initialLng: number;
  dark: boolean;
  selectedId: number | null;
  onSelect: (id: number | null) => void;
}

export const LeafletRestaurantsMap = forwardRef<LeafletRestosHandle, Props>(
  function LeafletRestaurantsMap({ markers, initialLat, initialLng, dark, selectedId, onSelect }, ref) {
    const webRef = useRef<WebView>(null);

    useImperativeHandle(ref, () => ({
      animateTo: (lat, lng, zoom = 15) =>
        webRef.current?.injectJavaScript(`window.__animateTo(${lat}, ${lng}, ${zoom}); true;`),
      recenter: (lat, lng) =>
        webRef.current?.injectJavaScript(`window.__animateTo(${lat}, ${lng}, 12); true;`),
    }));

    const html = useMemo(
      () => `<!DOCTYPE html><html><head>${LEAFLET_HEAD}
<style>
  .rpin { position:relative; width:52px; height:60px; transition:transform .18s cubic-bezier(0.16,1,0.3,1); }
  .rpin.active { transform:scale(1.14); z-index:1000; }
  .rphoto { position:absolute; left:3px; top:0; width:46px; height:46px; border-radius:50%;
            border:3px solid #fff; box-shadow:0 6px 14px rgba(0,0,0,0.32);
            background-size:cover; background-position:center; }
  .rtail { position:absolute; left:50%; top:44px; width:12px; height:12px; margin-left:-6px;
           background:#fff; transform:rotate(45deg); border-radius:0 0 3px 0;
           box-shadow:3px 3px 6px rgba(0,0,0,0.18); }
  .rpin.active .rphoto { border-color:#E8591C; box-shadow:0 8px 20px rgba(232,89,28,0.45); }
  .rpin.active .rtail  { background:#E8591C; }
  .rring { position:absolute; left:-2px; top:-5px; width:56px; height:56px; background:#E8591C; }
  .rbadge { position:absolute; top:-7px; right:-8px; z-index:5; background:#12331f;
            border:1.5px solid #fff; border-radius:20px; padding:1px 6px;
            font:800 10px -apple-system, sans-serif; color:#F3C64B; white-space:nowrap;
            box-shadow:0 3px 6px rgba(0,0,0,0.25); }
</style></head><body>
<div id="map"></div>
<script>
  var map = L.map('map', { zoomControl:false, attributionControl:true }).setView([${initialLat}, ${initialLng}], 12);
  ${tileLayerJs(dark)}
  map.on('click', function(){ post({ type:'deselect' }); });

  function post(o){ if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(o)); }

  var layer = L.layerGroup().addTo(map);
  var _markers = [];
  var _byId = {};
  var _sel = null;

  function iconFor(m, active){
    var bg = m.image
      ? "background-image:url('" + m.image + "');"
      : "background-image:linear-gradient(135deg," + m.c1 + "," + m.c2 + ");";
    var ring = active ? '<div class="rring pulse-ring"></div>' : '';
    var html = '<div class="rpin ' + (active ? 'active' : '') + ' drop-in">'
      + ring
      + '<div class="rbadge">★ ' + m.rating + '</div>'
      + '<div class="rtail"></div>'
      + '<div class="rphoto" style="' + bg + '"></div></div>';
    return L.divIcon({ className:'', html:html, iconSize:[52,60], iconAnchor:[26,56] });
  }

  window.__setMarkers = function(list, sel){
    _markers = list; _sel = sel; _byId = {};
    layer.clearLayers();
    list.forEach(function(m){
      var mk = L.marker([m.lat, m.lon], { icon: iconFor(m, m.id === sel) });
      mk.on('click', function(e){ L.DomEvent.stopPropagation(e); post({ type:'select', id:m.id }); });
      _byId[m.id] = { mk:mk, m:m };
      layer.addLayer(mk);
    });
  };
  // Ne met à jour QUE les pins concernés (pas de rebuild global → pas de clignotement).
  window.__setSel = function(sel){
    var prev = _sel; _sel = sel;
    if (prev != null && _byId[prev]) _byId[prev].mk.setIcon(iconFor(_byId[prev].m, false));
    if (sel != null && _byId[sel]) _byId[sel].mk.setIcon(iconFor(_byId[sel].m, true));
  };
  window.__animateTo = function(la, ln, z){ map.setView([la, ln], z || 15, { animate:true }); };
</script></body></html>`,
      [dark],
    );

    // Injecte / met à jour les marqueurs quand la liste change.
    const markersJson = JSON.stringify(markers);
    React.useEffect(() => {
      webRef.current?.injectJavaScript(
        `window.__setMarkers && window.__setMarkers(${markersJson}, ${selectedId ?? 'null'}); true;`,
      );
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [markersJson]);

    // Met à jour le surlignage quand la sélection change.
    React.useEffect(() => {
      webRef.current?.injectJavaScript(
        `window.__setSel && window.__setSel(${selectedId ?? 'null'}); true;`,
      );
    }, [selectedId]);

    return (
      <WebView
        ref={webRef}
        source={{ html }}
        style={StyleSheet.absoluteFill}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        onLoadEnd={() =>
          webRef.current?.injectJavaScript(
            `window.__setMarkers && window.__setMarkers(${markersJson}, ${selectedId ?? 'null'}); true;`,
          )
        }
        onMessage={(e) => {
          try {
            const d = JSON.parse(e.nativeEvent.data);
            if (d.type === 'select') onSelect(Number(d.id));
            else if (d.type === 'deselect') onSelect(null);
          } catch { /* ignore */ }
        }}
      />
    );
  },
);
