package com.eeuez.menu.service;

import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Service de géolocalisation EEUEZ Menu.
 * Calcule les distances avec la formule Haversine.
 * Utilisé pour trouver les restaurants à proximité et estimer le temps de livraison.
 */
@Service
public class GeoService {

    private static final double EARTH_RADIUS_KM = 6371.0;

    /**
     * Calcule la distance en km entre deux points GPS (formule Haversine).
     *
     * @param lat1 Latitude du point A
     * @param lon1 Longitude du point A
     * @param lat2 Latitude du point B
     * @param lon2 Longitude du point B
     * @return Distance en kilomètres (arrondie à 2 décimales)
     */
    public double calculerDistance(double lat1, double lon1, double lat2, double lon2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);

        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);

        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        double distance = EARTH_RADIUS_KM * c;

        return Math.round(distance * 100.0) / 100.0;
    }

    /**
     * Estime le temps de livraison en minutes.
     * Formule : (distance / vitesse_moto) * 60 + temps_préparation_moyen
     *
     * @param distanceKm Distance en km
     * @param tempsPreparationMinutes Temps de préparation du restaurant
     * @return Temps estimé total en minutes
     */
    public int estimerTempsLivraison(double distanceKm, int tempsPreparationMinutes) {
        double vitesseMoyenneMoto = 30.0; // km/h en ville (Yaoundé/Douala)
        int tempsTrajet = (int) Math.ceil((distanceKm / vitesseMoyenneMoto) * 60);
        return tempsPreparationMinutes + tempsTrajet + 5; // +5 min de marge
    }

    /**
     * Vérifie si un point GPS est dans un rayon donné.
     */
    public boolean estDansLeRayon(double latA, double lonA, double latB, double lonB, double rayonKm) {
        return calculerDistance(latA, lonA, latB, lonB) <= rayonKm;
    }
}
