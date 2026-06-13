import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_URL } from '../constants/api';

const TOKEN_KEY = 'menu_app_jwt_token';

// Instance Axios personnalisée
export const apiClient = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 10000,
});

// Intercepteur : Ajoute le Token JWT à chaque requête sortante (si présent)
apiClient.interceptors.request.use(
    async (config) => {
        try {
            const token = await SecureStore.getItemAsync(TOKEN_KEY);
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
        } catch (error) {
            console.error('Erreur de lecture du token JWT', error);
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Intercepteur : Gère les réponses et les erreurs 401 (Expiration du token)
apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        if (error.response && error.response.status === 401) {
            // Si 401 Unauthorized, on supprime le token pour forcer une reconnexion
            await SecureStore.deleteItemAsync(TOKEN_KEY);
            // Optionnel : Emettre un event global pour rediriger vers la page (/) Welcome
        }
        return Promise.reject(error);
    }
);

// Helpers pour manipuler le token dans le composant
export const tokenManager = {
    setToken: async (token: string) => {
        await SecureStore.setItemAsync(TOKEN_KEY, token);
    },
    getToken: async () => {
        return await SecureStore.getItemAsync(TOKEN_KEY);
    },
    removeToken: async () => {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
    }
};
