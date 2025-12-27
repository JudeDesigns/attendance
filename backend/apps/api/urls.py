"""
URL configuration for API integration
"""
from django.urls import path
from . import views

app_name = 'api'

urlpatterns = [
    # Clock-in/out endpoints for external integration
    path('attendance/clock-in/', views.clock_in, name='clock_in'),
    path('attendance/clock-out/', views.clock_out, name='clock_out'),
    path('attendance/start-break/', views.start_break, name='start_break'),
    path('attendance/end-break/', views.end_break, name='end_break'),
    
    # Employee status
    path('employees/<str:employee_id>/status/', views.employee_status, name='employee_status'),
    
    # Webhook management
    path('webhooks/subscribe/', views.subscribe_webhook, name='subscribe_webhook'),
]
