// ═══════════════════════════════════════════════════════════
//  Carte interactive (choix du lieu) — OpenStreetMap dans une WebView.
//  Le centre de la carte = le lieu choisi (le pin fixe est dessiné
//  par-dessus côté React Native). Gratuit, sans clé API.
// ═══════════════════════════════════════════════════════════

import React, { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { LEAFLET_HEAD, tileLayerJs } from '../lib/leaflet';

export interface LeafletPickerHandle {
  moveTo: (lat: number, lng: number) => void;
}

interface Props {
  initialLat: number;
  initialLng: number;
  dark: boolean;
  /** Appelé (débouncé côté carte) quand le centre change. */
  onCenterChange: (lat: number, lng: number) => void;
}

function buildHtml(lat: number, lng: number, dark: boolean): string {
  return `<!DOCTYPE html><html><head>${LEAFLET_HEAD}</head><body>
<div id="map"></div>
<script>
  var map = L.map('map', { zoomControl:false, attributionControl:true }).setView([${lat}, ${lng}], 16);
  ${tileLayerJs(dark)}
  function post(){
    var c = map.getCenter();
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type:'center', lat:c.lat, lng:c.lng }));
    }
  }
  map.on('moveend', post);
  window.__moveTo = function(la, ln){ map.setView([la, ln], 16, { animate:true }); };
</script></body></html>`;
}

export const LeafletPickerMap = forwardRef<LeafletPickerHandle, Props>(
  function LeafletPickerMap({ initialLat, initialLng, dark, onCenterChange }, ref) {
    const webRef = useRef<WebView>(null);

    useImperativeHandle(ref, () => ({
      moveTo: (lat: number, lng: number) => {
        webRef.current?.injectJavaScript(`window.__moveTo(${lat}, ${lng}); true;`);
      },
    }));

    // Construit le HTML une seule fois (les déplacements passent par __moveTo).
    const html = useMemo(() => buildHtml(initialLat, initialLng, dark), [dark]);

    return (
      <WebView
        ref={webRef}
        source={{ html }}
        style={StyleSheet.absoluteFill}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        onMessage={(e) => {
          try {
            const d = JSON.parse(e.nativeEvent.data);
            if (d.type === 'center') onCenterChange(d.lat, d.lng);
          } catch { /* ignore */ }
        }}
      />
    );
  },
);
