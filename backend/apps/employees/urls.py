"""
URL configuration for employees
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import RoleViewSet, EmployeeViewSet, LocationViewSet

app_name = 'employees'

router = DefaultRouter()
router.register(r'roles', RoleViewSet, basename='role')
router.register(r'employees', EmployeeViewSet, basename='employee')
router.register(r'locations', LocationViewSet, basename='location')

urlpatterns = [
    path('', include(router.urls)),
]
