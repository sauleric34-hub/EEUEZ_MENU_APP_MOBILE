package com.eeuez.menu.repository;

import com.eeuez.menu.model.Restaurant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RestaurantRepository extends JpaRepository<Restaurant, Long> {

    List<Restaurant> findByCategorie(String categorie);

    List<Restaurant> findByIsOuvert(boolean isOuvert);

    List<Restaurant> findByCategorieAndIsOuvert(String categorie, boolean isOuvert);

    /**
     * Recherche des restaurants dans un rayon donné (formule Haversine en JPQL).
     * Retourne les restaurants triés par distance croissante.
     *
     * @param lat    Latitude du client
     * @param lon    Longitude du client
     * @param radius Rayon en kilomètres
     */
    @Query("""
        SELECT r FROM Restaurant r
        WHERE r.latitude IS NOT NULL AND r.longitude IS NOT NULL
        AND (
            6371 * acos(
                cos(radians(:lat)) * cos(radians(r.latitude)) *
                cos(radians(r.longitude) - radians(:lon)) +
                sin(radians(:lat)) * sin(radians(r.latitude))
            )
        ) <= :radius
        ORDER BY (
            6371 * acos(
                cos(radians(:lat)) * cos(radians(r.latitude)) *
                cos(radians(r.longitude) - radians(:lon)) +
                sin(radians(:lat)) * sin(radians(r.latitude))
            )
        ) ASC
        """)
    List<Restaurant> findNearby(
        @Param("lat") double lat,
        @Param("lon") double lon,
        @Param("radius") double radius
    );

    /**
     * Recherche par nom (pour la barre de recherche).
     */
    @Query("SELECT r FROM Restaurant r WHERE LOWER(r.nomEtablissement) LIKE LOWER(CONCAT('%', :q, '%'))")
    List<Restaurant> searchByName(@Param("q") String query);
}
