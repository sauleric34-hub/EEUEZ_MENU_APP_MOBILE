import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(client)" />
      <Stack.Screen name="(restaurant)" />
      <Stack.Screen name="(livreur)" />
    </Stack>
  );
}
