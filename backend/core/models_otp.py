"""Codes à usage unique envoyés par e-mail (OTP).

Usage actuel : confirmer un changement de mot de passe depuis l'app. Le code
n'est jamais stocké en clair (haché comme un mot de passe), expire vite, et
le nombre d'essais est limité — un code à 6 chiffres ne résiste pas à une
attaque par force brute sans ces garde-fous.
"""
import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.db import models
from django.utils import timezone

DUREE_VALIDITE = timedelta(minutes=10)
ESSAIS_MAX = 5


class CodeVerification(models.Model):
    OBJET_CHANGEMENT_MDP = 'changement_mdp'
    OBJET_CHOICES = [(OBJET_CHANGEMENT_MDP, 'Changement de mot de passe')]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='codes_verification')
    objet = models.CharField(max_length=30, choices=OBJET_CHOICES)
    code_hache = models.CharField(max_length=128)
    essais = models.PositiveSmallIntegerField(default=0)
    utilise = models.BooleanField(default=False)
    expire_le = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Code de vérification'
        verbose_name_plural = 'Codes de vérification'
        ordering = ['-created_at']
        indexes = [models.Index(fields=['user', 'objet', '-created_at'])]

    @classmethod
    def emettre(cls, user, objet):
        """Invalide les codes précédents et en crée un nouveau.
        Renvoie (instance, code_en_clair) — le clair ne sert qu'à l'e-mail."""
        cls.objects.filter(user=user, objet=objet, utilise=False).update(utilise=True)
        code = f'{secrets.randbelow(10**6):06d}'
        instance = cls.objects.create(
            user=user, objet=objet, code_hache=make_password(code),
            expire_le=timezone.now() + DUREE_VALIDITE,
        )
        return instance, code

    @classmethod
    def actif(cls, user, objet):
        return cls.objects.filter(
            user=user, objet=objet, utilise=False, expire_le__gt=timezone.now(),
        ).first()

    @property
    def epuise(self):
        return self.essais >= ESSAIS_MAX

    def verifier(self, code):
        """Compte l'essai et renvoie True si le code est bon (sans le consommer)."""
        if self.epuise or self.utilise or self.expire_le <= timezone.now():
            return False
        self.essais += 1
        self.save(update_fields=['essais'])
        return check_password(str(code or '').strip(), self.code_hache)

    @property
    def essais_restants(self):
        return max(0, ESSAIS_MAX - self.essais)
