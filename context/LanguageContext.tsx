import React, { createContext, useContext, useState } from 'react';

type Language = 'fr' | 'en';

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (key: string) => string;
}

const translations = {
    fr: {
        accueil: 'Accueil',
        panier: 'Panier',
        explorer: 'Explorer',
        favoris: 'Favoris',
        profil: 'Profil',
        bonjour: 'Bonjour',
        rechercher: 'Rechercher des recettes...',
        recettes_moment: 'Recettes du moment',
        nouvellement_arrives: 'Nouvellement arrivés',
        ingredients: 'Ingrédients',
        commander: 'Commander',
        total: 'Total',
        langue: 'Langue',
        anglais: 'Anglais',
        francais: 'Français',
        deconnexion: 'Se déconnecter',
        allergies: 'Allergies enregistrées',
        aucun_allergie: 'Aucune allergie renseignée',
        info_personnel: 'Informations Personnelles',
        methode_paiement: 'Méthodes de Paiement',
        compte: 'Compte',
        preferences: 'Préférences',
        securite: 'Sécurité & Confidentialité',
        parametres: 'Paramètres',
        login: 'Connexion',
        register: 'S\'inscrire',
        create_account: 'Créer un compte',
        rejoignez_menu: 'Rejoignez MENU',
    },
    en: {
        accueil: 'Home',
        panier: 'Cart',
        explorer: 'Explore',
        favoris: 'Favorites',
        profil: 'Profile',
        bonjour: 'Hello',
        rechercher: 'Search recipes...',
        recettes_moment: 'Trending Now',
        nouvellement_arrives: 'New Arrivals',
        ingredients: 'Ingredients',
        commander: 'Checkout',
        total: 'Total',
        langue: 'Language',
        anglais: 'English',
        francais: 'French',
        deconnexion: 'Logout',
        allergies: 'Registered Allergies',
        aucun_allergie: 'No allergies registered',
        info_personnel: 'Personal Info',
        methode_paiement: 'Payment Methods',
        compte: 'Account',
        preferences: 'Preferences',
        securite: 'Security & Privacy',
        parametres: 'Settings',
        login: 'Login',
        register: 'Register Now',
        create_account: 'Create an Account',
        rejoignez_menu: 'Join MENU',
    }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
    const [language, setLanguage] = useState<Language>('fr');

    const t = (key: string) => {
        return translations[language][key as keyof typeof translations['fr']] || key;
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useTranslation() {
    const context = useContext(LanguageContext);
    if (context === undefined) {
        throw new Error('useTranslation must be used within a LanguageProvider');
    }
    return context;
}
