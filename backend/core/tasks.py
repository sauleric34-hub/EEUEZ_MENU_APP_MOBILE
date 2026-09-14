# ═══════════════════════════════════════════════════════════
#  Tâches asynchrones (django-rq / Redis).
#
#  Aujourd'hui : un seul usage — notifier un partenaire (webhook) sans
#  bloquer la requête qui vient de changer le statut d'une commande (ex. un
#  livreur qui confirme une livraison ne doit pas attendre la réponse HTTP
#  d'un serveur partenaire tiers, potentiellement lent ou indisponible).
#
#  Comme le cache et le channel layer (settings.py), REDIS_URL absente →
#  pas de file : on exécute alors en synchrone, pour que le dev local
#  fonctionne sans dépendance Redis. Un worker (`manage.py rqworker`) doit
#  tourner en prod pour que la file soit réellement traitée.
# ═══════════════════════════════════════════════════════════

from django.conf import settings


def notifier_partenaire_async(commande_id):
    if settings.REDIS_URL:
        import django_rq
        django_rq.enqueue(_notifier_partenaire, commande_id)
    else:
        _notifier_partenaire(commande_id)


def _notifier_partenaire(commande_id):
    """Exécuté par le worker RQ (ou en synchrone, sans Redis) : recharge la
    commande par id plutôt que de faire transiter l'instance elle-même dans
    la file — plus léger à sérialiser, et jamais périmé si le statut a déjà
    changé à nouveau entre l'enqueue et l'exécution."""
    from .models import Commande
    from .partner_webhooks import envoyer_webhook_commande

    commande = Commande.objects.filter(pk=commande_id).select_related('partenaire', 'partenaire__webhook').first()
    if commande:
        envoyer_webhook_commande(commande)
