"""
URL configuration for employees
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import RoleViewSet, EmployeeViewSet, LocationViewSet, SubAdminViewSet
from .audit_views import AuditLogViewSet

app_name = 'employees'

router = DefaultRouter()
router.register(r'roles', RoleViewSet, basename='role')
router.register(r'sub-admins', SubAdminViewSet, basename='sub-admin')
router.register(r'employees', EmployeeViewSet, basename='employee')
router.register(r'locations', LocationViewSet, basename='location')
router.register(r'audit-logs', AuditLogViewSet, basename='audit-log')

urlpatterns = [
    path('', include(router.urls)),
]
