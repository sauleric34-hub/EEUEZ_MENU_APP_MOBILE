"""Tests des compléments de plats : choix unique par groupe et tarification."""

from django.contrib.auth import get_user_model
from django.test import TestCase, Client
from rest_framework.test import APIClient

from core.models import (
    RestaurantProfile, Plat, Categorie, Commande,
    GroupeComplement, OptionComplement, ElementInclus, ChoixLigneCommande,
)

User = get_user_model()


class ComplementsTests(TestCase):
    def setUp(self):
        patron = User.objects.create_user(username='r@r.cm', password='x', role='restaurant')
        self.resto = RestaurantProfile.objects.create(
            user=patron, nom='Test', ville='Douala', adresse='Akwa',
            is_verified=True, is_open=True, frais_livraison=500,
        )
        self.client_user = User.objects.create_user(
            username='c@c.cm', email='c@c.cm', password='pass1234', role='client',
        )
        categorie = Categorie.objects.create(nom='Plats')
        self.plat = Plat.objects.create(
            restaurant=self.resto, categorie=categorie, nom='Poulet DG', prix=4000,
            frais_livraison=500, is_available=True, is_visible=True,
        )

        # Groupe payant, obligatoire
        self.accompagnement = GroupeComplement.objects.create(
            plat=self.plat, nom='Accompagnement', obligatoire=True,
        )
        self.riz = OptionComplement.objects.create(
            groupe=self.accompagnement, nom='Riz', supplement=0,
        )
        self.frites = OptionComplement.objects.create(
            groupe=self.accompagnement, nom='Frites', supplement=500,
        )

        # Groupe facultatif
        self.boisson = GroupeComplement.objects.create(
            plat=self.plat, nom='Boisson', obligatoire=False,
        )
        self.jus = OptionComplement.objects.create(
            groupe=self.boisson, nom='Jus', supplement=1000,
        )

        ElementInclus.objects.create(plat=self.plat, nom='Servi avec du pain')

        self.api = APIClient()
        self.api.force_authenticate(user=self.client_user)

    def _commander(self, complements):
        return self.api.post('/api/client/commandes/', {
            'restaurant': self.resto.pk,
            'adresse_livraison': 'Akwa',
            'items': [{'plat_id': self.plat.pk, 'quantite': 1, 'complements': complements}],
        }, format='json')

    # ── Tarification ────────────────────────────────────────
    def test_option_gratuite_ne_change_pas_le_prix(self):
        reponse = self._commander([self.riz.pk])
        self.assertEqual(reponse.status_code, 201)
        ligne = Commande.objects.get(pk=reponse.data['id']).lignes.first()
        self.assertEqual(int(ligne.prix_unitaire), self.plat.prix_client)

    def test_option_payante_augmente_le_prix(self):
        reponse = self._commander([self.frites.pk])
        self.assertEqual(reponse.status_code, 201)
        ligne = Commande.objects.get(pk=reponse.data['id']).lignes.first()
        self.assertEqual(int(ligne.prix_unitaire), self.plat.prix_client + 500)

    def test_plusieurs_groupes_cumulent_leurs_suppléments(self):
        reponse = self._commander([self.frites.pk, self.jus.pk])
        self.assertEqual(reponse.status_code, 201)
        ligne = Commande.objects.get(pk=reponse.data['id']).lignes.first()
        self.assertEqual(int(ligne.prix_unitaire), self.plat.prix_client + 1500)

    def test_le_supplement_suit_la_quantite(self):
        reponse = self.api.post('/api/client/commandes/', {
            'restaurant': self.resto.pk, 'adresse_livraison': 'Akwa',
            'items': [{'plat_id': self.plat.pk, 'quantite': 3,
                       'complements': [self.frites.pk]}],
        }, format='json')
        commande = Commande.objects.get(pk=reponse.data['id'])
        attendu = (self.plat.prix_client + 500) * 3 + 500  # + frais de livraison
        self.assertEqual(int(commande.montant_total), attendu)

    # ── Sécurité ────────────────────────────────────────────
    def test_un_prix_envoye_par_le_client_est_ignore(self):
        """Le supplément vient de la base, jamais de la requête."""
        reponse = self.api.post('/api/client/commandes/', {
            'restaurant': self.resto.pk, 'adresse_livraison': 'Akwa',
            'items': [{
                'plat_id': self.plat.pk, 'quantite': 1,
                'complements': [self.frites.pk],
                'supplement': 0,          # tentative de passer les frites gratuitement
                'prix_unitaire': 1,
            }],
        }, format='json')
        ligne = Commande.objects.get(pk=reponse.data['id']).lignes.first()
        self.assertEqual(int(ligne.prix_unitaire), self.plat.prix_client + 500)

    def test_option_d_un_autre_plat_refusee(self):
        autre = Plat.objects.create(
            restaurant=self.resto, nom='Autre', prix=1000, is_available=True, is_visible=True,
        )
        groupe = GroupeComplement.objects.create(plat=autre, nom='X')
        intruse = OptionComplement.objects.create(groupe=groupe, nom='Intruse', supplement=0)

        reponse = self._commander([intruse.pk])
        self.assertEqual(reponse.status_code, 400)
        self.assertEqual(Commande.objects.count(), 0, 'la commande doit être annulée')

    def test_deux_options_du_meme_groupe_refusees(self):
        """Le choix est unique par groupe."""
        reponse = self._commander([self.riz.pk, self.frites.pk])
        self.assertEqual(reponse.status_code, 400)
        self.assertEqual(Commande.objects.count(), 0)

    def test_groupe_obligatoire_omis_refuse(self):
        reponse = self._commander([])
        self.assertEqual(reponse.status_code, 400)
        self.assertEqual(Commande.objects.count(), 0)

    def test_groupe_facultatif_peut_etre_ignore(self):
        reponse = self._commander([self.riz.pk])
        self.assertEqual(reponse.status_code, 201)

    def test_option_indisponible_refusee(self):
        self.frites.disponible = False
        self.frites.save(update_fields=['disponible'])
        self.assertEqual(self._commander([self.frites.pk]).status_code, 400)

    # ── Traçabilité ─────────────────────────────────────────
    def test_les_choix_sont_recopies_sur_la_ligne(self):
        """Une commande passée doit rester lisible même si le restaurant
        renomme ou supprime l'option ensuite."""
        reponse = self._commander([self.frites.pk])
        ligne = Commande.objects.get(pk=reponse.data['id']).lignes.first()

        self.frites.delete()

        choix = ChoixLigneCommande.objects.get(ligne=ligne)
        self.assertEqual(choix.groupe_nom, 'Accompagnement')
        self.assertEqual(choix.option_nom, 'Frites')
        self.assertEqual(int(choix.supplement), 500)
        self.assertIsNone(choix.option, 'la référence tombe, la trace reste')

    # ── Exposition à l'application ──────────────────────────
    def test_l_api_expose_groupes_et_inclus(self):
        donnees = self.api.get(f'/api/client/plats/{self.plat.pk}').data
        noms = [g['nom'] for g in donnees['groupes_complements']]
        self.assertEqual(noms, ['Accompagnement', 'Boisson'])
        self.assertEqual(donnees['elements_inclus'], ['Servi avec du pain'])

    def test_l_api_masque_les_options_indisponibles(self):
        self.frites.disponible = False
        self.frites.save(update_fields=['disponible'])
        donnees = self.api.get(f'/api/client/plats/{self.plat.pk}').data
        groupe = donnees['groupes_complements'][0]
        self.assertEqual([o['nom'] for o in groupe['options']], ['Riz'])


class SaisieRestaurantTests(TestCase):
    """Le restaurant saisit ses compléments depuis son workspace."""

    def setUp(self):
        self.patron = User.objects.create_user(
            username='p@p.cm', password='x', role='restaurant',
        )
        self.resto = RestaurantProfile.objects.create(
            user=self.patron, nom='Test', ville='Douala', adresse='Akwa',
            is_verified=True, is_open=True,
        )
        self.navigateur = Client()
        self.navigateur.force_login(self.patron)

    def _poster(self, **extra):
        donnees = {
            'nom': 'Poulet DG', 'prix': '4000', 'frais_livraison': '500',
            'is_available': 'on',
        }
        donnees.update(extra)
        return self.navigateur.post('/admin-panel/resto/plats/nouveau/', donnees)

    def test_creation_avec_groupes_et_options(self):
        self._poster(**{
            'groupe_nom[0]': 'Accompagnement',
            'groupe_obligatoire[0]': 'on',
            'option_nom[0][]': ['Riz', 'Frites'],
            'option_prix[0][]': ['', '500'],
            'inclus_nom[]': ['Servi avec du pain'],
        })
        plat = Plat.objects.get(nom='Poulet DG')
        groupe = plat.groupes_complements.get()
        self.assertEqual(groupe.nom, 'Accompagnement')
        self.assertTrue(groupe.obligatoire)

        options = list(groupe.options.all())
        self.assertEqual([o.nom for o in options], ['Riz', 'Frites'])
        # Prix vide => offert.
        self.assertEqual(int(options[0].supplement), 0)
        self.assertEqual(int(options[1].supplement), 500)
        self.assertEqual([e.nom for e in plat.elements_inclus.all()], ['Servi avec du pain'])

    def test_groupe_sans_option_est_ecarte(self):
        """Un groupe obligatoire sans option bloquerait toute commande."""
        self._poster(**{'groupe_nom[0]': 'Vide', 'groupe_obligatoire[0]': 'on'})
        plat = Plat.objects.get(nom='Poulet DG')
        self.assertEqual(plat.groupes_complements.count(), 0)

    def test_edition_remplace_les_groupes(self):
        self._poster(**{
            'groupe_nom[0]': 'Ancien', 'option_nom[0][]': ['A'], 'option_prix[0][]': ['0'],
        })
        plat = Plat.objects.get(nom='Poulet DG')

        self.navigateur.post(f'/admin-panel/resto/plats/{plat.pk}/', {
            'nom': 'Poulet DG', 'prix': '4000', 'frais_livraison': '500',
            'is_available': 'on',
            'groupe_nom[0]': 'Nouveau', 'option_nom[0][]': ['B'], 'option_prix[0][]': ['200'],
        })
        self.assertEqual(
            [g.nom for g in plat.groupes_complements.all()], ['Nouveau'],
        )

    def test_prix_non_numerique_vaut_offert(self):
        """Une saisie libre ne doit pas faire échouer l'enregistrement."""
        self._poster(**{
            'groupe_nom[0]': 'G', 'option_nom[0][]': ['X'], 'option_prix[0][]': ['gratuit'],
        })
        plat = Plat.objects.get(nom='Poulet DG')
        self.assertEqual(int(plat.groupes_complements.get().options.get().supplement), 0)
