"""
URL configuration for core app
"""
from django.urls import path
from . import views

urlpatterns = [
    path('timezones/', views.timezone_list, name='timezone-list'),
    path('timezones/update/', views.update_user_timezone, name='update-timezone'),
    path('time-info/', views.current_time_info, name='current-time-info'),
]
