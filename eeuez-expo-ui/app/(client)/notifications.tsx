import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, StatusBar, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Typography, Spacing, Radius } from '../../constants/theme';
import { PressableScale } from '../../components/Animations';
import { Bell, BellOff, Utensils, Bike } from 'lucide-react-native';

export default function NotificationsScreen() {
  const router = useRouter();
  const [notifs, setNotifs] = useState<any[]>([]);

  useEffect(() => {
    AsyncStorage.getItem('eeuez_notifs').then(str => {
      if (str) {
        const arr = JSON.parse(str);
        setNotifs(arr);
        // Mark all as read
        const marked = arr.map((n: any) => ({ ...n, read: true }));
        AsyncStorage.setItem('eeuez_notifs', JSON.stringify(marked));
      }
    });
  }, []);

  const clearNotifs = () => {
    AsyncStorage.removeItem('eeuez_notifs');
    setNotifs([]);
  };

  return (
    <View style={s.screen}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg.app} />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={s.topBar}>
          <PressableScale onPress={() => router.back()}>
            <View style={s.hamburger}><Text style={s.hamburgerText}>←</Text></View>
          </PressableScale>
          <Text style={[s.greeting, { fontSize: 18, flex: 1, marginLeft: 12 }]}>Notifications</Text>
          {notifs.length > 0 && (
             <PressableScale onPress={clearNotifs}>
                <Text style={{ color: Colors.danger, fontWeight: '700' }}>Vider</Text>
             </PressableScale>
          )}
        </View>

        {notifs.length === 0 ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14 }}>
            <View style={{ width: 90, height: 90, borderRadius: 45, backgroundColor: Colors.bg.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border.default }}>
              <BellOff size={40} color={Colors.text.muted} />
            </View>
            <Text style={s.greeting}>Aucune notification</Text>
            <Text style={[s.locationText, { textAlign: 'center', paddingHorizontal: 40 }]}>
              Vous recevrez ici les mises à jour de vos commandes et promos.
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: Spacing.md, gap: 10 }}>
            {notifs.map((n: any, idx: number) => (
              <View key={n.id || idx} style={[s.notifCard, !n.read && s.unreadCard]}>
                 <View style={[s.iconBox, { backgroundColor: n.bg || Colors.client.bg }]}>
                    {n.message.includes('Prêt') || n.message.includes('prêt')
                      ? <Utensils size={22} color={n.color || Colors.client.primary} />
                      : n.message.includes('route') || n.message.includes('livraison')
                      ? <Bike size={22} color={n.color || Colors.client.primary} />
                      : <Bell size={22} color={n.color || Colors.client.primary} />
                    }
                 </View>
                 <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                       <Text style={s.title}>{n.title}</Text>
                       <Text style={s.time}>{n.time}</Text>
                    </View>
                    <Text style={s.message}>{n.message}</Text>
                 </View>
                 {!n.read && <View style={s.unreadDot} />}
              </View>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg.screen },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: Spacing.sm },
  hamburger: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 22, backgroundColor: Colors.glass.bg },
  hamburgerText: { fontSize: 22, color: Colors.text.primary },
  greeting: { ...Typography.h2, fontSize: 20 },
  locationText: { ...Typography.small, marginTop: 2 },
  notifCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bg.surface, padding: 14, borderRadius: Radius.lg, gap: 12, borderWidth: 1, borderColor: Colors.border.default },
  unreadCard: { borderColor: Colors.client.primary + '55', backgroundColor: Colors.bg.elevated },
  iconBox: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  title: { ...Typography.bodyBold, fontSize: 15 },
  message: { ...Typography.small, color: Colors.text.secondary },
  time: { ...Typography.small, fontSize: 11, color: Colors.text.muted },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.danger, position: 'absolute', top: 16, right: 14 }
});
