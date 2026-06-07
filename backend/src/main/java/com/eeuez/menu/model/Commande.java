package com.eeuez.menu.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "commandes")
public class Commande {

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
    @JoinColumn(name = "livreur_id")
    private Livreur livreur;

    @OneToMany(mappedBy = "commande", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<CommandeItem> items = new ArrayList<>();

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private StatutCommande statut = StatutCommande.EN_ATTENTE;

    @Enumerated(EnumType.STRING)
    private TypeCommande type = TypeCommande.LIVRAISON;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "adresse_livraison_id")
    private Adresse adresseLivraison;

    private Long tableId;
    private Double montantSousTotal;
    private Double fraisLivraison;
    private Double montantTotal;
    private String modePaiementType;
    private String modePaiementNumero;

    private LocalDateTime dateCommande = LocalDateTime.now();
    private LocalDateTime dateLivraison;
    private Integer delaiEstime = 30;

    private Double livreurLatitude;
    private Double livreurLongitude;

    @Column(columnDefinition = "TEXT")
    private String instructions;

    private String raisonRefus;

    public Commande() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Client getClient() { return client; }
    public void setClient(Client client) { this.client = client; }

    public Restaurant getRestaurant() { return restaurant; }
    public void setRestaurant(Restaurant restaurant) { this.restaurant = restaurant; }

    public Livreur getLivreur() { return livreur; }
    public void setLivreur(Livreur livreur) { this.livreur = livreur; }

    public List<CommandeItem> getItems() { return items; }
    public void setItems(List<CommandeItem> items) { this.items = items; }

    public StatutCommande getStatut() { return statut; }
    public void setStatut(StatutCommande statut) { this.statut = statut; }

    public TypeCommande getType() { return type; }
    public void setType(TypeCommande type) { this.type = type; }

    public Adresse getAdresseLivraison() { return adresseLivraison; }
    public void setAdresseLivraison(Adresse adresseLivraison) { this.adresseLivraison = adresseLivraison; }

    public Long getTableId() { return tableId; }
    public void setTableId(Long tableId) { this.tableId = tableId; }

    public Double getMontantSousTotal() { return montantSousTotal; }
    public void setMontantSousTotal(Double montantSousTotal) { this.montantSousTotal = montantSousTotal; }

    public Double getFraisLivraison() { return fraisLivraison; }
    public void setFraisLivraison(Double fraisLivraison) { this.fraisLivraison = fraisLivraison; }

    public Double getMontantTotal() { return montantTotal; }
    public void setMontantTotal(Double montantTotal) { this.montantTotal = montantTotal; }

    public String getModePaiementType() { return modePaiementType; }
    public void setModePaiementType(String modePaiementType) { this.modePaiementType = modePaiementType; }

    public String getModePaiementNumero() { return modePaiementNumero; }
    public void setModePaiementNumero(String modePaiementNumero) { this.modePaiementNumero = modePaiementNumero; }

    public LocalDateTime getDateCommande() { return dateCommande; }
    public void setDateCommande(LocalDateTime dateCommande) { this.dateCommande = dateCommande; }

    public LocalDateTime getDateLivraison() { return dateLivraison; }
    public void setDateLivraison(LocalDateTime dateLivraison) { this.dateLivraison = dateLivraison; }

    public Integer getDelaiEstime() { return delaiEstime; }
    public void setDelaiEstime(Integer delaiEstime) { this.delaiEstime = delaiEstime; }

    public Double getLivreurLatitude() { return livreurLatitude; }
    public void setLivreurLatitude(Double livreurLatitude) { this.livreurLatitude = livreurLatitude; }

    public Double getLivreurLongitude() { return livreurLongitude; }
    public void setLivreurLongitude(Double livreurLongitude) { this.livreurLongitude = livreurLongitude; }

    public String getInstructions() { return instructions; }
    public void setInstructions(String instructions) { this.instructions = instructions; }

    public String getRaisonRefus() { return raisonRefus; }
    public void setRaisonRefus(String raisonRefus) { this.raisonRefus = raisonRefus; }
}
