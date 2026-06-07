/**
 * Constants pour la configuration de l'API Backend
 * En mode Expo/Local, 'localhost' ne marche pas toujours bien sur mobile physique.
 * On utilise par défaut le port 8088 comme demandé par l'utilisateur.
 * TODO: Mettre l'IP locale (ex: 192.168.X.X) pour test sur mobile physique.
 */
import Constants from 'expo-constants';

// Remplacer par l'IP de votre machine si vous testez avec l'application Expo Go sur votre téléphone.
// Exemple: http://192.168.1.10:8088
export const BASE_URL = 'http://localhost:8088';
export const API_URL = `${BASE_URL}/api`;

export const ENDPOINTS = {
    AUTH: {
        LOGIN: '/auth/login',
        REGISTER_CLIENT: '/auth/register/client',
        REGISTER_RESTAURANT: '/auth/register/restaurant',
        REGISTER_LIVREUR: '/auth/register/livreur',
        GOOGLE: '/auth/google',
        PING: '/auth/ping',
    },
    CLIENT: {
        WORKSPACE: '/client/workspace',
        CATALOGUE: '/client/catalogue',
    },
    RESTAURANT: {
        MENU: '/restaurant/menu/plats',
    }
};
