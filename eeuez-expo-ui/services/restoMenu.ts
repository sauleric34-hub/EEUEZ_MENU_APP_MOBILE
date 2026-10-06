// ═══════════════════════════════════════════════════════════
//  Service API — espace Restaurant (gérant)
//  Endpoints spécifiques au rôle "restaurant".
// ═══════════════════════════════════════════════════════════

import { apiGet, apiPost } from './http';
import type { CommandeDTO } from './dto';

/**
 * Récupère toutes les commandes du restaurant authentifié.
 * Le backend filtre automatiquement selon le token (role=restaurant).
 */
export const fetchCommandesResto = () =>
  apiGet<CommandeDTO[]>('/restaurant/commandes/', { auth: true });

/**
 * Marque une commande comme "prête" (préparation terminée).
 * Le statut passe à "pret" côté serveur, qui peut alors déclencher
 * l'affectation d'un livreur.
 */
export const marquerCommandePrete = (commandeId: number) =>
  apiPost<CommandeDTO>(
    `/restaurant/commandes/${commandeId}/pret/`,
    {},
    { auth: true },
  );

/**
 * Confirme ou refuse une commande en attente.
 */
export const repondreCommande = (commandeId: number, accepter: boolean, motif?: string) =>
  apiPost<CommandeDTO>(
    `/restaurant/commandes/${commandeId}/${accepter ? 'confirmer' : 'refuser'}/`,
    motif ? { motif } : {},
    { auth: true },
  );
