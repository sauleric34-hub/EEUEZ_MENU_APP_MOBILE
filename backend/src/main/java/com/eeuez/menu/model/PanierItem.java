package com.eeuez.menu.model;

import jakarta.persistence.*;

@Entity
@Table(name = "panier_items")
public class PanierItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "client_id", nullable = false)
    private Client client;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "plat_id", nullable = false)
    private Plat plat;

    private Integer quantite = 1;

    @Column(columnDefinition = "TEXT")
    private String optionsChoisies;

    @Column(columnDefinition = "TEXT")
    private String instructions;

    private Double sousTotal;

    public PanierItem() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Client getClient() { return client; }
    public void setClient(Client client) { this.client = client; }

    public Plat getPlat() { return plat; }
    public void setPlat(Plat plat) { this.plat = plat; }

    public Integer getQuantite() { return quantite; }
    public void setQuantite(Integer quantite) { this.quantite = quantite; }

    public String getOptionsChoisies() { return optionsChoisies; }
    public void setOptionsChoisies(String optionsChoisies) { this.optionsChoisies = optionsChoisies; }

    public String getInstructions() { return instructions; }
    public void setInstructions(String instructions) { this.instructions = instructions; }

    public Double getSousTotal() { return sousTotal; }
    public void setSousTotal(Double sousTotal) { this.sousTotal = sousTotal; }
}
