from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login, logout
from django.contrib import messages
from core.models import AuditLog

# Rôles autorisés sur le panel web et leur page d'accueil
ROLE_HOME = {
    'admin': 'core:dashboard',
    'restaurant': 'core:resto_dashboard',
    'livreur': 'core:livreur_dashboard',
}


def redirect_by_role(user):
    return redirect(ROLE_HOME.get(user.role, 'core:login'))


def login_view(request):
    if request.user.is_authenticated and request.user.role in ROLE_HOME:
        return redirect_by_role(request.user)

    if request.method == 'POST':
        username = request.POST.get('username')
        password = request.POST.get('password')
        user = authenticate(request, username=username, password=password)
        if user and user.role in ROLE_HOME:
            login(request, user)
            AuditLog.objects.create(
                user=user,
                action='LOGIN',
                model_name='User',
                object_id=str(user.pk),
                description={'username': username, 'role': user.role},
                ip_address=request.META.get('REMOTE_ADDR'),
            )
            return redirect_by_role(user)
        else:
            messages.error(request, 'Identifiants invalides ou accès non autorisé.')

    return render(request, 'auth/login.html')


def logout_view(request):
    if request.user.is_authenticated:
        AuditLog.objects.create(
            user=request.user,
            action='LOGOUT',
            model_name='User',
            object_id=str(request.user.pk),
            description={},
            ip_address=request.META.get('REMOTE_ADDR'),
        )
    logout(request)
    return redirect('core:login')
