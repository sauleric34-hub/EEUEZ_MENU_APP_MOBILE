package com.eeuez.menu.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "promotions")
public class Promotion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "restaurant_id", nullable = false)
    @JsonIgnore
    private Restaurant restaurant;

    private String code;
    private String description;

    private Double reductionPourcentage;
    private Double reductionFixe;
    private Double minimumAchat;

    private LocalDateTime dateDebut;
    private LocalDateTime dateFin;
    private boolean isActive = true;

    public Promotion() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Restaurant getRestaurant() { return restaurant; }
    public void setRestaurant(Restaurant restaurant) { this.restaurant = restaurant; }

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public Double getReductionPourcentage() { return reductionPourcentage; }
    public void setReductionPourcentage(Double reductionPourcentage) { this.reductionPourcentage = reductionPourcentage; }

    public Double getReductionFixe() { return reductionFixe; }
    public void setReductionFixe(Double reductionFixe) { this.reductionFixe = reductionFixe; }

    public Double getMinimumAchat() { return minimumAchat; }
    public void setMinimumAchat(Double minimumAchat) { this.minimumAchat = minimumAchat; }

    public LocalDateTime getDateDebut() { return dateDebut; }
    public void setDateDebut(LocalDateTime dateDebut) { this.dateDebut = dateDebut; }

    public LocalDateTime getDateFin() { return dateFin; }
    public void setDateFin(LocalDateTime dateFin) { this.dateFin = dateFin; }

    public boolean isActive() { return isActive; }
    public void setActive(boolean active) { isActive = active; }
}
