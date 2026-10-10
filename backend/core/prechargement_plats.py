"""Préchargement groupé des données d'une liste de plats (anti « N+1 »).

Sans lui, PlatSerializer interroge la base PLAT PAR PLAT pour la note, le
nombre de notes, la note du client, les photos, les compléments (+ leurs
options), les éléments inclus, le favori, les commandes et les likes :
~7 requêtes × N plats (303 requêtes pour 43 plats).

Ici, chaque information est chargée en UNE requête pour toute la liste,
puis rangée sur chaque plat dans un attribut « _… » que le serializer lit
en priorité. Coût constant (~10 requêtes) quel que soit le nombre de plats.

Fonctionne sur une LISTE déjà chargée (pas seulement un QuerySet) : c'est
indispensable pour les listes ordonnées en Python (classement découverte,
recommandations).
"""
from django.db.models import Avg, Count, Prefetch, Sum, prefetch_related_objects

from .models import Favori, LigneCommande, PlatNote
from .models_complements import GroupeComplement


def precharger_plats(plats, user=None):
    plats = list(plats)
    if not plats:
        return plats
    ids = [p.pk for p in plats]
    connecte = user is not None and getattr(user, 'is_authenticated', False)

    # Relations : 1 requête par relation pour TOUTE la liste. Les clés
    # étrangères déjà chargées (select_related) ne sont pas re-demandées.
    prefetch_related_objects(
        plats,
        'restaurant', 'categorie', 'photos', 'elements_inclus',
        Prefetch('groupes_complements', queryset=GroupeComplement.objects.prefetch_related('options')),
    )

    # Notes : moyenne + nombre, groupées par plat (1 requête)
    stats_notes = {
        r['plat']: r for r in
        PlatNote.objects.filter(plat__in=ids).values('plat').annotate(moy=Avg('note'), n=Count('id'))
    }
    # Données propres au client connecté (1 requête chacune)
    mes_notes = dict(PlatNote.objects.filter(plat__in=ids, client=user).values_list('plat', 'note')) if connecte else {}
    mes_favoris = set(Favori.objects.filter(plat__in=ids, client=user).values_list('plat', flat=True)) if connecte else set()

    # Compteurs de popularité, sauf s'ils sont déjà annotés (classement_plats)
    besoin_compteurs = not hasattr(plats[0], '_nb_commandes')
    if besoin_compteurs:
        commandes = dict(
            LigneCommande.objects.filter(plat__in=ids).values('plat').annotate(t=Sum('quantite')).values_list('plat', 't')
        )
        likes = dict(
            Favori.objects.filter(plat__in=ids).values('plat').annotate(n=Count('id')).values_list('plat', 'n')
        )

    for p in plats:
        stats = stats_notes.get(p.pk)
        p._note_moy = round(stats['moy'], 1) if stats and stats['moy'] is not None else 0
        p._nb_notes = stats['n'] if stats else 0
        p._ma_note = mes_notes.get(p.pk) if connecte else None
        p._est_favori = p.pk in mes_favoris
        if besoin_compteurs:
            p._nb_commandes = commandes.get(p.pk) or 0
            p._nb_likes = likes.get(p.pk) or 0
    return plats
