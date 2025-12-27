"""
URL configuration for attendance
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TimeLogViewSet, BreakViewSet

app_name = 'attendance'

router = DefaultRouter()
router.register(r'time-logs', TimeLogViewSet, basename='timelog')
router.register(r'breaks', BreakViewSet, basename='break')

urlpatterns = [
    path('', include(router.urls)),
]
