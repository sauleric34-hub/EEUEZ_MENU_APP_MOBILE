from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login, logout
from django.contrib import messages
from core.models import AuditLog


def login_view(request):
    if request.user.is_authenticated and request.user.role == 'admin':
        return redirect('core:dashboard')

    if request.method == 'POST':
        username = request.POST.get('username')
        password = request.POST.get('password')
        user = authenticate(request, username=username, password=password)
        if user and user.role == 'admin':
            login(request, user)
            AuditLog.objects.create(
                user=user,
                action='LOGIN',
                model_name='User',
                object_id=str(user.pk),
                description={'username': username},
                ip_address=request.META.get('REMOTE_ADDR'),
            )
            return redirect('core:dashboard')
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
