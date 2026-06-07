package com.eeuez.menu.repository;

import com.eeuez.menu.model.Avis;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AvisRepository extends JpaRepository<Avis, Long> {

    List<Avis> findByRestaurantIdOrderByDateAvisDesc(Long restaurantId);

    List<Avis> findByPlatIdOrderByDateAvisDesc(Long platId);

    List<Avis> findByClientIdOrderByDateAvisDesc(Long clientId);

    /** Vérifier si un client a déjà noté une commande */
    Optional<Avis> findByClientIdAndCommandeId(Long clientId, Long commandeId);

    /** Moyenne des notes d'un restaurant */
    @Query("SELECT AVG(a.notePlat) FROM Avis a WHERE a.restaurant.id = :rid AND a.notePlat IS NOT NULL")
    Optional<Double> avgNoteByRestaurant(@Param("rid") Long restaurantId);

    /** Moyenne des notes d'un plat */
    @Query("SELECT AVG(a.notePlat) FROM Avis a WHERE a.plat.id = :pid AND a.notePlat IS NOT NULL")
    Optional<Double> avgNoteByPlat(@Param("pid") Long platId);

    /** Nombre d'avis pour un restaurant */
    long countByRestaurantId(Long restaurantId);
}
