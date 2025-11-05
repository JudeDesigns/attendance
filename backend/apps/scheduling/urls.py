"""
URL configuration for scheduling
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ShiftViewSet, ShiftTemplateViewSet
from .leave_views import LeaveTypeViewSet, LeaveBalanceViewSet, LeaveRequestViewSet, LeaveApprovalWorkflowViewSet

app_name = 'scheduling'

router = DefaultRouter()
router.register(r'shifts', ShiftViewSet, basename='shift')
router.register(r'templates', ShiftTemplateViewSet, basename='shifttemplate')
router.register(r'leave-types', LeaveTypeViewSet, basename='leavetype')
router.register(r'leave-balances', LeaveBalanceViewSet, basename='leavebalance')
router.register(r'leave-requests', LeaveRequestViewSet, basename='leaverequest')
router.register(r'leave-workflows', LeaveApprovalWorkflowViewSet, basename='leaveworkflow')

urlpatterns = [
    path('', include(router.urls)),
]
