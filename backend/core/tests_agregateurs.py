"""Routage multi-agrégateurs : choix, bascule de secours, alertes, disjoncteur, webhook."""
from unittest.mock import patch

from django.core import mail
from django.core.cache import cache
from django.test import Client, TestCase, override_settings
from rest_framework.test import APIClient

from .models import (
    Agregateur, AlerteAdmin, AuditLog, Commande, DestinataireAlerte, Operateur, PaysPaiement, RestaurantProfile,
    RoutePaiement, TentativePaiement, Transaction, User,
)
from .paiements import disjoncteur, routeur
from .paiements.registre import ADAPTATEURS as ADAPTATEURS_REELS
from .paiements.base import (
    Adaptateur, EvenementPaiement, FLUX_PUSH, FLUX_REDIRECTION, ResultatLancement, WebhookInvalide,
)
from .tests import NO_THROTTLE

LOCMEM = {'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache', 'LOCATION': 'tests-agregateurs'}}


class FauxAgregateur(Adaptateur):
    """Agrégateur simulé : on lui dicte le résultat de chaque lancement."""
    flux = FLUX_REDIRECTION
    couverture = {'CM': {'mtn_momo', 'orange_money'}, 'CI': {'wave'}}

    def __init__(self, code, resultat=None, flux=FLUX_REDIRECTION):
        self.code, self.nom, self.flux = code, code.capitalize(), flux
        self.resultat = resultat or ResultatLancement(ok=True, provider_reference=f'{code}-uuid', payment_url=f'https://{code}/pay')
        self.appels = []

    def est_configure(self):
        return True

    def lancer(self, demande):
        self.appels.append(demande)
        r = self.resultat
        return ResultatLancement(**{**r.__dict__, 'flux': self.flux})

    def lire_webhook(self, request):
        if request.POST.get('sig') != 'ok':
            raise WebhookInvalide('Signature invalide', 403)
        return EvenementPaiement(reference=request.POST['ref'], provider_reference=request.POST.get('uuid', ''),
                                 statut=request.POST.get('statut'), montant=request.POST.get('montant'))

    def verifier(self, provider_reference, reference=''):
        return None


@override_settings(CACHES=LOCMEM, REST_FRAMEWORK=NO_THROTTLE, EMAIL_ASYNC=False,
                   EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend', ADMIN_ALERT_EMAILS=[])
class RoutageTests(TestCase):
    def setUp(self):
        cache.clear()
        self.principal = FauxAgregateur('cinetpay')
        self.secours = FauxAgregateur('pawapay', flux=FLUX_PUSH)
        self.patch = patch.dict('core.paiements.routeur.ADAPTATEURS', {'cinetpay': self.principal, 'pawapay': self.secours})
        self.patch.start()
        self.addCleanup(self.patch.stop)
        self.patch2 = patch('core.paiements.routeur.adaptateur', lambda c: {'cinetpay': self.principal, 'pawapay': self.secours}.get(c))
        self.patch2.start()
        self.addCleanup(self.patch2.stop)

        for code in ('cinetpay', 'pawapay'):
            Agregateur.objects.filter(code=code).update(actif=True)
        self.mtn = Operateur.objects.get(code='mtn_momo')
        RoutePaiement.objects.all().delete()
        self._route('CM', '', self.mtn, 'cinetpay', 1)
        self._route('CM', '', self.mtn, 'pawapay', 2)
        DestinataireAlerte.objects.create(email='ops@menu.cm', categories=['paiement'])
        routeur.invalider_cache()

    def _route(self, pays, ville, op, code, prio):
        return RoutePaiement.objects.create(pays_code=pays, ville=ville, operateur=op,
                                            agregateur=Agregateur.objects.get(code=code), priorite=prio)

    def _lancer(self, **kw):
        params = dict(objet='commande', reference='EEUEZ-1-ABC', montant=5000, pays_code='CM', ville='Douala', operateur='mtn_momo')
        params.update(kw)
        return routeur.lancer(**params)

    # ── Choix ───────────────────────────────────────────────
    def test_priorite_respectee(self):
        resultat, code = self._lancer()
        self.assertTrue(resultat.ok)
        self.assertEqual(code, 'cinetpay')
        self.assertTrue(self.principal.appels[0].url_notification.endswith('/api/paiements/cinetpay/notify/'))
        self.assertTrue(self.principal.appels[0].url_retour.endswith('/payment/success/?ref=EEUEZ-1-ABC'))
        self.assertEqual(len(self.secours.appels), 0)
        self.assertEqual(AlerteAdmin.objects.count(), 0)

    def test_regle_de_ville_remplace_le_pays(self):
        self._route('CM', 'Yaoundé', self.mtn, 'pawapay', 1)
        routeur.invalider_cache()
        self.assertEqual(routeur.candidats('CM', 'yaounde', 'mtn_momo'), ['pawapay'])   # accents / casse ignorés
        self.assertEqual(routeur.candidats('CM', 'Douala', 'mtn_momo'), ['cinetpay', 'pawapay'])
        self._route('CM', 'Ebolowa-Ville', self.mtn, 'pawapay', 1)
        routeur.invalider_cache()
        self.assertEqual(routeur.candidats('CM', 'ebolowa-ville', 'mtn_momo'), ['pawapay'])

    def test_maintenance_et_desactivation_ecartent(self):
        Agregateur.objects.filter(code='cinetpay').update(en_maintenance=True)
        routeur.invalider_cache()
        self.assertEqual(routeur.candidats('CM', '', 'mtn_momo'), ['pawapay'])
        Agregateur.objects.filter(code='pawapay').update(actif=False)
        routeur.invalider_cache()
        resultat, code = self._lancer()
        self.assertFalse(resultat.ok)
        self.assertIsNone(code)
        self.assertTrue(AlerteAdmin.objects.filter(niveau='critique').exists())

    def test_cache_invalide_par_l_admin(self):
        self.assertEqual(routeur.candidats('CM', '', 'mtn_momo')[0], 'cinetpay')
        RoutePaiement.objects.filter(agregateur__code='cinetpay').update(priorite=5)  # update() ne déclenche pas de signal…
        RoutePaiement.objects.get(agregateur__code='pawapay').save()                 # …mais une sauvegarde, si
        self.assertEqual(routeur.candidats('CM', '', 'mtn_momo')[0], 'pawapay')

    # ── Bascule ─────────────────────────────────────────────
    def test_bascule_automatique_avec_alerte_et_email(self):
        self.principal.resultat = ResultatLancement(ok=False, erreur='HTTP 503', panne_agregateur=True)
        resultat, code = self._lancer()
        self.assertTrue(resultat.ok)
        self.assertEqual(code, 'pawapay')
        self.assertEqual(resultat.flux, FLUX_PUSH)
        alerte = AlerteAdmin.objects.get()
        self.assertIn('Bascule automatique', alerte.titre)
        self.assertEqual(alerte.donnees['erreur_cinetpay'], 'HTTP 503')
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('ops@menu.cm', mail.outbox[0].bcc)
        self.assertIn('Bascule automatique', mail.outbox[0].subject)
        tentatives = list(TentativePaiement.objects.order_by('id').values_list('agregateur', 'statut', 'bascule'))
        self.assertEqual(tentatives, [('cinetpay', 'echec_lancement', False), ('pawapay', 'en_attente', True)])

    def test_anti_rafale_des_emails(self):
        self.principal.resultat = ResultatLancement(ok=False, erreur='timeout', panne_agregateur=True)
        for i in range(2):
            self._lancer(reference=f'EEUEZ-{i}-X')
        self.assertEqual(AlerteAdmin.objects.filter(titre__startswith='Bascule').count(), 2)
        self.assertEqual(len([m for m in mail.outbox if 'Bascule' in m.subject]), 1)

    def test_pas_de_bascule_si_la_demande_est_invalide(self):
        self.principal.resultat = ResultatLancement(ok=False, erreur='Numéro invalide', panne_agregateur=False)
        resultat, code = self._lancer()
        self.assertFalse(resultat.ok)
        self.assertEqual(resultat.erreur, 'Numéro invalide')
        self.assertEqual(len(self.secours.appels), 0)

    def test_exception_d_adaptateur_traitee_comme_panne(self):
        def boom(demande):
            raise RuntimeError('bug')
        self.principal.lancer = boom
        resultat, code = self._lancer()
        self.assertEqual(code, 'pawapay')

    def test_disjoncteur_ecarte_l_agregateur_en_panne(self):
        self.principal.resultat = ResultatLancement(ok=False, erreur='down', panne_agregateur=True)
        for i in range(disjoncteur.SEUIL_PANNES):
            self._lancer(reference=f'EEUEZ-{i}-D')
        self.assertTrue(disjoncteur.est_ouvert('cinetpay'))
        self.assertTrue(AlerteAdmin.objects.filter(titre__contains='mis à l’écart').exists())
        self.assertEqual(routeur.candidats('CM', '', 'mtn_momo'), ['pawapay', 'cinetpay'])  # en dernier recours

    def test_tous_en_echec(self):
        for ad in (self.principal, self.secours):
            ad.resultat = ResultatLancement(ok=False, erreur='down', panne_agregateur=True)
        resultat, code = self._lancer()
        self.assertFalse(resultat.ok)
        self.assertIn('momentanément indisponible', resultat.erreur)
        self.assertTrue(AlerteAdmin.objects.filter(niveau='critique', titre__startswith='Paiements impossibles').exists())

    # ── Opérateurs proposés ─────────────────────────────────
    def test_operateurs_disponibles(self):
        ops = routeur.operateurs_disponibles('CM', 'Douala')
        self.assertEqual([o['code'] for o in ops], ['mtn_momo'])
        self.assertEqual(ops[0]['flux'], FLUX_REDIRECTION)
        self.assertEqual(ops[0]['devise'], 'XAF')
        self.assertEqual(routeur.operateurs_disponibles('CI'), [])  # pays non ouvert

    def test_pays_du_restaurant(self):
        self.assertEqual(routeur.pays_code_de('Cameroun'), 'CM')
        self.assertEqual(routeur.pays_code_de("Côte d'Ivoire"), 'CI')
        self.assertEqual(routeur.pays_code_de('sn'), 'SN')
        self.assertEqual(routeur.pays_code_de(''), 'CM')


@override_settings(CACHES=LOCMEM, REST_FRAMEWORK=NO_THROTTLE)
class WebhookGeneriqueTests(TestCase):
    def setUp(self):
        cache.clear()
        ur = User.objects.create_user(username='r@ag.cm', email='r@ag.cm', password='x', role='restaurant')
        resto = RestaurantProfile.objects.create(user=ur, nom='R', adresse='-', ville='Douala', commission_rate=10)
        client = User.objects.create_user(username='c@ag.cm', email='c@ag.cm', password='x', role='client')
        self.commande = Commande.objects.create(client=client, restaurant=resto, montant_total=5000, adresse_livraison='-')
        self.txn = Transaction.objects.create(commande=self.commande, type='paiement_client', montant=5000,
                                              mode_paiement='mtn_money', reference='EEUEZ-9-AAA', agregateur='cinetpay')
        self.faux = FauxAgregateur('cinetpay')
        p = patch('core.api_views.adaptateur_paiement', lambda c: self.faux if c == 'cinetpay' else None)
        p.start()
        self.addCleanup(p.stop)

    def test_webhook_signe_confirme_la_commande(self):
        r = self.client.post('/api/paiements/cinetpay/notify/', {
            'sig': 'ok', 'ref': 'EEUEZ-9-AAA', 'uuid': 'cp-1', 'statut': 'complete', 'montant': '5000'})
        self.assertEqual(r.status_code, 200)
        self.commande.refresh_from_db()
        self.assertTrue(self.commande.paiement_confirme)

    def test_signature_invalide_refusee(self):
        r = self.client.post('/api/paiements/cinetpay/notify/', {'sig': 'non', 'ref': 'EEUEZ-9-AAA', 'statut': 'complete'})
        self.assertEqual(r.status_code, 403)
        self.commande.refresh_from_db()
        self.assertFalse(self.commande.paiement_confirme)

    def test_montant_incoherent_refuse(self):
        r = self.client.post('/api/paiements/cinetpay/notify/', {
            'sig': 'ok', 'ref': 'EEUEZ-9-AAA', 'uuid': 'cp-1', 'statut': 'complete', 'montant': '100'})
        self.assertEqual(r.status_code, 400)
        self.commande.refresh_from_db()
        self.assertFalse(self.commande.paiement_confirme)

    def test_agregateur_inconnu(self):
        self.assertEqual(self.client.post('/api/paiements/inconnu/notify/', {}).status_code, 404)


@override_settings(CACHES=LOCMEM, EMAIL_ASYNC=False, EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
                   ADMIN_ALERT_EMAILS=[], CAMERPAY_TOKEN='t', CAMERPAY_CALLBACK_SECRET='s')
class AdminPaiementsTests(TestCase):
    def setUp(self):
        cache.clear()
        admin = User.objects.create_user(username='a@pa.cm', email='a@pa.cm', password='x', role='admin')
        self.web = Client()
        self.web.force_login(admin)

    def test_pages(self):
        for url in ['/admin-panel/paiements/', '/admin-panel/paiements/routes/nouvelle/?pays=CM',
                    '/admin-panel/paiements/referentiels/', '/admin-panel/paiements/journal/', '/admin-panel/alertes/']:
            self.assertEqual(self.web.get(url).status_code, 200, url)

    def test_maintenance_bascule_vers_le_secours(self):
        camerpay = Agregateur.objects.get(code='camerpay')
        self.assertEqual(routeur.candidats('CM', '', 'mtn_momo'), ['camerpay'])
        self.web.post('/admin-panel/paiements/agregateurs/camerpay/', {'action': 'maintenance', 'note': 'Incident'})
        camerpay.refresh_from_db()
        self.assertTrue(camerpay.en_maintenance)
        self.assertEqual(routeur.candidats('CM', '', 'mtn_momo'), [])  # cache invalidé immédiatement
        self.web.post('/admin-panel/paiements/agregateurs/camerpay/', {'action': 'fin_maintenance'})
        self.assertEqual(routeur.candidats('CM', '', 'mtn_momo'), ['camerpay'])

    def test_creation_de_route_et_doublon(self):
        op = Operateur.objects.get(code='orange_money')
        ag = Agregateur.objects.get(code='pawapay')
        donnees = {'pays_code': 'CM', 'ville': 'Douala', 'operateur': op.pk, 'agregateur': ag.pk, 'priorite': 2, 'actif': 'on'}
        self.web.post('/admin-panel/paiements/routes/nouvelle/', donnees)
        self.assertTrue(RoutePaiement.objects.filter(ville='Douala', agregateur=ag).exists())
        self.web.post('/admin-panel/paiements/routes/nouvelle/', donnees)
        self.assertEqual(RoutePaiement.objects.filter(ville='Douala', agregateur=ag).count(), 1)

    def test_bascule_de_crise(self):
        # PawaPay pas encore intégré : bascule refusée
        r = self.web.post('/admin-panel/paiements/bascule/', {'pays': 'CM', 'agregateur': 'pawapay', 'operateur': ''})
        self.assertEqual(RoutePaiement.objects.filter(agregateur__code='pawapay').count(), 0)
        # Vers un agrégateur utilisable : il passe en priorité 1, les autres en secours
        faux = FauxAgregateur('pawapay')
        with patch.dict('core.paiements.routeur.ADAPTATEURS', {'pawapay': faux}), \
             patch('core.paiements.routeur.adaptateur', lambda c: faux if c == 'pawapay' else ADAPTATEURS_REELS[c]), \
             patch.dict('core.views.paiements_admin.ADAPTATEURS', {'pawapay': faux}):
            Agregateur.objects.filter(code='pawapay').update(actif=True)
            routeur.invalider_cache()
            self.web.post('/admin-panel/paiements/bascule/', {'pays': 'CM', 'agregateur': 'pawapay', 'operateur': ''})
            self.assertEqual(routeur.candidats('CM', '', 'mtn_momo'), ['pawapay', 'camerpay'])
        self.assertTrue(AuditLog.objects.filter(action='PAIEMENT_BASCULE_CRISE').exists())

    def test_referentiels_et_destinataires(self):
        self.web.post('/admin-panel/paiements/referentiels/', {'quoi': 'pays', 'pays_code': 'CI', 'devise': 'XOF', 'indicatif': '+225', 'actif': 'on'})
        self.assertEqual(PaysPaiement.objects.get(pays_code='CI').indicatif, '225')
        self.web.post('/admin-panel/paiements/referentiels/', {'quoi': 'operateur', 'code': 'mpesa', 'nom': 'M-Pesa', 'actif': 'on'})
        self.assertTrue(Operateur.objects.filter(code='mpesa').exists())
        self.web.post('/admin-panel/alertes/', {'action': 'destinataire', 'email': 'Ops@Menu.cm', 'categories': ['paiement'],
                                                 'niveau_minimum': 'critique', 'actif': 'on'})
        d = DestinataireAlerte.objects.get()
        self.assertEqual(d.email, 'ops@menu.cm')
        self.web.post('/admin-panel/alertes/', {'action': 'test', 'categorie': 'paiement'})
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('ops@menu.cm', mail.outbox[0].bcc)
        # Badge des alertes non lues dans la barre latérale
        self.assertContains(self.web.get('/admin-panel/paiements/'), 'Alertes')
        self.web.post('/admin-panel/alertes/', {'action': 'tout_lire'})
        self.assertFalse(AlerteAdmin.objects.filter(lue=False).exists())

