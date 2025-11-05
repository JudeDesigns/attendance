"""
Leave management models for WorkSync
"""
import uuid
from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
from django.core.exceptions import ValidationError
from apps.employees.models import Employee


class LeaveType(models.Model):
    """Types of leave available"""
    LEAVE_TYPE_CHOICES = [
        ('ANNUAL', 'Annual Leave'),
        ('SICK', 'Sick Leave'),
        ('PERSONAL', 'Personal Leave'),
        ('MATERNITY', 'Maternity Leave'),
        ('PATERNITY', 'Paternity Leave'),
        ('BEREAVEMENT', 'Bereavement Leave'),
        ('STUDY', 'Study Leave'),
        ('UNPAID', 'Unpaid Leave'),
        ('COMPENSATORY', 'Compensatory Leave'),
        ('OTHER', 'Other'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=50, choices=LEAVE_TYPE_CHOICES, unique=True)
    display_name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    
    # Leave configuration
    is_paid = models.BooleanField(default=True)
    requires_approval = models.BooleanField(default=True)
    max_consecutive_days = models.IntegerField(null=True, blank=True, help_text="Maximum consecutive days allowed")
    min_notice_days = models.IntegerField(default=1, help_text="Minimum notice required in days")
    max_advance_days = models.IntegerField(default=365, help_text="Maximum days in advance to request")
    
    # Annual allocation
    annual_allocation = models.DecimalField(max_digits=5, decimal_places=2, default=0, help_text="Annual days allocated")
    carry_over_allowed = models.BooleanField(default=False)
    max_carry_over_days = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    
    # Status
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return self.display_name
    
    class Meta:
        ordering = ['display_name']


class LeaveBalance(models.Model):
    """Employee leave balance tracking"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='leave_balances')
    leave_type = models.ForeignKey(LeaveType, on_delete=models.CASCADE, related_name='balances')
    
    # Balance tracking
    year = models.IntegerField(default=timezone.now().year)
    allocated_days = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    used_days = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    pending_days = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    carried_over_days = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    @property
    def available_days(self):
        """Calculate available leave days"""
        return self.allocated_days + self.carried_over_days - self.used_days - self.pending_days
    
    @property
    def total_allocated(self):
        """Total allocated including carry over"""
        return self.allocated_days + self.carried_over_days
    
    def __str__(self):
        return f"{self.employee.user.get_full_name()} - {self.leave_type.display_name} ({self.year})"
    
    class Meta:
        unique_together = ['employee', 'leave_type', 'year']
        ordering = ['-year', 'leave_type__display_name']


class LeaveRequest(models.Model):
    """Leave request model"""
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
        ('CANCELLED', 'Cancelled'),
        ('WITHDRAWN', 'Withdrawn'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='leave_requests')
    leave_type = models.ForeignKey(LeaveType, on_delete=models.CASCADE, related_name='requests')
    
    # Leave details
    start_date = models.DateField()
    end_date = models.DateField()
    days_requested = models.DecimalField(max_digits=5, decimal_places=2)
    reason = models.TextField(blank=True)
    notes = models.TextField(blank=True, help_text="Additional notes or comments")
    
    # Status and workflow
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    submitted_at = models.DateTimeField(auto_now_add=True)
    
    # Approval workflow
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_leaves')
    approved_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True)
    
    # Emergency contact (for extended leave)
    emergency_contact = models.CharField(max_length=100, blank=True)
    emergency_phone = models.CharField(max_length=20, blank=True)
    
    # Attachments (for medical leave, etc.)
    attachment = models.FileField(upload_to='leave_attachments/', null=True, blank=True)
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def clean(self):
        """Validate leave request"""
        if self.start_date and self.end_date:
            if self.start_date > self.end_date:
                raise ValidationError("Start date cannot be after end date")
            
            # Check minimum notice
            if self.leave_type and self.leave_type.min_notice_days:
                notice_date = timezone.now().date() + timezone.timedelta(days=self.leave_type.min_notice_days)
                if self.start_date < notice_date:
                    raise ValidationError(f"Minimum {self.leave_type.min_notice_days} days notice required")
            
            # Check maximum advance booking
            if self.leave_type and self.leave_type.max_advance_days:
                max_date = timezone.now().date() + timezone.timedelta(days=self.leave_type.max_advance_days)
                if self.start_date > max_date:
                    raise ValidationError(f"Cannot request leave more than {self.leave_type.max_advance_days} days in advance")
            
            # Check maximum consecutive days
            if self.leave_type and self.leave_type.max_consecutive_days:
                requested_days = (self.end_date - self.start_date).days + 1
                if requested_days > self.leave_type.max_consecutive_days:
                    raise ValidationError(f"Maximum {self.leave_type.max_consecutive_days} consecutive days allowed")
    
    def save(self, *args, **kwargs):
        # Calculate days requested
        if self.start_date and self.end_date:
            self.days_requested = (self.end_date - self.start_date).days + 1
        
        self.clean()
        super().save(*args, **kwargs)
    
    @property
    def duration_days(self):
        """Calculate duration in days"""
        if self.start_date and self.end_date:
            return (self.end_date - self.start_date).days + 1
        return 0
    
    @property
    def is_pending(self):
        return self.status == 'PENDING'
    
    @property
    def is_approved(self):
        return self.status == 'APPROVED'
    
    @property
    def is_rejected(self):
        return self.status == 'REJECTED'
    
    @property
    def can_be_cancelled(self):
        """Check if leave can be cancelled"""
        return self.status in ['PENDING', 'APPROVED'] and self.start_date > timezone.now().date()
    
    def approve(self, approved_by_user):
        """Approve the leave request"""
        self.status = 'APPROVED'
        self.approved_by = approved_by_user
        self.approved_at = timezone.now()
        self.save()
        
        # Update leave balance
        self._update_leave_balance('approve')
    
    def reject(self, rejected_by_user, reason=""):
        """Reject the leave request"""
        self.status = 'REJECTED'
        self.approved_by = rejected_by_user
        self.approved_at = timezone.now()
        self.rejection_reason = reason
        self.save()
        
        # Update leave balance (remove from pending)
        self._update_leave_balance('reject')
    
    def cancel(self):
        """Cancel the leave request"""
        old_status = self.status
        self.status = 'CANCELLED'
        self.save()
        
        # Update leave balance
        if old_status == 'APPROVED':
            self._update_leave_balance('cancel_approved')
        elif old_status == 'PENDING':
            self._update_leave_balance('cancel_pending')
    
    def _update_leave_balance(self, action):
        """Update employee leave balance based on action"""
        try:
            balance, created = LeaveBalance.objects.get_or_create(
                employee=self.employee,
                leave_type=self.leave_type,
                year=self.start_date.year,
                defaults={'allocated_days': self.leave_type.annual_allocation}
            )

            if action == 'approve':
                balance.pending_days -= self.days_requested
                balance.used_days += self.days_requested
            elif action == 'reject':
                balance.pending_days -= self.days_requested
            elif action == 'reject_approved':
                # When rejecting an approved request, restore the used days
                balance.used_days -= self.days_requested
            elif action == 'cancel_approved':
                balance.used_days -= self.days_requested
            elif action == 'cancel_pending':
                balance.pending_days -= self.days_requested
            elif action == 'submit':
                balance.pending_days += self.days_requested
            
            balance.save()
        except Exception as e:
            # Log error but don't fail the main operation
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error updating leave balance: {str(e)}")
    
    def __str__(self):
        return f"{self.employee.user.get_full_name()} - {self.leave_type.display_name} ({self.start_date} to {self.end_date})"
    
    class Meta:
        ordering = ['-submitted_at']
        indexes = [
            models.Index(fields=['employee', 'status']),
            models.Index(fields=['start_date', 'end_date']),
            models.Index(fields=['leave_type', 'status']),
        ]


class LeaveApprovalWorkflow(models.Model):
    """Define approval workflow for leave requests"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    leave_type = models.ForeignKey(LeaveType, on_delete=models.CASCADE, related_name='approval_workflows')
    
    # Approval criteria
    min_days_threshold = models.DecimalField(max_digits=5, decimal_places=2, default=0, help_text="Minimum days to trigger this workflow")
    max_days_threshold = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True, help_text="Maximum days for this workflow")
    
    # Approvers
    approvers = models.ManyToManyField(User, related_name='leave_approval_workflows', help_text="Users who can approve this type of leave")
    requires_all_approvers = models.BooleanField(default=False, help_text="Requires approval from all approvers")
    
    # Auto-approval
    auto_approve = models.BooleanField(default=False)
    auto_approve_conditions = models.JSONField(default=dict, blank=True, help_text="Conditions for auto-approval")
    
    # Metadata
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.leave_type.display_name} - {self.min_days_threshold}+ days"
    
    class Meta:
        ordering = ['leave_type', 'min_days_threshold']
