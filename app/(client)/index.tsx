import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Image, StatusBar, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Search, Bell, Sliders, Heart, ChefHat, Home, Utensils, User, ShoppingBag,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../context/LanguageContext';
import { useCart } from '../../context/CartContext';
import { Typography, Spacing, Radius, glowSubtle } from '../../constants/theme';
import { PressableScale } from '../../components/Animations';

const CATEGORIES = [
  { id: '1', nom: 'Sucreries', icon: '🍰', key: 'sucreries' },
  { id: '2', nom: 'Gâteaux', icon: '🎂', key: 'gateaux' },
  { id: '3', nom: 'Pâtes', icon: '🍝', key: 'pates' },
  { id: '4', nom: 'Salés', icon: '🥨', key: 'sales' },
  { id: '5', nom: 'Volailles', icon: '🍗', key: 'volailles' },
];

const MOMENT_RECIPES = [
  {
    id: 'p1',
    nom: 'Pain au poulet pané AQ',
    desc: '08 Ingrédients',
    temps: '30m',
    image: 'https://images.unsplash.com/photo-1509722747041-619f3883a627?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: 'p2',
    nom: 'Noodle crevettes et épices',
    desc: '08 Ingrédients',
    temps: '20m',
    image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80',
  },
];

export default function ClientAccueil() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();
  }, []);

  return (
    <View style={[s.container, { backgroundColor: colors.bg.app }]}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 180 }}>
          {/* Header */}
          <View style={[s.header, { marginTop: 35 }]}>
            <View style={s.profileContainer}>
              <View style={s.avatarWrapper}>
                <Image
                  source={{ uri: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=100&q=80' }}
                  style={s.avatar}
                />
              </View>
              <Text style={[s.greeting, { color: colors.primary }]}>{t('bonjour')} {user?.nom || 'Invité'}</Text>
            </View>
            <TouchableOpacity style={s.iconBtn}>
              <Bell size={24} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {/* SearchBar */}
          <View style={[s.searchSection, { backgroundColor: colors.bg.app }]}>
            <View style={[s.searchBar, { backgroundColor: colors.bg.surface, borderColor: colors.border.subtle }]}>
              <Search size={20} color={colors.primary} />
              <TextInput
                placeholder={t('rechercher')}
                placeholderTextColor={colors.text.muted}
                style={[s.searchInput, { color: colors.text.primary }]}
                value={search}
                onChangeText={setSearch}
              />
            </View>
            <TouchableOpacity style={[s.filterBtn, { backgroundColor: colors.bg.surface, borderColor: colors.border.subtle }]}>
              <Sliders size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {/* Categories */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.catList}
          >
            {CATEGORIES.map(cat => (
              <View key={cat.id} style={s.catItem}>
                <View style={[s.catCircle, { backgroundColor: colors.bg.surface }]}>
                  <Text style={{ fontSize: 24 }}>{cat.icon}</Text>
                </View>
                <Text style={[s.catLabel, { color: colors.text.secondary }]}>{cat.nom}</Text>
              </View>
            ))}
          </ScrollView>

          {/* Receitas do momento */}
          <View style={s.section}>
            <Text style={[s.sectionTitle, { color: colors.primary }]}>{t('recettes_moment')}</Text>
            <View style={s.recipeGrid}>
              {MOMENT_RECIPES.map(recipe => (
                <RecipeCard key={recipe.id} recipe={recipe} colors={colors} t={t} />
              ))}
            </View>
          </View>

          {/* Acabaram de chegar */}
          <View style={s.section}>
            <Text style={[s.sectionTitle, { color: colors.primary }]}>{t('nouvellement_arrives')}</Text>
            <View style={[s.banner, { backgroundColor: colors.bg.surface }]}>
              <Image
                source={{ uri: 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=800&q=80' }}
                style={s.bannerImage}
              />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function RecipeCard({ recipe, colors, t }: any) {
  const { addItem } = useCart();
  const router = useRouter();

  return (
    <PressableScale
      onPress={() => router.push(`/(client)/product/${recipe.id}`)}
      style={[s.card, { backgroundColor: colors.bg.surface }, glowSubtle(colors.text.muted)]}
    >
      <View style={s.imageWrapper}>
        <Image source={{ uri: recipe.image }} style={s.cardImage} />
        <View style={[s.timeBadge, { backgroundColor: colors.primary }]}>
          <Text style={s.timeText}>{recipe.temps}</Text>
        </View>
        <TouchableOpacity style={s.favBtn}>
          <Heart size={18} color="#FFF" />
        </TouchableOpacity>
      </View>
      <View style={s.cardContent}>
        <Text numberOfLines={2} style={[s.recipeName, { color: colors.primary }]}>{recipe.nom}</Text>
        <Text style={[s.recipeDesc, { color: colors.text.muted }]}>{recipe.desc}</Text>
        <View style={s.cardFooter}>
          <TouchableOpacity
            onPress={() => addItem(recipe)}
            style={[s.menuBtn, { backgroundColor: colors.primary }]}>
            <Utensils size={18} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>
    </PressableScale>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  profileContainer: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#FF6B00',
    padding: 2,
  },
  avatar: { width: '100%', height: '100%', borderRadius: 24 },
  greeting: { fontSize: 20, fontWeight: '700' },
  iconBtn: { padding: 8 },
  searchSection: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: 12,
    alignItems: 'center',
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    borderRadius: Radius.lg,
    paddingHorizontal: 15,
    borderWidth: 1,
  },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 16 },
  filterBtn: {
    width: 50,
    height: 50,
    borderRadius: Radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  catList: { paddingLeft: Spacing.lg, paddingVertical: Spacing.md, gap: 20 },
  catItem: { alignItems: 'center', gap: 8 },
  catCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
  },
  catLabel: { fontSize: 12, fontWeight: '600' },
  section: { marginTop: Spacing.lg, paddingHorizontal: Spacing.lg },
  sectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: 15 },
  recipeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 15 },
  card: {
    width: '47.5%',
    borderRadius: Radius.xl,
    overflow: 'hidden',
    paddingBottom: 12,
  },
  imageWrapper: { width: '100%', height: 160, position: 'relative' },
  cardImage: { width: '100%', height: '100%' },
  timeBadge: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  timeText: { color: '#FFF', fontSize: 10, fontWeight: '700' },
  favBtn: { position: 'absolute', top: 10, right: 10 },
  cardContent: { paddingHorizontal: 12, paddingTop: 10, gap: 4 },
  recipeName: { fontSize: 15, fontWeight: '800', lineHeight: 20 },
  recipeDesc: { fontSize: 12 },
  cardFooter: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 5 },
  menuBtn: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  banner: { width: '100%', height: 200, borderRadius: Radius.xl, overflow: 'hidden', elevation: 2 },
  bannerImage: { width: '100%', height: '100%' },
});
