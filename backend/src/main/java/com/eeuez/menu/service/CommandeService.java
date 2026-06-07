package com.eeuez.menu.service;

import com.eeuez.menu.dto.CommandeRequest;
import com.eeuez.menu.model.*;
import com.eeuez.menu.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Service de gestion des commandes EEUEZ Menu.
 * Gère tout le cycle de vie d'une commande.
 */
@Service
@Transactional
public class CommandeService {

    private final CommandeRepository commandeRepository;
    private final ClientRepository clientRepository;
    private final RestaurantRepository restaurantRepository;
    private final LivreurRepository livreurRepository;
    private final PlatRepository platRepository;
    private final GeoService geoService;

    public CommandeService(
            CommandeRepository commandeRepository,
            ClientRepository clientRepository,
            RestaurantRepository restaurantRepository,
            LivreurRepository livreurRepository,
            PlatRepository platRepository,
            GeoService geoService
    ) {
        this.commandeRepository = commandeRepository;
        this.clientRepository = clientRepository;
        this.restaurantRepository = restaurantRepository;
        this.livreurRepository = livreurRepository;
        this.platRepository = platRepository;
        this.geoService = geoService;
    }

    // ─── CRÉER UNE COMMANDE ───────────────────────────────────────

    public Commande creerCommande(Long clientId, CommandeRequest request) {
        Client client = clientRepository.findById(clientId)
                .orElseThrow(() -> new RuntimeException("Client introuvable"));

        Restaurant restaurant = restaurantRepository.findById(request.getRestaurantId())
                .orElseThrow(() -> new RuntimeException("Restaurant introuvable"));

        if (!restaurant.isOuvert()) {
            throw new RuntimeException("Le restaurant est fermé");
        }

        Commande commande = new Commande();
        commande.setClient(client);
        commande.setRestaurant(restaurant);
        commande.setType(TypeCommande.valueOf(request.getType()));
        commande.setInstructions(request.getInstructions());
        commande.setModePaiementType(request.getModePaiementType());
        commande.setModePaiementNumero(request.getModePaiementNumero());
        commande.setFraisLivraison(request.getType().equals("LIVRAISON") ? restaurant.getFraisLivraison().doubleValue() : 0.0);

        // Créer les items
        double sousTotal = 0.0;
        for (CommandeRequest.CommandeItemRequest itemReq : request.getItems()) {
            Plat plat = platRepository.findById(itemReq.getPlatId())
                    .orElseThrow(() -> new RuntimeException("Plat introuvable: " + itemReq.getPlatId()));

            if (!plat.isDisponible()) {
                throw new RuntimeException("Le plat '" + plat.getNom() + "' n'est plus disponible");
            }

            CommandeItem item = new CommandeItem();
            item.setCommande(commande);
            item.setPlat(plat);
            item.setQuantite(itemReq.getQuantite());
            item.setPrixUnitaire(plat.getPrix());
            item.setSousTotal(plat.getPrix() * itemReq.getQuantite());
            item.setInstructions(itemReq.getInstructions());
            item.setOptionsChoisies(itemReq.getOptionsChoisies());
            commande.getItems().add(item);
            sousTotal += item.getSousTotal();
        }

        commande.setMontantSousTotal(sousTotal);
        commande.setMontantTotal(sousTotal + commande.getFraisLivraison());

        // Estimer le délai
        commande.setDelaiEstime(restaurant.getTempsLivraisonMoyen());

        return commandeRepository.save(commande);
    }

    // ─── CHANGER LE STATUT D'UNE COMMANDE ────────────────────────

    public Commande changerStatut(Long commandeId, StatutCommande nouveauStatut, Long acteurId) {
        Commande commande = commandeRepository.findById(commandeId)
                .orElseThrow(() -> new RuntimeException("Commande introuvable"));

        StatutCommande ancienStatut = commande.getStatut();
        commande.setStatut(nouveauStatut);

        // Marquer la date de livraison si terminé
        if (nouveauStatut == StatutCommande.LIVREE) {
            commande.setDateLivraison(LocalDateTime.now());
            // Mettre à jour les gains du livreur
            if (commande.getLivreur() != null) {
                majGainsLivreur(commande);
            }
            // Mettre à jour les stats du restaurant
            majStatsRestaurant(commande);
        }

        return commandeRepository.save(commande);
    }

    // ─── ACCEPTER UNE COMMANDE ────────────────────────────────────

    public Commande accepterCommande(Long commandeId, Integer delaiMinutes) {
        Commande commande = commandeRepository.findById(commandeId)
                .orElseThrow(() -> new RuntimeException("Commande introuvable"));

        if (commande.getStatut() != StatutCommande.EN_ATTENTE) {
            throw new RuntimeException("Cette commande ne peut plus être acceptée");
        }

        commande.setStatut(StatutCommande.ACCEPTEE);
        commande.setDelaiEstime(delaiMinutes != null ? delaiMinutes : commande.getRestaurant().getTempsLivraisonMoyen());
        return commandeRepository.save(commande);
    }

    // ─── REFUSER UNE COMMANDE ─────────────────────────────────────

    public Commande refuserCommande(Long commandeId, String raison) {
        Commande commande = commandeRepository.findById(commandeId)
                .orElseThrow(() -> new RuntimeException("Commande introuvable"));

        commande.setStatut(StatutCommande.REFUSEE);
        commande.setRaisonRefus(raison);
        return commandeRepository.save(commande);
    }

    // ─── ASSIGNER UN LIVREUR ─────────────────────────────────────

    public Commande assignerLivreur(Long commandeId, Long livreurId) {
        Commande commande = commandeRepository.findById(commandeId)
                .orElseThrow(() -> new RuntimeException("Commande introuvable"));
        Livreur livreur = livreurRepository.findById(livreurId)
                .orElseThrow(() -> new RuntimeException("Livreur introuvable"));

        commande.setLivreur(livreur);
        commande.setStatut(StatutCommande.LIVREUR_ASSIGNE);
        livreur.setCommandeEnCoursId(commandeId);
        livreurRepository.save(livreur);

        return commandeRepository.save(commande);
    }

    // ─── METTRE À JOUR LA POSITION GPS DU LIVREUR ─────────────────

    public Commande mettreAjourPositionLivreur(Long commandeId, Double lat, Double lon) {
        Commande commande = commandeRepository.findById(commandeId)
                .orElseThrow(() -> new RuntimeException("Commande introuvable"));

        commande.setLivreurLatitude(lat);
        commande.setLivreurLongitude(lon);
        return commandeRepository.save(commande);
    }

    // ─── RÉCUPÉRER LES MISSIONS DISPONIBLES ───────────────────────

    public List<Commande> getMissionsDisponibles() {
        return commandeRepository.findByLivreurIsNullAndStatutIn(
                List.of(StatutCommande.PRETE, StatutCommande.ACCEPTEE)
        );
    }

    // ─── HELPERS PRIVÉS ──────────────────────────────────────────

    private void majGainsLivreur(Commande commande) {
        Livreur livreur = commande.getLivreur();
        double commission = commande.getFraisLivraison() * 0.7; // 70% des frais pour le livreur
        livreur.setGainTotal(livreur.getGainTotal() + commission);
        livreur.setGainJour(livreur.getGainJour() + commission);
        livreur.setGainSemaine(livreur.getGainSemaine() + commission);
        livreur.setNombreLivraisons(livreur.getNombreLivraisons() + 1);
        livreur.setCommandeEnCoursId(null);
        livreurRepository.save(livreur);
    }

    private void majStatsRestaurant(Commande commande) {
        Restaurant restaurant = commande.getRestaurant();
        restaurant.setRevenusJour(restaurant.getRevenusJour() + commande.getMontantSousTotal());
        restaurant.setRevenusSemaine(restaurant.getRevenusSemaine() + commande.getMontantSousTotal());
        restaurant.setRevenusMois(restaurant.getRevenusMois() + commande.getMontantSousTotal());
        restaurant.setNombreCommandesJour(restaurant.getNombreCommandesJour() + 1);
        restaurantRepository.save(restaurant);
    }
}
