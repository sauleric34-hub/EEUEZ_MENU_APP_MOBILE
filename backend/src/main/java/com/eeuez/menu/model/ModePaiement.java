package com.eeuez.menu.model;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

@Embeddable
public class ModePaiement {

    @Column(name = "paiement_type")
    private String type;

    @Column(name = "paiement_libelle")
    private String libelle;

    @Column(name = "paiement_numero")
    private String numero;

    public ModePaiement() {}

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getLibelle() { return libelle; }
    public void setLibelle(String libelle) { this.libelle = libelle; }

    public String getNumero() { return numero; }
    public void setNumero(String numero) { this.numero = numero; }
}
