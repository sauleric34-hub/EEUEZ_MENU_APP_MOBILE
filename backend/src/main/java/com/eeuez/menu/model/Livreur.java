package com.eeuez.menu.model;

import jakarta.persistence.*;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "livreurs")
@PrimaryKeyJoinColumn(name = "user_id")
public class Livreur extends User {

    private String vehiculeType = "moto";
    private String vehiculeMarque;
    private String vehiculePlaque;

    @OneToMany(mappedBy = "livreur", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<DocumentLivreur> documents = new ArrayList<>();

    private boolean isOnline = false;
    private Double positionLatitude;
    private Double positionLongitude;

    @Column(name = "commande_en_cours_id")
    private Long commandeEnCoursId;

    private Double gainTotal = 0.0;
    private Double gainJour = 0.0;
    private Double gainSemaine = 0.0;
    private Double noteGlobale = 0.0;
    private Integer nombreLivraisons = 0;

    public Livreur() {}

    public Livreur(String nom, String prenom, String email, String telephone, String password,
                   String vehiculeType, String vehiculePlaque) {
        setNom(nom); setPrenom(prenom); setEmail(email);
        setTelephone(telephone); setPassword(password);
        setRole("LIVREUR"); setStatut("PENDING");
        this.vehiculeType = vehiculeType;
        this.vehiculePlaque = vehiculePlaque;
    }

    public String getVehiculeType() { return vehiculeType; }
    public void setVehiculeType(String vehiculeType) { this.vehiculeType = vehiculeType; }

    public String getVehiculeMarque() { return vehiculeMarque; }
    public void setVehiculeMarque(String vehiculeMarque) { this.vehiculeMarque = vehiculeMarque; }

    public String getVehiculePlaque() { return vehiculePlaque; }
    public void setVehiculePlaque(String vehiculePlaque) { this.vehiculePlaque = vehiculePlaque; }

    public List<DocumentLivreur> getDocuments() { return documents; }
    public void setDocuments(List<DocumentLivreur> documents) { this.documents = documents; }

    public boolean isOnline() { return isOnline; }
    public void setOnline(boolean online) { isOnline = online; }

    public Double getPositionLatitude() { return positionLatitude; }
    public void setPositionLatitude(Double positionLatitude) { this.positionLatitude = positionLatitude; }

    public Double getPositionLongitude() { return positionLongitude; }
    public void setPositionLongitude(Double positionLongitude) { this.positionLongitude = positionLongitude; }

    public Long getCommandeEnCoursId() { return commandeEnCoursId; }
    public void setCommandeEnCoursId(Long commandeEnCoursId) { this.commandeEnCoursId = commandeEnCoursId; }

    public Double getGainTotal() { return gainTotal; }
    public void setGainTotal(Double gainTotal) { this.gainTotal = gainTotal; }

    public Double getGainJour() { return gainJour; }
    public void setGainJour(Double gainJour) { this.gainJour = gainJour; }

    public Double getGainSemaine() { return gainSemaine; }
    public void setGainSemaine(Double gainSemaine) { this.gainSemaine = gainSemaine; }

    public Double getNoteGlobale() { return noteGlobale; }
    public void setNoteGlobale(Double noteGlobale) { this.noteGlobale = noteGlobale; }

    public Integer getNombreLivraisons() { return nombreLivraisons; }
    public void setNombreLivraisons(Integer nombreLivraisons) { this.nombreLivraisons = nombreLivraisons; }
}
