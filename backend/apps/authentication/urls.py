"""
Authentication URLs
"""
from django.urls import path
from . import views

app_name = 'authentication'

urlpatterns = [
    path('login/', views.login_view, name='login'),
    path('refresh/', views.refresh_token_view, name='refresh'),
    path('verify/', views.verify_token_view, name='verify'),
    path('profile/', views.profile_view, name='profile'),
    path('logout/', views.logout_view, name='logout'),
]

