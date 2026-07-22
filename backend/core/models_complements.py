# ═══════════════════════════════════════════════════════════
#  Compléments et éléments inclus d'un plat
#
#  Deux notions distinctes, volontairement séparées :
#
#   • COMPLÉMENT — le client CHOISIT. Organisé en groupes (« Accompagnement »,
#     « Boisson »…), un seul choix par groupe. Chaque option peut porter un
#     supplément de prix, ou être gratuite : c'est le restaurant qui décide.
#
#   • INCLUS — le client ne choisit rien. C'est une information : ce qui vient
#     avec le plat (« servi avec du pain », « sauce piquante offerte »).
#     Aucun impact sur le prix.
# ═══════════════════════════════════════════════════════════

from django.db import models


class GroupeComplement(models.Model):
    """Un jeu d'options parmi lesquelles le client choisit UNE possibilité."""

    plat = models.ForeignKey(
        'Plat', on_delete=models.CASCADE, related_name='groupes_complements',
    )
    nom = models.CharField(max_length=80, help_text="Ex. « Accompagnement », « Boisson »")
    # Un groupe obligatoire force un choix avant l'ajout au panier ; un groupe
    # facultatif peut être laissé vide (le client ne prend pas de boisson).
    obligatoire = models.BooleanField(default=False)
    ordre = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name = 'Groupe de compléments'
        verbose_name_plural = 'Groupes de compléments'
        ordering = ['ordre', 'id']

    def __str__(self):
        return f'{self.nom} ({self.plat.nom})'


class OptionComplement(models.Model):
    """Une option d'un groupe. Le supplément vaut 0 quand elle est offerte."""

    groupe = models.ForeignKey(
        GroupeComplement, on_delete=models.CASCADE, related_name='options',
    )
    nom = models.CharField(max_length=80)
    # Decimal comme tous les montants du projet (jamais de float pour l'argent :
    # les arrondis binaires y fausseraient les totaux).
    supplement = models.DecimalField(
        max_digits=12, decimal_places=0, default=0,
        help_text='0 = offert. Sinon, montant ajouté au prix du plat.',
    )
    disponible = models.BooleanField(default=True)
    ordre = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name = 'Option de complément'
        verbose_name_plural = 'Options de complément'
        ordering = ['ordre', 'id']

    def __str__(self):
        if self.supplement:
            return f'{self.nom} (+{self.supplement} F)'
        return f'{self.nom} (offert)'

    @property
    def est_offert(self):
        return not self.supplement


class ChoixLigneCommande(models.Model):
    """Complément retenu sur une ligne de commande.

    Les libellés et le supplément sont RECOPIÉS ici, pas seulement référencés :
    une commande passée doit rester lisible telle qu'elle a été payée, même si
    le restaurant renomme l'option, la retire ou en change le prix ensuite.
    """

    ligne = models.ForeignKey(
        'LigneCommande', on_delete=models.CASCADE, related_name='choix',
    )
    # SET_NULL : supprimer une option ne doit jamais effacer une commande.
    option = models.ForeignKey(
        OptionComplement, on_delete=models.SET_NULL, null=True, blank=True,
    )
    groupe_nom = models.CharField(max_length=80)
    option_nom = models.CharField(max_length=80)
    supplement = models.DecimalField(max_digits=12, decimal_places=0, default=0)

    class Meta:
        verbose_name = 'Choix de complément'
        verbose_name_plural = 'Choix de compléments'
        ordering = ['id']

    def __str__(self):
        return f'{self.groupe_nom} : {self.option_nom}'


class ElementInclus(models.Model):
    """Ce qui accompagne le plat sans choix ni surcoût — purement informatif."""

    plat = models.ForeignKey(
        'Plat', on_delete=models.CASCADE, related_name='elements_inclus',
    )
    nom = models.CharField(max_length=120, help_text='Ex. « Servi avec du pain »')
    ordre = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name = 'Élément inclus'
        verbose_name_plural = 'Éléments inclus'
        ordering = ['ordre', 'id']

    def __str__(self):
        return f'{self.nom} ({self.plat.nom})'
