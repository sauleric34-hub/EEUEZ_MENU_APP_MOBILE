import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, Animated, TouchableOpacity, StatusBar, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { Typography, Radius, Spacing, glow } from '../constants/theme';
import { Fingerprint } from 'lucide-react-native';
import { PressableScale } from '../components/Animations';

const { height, width } = Dimensions.get('window');

export default function WelcomeScreen() {
  const { colors } = useTheme();
  const { t, language, setLanguage } = useTranslation();
  const { isLoggedIn, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoggedIn && user) {
      if (user.role === 'restaurant') router.replace('/(restaurant)');
      else if (user.role === 'livreur') router.replace('/(livreur)');
      else router.replace('/(client)');
    }
  }, [isLoggedIn, user]);

  const logoAnim = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(logoAnim, { toValue: 1, useNativeDriver: true, tension: 50, friction: 7 }),
      Animated.timing(contentAnim, { toValue: 1, duration: 800, useNativeDriver: true })
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: 1, duration: 3500, useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: 3500, useNativeDriver: true })
      ])
    ).start();
  }, []);

  const floatingY = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -20]
  });

  const floatingYReverse = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 15]
  });

  return (
    <View style={[s.container, { backgroundColor: '#FCF9F2' }]}>
      <StatusBar barStyle="light-content" />

      {/* Bouton de langue en haut à droite */}
      <SafeAreaView style={{ position: 'absolute', top: 10, right: 20, zIndex: 100 }}>
        <TouchableOpacity
          onPress={() => setLanguage(language === 'fr' ? 'en' : 'fr')}
          style={{ backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' }}
        >
          <Text style={{ color: '#FFF', fontWeight: 'bold' }}>{language.toUpperCase()}</Text>
        </TouchableOpacity>
      </SafeAreaView>

      {/* Header Orange avec ombres */}
      <View style={[s.headerCurve, { backgroundColor: colors.primary }]}>
        <View style={[s.bubble, { width: 160, height: 160, top: -40, left: -50, opacity: 0.15 }]} />
        <View style={[s.bubble, { width: 240, height: 240, top: 40, left: 80, opacity: 0.08 }]} />

        <View style={s.clocheWrapper}>
          <Image
            source={{ uri: 'https://cdn-icons-png.flaticon.com/512/1046/1046751.png' }}
            style={[s.clocheIcon, { tintColor: 'rgba(255,255,255,0.2)' }]}
          />
        </View>

        {/* Niche Logo beige */}
        <View style={[s.cutout, { backgroundColor: '#FCF9F2' }]}>
          <Animated.View style={{ transform: [{ scale: logoAnim }] }}>
            <View style={s.logoShadowWrapper}>
              <View style={s.logoCard}>
                <Image
                  source={require('../assets/icon.png')}
                  style={s.logo}
                  resizeMode="contain"
                />
              </View>
            </View>
          </Animated.View>
        </View>
      </View>

      <SafeAreaView style={s.safe}>
        {/* MULTIPLE ÉLÉMENTS MAGIQUES FLOTTANTS */}
        <Animated.View style={[s.magic, { top: height * 0.42, left: 40, transform: [{ translateY: floatingY }] }]}>
          <View style={[s.magicCircle, { width: 14, height: 14, borderColor: colors.primary, opacity: 0.3 }]} />
        </Animated.View>
        <Animated.View style={[s.magic, { top: height * 0.48, right: 50, transform: [{ translateY: floatingYReverse }] }]}>
          <View style={[s.magicLine, { width: 40, backgroundColor: colors.primary, opacity: 0.2, transform: [{ rotate: '45deg' }] }]} />
        </Animated.View>
        <Animated.View style={[s.magic, { top: height * 0.55, left: width * 0.15, transform: [{ translateY: floatingY }] }]}>
          <View style={[s.magicCircle, { width: 8, height: 8, borderColor: '#1B5E20', opacity: 0.2 }]} />
        </Animated.View>
        <Animated.View style={[s.magic, { top: height * 0.60, right: width * 0.2, transform: [{ translateY: floatingYReverse }] }]}>
          <View style={[s.magicCircle, { width: 25, height: 25, borderColor: colors.primary, opacity: 0.15 }]} />
        </Animated.View>
        <Animated.View style={[s.magic, { bottom: 150, left: 60, transform: [{ translateY: floatingY }] }]}>
          <View style={[s.magicLine, { width: 25, backgroundColor: '#1B5E20', opacity: 0.15, transform: [{ rotate: '-30deg' }] }]} />
        </Animated.View>

        {/* Spacer abaissé à 45% pour un dégagement parfait sous le logo */}
        <View style={{ height: height * 0.45 }} />

        <Animated.View style={[s.content, { opacity: contentAnim, transform: [{ translateY: contentAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }] }]}>
          <View style={s.textWrapper}>
            <Text style={[s.title, { color: colors.primary }]}>{t('welcome')} <Text style={{ color: '#1B5E20' }}>MENU</Text></Text>
          </View>

          <Text style={[s.description, { color: colors.text.secondary }]}>
            {t('subtitle') || "Découvrez les meilleures recettes de plus de 1 000 restaurants et profitez d'une livraison rapide à votre porte."}
          </Text>

          <View style={s.btnRow}>
            <PressableScale style={s.btnFull} onPress={() => router.push('/login')}>
              <View style={[s.loginBtn, { backgroundColor: colors.primary }]}>
                <Text style={s.loginText}>{t('login') || 'Connexion'}</Text>
              </View>
            </PressableScale>

            <PressableScale style={s.btnFull} onPress={() => router.push('/register')}>
              <View style={[s.registerBtn, { borderColor: colors.primary }]}>
                <Text style={[s.registerText, { color: colors.primary }]}>{t('register') || 'Créer un compte'}</Text>
              </View>
            </PressableScale>
          </View>

          <TouchableOpacity style={s.biometric}>
            <Text style={[s.bioTitle, { color: colors.text.secondary }]}>Now! Quick Login Use Touch ID</Text>
            <Fingerprint size={50} color={colors.primary} />
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  headerCurve: {
    position: 'absolute', top: 0, left: 0, right: 0,
    height: '37%', borderBottomLeftRadius: 60, borderBottomRightRadius: 60,
    justifyContent: 'center', alignItems: 'center',
    elevation: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3, shadowRadius: 15
  },
  bubble: { position: 'absolute', borderRadius: 100, backgroundColor: '#FFF' },
  clocheWrapper: { position: 'absolute', right: -40, bottom: 10, opacity: 0.4 },
  clocheIcon: { width: 280, height: 280, resizeMode: 'contain' },
  cutout: {
    position: 'absolute', bottom: -65, width: 160, height: 160,
    borderRadius: 80, justifyContent: 'center', alignItems: 'center',
  },
  logoShadowWrapper: {
    width: 130, height: 130, borderRadius: 65,
    backgroundColor: '#FFF',
    elevation: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3, shadowRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  logoCard: {
    width: 130, height: 130, borderRadius: 65,
    overflow: 'hidden', justifyContent: 'center', alignItems: 'center',
  },
  logo: { width: '90%', height: '90%' },
  safe: { flex: 1, padding: Spacing.xl },
  content: { width: '100%', alignItems: 'center', gap: 10 },
  textWrapper: { alignItems: 'center', marginBottom: 5 },
  title: { fontSize: 36, fontWeight: '900' },
  description: { textAlign: 'center', opacity: 0.8, lineHeight: 20, paddingHorizontal: 20, fontSize: 14 },
  btnRow: { gap: 10, width: '100%', marginTop: 15 },
  btnFull: { width: '100%' },
  loginBtn: { height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center', elevation: 6 },
  loginText: { color: '#FFF', fontSize: 18, fontWeight: '900' },
  registerBtn: { height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center', borderWidth: 2 },
  registerText: { fontSize: 16, fontWeight: '900' },
  biometric: { alignItems: 'center', marginTop: 15, gap: 5 },
  bioTitle: { fontSize: 13, fontWeight: '600' },
  magic: { position: 'absolute' },
  magicCircle: { borderRadius: 50, borderWidth: 1.5 },
  magicLine: { height: 2, borderRadius: 1 },
});
