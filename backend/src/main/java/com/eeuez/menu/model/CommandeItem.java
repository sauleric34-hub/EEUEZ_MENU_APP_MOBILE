package com.eeuez.menu.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;

@Entity
@Table(name = "commande_items")
public class CommandeItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "commande_id", nullable = false)
    @JsonIgnore
    private Commande commande;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "plat_id", nullable = false)
    private Plat plat;

    private Integer quantite;
    private Double prixUnitaire;
    private Double sousTotal;

    @Column(columnDefinition = "TEXT")
    private String optionsChoisies;

    @Column(columnDefinition = "TEXT")
    private String instructions;

    public CommandeItem() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Commande getCommande() { return commande; }
    public void setCommande(Commande commande) { this.commande = commande; }

    public Plat getPlat() { return plat; }
    public void setPlat(Plat plat) { this.plat = plat; }

    public Integer getQuantite() { return quantite; }
    public void setQuantite(Integer quantite) { this.quantite = quantite; }

    public Double getPrixUnitaire() { return prixUnitaire; }
    public void setPrixUnitaire(Double prixUnitaire) { this.prixUnitaire = prixUnitaire; }

    public Double getSousTotal() { return sousTotal; }
    public void setSousTotal(Double sousTotal) { this.sousTotal = sousTotal; }

    public String getOptionsChoisies() { return optionsChoisies; }
    public void setOptionsChoisies(String optionsChoisies) { this.optionsChoisies = optionsChoisies; }

    public String getInstructions() { return instructions; }
    public void setInstructions(String instructions) { this.instructions = instructions; }
}
