package com.eeuez.menu.service;

import com.eeuez.menu.model.Avis;
import com.eeuez.menu.model.Plat;
import com.eeuez.menu.model.Restaurant;
import com.eeuez.menu.repository.AvisRepository;
import com.eeuez.menu.repository.PlatRepository;
import com.eeuez.menu.repository.RestaurantRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Service de notation EEUEZ Menu.
 * 
 * Règle : la note d'un restaurant = moyenne des notes de ses plats.
 * Chaque avis sur une commande met à jour la note du plat ET du restaurant.
 */
@Service
@Transactional
public class RatingService {

    private final AvisRepository avisRepository;
    private final PlatRepository platRepository;
    private final RestaurantRepository restaurantRepository;

    public RatingService(AvisRepository avisRepository, PlatRepository platRepository,
                         RestaurantRepository restaurantRepository) {
        this.avisRepository = avisRepository;
        this.platRepository = platRepository;
        this.restaurantRepository = restaurantRepository;
    }

    /**
     * Recalcule et enregistre la note d'un plat après un nouvel avis.
     */
    public void recalculerNotePlat(Long platId) {
        Plat plat = platRepository.findById(platId).orElse(null);
        if (plat == null) return;

        Double moyenne = avisRepository.avgNoteByPlat(platId).orElse(0.0);
        long nbAvis = avisRepository.countByRestaurantId(plat.getRestaurant().getId());

        plat.setNoteGlobale(Math.round(moyenne * 10.0) / 10.0);
        plat.setNombreAvis((int) avisRepository.findByPlatIdOrderByDateAvisDesc(platId).size());
        platRepository.save(plat);

        // Propager au restaurant
        recalculerNoteRestaurant(plat.getRestaurant().getId());
    }

    /**
     * Recalcule la note globale du restaurant = moyenne des notes de ses plats.
     */
    public void recalculerNoteRestaurant(Long restaurantId) {
        Restaurant restaurant = restaurantRepository.findById(restaurantId).orElse(null);
        if (restaurant == null) return;

        // Moyenne de toutes les notes des avis du restaurant
        Double moyenne = avisRepository.avgNoteByRestaurant(restaurantId).orElse(0.0);
        long nbAvis = avisRepository.countByRestaurantId(restaurantId);

        restaurant.setNoteGlobale(Math.round(moyenne * 10.0) / 10.0);
        restaurant.setNombreAvis((int) nbAvis);
        restaurantRepository.save(restaurant);
    }

    /**
     * Incrémente le compteur de likes d'un plat.
     */
    public void incrementerLikes(Long platId) {
        Plat plat = platRepository.findById(platId)
                .orElseThrow(() -> new RuntimeException("Plat introuvable"));
        plat.setNombreLikes(plat.getNombreLikes() + 1);
        platRepository.save(plat);
    }

    /**
     * Décrémente le compteur de likes d'un plat.
     */
    public void decrementerLikes(Long platId) {
        Plat plat = platRepository.findById(platId)
                .orElseThrow(() -> new RuntimeException("Plat introuvable"));
        int likes = plat.getNombreLikes() - 1;
        plat.setNombreLikes(Math.max(0, likes));
        platRepository.save(plat);
    }

    /**
     * Incrémente le nombre de followers d'un restaurant.
     */
    public void incrementerFollowers(Long restaurantId) {
        Restaurant r = restaurantRepository.findById(restaurantId)
                .orElseThrow(() -> new RuntimeException("Restaurant introuvable"));
        r.setNombreFollowers(r.getNombreFollowers() + 1);
        restaurantRepository.save(r);
    }

    public void decrementerFollowers(Long restaurantId) {
        Restaurant r = restaurantRepository.findById(restaurantId)
                .orElseThrow(() -> new RuntimeException("Restaurant introuvable"));
        int followers = r.getNombreFollowers() - 1;
        r.setNombreFollowers(Math.max(0, followers));
        restaurantRepository.save(r);
    }
}
