package com.eeuez.menu.controller;

import com.eeuez.menu.model.*;
import com.eeuez.menu.repository.*;
import com.eeuez.menu.service.CommandeService;
import com.eeuez.menu.service.RatingService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Controller Workspace Restaurant EEUEZ Menu.
 * Toutes les routes nécessitent un JWT avec rôle RESTAURANT.
 * Le restaurant accède uniquement à SES propres données.
 */
@RestController
@RequestMapping("/api/restaurant")
@CrossOrigin(origins = "*")
public class RestaurantController {

    private final RestaurantRepository restaurantRepository;
    private final CommandeRepository commandeRepository;
    private final PlatRepository platRepository;
    private final AvisRepository avisRepository;
    private final CommandeService commandeService;

    public RestaurantController(
            RestaurantRepository restaurantRepository,
            CommandeRepository commandeRepository,
            PlatRepository platRepository,
            AvisRepository avisRepository,
            CommandeService commandeService
    ) {
        this.restaurantRepository = restaurantRepository;
        this.commandeRepository = commandeRepository;
        this.platRepository = platRepository;
        this.avisRepository = avisRepository;
        this.commandeService = commandeService;
    }

    // ─── WORKSPACE PRINCIPAL ──────────────────────────────────────

    /**
     * GET /api/restaurant/workspace — Dashboard complet du restaurant
     */
    @GetMapping("/workspace")
    public ResponseEntity<?> getWorkspace(@AuthenticationPrincipal User user) {
        return restaurantRepository.findById(user.getId())
                .map(r -> {
                    Map<String, Object> workspace = new HashMap<>();
                    workspace.put("id", r.getId());
                    workspace.put("nomEtablissement", r.getNomEtablissement());
                    workspace.put("logo", r.getLogo());
                    workspace.put("isOuvert", r.isOuvert());
                    workspace.put("noteGlobale", r.getNoteGlobale());
                    workspace.put("nombreAvis", r.getNombreAvis());
                    workspace.put("nombreFollowers", r.getNombreFollowers());

                    // Statistiques
                    Map<String, Object> stats = new HashMap<>();
                    stats.put("revenusJour", r.getRevenusJour());
                    stats.put("revenusSemaine", r.getRevenusSemaine());
                    stats.put("revenusMois", r.getRevenusMois());
                    stats.put("nombreCommandesJour", r.getNombreCommandesJour());
                    stats.put("tauxAcceptation", r.getTauxAcceptation());
                    workspace.put("statistiques", stats);

                    // Commandes actives
                    List<Commande> commandesActives = commandeRepository
                            .findByRestaurantIdOrderByDateCommandeDesc(r.getId())
                            .stream()
                            .filter(c -> c.getStatut() != StatutCommande.LIVREE
                                    && c.getStatut() != StatutCommande.REFUSEE
                                    && c.getStatut() != StatutCommande.ANNULEE)
                            .toList();
                    workspace.put("commandesActives", commandesActives);
                    workspace.put("nombreCommandesEnAttente",
                            commandesActives.stream()
                                    .filter(c -> c.getStatut() == StatutCommande.EN_ATTENTE)
                                    .count());

                    return ResponseEntity.ok(workspace);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * PUT /api/restaurant/profile — Modifier le profil du restaurant
     */
    @PutMapping("/profile")
    public ResponseEntity<?> updateProfile(
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal User user
    ) {
        return restaurantRepository.findById(user.getId())
                .map(r -> {
                    if (body.containsKey("description")) r.setDescription((String) body.get("description"));
                    if (body.containsKey("logo")) r.setLogo((String) body.get("logo"));
                    if (body.containsKey("tempsLivraisonMoyen"))
                        r.setTempsLivraisonMoyen((Integer) body.get("tempsLivraisonMoyen"));
                    if (body.containsKey("fraisLivraison"))
                        r.setFraisLivraison(((Number) body.get("fraisLivraison")).intValue());
                    if (body.containsKey("isOuvert")) r.setOuvert((Boolean) body.get("isOuvert"));
                    return ResponseEntity.ok(restaurantRepository.save(r));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * PUT /api/restaurant/status — Toggle ouvert/fermé
     */
    @PutMapping("/status")
    public ResponseEntity<?> toggleStatus(@AuthenticationPrincipal User user) {
        return restaurantRepository.findById(user.getId())
                .map(r -> {
                    r.setOuvert(!r.isOuvert());
                    Restaurant saved = restaurantRepository.save(r);
                    return ResponseEntity.ok(Map.of("isOuvert", saved.isOuvert()));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    // ─── MENU — CATÉGORIES ────────────────────────────────────────

    /**
     * GET /api/restaurant/menu — Menu complet par catégories
     */
    @GetMapping("/menu")
    public ResponseEntity<?> getMenu(@AuthenticationPrincipal User user) {
        return restaurantRepository.findById(user.getId())
                .map(r -> ResponseEntity.ok(r.getMenu()))
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * POST /api/restaurant/menu/categories — Créer une catégorie
     */
    @PostMapping("/menu/categories")
    public ResponseEntity<?> createCategorie(
            @RequestBody Categorie categorie,
            @AuthenticationPrincipal User user
    ) {
        return restaurantRepository.findById(user.getId())
                .map(r -> {
                    categorie.setRestaurant(r);
                    r.getMenu().add(categorie);
                    restaurantRepository.save(r);
                    return ResponseEntity.status(HttpStatus.CREATED).body(categorie);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    // ─── MENU — PLATS ────────────────────────────────────────────

    /**
     * GET /api/restaurant/menu/plats — Tous les plats du restaurant
     */
    @GetMapping("/menu/plats")
    public ResponseEntity<List<Plat>> getPlats(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(platRepository.findByRestaurantId(user.getId()));
    }

    /**
     * POST /api/restaurant/menu/plats — Créer un plat
     */
    @PostMapping("/menu/plats")
    public ResponseEntity<?> createPlat(
            @RequestBody Plat plat,
            @AuthenticationPrincipal User user
    ) {
        return restaurantRepository.findById(user.getId())
                .map(r -> {
                    plat.setRestaurant(r);
                    return ResponseEntity.status(HttpStatus.CREATED)
                            .body(platRepository.save(plat));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * PUT /api/restaurant/menu/plats/{id} — Modifier un plat
     */
    @PutMapping("/menu/plats/{id}")
    public ResponseEntity<?> updatePlat(
            @PathVariable Long id,
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal User user
    ) {
        return platRepository.findById(id)
                .filter(p -> p.getRestaurant().getId().equals(user.getId()))
                .map(p -> {
                    if (body.containsKey("nom")) p.setNom((String) body.get("nom"));
                    if (body.containsKey("description")) p.setDescription((String) body.get("description"));
                    if (body.containsKey("prix")) p.setPrix(((Number) body.get("prix")).doubleValue());
                    if (body.containsKey("isDisponible")) p.setDisponible((Boolean) body.get("isDisponible"));
                    if (body.containsKey("isPopulaire")) p.setPopulaire((Boolean) body.get("isPopulaire"));
                    if (body.containsKey("photo")) p.setPhoto((String) body.get("photo"));
                    return ResponseEntity.ok(platRepository.save(p));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * DELETE /api/restaurant/menu/plats/{id} — Supprimer un plat
     */
    @DeleteMapping("/menu/plats/{id}")
    public ResponseEntity<?> deletePlat(@PathVariable Long id, @AuthenticationPrincipal User user) {
        return platRepository.findById(id)
                .filter(p -> p.getRestaurant().getId().equals(user.getId()))
                .map(p -> {
                    platRepository.delete(p);
                    return ResponseEntity.ok(Map.of("message", "Plat supprimé"));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * PATCH /api/restaurant/menu/plats/{id}/toggle — Toggle disponibilité
     */
    @PatchMapping("/menu/plats/{id}/toggle")
    public ResponseEntity<?> toggleDisponibilite(@PathVariable Long id, @AuthenticationPrincipal User user) {
        return platRepository.findById(id)
                .filter(p -> p.getRestaurant().getId().equals(user.getId()))
                .map(p -> {
                    p.setDisponible(!p.isDisponible());
                    Plat saved = platRepository.save(p);
                    return ResponseEntity.ok(Map.of("isDisponible", saved.isDisponible()));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    // ─── COMMANDES ───────────────────────────────────────────────

    /**
     * GET /api/restaurant/commandes — Toutes les commandes du restaurant
     */
    @GetMapping("/commandes")
    public ResponseEntity<List<Commande>> getCommandes(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(commandeRepository.findByRestaurantIdOrderByDateCommandeDesc(user.getId()));
    }

    /**
     * PUT /api/restaurant/commandes/{id}/accept
     * Body: { "delai": 20 }
     */
    @PutMapping("/commandes/{id}/accept")
    public ResponseEntity<?> accepterCommande(
            @PathVariable Long id,
            @RequestBody(required = false) Map<String, Object> body,
            @AuthenticationPrincipal User user
    ) {
        try {
            Integer delai = body != null && body.containsKey("delai")
                    ? ((Number) body.get("delai")).intValue() : null;
            Commande commande = commandeService.accepterCommande(id, delai);
            // Vérifier que c'est bien LA commande de CE restaurant
            if (!commande.getRestaurant().getId().equals(user.getId())) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
            }
            return ResponseEntity.ok(commande);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("erreur", e.getMessage()));
        }
    }

    /**
     * PUT /api/restaurant/commandes/{id}/refuse
     * Body: { "raison": "Rupture de stock" }
     */
    @PutMapping("/commandes/{id}/refuse")
    public ResponseEntity<?> refuserCommande(
            @PathVariable Long id,
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal User user
    ) {
        try {
            Commande commande = commandeService.refuserCommande(id, body.get("raison"));
            if (!commande.getRestaurant().getId().equals(user.getId())) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
            }
            return ResponseEntity.ok(commande);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("erreur", e.getMessage()));
        }
    }

    /**
     * PUT /api/restaurant/commandes/{id}/status
     * Body: { "statut": "EN_PREPARATION" }
     */
    @PutMapping("/commandes/{id}/status")
    public ResponseEntity<?> changerStatut(
            @PathVariable Long id,
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal User user
    ) {
        try {
            StatutCommande statut = StatutCommande.valueOf(body.get("statut"));
            Commande commande = commandeService.changerStatut(id, statut, user.getId());
            return ResponseEntity.ok(commande);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("erreur", e.getMessage()));
        }
    }

    // ─── AVIS ────────────────────────────────────────────────────

    /**
     * GET /api/restaurant/avis — Tous les avis du restaurant
     */
    @GetMapping("/avis")
    public ResponseEntity<List<Avis>> getAvis(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(avisRepository.findByRestaurantIdOrderByDateAvisDesc(user.getId()));
    }

    // ─── STATISTIQUES ────────────────────────────────────────────

    /**
     * GET /api/restaurant/statistiques — Dashboard stats complet
     */
    @GetMapping("/statistiques")
    public ResponseEntity<?> getStatistiques(@AuthenticationPrincipal User user) {
        return restaurantRepository.findById(user.getId())
                .map(r -> {
                    Map<String, Object> stats = new HashMap<>();
                    stats.put("revenusJour", r.getRevenusJour());
                    stats.put("revenusSemaine", r.getRevenusSemaine());
                    stats.put("revenusMois", r.getRevenusMois());
                    stats.put("nombreCommandesJour", r.getNombreCommandesJour());
                    stats.put("tauxAcceptation", r.getTauxAcceptation());
                    stats.put("noteGlobale", r.getNoteGlobale());
                    stats.put("nombreAvis", r.getNombreAvis());

                    // Top 5 plats les plus likés
                    stats.put("topPlats", platRepository.findTop5ByRestaurantIdOrderByNombreLikesDesc(user.getId()));

                    return ResponseEntity.ok(stats);
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
