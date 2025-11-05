"""
Reports URLs for WorkSync
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ReportTemplateViewSet, ReportExecutionViewSet, ReportScheduleViewSet, ReportsViewSet

router = DefaultRouter()
router.register(r'templates', ReportTemplateViewSet)
router.register(r'executions', ReportExecutionViewSet)
router.register(r'schedules', ReportScheduleViewSet)
router.register(r'', ReportsViewSet, basename='reports')

urlpatterns = [
    path('', include(router.urls)),
]
