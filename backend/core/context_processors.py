"""Variables communes à tous les gabarits."""
from django.conf import settings


def cartes(request):
    """Clé des fonds de carte CARTO : toute page avec une carte Leaflet peut
    l'utiliser sans que sa vue ait à la transmettre."""
    return {'carto_api_key': settings.CARTO_API_KEY}
