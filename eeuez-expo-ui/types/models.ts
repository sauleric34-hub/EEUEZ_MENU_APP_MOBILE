// === MODÈLE DE DONNÉES MENU ===
// Centralise tous les types, attributs et interfaces du domaine

// ─── AUTH & USER BASE ───────────────────────────────────────────
export type UserRole = 'client' | 'restaurant' | 'livreur';

export interface BaseUser {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  avatar?: string;
  dateInscription: Date;
  role: UserRole;
  isActive: boolean;
  notificationsEnabled: boolean;
}

// ─── CLIENT ─────────────────────────────────────────────────────
export interface Client extends BaseUser {
  role: 'client';
  adresses: Adresse[];
  modesPayment: ModePayment[];
  commandes: string[]; // IDs
  panier: PanierItem[];
  favoris: string[]; // restaurant IDs
  historiqueQR: string[]; // QR scannés
  // Méthodes (actions)
  // parcourirRestaurants(filtres: FiltreRestaurant): Restaurant[]
  // scannerQR(qrCode: string): Menu
  // ajouterAuPanier(plat: Plat, quantite: number, options: Option[]): void
  // passerCommande(type: TypeCommande, adresse?: Adresse): Commande
  // suivreCommande(commandeId: string): TrackingInfo
  // laisserAvis(restaurantId: string, note: number, commentaire: string): Avis
  // reorderCommande(commandeId: string): void
}

// ─── RESTAURANT ─────────────────────────────────────────────────
export interface Restaurant extends BaseUser {
  role: 'restaurant';
  nomEtablissement: string;
  description: string;
  adresse: Adresse;
  categorie: CategorieRestaurant;
  logo?: string;
  photos: string[];
  horaires: Horaire[];
  isOuvert: boolean;
  noteGlobale: number;
  nombreAvis: number;
  tempsLivraisonMoyen: number; // minutes
  fraisLivraison: number;
  menu: Categorie[];
  tables: Table[];
  commandes: Commande[];
  livreurs: string[]; // livreur IDs assignés
  statistiques: StatRestaurant;
  promotions: Promotion[];
  // Méthodes (actions)
  // ajouterPlat(plat: Plat): void
  // modifierPlat(platId: string, data: Partial<Plat>): void
  // supprimerPlat(platId: string): void
  // toggleDisponibilitePlat(platId: string): void
  // accepterCommande(commandeId: string, delai: number): void
  // refuserCommande(commandeId: string, raison: string): void
  // assignerLivreur(commandeId: string, livreurId: string): void
  // genererQRTable(tableId: string): string
  // consulterStatistiques(periode: Periode): StatRestaurant
}

// ─── LIVREUR ────────────────────────────────────────────────────
export interface Livreur extends BaseUser {
  role: 'livreur';
  vehicule: Vehicule;
  documents: Document[];
  isOnline: boolean;
  positionActuelle?: Coordonnees;
  commandeEnCours?: string; // commande ID
  historiquelivraisons: string[]; // IDs
  gainTotal: number;
  gainJour: number;
  gainSemaine: number;
  noteGlobale: number;
  nombreLivraisons: number;
  // Méthodes (actions)
  // toggleOnline(): void
  // accepterMission(commandeId: string): void
  // refuserMission(commandeId: string): void
  // scannerQRCollecte(qrCode: string): void
  // scannerQRLivraison(qrCode: string): void
  // mettreAjourPosition(coords: Coordonnees): void
  // consulterGains(periode: Periode): GainDetail
}

// ─── COMMANDE ───────────────────────────────────────────────────
export type StatutCommande =
  | 'en_attente'
  | 'acceptee'
  | 'en_preparation'
  | 'prete'
  | 'livreur_assigne'
  | 'en_collecte'
  | 'en_livraison'
  | 'livree'
  | 'refusee'
  | 'annulee';

export type TypeCommande = 'livraison' | 'sur_place' | 'a_emporter';

export interface Commande {
  id: string;
  clientId: string;
  restaurantId: string;
  livreurId?: string;
  items: PanierItem[];
  statut: StatutCommande;
  type: TypeCommande;
  adresseLivraison?: Adresse;
  tableId?: string;
  montantSousTotal: number;
  fraisLivraison: number;
  montantTotal: number;
  modePayment: ModePayment;
  dateCommande: Date;
  dateLivraison?: Date;
  delaiEstime: number; // minutes
  instructions?: string;
  avis?: Avis;
}

// ─── MENU & PLATS ───────────────────────────────────────────────
export interface Categorie {
  id: string;
  nom: string;
  description?: string;
  icone?: string;
  ordre: number;
  plats: Plat[];
}

export interface Plat {
  id: string;
  nom: string;
  description: string;
  prix: number;
  photo?: string;
  categorie: string;
  ingredients: string[];
  allergenes?: string[];
  isDisponible: boolean;
  isPopulaire: boolean;
  isVegetarien: boolean;
  tempsPreparation: number; // minutes
  options: GroupeOptions[];
  noteGlobale: number;
}

export interface GroupeOptions {
  id: string;
  titre: string;
  obligatoire: boolean;
  multiChoix: boolean;
  options: Option[];
}

export interface Option {
  id: string;
  nom: string;
  prixSupplementaire: number;
}

export interface PanierItem {
  platId: string;
  plat: Plat;
  quantite: number;
  optionsChoisies: Option[];
  instructions?: string;
  sousTotal: number;
}

// ─── GÉOLOCALISATION ────────────────────────────────────────────
export interface Adresse {
  id: string;
  libelle: string; // "Maison", "Bureau"...
  rue: string;
  quartier: string;
  ville: string;
  coordonnees: Coordonnees;
  estPrincipale: boolean;
}

export interface Coordonnees {
  latitude: number;
  longitude: number;
}

// ─── PAIEMENT ───────────────────────────────────────────────────
export type TypePayment = 'mtn_money' | 'orange_money' | 'carte_bancaire' | 'especes';

export interface ModePayment {
  id: string;
  type: TypePayment;
  libelle: string;
  numero?: string;
}

// ─── AUTRES ENTITÉS ─────────────────────────────────────────────
export interface Avis {
  id: string;
  clientId: string;
  restaurantId: string;
  commandeId: string;
  notePlat: number;
  noteLivraison?: number;
  commentaire: string;
  photos?: string[];
  dateAvis: Date;
}

export interface Table {
  id: string;
  numero: number;
  capacite: number;
  qrCode: string;
  isOccupee: boolean;
}

export interface Horaire {
  jour: 'lundi' | 'mardi' | 'mercredi' | 'jeudi' | 'vendredi' | 'samedi' | 'dimanche';
  ouverture: string; // "08:00"
  fermeture: string;
  isFerme: boolean;
}

export interface Vehicule {
  type: 'moto' | 'velo' | 'voiture' | 'tricycle';
  marque?: string;
  plaque?: string;
}

export interface Document {
  type: 'cni' | 'permis' | 'assurance';
  url: string;
  expiration?: Date;
  valide: boolean;
}

export interface StatRestaurant {
  revenusJour: number;
  revenusSemaine: number;
  revenusMois: number;
  nombreCommandesJour: number;
  topPlats: { plat: Plat; nombreVentes: number }[];
  heuresPointe: { heure: number; commandes: number }[];
  tauxAcceptation: number;
}

export interface Promotion {
  id: string;
  titre: string;
  description: string;
  type: 'pourcentage' | 'montant_fixe' | 'livraison_gratuite';
  valeur: number;
  dateDebut: Date;
  dateFin: Date;
  isActive: boolean;
}

export type CategorieRestaurant =
  | 'camerounais'
  | 'africain'
  | 'fast_food'
  | 'pizzeria'
  | 'sushi'
  | 'international'
  | 'snack'
  | 'patisserie';

export type Periode = 'jour' | 'semaine' | 'mois' | 'annee';

export type FiltreRestaurant = {
  categorie?: CategorieRestaurant;
  noteMin?: number;
  tempsLivraisonMax?: number;
  fraisLivraisonMax?: number;
  distance?: number;
  recherche?: string;
};

export interface GainDetail {
  total: number;
  nombreLivraisons: number;
  details: { date: Date; montant: number; commandeId: string }[];
}

export interface TrackingInfo {
  statut: StatutCommande;
  livreur?: Pick<Livreur, 'nom' | 'prenom' | 'telephone' | 'positionActuelle' | 'vehicule'>;
  tempsEstimeRestant: number; // minutes
  etapes: { label: string; fait: boolean; heure?: Date }[];
}
