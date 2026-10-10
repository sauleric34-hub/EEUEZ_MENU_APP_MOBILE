# ═══════════════════════════════════════════════════════════
#  Classement « découverte » des plats — page Plats et pages catégorie.
#  (La section « Pour vous » de l'accueil a son propre moteur :
#  core/recommendation.py, inchangé.)
#
#  Objectif produit :
#    · les plats de la ville de l'utilisateur d'abord ;
#    · un ordre aléatoire, mais qui favorise ce qui se commande et
#      s'aime le plus ;
#    · chaque utilisateur voit un ordre différent (et qui évolue) ;
#    · un plat tout juste créé a sa chance d'apparaître EN TÊTE chez une
#      partie des utilisateurs, sinon il serait noyé sous les plats établis.
#
#  Méthode : tirage pondéré sans remise (Efraimidis–Spirakis). Chaque plat
#  reçoit une clé u^(1/poids), u étant un aléa déterministe propre à
#  (utilisateur, créneau de 6 h, plat) ; on trie par clé décroissante.
#  Un plat deux fois plus « lourd » a deux fois plus de chances de passer
#  devant, sans jamais être assuré de la première place. Le poids a un
#  plancher : tous les plats peuvent sortir.
# ═══════════════════════════════════════════════════════════

import hashlib
import time
from datetime import timedelta

from django.db.models import Count, IntegerField, OuterRef, Subquery, Sum, Value
from django.db.models.functions import Coalesce
from django.utils import timezone

from .models import Favori, LigneCommande
from .models_bannieres import normaliser_ville
from .recommendation import _log_norm

# Poids du score de popularité (0..1)
W_COMMANDES = 0.6
W_LIKES = 0.4
PLANCHER = 0.15          # chance minimale de tout plat, même sans historique

# Nouveautés
NOUVEAUTE_JOURS = 7
PROBA_TETE = 0.4         # part des utilisateurs qui voient un plat neuf en tête
MAX_EN_TETE = 2          # nouveautés mises en avant en haut de liste
BONUS_NOUVEAUTE = 0.35   # les autres nouveautés gardent un petit coup de pouce

BUCKET_SECONDES = 6 * 3600  # l'ordre se renouvelle toutes les 6 h


def annoter_popularite(qs):
    """Ajoute _nb_commandes et _nb_likes via sous-requêtes (pas de N+1, et pas
    de double comptage comme avec deux jointures agrégées en même temps)."""
    commandes = (
        LigneCommande.objects.filter(plat=OuterRef('pk'))
        .values('plat').annotate(t=Sum('quantite')).values('t')
    )
    likes = (
        Favori.objects.filter(plat=OuterRef('pk'))
        .values('plat').annotate(n=Count('id')).values('n')
    )
    return qs.annotate(
        _nb_commandes=Coalesce(Subquery(commandes, output_field=IntegerField()), Value(0)),
        _nb_likes=Coalesce(Subquery(likes, output_field=IntegerField()), Value(0)),
    )


def _alea(graine, bucket, plat_id, sel=''):
    """Aléa déterministe dans ]0, 1[ : même entrée → même valeur."""
    digest = hashlib.md5(f'{graine}:{bucket}:{plat_id}:{sel}'.encode('utf-8')).digest()
    return (int.from_bytes(digest[:4], 'big') + 1) / (0xFFFFFFFF + 2)


def _graine(user, ville):
    if user is not None and getattr(user, 'is_authenticated', False):
        return str(getattr(user, 'feed_seed', '') or user.pk)
    return f'anonyme:{ville}'


def classer_plats(plats, user=None, ville=''):
    """Ordonne une liste de plats (annotés par annoter_popularite) pour cet
    utilisateur. Fonction pure de (graine, créneau de 6 h) : stable pendant
    la navigation, renouvelée ensuite."""
    plats = list(plats)
    if not plats:
        return plats

    bucket = int(time.time() // BUCKET_SECONDES)
    graine = _graine(user, ville)
    ville_n = normaliser_ville(ville)
    limite_nouveau = timezone.now() - timedelta(days=NOUVEAUTE_JOURS)

    max_cmd = max((getattr(p, '_nb_commandes', 0) for p in plats), default=0)
    max_likes = max((getattr(p, '_nb_likes', 0) for p in plats), default=0)

    def est_local(p):
        return bool(ville_n) and normaliser_ville(p.restaurant.ville) == ville_n

    def est_nouveau(p):
        return p.created_at and p.created_at >= limite_nouveau

    entrees = []
    for p in plats:
        popularite = (
            W_COMMANDES * _log_norm(getattr(p, '_nb_commandes', 0), max_cmd)
            + W_LIKES * _log_norm(getattr(p, '_nb_likes', 0), max_likes)
        )
        poids = PLANCHER + popularite + (BONUS_NOUVEAUTE if est_nouveau(p) else 0.0)
        cle = _alea(graine, bucket, p.pk) ** (1.0 / poids)
        entrees.append((p, cle))

    # Nouveautés « à la une » : tirées au sort par utilisateur, de préférence
    # dans sa ville (un plat neuf d'une autre ville n'a rien à faire en tête).
    candidates = [
        (p, cle) for p, cle in entrees
        if est_nouveau(p) and (est_local(p) or not ville_n)
        and _alea(graine, bucket, p.pk, 'tete') < PROBA_TETE
    ]
    candidates.sort(key=lambda t: (-t[1], -t[0].pk))
    en_tete = [p for p, _ in candidates[:MAX_EN_TETE]]
    ids_tete = {p.pk for p in en_tete}

    # Le reste : ville de l'utilisateur d'abord, puis les autres villes
    reste = [(p, cle) for p, cle in entrees if p.pk not in ids_tete]
    reste.sort(key=lambda t: (0 if est_local(t[0]) else 1, -t[1], -t[0].pk))
    return en_tete + [p for p, _ in reste]
