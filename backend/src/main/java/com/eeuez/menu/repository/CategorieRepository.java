package com.eeuez.menu.repository;

import com.eeuez.menu.model.Categorie;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CategorieRepository extends JpaRepository<Categorie, Long> {
    List<Categorie> findByRestaurantIdOrderByOrdreAsc(Long restaurantId);
}
