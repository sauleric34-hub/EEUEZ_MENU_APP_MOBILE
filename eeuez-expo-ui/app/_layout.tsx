import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { AppProvider, useApp } from '../context/AppContext';
import { ToastProvider } from '../context/ToastContext';
import { ErrorBoundary } from '../components/ErrorBoundary';

function ThemedStatusBar() {
  const { mode } = useApp();
  return <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />;
}

/** Ouvre le bon écran quand l'utilisateur tape une notification push. */
function NotificationRouter() {
  const router = useRouter();
  const { user } = useApp();
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let sub: { remove: () => void } | undefined;
    try {
      sub = Notifications.addNotificationResponseReceivedListener(resp => {
        const data = resp.notification.request.content.data as Record<string, unknown>;
        const type = data?.type;
        if (user?.role === 'livreur') {
          if (type === 'mission') router.push('/(livreur)');
          else if (type === 'course' || type === 'paiement') router.push('/(livreur)/gains');
        } else if (type === 'commande') {
          router.push('/tracking');
        }
      });
    } catch { /* push indisponible sur cet environnement */ }
    return () => sub?.remove();
  }, [router, user?.role]);
  return null;
}

// Sur navigateur, l'app garde son design mobile mais dans une colonne
// centrée à largeur maximale (façon app installée), au lieu de s'étirer sur
// toute la largeur de l'écran. Ne change rien sur natif (iOS/Android).
const WEB_MAX_WIDTH = 480;

function WebFrame({ children }: { children: React.ReactNode }) {
  if (Platform.OS !== 'web') return <>{children}</>;
  return (
    <View style={webStyles.outer}>
      <View style={webStyles.inner}>{children}</View>
    </View>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
    <SafeAreaProvider>
      <WebFrame>
      <ToastProvider>
      <AppProvider>
        <ThemedStatusBar />
        <NotificationRouter />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" options={{ animation: 'fade' }} />
          <Stack.Screen name="(client)" options={{ animation: 'fade' }} />
          <Stack.Screen name="(livreur)" options={{ animation: 'fade' }} />
          <Stack.Screen name="mission/[id]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="dish/[id]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="resto/[id]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="chat/[id]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="tracking" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="favoris" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="settings" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="notifications" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="register" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="edit-profile" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="location-picker" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="gallery/[id]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="publication/[id]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="reservations" options={{ animation: 'slide_from_right' }} />
        </Stack>
      </AppProvider>
      </ToastProvider>
      </WebFrame>
    </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const webStyles = StyleSheet.create({
  outer: { flex: 1, alignItems: 'center', backgroundColor: '#080c09' },
  inner: { flex: 1, width: '100%', maxWidth: WEB_MAX_WIDTH, position: 'relative', overflow: 'hidden' },
});
