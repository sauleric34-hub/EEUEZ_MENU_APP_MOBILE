package com.eeuez.menu.dto;

public class TrackingDTO {
    private Long commandeId;
    private Long livreurId;
    private Double latitude;
    private Double longitude;
    private String statut;
    private Integer tempsRestantEstime; // minutes

    public TrackingDTO() {}

    public TrackingDTO(Long commandeId, Long livreurId, Double latitude, Double longitude, String statut, Integer tempsRestantEstime) {
        this.commandeId = commandeId;
        this.livreurId = livreurId;
        this.latitude = latitude;
        this.longitude = longitude;
        this.statut = statut;
        this.tempsRestantEstime = tempsRestantEstime;
    }

    public Long getCommandeId() { return commandeId; }
    public void setCommandeId(Long commandeId) { this.commandeId = commandeId; }

    public Long getLivreurId() { return livreurId; }
    public void setLivreurId(Long livreurId) { this.livreurId = livreurId; }

    public Double getLatitude() { return latitude; }
    public void setLatitude(Double latitude) { this.latitude = latitude; }

    public Double getLongitude() { return longitude; }
    public void setLongitude(Double longitude) { this.longitude = longitude; }

    public String getStatut() { return statut; }
    public void setStatut(String statut) { this.statut = statut; }

    public Integer getTempsRestantEstime() { return tempsRestantEstime; }
    public void setTempsRestantEstime(Integer tempsRestantEstime) { this.tempsRestantEstime = tempsRestantEstime; }
}
