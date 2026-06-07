package com.eeuez.menu.controller;

import com.eeuez.menu.dto.TrackingDTO;
import com.eeuez.menu.repository.CommandeRepository;
import com.eeuez.menu.repository.LivreurRepository;
import com.eeuez.menu.service.CommandeService;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.CrossOrigin;

/**
 * Controller WebSocket pour le suivi de livraison en temps réel.
 *
 * Flux :
 * 1. Livreur envoie position → /app/tracking/update
 * 2. Serveur broadcast → /topic/commande/{id}/tracking
 * 3. Client (React Native) reçoit la mise à jour GPS
 */
@Controller
@CrossOrigin(origins = "*")
public class TrackingController {

    private final SimpMessagingTemplate messagingTemplate;
    private final CommandeService commandeService;
    private final LivreurRepository livreurRepository;

    public TrackingController(
            SimpMessagingTemplate messagingTemplate,
            CommandeService commandeService,
            LivreurRepository livreurRepository
    ) {
        this.messagingTemplate = messagingTemplate;
        this.commandeService = commandeService;
        this.livreurRepository = livreurRepository;
    }

    /**
     * Le livreur envoie sa position GPS.
     * Reçu via STOMP : /app/tracking/update
     * Broadcasté vers : /topic/commande/{commandeId}/tracking
     */
    @MessageMapping("/tracking/update")
    public void updateTracking(TrackingDTO trackingDTO) {
        // Persister la position dans la commande
        if (trackingDTO.getCommandeId() != null) {
            commandeService.mettreAjourPositionLivreur(
                    trackingDTO.getCommandeId(),
                    trackingDTO.getLatitude(),
                    trackingDTO.getLongitude()
            );

            // Mettre à jour la position du livreur aussi
            if (trackingDTO.getLivreurId() != null) {
                livreurRepository.findById(trackingDTO.getLivreurId()).ifPresent(l -> {
                    l.setPositionLatitude(trackingDTO.getLatitude());
                    l.setPositionLongitude(trackingDTO.getLongitude());
                    livreurRepository.save(l);
                });
            }

            // Diffuser la position à tous les abonnés du topic de cette commande
            messagingTemplate.convertAndSend(
                    "/topic/commande/" + trackingDTO.getCommandeId() + "/tracking",
                    trackingDTO
            );
        }
    }

    /**
     * Envoyer une notification de changement de statut.
     * Appelé par CommandeService après chaque changement de statut.
     */
    public void notifierChangementStatut(Long commandeId, String nouveauStatut) {
        TrackingDTO notif = new TrackingDTO();
        notif.setCommandeId(commandeId);
        notif.setStatut(nouveauStatut);

        messagingTemplate.convertAndSend(
                "/topic/commande/" + commandeId + "/statut",
                notif
        );
    }
}
