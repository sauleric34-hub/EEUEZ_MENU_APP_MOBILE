package com.eeuez.menu.controller;

import com.eeuez.menu.model.*;
import com.eeuez.menu.repository.*;
import com.eeuez.menu.service.CommandeService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Controller Espace Livreur EEUEZ Menu.
 * Gère les missions, la position GPS, les gains.
 */
@RestController
@RequestMapping("/api/livreur")
@CrossOrigin(origins = "*")
public class LivreurController {

    private final LivreurRepository livreurRepository;
    private final CommandeRepository commandeRepository;
    private final CommandeService commandeService;

    public LivreurController(
            LivreurRepository livreurRepository,
            CommandeRepository commandeRepository,
            CommandeService commandeService
    ) {
        this.livreurRepository = livreurRepository;
        this.commandeRepository = commandeRepository;
        this.commandeService = commandeService;
    }

    /**
     * GET /api/livreur/workspace — Dashboard livreur
     */
    @GetMapping("/workspace")
    public ResponseEntity<?> getWorkspace(@AuthenticationPrincipal User user) {
        return livreurRepository.findById(user.getId())
                .map(l -> {
                    Map<String, Object> workspace = new HashMap<>();
                    workspace.put("id", l.getId());
                    workspace.put("nom", l.getNom());
                    workspace.put("prenom", l.getPrenom());
                    workspace.put("isOnline", l.isOnline());
                    workspace.put("vehiculeType", l.getVehiculeType());
                    workspace.put("vehiculePlaque", l.getVehiculePlaque());
                    workspace.put("noteGlobale", l.getNoteGlobale());
                    workspace.put("nombreLivraisons", l.getNombreLivraisons());

                    // Gains
                    workspace.put("gainJour", l.getGainJour());
                    workspace.put("gainSemaine", l.getGainSemaine());
                    workspace.put("gainTotal", l.getGainTotal());

                    // Commande en cours
                    if (l.getCommandeEnCoursId() != null) {
                        commandeRepository.findById(l.getCommandeEnCoursId())
                                .ifPresent(c -> workspace.put("commandeEnCours", c));
                    }

                    return ResponseEntity.ok(workspace);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * PUT /api/livreur/status — Toggle en ligne / hors ligne
     */
    @PutMapping("/status")
    public ResponseEntity<?> toggleStatus(@AuthenticationPrincipal User user) {
        return livreurRepository.findById(user.getId())
                .map(l -> {
                    l.setOnline(!l.isOnline());
                    Livreur saved = livreurRepository.save(l);
                    return ResponseEntity.ok(Map.of("isOnline", saved.isOnline()));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * PUT /api/livreur/position
     * Body: { "latitude": 3.848, "longitude": 11.502 }
     * Met à jour la position du livreur ET de la commande en cours.
     */
    @PutMapping("/position")
    public ResponseEntity<?> updatePosition(
            @RequestBody Map<String, Double> body,
            @AuthenticationPrincipal User user
    ) {
        return livreurRepository.findById(user.getId())
                .map(l -> {
                    Double lat = body.get("latitude");
                    Double lon = body.get("longitude");
                    l.setPositionLatitude(lat);
                    l.setPositionLongitude(lon);
                    livreurRepository.save(l);

                    // Mettre à jour la position dans la commande en cours (pour le tracking)
                    if (l.getCommandeEnCoursId() != null) {
                        commandeService.mettreAjourPositionLivreur(l.getCommandeEnCoursId(), lat, lon);
                    }

                    return ResponseEntity.ok(Map.of("latitude", lat, "longitude", lon));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * GET /api/livreur/missions — Missions disponibles à accepter
     */
    @GetMapping("/missions")
    public ResponseEntity<List<Commande>> getMissionsDisponibles(@AuthenticationPrincipal User user) {
        return livreurRepository.findById(user.getId())
                .filter(Livreur::isOnline)
                .map(l -> ResponseEntity.ok(commandeService.getMissionsDisponibles()))
                .orElse(ResponseEntity.ok(List.of()));
    }

    /**
     * POST /api/livreur/missions/{id}/accept — Accepter une mission
     */
    @PostMapping("/missions/{id}/accept")
    public ResponseEntity<?> accepterMission(@PathVariable Long id, @AuthenticationPrincipal User user) {
        try {
            return livreurRepository.findById(user.getId())
                    .map(l -> {
                        if (l.getCommandeEnCoursId() != null) {
                            return ResponseEntity.badRequest()
                                    .body((Object) Map.of("erreur", "Vous avez déjà une commande en cours"));
                        }
                        Commande commande = commandeService.assignerLivreur(id, l.getId());
                        return ResponseEntity.ok((Object) commande);
                    })
                    .orElse(ResponseEntity.notFound().build());
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("erreur", e.getMessage()));
        }
    }

    /**
     * PUT /api/livreur/missions/{id}/collected — Marquer comme collecté au restaurant
     */
    @PutMapping("/missions/{id}/collected")
    public ResponseEntity<?> marquerCollecte(@PathVariable Long id, @AuthenticationPrincipal User user) {
        try {
            Commande commande = commandeService.changerStatut(id, StatutCommande.EN_LIVRAISON, user.getId());
            return ResponseEntity.ok(commande);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("erreur", e.getMessage()));
        }
    }

    /**
     * PUT /api/livreur/missions/{id}/delivered — Marquer comme livré
     */
    @PutMapping("/missions/{id}/delivered")
    public ResponseEntity<?> marquerLivre(@PathVariable Long id, @AuthenticationPrincipal User user) {
        try {
            Commande commande = commandeService.changerStatut(id, StatutCommande.LIVREE, user.getId());
            return ResponseEntity.ok(commande);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("erreur", e.getMessage()));
        }
    }

    /**
     * GET /api/livreur/gains — Historique des gains (5 dernières livraisons)
     */
    @GetMapping("/gains")
    public ResponseEntity<?> getGains(@AuthenticationPrincipal User user) {
        return livreurRepository.findById(user.getId())
                .map(l -> {
                    Map<String, Object> gains = new HashMap<>();
                    gains.put("gainJour", l.getGainJour());
                    gains.put("gainSemaine", l.getGainSemaine());
                    gains.put("gainTotal", l.getGainTotal());
                    gains.put("nombreLivraisons", l.getNombreLivraisons());
                    gains.put("noteGlobale", l.getNoteGlobale());

                    List<Commande> dernieresLivraisons = commandeRepository
                            .findByLivreurIdOrderByDateCommandeDesc(l.getId())
                            .stream().limit(10).toList();
                    gains.put("dernieresLivraisons", dernieresLivraisons);

                    return ResponseEntity.ok(gains);
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
