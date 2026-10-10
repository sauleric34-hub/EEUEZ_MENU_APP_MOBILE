// ═══════════════════════════════════════════════════════════
//  Icônes de catégorie choisies par l'admin (clés Lucide kebab-case)
//  → composants lucide-react-native. Garder synchronisé avec
//  backend/core/categories_icones.py.
// ═══════════════════════════════════════════════════════════

import {
  Utensils, UtensilsCrossed, ChefHat, CookingPot, Soup, Salad, Pizza, Sandwich, Hamburger,
  Beef, Drumstick, Ham, Fish, Shrimp, Egg, EggFried, Wheat, Bean, Carrot, LeafyGreen, Vegan,
  Sprout, Apple, Banana, Cherry, Grape, Citrus, Croissant, Cake, CakeSlice, Cookie, Donut,
  IceCreamCone, IceCreamBowl, Popsicle, Candy, Popcorn, Coffee, CupSoda, GlassWater, Milk,
  Wine, Beer, Martini, Flame, Leaf, type LucideIcon,
} from 'lucide-react-native';

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  'utensils': Utensils,
  'utensils-crossed': UtensilsCrossed,
  'chef-hat': ChefHat,
  'cooking-pot': CookingPot,
  'soup': Soup,
  'salad': Salad,
  'pizza': Pizza,
  'sandwich': Sandwich,
  'hamburger': Hamburger,
  'beef': Beef,
  'drumstick': Drumstick,
  'ham': Ham,
  'fish': Fish,
  'shrimp': Shrimp,
  'egg': Egg,
  'egg-fried': EggFried,
  'wheat': Wheat,
  'bean': Bean,
  'carrot': Carrot,
  'leafy-green': LeafyGreen,
  'vegan': Vegan,
  'sprout': Sprout,
  'apple': Apple,
  'banana': Banana,
  'cherry': Cherry,
  'grape': Grape,
  'citrus': Citrus,
  'croissant': Croissant,
  'cake': Cake,
  'cake-slice': CakeSlice,
  'cookie': Cookie,
  'donut': Donut,
  'ice-cream-cone': IceCreamCone,
  'ice-cream-bowl': IceCreamBowl,
  'popsicle': Popsicle,
  'candy': Candy,
  'popcorn': Popcorn,
  'coffee': Coffee,
  'cup-soda': CupSoda,
  'glass-water': GlassWater,
  'milk': Milk,
  'wine': Wine,
  'beer': Beer,
  'martini': Martini,
  'flame': Flame,
  'leaf': Leaf,
};

/** Icône d'une clé admin, ou null si inconnue (l'appelant choisit un repli). */
export const categoryIcon = (key: string | null | undefined): LucideIcon | null =>
  (key && CATEGORY_ICONS[key]) || null;
