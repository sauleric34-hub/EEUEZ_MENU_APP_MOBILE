package com.eeuez.menu.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "avis")
public class Avis {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "client_id", nullable = false)
    private Client client;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "restaurant_id", nullable = false)
    private Restaurant restaurant;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "plat_id")
    private Plat plat;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "commande_id")
    private Commande commande;

    @Column(columnDefinition = "TEXT")
    private String commentaire;

    private Double notePlat;
    private Double noteLivraison;

    private LocalDateTime dateAvis = LocalDateTime.now();

    public Avis() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Client getClient() { return client; }
    public void setClient(Client client) { this.client = client; }

    public Restaurant getRestaurant() { return restaurant; }
    public void setRestaurant(Restaurant restaurant) { this.restaurant = restaurant; }

    public Plat getPlat() { return plat; }
    public void setPlat(Plat plat) { this.plat = plat; }

    public Commande getCommande() { return commande; }
    public void setCommande(Commande commande) { this.commande = commande; }

    public String getCommentaire() { return commentaire; }
    public void setCommentaire(String commentaire) { this.commentaire = commentaire; }

    public Double getNotePlat() { return notePlat; }
    public void setNotePlat(Double notePlat) { this.notePlat = notePlat; }

    public Double getNoteLivraison() { return noteLivraison; }
    public void setNoteLivraison(Double noteLivraison) { this.noteLivraison = noteLivraison; }

    public LocalDateTime getDateAvis() { return dateAvis; }
    public void setDateAvis(LocalDateTime dateAvis) { this.dateAvis = dateAvis; }
}
