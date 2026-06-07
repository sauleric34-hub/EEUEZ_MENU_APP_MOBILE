package com.eeuez.menu.model;

import jakarta.persistence.*;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "plats")
public class Plat {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "restaurant_id", nullable = false)
    private Restaurant restaurant;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "categorie_id")
    private Categorie categorie;

    @Column(nullable = false)
    private String nom;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(nullable = false)
    private Double prix;

    private String photo;

    @ElementCollection
    @CollectionTable(name = "plat_photos", joinColumns = @JoinColumn(name = "plat_id"))
    @Column(name = "photo_url")
    private List<String> photos = new ArrayList<>();

    @ElementCollection
    @CollectionTable(name = "plat_ingredients", joinColumns = @JoinColumn(name = "plat_id"))
    @Column(name = "ingredient")
    private List<String> ingredients = new ArrayList<>();

    @ElementCollection
    @CollectionTable(name = "plat_allergenes", joinColumns = @JoinColumn(name = "plat_id"))
    @Column(name = "allergene")
    private List<String> allergenes = new ArrayList<>();

    @ElementCollection
    @CollectionTable(name = "plat_tags", joinColumns = @JoinColumn(name = "plat_id"))
    @Column(name = "tag")
    private List<String> tags = new ArrayList<>();

    private boolean isDisponible = true;
    private boolean isPopulaire = false;
    private boolean isVegetarien = false;
    private boolean isEpice = false;

    private Integer tempsPreparation = 15;
    private Double noteGlobale = 0.0;
    private Integer nombreAvis = 0;
    private Integer nombreLikes = 0;
    private Integer calories;

    // Options supplémentaires (taille, supplément...)
    @Column(columnDefinition = "TEXT")
    private String optionsJson;

    public Plat() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Restaurant getRestaurant() { return restaurant; }
    public void setRestaurant(Restaurant restaurant) { this.restaurant = restaurant; }

    public Categorie getCategorie() { return categorie; }
    public void setCategorie(Categorie categorie) { this.categorie = categorie; }

    public String getNom() { return nom; }
    public void setNom(String nom) { this.nom = nom; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public Double getPrix() { return prix; }
    public void setPrix(Double prix) { this.prix = prix; }

    public String getPhoto() { return photo; }
    public void setPhoto(String photo) { this.photo = photo; }

    public List<String> getPhotos() { return photos; }
    public void setPhotos(List<String> photos) { this.photos = photos; }

    public List<String> getIngredients() { return ingredients; }
    public void setIngredients(List<String> ingredients) { this.ingredients = ingredients; }

    public List<String> getAllergenes() { return allergenes; }
    public void setAllergenes(List<String> allergenes) { this.allergenes = allergenes; }

    public List<String> getTags() { return tags; }
    public void setTags(List<String> tags) { this.tags = tags; }

    public boolean isDisponible() { return isDisponible; }
    public void setDisponible(boolean disponible) { isDisponible = disponible; }

    public boolean isPopulaire() { return isPopulaire; }
    public void setPopulaire(boolean populaire) { isPopulaire = populaire; }

    public boolean isVegetarien() { return isVegetarien; }
    public void setVegetarien(boolean vegetarien) { isVegetarien = vegetarien; }

    public boolean isEpice() { return isEpice; }
    public void setEpice(boolean epice) { isEpice = epice; }

    public Integer getTempsPreparation() { return tempsPreparation; }
    public void setTempsPreparation(Integer tempsPreparation) { this.tempsPreparation = tempsPreparation; }

    public Double getNoteGlobale() { return noteGlobale; }
    public void setNoteGlobale(Double noteGlobale) { this.noteGlobale = noteGlobale; }

    public Integer getNombreAvis() { return nombreAvis; }
    public void setNombreAvis(Integer nombreAvis) { this.nombreAvis = nombreAvis; }

    public Integer getNombreLikes() { return nombreLikes; }
    public void setNombreLikes(Integer nombreLikes) { this.nombreLikes = nombreLikes; }

    public Integer getCalories() { return calories; }
    public void setCalories(Integer calories) { this.calories = calories; }

    public String getOptionsJson() { return optionsJson; }
    public void setOptionsJson(String optionsJson) { this.optionsJson = optionsJson; }
}
