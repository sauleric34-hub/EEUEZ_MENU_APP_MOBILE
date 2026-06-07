import { apiClient } from './apiClient';
import { ENDPOINTS } from '../constants/api';

export const ClientService = {
    /**
     * Récupère le profil complet du client (commandes, favoris, etc.)
     */
    getProfile: async () => {
        try {
            const response = await apiClient.get('/client/profile');
            return response.data;
        } catch (error: any) {
            throw error.response?.data || error.message;
        }
    },

    /**
     * Récupère tous les restaurants à proximité (ou par défaut)
     */
    getNearbyRestaurants: async (lat: number = 3.848, lon: number = 11.502, rayon: number = 10.0) => {
        try {
            const response = await apiClient.get(`/client/restaurants/nearby?lat=${lat}&lon=${lon}&rayon=${rayon}`);
            return response.data;
        } catch (error: any) {
            throw error.response?.data || error.message;
        }
    },

    /**
     * Récupère les détails d'un restaurant (incluant son menu et ses plats)
     */
    getRestaurantDetails: async (id: string | number) => {
        try {
            const response = await apiClient.get(`/client/restaurants/${id}`);
            return response.data;
        } catch (error: any) {
            throw error.response?.data || error.message;
        }
    },

    /**
     * Ajouter/Retirer un plat des favoris (likes)
     */
    toggleLikePlat: async (platId: string | number) => {
        try {
            const response = await apiClient.post(`/client/plats/${platId}/like`);
            return response.data;
        } catch (error: any) {
            throw error.response?.data || error.message;
        }
    },

    /**
     * Envoi d'une commande (Panier) vers le backend
     */
    passerCommande: async (commandeData: any) => {
        try {
            const response = await apiClient.post('/client/commandes', commandeData);
            return response.data;
        } catch (error: any) {
            throw error.response?.data || error.message;
        }
    },

    /**
     * Historique des commandes du client
     */
    getCommandes: async () => {
        try {
            const response = await apiClient.get('/client/commandes');
            return response.data;
        } catch (error: any) {
            throw error.response?.data || error.message;
        }
    }
};
