from django.urls import path

from core.views import partner_portal

app_name = 'partner_portal'

urlpatterns = [
    path('connexion/', partner_portal.login_view, name='login'),
    path('deconnexion/', partner_portal.logout_view, name='logout'),
    path('', partner_portal.dashboard, name='dashboard'),
    path('commandes/', partner_portal.commandes, name='commandes'),
    path('cles/', partner_portal.cles, name='cles'),
    path('webhook/', partner_portal.webhook, name='webhook'),
    path('mot-de-passe/', partner_portal.changer_mot_de_passe, name='changer_mot_de_passe'),
]
