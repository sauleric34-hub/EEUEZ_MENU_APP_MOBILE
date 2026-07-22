# ═══════════════════════════════════════════════════════════
#  Serializers du fil de publications
#
#  Deux partis pris :
#   · Les URLs de médias sont TOUJOURS absolues et explicites (le reste du
#     code mélange relatif/absolu ; absMedia() côté mobile double-préfixerait).
#   · « est_like » / « est_abonne » sont lus depuis le context, jamais via une
#     requête par objet — sinon N+1 sur chaque page du fil.
# ═══════════════════════════════════════════════════════════

from rest_framework import serializers

from .models import Publication, PublicationMedia, PublicationCommentaire


def absolutiser(request, url):
    """Transforme une URL média relative en URL absolue."""
    if not url:
        return None
    if url.startswith('http://') or url.startswith('https://'):
        return url
    return request.build_absolute_uri(url) if request else url


class AuteurMiniSerializer(serializers.Serializer):
    """Carte auteur affichée dans le fil (pastille @prénom nom + popup).

    L'EMAIL N'EST VOLONTAIREMENT PAS EXPOSÉ : ce bloc est visible par tous les
    utilisateurs du fil, publier l'adresse ouvrirait la porte au spam.
    """

    id = serializers.IntegerField()
    prenom = serializers.SerializerMethodField()
    nom = serializers.SerializerMethodField()
    pseudo = serializers.SerializerMethodField()
    avatar = serializers.SerializerMethodField()
    points = serializers.SerializerMethodField()
    niveau = serializers.SerializerMethodField()

    def get_prenom(self, obj):
        return obj.first_name or ''

    def get_nom(self, obj):
        return obj.last_name or ''

    def get_pseudo(self, obj):
        complet = f'{obj.first_name} {obj.last_name}'.strip()
        return complet or obj.username

    def get_avatar(self, obj):
        return absolutiser(self.context.get('request'), obj.avatar.url if obj.avatar else None)

    def get_points(self, obj):
        return int(getattr(obj, 'points_solde', 0) or 0)

    def get_niveau(self, obj):
        # Seuils lus dans le paramétrage : les modifier reclasse tout le monde
        # sans migration, et sans valeur codée en dur ici.
        from .fidelite import niveau
        return niveau(self.get_points(obj))


class PublicationMediaSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    url_original = serializers.SerializerMethodField()

    class Meta:
        model = PublicationMedia
        # « flou » est le data-URI du placeholder : il voyage avec le JSON,
        # donc il s'affiche sans aucune requête supplémentaire.
        fields = ['id', 'type', 'url', 'url_original', 'flou', 'ordre']

    def get_url(self, obj):
        """URL servie dans le fil : l'aperçu allégé quand il existe."""
        return absolutiser(self.context.get('request'), obj.url_affichage)

    def get_url_original(self, obj):
        """Fichier d'origine, pour un éventuel affichage plein écran."""
        return absolutiser(
            self.context.get('request'), obj.fichier.url if obj.fichier else None,
        )


class CommentaireSerializer(serializers.ModelSerializer):
    auteur_details = serializers.SerializerMethodField()
    peut_supprimer = serializers.SerializerMethodField()

    class Meta:
        model = PublicationCommentaire
        fields = ['id', 'texte', 'created_at', 'auteur_details', 'peut_supprimer']

    def get_auteur_details(self, obj):
        return AuteurMiniSerializer(obj.auteur, context=self.context).data

    def get_peut_supprimer(self, obj):
        """Auteur du commentaire, restaurant propriétaire, ou admin."""
        request = self.context.get('request')
        if not request or not request.user or request.user.is_anonymous:
            return False
        user = request.user
        if user.role == 'admin' or obj.auteur_id == user.pk:
            return True
        resto = getattr(user, 'restaurant_profile', None)
        return bool(resto and obj.publication.restaurant_id == resto.pk)


class PublicationSerializer(serializers.ModelSerializer):
    medias = PublicationMediaSerializer(many=True, read_only=True)
    restaurant_nom = serializers.SerializerMethodField()
    restaurant_logo = serializers.SerializerMethodField()
    plat_details = serializers.SerializerMethodField()
    auteur_details = serializers.SerializerMethodField()
    nombre_likes = serializers.SerializerMethodField()
    nombre_commentaires = serializers.SerializerMethodField()
    est_like = serializers.SerializerMethodField()
    est_abonne = serializers.SerializerMethodField()
    peut_supprimer = serializers.SerializerMethodField()

    class Meta:
        model = Publication
        fields = [
            'id', 'restaurant', 'restaurant_nom', 'restaurant_logo',
            'texte', 'statut', 'created_at', 'medias',
            'plat', 'plat_details', 'auteur_details',
            'nombre_likes', 'nombre_commentaires', 'est_like', 'est_abonne',
            'peut_supprimer',
        ]

    # ── Restaurant ──
    def get_restaurant_nom(self, obj):
        return obj.restaurant.nom if obj.restaurant else ''

    def get_restaurant_logo(self, obj):
        logo = obj.restaurant.logo if obj.restaurant else None
        return absolutiser(self.context.get('request'), logo.url if logo else None)

    # ── Plat associé (pastille « Commander ») ──
    def get_plat_details(self, obj):
        if not obj.plat:
            return None
        return {
            'id': obj.plat.id,
            'nom': obj.plat.nom,
            'prix': int(obj.plat.prix_client),
            'image': absolutiser(
                self.context.get('request'), obj.plat.image.url if obj.plat.image else None,
            ),
        }

    # ── Auteur (contribution client uniquement) ──
    def get_auteur_details(self, obj):
        if not obj.auteur:
            return None
        return AuteurMiniSerializer(obj.auteur, context=self.context).data

    # ── Compteurs : annotés par la vue quand c'est possible ──
    def get_nombre_likes(self, obj):
        n = getattr(obj, 'n_likes', None)
        return n if n is not None else obj.likes.count()

    def get_nombre_commentaires(self, obj):
        n = getattr(obj, 'n_commentaires', None)
        return n if n is not None else obj.commentaires.filter(supprime_par='').count()

    # ── État par utilisateur : lu depuis le context (aucune requête par objet) ──
    def get_est_like(self, obj):
        return obj.pk in (self.context.get('likes_ids') or set())

    def get_est_abonne(self, obj):
        return obj.restaurant_id in (self.context.get('suivis_ids') or set())

    def get_peut_supprimer(self, obj):
        """L'auteur (contribution) ou le restaurant propriétaire."""
        request = self.context.get('request')
        if not request or not request.user or request.user.is_anonymous:
            return False
        user = request.user
        if obj.auteur_id and obj.auteur_id == user.pk:
            return True
        resto = getattr(user, 'restaurant_profile', None)
        return bool(resto and obj.restaurant_id == resto.pk)
