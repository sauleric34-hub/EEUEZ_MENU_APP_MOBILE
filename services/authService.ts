import { apiClient, tokenManager } from './apiClient';
import { ENDPOINTS } from '../constants/api';

export const AuthService = {
    /**
     * Ping le serveur Backend pour vérifier s'il tourne
     */
    pingServer: async () => {
        try {
            const response = await apiClient.get(ENDPOINTS.AUTH.PING);
            return response.data;
        } catch (error) {
            throw error;
        }
    },

    /**
     * Connexion (Login)
     * body attend { email (ou telephone) et password }
     */
    login: async (credentials: any) => {
        try {
            const response = await apiClient.post(ENDPOINTS.AUTH.LOGIN, credentials);

            // Le backend renvoie { token: "..." }
            if (response.data && response.data.token) {
                await tokenManager.setToken(response.data.token);
            }

            return response.data; // Renvoie les données user + token
        } catch (error: any) {
            throw error.response?.data || error.message;
        }
    },

    /**
     * Inscription d'un nouveau Client
     */
    registerClient: async (data: any) => {
        try {
            const response = await apiClient.post(ENDPOINTS.AUTH.REGISTER_CLIENT, data);

            if (response.data && response.data.token) {
                await tokenManager.setToken(response.data.token);
            }

            return response.data;
        } catch (error: any) {
            throw error.response?.data || error.message;
        }
    },

    /**
     * Déconnexion locale
     */
    logout: async () => {
        await tokenManager.removeToken();
    }
};
