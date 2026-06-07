package com.eeuez.menu.model;

import jakarta.persistence.*;

@Entity
@Table(name = "adresses")
public class Adresse {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "client_id")
    private Client client;

    private String libelle;
    private String ville;
    private String quartier;
    private String description;

    private Double latitude;
    private Double longitude;

    private boolean isParDefaut = false;

    public Adresse() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Client getClient() { return client; }
    public void setClient(Client client) { this.client = client; }

    public String getLibelle() { return libelle; }
    public void setLibelle(String libelle) { this.libelle = libelle; }

    public String getVille() { return ville; }
    public void setVille(String ville) { this.ville = ville; }

    public String getQuartier() { return quartier; }
    public void setQuartier(String quartier) { this.quartier = quartier; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public Double getLatitude() { return latitude; }
    public void setLatitude(Double latitude) { this.latitude = latitude; }

    public Double getLongitude() { return longitude; }
    public void setLongitude(Double longitude) { this.longitude = longitude; }

    public boolean isParDefaut() { return isParDefaut; }
    public void setParDefaut(boolean parDefaut) { isParDefaut = parDefaut; }
}
