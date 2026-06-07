package com.eeuez.menu.controller;

import com.eeuez.menu.dto.CommandeRequest;
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
 * Controller Espace Client EEUEZ Menu.
 * Toutes les routes nécessitent un JWT valide (rôle CLIENT).
 */
@RestController
@RequestMapping("/api/client")
@CrossOrigin(origins = "*")
public class ClientController {

    private final ClientRepository clientRepository;
    private final RestaurantRepository restaurantRepository;
    private final PlatRepository platRepository;
    private final CommandeRepository commandeRepository;
    private final AvisRepository avisRepository;
    private final CommandeService commandeService;
    private final RatingService ratingService;

    public ClientController(
            ClientRepository clientRepository,
            RestaurantRepository restaurantRepository,
            PlatRepository platRepository,
            CommandeRepository commandeRepository,
            AvisRepository avisRepository,
            CommandeService commandeService,
            RatingService ratingService
    ) {
        this.clientRepository = clientRepository;
        this.restaurantRepository = restaurantRepository;
        this.platRepository = platRepository;
        this.commandeRepository = commandeRepository;
        this.avisRepository = avisRepository;
        this.commandeService = commandeService;
        this.ratingService = ratingService;
    }

    // ─── PROFIL ──────────────────────────────────────────────────

    /**
     * GET /api/client/profile
     * Retourne le profil complet : commandes, plats likés, restaurants suivis.
     */
    @GetMapping("/profile")
    public ResponseEntity<?> getProfile(@AuthenticationPrincipal User user) {
        return clientRepository.findById(user.getId())
                .map(client -> {
                    Map<String, Object> profile = new HashMap<>();
                    profile.put("id", client.getId());
                    profile.put("nom", client.getNom());
                    profile.put("prenom", client.getPrenom());
                    profile.put("email", client.getEmail());
                    profile.put("telephone", client.getTelephone());
                    profile.put("avatar", client.getAvatar());
                    profile.put("dateInscription", client.getDateInscription());
                    profile.put("adresses", client.getAdresses());
                    profile.put("modesPaiement", client.getModesPaiement());

                    // Commandes
                    List<Commande> commandes = commandeRepository.findByClientIdOrderByDateCommandeDesc(client.getId());
                    profile.put("nombreCommandes", commandes.size());
                    profile.put("dernieresCommandes", commandes.stream().limit(5).toList());

                    // Plats likés
                    profile.put("nombrePlatsLikes", client.getPlatsLikes().size());
                    profile.put("platsLikes", client.getPlatsLikes().stream().limit(10).toList());

                    // Restaurants suivis
                    profile.put("nombreRestaurantsSuivis", client.getRestaurantsSuivis().size());
                    profile.put("restaurantsSuivis", client.getRestaurantsSuivis().stream()
                            .map(r -> Map.of(
                                    "id", r.getId(),
                                    "nom", r.getNomEtablissement(),
                                    "logo", r.getLogo() != null ? r.getLogo() : "",
                                    "note", r.getNoteGlobale(),
                                    "isOuvert", r.isOuvert()
                            )).toList());

                    return ResponseEntity.ok(profile);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    // ─── RESTAURANTS À PROXIMITÉ ──────────────────────────────────

    /**
     * GET /api/client/restaurants/nearby?lat=3.848&lon=11.502&rayon=10
     */
    @GetMapping("/restaurants/nearby")
    public ResponseEntity<List<Restaurant>> getNearbyRestaurants(
            @RequestParam(defaultValue = "3.848") double lat,
            @RequestParam(defaultValue = "11.502") double lon,
            @RequestParam(defaultValue = "10.0") double rayon
    ) {
        return ResponseEntity.ok(restaurantRepository.findNearby(lat, lon, rayon));
    }

    /**
     * GET /api/client/restaurants/{id} — Description complète d'un restaurant.
     * Inclut photos, galerie, plats, note (moyenne), commentaires.
     */
    @GetMapping("/restaurants/{id}")
    public ResponseEntity<?> getRestaurantDescription(@PathVariable Long id) {
        return restaurantRepository.findById(id)
                .map(r -> {
                    Map<String, Object> dto = new HashMap<>();
                    dto.put("id", r.getId());
                    dto.put("nomEtablissement", r.getNomEtablissement());
                    dto.put("description", r.getDescription());
                    dto.put("categorie", r.getCategorie());
                    dto.put("logo", r.getLogo());
                    dto.put("photos", r.getPhotos()); // Galerie
                    dto.put("noteGlobale", r.getNoteGlobale());
                    dto.put("nombreAvis", r.getNombreAvis());
                    dto.put("nombreFollowers", r.getNombreFollowers());
                    dto.put("isOuvert", r.isOuvert());
                    dto.put("tempsLivraisonMoyen", r.getTempsLivraisonMoyen());
                    dto.put("fraisLivraison", r.getFraisLivraison());
                    dto.put("horaires", r.getHoraires());
                    dto.put("adresse", r.getAdresse());
                    dto.put("menu", r.getMenu()); // Tous les plats par catégorie

                    // Les 10 derniers commentaires
                    dto.put("commentaires", avisRepository.findByRestaurantIdOrderByDateAvisDesc(id)
                            .stream().limit(10).toList());

                    return ResponseEntity.ok(dto);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    // ─── SUIVRE / NE PLUS SUIVRE UN RESTAURANT ───────────────────

    /**
     * POST /api/client/restaurants/{id}/follow — Toggle follow restaurant
     */
    @PostMapping("/restaurants/{id}/follow")
    public ResponseEntity<Map<String, Object>> toggleFollowRestaurant(
            @PathVariable Long id,
            @AuthenticationPrincipal User user
    ) {
        Client client = clientRepository.findById(user.getId())
                .orElseThrow(() -> new RuntimeException("Client introuvable"));
        Restaurant restaurant = restaurantRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Restaurant introuvable"));

        boolean suivait = client.getRestaurantsSuivis().contains(restaurant);
        if (suivait) {
            client.getRestaurantsSuivis().remove(restaurant);
            ratingService.decrementerFollowers(id);
        } else {
            client.getRestaurantsSuivis().add(restaurant);
            ratingService.incrementerFollowers(id);
        }
        clientRepository.save(client);

        return ResponseEntity.ok(Map.of(
                "suivi", !suivait,
                "nombreFollowers", restaurant.getNombreFollowers()
        ));
    }

    // ─── LIKER / UNLIKER UN PLAT ──────────────────────────────────

    /**
     * POST /api/client/plats/{id}/like — Toggle like plat
     */
    @PostMapping("/plats/{id}/like")
    public ResponseEntity<Map<String, Object>> toggleLikePlat(
            @PathVariable Long id,
            @AuthenticationPrincipal User user
    ) {
        Client client = clientRepository.findById(user.getId())
                .orElseThrow(() -> new RuntimeException("Client introuvable"));
        Plat plat = platRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Plat introuvable"));

        boolean aimait = client.getPlatsLikes().contains(plat);
        if (aimait) {
            client.getPlatsLikes().remove(plat);
            ratingService.decrementerLikes(id);
        } else {
            client.getPlatsLikes().add(plat);
            ratingService.incrementerLikes(id);
        }
        clientRepository.save(client);

        return ResponseEntity.ok(Map.of(
                "liked", !aimait,
                "nombreLikes", plat.getNombreLikes()
        ));
    }

    /**
     * GET /api/client/plats/likes — Liste des plats likés par le client
     */
    @GetMapping("/plats/likes")
    public ResponseEntity<?> getPlatsLikes(@AuthenticationPrincipal User user) {
        return clientRepository.findById(user.getId())
                .map(client -> ResponseEntity.ok(client.getPlatsLikes()))
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * GET /api/client/favoris — Restaurants favoris
     */
    @GetMapping("/favoris")
    public ResponseEntity<?> getFavoris(@AuthenticationPrincipal User user) {
        return clientRepository.findById(user.getId())
                .map(client -> ResponseEntity.ok(client.getFavoris()))
                .orElse(ResponseEntity.notFound().build());
    }

    // ─── COMMANDES ───────────────────────────────────────────────

    /**
     * POST /api/client/commandes — Passer une commande
     */
    @PostMapping("/commandes")
    public ResponseEntity<?> passerCommande(
            @RequestBody CommandeRequest request,
            @AuthenticationPrincipal User user
    ) {
        try {
            Commande commande = commandeService.creerCommande(user.getId(), request);
            return ResponseEntity.status(HttpStatus.CREATED).body(commande);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("erreur", e.getMessage()));
        }
    }

    /**
     * GET /api/client/commandes — Historique des commandes
     */
    @GetMapping("/commandes")
    public ResponseEntity<List<Commande>> getCommandes(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(commandeRepository.findByClientIdOrderByDateCommandeDesc(user.getId()));
    }

    /**
     * GET /api/client/commandes/{id} — Détail d'une commande
     */
    @GetMapping("/commandes/{id}")
    public ResponseEntity<?> getCommande(@PathVariable Long id, @AuthenticationPrincipal User user) {
        return commandeRepository.findById(id)
                .filter(c -> c.getClient().getId().equals(user.getId()))
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * GET /api/client/commandes/{id}/tracking — Suivi GPS de la livraison
     */
    @GetMapping("/commandes/{id}/tracking")
    public ResponseEntity<?> getTracking(@PathVariable Long id, @AuthenticationPrincipal User user) {
        return commandeRepository.findById(id)
                .filter(c -> c.getClient().getId().equals(user.getId()))
                .map(c -> {
                    Map<String, Object> tracking = new HashMap<>();
                    tracking.put("commandeId", c.getId());
                    tracking.put("statut", c.getStatut());
                    tracking.put("delaiEstime", c.getDelaiEstime());
                    tracking.put("livreurLatitude", c.getLivreurLatitude());
                    tracking.put("livreurLongitude", c.getLivreurLongitude());

                    if (c.getLivreur() != null) {
                        Livreur l = c.getLivreur();
                        tracking.put("livreur", Map.of(
                                "nom", l.getNom(),
                                "prenom", l.getPrenom(),
                                "telephone", l.getTelephone() != null ? l.getTelephone() : "",
                                "vehiculeType", l.getVehiculeType(),
                                "noteGlobale", l.getNoteGlobale()
                        ));
                    }

                    // Étapes du suivi
                    List<Map<String, Object>> etapes = List.of(
                            Map.of("label", "Commande reçue", "fait", true),
                            Map.of("label", "En préparation", "fait",
                                    c.getStatut() != StatutCommande.EN_ATTENTE),
                            Map.of("label", "Livreur en route", "fait",
                                    c.getStatut() == StatutCommande.EN_COLLECTE ||
                                    c.getStatut() == StatutCommande.EN_LIVRAISON ||
                                    c.getStatut() == StatutCommande.LIVREE),
                            Map.of("label", "Livré !", "fait",
                                    c.getStatut() == StatutCommande.LIVREE)
                    );
                    tracking.put("etapes", etapes);

                    return ResponseEntity.ok(tracking);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * POST /api/client/commandes/{id}/avis — Laisser un commentaire + note
     */
    @PostMapping("/commandes/{id}/avis")
    public ResponseEntity<?> laisserAvis(
            @PathVariable Long id,
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal User user
    ) {
        return commandeRepository.findById(id)
                .filter(c -> c.getClient().getId().equals(user.getId()))
                .map(c -> {
                    // Vérifier que la commande est livrée
                    if (c.getStatut() != StatutCommande.LIVREE) {
                        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                                .body((Object) Map.of("erreur", "Vous ne pouvez noter que les commandes livrées"));
                    }

                    // Vérifier si déjà noté
                    if (avisRepository.findByClientIdAndCommandeId(user.getId(), id).isPresent()) {
                        return ResponseEntity.status(HttpStatus.CONFLICT)
                                .body((Object) Map.of("erreur", "Vous avez déjà laissé un avis pour cette commande"));
                    }

                    Client client = clientRepository.findById(user.getId()).orElseThrow();
                    Avis avis = new Avis();
                    avis.setClient(client);
                    avis.setRestaurant(c.getRestaurant());
                    avis.setCommande(c);
                    avis.setCommentaire((String) body.get("commentaire"));

                    if (body.get("notePlat") != null) {
                        avis.setNotePlat(((Number) body.get("notePlat")).doubleValue());
                    }
                    if (body.get("noteLivraison") != null) {
                        avis.setNoteLivraison(((Number) body.get("noteLivraison")).doubleValue());
                    }

                    avisRepository.save(avis);

                    // Recalculer les moyennes
                    ratingService.recalculerNoteRestaurant(c.getRestaurant().getId());

                    return ResponseEntity.status(HttpStatus.CREATED).body((Object) avis);
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
