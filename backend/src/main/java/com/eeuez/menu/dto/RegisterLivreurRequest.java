package com.eeuez.menu.dto;

public class RegisterLivreurRequest {
    private String nom;
    private String prenom;
    private String email;
    private String telephone;
    private String password;
    private String vehiculeType;
    private String vehiculeMarque;
    private String vehiculePlaque;

    public String getNom() { return nom; }
    public void setNom(String nom) { this.nom = nom; }

    public String getPrenom() { return prenom; }
    public void setPrenom(String prenom) { this.prenom = prenom; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getTelephone() { return telephone; }
    public void setTelephone(String telephone) { this.telephone = telephone; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    public String getVehiculeType() { return vehiculeType; }
    public void setVehiculeType(String vehiculeType) { this.vehiculeType = vehiculeType; }

    public String getVehiculeMarque() { return vehiculeMarque; }
    public void setVehiculeMarque(String vehiculeMarque) { this.vehiculeMarque = vehiculeMarque; }

    public String getVehiculePlaque() { return vehiculePlaque; }
    public void setVehiculePlaque(String vehiculePlaque) { this.vehiculePlaque = vehiculePlaque; }
}
