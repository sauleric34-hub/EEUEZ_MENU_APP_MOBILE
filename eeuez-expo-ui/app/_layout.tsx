import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider, useApp } from '../context/AppContext';
import { ErrorBoundary } from '../components/ErrorBoundary';

function ThemedStatusBar() {
  const { mode } = useApp();
  return <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />;
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
    <SafeAreaProvider>
      <AppProvider>
        <ThemedStatusBar />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" options={{ animation: 'fade' }} />
          <Stack.Screen name="(client)" options={{ animation: 'fade' }} />
          <Stack.Screen name="dish/[id]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="resto/[id]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="tracking" options={{ animation: 'slide_from_bottom' }} />
        </Stack>
      </AppProvider>
    </SafeAreaProvider>
    </ErrorBoundary>
  );
}
