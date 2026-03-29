"""
Tests for Unscheduled Clock-in Feature

Verifies that employees can clock in/out without a scheduled shift
via Portal (clock_in), QR scan (qr_scan), and that shift_status
correctly reports is_unscheduled.
"""
from datetime import datetime, timedelta
from django.test import TestCase
from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework_simplejwt.tokens import RefreshToken

from apps.employees.models import Employee, Role, Location
from apps.attendance.models import TimeLog
from apps.scheduling.models import Shift


class UnscheduledClockInTestBase(TestCase):
    """Shared setup: one employee, one location, JWT auth."""

    @classmethod
    def setUpTestData(cls):
        cls.role = Role.objects.create(name='EMPLOYEE', permissions={})
        cls.user = User.objects.create_user(
            username='emp1', password='pass', first_name='Test', last_name='Employee'
        )
        cls.employee = Employee.objects.create(
            user=cls.user, employee_id='EMP-001', role=cls.role,
            hire_date='2024-01-01',
        )
        cls.location = Location.objects.create(
            name='Main Office',
            qr_code_payload='OFFICE-MAIN-01',
            is_active=True,
        )

    def setUp(self):
        token = RefreshToken.for_user(self.user)
        self.client.defaults['HTTP_AUTHORIZATION'] = f'Bearer {token.access_token}'

    # ── helpers ──────────────────────────────────────────────────────────
    def _clock_in_url(self):
        return '/api/v1/attendance/time-logs/clock_in/'

    def _clock_out_url(self):
        return '/api/v1/attendance/time-logs/clock_out/'

    def _qr_scan_url(self):
        return '/api/v1/attendance/time-logs/qr_scan/'

    def _shift_status_url(self):
        return '/api/v1/attendance/time-logs/shift_status/'

    def _create_current_shift(self):
        """Create a published shift covering 'now'."""
        now = timezone.now()
        return Shift.objects.create(
            employee=self.employee,
            start_time=now - timedelta(hours=1),
            end_time=now + timedelta(hours=7),
            is_published=True,
            created_by=self.user,
        )


# ═══════════════════════════════════════════════════════════════════════
# 1. Portal clock-in (clock_in endpoint)
# ═══════════════════════════════════════════════════════════════════════
class TestPortalClockInUnscheduled(UnscheduledClockInTestBase):
    """Portal clock-in should succeed even without a shift."""

    def test_clock_in_without_shift_returns_201(self):
        resp = self.client.post(self._clock_in_url(), {'method': 'PORTAL'})
        self.assertEqual(resp.status_code, 201)

    def test_clock_in_creates_timelog(self):
        self.client.post(self._clock_in_url(), {'method': 'PORTAL'})
        self.assertTrue(
            TimeLog.objects.filter(employee=self.employee, status='CLOCKED_IN').exists()
        )

    def test_clock_in_with_shift_still_works(self):
        self._create_current_shift()
        resp = self.client.post(self._clock_in_url(), {'method': 'PORTAL'})
        self.assertEqual(resp.status_code, 201)

    def test_double_clock_in_rejected(self):
        self.client.post(self._clock_in_url(), {'method': 'PORTAL'})
        resp = self.client.post(self._clock_in_url(), {'method': 'PORTAL'})
        self.assertEqual(resp.status_code, 400)

    def test_inactive_employee_rejected(self):
        self.employee.employment_status = 'INACTIVE'
        self.employee.save()
        resp = self.client.post(self._clock_in_url(), {'method': 'PORTAL'})
        self.assertEqual(resp.status_code, 403)
        self.employee.employment_status = 'ACTIVE'
        self.employee.save()

    def test_qr_method_on_portal_rejected(self):
        resp = self.client.post(self._clock_in_url(), {'method': 'QR_CODE'})
        self.assertEqual(resp.status_code, 403)


# ═══════════════════════════════════════════════════════════════════════
# 2. QR scan clock-in (qr_scan endpoint)
# ═══════════════════════════════════════════════════════════════════════
class TestQRScanClockInUnscheduled(UnscheduledClockInTestBase):
    """QR scan clock-in should succeed without a shift."""

    def test_qr_clock_in_without_shift_returns_200(self):
        resp = self.client.post(self._qr_scan_url(), {
            'qr_code': 'OFFICE-MAIN-01', 'action': 'clock_in',
        })
        self.assertEqual(resp.status_code, 200)

    def test_qr_clock_in_creates_timelog(self):
        self.client.post(self._qr_scan_url(), {
            'qr_code': 'OFFICE-MAIN-01', 'action': 'clock_in',
        })
        log = TimeLog.objects.filter(employee=self.employee, status='CLOCKED_IN').first()
        self.assertIsNotNone(log)
        self.assertEqual(log.clock_in_method, 'QR_CODE')
        self.assertEqual(log.clock_in_location, self.location)

    def test_qr_clock_out_after_unscheduled_clock_in(self):
        self.client.post(self._qr_scan_url(), {
            'qr_code': 'OFFICE-MAIN-01', 'action': 'clock_in',
        })
        resp = self.client.post(self._qr_scan_url(), {
            'qr_code': 'OFFICE-MAIN-01', 'action': 'clock_out',
        })
        self.assertEqual(resp.status_code, 200)
        log = TimeLog.objects.filter(employee=self.employee, status='CLOCKED_OUT').first()
        self.assertIsNotNone(log)

    def test_qr_double_clock_in_rejected(self):
        self.client.post(self._qr_scan_url(), {
            'qr_code': 'OFFICE-MAIN-01', 'action': 'clock_in',
        })
        resp = self.client.post(self._qr_scan_url(), {
            'qr_code': 'OFFICE-MAIN-01', 'action': 'clock_in',
        })
        self.assertEqual(resp.status_code, 400)

    def test_qr_invalid_code_rejected(self):
        resp = self.client.post(self._qr_scan_url(), {
            'qr_code': 'INVALID-CODE', 'action': 'clock_in',
        })
        self.assertEqual(resp.status_code, 400)


# ═══════════════════════════════════════════════════════════════════════
# 3. shift_status endpoint
# ═══════════════════════════════════════════════════════════════════════
class TestShiftStatusUnscheduled(UnscheduledClockInTestBase):
    """shift_status should report is_unscheduled and always allow clock-in."""

    def test_no_shift_is_unscheduled_true(self):
        resp = self.client.get(self._shift_status_url())
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data['is_unscheduled'])
        self.assertTrue(data['can_clock_in'])
        self.assertFalse(data['is_clocked_in'])

    def test_with_shift_is_unscheduled_false(self):
        self._create_current_shift()
        resp = self.client.get(self._shift_status_url())
        data = resp.json()
        self.assertFalse(data['is_unscheduled'])
        self.assertTrue(data['can_clock_in'])

    def test_clocked_in_cannot_clock_in_again(self):
        self.client.post(self._clock_in_url(), {'method': 'PORTAL'})
        resp = self.client.get(self._shift_status_url())
        data = resp.json()
        self.assertFalse(data['can_clock_in'])
        self.assertTrue(data['can_clock_out'])
        self.assertTrue(data['is_clocked_in'])

    def test_clock_in_time_present_when_clocked_in(self):
        self.client.post(self._clock_in_url(), {'method': 'PORTAL'})
        resp = self.client.get(self._shift_status_url())
        data = resp.json()
        self.assertIsNotNone(data['clock_in_time'])
        self.assertIsNotNone(data['duration_minutes'])


# ═══════════════════════════════════════════════════════════════════════
# 4. Full round-trip: unscheduled clock-in → clock-out
# ═══════════════════════════════════════════════════════════════════════
class TestUnscheduledRoundTrip(UnscheduledClockInTestBase):
    """End-to-end: portal clock-in without shift → clock-out → verify log."""

    def test_portal_round_trip(self):
        # Clock in
        resp = self.client.post(self._clock_in_url(), {'method': 'PORTAL'})
        self.assertEqual(resp.status_code, 201)
        # Clock out
        resp = self.client.post(self._clock_out_url(), {'method': 'PORTAL'})
        self.assertEqual(resp.status_code, 200)
        # Verify log
        log = TimeLog.objects.filter(employee=self.employee, status='CLOCKED_OUT').first()
        self.assertIsNotNone(log)
        self.assertIsNotNone(log.clock_out_time)
        self.assertEqual(log.attendance_status, 'UNSCHEDULED')

    def test_qr_round_trip(self):
        # Clock in
        self.client.post(self._qr_scan_url(), {
            'qr_code': 'OFFICE-MAIN-01', 'action': 'clock_in',
        })
        # Clock out
        resp = self.client.post(self._qr_scan_url(), {
            'qr_code': 'OFFICE-MAIN-01', 'action': 'clock_out',
        })
        self.assertEqual(resp.status_code, 200)
        log = TimeLog.objects.filter(employee=self.employee, status='CLOCKED_OUT').first()
        self.assertIsNotNone(log)
        self.assertEqual(log.attendance_status, 'UNSCHEDULED')

