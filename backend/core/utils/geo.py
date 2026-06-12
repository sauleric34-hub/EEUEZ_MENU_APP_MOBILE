import math

EARTH_RADIUS_KM = 6371.0

def calculer_distance(lat1, lon1, lat2, lon2):
    """
    Calcule la distance en km entre deux points GPS (formule Haversine).
    """
    if lat1 is None or lon1 is None or lat2 is None or lon2 is None:
        return 0.0

    dLat = math.radians(float(lat2) - float(lat1))
    dLon = math.radians(float(lon2) - float(lon1))

    a = (math.sin(dLat / 2) * math.sin(dLat / 2) +
         math.cos(math.radians(float(lat1))) * math.cos(math.radians(float(lat2))) *
         math.sin(dLon / 2) * math.sin(dLon / 2))

    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    distance = EARTH_RADIUS_KM * c

    return round(distance, 2)

def estimer_temps_livraison(distance_km, temps_preparation_minutes=20):
    """
    Estime le temps de livraison en minutes.
    Formule : (distance / vitesse_moto) * 60 + temps_préparation_moyen
    """
    vitesse_moyenne_moto = 30.0  # km/h
    temps_trajet = math.ceil((distance_km / vitesse_moyenne_moto) * 60)
    return temps_preparation_minutes + temps_trajet + 5  # +5 min de marge

def est_dans_le_rayon(latA, lonA, latB, lonB, rayon_km):
    return calculer_distance(latA, lonA, latB, lonB) <= rayon_km
