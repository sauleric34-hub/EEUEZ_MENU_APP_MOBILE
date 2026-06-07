package com.eeuez.menu.dto;

import com.eeuez.menu.model.User;

public class AuthResponse {
    private String token;
    private String role;
    private Long userId;
    private String email;
    private String nom;
    private String prenom;
    private String avatar;
    private String statut;

    public AuthResponse(String token, User user) {
        this.token = token;
        this.role = user.getRole();
        this.userId = user.getId();
        this.email = user.getEmail();
        this.nom = user.getNom();
        this.prenom = user.getPrenom();
        this.avatar = user.getAvatar();
        this.statut = user.getStatut();
    }

    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getNom() { return nom; }
    public void setNom(String nom) { this.nom = nom; }

    public String getPrenom() { return prenom; }
    public void setPrenom(String prenom) { this.prenom = prenom; }

    public String getAvatar() { return avatar; }
    public void setAvatar(String avatar) { this.avatar = avatar; }

    public String getStatut() { return statut; }
    public void setStatut(String statut) { this.statut = statut; }
}
