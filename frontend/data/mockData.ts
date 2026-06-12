// === DONNÉES FICTIVES / MOCK DATA ===
import type { Restaurant, Client, Livreur, Commande, Plat } from '../types/models';

export const MOCK_RESTAURANT_USER: Restaurant = {
  id: 'r1',
  role: 'restaurant',
  nom: 'Kamga',
  prenom: 'Jean-Baptiste',
  email: 'jb.kamga@phenixdor.cm',
  telephone: '+237 655 123 456',
  dateInscription: new Date('2024-01-15'),
  isActive: true,
  notificationsEnabled: true,
  nomEtablissement: "Le Phénix d'Or",
  description: "Restaurant camerounais haut de gamme au cœur de Yaoundé. Spécialités locales revisitées avec modernité.",
  adresse: {
    id: 'a1', libelle: 'Principal', rue: 'Avenue Kennedy', quartier: 'Centre Ville',
    ville: 'Yaoundé', coordonnees: { latitude: 3.8480, longitude: 11.5021 }, estPrincipale: true
  },
  categorie: 'camerounais',
  logo: undefined,
  photos: [],
  horaires: [
    { jour: 'lundi', ouverture: '08:00', fermeture: '22:00', isFerme: false },
    { jour: 'mardi', ouverture: '08:00', fermeture: '22:00', isFerme: false },
    { jour: 'mercredi', ouverture: '08:00', fermeture: '22:00', isFerme: false },
    { jour: 'jeudi', ouverture: '08:00', fermeture: '22:00', isFerme: false },
    { jour: 'vendredi', ouverture: '08:00', fermeture: '23:00', isFerme: false },
    { jour: 'samedi', ouverture: '09:00', fermeture: '23:30', isFerme: false },
    { jour: 'dimanche', ouverture: '10:00', fermeture: '21:00', isFerme: false },
  ],
  isOuvert: true,
  noteGlobale: 4.8,
  nombreAvis: 342,
  tempsLivraisonMoyen: 25,
  fraisLivraison: 500,
  menu: [
    {
      id: 'cat1', nom: 'Spécialités', description: 'Nos plats signatures', icone: '⭐', ordre: 1,
      plats: [
        { id: 'p1', nom: 'Poulet DG', description: 'Poulet sauté avec plantains et légumes frais', prix: 4500, categorie: 'cat1', ingredients: ['Poulet', 'Plantains', 'Carottes', 'Poivrons'], isDisponible: true, isPopulaire: true, isVegetarien: false, tempsPreparation: 20, options: [], noteGlobale: 4.9 },
        { id: 'p2', nom: 'Ndolé', description: 'Feuilles amères aux crevettes et arachides', prix: 3500, categorie: 'cat1', ingredients: ['Feuilles ndolé', 'Crevettes', 'Arachides', 'Poisson fumé'], isDisponible: true, isPopulaire: true, isVegetarien: false, tempsPreparation: 30, options: [], noteGlobale: 4.7 },
        { id: 'p3', nom: 'Eru Spécial', description: 'Légumes waterleaf et fufu de maïs', prix: 3800, categorie: 'cat1', ingredients: ['Eru', 'Waterleaf', 'Huile de palme', 'Fufu'], isDisponible: true, isPopulaire: false, isVegetarien: false, tempsPreparation: 25, options: [], noteGlobale: 4.6 },
      ]
    },
    {
      id: 'cat2', nom: 'Grillades', description: 'Viandes et poissons grillés', icone: '🔥', ordre: 2,
      plats: [
        { id: 'p4', nom: 'Poisson braisé', description: 'Poisson tilapia braisé aux épices locales', prix: 5000, categorie: 'cat2', ingredients: ['Tilapia', 'Épices camerounaises', 'Citron'], isDisponible: true, isPopulaire: true, isVegetarien: false, tempsPreparation: 35, options: [], noteGlobale: 4.8 },
        { id: 'p5', nom: 'Brochettes de bœuf', description: '6 brochettes marinées, sauce pimentée', prix: 2500, categorie: 'cat2', ingredients: ['Bœuf', 'Épices', 'Oignons'], isDisponible: true, isPopulaire: false, isVegetarien: false, tempsPreparation: 15, options: [], noteGlobale: 4.4 },
      ]
    },
    {
      id: 'cat3', nom: 'Boissons', description: 'Jus et boissons fraîches', icone: '🍹', ordre: 3,
      plats: [
        { id: 'p6', nom: 'Jus de bissap', description: 'Hibiscus frais, gingembre et menthe', prix: 800, categorie: 'cat3', ingredients: ['Hibiscus', 'Gingembre', 'Menthe', 'Sucre'], isDisponible: true, isPopulaire: false, isVegetarien: true, tempsPreparation: 5, options: [], noteGlobale: 4.5 },
        { id: 'p7', nom: 'Jus de Gingembre', description: 'Extrait naturel de gingembre, citron vert', prix: 900, categorie: 'cat3', ingredients: ['Gingembre', 'Citron vert', 'Sucre de canne'], isDisponible: true, isPopulaire: false, isVegetarien: true, tempsPreparation: 5, options: [], noteGlobale: 4.6 },
      ]
    }
  ],
  tables: [
    { id: 't1', numero: 1, capacite: 2, qrCode: 'EEUEZ-R1-T1-2024', isOccupee: false },
    { id: 't2', numero: 2, capacite: 4, qrCode: 'EEUEZ-R1-T2-2024', isOccupee: true },
    { id: 't3', numero: 3, capacite: 6, qrCode: 'EEUEZ-R1-T3-2024', isOccupee: false },
  ],
  commandes: [],
  livreurs: ['l1'],
  statistiques: {
    revenusJour: 87500,
    revenusSemaine: 512000,
    revenusMois: 2180000,
    nombreCommandesJour: 42,
    topPlats: [],
    heuresPointe: [],
    tauxAcceptation: 94,
  },
  promotions: []
};

export const MOCK_CLIENT: Client = {
  id: 'c1',
  role: 'client',
  nom: 'Mbarga',
  prenom: 'Sophie',
  email: 'sophie.mbarga@gmail.com',
  telephone: '+237 699 876 543',
  dateInscription: new Date('2024-06-01'),
  isActive: true,
  notificationsEnabled: true,
  adresses: [
    { id: 'a1', libelle: 'Maison', rue: 'Rue 1.234, Bastos', quartier: 'Bastos', ville: 'Yaoundé', coordonnees: { latitude: 3.8700, longitude: 11.5100 }, estPrincipale: true },
    { id: 'a2', libelle: 'Bureau', rue: 'Immeuble Hilton', quartier: 'Centre Ville', ville: 'Yaoundé', coordonnees: { latitude: 3.8470, longitude: 11.5010 }, estPrincipale: false }
  ],
  modesPayment: [
    { id: 'mp1', type: 'mtn_money', libelle: 'MTN MoMo', numero: '+237 699 876 543' },
    { id: 'mp2', type: 'orange_money', libelle: 'Orange Money', numero: '+237 655 123 456' },
  ],
  commandes: ['cmd1', 'cmd2'],
  panier: [],
  favoris: ['r1'],
  historiqueQR: ['EEUEZ-R1-T2-2024']
};

export const MOCK_LIVREUR: Livreur = {
  id: 'l1',
  role: 'livreur',
  nom: 'Nkolo',
  prenom: 'Paul',
  email: 'paul.nkolo@eeuez.cm',
  telephone: '+237 677 234 567',
  dateInscription: new Date('2024-03-01'),
  isActive: true,
  notificationsEnabled: true,
  vehicule: { type: 'moto', marque: 'Yamaha', plaque: 'YD-5678-A' },
  documents: [
    { type: 'cni', url: '', valide: true },
    { type: 'permis', url: '', valide: true, expiration: new Date('2027-01-01') },
  ],
  isOnline: true,
  positionActuelle: { latitude: 3.8550, longitude: 11.5050 },
  commandeEnCours: 'cmd3',
  historiquelivraisons: ['del1', 'del2', 'del3', 'del4', 'del5'],
  gainTotal: 1250000,
  gainJour: 28000,
  gainSemaine: 145000,
  noteGlobale: 4.7,
  nombreLivraisons: 287
};

export const MOCK_COMMANDES: Commande[] = [
  {
    id: 'cmd1', clientId: 'c1', restaurantId: 'r1', livreurId: 'l1',
    items: [], statut: 'en_livraison', type: 'livraison',
    montantSousTotal: 8000, fraisLivraison: 500, montantTotal: 8500,
    modePayment: { id: 'mp1', type: 'mtn_money', libelle: 'MTN MoMo', numero: '+237 699 876 543' },
    dateCommande: new Date(), delaiEstime: 15, instructions: 'Sonnez 2 fois'
  },
  {
    id: 'cmd2', clientId: 'c1', restaurantId: 'r1',
    items: [], statut: 'livree', type: 'livraison',
    montantSousTotal: 3500, fraisLivraison: 500, montantTotal: 4000,
    modePayment: { id: 'mp2', type: 'orange_money', libelle: 'Orange Money', numero: '+237 655 123 456' },
    dateCommande: new Date(Date.now() - 86400000), delaiEstime: 20
  }
];

export const RESTAURANTS_LISTE = [
  { id: 'r1', nom: "Le Phénix d'Or", categorie: 'Camerounais', note: 4.8, avis: 342, temps: 25, frais: 500, distance: 1.2, isOuvert: true, couleur: '#FF6B35', emoji: '🍲' },
  { id: 'r2', nom: 'Pizza Palace', categorie: 'Pizzeria', note: 4.5, avis: 180, temps: 30, frais: 800, distance: 2.1, isOuvert: true, couleur: '#E63946', emoji: '🍕' },
  { id: 'r3', nom: 'Chez Mama Africa', categorie: 'Africain', note: 4.6, avis: 95, temps: 20, frais: 300, distance: 0.8, isOuvert: false, couleur: '#2A9D8F', emoji: '🥘' },
  { id: 'r4', nom: 'Speed Burger', categorie: 'Fast Food', note: 4.2, avis: 430, temps: 15, frais: 600, distance: 3.5, isOuvert: true, couleur: '#E9C46A', emoji: '🍔' },
  { id: 'r5', nom: 'Sakura Sushi', categorie: 'Japonais', note: 4.7, avis: 67, temps: 40, frais: 1500, distance: 4.2, isOuvert: true, couleur: '#F4A261', emoji: '🍣' },
];
