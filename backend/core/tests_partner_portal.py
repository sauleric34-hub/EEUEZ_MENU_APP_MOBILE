"""Portail self-service partenaire : connexion, tableau de bord, gestion des
clés API et du webhook par le partenaire lui-même (sans passer par l'admin)."""

from django.test import TestCase
from django.urls import reverse

from core.models import Partenaire
from core.models_partenaire import APICredential, PLAN_BUSINESS, PLAN_CROISSANCE, PLAN_DECOUVERTE


class PortailPartenaireTestCase(TestCase):
    def setUp(self):
        self.partenaire = Partenaire.objects.create(
            nom_commercial='SuperApp', contact_nom='Jean', contact_email='jean@superapp.cm',
            description_cas_usage="Revente du catalogue.", statut=Partenaire.STATUT_APPROUVE,
            plan=PLAN_BUSINESS,
        )
        self.partenaire.definir_mot_de_passe('motdepasse123')

    def _login(self):
        return self.client.post(reverse('partner_portal:login'), {
            'email': 'jean@superapp.cm', 'password': 'motdepasse123',
        })

    def test_connexion_reussie_redirige_vers_tableau_de_bord(self):
        resp = self._login()
        self.assertRedirects(resp, reverse('partner_portal:dashboard'))

    def test_connexion_mauvais_mot_de_passe_refusee(self):
        resp = self.client.post(reverse('partner_portal:login'), {
            'email': 'jean@superapp.cm', 'password': 'mauvais',
        })
        self.assertEqual(resp.status_code, 200)  # ré-affiche le formulaire
        self.assertFalse('_auth_user_id' in self.client.session)

    def test_connexion_partenaire_non_approuve_refusee(self):
        self.partenaire.statut = Partenaire.STATUT_EN_ATTENTE
        self.partenaire.save(update_fields=['statut'])
        resp = self._login()
        self.assertEqual(resp.status_code, 200)

    def test_dashboard_inaccessible_sans_connexion(self):
        resp = self.client.get(reverse('partner_portal:dashboard'))
        self.assertRedirects(resp, reverse('partner_portal:login'))

    def test_dashboard_accessible_apres_connexion(self):
        self._login()
        resp = self.client.get(reverse('partner_portal:dashboard'))
        self.assertEqual(resp.status_code, 200)
        self.assertContains(resp, 'Business')

    def test_emission_de_cle_depuis_le_portail(self):
        self._login()
        resp = self.client.post(reverse('partner_portal:cles'), {'action': 'emettre', 'environnement': 'sandbox'})
        self.assertEqual(resp.status_code, 302)
        self.assertEqual(APICredential.objects.filter(partenaire=self.partenaire).count(), 1)

    def test_emission_cle_live_refusee_si_plan_ne_le_permet_pas(self):
        self.partenaire.plan = PLAN_DECOUVERTE
        self.partenaire.save(update_fields=['plan'])
        self._login()
        self.client.post(reverse('partner_portal:cles'), {'action': 'emettre', 'environnement': 'live'})
        self.assertFalse(APICredential.objects.filter(partenaire=self.partenaire, environnement='live').exists())

    def test_revocation_de_cle_depuis_le_portail(self):
        credential, _secret = APICredential.emettre(self.partenaire)
        self._login()
        self.client.post(reverse('partner_portal:cles'), {'action': 'revoquer', 'credential_id': credential.pk})
        credential.refresh_from_db()
        self.assertEqual(credential.statut, APICredential.STATUT_REVOQUEE)

    def test_configuration_webhook_depuis_le_portail(self):
        self._login()
        resp = self.client.post(reverse('partner_portal:webhook'), {'url': 'https://superapp.cm/hook'})
        self.assertEqual(resp.status_code, 302)
        self.partenaire.refresh_from_db()
        self.assertEqual(self.partenaire.webhook.url, 'https://superapp.cm/hook')

    def test_webhook_refuse_si_plan_ne_l_inclut_pas(self):
        self.partenaire.plan = PLAN_CROISSANCE  # pas de webhooks sur ce plan
        self.partenaire.save(update_fields=['plan'])
        self._login()
        self.client.post(reverse('partner_portal:webhook'), {'url': 'https://superapp.cm/hook'})
        self.assertFalse(hasattr(self.partenaire, 'webhook'))

    def test_changement_de_mot_de_passe(self):
        self._login()
        resp = self.client.post(reverse('partner_portal:changer_mot_de_passe'), {
            'actuel': 'motdepasse123', 'nouveau': 'nouveaumdp1', 'confirmation': 'nouveaumdp1',
        })
        self.assertEqual(resp.status_code, 302)
        self.partenaire.refresh_from_db()
        self.assertTrue(self.partenaire.verifier_mot_de_passe('nouveaumdp1'))
        self.assertFalse(self.partenaire.verifier_mot_de_passe('motdepasse123'))

    def test_deconnexion(self):
        self._login()
        self.client.get(reverse('partner_portal:logout'))
        resp = self.client.get(reverse('partner_portal:dashboard'))
        self.assertRedirects(resp, reverse('partner_portal:login'))


class AdminMotDePasseTestCase(TestCase):
    def setUp(self):
        from core.models import User
        self.admin = User.objects.create_user(username='admin', password='x', role='admin')
        self.client.force_login(self.admin)
        self.partenaire = Partenaire.objects.create(
            nom_commercial='Candidat', contact_nom='Awa', contact_email='awa@candidat.cm',
            description_cas_usage="Test.", statut=Partenaire.STATUT_APPROUVE,
        )

    def test_admin_genere_un_mot_de_passe_portail(self):
        self.assertEqual(self.partenaire.mot_de_passe_hash, '')
        resp = self.client.post(reverse('core:partenaire_mot_de_passe_generer', args=[self.partenaire.pk]))
        self.assertEqual(resp.status_code, 302)
        self.partenaire.refresh_from_db()
        self.assertNotEqual(self.partenaire.mot_de_passe_hash, '')

    def test_refuse_si_partenaire_non_approuve(self):
        self.partenaire.statut = Partenaire.STATUT_EN_ATTENTE
        self.partenaire.save(update_fields=['statut'])
        self.client.post(reverse('core:partenaire_mot_de_passe_generer', args=[self.partenaire.pk]))
        self.partenaire.refresh_from_db()
        self.assertEqual(self.partenaire.mot_de_passe_hash, '')
