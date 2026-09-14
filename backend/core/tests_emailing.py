"""core.emailing : enveloppe best-effort autour de send_mail."""
from unittest.mock import patch

from django.core import mail
from django.test import TestCase

from core.emailing import envoyer_email


class EnvoyerEmailTestCase(TestCase):
    def test_envoi_reussi_renvoie_true_et_peuple_outbox(self):
        resultat = envoyer_email('client@example.cm', 'Sujet de test', 'Corps du message.')
        self.assertTrue(resultat)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ['client@example.cm'])
        self.assertEqual(mail.outbox[0].subject, 'Sujet de test')
        self.assertEqual(mail.outbox[0].body, 'Corps du message.')

    def test_destinataire_vide_ne_tente_rien(self):
        self.assertFalse(envoyer_email('', 'Sujet', 'Corps'))
        self.assertEqual(len(mail.outbox), 0)

    @patch('core.emailing.send_mail', side_effect=Exception('connexion SMTP refusée'))
    def test_echec_smtp_renvoie_false_sans_lever(self, mock_send):
        resultat = envoyer_email('client@example.cm', 'Sujet', 'Corps')
        self.assertFalse(resultat)
        self.assertTrue(mock_send.called)
