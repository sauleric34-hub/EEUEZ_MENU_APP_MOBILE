package com.eeuez.menu.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;

@Entity
@Table(name = "horaires")
public class Horaire {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "restaurant_id", nullable = false)
    @JsonIgnore
    private Restaurant restaurant;

    private String jour; // lundi, mardi...
    private String ouverture; // 08:00
    private String fermeture; // 22:00
    private boolean isFerme = false;

    public Horaire() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Restaurant getRestaurant() { return restaurant; }
    public void setRestaurant(Restaurant restaurant) { this.restaurant = restaurant; }

    public String getJour() { return jour; }
    public void setJour(String jour) { this.jour = jour; }

    public String getOuverture() { return ouverture; }
    public void setOuverture(String ouverture) { this.ouverture = ouverture; }

    public String getFermeture() { return fermeture; }
    public void setFermeture(String fermeture) { this.fermeture = fermeture; }

    public boolean isFerme() { return isFerme; }
    public void setFerme(boolean ferme) { isFerme = ferme; }
}
