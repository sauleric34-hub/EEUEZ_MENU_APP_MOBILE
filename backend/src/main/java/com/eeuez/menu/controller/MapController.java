package com.eeuez.menu.controller;

import com.eeuez.menu.model.*;
import com.eeuez.menu.repository.*;
import com.eeuez.menu.service.GeoService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Controller de cartographie EEUEZ Menu.
 * Retourne les restaurants sur la carte avec animation des détails.
 * Routes publiques — accessible sans authentification.
 */
@RestController
@RequestMapping("/api/map")
@CrossOrigin(origins = "*")
public class MapController {

    private final RestaurantRepository restaurantRepository;
    private final GeoService geoService;

    public MapController(RestaurantRepository restaurantRepository, GeoService geoService) {
        this.restaurantRepository = restaurantRepository;
        this.geoService = geoService;
    }

    /**
     * GET /api/map/restaurants?lat=3.848&lon=11.502&rayon=5
     * Retourne tous les restaurants dans un rayon (km) avec leur distance.
     */
    @GetMapping("/restaurants")
    public ResponseEntity<List<Map<String, Object>>> getRestaurantsNearby(
            @RequestParam(defaultValue = "3.848") double lat,
            @RequestParam(defaultValue = "11.502") double lon,
            @RequestParam(defaultValue = "10.0") double rayon
    ) {
        List<Restaurant> restaurants = restaurantRepository.findNearby(lat, lon, rayon);

        List<Map<String, Object>> result = restaurants.stream().map(r -> {
            Map<String, Object> dto = new HashMap<>();
            dto.put("id", r.getId());
            dto.put("nom", r.getNomEtablissement());
            dto.put("categorie", r.getCategorie());
            dto.put("note", r.getNoteGlobale());
            dto.put("nombreAvis", r.getNombreAvis());
            dto.put("tempsLivraison", r.getTempsLivraisonMoyen());
            dto.put("fraisLivraison", r.getFraisLivraison());
            dto.put("isOuvert", r.isOuvert());
            dto.put("logo", r.getLogo());
            dto.put("latitude", r.getLatitude());
            dto.put("longitude", r.getLongitude());

            // Calcul de la distance réelle avec Haversine
            if (r.getLatitude() != null && r.getLongitude() != null) {
                double distance = geoService.calculerDistance(lat, lon, r.getLatitude(), r.getLongitude());
                dto.put("distance", distance);
                dto.put("tempsLivraisonEstime",
                        geoService.estimerTempsLivraison(distance, r.getTempsLivraisonMoyen()));
            }

            return dto;
        }).toList();

        return ResponseEntity.ok(result);
    }

    /**
     * GET /api/map/restaurants/{id}/details
     * Détails complets d'un restaurant pour l'animation de la carte.
     * Inclut : description, photos, galerie, plats populaires, note.
     */
    @GetMapping("/restaurants/{id}/details")
    public ResponseEntity<?> getRestaurantDetails(@PathVariable Long id) {
        return restaurantRepository.findById(id)
                .map(r -> {
                    Map<String, Object> dto = new HashMap<>();
                    dto.put("id", r.getId());
                    dto.put("nomEtablissement", r.getNomEtablissement());
                    dto.put("description", r.getDescription());
                    dto.put("categorie", r.getCategorie());
                    dto.put("logo", r.getLogo());
                    dto.put("photos", r.getPhotos());
                    dto.put("noteGlobale", r.getNoteGlobale());
                    dto.put("nombreAvis", r.getNombreAvis());
                    dto.put("nombreFollowers", r.getNombreFollowers());
                    dto.put("isOuvert", r.isOuvert());
                    dto.put("tempsLivraisonMoyen", r.getTempsLivraisonMoyen());
                    dto.put("fraisLivraison", r.getFraisLivraison());
                    dto.put("horaires", r.getHoraires());
                    dto.put("latitude", r.getLatitude());
                    dto.put("longitude", r.getLongitude());
                    dto.put("adresse", r.getAdresse());

                    // Top 3 plats les plus populaires
                    List<Map<String, Object>> platsPopulaires = r.getMenu().stream()
                            .flatMap(cat -> cat.getPlats().stream())
                            .filter(Plat::isPopulaire)
                            .limit(3)
                            .map(p -> {
                                Map<String, Object> platDto = new HashMap<>();
                                platDto.put("id", p.getId());
                                platDto.put("nom", p.getNom());
                                platDto.put("prix", p.getPrix());
                                platDto.put("photo", p.getPhoto());
                                platDto.put("noteGlobale", p.getNoteGlobale());
                                platDto.put("nombreLikes", p.getNombreLikes());
                                return platDto;
                            })
                            .toList();
                    dto.put("platsPopulaires", platsPopulaires);

                    return ResponseEntity.ok(dto);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * GET /api/map/restaurants/search?q=phenix
     * Recherche de restaurant par nom.
     */
    @GetMapping("/restaurants/search")
    public ResponseEntity<List<Map<String, Object>>> searchRestaurants(@RequestParam String q) {
        List<Restaurant> restaurants = restaurantRepository.searchByName(q);
        List<Map<String, Object>> result = restaurants.stream().map(r -> {
            Map<String, Object> dto = new HashMap<>();
            dto.put("id", r.getId());
            dto.put("nom", r.getNomEtablissement());
            dto.put("categorie", r.getCategorie());
            dto.put("note", r.getNoteGlobale());
            dto.put("isOuvert", r.isOuvert());
            dto.put("logo", r.getLogo());
            dto.put("latitude", r.getLatitude());
            dto.put("longitude", r.getLongitude());
            return dto;
        }).toList();
        return ResponseEntity.ok(result);
    }
}
