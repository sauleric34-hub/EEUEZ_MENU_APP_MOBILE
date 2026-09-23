"""Audit pré-production : failles et cas limites du paiement.

Chaque test reproduit un scénario concret trouvé à l'audit (fraude possible
ou argent perdu) et verrouille son correctif.
"""
import hashlib
import hmac
import json
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase, Client, override_settings
from rest_framework.test import APIClient

from core.models import (
    RestaurantProfile, Commande, Transaction, Plat, Categorie, CommandeGroupe, PaiementGroupe,
    RetraitFonds,
)

User = get_user_model()
SECRET = 'test_secret_key_123'


def _signature(uuid, invoice_id, status, amount):
    data = f'{uuid}|{invoice_id}|{status}|{amount}'
    return hmac.new(SECRET.encode(), data.encode(), hashlib.sha256).hexdigest()


class BaseAudit(TestCase):
    def setUp(self):
        patron = User.objects.create_user(username='r', password='x', role='restaurant')
        self.patron = patron
        self.resto = RestaurantProfile.objects.create(
            user=patron, nom='R', adresse='A', ville='Douala', is_open=True, is_verified=True,
            frais_livraison=500,
        )
        cat = Categorie.objects.create(nom='C')
        self.plat = Plat.objects.create(
            restaurant=self.resto, categorie=cat, nom='P', prix=2000, is_available=True, is_visible=True,
        )
        self.client_user = User.objects.create_user(username='c', password='x', role='client')
        self.commande = Commande.objects.create(
            client=self.client_user, restaurant=self.resto, montant_total=5000, statut='en_attente',
            paiement_confirme=False,
        )
        self.api = APIClient()
        self.api.force_authenticate(self.client_user)


class EcritureCommandeInterditeTests(BaseAudit):
    def test_client_ne_peut_pas_se_declarer_paye(self):
        rep = self.api.patch(f'/api/client/commandes/{self.commande.pk}/',
                             {'paiement_confirme': True, 'montant_total': 1}, format='json')
        self.assertEqual(rep.status_code, 405)
        self.commande.refresh_from_db()
        self.assertFalse(self.commande.paiement_confirme)
        self.assertEqual(int(self.commande.montant_total), 5000)

    def test_put_et_delete_interdits(self):
        self.assertEqual(self.api.put(f'/api/client/commandes/{self.commande.pk}/', {}, format='json').status_code, 405)
        self.commande.paiement_confirme = True
        self.commande.save()
        self.assertEqual(self.api.delete(f'/api/client/commandes/{self.commande.pk}/').status_code, 405)
        self.assertTrue(Commande.objects.filter(pk=self.commande.pk).exists())

    def test_client_ne_peut_pas_creer_de_commande_via_la_route_restaurant(self):
        rep = self.api.post('/api/restaurant/commandes/', {
            'restaurant': self.resto.pk, 'client': self.client_user.pk,
            'montant_total': 1, 'paiement_confirme': True,
        }, format='json')
        self.assertEqual(rep.status_code, 403)

    def test_restaurant_ne_peut_pas_reecrire_une_commande(self):
        self.commande.paiement_confirme = True
        self.commande.save()
        api = APIClient()
        api.force_authenticate(self.patron)
        rep = api.patch(f'/api/restaurant/commandes/{self.commande.pk}/', {'montant_total': 1}, format='json')
        self.assertEqual(rep.status_code, 405)
        self.assertEqual(api.post('/api/restaurant/commandes/', {}, format='json').status_code, 405)
        # Les actions métier restent disponibles.
        self.assertEqual(api.put(f'/api/restaurant/commandes/{self.commande.pk}/accept/').status_code, 200)


@override_settings(PAIEMENT_ESPECES_APP=False)
class ModePaiementTests(BaseAudit):
    def _commander(self, **extra):
        return self.api.post('/api/client/commandes/', {
            'restaurant': self.resto.pk, 'items': [{'plat_id': self.plat.pk, 'quantite': 1}], **extra,
        }, format='json')

    def test_especes_refuse(self):
        self.assertEqual(self._commander(mode_paiement='especes').status_code, 400)

    def test_mode_absent_ou_inconnu_refuse_au_lieu_de_basculer_en_especes(self):
        self.assertEqual(self._commander().status_code, 400)
        self.assertEqual(self._commander(mode_paiement='gratuit').status_code, 400)
        self.assertEqual(self._commander(mode_paiement='carte').status_code, 400)
        self.assertFalse(Commande.objects.filter(paiement_confirme=True).exists())

    def test_groupe_especes_refuse(self):
        rep = self.api.post('/api/client/commandes/groupees/', {
            'items': [{'plat_id': self.plat.pk}], 'mode_paiement': 'especes',
        }, format='json')
        self.assertEqual(rep.status_code, 400)

    def test_mobile_money_accepte_et_non_confirme(self):
        rep = self._commander(mode_paiement='mtn_money', emporter=False)
        self.assertEqual(rep.status_code, 201, rep.content)
        self.assertFalse(rep.json()['paiement_confirme'])


class CheckoutRobustesseTests(BaseAudit):
    def _commander(self, items):
        return self.api.post('/api/client/commandes/', {
            'restaurant': self.resto.pk, 'items': items, 'mode_paiement': 'mtn_money',
        }, format='json')

    def test_plat_indisponible_non_commandable(self):
        self.plat.is_available = False
        self.plat.save()
        self.assertEqual(self._commander([{'plat_id': self.plat.pk}]).status_code, 400)

    def test_plat_masque_non_commandable(self):
        self.plat.is_visible = False
        self.plat.save()
        self.assertEqual(self._commander([{'plat_id': self.plat.pk}]).status_code, 400)

    def test_quantite_invalide_ne_plante_pas(self):
        rep = self._commander([{'plat_id': self.plat.pk, 'quantite': 'abc'}])
        self.assertEqual(rep.status_code, 201)

    def test_quantite_plafonnee(self):
        rep = self._commander([{'plat_id': self.plat.pk, 'quantite': 10 ** 12}])
        self.assertEqual(rep.status_code, 201)
        self.assertEqual(rep.json()['lignes'][0]['quantite'], 50)


class AnnulationPendantPaiementTests(BaseAudit):
    """Mobile Money est asynchrone : le PIN peut être validé APRÈS la
    fermeture du WebView. Supprimer la commande à ce moment-là = client
    débité sans commande."""

    def setUp(self):
        super().setUp()
        self.txn = Transaction.objects.create(
            commande=self.commande, type='paiement_client', montant=5000, mode_paiement='mtn_money',
            statut='en_attente', reference='EEUEZ-1-AAAA', provider_reference='uuid-1',
        )

    def _annuler(self, statut_camerpay, erreur=None):
        with patch('core.camerpay.verifier_statut', return_value=(statut_camerpay, erreur)):
            return self.api.post(f'/api/client/commandes/{self.commande.pk}/annuler/')

    def test_paiement_en_cours_empeche_l_annulation(self):
        for statut in ('pending', 'processing', 'completed'):
            self.assertEqual(self._annuler(statut).status_code, 409)
        self.assertTrue(Commande.objects.filter(pk=self.commande.pk).exists())

    def test_camerpay_injoignable_empeche_l_annulation(self):
        self.assertEqual(self._annuler(None, 'timeout').status_code, 409)
        self.assertTrue(Commande.objects.filter(pk=self.commande.pk).exists())

    def test_echec_confirme_autorise_l_annulation(self):
        self.assertEqual(self._annuler('failed').status_code, 204)
        self.assertFalse(Commande.objects.filter(pk=self.commande.pk).exists())

    def test_paiement_jamais_initie_annulable_sans_appel_camerpay(self):
        self.txn.provider_reference = ''
        self.txn.save()
        with patch('core.camerpay.verifier_statut') as appel:
            rep = self.api.post(f'/api/client/commandes/{self.commande.pk}/annuler/')
        self.assertEqual(rep.status_code, 204)
        appel.assert_not_called()

    def test_groupe_en_cours_de_paiement_non_annulable(self):
        groupe = CommandeGroupe.objects.create(client=self.client_user, montant_total=5000)
        self.commande.groupe = groupe
        self.commande.save()
        PaiementGroupe.objects.create(groupe=groupe, montant=5000, reference='EEUEZG-1-X',
                                      provider_reference='uuid-g')
        with patch('core.camerpay.verifier_statut', return_value=('pending', None)):
            rep = self.api.post(f'/api/client/commandes/groupes/{groupe.pk}/annuler/')
        self.assertEqual(rep.status_code, 409)
        self.assertTrue(CommandeGroupe.objects.filter(pk=groupe.pk).exists())
        with patch('core.camerpay.verifier_statut', return_value=('cancelled', None)):
            rep = self.api.post(f'/api/client/commandes/groupes/{groupe.pk}/annuler/')
        self.assertEqual(rep.status_code, 204)


@override_settings(CAMERPAY_CALLBACK_SECRET=SECRET, CAMERPAY_TOKEN='t')
class WebhookRobustesseTests(BaseAudit):
    def setUp(self):
        super().setUp()
        self.txn = Transaction.objects.create(
            commande=self.commande, type='paiement_client', montant=5000, mode_paiement='mtn_money',
            statut='en_attente', reference='EEUEZ-1-BBBB', provider_reference='uuid-2',
        )
        self.web = Client()

    def _notify_json(self, uuid, status, amount_json, amount_signe, ref='EEUEZ-1-BBBB'):
        return self.web.post('/api/camerpay/notify/', data=json.dumps({
            'transaction_uuid': uuid, 'invoice_id': ref, 'status': status,
            'amount': amount_json, 'signature': _signature(uuid, ref, status, amount_signe),
        }), content_type='application/json')

    def test_montant_json_numerique_signe_a_deux_decimales(self):
        """CamerPay signe « 5000.00 » ; en JSON, le montant arrive en nombre."""
        rep = self._notify_json('uuid-2', 'completed', 5000, '5000.00')
        self.assertEqual(rep.status_code, 200)
        self.txn.refresh_from_db()
        self.assertEqual(self.txn.statut, 'complete')
        self.commande.refresh_from_db()
        self.assertTrue(self.commande.paiement_confirme)

    def test_montant_flottant_json(self):
        rep = self._notify_json('uuid-2', 'completed', 5000.0, '5000.00')
        self.assertEqual(rep.status_code, 200)

    def test_signature_fausse_toujours_rejetee(self):
        rep = self.web.post('/api/camerpay/notify/', data=json.dumps({
            'transaction_uuid': 'uuid-2', 'invoice_id': 'EEUEZ-1-BBBB', 'status': 'completed',
            'amount': 5000, 'signature': _signature('uuid-2', 'EEUEZ-1-BBBB', 'completed', '1.00'),
        }), content_type='application/json')
        self.assertEqual(rep.status_code, 403)

    def test_echec_d_une_ancienne_tentative_ignore(self):
        rep = self._notify_json('uuid-ancien', 'failed', 5000, '5000.00')
        self.assertEqual(rep.status_code, 200)
        self.txn.refresh_from_db()
        self.assertEqual(self.txn.statut, 'en_attente')

    def test_double_paiement_journalise(self):
        self._notify_json('uuid-2', 'completed', 5000, '5000.00')
        with self.assertLogs('core.api_views', level='ERROR') as logs:
            self._notify_json('uuid-3', 'completed', 5000, '5000.00')
        self.assertIn('DOUBLE PAIEMENT', logs.output[0])

    def test_paiement_reussi_sur_reference_inconnue_journalise(self):
        with self.assertLogs('core.api_views', level='ERROR') as logs:
            rep = self._notify_json('uuid-x', 'completed', 5000, '5000.00', ref='EEUEZ-999-ZZZZ')
        self.assertEqual(rep.status_code, 200)
        self.assertIn('remboursement manuel', logs.output[0])

    def test_relance_possible_apres_echec(self):
        self._notify_json('uuid-2', 'failed', 5000, '5000.00')
        self.txn.refresh_from_db()
        self.assertEqual(self.txn.statut, 'echouee')
        with patch('core.api_views.camerpay_initier_paiement', return_value=('uuid-4', 'https://pay', None)):
            rep = self.api.post(f'/api/client/commandes/{self.commande.pk}/initier_paiement/')
        self.assertEqual(rep.status_code, 200)
        self.txn.refresh_from_db()
        self.assertEqual((self.txn.statut, self.txn.provider_reference), ('en_attente', 'uuid-4'))
        # La nouvelle tentative aboutit.
        self._notify_json('uuid-4', 'completed', 5000, '5000.00')
        self.commande.refresh_from_db()
        self.assertTrue(self.commande.paiement_confirme)


class InscriptionTests(TestCase):
    def test_inscription_livreur_ou_restaurant_refusee(self):
        api = APIClient()
        for role in ('livreur', 'restaurant'):
            rep = api.post(f'/api/auth/register/{role}', {'email': f'{role}@x.cm', 'password': 'secret123'}, format='json')
            self.assertEqual(rep.status_code, 400)
        self.assertFalse(User.objects.filter(role__in=['livreur', 'restaurant']).exists())

    def test_validation_email_et_mot_de_passe(self):
        api = APIClient()
        self.assertEqual(api.post('/api/auth/register/client', {'email': 'pas-un-email', 'password': 'secret123'}, format='json').status_code, 400)
        self.assertEqual(api.post('/api/auth/register/client', {'email': 'a@x.cm', 'password': '123'}, format='json').status_code, 400)
        self.assertEqual(api.post('/api/auth/register/client', {'email': 'a@x.cm'}, format='json').status_code, 400)

    def test_inscription_puis_login_insensible_a_la_casse(self):
        api = APIClient()
        rep = api.post('/api/auth/register/client', {'email': 'Jean@X.cm', 'password': 'secret123'}, format='json')
        self.assertEqual(rep.status_code, 201)
        self.assertEqual(api.post('/api/auth/register/client', {'email': 'jean@x.cm', 'password': 'secret123'}, format='json').status_code, 400)
        rep = api.post('/api/auth/login', {'email': 'Jean@X.cm', 'password': 'secret123'}, format='json')
        self.assertEqual(rep.status_code, 200)


class RetraitAdminTests(BaseAudit):
    def test_double_approbation_ne_relance_pas_le_versement(self):
        admin = User.objects.create_user(username='admin', password='x', role='admin')
        retrait = RetraitFonds.objects.create(restaurant=self.resto, montant=2000, numero_compte='690000000')
        web = Client()
        web.force_login(admin)
        with patch('core.views.finances.executer_retrait', wraps=__import__('core.payout', fromlist=['x']).executer_retrait) as ex:
            web.post('/admin-panel/finances/retraits/', {'retrait_id': retrait.pk, 'action': 'approuver'})
            web.post('/admin-panel/finances/retraits/', {'retrait_id': retrait.pk, 'action': 'approuver'})
        self.assertEqual(ex.call_count, 1)
        retrait.refresh_from_db()
        self.assertEqual(retrait.statut, 'approuve')


class XssScriptJsonTests(TestCase):
    def test_json_pour_script_neutralise_la_fermeture_de_balise(self):
        from core.utils.json_script import json_pour_script
        sortie = json_pour_script({'adresse': '</script><script>alert(1)</script>'})
        self.assertNotIn('</script', sortie.lower())
        self.assertEqual(json.loads(sortie)['adresse'], '</script><script>alert(1)</script>')


class RetraitRestaurantTests(BaseAudit):
    def test_deux_demandes_ne_depassent_pas_le_solde(self):
        Commande.objects.create(
            client=self.client_user, restaurant=self.resto, statut='livree',
            montant_total=6000, montant_restaurant=5000, paiement_confirme=True,
        )
        web = Client()
        web.force_login(self.patron)
        for _ in range(2):
            web.post('/admin-panel/resto/finances/', {'montant': 3000, 'numero_compte': '690000000'})
        self.assertEqual(RetraitFonds.objects.filter(restaurant=self.resto).count(), 1)


class PaiementConfirmeParDefautTests(BaseAudit):
    def test_une_commande_creee_sans_valeur_n_est_pas_payee(self):
        commande = Commande.objects.create(client=self.client_user, restaurant=self.resto, montant_total=1)
        self.assertFalse(commande.paiement_confirme)


class SuppressionCompteTests(BaseAudit):
    def setUp(self):
        super().setUp()
        from core.models import AdresseLivraison
        self.client_user.email = 'c@x.cm'
        self.client_user.telephone = '690000000'
        self.client_user.first_name = 'Jean'
        self.client_user.save()
        AdresseLivraison.objects.create(client=self.client_user, adresse='Akwa', latitude=4, longitude=9)
        self.commande.adresse_livraison = 'Rue 12, Akwa'
        self.commande.statut = 'livree'
        self.commande.paiement_confirme = True
        self.commande.save()
        self.txn = Transaction.objects.create(commande=self.commande, type='paiement_client', montant=5000,
                                              mode_paiement='mtn_money', statut='complete')

    def test_mauvais_mot_de_passe_refuse(self):
        rep = self.api.post('/api/client/compte/supprimer', {'password': 'faux'}, format='json')
        self.assertEqual(rep.status_code, 400)
        self.client_user.refresh_from_db()
        self.assertTrue(self.client_user.is_active)

    def test_suppression_anonymise_et_garde_l_historique(self):
        from core.models import AdresseLivraison
        rep = self.api.post('/api/client/compte/supprimer', {'password': 'x'}, format='json')
        self.assertEqual(rep.status_code, 204)
        self.client_user.refresh_from_db()
        self.assertFalse(self.client_user.is_active)
        self.assertEqual((self.client_user.email, self.client_user.telephone, self.client_user.first_name), ('', '', ''))
        self.assertFalse(AdresseLivraison.objects.filter(client=self.client_user).exists())
        self.commande.refresh_from_db()
        self.assertEqual(self.commande.adresse_livraison, '')
        self.assertTrue(Transaction.objects.filter(pk=self.txn.pk).exists())
        # Le jeton déjà émis ne fonctionne plus et on ne peut plus se connecter.
        api = APIClient()
        self.assertEqual(api.post('/api/auth/login', {'email': 'c@x.cm', 'password': 'x'}, format='json').status_code, 401)

    def test_jwt_existant_refuse_apres_suppression(self):
        tok = APIClient().post('/api/auth/login', {'email': 'c', 'password': 'x'}, format='json').json()['token']
        self.api.post('/api/client/compte/supprimer', {'password': 'x'}, format='json')
        api = APIClient()
        api.credentials(HTTP_AUTHORIZATION=f'Bearer {tok}')
        self.assertEqual(api.get('/api/client/profile').status_code, 401)

    def test_commande_en_cours_bloque_la_suppression(self):
        self.commande.statut = 'en_livraison'
        self.commande.save()
        rep = self.api.post('/api/client/compte/supprimer', {'password': 'x'}, format='json')
        self.assertEqual(rep.status_code, 409)

    def test_pages_legales_publiques(self):
        web = Client()
        self.assertContains(web.get('/confidentialite/'), 'Politique de confidentialité')
        self.assertContains(web.get('/compte/suppression/'), 'Supprimer mon compte')


class SuppressionCompteDemoTests(TestCase):
    def test_compte_demo_non_supprimable(self):
        demo = User.objects.create_user(username='client@menu.cm', email='client@menu.cm', password='client123', role='client')
        api = APIClient()
        api.force_authenticate(demo)
        self.assertEqual(api.post('/api/client/compte/supprimer', {'password': 'client123'}, format='json').status_code, 409)
        demo.refresh_from_db()
        self.assertTrue(demo.is_active)
