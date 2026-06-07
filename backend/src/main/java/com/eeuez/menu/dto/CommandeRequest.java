package com.eeuez.menu.dto;

import java.util.List;

public class CommandeRequest {
    private Long restaurantId;
    private String type; // LIVRAISON | SUR_PLACE | A_EMPORTER
    private Long adresseLivraisonId;
    private Long tableId;
    private String modePaiementType;
    private String modePaiementNumero;
    private String instructions;
    private List<CommandeItemRequest> items;

    public Long getRestaurantId() { return restaurantId; }
    public void setRestaurantId(Long restaurantId) { this.restaurantId = restaurantId; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public Long getAdresseLivraisonId() { return adresseLivraisonId; }
    public void setAdresseLivraisonId(Long adresseLivraisonId) { this.adresseLivraisonId = adresseLivraisonId; }

    public Long getTableId() { return tableId; }
    public void setTableId(Long tableId) { this.tableId = tableId; }

    public String getModePaiementType() { return modePaiementType; }
    public void setModePaiementType(String modePaiementType) { this.modePaiementType = modePaiementType; }

    public String getModePaiementNumero() { return modePaiementNumero; }
    public void setModePaiementNumero(String modePaiementNumero) { this.modePaiementNumero = modePaiementNumero; }

    public String getInstructions() { return instructions; }
    public void setInstructions(String instructions) { this.instructions = instructions; }

    public List<CommandeItemRequest> getItems() { return items; }
    public void setItems(List<CommandeItemRequest> items) { this.items = items; }

    public static class CommandeItemRequest {
        private Long platId;
        private Integer quantite;
        private String optionsChoisies; // JSON string
        private String instructions;

        public Long getPlatId() { return platId; }
        public void setPlatId(Long platId) { this.platId = platId; }

        public Integer getQuantite() { return quantite; }
        public void setQuantite(Integer quantite) { this.quantite = quantite; }

        public String getOptionsChoisies() { return optionsChoisies; }
        public void setOptionsChoisies(String optionsChoisies) { this.optionsChoisies = optionsChoisies; }

        public String getInstructions() { return instructions; }
        public void setInstructions(String instructions) { this.instructions = instructions; }
    }
}
