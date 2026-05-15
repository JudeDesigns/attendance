"""
Read-only audit log API endpoint.
Only full admins (is_staff=True) can access this.
Sub-admins and regular employees are denied with 403.
"""
import csv
from django.http import HttpResponse
from django.contrib.auth.models import User
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework import serializers as drf_serializers
from django_filters.rest_framework import DjangoFilterBackend

from .audit_models import AuditLog


# ── Serializers ────────────────────────────────────────────────────────────

class AuditLogSerializer(drf_serializers.ModelSerializer):
    actor_username = drf_serializers.SerializerMethodField()
    actor_full_name = drf_serializers.SerializerMethodField()
    actor_employee_id = drf_serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = [
            'id',
            'actor',
            'actor_username',
            'actor_full_name',
            'actor_employee_id',
            'action',
            'category',
            'target_type',
            'target_id',
            'target_label',
            'details',
            'ip_address',
            'timestamp',
        ]
        read_only_fields = fields

    def get_actor_username(self, obj):
        return obj.actor.username if obj.actor else None

    def get_actor_full_name(self, obj):
        if not obj.actor:
            return None
        name = obj.actor.get_full_name()
        return name if name.strip() else obj.actor.username

    def get_actor_employee_id(self, obj):
        if not obj.actor:
            return None
        try:
            return obj.actor.employee_profile.employee_id
        except Exception:
            return None


# ── Permission ─────────────────────────────────────────────────────────────

class IsFullAdminOnly(permissions.BasePermission):
    """Only full admin users (is_staff) may access audit logs."""
    message = "Access denied. Only administrators can view audit logs."

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.is_staff
        )


# ── ViewSet ────────────────────────────────────────────────────────────────

class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    List and retrieve audit log entries.
    Supports filtering by actor, category, action, and date range.

    GET  /api/v1/employees/audit-logs/
    GET  /api/v1/employees/audit-logs/{id}/
    GET  /api/v1/employees/audit-logs/export/         → CSV download
    GET  /api/v1/employees/audit-logs/sub_admins/     → list of sub-admins for filter dropdown
    GET  /api/v1/employees/audit-logs/categories/     → list of categories for filter dropdown
    """
    serializer_class = AuditLogSerializer
    permission_classes = [IsFullAdminOnly]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['category', 'action']
    search_fields = ['actor__username', 'actor__first_name', 'actor__last_name',
                     'action', 'target_label', 'category']
    ordering_fields = ['timestamp', 'actor__username', 'category', 'action']
    ordering = ['-timestamp']

    def get_queryset(self):
        qs = AuditLog.objects.select_related('actor', 'actor__employee_profile')

        # Filter by actor (sub-admin user ID)
        actor_id = self.request.query_params.get('actor')
        if actor_id:
            qs = qs.filter(actor_id=actor_id)

        # Date range filtering
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')
        if date_from:
            try:
                d = parse_date(date_from)
                if d:
                    qs = qs.filter(timestamp__date__gte=d)
            except Exception:
                pass
        if date_to:
            try:
                d = parse_date(date_to)
                if d:
                    qs = qs.filter(timestamp__date__lte=d)
            except Exception:
                pass

        # Show only sub-admin actions by default (admin can see all if they pass actor= a full admin)
        only_sub_admins = self.request.query_params.get('only_sub_admins', 'true').lower()
        if only_sub_admins == 'true' and not actor_id:
            # Filter to only users who have a SUB_ADMIN role
            qs = qs.filter(
                actor__employee_profile__role__name='SUB_ADMIN'
            )

        return qs

    @action(detail=False, methods=['get'], url_path='export')
    def export(self, request):
        """Export filtered audit logs as a CSV file."""
        qs = self.filter_queryset(self.get_queryset())

        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = (
            f'attachment; filename="audit_log_{timezone.now():%Y%m%d_%H%M%S}.csv"'
        )

        writer = csv.writer(response)
        writer.writerow([
            'Timestamp', 'Sub-Admin', 'Employee ID', 'Category',
            'Action', 'Target', 'IP Address', 'Before', 'After',
        ])

        for entry in qs.iterator():
            actor_name = entry.actor.get_full_name() or entry.actor.username if entry.actor else ''
            try:
                emp_id = entry.actor.employee_profile.employee_id if entry.actor else ''
            except Exception:
                emp_id = ''
            before = entry.details.get('before', '')
            after = entry.details.get('after', '')
            writer.writerow([
                entry.timestamp.strftime('%Y-%m-%d %H:%M:%S UTC'),
                actor_name,
                emp_id,
                entry.category,
                entry.action,
                entry.target_label,
                entry.ip_address or '',
                before if isinstance(before, str) else str(before),
                after if isinstance(after, str) else str(after),
            ])

        return response

    @action(detail=False, methods=['get'], url_path='sub_admins')
    def sub_admins(self, request):
        """Return a list of sub-admins that have audit log entries — for the filter dropdown."""
        from apps.employees.models import Employee
        sub_admins = Employee.objects.filter(
            role__name='SUB_ADMIN',
            employment_status='ACTIVE',
        ).select_related('user').order_by('employee_id')

        return Response([
            {
                'id': str(sa.user.id),
                'username': sa.user.username,
                'full_name': sa.user.get_full_name() or sa.user.username,
                'employee_id': sa.employee_id,
            }
            for sa in sub_admins
        ])

    @action(detail=False, methods=['get'], url_path='categories')
    def categories(self, request):
        """Return distinct categories that exist in the log, for the filter dropdown."""
        cats = (
            AuditLog.objects
            .filter(actor__employee_profile__role__name='SUB_ADMIN')
            .values_list('category', flat=True)
            .distinct()
            .order_by('category')
        )
        return Response(list(cats))
