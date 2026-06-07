package com.eeuez.menu.model;

import jakarta.persistence.*;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "restaurants")
@PrimaryKeyJoinColumn(name = "user_id")
public class Restaurant extends User {

    @Column(nullable = false)
    private String nomEtablissement;

    @Column(columnDefinition = "TEXT")
    private String description;

    private String categorie;
    private String logo;

    @ElementCollection
    @CollectionTable(name = "restaurant_photos", joinColumns = @JoinColumn(name = "restaurant_id"))
    @Column(name = "photo_url")
    private List<String> photos = new ArrayList<>();

    @OneToOne(cascade = CascadeType.ALL, orphanRemoval = true)
    @JoinColumn(name = "adresse_id")
    private Adresse adresse;

    private Double latitude;
    private Double longitude;

    private boolean isOuvert = true;
    private Double noteGlobale = 0.0;
    private Integer nombreAvis = 0;
    private Integer nombreFollowers = 0;
    private Integer tempsLivraisonMoyen = 30;
    private Integer fraisLivraison = 500;

    @OneToMany(mappedBy = "restaurant", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Horaire> horaires = new ArrayList<>();

    @OneToMany(mappedBy = "restaurant", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("ordre ASC")
    private List<Categorie> menu = new ArrayList<>();

    @OneToMany(mappedBy = "restaurant", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("numero ASC")
    private List<TableRestaurant> tables = new ArrayList<>();

    @OneToMany(mappedBy = "restaurant", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Promotion> promotions = new ArrayList<>();

    private Double revenusJour = 0.0;
    private Double revenusSemaine = 0.0;
    private Double revenusMois = 0.0;
    private Integer nombreCommandesJour = 0;
    private Double tauxAcceptation = 100.0;

    public Restaurant() {}

    public Restaurant(String nom, String prenom, String email, String telephone, String password,
                      String nomEtablissement, String categorie) {
        setNom(nom); setPrenom(prenom); setEmail(email);
        setTelephone(telephone); setPassword(password);
        setRole("RESTAURANT"); setStatut("PENDING");
        this.nomEtablissement = nomEtablissement;
        this.categorie = categorie;
    }

    public String getNomEtablissement() { return nomEtablissement; }
    public void setNomEtablissement(String nomEtablissement) { this.nomEtablissement = nomEtablissement; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getCategorie() { return categorie; }
    public void setCategorie(String categorie) { this.categorie = categorie; }

    public String getLogo() { return logo; }
    public void setLogo(String logo) { this.logo = logo; }

    public List<String> getPhotos() { return photos; }
    public void setPhotos(List<String> photos) { this.photos = photos; }

    public Adresse getAdresse() { return adresse; }
    public void setAdresse(Adresse adresse) { this.adresse = adresse; }

    public Double getLatitude() { return latitude; }
    public void setLatitude(Double latitude) { this.latitude = latitude; }

    public Double getLongitude() { return longitude; }
    public void setLongitude(Double longitude) { this.longitude = longitude; }

    public boolean isOuvert() { return isOuvert; }
    public void setOuvert(boolean ouvert) { isOuvert = ouvert; }

    public Double getNoteGlobale() { return noteGlobale; }
    public void setNoteGlobale(Double noteGlobale) { this.noteGlobale = noteGlobale; }

    public Integer getNombreAvis() { return nombreAvis; }
    public void setNombreAvis(Integer nombreAvis) { this.nombreAvis = nombreAvis; }

    public Integer getNombreFollowers() { return nombreFollowers; }
    public void setNombreFollowers(Integer nombreFollowers) { this.nombreFollowers = nombreFollowers; }

    public Integer getTempsLivraisonMoyen() { return tempsLivraisonMoyen; }
    public void setTempsLivraisonMoyen(Integer tempsLivraisonMoyen) { this.tempsLivraisonMoyen = tempsLivraisonMoyen; }

    public Integer getFraisLivraison() { return fraisLivraison; }
    public void setFraisLivraison(Integer fraisLivraison) { this.fraisLivraison = fraisLivraison; }

    public List<Horaire> getHoraires() { return horaires; }
    public void setHoraires(List<Horaire> horaires) { this.horaires = horaires; }

    public List<Categorie> getMenu() { return menu; }
    public void setMenu(List<Categorie> menu) { this.menu = menu; }

    public List<TableRestaurant> getTables() { return tables; }
    public void setTables(List<TableRestaurant> tables) { this.tables = tables; }

    public List<Promotion> getPromotions() { return promotions; }
    public void setPromotions(List<Promotion> promotions) { this.promotions = promotions; }

    public Double getRevenusJour() { return revenusJour; }
    public void setRevenusJour(Double revenusJour) { this.revenusJour = revenusJour; }

    public Double getRevenusSemaine() { return revenusSemaine; }
    public void setRevenusSemaine(Double revenusSemaine) { this.revenusSemaine = revenusSemaine; }

    public Double getRevenusMois() { return revenusMois; }
    public void setRevenusMois(Double revenusMois) { this.revenusMois = revenusMois; }

    public Integer getNombreCommandesJour() { return nombreCommandesJour; }
    public void setNombreCommandesJour(Integer nombreCommandesJour) { this.nombreCommandesJour = nombreCommandesJour; }

    public Double getTauxAcceptation() { return tauxAcceptation; }
    public void setTauxAcceptation(Double tauxAcceptation) { this.tauxAcceptation = tauxAcceptation; }
}
