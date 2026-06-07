package com.eeuez.menu.repository;

import com.eeuez.menu.model.Commande;
import com.eeuez.menu.model.StatutCommande;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CommandeRepository extends JpaRepository<Commande, Long> {

    List<Commande> findByClientIdOrderByDateCommandeDesc(Long clientId);

    List<Commande> findByRestaurantIdOrderByDateCommandeDesc(Long restaurantId);

    List<Commande> findByLivreurIdOrderByDateCommandeDesc(Long livreurId);

    List<Commande> findByStatut(StatutCommande statut);

    List<Commande> findByRestaurantIdAndStatut(Long restaurantId, StatutCommande statut);

    /** Commandes disponibles pour les livreurs (sans livreur assigné, prêtes) */
    List<Commande> findByLivreurIsNullAndStatutIn(List<StatutCommande> statuts);
}
