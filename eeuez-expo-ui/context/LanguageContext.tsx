import React, { createContext, useContext, useState, ReactNode } from 'react';

type LanguageContextType = {
  language: string;
  setLanguage: (lang: string) => void;
  t: (key: string) => string;
};

const translations: Record<string, Record<string, string>> = {
  fr: {
    'welcome': 'Bienvenue sur',
    'subtitle': 'Découvrez les meilleures recettes de plus de 1 000 restaurants et profitez d\'une livraison rapide à votre porte.',
    'login': 'Connexion',
    'register': 'S\'inscrire',
    'allergies': 'Allergies',
    'aucun_allergie': 'Aucune allergie signalée',
    'langue': 'Langue',
    'francais': 'Français',
    'anglais': 'Anglais',
    'compte': 'Compte',
    'info_personnel': 'Informations personnelles',
    'methode_paiement': 'Méthodes de paiement',
    'parametres': 'Paramètres',
    'securite': 'Sécurité',
    'preferences': 'Préférences',
    'deconnexion': 'Déconnexion',
  },
  en: {
    'welcome': 'Welcome to',
    'subtitle': 'Discover the best recipes from over 1,000 restaurants and enjoy fast delivery to your door.',
    'login': 'Login',
    'register': 'Register',
    'allergies': 'Allergies',
    'aucun_allergie': 'No known allergies',
    'langue': 'Language',
    'francais': 'French',
    'anglais': 'English',
    'compte': 'Account',
    'info_personnel': 'Personal Information',
    'methode_paiement': 'Payment Methods',
    'parametres': 'Settings',
    'securite': 'Security',
    'preferences': 'Preferences',
    'deconnexion': 'Log out',
  }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState('fr');

  const t = (key: string) => {
    return translations[language]?.[key] || key;
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
