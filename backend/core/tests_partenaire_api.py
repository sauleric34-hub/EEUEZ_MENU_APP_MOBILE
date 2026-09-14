"""API Partenaires : candidature KYB, authentification par clé signée HMAC,
catalogue, création de commande (idempotence incluse) et webhooks sortants.
"""
import hashlib
import hmac
import json
import time
from unittest.mock import patch

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone as django_timezone

from core.models import (
    Categorie, Commande, DocumentKYB, Partenaire, Plat, RestaurantProfile, User,
)
from core.models_partenaire import (
    APICredential, PLAN_BUSINESS, PLAN_CROISSANCE, PLAN_DECOUVERTE, PLANS,
    PartenaireWebhookConfig, WebhookDelivery,
)

RESTO = (4.0, 9.0)


def _signer(secret, method, path, body_bytes=b''):
    timestamp = int(time.time())
    body_hash = hashlib.sha256(body_bytes).hexdigest()
    message = f'{timestamp}|{method}|{path}|{body_hash}'
    signature = hmac.new(secret.encode('utf-8'), message.encode('utf-8'), hashlib.sha256).hexdigest()
    return timestamp, signature


def _headers(api_key, secret, method, path, body_bytes=b''):
    timestamp, signature = _signer(secret, method, path, body_bytes)
    return {
        'HTTP_X_EEUEZ_KEY': api_key,
        'HTTP_X_EEUEZ_TIMESTAMP': str(timestamp),
        'HTTP_X_EEUEZ_SIGNATURE': signature,
    }


class PartenaireApiTestCase(TestCase):
    def setUp(self):
        cat = Categorie.objects.create(nom='Plats')
        patron = User.objects.create_user(username='resto', password='x', role='restaurant')
        self.resto = RestaurantProfile.objects.create(
            user=patron, nom='Chez Test', ville='Douala', adresse='Rue A',
            is_verified=True, is_open=True, frais_livraison=700,
            latitude=RESTO[0], longitude=RESTO[1], plats_a_emporter_actifs=True,
        )
        self.plat = Plat.objects.create(
            restaurant=self.resto, categorie=cat, nom='Ndolé', prix=2000,
            frais_livraison=500, is_available=True, is_visible=True,
        )
        self.admin = User.objects.create_user(username='admin', password='x', role='admin')

        self.partenaire = Partenaire.objects.create(
            nom_commercial='SuperApp', contact_nom='Jean', contact_email='jean@superapp.cm',
            description_cas_usage="Revente du catalogue dans notre appli.",
            statut=Partenaire.STATUT_APPROUVE, plan=PLAN_BUSINESS,
        )
        self.credential, self.secret = APICredential.emettre(self.partenaire, environnement=APICredential.ENV_SANDBOX)

    # ─── Candidature KYB ──────────────────────────────────────
    def test_candidature_cree_partenaire_en_attente(self):
        resp = self.client.post(reverse('partners:apply'), {
            'nom_commercial': 'Nouvo', 'contact_nom': 'Awa', 'contact_email': 'awa@nouvo.cm',
            'description_cas_usage': 'Marketplace multi-restaurants.',
        })
        self.assertEqual(resp.status_code, 201)
        p = Partenaire.objects.get(nom_commercial='Nouvo')
        self.assertEqual(p.statut, Partenaire.STATUT_EN_ATTENTE)

    def test_candidature_incomplete_rejetee(self):
        resp = self.client.post(reverse('partners:apply'), {'nom_commercial': 'Incomplet'})
        self.assertEqual(resp.status_code, 400)

    def test_document_extension_non_autorisee_rejete(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        resp = self.client.post(reverse('partners:apply'), {
            'nom_commercial': 'BadFile', 'contact_nom': 'X', 'contact_email': 'x@bad.cm',
            'description_cas_usage': 'test',
            'fichier_rccm': SimpleUploadedFile('malware.exe', b'MZ'),
        })
        self.assertEqual(resp.status_code, 400)
        self.assertFalse(Partenaire.objects.filter(nom_commercial='BadFile').exists())

    def test_document_trop_volumineux_rejete(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        gros_fichier = SimpleUploadedFile('rccm.pdf', b'0' * (11 * 1024 * 1024))
        resp = self.client.post(reverse('partners:apply'), {
            'nom_commercial': 'TropGros', 'contact_nom': 'X', 'contact_email': 'x@gros.cm',
            'description_cas_usage': 'test',
            'fichier_rccm': gros_fichier,
        })
        self.assertEqual(resp.status_code, 400)
        self.assertFalse(Partenaire.objects.filter(nom_commercial='TropGros').exists())

    def test_page_documentation_publique_accessible(self):
        resp = self.client.get(reverse('partenaire-documentation'))
        self.assertEqual(resp.status_code, 200)
        self.assertContains(resp, 'X-EEUEZ-Signature')

    def test_candidature_pays_par_defaut_cameroun(self):
        resp = self.client.post(reverse('partners:apply'), {
            'nom_commercial': 'SansPays', 'contact_nom': 'X', 'contact_email': 'x@sanspays.cm',
            'description_cas_usage': 'test',
        })
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(Partenaire.objects.get(nom_commercial='SansPays').pays, 'Cameroun')

    def test_candidature_pays_personnalise(self):
        resp = self.client.post(reverse('partners:apply'), {
            'nom_commercial': 'Etranger', 'contact_nom': 'X', 'contact_email': 'x@etranger.ci',
            'description_cas_usage': 'test', 'pays': "Côte d'Ivoire",
        })
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(Partenaire.objects.get(nom_commercial='Etranger').pays, "Côte d'Ivoire")

    def test_schema_openapi_generable(self):
        resp = self.client.get(reverse('partners:schema') + '?format=json')
        self.assertEqual(resp.status_code, 200)
        self.assertIn('openapi', resp.json())

    def test_swagger_ui_accessible(self):
        resp = self.client.get(reverse('partners:swagger-ui'))
        self.assertEqual(resp.status_code, 200)

    def test_redoc_accessible(self):
        resp = self.client.get(reverse('partners:redoc'))
        self.assertEqual(resp.status_code, 200)

    def test_formulaire_web_public_cree_partenaire(self):
        resp = self.client.post(reverse('partenaire-candidature'), {
            'nom_commercial': 'WebCo', 'contact_nom': 'Marc', 'contact_email': 'marc@webco.cm',
            'description_cas_usage': 'Prise de commande in-app.',
        })
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(Partenaire.objects.filter(nom_commercial='WebCo').exists())

    # ─── Authentification signée ──────────────────────────────
    def test_signature_valide_donne_acces_catalogue(self):
        path = reverse('partners:restaurants')
        headers = _headers(self.credential.api_key, self.secret, 'GET', path)
        resp = self.client.get(path, **headers)
        self.assertEqual(resp.status_code, 200)
        noms = [r['nom'] for r in resp.json()]
        self.assertIn('Chez Test', noms)
        # Champs personnalisés jamais exposés à un partenaire.
        self.assertNotIn('is_following', resp.json()[0])

    def test_plat_serializer_partenaire_exclut_champs_personnalises(self):
        path = reverse('partners:plats')
        headers = _headers(self.credential.api_key, self.secret, 'GET', path)
        resp = self.client.get(path, **headers)
        self.assertEqual(resp.status_code, 200)
        plat = resp.json()[0]
        self.assertNotIn('ma_note', plat)
        self.assertNotIn('est_favori', plat)
        self.assertIn('prix_client', plat)

    def test_signature_invalide_refusee(self):
        path = reverse('partners:restaurants')
        resp = self.client.get(path, HTTP_X_EEUEZ_KEY=self.credential.api_key,
                                HTTP_X_EEUEZ_TIMESTAMP=str(int(time.time())),
                                HTTP_X_EEUEZ_SIGNATURE='0' * 64)
        self.assertEqual(resp.status_code, 401)

    def test_cle_inconnue_refusee(self):
        path = reverse('partners:restaurants')
        headers = _headers('pk_sandbox_inconnue', 'peu-importe', 'GET', path)
        resp = self.client.get(path, **headers)
        self.assertEqual(resp.status_code, 401)

    def test_timestamp_perime_refuse(self):
        path = reverse('partners:restaurants')
        body_hash = hashlib.sha256(b'').hexdigest()
        vieux_timestamp = int(time.time()) - 3600
        message = f'{vieux_timestamp}|GET|{path}|{body_hash}'
        signature = hmac.new(self.secret.encode(), message.encode(), hashlib.sha256).hexdigest()
        resp = self.client.get(
            path, HTTP_X_EEUEZ_KEY=self.credential.api_key,
            HTTP_X_EEUEZ_TIMESTAMP=str(vieux_timestamp), HTTP_X_EEUEZ_SIGNATURE=signature,
        )
        self.assertEqual(resp.status_code, 401)

    def test_partenaire_suspendu_perd_acces_meme_cle_active(self):
        self.partenaire.suspendre(self.admin, 'Abus détecté')
        path = reverse('partners:restaurants')
        headers = _headers(self.credential.api_key, self.secret, 'GET', path)
        resp = self.client.get(path, **headers)
        self.assertEqual(resp.status_code, 401)

    def test_cle_revoquee_refusee(self):
        self.credential.revoquer()
        path = reverse('partners:restaurants')
        headers = _headers(self.credential.api_key, self.secret, 'GET', path)
        resp = self.client.get(path, **headers)
        self.assertEqual(resp.status_code, 401)

    # ─── Création de commande ─────────────────────────────────
    def _poster_commande(self, reference_externe, restaurant_id=None, mode_paiement='especes', emporter=True):
        path = reverse('partners:commandes')
        payload = {
            'restaurant': restaurant_id or self.resto.id,
            'reference_externe': reference_externe,
            'items': [{'plat_id': self.plat.id, 'quantite': 2}],
            'emporter': emporter,
            'mode_paiement': mode_paiement,
        }
        body = json.dumps(payload).encode('utf-8')
        headers = _headers(self.credential.api_key, self.secret, 'POST', path, body)
        return self.client.post(path, data=body, content_type='application/json', **headers)

    def test_creation_commande_reussie(self):
        resp = self._poster_commande('ext-001')
        self.assertEqual(resp.status_code, 201, resp.content)
        data = resp.json()
        self.assertEqual(data['reference_externe'], 'ext-001')
        self.assertNotIn('commission_eeuez', data)
        self.assertNotIn('montant_restaurant', data)
        commande = Commande.objects.get(reference_externe='ext-001')
        self.assertEqual(commande.partenaire_id, self.partenaire.id)
        self.assertIsNone(commande.client)

    def test_reference_externe_obligatoire(self):
        path = reverse('partners:commandes')
        payload = {'restaurant': self.resto.id, 'items': [{'plat_id': self.plat.id, 'quantite': 1}], 'emporter': True}
        body = json.dumps(payload).encode('utf-8')
        headers = _headers(self.credential.api_key, self.secret, 'POST', path, body)
        resp = self.client.post(path, data=body, content_type='application/json', **headers)
        self.assertEqual(resp.status_code, 400)

    def test_idempotence_meme_reference_ne_duplique_pas(self):
        premiere = self._poster_commande('ext-002')
        self.assertEqual(premiere.status_code, 201)
        deuxieme = self._poster_commande('ext-002')
        self.assertEqual(deuxieme.status_code, 200)
        self.assertEqual(premiere.json()['id'], deuxieme.json()['id'])
        self.assertEqual(Commande.objects.filter(reference_externe='ext-002').count(), 1)

    def test_mode_paiement_autre_que_especes_refuse(self):
        resp = self._poster_commande('ext-003', mode_paiement='mtn_money')
        self.assertEqual(resp.status_code, 400)

    def test_restaurant_ferme_renvoie_motif_stable(self):
        self.resto.is_open = False
        self.resto.save(update_fields=['is_open'])
        resp = self._poster_commande('ext-004')
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.json()['motif'], 'ferme')

    def test_commande_detail_isolee_par_partenaire(self):
        self._poster_commande('ext-005')
        commande = Commande.objects.get(reference_externe='ext-005')
        autre_partenaire = Partenaire.objects.create(
            nom_commercial='Autre', contact_nom='X', contact_email='x@x.cm',
            description_cas_usage='x', statut=Partenaire.STATUT_APPROUVE,
        )
        autre_credential, autre_secret = APICredential.emettre(autre_partenaire)
        path = reverse('partners:commande-detail', args=[commande.id])
        headers = _headers(autre_credential.api_key, autre_secret, 'GET', path)
        resp = self.client.get(path, **headers)
        self.assertEqual(resp.status_code, 404)

    # ─── Webhooks sortants ─────────────────────────────────────
    @patch('core.partner_webhooks.http_requests.post')
    def test_changement_statut_declenche_webhook_signe(self, mock_post):
        mock_post.return_value.ok = True
        mock_post.return_value.status_code = 200

        PartenaireWebhookConfig.configurer(self.partenaire, 'https://superapp.cm/webhooks/eeuez')
        resp = self._poster_commande('ext-006')
        self.assertEqual(resp.status_code, 201)
        commande = Commande.objects.get(reference_externe='ext-006')

        mock_post.reset_mock()
        commande.statut = 'acceptee'
        commande.save()

        self.assertTrue(mock_post.called)
        appel = mock_post.call_args
        self.assertEqual(appel.args[0], 'https://superapp.cm/webhooks/eeuez')
        self.assertIn('X-EEUEZ-Signature', appel.kwargs['headers'])
        self.assertEqual(appel.kwargs['json']['statut'], 'acceptee')
        self.assertTrue(WebhookDelivery.objects.filter(commande=commande, statut_envoi='envoye').exists())

    @patch('core.partner_webhooks.http_requests.post')
    def test_pas_de_webhook_sans_configuration(self, mock_post):
        self._poster_commande('ext-007')
        commande = Commande.objects.get(reference_externe='ext-007')
        commande.statut = 'acceptee'
        commande.save()
        mock_post.assert_not_called()

    # ─── Plans tarifaires et quotas ────────────────────────────
    def test_plan_decouverte_ne_permet_pas_creation_commande(self):
        self.partenaire.plan = 'decouverte'
        self.partenaire.save(update_fields=['plan'])
        resp = self._poster_commande('ext-plan-1')
        self.assertEqual(resp.status_code, 403)

    def test_plan_decouverte_permet_toujours_la_lecture_catalogue(self):
        self.partenaire.plan = 'decouverte'
        self.partenaire.save(update_fields=['plan'])
        path = reverse('partners:restaurants')
        headers = _headers(self.credential.api_key, self.secret, 'GET', path)
        resp = self.client.get(path, **headers)
        self.assertEqual(resp.status_code, 200)

    def test_quota_mensuel_depasse_bloque_les_requetes(self):
        self.credential.requetes_mois_courant = 999999
        self.credential.mois_courant = django_timezone.now().date().replace(day=1)
        self.credential.save(update_fields=['requetes_mois_courant', 'mois_courant'])
        path = reverse('partners:restaurants')
        headers = _headers(self.credential.api_key, self.secret, 'GET', path)
        resp = self.client.get(path, **headers)
        self.assertEqual(resp.status_code, 429)

    def test_compteur_usage_incremente_a_chaque_requete_authentifiee(self):
        path = reverse('partners:restaurants')
        headers = _headers(self.credential.api_key, self.secret, 'GET', path)
        self.client.get(path, **headers)
        self.credential.refresh_from_db()
        self.assertEqual(self.credential.requetes_mois_courant, 1)

    def test_grille_tarifaire_validee(self):
        # Fige la grille discutée avec l'équipe business — un changement ici
        # doit être délibéré, pas un effet de bord d'une autre modification.
        self.assertEqual(PLANS[PLAN_DECOUVERTE]['prix_mensuel_fcfa'], 0)
        self.assertEqual(PLANS[PLAN_DECOUVERTE]['commission_pourcentage'], 0)
        self.assertFalse(PLANS[PLAN_DECOUVERTE]['ecriture_commandes'])

        self.assertEqual(PLANS[PLAN_CROISSANCE]['prix_mensuel_fcfa'], 0)
        self.assertEqual(PLANS[PLAN_CROISSANCE]['commission_pourcentage'], 1)
        self.assertIsNone(PLANS[PLAN_CROISSANCE]['quota_requetes_mois'])  # illimité
        self.assertTrue(PLANS[PLAN_CROISSANCE]['ecriture_commandes'])
        self.assertFalse(PLANS[PLAN_CROISSANCE]['webhooks'])

        self.assertEqual(PLANS[PLAN_BUSINESS]['prix_mensuel_fcfa'], 50000)
        self.assertEqual(PLANS[PLAN_BUSINESS]['quota_requetes_mois'], 50000)
        self.assertEqual(PLANS[PLAN_BUSINESS]['commission_pourcentage'], 0)

    def test_commission_calculee_et_figee_sur_plan_croissance(self):
        self.partenaire.plan = PLAN_CROISSANCE
        self.partenaire.save(update_fields=['plan'])
        resp = self._poster_commande('ext-commission-1')
        self.assertEqual(resp.status_code, 201)
        commande = Commande.objects.get(reference_externe='ext-commission-1')
        # 2 x Ndolé à prix_client (voir setUp / checkout_groupe) : 1 % arrondi.
        attendu = round(int(commande.montant_total) * 1 / 100)
        self.assertEqual(int(commande.commission_partenaire), attendu)
        self.assertGreater(commande.commission_partenaire, 0)
        # Jamais exposée au partenaire dans la réponse.
        self.assertNotIn('commission_partenaire', resp.json())

    def test_aucune_commission_sur_plan_business(self):
        # self.partenaire est déjà en plan Business (setUp).
        resp = self._poster_commande('ext-commission-2')
        commande = Commande.objects.get(reference_externe='ext-commission-2')
        self.assertEqual(int(commande.commission_partenaire), 0)
        self.assertEqual(resp.status_code, 201)

    def test_credential_live_refuse_pour_plan_sans_live(self):
        self.partenaire.plan = 'decouverte'
        self.partenaire.save(update_fields=['plan'])
        credential_live, secret_live = APICredential.emettre(self.partenaire, environnement=APICredential.ENV_LIVE)
        path = reverse('partners:restaurants')
        headers = _headers(credential_live.api_key, secret_live, 'GET', path)
        resp = self.client.get(path, **headers)
        self.assertEqual(resp.status_code, 401)

    @patch('core.partner_webhooks.http_requests.post')
    def test_re_sauvegarde_sans_changement_statut_ne_notifie_pas(self, mock_post):
        PartenaireWebhookConfig.configurer(self.partenaire, 'https://superapp.cm/webhooks/eeuez')
        self._poster_commande('ext-008')
        commande = Commande.objects.get(reference_externe='ext-008')
        mock_post.reset_mock()
        commande.notes = 'note ajoutée sans changer le statut'
        commande.save()
        mock_post.assert_not_called()


class KYBAdminTestCase(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(username='admin', password='x', role='admin')
        self.client.force_login(self.admin)
        self.partenaire = Partenaire.objects.create(
            nom_commercial='Candidat', contact_nom='Awa', contact_email='awa@candidat.cm',
            description_cas_usage="Test d'intégration.",
        )

    def test_liste_et_detail_accessibles(self):
        resp = self.client.get(reverse('core:partenaires_list'))
        self.assertEqual(resp.status_code, 200)
        resp = self.client.get(reverse('core:partenaire_detail', args=[self.partenaire.id]))
        self.assertEqual(resp.status_code, 200)

    def test_non_admin_bloque(self):
        client_user = User.objects.create_user(username='client1', password='x', role='client')
        self.client.force_login(client_user)
        resp = self.client.get(reverse('core:partenaires_list'))
        self.assertEqual(resp.status_code, 302)  # redirigé vers login

    def test_approbation_puis_emission_de_cle(self):
        resp = self.client.post(reverse('core:partenaire_decider', args=[self.partenaire.id]), {'action': 'approuver'})
        self.assertEqual(resp.status_code, 302)
        self.partenaire.refresh_from_db()
        self.assertEqual(self.partenaire.statut, Partenaire.STATUT_APPROUVE)

        resp = self.client.post(reverse('core:partenaire_credential_emettre', args=[self.partenaire.id]), {'environnement': 'sandbox'})
        self.assertEqual(resp.status_code, 302)
        self.assertEqual(APICredential.objects.filter(partenaire=self.partenaire).count(), 1)

    def test_rejet_sans_motif_refuse(self):
        self.client.post(reverse('core:partenaire_decider', args=[self.partenaire.id]), {'action': 'rejeter'})
        self.partenaire.refresh_from_db()
        self.assertEqual(self.partenaire.statut, Partenaire.STATUT_EN_ATTENTE)

    def test_emission_de_cle_refusee_si_non_approuve(self):
        self.client.post(reverse('core:partenaire_credential_emettre', args=[self.partenaire.id]), {'environnement': 'sandbox'})
        self.assertEqual(APICredential.objects.filter(partenaire=self.partenaire).count(), 0)

    def test_emission_cle_live_refusee_pour_plan_decouverte(self):
        self.partenaire.approuver(self.admin)  # plan par défaut = 'decouverte'
        self.client.post(reverse('core:partenaire_credential_emettre', args=[self.partenaire.id]), {'environnement': 'live'})
        self.assertFalse(APICredential.objects.filter(partenaire=self.partenaire, environnement='live').exists())

    def test_emission_cle_live_autorisee_pour_plan_business(self):
        self.partenaire.approuver(self.admin)
        self.partenaire.plan = PLAN_BUSINESS
        self.partenaire.save(update_fields=['plan'])
        self.client.post(reverse('core:partenaire_credential_emettre', args=[self.partenaire.id]), {'environnement': 'live'})
        self.assertTrue(APICredential.objects.filter(partenaire=self.partenaire, environnement='live').exists())

    def test_webhook_refuse_pour_plan_sans_webhooks(self):
        self.partenaire.approuver(self.admin)  # plan 'decouverte' → pas de webhooks
        self.client.post(reverse('core:partenaire_webhook_configurer', args=[self.partenaire.id]), {'url': 'https://x.cm/hook'})
        self.assertFalse(PartenaireWebhookConfig.objects.filter(partenaire=self.partenaire).exists())

    def test_changement_de_plan(self):
        resp = self.client.post(reverse('core:partenaire_plan_changer', args=[self.partenaire.id]), {'plan': PLAN_BUSINESS})
        self.assertEqual(resp.status_code, 302)
        self.partenaire.refresh_from_db()
        self.assertEqual(self.partenaire.plan, PLAN_BUSINESS)

    def test_page_cles_api_accessible(self):
        APICredential.emettre(self.partenaire)
        resp = self.client.get(reverse('core:partenaire_api_keys_list'))
        self.assertEqual(resp.status_code, 200)

    def test_document_kyb_non_servi_par_media_public(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        doc = DocumentKYB.objects.create(
            partenaire=self.partenaire, type_document=DocumentKYB.TYPE_RCCM,
            fichier=SimpleUploadedFile('cni.pdf', b'contenu-sensible'),
        )
        # Le chemin stocké ne doit jamais tomber sous MEDIA_ROOT.
        from django.conf import settings
        self.assertNotIn(str(settings.MEDIA_ROOT), doc.fichier.path)
        # Et la route média publique ne le sert donc pas.
        resp = self.client.get(f'/media/{doc.fichier.name}')
        self.assertEqual(resp.status_code, 404)
        # Alors que la vue admin dédiée le sert bien.
        resp = self.client.get(reverse('core:partenaire_document_telecharger', args=[doc.id]))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(b''.join(resp.streaming_content), b'contenu-sensible')
