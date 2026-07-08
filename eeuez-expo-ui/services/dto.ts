// Formes des réponses de l'API Django (côté client)

export interface UserDTO {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  telephone?: string;
  allergies?: string;
  avatar?: string | null;
}

export interface AuthDTO {
  token: string;
  refresh?: string;
  user: UserDTO;
}

export interface CategorieDTO {
  id: number;
  nom: string;
  icone: string;
}

export interface PlatDTO {
  id: number;
  restaurant: number;
  restaurant_nom: string | null;
  categorie: number | null;
  categorie_nom: string | null;
  nom: string;
  description: string;
  prix: string;
  image: string | null;
  images: string[];
  is_available: boolean;
  is_popular: boolean;
  allergies: string;
  ingredients: string;
  composition: string[];
  note: number;
  nombre_notes: number;
  ma_note: number | null;
  nombre_commandes: number;
  nombre_likes: number;
}

export interface MessageDTO {
  id: number;
  sender: 'client' | 'restaurant';
  texte: string;
  image: string | null;
  is_read: boolean;
  created_at: string;
}

export interface ConversationDTO {
  id: number;
  plat: number;
  plat_details: PlatDTO;
  restaurant: number;
  restaurant_nom: string | null;
  dernier_message: MessageDTO | null;
  non_lus: number;
  updated_at: string;
}

export interface NoteResultDTO {
  ma_note: number;
  note: number;
  nombre_notes: number;
}

export interface AdresseDTO {
  id: number;
  label: string;
  adresse: string;
  details: string;
  latitude: string;
  longitude: string;
  is_default: boolean;
  created_at: string;
}

export interface RestoDTO {
  id: number;
  nom: string;
  description: string;
  adresse: string;
  ville: string;
  latitude: string | null;
  longitude: string | null;
  logo: string | null;
  cover_image: string | null;
  is_open: boolean;
  note_moyenne: number;
  temps_livraison_moyen: number;
  frais_livraison: string;
  nombre_plats: number;
  nombre_abonnes: number;
  plat_du_jour?: number | null;
  plats?: PlatDTO[];
}

export interface LigneCommandeDTO {
  id: number;
  plat: number | null;
  plat_details: PlatDTO | null;
  quantite: number;
  prix_unitaire: string;
}

export interface CommandeDTO {
  id: number;
  statut: string;
  livraison_statut: string | null;
  montant_total: string;
  adresse_livraison: string;
  notes: string;
  delai_estime: number | null;
  created_at: string;
  restaurant: number | null;
  restaurant_details: RestoDTO | null;
  lignes: LigneCommandeDTO[];
}

export interface RecoPlatDTO extends PlatDTO {
  score: number;
  distance_km: number | null;
  temps_estime: number | null;
}

export interface RecoRestoDTO extends RestoDTO {
  score: number;
  distance_km: number | null;
  temps_estime: number | null;
}

export interface RecommandationsDTO {
  position_utilisee: boolean;
  plats: RecoPlatDTO[];
  restaurants: RecoRestoDTO[];
}

export interface FavoriToggleDTO {
  liked: boolean;
  plat: number;
  favoris: number[];
}

export interface AbonnementToggleDTO {
  following: boolean;
  restaurant: number;
  abonnements: number[];
}
