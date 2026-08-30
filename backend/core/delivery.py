# ═══════════════════════════════════════════════════════════
#  Livraison libre — couche métier unique
#
#  Toutes les transitions d'une livraison passent par ici, que
#  l'appel vienne du workspace web (views/livreur_ws.py) ou de
#  l'API mobile (api_views.LivreurMissionViewSet). Un seul
#  chemin ⇒ une seule machine à états, une seule règle d'argent.
#
#  L'argent ne bouge QU'À la finalisation, et la finalisation
#  exige une confirmation tracée :
#    · client  → code / QR (finaliser_livraison par='client')
#    · admin   → validation d'une course « livrée sans code »
#  Une course « livrée sans code » ne crédite personne : ni le
#  livreur, ni le solde disponible du restaurant.
# ═══════════════════════════════════════════════════════════

from django.db import transaction
from django.utils import timezone


# Statuts d'une commande éligible au pool libre (prête, ou en passe de l'être).
STATUTS_LIBERABLES = ('acceptee', 'en_preparation', 'prete')
# Statuts d'une livraison encore « en cours » côté livreur.
STATUTS_ACTIFS = ('assignee', 'en_collecte', 'en_livraison', 'livree_sans_code')


class PriseImpossible(Exception):
    """La commande libre n'a pas pu être prise (déjà prise, non libérée…)."""


class TransitionInvalide(Exception):
    """Action impossible pour le statut courant de la livraison."""


def calculer_frais_livraison(restaurant, lat_livraison, lon_livraison, repli=None):
    """Frais de livraison d'une commande selon la distance restaurant → client.

    On mesure la distance à vol d'oiseau puis on la multiplie par le coefficient
    routier (ParametrageLivraison) pour approcher le trajet réel, avant de
    choisir la tranche du barème du restaurant.

    Renvoie ``(frais, hors_zone, distance_km)`` :
      · ``hors_zone`` vrai  → l'adresse dépasse le dernier palier, refuser la commande
      · ``distance_km`` None → distance non mesurable (repli sur le frais fixe)
    """
    from .utils import geo
    from .models_livraison import ParametrageLivraison

    distance_km = None
    if (
        lat_livraison is not None and lon_livraison is not None
        and restaurant.latitude is not None and restaurant.longitude is not None
    ):
        coef = float(ParametrageLivraison.get_solo().coefficient_distance_routiere or 1)
        vol_oiseau = geo.calculer_distance(
            restaurant.latitude, restaurant.longitude, lat_livraison, lon_livraison,
        )
        distance_km = round(vol_oiseau * coef, 2)

    frais, hors_zone = restaurant.frais_livraison_pour_distance(distance_km, repli=repli)
    return frais, hors_zone, distance_km


def parser_bareme_livraison(kms, prix):
    """Valide deux listes parallèles de tranches (distances / prix).

    Renvoie ``(lignes_triees, erreur)`` : ``lignes_triees`` est une liste de
    couples ``(jusqu_a_km, prix)`` triée par distance, ``erreur`` un message
    prêt à afficher ou ``None``. Les lignes entièrement vides sont ignorées.
    """
    lignes = []
    for i, km_brut in enumerate(kms):
        km_brut = (km_brut or '').strip().replace(',', '.')
        prix_brut = (prix[i] if i < len(prix) else '').strip()
        if not km_brut and not prix_brut:
            continue
        try:
            km = round(float(km_brut), 1)
            montant = int(round(float(prix_brut or '0')))
        except ValueError:
            return None, 'Barème : distances et prix doivent être des nombres.'
        if km <= 0 or montant < 0:
            return None, 'Barème : la distance doit être positive et le prix ≥ 0.'
        lignes.append((km, montant))

    lignes.sort(key=lambda x: x[0])
    if len({km for km, _ in lignes}) != len(lignes):
        return None, 'Barème : deux tranches ont la même distance.'
    return lignes, None


def remplacer_bareme_livraison(restaurant, lignes):
    """Remplace toutes les tranches du barème d'un restaurant.

    On efface puis recrée (comme les compléments de plats) : les commandes
    passées ont leurs frais figés, elles ne sont pas affectées.
    """
    from .models_livraison import PalierLivraison

    restaurant.paliers_livraison.all().delete()
    PalierLivraison.objects.bulk_create([
        PalierLivraison(restaurant=restaurant, jusqu_a_km=km, prix=montant)
        for km, montant in lignes
    ])


def est_livreur_independant(utilisateur):
    """Un livreur indépendant a le rôle « livreur », est actif et n'est attaché
    à AUCUN restaurant. Ce sont eux qui prennent les commandes en livraison
    libre."""
    return bool(
        utilisateur
        and getattr(utilisateur, 'is_active', False)
        and getattr(utilisateur, 'role', None) == 'livreur'
        and getattr(utilisateur, 'restaurant_attache_id', None) is None
    )


# ─── PRISE D'UNE MISSION LIBRE ───────────────────────────────
def prendre_commande_libre(commande_id, livreur):
    """Attribue une commande en livraison libre à un livreur indépendant.

    Sûr face à la concurrence : on verrouille la ligne (select_for_update) puis
    on revérifie qu'aucune Livraison n'existe déjà. Deux livreurs qui tapent
    « Prendre » en même temps ne peuvent pas obtenir la même commande.

    Lève PriseImpossible si la commande n'est pas (ou plus) disponible.
    Renvoie la Livraison créée.
    """
    from .models import Commande, Livraison

    if not est_livreur_independant(livreur):
        raise PriseImpossible("Réservé aux livreurs indépendants actifs.")

    with transaction.atomic():
        commande = (
            Commande.objects.select_for_update()
            .filter(
                pk=commande_id,
                livraison_libre=True,
                paiement_confirme=True,
                statut__in=STATUTS_LIBERABLES,
            )
            .first()
        )
        if commande is None:
            raise PriseImpossible("Cette commande n'est pas disponible en livraison libre.")
        if Livraison.objects.filter(commande=commande).exists():
            raise PriseImpossible("Cette commande vient d'être prise par un autre livreur.")

        livraison = Livraison.objects.create(
            commande=commande, livreur=livreur, statut='assignee',
        )
        # On fait AVANCER le statut si la commande n'est pas encore en cuisine ;
        # on ne rétrograde jamais une commande déjà « prête ».
        if commande.statut == 'acceptee':
            commande.statut = 'en_preparation'
            commande.save(update_fields=['statut', 'updated_at'])
        return livraison


# ─── TRANSITIONS DE COURSE ───────────────────────────────────
def demarrer_course(livraison):
    """Le livreur part chercher la commande au restaurant."""
    if livraison.statut != 'assignee':
        raise TransitionInvalide("La course n'est pas en attente de démarrage.")
    livraison.statut = 'en_collecte'
    livraison.save(update_fields=['statut'])
    return livraison


def recuperer_commande(livraison):
    """Commande récupérée au restaurant → en route vers le client.

    Génère le code de confirmation que le client scannera/saisira, et pose une
    estimation d'arrivée."""
    if livraison.statut != 'en_collecte':
        raise TransitionInvalide("La course n'est pas en phase de collecte.")

    from .models import Livraison

    livraison.statut = 'en_livraison'
    if not livraison.code_confirmation:
        livraison.code_confirmation = Livraison.generer_code()
    livraison.estimated_delivery_time = _estimer_arrivee(livraison)
    livraison.save(update_fields=['statut', 'code_confirmation', 'estimated_delivery_time'])

    commande = livraison.commande
    if commande and commande.statut != 'en_livraison':
        commande.statut = 'en_livraison'
        commande.save(update_fields=['statut', 'updated_at'])
    return livraison


def _estimer_arrivee(livraison):
    """Heure d'arrivée estimée depuis la position courante (ou le restaurant)
    jusqu'à l'adresse de livraison."""
    from .utils import geo

    commande = livraison.commande
    if not commande or commande.latitude_livraison is None:
        return None
    r = commande.restaurant
    lat = livraison.latitude_actuelle if livraison.latitude_actuelle is not None else (r.latitude if r else None)
    lon = livraison.longitude_actuelle if livraison.longitude_actuelle is not None else (r.longitude if r else None)
    if lat is None or lon is None:
        return None
    dist = geo.calculer_distance(lat, lon, commande.latitude_livraison, commande.longitude_livraison)
    minutes = geo.estimer_temps_livraison(dist, temps_preparation_minutes=0)
    return timezone.now() + timezone.timedelta(minutes=minutes)


# ─── FINALISATION (l'argent bouge ICI, et seulement ici) ─────
def finaliser_livraison(livraison, *, par='client'):
    """Marque la livraison et la commande comme livrées, crédite le livreur,
    enregistre la transaction et déclenche un éventuel versement.

    Idempotent : ne refait rien si la livraison est déjà terminée.
    `par` : 'client' (code/QR) ou 'admin' (validation d'une course sans code).
    """
    from .models import Livraison, Transaction, User

    with transaction.atomic():
        livraison = Livraison.objects.select_for_update().select_related(
            'commande', 'commande__restaurant', 'livreur',
        ).get(pk=livraison.pk)

        if livraison.statut == 'livree':
            return livraison
        if livraison.statut not in ('en_livraison', 'livree_sans_code'):
            raise TransitionInvalide("La course n'est pas arrivée à destination.")

        commande = livraison.commande
        livraison.statut = 'livree'
        livraison.confirmee_par = par
        livraison.delivered_at = timezone.now()
        livraison.save(update_fields=['statut', 'confirmee_par', 'delivered_at'])

        if commande and commande.statut != 'livree':
            commande.statut = 'livree'
            commande.save(update_fields=['statut', 'updated_at'])

        livreur_id = livraison.livreur_id
        if livreur_id and commande:
            gain = _part_livreur(commande)
            # Grand livre : une seule Transaction de gain par commande.
            _, cree = Transaction.objects.get_or_create(
                commande=commande, type='gain_livreur',
                defaults={'montant': gain, 'statut': 'complete', 'mode_paiement': 'especes'},
            )
            if cree and gain:
                livreur = User.objects.select_for_update().get(pk=livreur_id)
                livreur.gain_total = float(livreur.gain_total or 0) + float(gain)
                livreur.nombre_livraisons = (livreur.nombre_livraisons or 0) + 1
                livreur.save(update_fields=['gain_total', 'nombre_livraisons'])

    # Hors transaction : le versement éventuel (appel réseau au fournisseur).
    # On relit le livreur pour avoir son solde à jour après le crédit ci-dessus.
    if livraison.livreur_id:
        from .payout_livreur import verser_si_seuil_atteint
        verser_si_seuil_atteint(User.objects.get(pk=livraison.livreur_id))

    _notifier_livraison_terminee(livraison)
    return livraison


def _part_livreur(commande):
    """Montant dû au livreur pour cette commande. On utilise la valeur FIGÉE
    sur la commande ; repli sur le calcul en cas de commande ancienne."""
    from .models_livraison import ParametrageLivraison

    if commande.part_livreur:
        return float(commande.part_livreur)
    frais = float(commande.frais_livraison or 0)
    if not frais and commande.restaurant:
        frais = float(commande.restaurant.frais_livraison or 0)
    return ParametrageLivraison.get_solo().part_livreur(frais)


# ─── LIVRÉE SANS CODE (client injoignable) ───────────────────
def marquer_livree_sans_code(livraison, motif):
    """Le livreur clôt une course sans confirmation client. La commande est
    considérée livrée mais NE crédite personne : ni le livreur, ni le solde
    disponible du restaurant. Un admin doit valider (ou rejeter)."""
    if livraison.statut != 'en_livraison':
        raise TransitionInvalide("La course n'est pas en cours de livraison.")

    from .models import AuditLog

    livraison.statut = 'livree_sans_code'
    livraison.motif_sans_code = (motif or '').strip()[:250]
    livraison.delivered_at = timezone.now()
    livraison.save(update_fields=['statut', 'motif_sans_code', 'delivered_at'])

    AuditLog.objects.create(
        user=livraison.livreur, action='LIVRAISON_SANS_CODE',
        model_name='Livraison', object_id=str(livraison.pk),
        description={'commande': livraison.commande_id, 'motif': livraison.motif_sans_code},
    )
    return livraison


def valider_sans_code(livraison):
    """Un admin valide une course « livrée sans code » → crédit + versement."""
    if livraison.statut != 'livree_sans_code':
        raise TransitionInvalide("Cette course n'est pas en attente de validation.")
    return finaliser_livraison(livraison, par='admin')


# ─── ABANDON / RETOUR AU POOL ────────────────────────────────
def abandonner_livraison(livraison, motif='', *, auto=False):
    """Le livreur (ou un timeout) rend la mission : la commande retourne au pool
    des livreurs indépendants. On garde une trace pour compter les abandons et,
    au-delà du quota, désactiver automatiquement le livreur."""
    from .models import AbandonLivraison, AuditLog
    from .models_livraison import ParametrageLivraison

    commande = livraison.commande
    livreur = livraison.livreur

    with transaction.atomic():
        if commande:
            commande.livraison_libre = True
            # On repose la commande à « prête » : elle repart au pool.
            if commande.statut in ('en_preparation', 'en_livraison'):
                commande.statut = 'prete'
            commande.save(update_fields=['statut', 'livraison_libre', 'updated_at'])

        AbandonLivraison.objects.create(
            livreur=livreur, commande=commande,
            motif=(motif or '').strip()[:250], auto=auto,
        )
        livraison.delete()

    AuditLog.objects.create(
        user=livreur, action='LIVRAISON_ABANDON' + ('_AUTO' if auto else ''),
        model_name='Commande', object_id=str(commande.pk if commande else ''),
        description={'motif': motif, 'auto': auto},
    )

    # Auto-blocage : trop d'abandons sur la fenêtre glissante.
    if livreur and livreur.is_active:
        param = ParametrageLivraison.get_solo()
        depuis = timezone.now() - timezone.timedelta(days=param.fenetre_abandons_jours)
        recents = AbandonLivraison.objects.filter(
            livreur=livreur, created_at__gte=depuis,
        ).count()
        if recents >= param.max_abandons:
            livreur.is_active = False
            livreur.save(update_fields=['is_active'])
            AuditLog.objects.create(
                user=livreur, action='LIVREUR_AUTO_BLOQUE',
                model_name='User', object_id=str(livreur.pk),
                description={'abandons': recents, 'fenetre_jours': param.fenetre_abandons_jours},
            )
    return commande


# ─── NOTIFICATIONS ──────────────────────────────────────────
def _notifier_livraison_terminee(livraison):
    try:
        from .push import envoyer_push
    except Exception:
        return
    commande = livraison.commande
    if commande and commande.client_id:
        envoyer_push(
            [commande.client], 'Commande livrée',
            'Bon appétit ! Votre commande a bien été livrée.',
            data={'type': 'commande', 'commande_id': commande.pk},
        )
    if livraison.livreur_id:
        gain = int(_part_livreur(commande)) if commande else 0
        envoyer_push(
            [livraison.livreur], 'Course terminée',
            f'+{gain} F crédités sur votre solde.',
            data={'type': 'course', 'commande_id': commande.pk if commande else None},
        )
