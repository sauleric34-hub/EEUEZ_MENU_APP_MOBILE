package com.eeuez.menu.model;

import jakarta.persistence.*;
import java.time.LocalDate;

@Entity
@Table(name = "document_livreurs")
public class DocumentLivreur {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "livreur_id", nullable = false)
    private Livreur livreur;

    private String typeDocument;
    private String url;
    private LocalDate dateExpiration;
    private String statutValidation = "EN_ATTENTE"; // EN_ATTENTE, VALIDE, REJETE

    public DocumentLivreur() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Livreur getLivreur() { return livreur; }
    public void setLivreur(Livreur livreur) { this.livreur = livreur; }

    public String getTypeDocument() { return typeDocument; }
    public void setTypeDocument(String typeDocument) { this.typeDocument = typeDocument; }

    public String getUrl() { return url; }
    public void setUrl(String url) { this.url = url; }

    public LocalDate getDateExpiration() { return dateExpiration; }
    public void setDateExpiration(LocalDate dateExpiration) { this.dateExpiration = dateExpiration; }

    public String getStatutValidation() { return statutValidation; }
    public void setStatutValidation(String statutValidation) { this.statutValidation = statutValidation; }
}
