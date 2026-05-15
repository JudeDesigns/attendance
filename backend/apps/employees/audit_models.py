"""
Audit logging model for tracking sub-admin and admin actions.
Every meaningful write performed by a sub-admin is recorded here so
the full admin (boss) can review the activity trail at any time.

Logs are automatically purged after 90 days via Celery.
"""
import json
from django.db import models, transaction
from django.contrib.auth.models import User
from django.utils import timezone


class AuditLog(models.Model):
    """
    Immutable record of a privileged action performed by a sub-admin or admin.

    Fields
    ------
    actor        — the User who performed the action
    action       — machine-readable action key, e.g. "edit_employee"
    category     — human-readable group, e.g. "Employees"
    target_type  — class name of the affected object, e.g. "Employee"
    target_id    — string representation of the affected object's PK/UUID
    target_label — human-readable description, e.g. "John Doe (EMP-001)"
    details      — before/after snapshot: {"before": {...}, "after": {...}}
    ip_address   — IP of the request that triggered this action
    timestamp    — UTC timestamp (auto-set on creation)
    """

    # ── Action category choices ────────────────────────────────────────────
    CATEGORY_CHOICES = [
        ('Employees',     'Employees'),
        ('Time Logs',     'Time Logs'),
        ('Schedule',      'Schedule'),
        ('Leave',         'Leave'),
        ('Locations',     'Locations'),
        ('Sub-Admins',    'Sub-Admins'),
        ('Reports',       'Reports'),
        ('Notifications', 'Notifications'),
        ('System',        'System'),
    ]

    actor = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='audit_logs',
        help_text="The user who performed this action",
    )
    action = models.CharField(
        max_length=100,
        db_index=True,
        help_text="Machine-readable action key, e.g. 'edit_employee'",
    )
    category = models.CharField(
        max_length=50,
        choices=CATEGORY_CHOICES,
        db_index=True,
        help_text="Grouping for UI filtering",
    )
    target_type = models.CharField(
        max_length=100,
        blank=True,
        help_text="Class name of the affected model, e.g. 'Employee'",
    )
    target_id = models.CharField(
        max_length=100,
        blank=True,
        help_text="Primary key / UUID of the affected record",
    )
    target_label = models.CharField(
        max_length=255,
        blank=True,
        help_text="Human-readable description of the target, e.g. 'John Doe (EMP-001)'",
    )
    details = models.JSONField(
        default=dict,
        blank=True,
        help_text="Before/after snapshot: {\"before\": {...}, \"after\": {...}}",
    )
    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
        help_text="IP address of the request",
    )
    timestamp = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
    )

    class Meta:
        db_table = 'audit_logs'
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['actor', 'timestamp']),
            models.Index(fields=['category', 'timestamp']),
            models.Index(fields=['action', 'timestamp']),
        ]
        verbose_name = 'Audit Log'
        verbose_name_plural = 'Audit Logs'

    def __str__(self):
        actor_name = self.actor.username if self.actor else 'Unknown'
        return f"[{self.timestamp:%Y-%m-%d %H:%M}] {actor_name} → {self.action} ({self.target_label})"


# ── Convenience helper ─────────────────────────────────────────────────────

def get_client_ip(request):
    """Extract the real client IP from the request."""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        return x_forwarded_for.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


def log_action(
    request,
    action: str,
    category: str,
    target=None,
    target_label: str = '',
    before: dict = None,
    after: dict = None,
):
    """
    Record a single audit log entry.  Call this from any view that performs
    a meaningful write on behalf of a sub-admin or admin.

    Parameters
    ----------
    request       — the DRF / Django request object (provides actor + IP)
    action        — machine key, e.g. "edit_employee", "approve_leave"
    category      — one of AuditLog.CATEGORY_CHOICES first values
    target        — the model instance being acted upon (optional)
    target_label  — human description if target has no __str__ (optional)
    before        — dict of field values BEFORE the change (optional)
    after         — dict of field values AFTER the change (optional)

    Example
    -------
    log_action(
        request,
        action='edit_employee',
        category='Employees',
        target=employee,
        before={'hourly_rate': '25.00', 'job_title': 'Driver'},
        after={'hourly_rate': '30.00', 'job_title': 'Senior Driver'},
    )
    """
    actor = getattr(request, 'user', None)
    if actor and not actor.is_authenticated:
        actor = None

    # Derive target fields from the model instance when possible
    target_type = ''
    target_id = ''
    resolved_label = target_label

    if target is not None:
        target_type = type(target).__name__
        target_id = str(target.pk)
        if not resolved_label:
            resolved_label = str(target)

    details = {}
    if before is not None:
        details['before'] = _sanitize(before)
    if after is not None:
        details['after'] = _sanitize(after)

    try:
        # Use a savepoint so that if the audit write fails (e.g. missing table),
        # it rolls back only this nested block — not the outer atomic transaction.
        with transaction.atomic():
            AuditLog.objects.create(
                actor=actor,
                action=action,
                category=category,
                target_type=target_type,
                target_id=target_id,
                target_label=resolved_label,
                details=details,
                ip_address=get_client_ip(request),
            )
    except Exception:
        # Audit logging must NEVER crash the main request
        import logging
        logging.getLogger('worksync.audit').exception(
            "Failed to write audit log entry: action=%s category=%s", action, category
        )


def _sanitize(data: dict) -> dict:
    """
    Make a dict safe for JSON storage.
    Converts non-serialisable values to strings.
    """
    safe = {}
    for k, v in (data or {}).items():
        try:
            json.dumps(v)
            safe[k] = v
        except (TypeError, ValueError):
            safe[k] = str(v)
    return safe
