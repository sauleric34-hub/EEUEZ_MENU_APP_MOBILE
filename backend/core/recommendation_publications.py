# ═══════════════════════════════════════════════════════════
#  Classement du fil de publications
#
#  Objectif produit : un fil « tendance mais personnel ». Les publications
#  qui marchent remontent, les récentes ne sont jamais noyées, et chaque
#  utilisateur voit un ordre différent — sans jamais casser la pagination.
#
#  Score = Σ (poids × composante normalisée 0..1)
#    · engagement  35 %  — likes×1 + commentaires×2 (échelle log)
#    · fraîcheur   30 %  — décroissance par demi-vie (3 jours)
#    · affinité    25 %  — restaurants suivis + catégories déjà commandées
#    · aléa        10 %  — mélange déterministe propre à l'utilisateur
#
#  L'échelle log de l'engagement est essentielle : sans elle, une publication
#  virale resterait scotchée en tête indéfiniment.
# ═══════════════════════════════════════════════════════════

import base64
import hashlib
import json
import time
from datetime import timedelta

from django.db.models import Count, Q
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from .models import Publication, Abonnement, LigneCommande
# Helpers de scoring partagés avec le moteur de recommandation des plats.
from .recommendation import _log_norm

# Poids des composantes
W_ENGAGEMENT = 0.35
W_FRAICHEUR = 0.30
W_AFFINITE = 0.25
W_ALEA = 0.10

# Une publication perd la moitié de son bonus fraîcheur au bout de 3 jours.
# (14 jours convient aux plats, c'est bien trop lent pour du contenu social.)
PUB_RECENCY_HALF_DAYS = 3.0

# Fenêtre de candidats : on ne score jamais toute la table.
FENETRE_JOURS = 60
MAX_CANDIDATS = 400
MIN_CANDIDATS = 60           # en dessous, on élargit la fenêtre
BUCKET_SECONDES = 6 * 3600   # le mélange évolue toutes les 6 h

# Poids internes de l'affinité
AFF_RESTAURANT = 0.6
AFF_CATEGORIE = 0.4


def _fraicheur(created_at):
    """1.0 à l'instant de la publication → décroît par demi-vie."""
    import math
    age_days = max(0.0, (timezone.now() - created_at).total_seconds() / 86400.0)
    return math.exp(-math.log(2) * age_days / PUB_RECENCY_HALF_DAYS)


def _jitter(seed, bucket, pub_id):
    """Aléa déterministe 0..1 : même (graine, bucket, publication) => même valeur.
    C'est ce qui rend le fil personnel SANS casser la pagination."""
    brut = f'{seed}:{bucket}:{pub_id}'.encode('utf-8')
    digest = hashlib.md5(brut).digest()
    return int.from_bytes(digest[:4], 'big') / 0xFFFFFFFF


def bucket_courant():
    return int(time.time() // BUCKET_SECONDES)


# ─── Curseur de pagination ───────────────────────────────────
# Le curseur fige le bucket ET la borne haute de date. Sans lui, le bucket
# pourrait basculer en plein défilement et de nouvelles publications
# s'insérer entre deux pages → doublons et trous.

def encoder_curseur(bucket, avant):
    payload = json.dumps({'b': bucket, 'a': avant.isoformat()})
    return base64.urlsafe_b64encode(payload.encode('utf-8')).decode('ascii')


def decoder_curseur(curseur):
    """Retourne (bucket, avant) ou (None, None) si le curseur est absent/illisible."""
    if not curseur:
        return None, None
    try:
        payload = json.loads(base64.urlsafe_b64decode(curseur.encode('ascii')).decode('utf-8'))
        avant = parse_datetime(payload['a'])
        if avant is None:
            return None, None
        return int(payload['b']), avant
    except Exception:
        return None, None


# ─── Affinité utilisateur ────────────────────────────────────

def _profil_affinite(user):
    """Pré-charge en 2 requêtes ce qu'on sait des goûts de l'utilisateur :
    restaurants suivis + poids par catégorie (déduits de ses commandes)."""
    if not user or user.is_anonymous:
        return set(), {}

    suivis = set(
        Abonnement.objects.filter(client=user).values_list('restaurant_id', flat=True)
    )

    # Aucune table de préférences n'existe : on déduit les goûts de l'historique.
    lignes = (
        LigneCommande.objects
        .filter(commande__client=user, plat__categorie__isnull=False)
        .values('plat__categorie')
        .annotate(n=Count('id'))
    )
    compteurs = {row['plat__categorie']: row['n'] for row in lignes}
    maxi = max(compteurs.values(), default=0)
    categories = {cid: n / maxi for cid, n in compteurs.items()} if maxi else {}
    return suivis, categories


def _affinite(pub, suivis, categories):
    suit = 1.0 if pub.restaurant_id in suivis else 0.0
    cat = 0.0
    if pub.plat_id and pub.plat and pub.plat.categorie_id:
        cat = categories.get(pub.plat.categorie_id, 0.0)
    return AFF_RESTAURANT * suit + AFF_CATEGORIE * cat


# ─── Sélection des candidats ─────────────────────────────────

def _candidats(avant):
    """Pré-filtre indispensable : le moteur score en mémoire, on ne lui donne
    jamais toute la table. Les compteurs sont annotés (pas de N+1)."""
    base = (
        Publication.objects.visibles()
        .filter(created_at__lte=avant)
        .select_related('restaurant', 'auteur', 'plat', 'plat__categorie')
        .prefetch_related('medias')
        .annotate(
            n_likes=Count('likes', distinct=True),
            n_commentaires=Count(
                'commentaires', filter=Q(commentaires__supprime_par=''), distinct=True,
            ),
        )
    )
    recents = list(
        base.filter(created_at__gte=timezone.now() - timedelta(days=FENETRE_JOURS))
        .order_by('-created_at')[:MAX_CANDIDATS]
    )
    # Corpus trop mince (app jeune) → on retire le plancher de date.
    if len(recents) < MIN_CANDIDATS:
        return list(base.order_by('-created_at')[:MAX_CANDIDATS])
    return recents


# ─── Point d'entrée ──────────────────────────────────────────

def classer_publications(user=None, curseur=None, page=1, taille=10):
    """Retourne (publications_de_la_page, curseur, a_suivant).

    L'ordre est une fonction pure de (graine utilisateur, bucket, borne de date),
    donc rejouable à l'identique d'une page à l'autre.
    """
    bucket, avant = decoder_curseur(curseur)
    if bucket is None:
        bucket, avant = bucket_courant(), timezone.now()

    candidats = _candidats(avant)
    if not candidats:
        return [], encoder_curseur(bucket, avant), False

    # Graine de mélange : propre à l'utilisateur, stable dans le temps.
    if user and not user.is_anonymous:
        graine = str(getattr(user, 'feed_seed', '') or user.pk)
    else:
        graine = 'anonyme'

    suivis, categories = _profil_affinite(user)

    max_engagement = max(
        (p.n_likes + 2 * p.n_commentaires for p in candidats), default=0,
    )

    scores = []
    for pub in candidats:
        engagement = _log_norm(pub.n_likes + 2 * pub.n_commentaires, max_engagement)
        fraicheur = _fraicheur(pub.created_at)
        affinite = _affinite(pub, suivis, categories)
        alea = _jitter(graine, bucket, pub.pk)
        score = (
            W_ENGAGEMENT * engagement
            + W_FRAICHEUR * fraicheur
            + W_AFFINITE * affinite
            + W_ALEA * alea
        )
        scores.append((pub, score))

    # Tri déterministe : le pk départage les ex æquo pour garantir la stabilité.
    scores.sort(key=lambda t: (-t[1], -t[0].pk))

    page = max(1, int(page or 1))
    taille = max(1, min(50, int(taille or 10)))
    debut = (page - 1) * taille
    tranche = scores[debut:debut + taille]
    a_suivant = len(scores) > debut + taille

    return [p for p, _ in tranche], encoder_curseur(bucket, avant), a_suivant
