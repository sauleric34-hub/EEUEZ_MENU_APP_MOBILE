# ═══════════════════════════════════════════════════════════
#  Checkout — construction des Commande (panier mono ou multi-restaurant).
#
#  Une seule fonction construit UNE Commande pour UN restaurant à partir
#  d'items déjà filtrés pour lui : c'est le cœur commun utilisé par
#  l'ancien endpoint (un seul restaurant) et par le panier groupé
#  (plusieurs restaurants, un par Commande). Le calcul du frais de
#  livraison, son gel sur la commande, et le rejet hors-zone vivent ICI,
#  une seule fois, pour que les deux chemins ne puissent jamais diverger.
#
#  La fidélité (calculer_reduction / depenser_points) N'EST PAS gérée ici :
#  elle s'applique une fois sur le total du panier (une commande ou un
#  groupe), donc à l'appelant de la traiter après coup.
# ═══════════════════════════════════════════════════════════

from django.db import transaction

from .complements import resoudre_choix, enregistrer_choix, ComplementInvalide
from .delivery import calculer_frais_livraison

VALID_MODES = {'especes', 'mtn_money', 'orange_money', 'carte'}


def mode_paiement_valide(mode):
    return mode if mode in VALID_MODES else 'especes'


class RestaurantExclu(Exception):
    """Le restaurant ne peut pas être servi pour cette commande (fermé, hors
    zone, aucun plat valide…). `motif` est un code stable exploité par l'app,
    `message` un texte prêt à afficher."""
    def __init__(self, motif, message, distance_km=None):
        super().__init__(message)
        self.motif = motif
        self.message = message
        self.distance_km = distance_km


def construire_commande(*, user, restaurant, items, adresse_livraison, latitude, longitude,
                         notes, mode_paiement):
    """Crée une Commande pour UN restaurant à partir de ses items.

    Fige les lignes, le frais de livraison (barème/distance du restaurant),
    la part livreur, les montants, et pose `paiement_confirme` selon le mode
    (la confirmation mobile money arrive plus tard, via le webhook).

    NE crée PAS la Transaction de paiement : la fidélité (appliquée par
    l'appelant, une fois, sur le total du panier ou du groupe) peut encore
    réduire `montant_total` après coup — voir `enregistrer_transaction_paiement`,
    à appeler UNE FOIS la fidélité traitée, pour que la Transaction porte le
    montant définitif (celui que CamerPay facturera réellement).

    Lève RestaurantExclu (rien n'est resté en base) si le restaurant est
    fermé, hors zone pour cette adresse, ou si aucun plat de `items` n'est
    valide pour lui. Renvoie la Commande créée sinon.
    """
    from .models import Commande, LigneCommande, Plat

    if not restaurant.is_open:
        raise RestaurantExclu('ferme', f"{restaurant.nom} est actuellement fermé.")

    with transaction.atomic():
        commande = Commande.objects.create(
            client=user,
            restaurant=restaurant,
            adresse_livraison=adresse_livraison,
            latitude_livraison=latitude,
            longitude_livraison=longitude,
            notes=notes,
            statut='en_attente',
            delai_estime=restaurant.temps_livraison_moyen,
        )

        sous_total_client = 0
        sous_total_base = 0
        frais_plats = []
        for item in items:
            try:
                plat = Plat.objects.get(id=item['plat_id'], restaurant=restaurant)
            except (Plat.DoesNotExist, KeyError):
                continue
            qte = max(1, int(item.get('quantite', 1)))

            try:
                descriptions, supplement = resoudre_choix(plat, item.get('complements'))
            except ComplementInvalide as e:
                commande.delete()
                raise RestaurantExclu('complement_invalide', str(e))

            supplement = int(supplement)
            prix_base = int(plat.prix) + supplement
            prix_client = plat.prix_client + supplement

            ligne = LigneCommande.objects.create(
                commande=commande, plat=plat, quantite=qte, prix_unitaire=prix_client,
            )
            enregistrer_choix(ligne, descriptions)

            sous_total_client += prix_client * qte
            sous_total_base += prix_base * qte
            frais_plats.append(float(plat.frais_livraison))

        if sous_total_client == 0:
            commande.delete()
            raise RestaurantExclu('aucun_plat_valide', f"Aucun plat valide chez {restaurant.nom}.")

        repli_frais = int(round(max(frais_plats))) if frais_plats else int(restaurant.frais_livraison or 0)
        frais_liv, hors_zone, distance_km = calculer_frais_livraison(
            restaurant, commande.latitude_livraison, commande.longitude_livraison,
            repli=repli_frais,
        )
        if hors_zone:
            commande.delete()
            raise RestaurantExclu(
                'hors_zone', f"{restaurant.nom} ne livre pas jusqu'à cette adresse.",
                distance_km=distance_km,
            )

        from .models_livraison import ParametrageLivraison
        commande.frais_livraison = int(round(frais_liv))
        commande.part_livreur = ParametrageLivraison.get_solo().part_livreur(frais_liv)
        commande.montant_total = sous_total_client + frais_liv
        commande.montant_restaurant = sous_total_base
        commande.commission_eeuez = sous_total_client - sous_total_base
        commande.paiement_confirme = (mode_paiement == 'especes')
        commande.save()

        return commande


def enregistrer_transaction_paiement(commande, mode_paiement):
    """Trace le paiement d'UNE commande (espèces = à encaisser à la
    livraison ; mobile money = en attente du webhook). À appeler une fois le
    montant DÉFINITIF connu — après une éventuelle réduction fidélité.
    """
    from .models import Transaction

    Transaction.objects.create(
        commande=commande,
        type='paiement_client',
        montant=commande.montant_total,
        mode_paiement=mode_paiement,
        statut='complete' if mode_paiement == 'especes' else 'en_attente',
    )


def grouper_items_par_restaurant(items):
    """Répartit les items du panier par restaurant RÉEL de chaque plat (une
    seule requête), dans l'ordre de première apparition (déterministe,
    pratique pour les tests). On ignore délibérément un éventuel champ
    `restaurant` fourni par l'app sur chaque item : seul le restaurant
    RÉELLEMENT propriétaire du plat en base fait foi, pour qu'aucun plat ne
    puisse être classé (ni donc facturé) sous le mauvais restaurant.

    `items` : liste de dicts avec au moins `plat_id`. Un plat introuvable est
    ignoré ici (il sera de toute façon écarté par `construire_commande`,
    « aucun plat valide », si son groupe finit vide).
    """
    from .models import Plat

    ids = [item.get('plat_id') for item in items if item.get('plat_id') is not None]
    resto_par_plat = dict(Plat.objects.filter(id__in=ids).values_list('id', 'restaurant_id'))

    par_resto = {}
    for item in items:
        rid = resto_par_plat.get(item.get('plat_id'))
        if rid is None:
            continue
        par_resto.setdefault(rid, []).append(item)
    return par_resto


def creer_commandes_groupees(*, user, items, adresse_livraison, latitude, longitude,
                              notes, mode_paiement, utiliser_points):
    """Checkout multi-restaurant : une Commande par restaurant présent dans
    `items`, reliées par un CommandeGroupe.

    Un restaurant hors zone, fermé, ou sans plat valide n'empêche PAS les
    autres : il est simplement écarté (voir `exclusions`) — paiement
    partiel assumé, conformément à la règle produit retenue.

    La réduction fidélité (si demandée) est calculée et imputée sur UNE SEULE
    commande du groupe (la plus chère) : jamais sur la part du restaurant ni
    celle du livreur, comme pour une commande simple. On la base sur le total
    de CETTE commande (pas celui, plus large, du groupe entier) : le plafond
    de `calculer_reduction` garantit alors, par construction, qu'elle ne
    dépassera jamais ce que la commande peut absorber — indispensable pour
    que les points débités correspondent TOUJOURS exactement à la réduction
    accordée (sans quoi un client pourrait payer des points pour une
    réduction partiellement perdue en route).

    Renvoie (groupe, commandes, exclusions, erreur). `erreur` (str) est
    renseignée UNIQUEMENT si aucune commande n'a pu être créée — dans ce cas
    `groupe` et `commandes` sont None/vides et rien n'a été laissé en base.
    """
    from .models import CommandeGroupe
    from . import fidelite

    par_resto = grouper_items_par_restaurant(items)
    if not par_resto:
        return None, [], [], "Le panier est vide."

    from .models import RestaurantProfile
    restaurants = RestaurantProfile.objects.in_bulk(par_resto.keys())

    with transaction.atomic():
        commandes = []
        exclusions = []
        for restaurant_id, items_du_resto in par_resto.items():
            restaurant = restaurants.get(restaurant_id)
            if restaurant is None:
                continue
            try:
                commande = construire_commande(
                    user=user, restaurant=restaurant, items=items_du_resto,
                    adresse_livraison=adresse_livraison, latitude=latitude, longitude=longitude,
                    notes=notes, mode_paiement=mode_paiement,
                )
                commandes.append(commande)
            except RestaurantExclu as e:
                exclusions.append({
                    'restaurant_id': restaurant_id, 'restaurant_nom': restaurant.nom,
                    'motif': e.motif, 'message': e.message, 'distance_km': e.distance_km,
                })

        if not commandes:
            # Rien à commander : on ne crée ni groupe ni transaction. Le détail
            # (par restaurant) est dans `exclusions`, mais le client HTTP de
            # l'app ne garde que ce message texte sur une erreur — on y met
            # donc directement le détail, lisible tel quel.
            detail = ', '.join(f"{e['restaurant_nom']} ({e['message']})" for e in exclusions)
            erreur = (
                f"Aucun restaurant ne peut être livré à cette adresse : {detail}."
                if detail else "Aucun restaurant ne peut être livré à cette adresse."
            )
            return None, [], exclusions, erreur

        groupe = CommandeGroupe.objects.create(client=user)
        for commande in commandes:
            commande.groupe = groupe
            commande.save(update_fields=['groupe'])

        # ── Réduction fidélité, une fois, imputée sur UNE commande ────────
        # Basée sur le total de CETTE commande (pas celui du groupe) : voir
        # la docstring — ça garantit reduction <= cible.montant_total sans
        # capping manuel, donc points débités == réduction accordée, toujours.
        if utiliser_points:
            cible = max(commandes, key=lambda c: c.montant_total)
            points, reduction = fidelite.calculer_reduction(user, cible.montant_total)
            if reduction > 0:
                mouvement = fidelite.depenser_points(user, cible, points)
                if mouvement:
                    cible.points_utilises = points
                    cible.reduction_points = reduction
                    cible.montant_total = cible.montant_total - reduction
                    cible.commission_eeuez = cible.commission_eeuez - reduction
                    cible.save(update_fields=[
                        'points_utilises', 'reduction_points', 'montant_total', 'commission_eeuez',
                    ])

        for commande in commandes:
            enregistrer_transaction_paiement(commande, mode_paiement)

        groupe.montant_total = sum(int(c.montant_total) for c in commandes)
        groupe.save(update_fields=['montant_total'])

        if mode_paiement in ('mtn_money', 'orange_money'):
            from .models import PaiementGroupe
            PaiementGroupe.objects.create(
                groupe=groupe, montant=groupe.montant_total, mode_paiement=mode_paiement,
            )

        return groupe, commandes, exclusions, None
