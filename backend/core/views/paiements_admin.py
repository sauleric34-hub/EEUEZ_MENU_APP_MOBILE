"""Espace admin : agrégateurs de paiement, routes par pays/ville/opérateur,
opérateurs, pays, journal des tentatives, alertes et destinataires."""
from datetime import timedelta

from django.conf import settings
from django.contrib import messages
from django.core.paginator import Paginator
from django.db import transaction
from django.db.models import Avg, Count, Q
from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone
from django.views.decorators.http import require_POST

from core.models import (
    Agregateur, AlerteAdmin, AuditLog, DestinataireAlerte, Operateur, PaysPaiement, RoutePaiement,
    TentativePaiement,
)
from core.models_bannieres import normaliser_ville
from core.paiements import disjoncteur, routeur
from core.paiements.registre import ADAPTATEURS
from core.pays import PAYS, PAYS_NOMS, drapeau
from .dashboard import admin_required


def _journal(request, action, objet, description):
    AuditLog.objects.create(
        user=request.user, action=action, model_name=type(objet).__name__ if objet else '',
        object_id=str(getattr(objet, 'pk', '') or ''), description=description,
        ip_address=request.META.get('REMOTE_ADDR'),
    )


def _sante(depuis):
    """Statistiques par agrégateur sur la période (une seule requête)."""
    lignes = (
        TentativePaiement.objects.filter(created_at__gte=depuis)
        .values('agregateur')
        .annotate(
            total=Count('id'),
            echecs_lancement=Count('id', filter=Q(statut='echec_lancement')),
            payes=Count('id', filter=Q(statut='complete')),
            echoues=Count('id', filter=Q(statut='echouee')),
            bascules=Count('id', filter=Q(bascule=True, statut__in=['en_attente', 'complete'])),
            duree=Avg('duree_ms', filter=~Q(statut='echec_lancement')),
        )
    )
    return {l['agregateur']: l for l in lignes}


@admin_required
def paiements_index(request):
    depuis = timezone.now() - timedelta(hours=24)
    sante = _sante(depuis)
    agregateurs = []
    for a in Agregateur.objects.all():
        ad = ADAPTATEURS.get(a.code)
        stats = sante.get(a.code, {})
        total = stats.get('total', 0)
        lances = total - stats.get('echecs_lancement', 0)
        derniere_erreur = (TentativePaiement.objects.filter(agregateur=a.code, statut='echec_lancement')
                           .only('erreur', 'created_at').first())
        ok, raison = routeur.utilisable(a.code)
        agregateurs.append({
            'obj': a, 'ad': ad, 'utilisable': ok, 'raison': raison,
            'disjoncteur': disjoncteur.est_ouvert(a.code),
            'variables': [(v, bool(getattr(settings, v, ''))) for v in ad.variables_env] if ad else [],
            'total': total, 'taux_lancement': round(100 * lances / total) if total else None,
            'payes': stats.get('payes', 0), 'echoues': stats.get('echoues', 0),
            'bascules': stats.get('bascules', 0), 'duree': int(stats['duree']) if stats.get('duree') else None,
            'derniere_erreur': derniere_erreur,
            'nb_routes': a.routes.filter(actif=True).count(),
        })

    # Routes regroupées par pays → ville → opérateur (chaîne principale → secours)
    routes = RoutePaiement.objects.select_related('operateur', 'agregateur').order_by('pays_code', 'ville_normalisee', 'operateur__ordre', 'priorite')
    pays_actifs = {p.pays_code: p for p in PaysPaiement.objects.all()}
    blocs = {}
    for r in routes:
        bloc = blocs.setdefault(r.pays_code, {'pays': pays_actifs.get(r.pays_code), 'lieux': {}})
        lieu = bloc['lieux'].setdefault(r.ville or '', {})
        lieu.setdefault(r.operateur, []).append(r)
    pays_blocs = []
    for code, bloc in sorted(blocs.items()):
        lieux = [(ville, sorted(ops.items(), key=lambda kv: kv[0].ordre)) for ville, ops in sorted(bloc['lieux'].items())]
        pays_blocs.append({'code': code, 'nom': PAYS_NOMS.get(code, code), 'drapeau': drapeau(code), 'conf': bloc['pays'], 'lieux': lieux})
    # Pays ouverts sans aucune route : à signaler
    for code, p in pays_actifs.items():
        if code not in blocs:
            pays_blocs.append({'code': code, 'nom': PAYS_NOMS.get(code, code), 'drapeau': drapeau(code), 'conf': p, 'lieux': []})

    return render(request, 'admin_panel/paiements/index.html', {
        'agregateurs': agregateurs,
        'pays_blocs': pays_blocs,
        'operateurs': Operateur.objects.filter(actif=True),
        'pays_ouverts': [(c, PAYS_NOMS.get(c, c), drapeau(c)) for c in sorted(pays_actifs)],
        'agregateurs_choix': Agregateur.objects.all(),
        'alertes_non_lues': AlerteAdmin.objects.filter(lue=False, categorie='paiement').count(),
        'active_page': 'paiements',
    })


@admin_required
@require_POST
def agregateur_action(request, code):
    a = get_object_or_404(Agregateur, code=code)
    action = request.POST.get('action')
    if action == 'activer':
        a.actif = True
        a.save()
        messages.success(request, f'{a} activé.')
    elif action == 'desactiver':
        a.actif = False
        a.save()
        messages.warning(request, f'{a} désactivé : ses routes passent aux agrégateurs de secours.')
    elif action == 'maintenance':
        a.en_maintenance = True
        a.note_maintenance = (request.POST.get('note') or '').strip()[:200]
        a.save()
        messages.warning(request, f'{a} en maintenance : le trafic part immédiatement vers les secours.')
    elif action == 'fin_maintenance':
        a.en_maintenance = False
        a.note_maintenance = ''
        a.save()
        messages.success(request, f'{a} de retour en service.')
    elif action == 'reinitialiser_disjoncteur':
        disjoncteur.reinitialiser(a.code)
        messages.success(request, f'Disjoncteur de {a} réinitialisé.')
    else:
        messages.error(request, 'Action inconnue.')
        return redirect('core:paiements')
    _journal(request, f'PAIEMENT_AGREGATEUR_{action.upper()}', a, {'agregateur': a.code})
    return redirect('core:paiements')


@admin_required
@require_POST
def bascule_crise(request):
    """Fait passer un agrégateur en tête (priorité 1) pour un pays — tous les
    opérateurs ou un seul — en décalant les autres. Crée la route si besoin."""
    pays_code = (request.POST.get('pays') or '').upper()
    agregateur = get_object_or_404(Agregateur, code=request.POST.get('agregateur'))
    op_code = request.POST.get('operateur') or ''
    ville = (request.POST.get('ville') or '').strip()
    operateurs = Operateur.objects.filter(actif=True)
    if op_code:
        operateurs = operateurs.filter(code=op_code)
    ad = ADAPTATEURS.get(agregateur.code)
    ok, raison = routeur.utilisable(agregateur.code)
    if not ok:
        messages.error(request, f'{agregateur} n\'est pas utilisable ({raison}) : bascule annulée.')
        return redirect('core:paiements')

    modifies = []
    with transaction.atomic():
        for op in operateurs:
            if ad and not ad.couvre(pays_code, op.code):
                continue
            routes = list(RoutePaiement.objects.select_for_update().filter(
                pays_code=pays_code, ville_normalisee=normaliser_ville(ville), operateur=op))
            cible = next((r for r in routes if r.agregateur_id == agregateur.pk), None)
            for r in routes:
                if r is not cible:
                    r.priorite = r.priorite + 1
                    r.save()
            if cible:
                cible.priorite, cible.actif = 1, True
                cible.save()
            else:
                RoutePaiement.objects.create(pays_code=pays_code, ville=ville, operateur=op, agregateur=agregateur, priorite=1)
            modifies.append(op.nom)
    if not modifies:
        messages.error(request, f'{agregateur} ne couvre aucun de ces opérateurs dans ce pays.')
        return redirect('core:paiements')
    _journal(request, 'PAIEMENT_BASCULE_CRISE', agregateur,
             {'pays': pays_code, 'ville': ville, 'operateurs': modifies, 'agregateur': agregateur.code})
    messages.success(request, f'Bascule effectuée : {", ".join(modifies)} → {agregateur} en priorité ({pays_code}{" · " + ville if ville else ""}).')
    return redirect('core:paiements')


# ─── Routes ──────────────────────────────────────────────────
@admin_required
def route_form(request, pk=None):
    route = get_object_or_404(RoutePaiement, pk=pk) if pk else None
    if request.method == 'POST':
        pays_code = (request.POST.get('pays_code') or '').upper()
        operateur = Operateur.objects.filter(pk=request.POST.get('operateur')).first()
        agregateur = Agregateur.objects.filter(pk=request.POST.get('agregateur')).first()
        try:
            priorite = max(1, int(request.POST.get('priorite') or 1))
        except ValueError:
            priorite = 1
        ville = (request.POST.get('ville') or '').strip()
        if pays_code not in PAYS_NOMS or not operateur or not agregateur:
            messages.error(request, 'Pays, opérateur et agrégateur sont obligatoires.')
        elif RoutePaiement.objects.filter(pays_code=pays_code, ville_normalisee=normaliser_ville(ville),
                                          operateur=operateur, agregateur=agregateur).exclude(pk=pk).exists():
            messages.error(request, 'Cette route existe déjà — modifiez sa priorité.')
        else:
            route = route or RoutePaiement()
            route.pays_code, route.ville, route.operateur, route.agregateur = pays_code, ville, operateur, agregateur
            route.priorite, route.actif = priorite, request.POST.get('actif') == 'on'
            route.save()
            PaysPaiement.objects.get_or_create(pays_code=pays_code)
            _journal(request, 'PAIEMENT_ROUTE_EDIT' if pk else 'PAIEMENT_ROUTE_CREATE', route, {'route': str(route)})
            ad = ADAPTATEURS.get(agregateur.code)
            if ad and not ad.couvre(pays_code, operateur.code):
                messages.warning(request, f'Attention : {agregateur} ne semble pas couvrir {operateur} dans ce pays — vérifiez sa documentation.')
            messages.success(request, f'Route enregistrée : {route}.')
            return redirect('core:paiements')

    couverture = {code: {p: sorted(ops) for p, ops in ad.couverture.items()} for code, ad in ADAPTATEURS.items()}
    return render(request, 'admin_panel/paiements/route_form.html', {
        'route': route,
        'pays': [(c, n, drapeau(c)) for c, n in PAYS],
        'operateurs': Operateur.objects.filter(actif=True),
        'agregateurs': Agregateur.objects.all(),
        'couverture': couverture,
        'pays_initial': (route.pays_code if route else request.GET.get('pays', 'CM')),
        'ville_initiale': (route.ville if route else request.GET.get('ville', '')),
        'active_page': 'paiements',
    })


@admin_required
@require_POST
def route_delete(request, pk):
    route = get_object_or_404(RoutePaiement, pk=pk)
    description = str(route)
    route.delete()
    _journal(request, 'PAIEMENT_ROUTE_DELETE', None, {'route': description})
    messages.success(request, f'Route supprimée : {description}.')
    return redirect('core:paiements')


@admin_required
@require_POST
def route_toggle(request, pk):
    route = get_object_or_404(RoutePaiement, pk=pk)
    route.actif = not route.actif
    route.save()
    messages.success(request, f'Route {"activée" if route.actif else "désactivée"} : {route}.')
    return redirect('core:paiements')


# ─── Opérateurs & pays ───────────────────────────────────────
@admin_required
def referentiels(request):
    if request.method == 'POST':
        quoi = request.POST.get('quoi')
        if quoi == 'operateur':
            op = Operateur.objects.filter(pk=request.POST.get('id')).first() or Operateur()
            code = (request.POST.get('code') or '').strip().lower().replace('-', '_')
            nom = (request.POST.get('nom') or '').strip()
            if not code or not nom:
                messages.error(request, 'Code et nom de l\'opérateur sont obligatoires.')
            elif Operateur.objects.filter(code=code).exclude(pk=op.pk).exists():
                messages.error(request, f'Le code « {code} » existe déjà.')
            else:
                op.code, op.nom = code, nom
                op.couleur = request.POST.get('couleur') or op.couleur
                op.format_numero = (request.POST.get('format_numero') or '').strip()[:40]
                op.actif = request.POST.get('actif') == 'on'
                try:
                    op.ordre = int(request.POST.get('ordre') or 0)
                except ValueError:
                    pass
                if 'logo' in request.FILES:
                    op.logo = request.FILES['logo']
                op.save()
                _journal(request, 'PAIEMENT_OPERATEUR_SAVE', op, {'code': op.code})
                messages.success(request, f'Opérateur « {op.nom} » enregistré.')
        elif quoi == 'pays':
            code = (request.POST.get('pays_code') or '').upper()
            if code not in PAYS_NOMS:
                messages.error(request, 'Pays inconnu.')
            else:
                p, _ = PaysPaiement.objects.get_or_create(pays_code=code)
                p.devise = (request.POST.get('devise') or 'XAF').upper()[:3]
                p.indicatif = ''.join(c for c in (request.POST.get('indicatif') or '') if c.isdigit())[:5]
                p.actif = request.POST.get('actif') == 'on'
                p.save()
                _journal(request, 'PAIEMENT_PAYS_SAVE', p, {'pays': code, 'actif': p.actif})
                messages.success(request, f'{PAYS_NOMS[code]} : paiement {"ouvert" if p.actif else "fermé"} ({p.devise}).')
        return redirect('core:paiements_referentiels')

    return render(request, 'admin_panel/paiements/referentiels.html', {
        'operateurs': Operateur.objects.annotate(nb_routes=Count('routes')),
        'pays_paiement': [(p, PAYS_NOMS.get(p.pays_code, p.pays_code), drapeau(p.pays_code)) for p in PaysPaiement.objects.all()],
        'pays': [(c, n, drapeau(c)) for c, n in PAYS],
        'active_page': 'paiements',
    })


# ─── Journal ─────────────────────────────────────────────────
@admin_required
def journal(request):
    qs = TentativePaiement.objects.all()
    f = {k: request.GET.get(k, '') for k in ('agregateur', 'statut', 'pays', 'q')}
    if f['agregateur']:
        qs = qs.filter(agregateur=f['agregateur'])
    if f['statut']:
        qs = qs.filter(statut=f['statut'])
    if f['pays']:
        qs = qs.filter(pays_code=f['pays'].upper())
    if f['q']:
        qs = qs.filter(Q(reference__icontains=f['q']) | Q(provider_reference__icontains=f['q']))
    page = Paginator(qs, 50).get_page(request.GET.get('page'))
    return render(request, 'admin_panel/paiements/journal.html', {
        'page_obj': page, 'filtres': f,
        'agregateurs': Agregateur.objects.all(),
        'statuts': TentativePaiement.STATUT_CHOICES,
        'active_page': 'paiements',
    })


# ─── Alertes & destinataires ─────────────────────────────────
@admin_required
def alertes_index(request):
    if request.method == 'POST':
        action = request.POST.get('action')
        if action == 'tout_lire':
            AlerteAdmin.objects.filter(lue=False).update(lue=True)
        elif action == 'lire':
            AlerteAdmin.objects.filter(pk=request.POST.get('id')).update(lue=True)
        elif action == 'destinataire':
            d = DestinataireAlerte.objects.filter(pk=request.POST.get('id')).first() or DestinataireAlerte()
            email = (request.POST.get('email') or '').strip().lower()
            if not email or '@' not in email:
                messages.error(request, 'Adresse e-mail invalide.')
                return redirect('core:alertes')
            if DestinataireAlerte.objects.filter(email=email).exclude(pk=d.pk).exists():
                messages.error(request, 'Cette adresse est déjà enregistrée.')
                return redirect('core:alertes')
            d.email, d.nom = email, (request.POST.get('nom') or '').strip()[:100]
            d.categories = [c for c in request.POST.getlist('categories') if c in dict(AlerteAdmin.CATEGORIE_CHOICES)]
            d.niveau_minimum = request.POST.get('niveau_minimum') if request.POST.get('niveau_minimum') in dict(AlerteAdmin.NIVEAU_CHOICES) else 'avertissement'
            d.actif = request.POST.get('actif') == 'on'
            d.save()
            _journal(request, 'ALERTE_DESTINATAIRE_SAVE', d, {'email': d.email})
            messages.success(request, f'Destinataire {d.email} enregistré.')
        elif action == 'supprimer_destinataire':
            d = get_object_or_404(DestinataireAlerte, pk=request.POST.get('id'))
            _journal(request, 'ALERTE_DESTINATAIRE_DELETE', d, {'email': d.email})
            d.delete()
            messages.success(request, 'Destinataire supprimé.')
        elif action == 'test':
            from core.paiements.alertes import alerter
            alerter(titre="Test d'alerte — tout fonctionne", message="Ceci est un e-mail de test envoyé depuis l'administration MENU.",
                    niveau='critique', categorie=request.POST.get('categorie') or 'paiement',
                    details={'declenche_par': request.user.email or request.user.username})
            messages.success(request, "Alerte de test envoyée aux destinataires concernés.")
        return redirect(request.POST.get('next') or 'core:alertes')

    categorie = request.GET.get('categorie', '')
    qs = AlerteAdmin.objects.all()
    if categorie:
        qs = qs.filter(categorie=categorie)
    if request.GET.get('non_lues'):
        qs = qs.filter(lue=False)
    page = Paginator(qs, 30).get_page(request.GET.get('page'))
    return render(request, 'admin_panel/alertes/index.html', {
        'page_obj': page, 'categorie': categorie, 'non_lues': request.GET.get('non_lues', ''),
        'destinataires': DestinataireAlerte.objects.all(),
        'categories': AlerteAdmin.CATEGORIE_CHOICES, 'niveaux': AlerteAdmin.NIVEAU_CHOICES,
        'emails_env': getattr(settings, 'ADMIN_ALERT_EMAILS', []),
        'active_page': 'alertes',
    })
