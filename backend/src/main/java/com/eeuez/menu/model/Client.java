package com.eeuez.menu.model;

import jakarta.persistence.*;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Entity
@Table(name = "clients")
@PrimaryKeyJoinColumn(name = "user_id")
public class Client extends User {

    @OneToMany(mappedBy = "client", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private List<Adresse> adresses = new ArrayList<>();

    @ElementCollection
    @CollectionTable(name = "client_modes_paiement", joinColumns = @JoinColumn(name = "client_id"))
    private List<ModePaiement> modesPaiement = new ArrayList<>();

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(name = "client_favoris",
        joinColumns = @JoinColumn(name = "client_id"),
        inverseJoinColumns = @JoinColumn(name = "restaurant_id"))
    private Set<Restaurant> favoris = new HashSet<>();

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(name = "client_suivis",
        joinColumns = @JoinColumn(name = "client_id"),
        inverseJoinColumns = @JoinColumn(name = "restaurant_id"))
    private Set<Restaurant> restaurantsSuivis = new HashSet<>();

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(name = "client_plats_likes",
        joinColumns = @JoinColumn(name = "client_id"),
        inverseJoinColumns = @JoinColumn(name = "plat_id"))
    private Set<Plat> platsLikes = new HashSet<>();

    @OneToMany(mappedBy = "client", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private List<PanierItem> panier = new ArrayList<>();

    @ElementCollection
    @CollectionTable(name = "client_historique_qr", joinColumns = @JoinColumn(name = "client_id"))
    @Column(name = "qr_code")
    private List<String> historiqueQR = new ArrayList<>();

    public Client() {}

    public Client(String nom, String prenom, String email, String telephone, String password) {
        setNom(nom); setPrenom(prenom); setEmail(email);
        setTelephone(telephone); setPassword(password);
        setRole("CLIENT");
    }

    public List<Adresse> getAdresses() { return adresses; }
    public void setAdresses(List<Adresse> adresses) { this.adresses = adresses; }

    public List<ModePaiement> getModesPaiement() { return modesPaiement; }
    public void setModesPaiement(List<ModePaiement> modesPaiement) { this.modesPaiement = modesPaiement; }

    public Set<Restaurant> getFavoris() { return favoris; }
    public void setFavoris(Set<Restaurant> favoris) { this.favoris = favoris; }

    public Set<Restaurant> getRestaurantsSuivis() { return restaurantsSuivis; }
    public void setRestaurantsSuivis(Set<Restaurant> restaurantsSuivis) { this.restaurantsSuivis = restaurantsSuivis; }

    public Set<Plat> getPlatsLikes() { return platsLikes; }
    public void setPlatsLikes(Set<Plat> platsLikes) { this.platsLikes = platsLikes; }

    public List<PanierItem> getPanier() { return panier; }
    public void setPanier(List<PanierItem> panier) { this.panier = panier; }

    public List<String> getHistoriqueQR() { return historiqueQR; }
    public void setHistoriqueQR(List<String> historiqueQR) { this.historiqueQR = historiqueQR; }
}
