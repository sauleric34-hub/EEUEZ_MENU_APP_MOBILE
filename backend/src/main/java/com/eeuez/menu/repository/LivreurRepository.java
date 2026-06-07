package com.eeuez.menu.repository;

import com.eeuez.menu.model.Livreur;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface LivreurRepository extends JpaRepository<Livreur, Long> {
    Optional<Livreur> findByEmail(String email);
    List<Livreur> findByIsOnline(boolean isOnline);
    List<Livreur> findByCommandeEnCoursIdIsNull();
}
