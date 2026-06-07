package com.eeuez.menu.repository;

import com.eeuez.menu.model.Plat;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PlatRepository extends JpaRepository<Plat, Long> {

    List<Plat> findByRestaurantId(Long restaurantId);

    List<Plat> findByRestaurantIdAndIsDisponible(Long restaurantId, boolean isDisponible);

    List<Plat> findByRestaurantIdAndIsPopulaire(Long restaurantId, boolean isPopulaire);

    /** Top 5 plats les plus likés du restaurant */
    List<Plat> findTop5ByRestaurantIdOrderByNombreLikesDesc(Long restaurantId);

    /** Recherche par nom dans le menu d'un restaurant */
    @Query("SELECT p FROM Plat p WHERE p.restaurant.id = :rid AND LOWER(p.nom) LIKE LOWER(CONCAT('%', :q, '%'))")
    List<Plat> searchInMenu(@Param("rid") Long restaurantId, @Param("q") String query);

    List<Plat> findByCategorieId(Long categorieId);
}
