"""Variables communes à tous les gabarits."""
from django.conf import settings


def cartes(request):
    """Clé des fonds de carte CARTO : toute page avec une carte Leaflet peut
    l'utiliser sans que sa vue ait à la transmettre."""
    return {'carto_api_key': settings.CARTO_API_KEY}


def alertes_admin(request):
    """Nombre d'alertes non lues (badge de la barre latérale admin)."""
    user = getattr(request, 'user', None)
    if not user or not user.is_authenticated or getattr(user, 'role', '') != 'admin':
        return {}
    from core.models import AlerteAdmin
    return {'alertes_non_lues_total': AlerteAdmin.objects.filter(lue=False).count()}
