// ═══════════════════════════════════════════════════════════
//  Types UI + mapping DTO API → modèles d'affichage
//  Les icônes/dégradés (absents en base) sont dérivés côté client
//  à partir de la catégorie / du nom.
// ═══════════════════════════════════════════════════════════

import {
  Drumstick, Salad, CupSoda, CookingPot, Cookie, Fish, Pizza, Beef, Soup,
  Utensils, IceCreamCone, Store, type LucideIcon,
} from 'lucide-react-native';
import type { PlatDTO, RestoDTO, CategorieDTO } from '../services/dto';
import { MEDIA_BASE_URL } from '../constants/api';

export type Gradient = [string, string];

/** Transforme un chemin média relatif de l'API en URL absolue. */
export function absMedia(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (path.startsWith('http')) return path;
  return `${MEDIA_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

export interface Resto {
  id: number;
  name: string;
  cuisine: string;
  rating: string;
  followers: string;
  icon: LucideIcon;
  grad: Gradient;
  bio: string;
  image?: string;   // logo du restaurant
  cover?: string;   // image de couverture (bannière)
  platDuJourId: number | null;
  latitude: number | null;
  longitude: number | null;
  /** Adresse lisible, affichée sous la carte de la fiche restaurant. */
  adresse?: string | null;
  fraisLivraison: number;
  prixReservation: number;
  tempsLivraison: number;
  isOpen: boolean;
  isFollowing?: boolean;
  /** Renseignés par le moteur de recommandation (si position connue) */
  distanceKm?: number | null;
  etaMin?: number | null;
}

export interface OptionComplementDTO {
  id: number;
  nom: string;
  /** 0 = offert. */
  supplement: number;
}

export interface GroupeComplementDTO {
  id: number;
  nom: string;
  obligatoire: boolean;
  options: OptionComplementDTO[];
}

export interface Dish {
  id: number;
  name: string;
  restoId: number;
  restoName: string;
  price: number;
  icon: LucideIcon;
  grad: Gradient;
  rating: string;
  orders: string;
  likes: string;
  /** Valeurs numériques brutes — servent au tri et aux filtres. */
  ordersCount: number;
  likesCount: number;
  noteValue: number;
  /** Horodatage d'ajout (ms) — tri « Nouveautés ». 0 si inconnu. */
  createdAt: number;
  composition: string[];
  description: string;
  isPopular: boolean;
  category: string | null;
  fraisLivraison: number;
  /** Groupes d'options : le client choisit UNE possibilité par groupe. */
  groupesComplements: GroupeComplementDTO[];
  /** Ce qui vient avec le plat : information seule, sans choix ni surcoût. */
  elementsInclus: string[];
  image?: string;
  images: string[];
  myRating: number | null;
  ratingCount: number;
  /** Renseignés par le moteur de recommandation (si position connue) */
  distanceKm?: number | null;
  etaMin?: number | null;
}

export interface Category {
  id: number;
  name: string;
  icon: LucideIcon;
}

// ─── Palette de dégradés (design) ────────────────────────────
const GRADIENTS: Gradient[] = [
  ['#1f8a4c', '#0f5132'], // vert
  ['#f7891b', '#c24a06'], // orange
  ['#2b3a44', '#141d22'], // ardoise
  ['#d94f1e', '#7d2a0d'], // rouge
  ['#e0a10a', '#a06806'], // ambre
  ['#b0245a', '#6b0f37'], // groseille
  ['#c77b12', '#7a4707'], // brun
  ['#2f9e57', '#146138'], // vert clair
];
export const gradForId = (id: number): Gradient => GRADIENTS[Math.abs(id) % GRADIENTS.length];

// ─── Icône selon nom / catégorie ─────────────────────────────
const NAME_KEYWORDS: [RegExp, LucideIcon][] = [
  [/poulet|dg|volaille|ailes?/i, Drumstick],
  [/ndol|legume|légume|salade|feuille|okok|eru/i, Salad],
  [/poisson|braisé|braise|bar|maquereau|tilapia|sushi|thon|saumon/i, Fish],
  [/pizza/i, Pizza],
  [/burger|steak|boeuf|bœuf|viande|grill|soya|brochette|porc/i, Beef],
  [/jus|bissap|boisson|soda|eau|gingembre|folere|cocktail/i, CupSoda],
  [/soupe|bouillon|pepe|pepper|nkui|sauce/i, Soup],
  [/plantain|beignet|bobolo|miondo|riz|couscous|attiéké|attieke|frite/i, CookingPot],
  [/gateau|gâteau|dessert|glace|crème|creme|sucré|sucre/i, IceCreamCone],
  [/biscuit|cookie|pain/i, Cookie],
];
const CATEGORY_ICONS: [RegExp, LucideIcon][] = [
  [/grillade/i, Beef],
  [/soupe|bouillon/i, Soup],
  [/boisson/i, CupSoda],
  [/dessert/i, IceCreamCone],
  [/entrée|entree/i, Salad],
  [/résistance|resistance|plat/i, CookingPot],
];

export function iconForPlat(nom: string, categorie: string | null): LucideIcon {
  for (const [re, icon] of NAME_KEYWORDS) if (re.test(nom)) return icon;
  if (categorie) for (const [re, icon] of CATEGORY_ICONS) if (re.test(categorie)) return icon;
  return Utensils;
}
export function iconForResto(nom: string, id: number): LucideIcon {
  for (const [re, icon] of NAME_KEYWORDS) if (re.test(nom)) return icon;
  return [Drumstick, CookingPot, Fish, Pizza, Beef][id % 5] ?? Store;
}
function iconForCategory(nom: string): LucideIcon {
  for (const [re, icon] of NAME_KEYWORDS) if (re.test(nom)) return icon;
  for (const [re, icon] of CATEGORY_ICONS) if (re.test(nom)) return icon;
  return Utensils;
}

// ─── Formatage ───────────────────────────────────────────────
export const formatPrice = (n: number): string =>
  n.toLocaleString('fr-FR').replace(/[  ]/g, ' ') + ' F';

export function formatCount(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + 'k';
  return n.toLocaleString('fr-FR').replace(/[  ]/g, ' ');
}

export function formatKm(km: number | null | undefined): string {
  if (km == null) return '—';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1).replace('.', ',')} km`;
}

/** Distance à vol d'oiseau entre deux points GPS, en km (formule de haversine). */
export function distanceKm(
  lat1: number, lon1: number, lat2: number, lon2: number,
): number {
  const R = 6371; // rayon terrestre moyen (km)
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// ─── Mappers DTO → UI ────────────────────────────────────────
export function mapResto(d: RestoDTO): Resto {
  return {
    id: d.id,
    name: d.nom,
    cuisine: d.ville || 'Cameroun',
    rating: d.note_moyenne ? String(d.note_moyenne) : '—',
    followers: formatCount(d.nombre_abonnes ?? 0),
    icon: iconForResto(d.nom, d.id),
    grad: gradForId(d.id),
    bio: d.description || 'Restaurant partenaire',
    image: absMedia(d.logo),
    cover: absMedia(d.cover_image),
    platDuJourId: d.plat_du_jour ?? null,
    latitude: d.latitude != null ? Number(d.latitude) : null,
    longitude: d.longitude != null ? Number(d.longitude) : null,
    // « adresse, ville » quand les deux existent, sinon celui qui est renseigné.
    adresse: [d.adresse, d.ville].filter(Boolean).join(', ') || null,
    fraisLivraison: Number(d.frais_livraison ?? 0),
    prixReservation: Number(d.prix_reservation ?? 0),
    tempsLivraison: d.temps_livraison_moyen ?? 30,
    isOpen: d.is_open,
    isFollowing: d.is_following,
  };
}

export function mapPlat(d: PlatDTO): Dish {
  const composition = Array.isArray(d.composition) && d.composition.length
    ? d.composition
    : (d.ingredients || '')
      .replace(/;/g, ',')
      .split(',')
      .map(part => part.trim())
      .filter(Boolean);

  return {
    id: d.id,
    name: d.nom,
    restoId: d.restaurant,
    restoName: d.restaurant_nom || '',
    // Prix payé par le client = prix de base majoré du pourcentage plateforme
    price: Number(d.prix_client ?? d.prix),
    icon: iconForPlat(d.nom, d.categorie_nom),
    grad: gradForId(d.categorie ?? d.id),
    rating: d.note ? String(d.note) : '—',
    orders: formatCount(d.nombre_commandes ?? 0),
    likes: formatCount(d.nombre_likes ?? 0),
    ordersCount: Number(d.nombre_commandes ?? 0),
    likesCount: Number(d.nombre_likes ?? 0),
    noteValue: Number(d.note ?? 0),
    createdAt: d.created_at ? new Date(d.created_at).getTime() || 0 : 0,
    composition,
    description: d.description || '',
    isPopular: d.is_popular,
    category: d.categorie_nom,
    fraisLivraison: Number(d.frais_livraison ?? 0),
    groupesComplements: d.groupes_complements ?? [],
    elementsInclus: d.elements_inclus ?? [],
    image: absMedia(d.image),
    images: (d.images ?? []).map(u => absMedia(u)).filter((u): u is string => !!u),
    myRating: d.ma_note ?? null,
    ratingCount: d.nombre_notes ?? 0,
  };
}

export function mapCategory(d: CategorieDTO): Category {
  return { id: d.id, name: d.nom, icon: iconForCategory(d.nom) };
}

// ─── Constantes statiques (non issues de la base) ────────────
export const FILTERS = ['Tout', 'Grillades', 'Boissons', 'Soupes & Bouillons', 'Desserts'];
export const DELIVERY_FEE = 800;

// Étapes du suivi de livraison (mappées sur les statuts de commande)
export const TRACK_STEPS = [
  { title: 'Commande confirmée', desc: 'Le restaurant a reçu votre commande', statuts: ['en_attente', 'acceptee'] },
  { title: 'En préparation',     desc: 'Vos plats sont en cuisine',            statuts: ['en_preparation', 'prete', 'assignee'] },
  { title: 'En route',           desc: 'Le livreur a récupéré votre commande', statuts: ['en_livraison', 'en_collecte'] },
  { title: 'Livré',              desc: 'Bon appétit !',                        statuts: ['livree'] },
];
export const TRACK_ETA = ['Arrive dans ~22 min', 'Arrive dans ~16 min', 'Arrive dans ~8 min', 'Livré'];

/** Convertit un statut de commande en index d'étape de suivi. */
export function statutToStep(statut: string): number {
  for (let i = 0; i < TRACK_STEPS.length; i++) {
    if (TRACK_STEPS[i].statuts.includes(statut)) return i;
  }
  return 0;
}
