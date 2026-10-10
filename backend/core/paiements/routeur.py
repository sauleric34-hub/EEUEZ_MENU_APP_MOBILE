"""Choix de l'agrégateur et lancement d'un paiement avec bascule de secours.

Règle : pour un PAYS (celui du restaurant), une VILLE et un OPÉRATEUR, les
routes actives donnent une liste d'agrégateurs par priorité. Une route de
ville remplace celles du pays pour cette ville. On écarte les agrégateurs
inactifs, en maintenance, non intégrés ou sans clés dans le .env ; ceux dont
le disjoncteur est ouvert passent en dernier recours.

Au lancement, on essaie le premier ; s'il est EN PANNE (réseau, 5xx, service
indisponible), on passe au suivant sans que le client le voie — aucun argent
n'a encore bougé — puis on alerte les administrateurs. Une erreur venant de
la demande elle-même (numéro invalide…) est renvoyée telle quelle : un autre
agrégateur la refuserait aussi.

Performances : la configuration est lue en une fois puis mise en cache
(invalidée à chaque modification dans l'admin) — aucune requête en base pour
choisir l'agrégateur.
"""
import logging
import time
import unicodedata

from django.conf import settings
from django.core.cache import cache

from . import alertes, disjoncteur
from .base import DemandePaiement, ResultatLancement
from .registre import ADAPTATEURS, adaptateur

logger = logging.getLogger(__name__)

CLE_VERSION = 'paiement:config:version'
DUREE_CACHE_S = 300
PAYS_DEFAUT = 'CM'

# Opérateur ↔ mode de paiement historique (Transaction.mode_paiement)
MODE_PAR_OPERATEUR = {'mtn_momo': 'mtn_money', 'orange_money': 'orange_money'}
OPERATEUR_PAR_MODE = {v: k for k, v in MODE_PAR_OPERATEUR.items()}


def mode_pour_operateur(operateur):
    return MODE_PAR_OPERATEUR.get(operateur, 'mobile_money')


# ─── Configuration en cache ──────────────────────────────────
def invalider_cache():
    try:
        cache.incr(CLE_VERSION)
    except ValueError:
        cache.set(CLE_VERSION, 2, None)


def _normaliser(texte):
    # Apostrophes et tirets typographiques ou droits : « Côte d’Ivoire » = « Cote d'Ivoire »
    texte = (texte or '').translate(str.maketrans({'’': ' ', "'": ' ', '-': ' ', '‐': ' '}))
    sans_accents = unicodedata.normalize('NFD', texte)
    sans_accents = ''.join(c for c in sans_accents if unicodedata.category(c) != 'Mn')
    return ' '.join(sans_accents.lower().split())


def config():
    """Instantané de la configuration (mis en cache)."""
    version = cache.get(CLE_VERSION) or 1
    cle = f'paiement:config:v{version}'
    instantane = cache.get(cle)
    if instantane is None:
        instantane = _charger_config()
        cache.set(cle, instantane, DUREE_CACHE_S)
    return instantane


def _charger_config():
    from core.models import Agregateur, Operateur, PaysPaiement, RoutePaiement
    return {
        'agregateurs': {
            a.code: {'actif': a.actif, 'maintenance': a.en_maintenance}
            for a in Agregateur.objects.all()
        },
        'operateurs': {
            o.code: {
                'code': o.code, 'nom': o.nom, 'couleur': o.couleur, 'format_numero': o.format_numero,
                'logo': o.logo.url if o.logo else '', 'ordre': o.ordre, 'actif': o.actif,
            }
            for o in Operateur.objects.all()
        },
        'pays': {
            p.pays_code: {'devise': p.devise, 'indicatif': p.indicatif, 'actif': p.actif}
            for p in PaysPaiement.objects.all()
        },
        'routes': [
            (r.pays_code, r.ville_normalisee, r.operateur.code, r.agregateur.code, r.priorite)
            for r in RoutePaiement.objects.filter(actif=True).select_related('operateur', 'agregateur')
        ],
    }


# ─── Pays d'un restaurant ────────────────────────────────────
def pays_code_de(nom_pays):
    """« Cameroun » → « CM » (sans accents ni casse). Un code ISO est accepté tel quel."""
    from core.pays import PAYS
    valeur = (nom_pays or '').strip()
    if len(valeur) == 2 and valeur.isalpha():
        return valeur.upper()
    cible = _normaliser(valeur)
    for code, nom in PAYS:
        if _normaliser(nom) == cible:
            return code
    return PAYS_DEFAUT


def lieu_du_restaurant(resto):
    return pays_code_de(getattr(resto, 'pays', '')), (getattr(resto, 'ville', '') or '').strip()


# ─── Choix des agrégateurs ───────────────────────────────────
def utilisable(code, cfg=None):
    """(utilisable, raison) — l'agrégateur peut-il encaisser maintenant ?"""
    cfg = cfg or config()
    etat = cfg['agregateurs'].get(code)
    ad = adaptateur(code)
    if not ad or not etat:
        return False, 'inconnu'
    if not etat['actif']:
        return False, 'désactivé'
    if etat['maintenance']:
        return False, 'en maintenance'
    if not ad.implemente:
        return False, 'intégration en cours'
    if not ad.est_configure():
        return False, 'clés manquantes dans le .env'
    return True, ''


def candidats(pays_code, ville, operateur, cfg=None):
    """Agrégateurs à essayer, dans l'ordre (disjoncteurs ouverts en dernier)."""
    from core.models_bannieres import normaliser_ville
    cfg = cfg or config()
    ville_n = normaliser_ville(ville)  # même normalisation que RoutePaiement.ville_normalisee
    routes = [r for r in cfg['routes'] if r[0] == pays_code and r[2] == operateur]
    propres_a_la_ville = [r for r in routes if ville_n and r[1] == ville_n]
    retenues = propres_a_la_ville or [r for r in routes if r[1] == '']
    codes = []
    for _p, _v, _o, code, _prio in sorted(retenues, key=lambda r: r[4]):
        if code not in codes and utilisable(code, cfg)[0]:
            codes.append(code)
    return [c for c in codes if not disjoncteur.est_ouvert(c)] + [c for c in codes if disjoncteur.est_ouvert(c)]


def operateurs_disponibles(pays_code, ville=''):
    """Opérateurs proposés au client (ceux qui ont au moins un agrégateur utilisable)."""
    cfg = config()
    pays = cfg['pays'].get(pays_code)
    if not pays or not pays['actif']:
        return []
    resultat = []
    for op in sorted(cfg['operateurs'].values(), key=lambda o: (o['ordre'], o['nom'])):
        if not op['actif']:
            continue
        codes = candidats(pays_code, ville, op['code'], cfg)
        if codes:
            resultat.append({
                **op,
                'mode_paiement': mode_pour_operateur(op['code']),
                'flux': ADAPTATEURS[codes[0]].flux,
                'devise': pays['devise'],
                'indicatif': pays['indicatif'],
            })
    return resultat


def devise_du_pays(pays_code):
    pays = config()['pays'].get(pays_code)
    return pays['devise'] if pays else 'XAF'


# ─── Lancement avec bascule ──────────────────────────────────
MESSAGE_INDISPONIBLE = 'Le paiement est momentanément indisponible. Réessayez dans quelques minutes.'


def lancer(*, objet, reference, montant, pays_code, ville, operateur, telephone='', email='',
           nom_client='', description=''):
    """Lance le paiement chez le premier agrégateur disponible, avec bascule.

    Renvoie (ResultatLancement, code_agregateur) — code None en cas d'échec.
    """
    from core.models import TentativePaiement

    cfg = config()
    pays = cfg['pays'].get(pays_code)
    if not pays or not pays['actif']:
        return ResultatLancement(ok=False, erreur="Le paiement en ligne n'est pas encore disponible dans ce pays."), None

    # Opérateur absent (anciens clients) : on route sur le premier disponible
    # mais sans l'imposer à l'agrégateur (sa page proposera le choix).
    operateur_route = operateur or next(
        (o['code'] for o in operateurs_disponibles(pays_code, ville)), '',
    )
    codes = candidats(pays_code, ville, operateur_route, cfg)
    if not codes:
        alertes.alerter(
            titre=f'Aucun agrégateur disponible — {pays_code} · {operateur_route or "opérateur ?"}',
            message="Un client n'a pas pu payer : aucune route active et utilisable pour ce pays et cet opérateur.",
            niveau='critique', details={'pays': pays_code, 'ville': ville, 'operateur': operateur_route, 'reference': reference},
            cle_anti_rafale=f'aucun:{pays_code}:{operateur_route}',
        )
        return ResultatLancement(ok=False, erreur="Ce moyen de paiement n'est pas disponible pour le moment."), None

    base = settings.APP_BASE_URL.rstrip('/')
    echecs = []
    for rang, code in enumerate(codes):
        ad = ADAPTATEURS[code]
        demande = DemandePaiement(
            reference=reference, montant=int(montant), devise=pays['devise'], pays_code=pays_code,
            operateur=operateur, telephone=telephone, email=email, nom_client=nom_client,
            description=description or f'Commande MENU {reference}',
            url_notification=f'{base}/api/paiements/{code}/notify/',
            url_retour=f'{base}/payment/success/?ref={reference}',
        )
        debut = time.monotonic()
        try:
            resultat = ad.lancer(demande)
        except Exception as exc:  # un adaptateur défaillant ne doit jamais faire tomber le checkout
            logger.exception('Paiement : exception dans l\'adaptateur %s', code)
            resultat = ResultatLancement(ok=False, erreur=f'Erreur interne ({type(exc).__name__})', panne_agregateur=True)
        duree = int((time.monotonic() - debut) * 1000)

        _journaliser(TentativePaiement, objet, reference, code, operateur, pays_code, ville, montant,
                     pays['devise'], resultat, duree, bascule=rang > 0)

        if resultat.ok:
            disjoncteur.signaler_succes(code)
            if echecs:
                _alerter_bascule(echecs, code, reference, montant, pays_code, ville, operateur)
            return resultat, code

        if not resultat.panne_agregateur:
            return resultat, None  # erreur de la demande : basculer n'y changerait rien

        echecs.append((code, resultat.erreur))
        if disjoncteur.signaler_panne(code):
            alertes.alerter(
                titre=f'{ad.nom} mis à l’écart 5 minutes (pannes répétées)',
                message=f'{disjoncteur.SEUIL_PANNES} échecs consécutifs : les paiements passent par les agrégateurs de secours.',
                niveau='critique', details={'agregateur': ad.nom, 'derniere_erreur': resultat.erreur},
                cle_anti_rafale=f'disjoncteur:{code}',
            )

    alertes.alerter(
        titre=f'Paiements impossibles — {pays_code} · {operateur_route}',
        message='Tous les agrégateurs configurés pour ce pays et cet opérateur ont échoué. Les clients ne peuvent plus payer.',
        niveau='critique',
        details={
            'pays': pays_code, 'ville': ville or '—', 'operateur': operateur_route, 'reference': reference,
            'montant': f'{montant} {pays["devise"]}', **{f'erreur_{c}': e for c, e in echecs},
        },
        cle_anti_rafale=f'tous:{pays_code}:{operateur_route}',
    )
    return ResultatLancement(ok=False, erreur=MESSAGE_INDISPONIBLE, panne_agregateur=True), None


def _journaliser(modele, objet, reference, code, operateur, pays_code, ville, montant, devise, resultat, duree, bascule):
    try:
        modele.objects.create(
            reference=reference, objet=objet, agregateur=code, operateur=operateur or '',
            pays_code=pays_code, ville=(ville or '')[:100], montant=montant, devise=devise,
            flux=resultat.flux if resultat.ok else '', bascule=bascule,
            statut='en_attente' if resultat.ok else 'echec_lancement',
            provider_reference=(resultat.provider_reference or '')[:100],
            erreur=(resultat.erreur or '')[:300], duree_ms=duree,
        )
    except Exception:
        logger.exception('Paiement : journal de tentative impossible (%s)', reference)


def _alerter_bascule(echecs, code_secours, reference, montant, pays_code, ville, operateur):
    noms = ', '.join(ADAPTATEURS[c].nom for c, _ in echecs)
    alertes.alerter(
        titre=f'Bascule automatique : {noms} → {ADAPTATEURS[code_secours].nom}',
        message=(
            f'Le paiement {reference} n’a pas pu être lancé chez {noms}. Il a été lancé automatiquement '
            f'chez {ADAPTATEURS[code_secours].nom}. Vérifiez l’état de l’agrégateur en échec ; '
            'si la panne dure, mettez-le en maintenance depuis l’administration.'
        ),
        niveau='avertissement',
        details={
            'reference': reference, 'montant': montant, 'pays': pays_code, 'ville': ville or '—',
            'operateur': operateur or '—', 'agregateur_de_secours': ADAPTATEURS[code_secours].nom,
            **{f'erreur_{c}': e for c, e in echecs},
        },
        cle_anti_rafale=f'bascule:{echecs[0][0]}:{code_secours}',
    )
