"""
API views for external integration
"""
from rest_framework import status
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.utils import timezone
from django.db import transaction
from django.shortcuts import get_object_or_404

from .authentication import APIKeyAuthentication
from .serializers import (
    ClockInSerializer, ClockOutSerializer, TimeLogResponseSerializer,
    EmployeeStatusSerializer, WebhookSubscriptionSerializer
)
from apps.employees.models import Employee, Location
from apps.attendance.models import TimeLog
from apps.notifications.models import WebhookSubscription
from apps.notifications.tasks import send_webhook_notification

import logging

logger = logging.getLogger('worksync.api')


@api_view(['POST'])
@authentication_classes([APIKeyAuthentication])
@permission_classes([AllowAny])
def clock_in(request):
    """
    Clock in an employee via external API
    
    POST /api/v1/attendance/clock-in/
    """
    serializer = ClockInSerializer(data=request.data)
    
    if not serializer.is_valid():
        return Response({
            'status': 'error',
            'message': 'Invalid data provided',
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        with transaction.atomic():
            employee = Employee.objects.get(
                employee_id=serializer.validated_data['employee_id'],
                employment_status='ACTIVE'
            )
            
            # Check if employee is already clocked in
            existing_log = TimeLog.objects.filter(
                employee=employee,
                clock_out_time__isnull=True
            ).first()
            
            if existing_log:
                return Response({
                    'status': 'error',
                    'message': f'Employee {employee.employee_id} is already clocked in',
                    'current_timelog_id': existing_log.id
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Get location if provided
            location = None
            location_id = serializer.validated_data.get('location_id')
            if location_id:
                try:
                    location = Location.objects.get(qr_code_payload=location_id, is_active=True)
                except Location.DoesNotExist:
                    logger.warning(f"Location {location_id} not found for clock-in")
            
            # Create time log
            time_log = TimeLog.objects.create(
                employee=employee,
                location=location,
                clock_in_time=serializer.validated_data['timestamp'],
                clock_in_method='API',
                clock_in_latitude=serializer.validated_data.get('latitude'),
                clock_in_longitude=serializer.validated_data.get('longitude'),
                status='CLOCKED_IN',
                notes=serializer.validated_data.get('notes', ''),
            )
            
            # Send webhook notification
            send_webhook_notification.delay(
                'employee.clocked_in',
                {
                    'employee_id': employee.employee_id,
                    'employee_name': employee.full_name,
                    'timestamp': time_log.clock_in_time.isoformat(),
                    'location': location.name if location else None,
                    'timelog_id': time_log.id
                }
            )
            
            logger.info(f"Employee {employee.employee_id} clocked in via API at {time_log.clock_in_time}")
            
            return Response({
                'status': 'success',
                'message': f'Employee {employee.employee_id} clocked in successfully',
                'timelog_id': time_log.id,
                'timestamp': time_log.clock_in_time.isoformat(),
                'location': location.name if location else None
            }, status=status.HTTP_200_OK)
            
    except Employee.DoesNotExist:
        return Response({
            'status': 'error',
            'message': f'Employee {serializer.validated_data["employee_id"]} not found or inactive'
        }, status=status.HTTP_404_NOT_FOUND)
    
    except Exception as e:
        logger.error(f"Clock-in error for {serializer.validated_data['employee_id']}: {str(e)}")
        return Response({
            'status': 'error',
            'message': 'An error occurred while processing clock-in'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@authentication_classes([APIKeyAuthentication])
@permission_classes([AllowAny])
def clock_out(request):
    """
    Clock out an employee via external API
    
    POST /api/v1/attendance/clock-out/
    """
    serializer = ClockOutSerializer(data=request.data)
    
    if not serializer.is_valid():
        return Response({
            'status': 'error',
            'message': 'Invalid data provided',
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        with transaction.atomic():
            employee = Employee.objects.get(
                employee_id=serializer.validated_data['employee_id'],
                employment_status='ACTIVE'
            )
            
            # Find active time log
            time_log = TimeLog.objects.filter(
                employee=employee,
                clock_out_time__isnull=True
            ).first()
            
            if not time_log:
                return Response({
                    'status': 'error',
                    'message': f'Employee {employee.employee_id} is not currently clocked in'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Update time log with clock-out information
            time_log.clock_out_time = serializer.validated_data['timestamp']
            time_log.clock_out_method = 'API'
            time_log.clock_out_latitude = serializer.validated_data.get('latitude')
            time_log.clock_out_longitude = serializer.validated_data.get('longitude')
            time_log.status = 'CLOCKED_OUT'
            
            # Add notes if provided
            if serializer.validated_data.get('notes'):
                time_log.notes += f"\nClock-out notes: {serializer.validated_data['notes']}"
            
            time_log.save()
            
            # Send webhook notification
            send_webhook_notification.delay(
                'employee.clocked_out',
                {
                    'employee_id': employee.employee_id,
                    'employee_name': employee.full_name,
                    'clock_in_time': time_log.clock_in_time.isoformat(),
                    'clock_out_time': time_log.clock_out_time.isoformat(),
                    'duration_minutes': time_log.duration_minutes,
                    'duration_hours': time_log.duration_hours,
                    'timelog_id': time_log.id
                }
            )
            
            # Check for overtime and send notification if needed
            if time_log.is_overtime:
                send_webhook_notification.delay(
                    'overtime.threshold.reached',
                    {
                        'employee_id': employee.employee_id,
                        'employee_name': employee.full_name,
                        'threshold_hours': 8,
                        'actual_hours': time_log.duration_hours,
                        'timestamp': time_log.clock_out_time.isoformat(),
                        'timelog_id': time_log.id
                    }
                )
            
            logger.info(f"Employee {employee.employee_id} clocked out via API at {time_log.clock_out_time}")
            
            return Response({
                'status': 'success',
                'message': f'Employee {employee.employee_id} clocked out successfully',
                'duration_minutes': time_log.duration_minutes,
                'duration_hours': time_log.duration_hours,
                'is_overtime': time_log.is_overtime,
                'timelog_id': time_log.id
            }, status=status.HTTP_200_OK)
            
    except Employee.DoesNotExist:
        return Response({
            'status': 'error',
            'message': f'Employee {serializer.validated_data["employee_id"]} not found or inactive'
        }, status=status.HTTP_404_NOT_FOUND)
    
    except Exception as e:
        logger.error(f"Clock-out error for {serializer.validated_data['employee_id']}: {str(e)}")
        return Response({
            'status': 'error',
            'message': 'An error occurred while processing clock-out'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@authentication_classes([APIKeyAuthentication])
@permission_classes([AllowAny])
def employee_status(request, employee_id):
    """
    Get current status of an employee
    
    GET /api/v1/employees/{employee_id}/status/
    """
    try:
        employee = get_object_or_404(Employee, employee_id=employee_id, employment_status='ACTIVE')
        
        # Get current time log if exists
        current_log = TimeLog.objects.filter(
            employee=employee,
            clock_out_time__isnull=True
        ).first()
        
        data = {
            'employee_id': employee.employee_id,
            'full_name': employee.full_name,
            'employment_status': employee.employment_status,
            'current_status': current_log.status if current_log else 'CLOCKED_OUT',
            'current_time_log': TimeLogResponseSerializer(current_log).data if current_log else None
        }
        
        return Response({
            'status': 'success',
            'data': data
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Error getting employee status for {employee_id}: {str(e)}")
        return Response({
            'status': 'error',
            'message': 'An error occurred while getting employee status'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@authentication_classes([APIKeyAuthentication])
@permission_classes([AllowAny])
def subscribe_webhook(request):
    """
    Subscribe to webhook notifications
    
    POST /api/v1/webhooks/subscribe/
    """
    serializer = WebhookSubscriptionSerializer(data=request.data)
    
    if not serializer.is_valid():
        return Response({
            'status': 'error',
            'message': 'Invalid data provided',
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        # Create or update webhook subscription
        subscription, created = WebhookSubscription.objects.update_or_create(
            event_type=serializer.validated_data['event_type'],
            target_url=serializer.validated_data['target_url'],
            defaults={
                'is_active': serializer.validated_data.get('is_active', True),
                'created_by_app': getattr(request.user, 'app_name', 'unknown')
            }
        )
        
        action = 'created' if created else 'updated'
        
        return Response({
            'status': 'success',
            'message': f'Webhook subscription {action} successfully',
            'subscription_id': subscription.id
        }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Webhook subscription error: {str(e)}")
        return Response({
            'status': 'error',
            'message': 'An error occurred while creating webhook subscription'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
