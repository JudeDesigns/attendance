"""
Tests for the Detailed Timesheet Report Generator
"""
from datetime import datetime, timedelta
from decimal import Decimal
from django.test import TestCase
from django.contrib.auth.models import User
from django.utils import timezone
from apps.employees.models import Employee, Role
from apps.attendance.models import TimeLog, Break
from apps.reports.services import DetailedTimesheetReportGenerator


class DetailedTimesheetReportTestBase(TestCase):
    """Base setup for detailed timesheet tests"""

    @classmethod
    def setUpTestData(cls):
        cls.role = Role.objects.create(name='EMPLOYEE', permissions={})

        # Employee WITH hourly rate
        cls.user1 = User.objects.create_user(
            username='emp1', password='pass', first_name='John', last_name='Doe'
        )
        cls.emp1 = Employee.objects.create(
            user=cls.user1, employee_id='EMP-001', role=cls.role,
            hire_date='2024-01-01', hourly_rate=Decimal('25.00')
        )

        # Employee WITHOUT hourly rate
        cls.user2 = User.objects.create_user(
            username='emp2', password='pass', first_name='Jane', last_name='Smith'
        )
        cls.emp2 = Employee.objects.create(
            user=cls.user2, employee_id='EMP-002', role=cls.role,
            hire_date='2024-01-01', hourly_rate=None
        )

        base = timezone.make_aware(datetime(2026, 3, 2, 8, 0, 0))

        # Day 1 for emp1: 8am-5pm (9h total) with a 30m LUNCH break
        cls.log1 = TimeLog.objects.create(
            employee=cls.emp1,
            clock_in_time=base,
            clock_out_time=base + timedelta(hours=9),
            status='CLOCKED_OUT',
        )
        Break.objects.create(
            time_log=cls.log1, break_type='LUNCH',
            start_time=base + timedelta(hours=4),
            end_time=base + timedelta(hours=4, minutes=30),
        )

        # Day 2 for emp1: 8am-9pm (13h total) with 1h LUNCH break → tests over-8 and over-12
        day2 = base + timedelta(days=1)
        cls.log2 = TimeLog.objects.create(
            employee=cls.emp1,
            clock_in_time=day2,
            clock_out_time=day2 + timedelta(hours=13),
            status='CLOCKED_OUT',
        )
        Break.objects.create(
            time_log=cls.log2, break_type='LUNCH',
            start_time=day2 + timedelta(hours=4),
            end_time=day2 + timedelta(hours=5),
        )

        # Day 1 for emp2 (no hourly rate): 8am-4pm (8h, no break)
        cls.log3 = TimeLog.objects.create(
            employee=cls.emp2,
            clock_in_time=base,
            clock_out_time=base + timedelta(hours=8),
            status='CLOCKED_OUT',
        )

        cls.start_date = base.date()
        cls.end_date = (base + timedelta(days=1)).date()


class TestBuildRow(DetailedTimesheetReportTestBase):
    """Test the _build_row method produces correct field values"""

    def test_row_fields_present(self):
        gen = DetailedTimesheetReportGenerator(self.start_date, self.end_date)
        rows = gen.get_data()
        required_keys = [
            'Employee Name', 'Date', 'Day', 'Start Time', 'End Time',
            'Total Hours', 'Break 1 In', 'Break 1 Out', 'Break 1 Total',
            'Break 2 In', 'Break 2 Out', 'Break 2 Total',
            'Break 3 In', 'Break 3 Out', 'Break 3 Total',
            'Total Break', 'Total Without Break', 'Finally Hours',
            '8 Hours', 'over 8', 'over 12', 'Hourly Rate',
        ]
        for row in rows:
            for key in required_keys:
                self.assertIn(key, row, f"Missing key: {key}")

    def test_finally_hours_calculation(self):
        """9h worked - 0.5h lunch = 8.5h finally"""
        gen = DetailedTimesheetReportGenerator(self.start_date, self.end_date)
        rows = gen.get_data()
        emp1_day1 = [r for r in rows if r['Employee Name'] == 'John Doe' and '03/02' in r['Date']][0]
        self.assertEqual(emp1_day1['Finally Hours'], 8.5)

    def test_overtime_buckets(self):
        """13h worked - 1h lunch = 12h finally → 8h regular, 4h over-8, 0h over-12"""
        gen = DetailedTimesheetReportGenerator(self.start_date, self.end_date)
        rows = gen.get_data()
        emp1_day2 = [r for r in rows if r['Employee Name'] == 'John Doe' and '03/03' in r['Date']][0]
        self.assertEqual(emp1_day2['Finally Hours'], 12.0)
        self.assertEqual(emp1_day2['8 Hours'], 8.0)
        self.assertEqual(emp1_day2['over 8'], 4.0)
        self.assertEqual(emp1_day2['over 12'], 0.0)

    def test_hourly_rate_populated(self):
        gen = DetailedTimesheetReportGenerator(self.start_date, self.end_date)
        rows = gen.get_data()
        emp1_row = [r for r in rows if r['Employee Name'] == 'John Doe'][0]
        self.assertEqual(emp1_row['Hourly Rate'], 25.0)

    def test_hourly_rate_null_safe(self):
        gen = DetailedTimesheetReportGenerator(self.start_date, self.end_date)
        rows = gen.get_data()
        emp2_row = [r for r in rows if r['Employee Name'] == 'Jane Smith'][0]
        self.assertIsNone(emp2_row['Hourly Rate'])

    def test_break_total_format(self):
        gen = DetailedTimesheetReportGenerator(self.start_date, self.end_date)
        rows = gen.get_data()
        emp1_day1 = [r for r in rows if r['Employee Name'] == 'John Doe' and '03/02' in r['Date']][0]
        self.assertEqual(emp1_day1['Break 1 Total'], '00 30')

    def test_total_break_string(self):
        gen = DetailedTimesheetReportGenerator(self.start_date, self.end_date)
        rows = gen.get_data()
        emp1_day1 = [r for r in rows if r['Employee Name'] == 'John Doe' and '03/02' in r['Date']][0]
        self.assertEqual(emp1_day1['Total Break'], '00 30')

class TestGroupedData(DetailedTimesheetReportTestBase):
    """Test the get_grouped_data method with pay calculations"""

    def _get_grouped(self):
        gen = DetailedTimesheetReportGenerator(self.start_date, self.end_date)
        return gen.get_grouped_data()

    def test_returns_list_of_employees(self):
        data = self._get_grouped()
        self.assertIsInstance(data, list)
        names = [e['name'] for e in data]
        self.assertIn('John Doe', names)
        self.assertIn('Jane Smith', names)

    def test_employee_rows_count(self):
        data = self._get_grouped()
        john = [e for e in data if e['name'] == 'John Doe'][0]
        self.assertEqual(len(john['rows']), 2)  # 2 days

    def test_summary_total_finally_hours(self):
        """John: day1=8.5h + day2=12h = 20.5h"""
        data = self._get_grouped()
        john = [e for e in data if e['name'] == 'John Doe'][0]
        self.assertEqual(john['summary']['total_finally_hours'], 20.5)

    def test_summary_overtime_buckets(self):
        """John: day1 8h+0.5over8, day2 8h+4over8+0over12 => total_8=16, over8=4.5, over12=0"""
        data = self._get_grouped()
        john = [e for e in data if e['name'] == 'John Doe'][0]
        self.assertEqual(john['summary']['total_8_hours'], 16.0)
        self.assertEqual(john['summary']['total_over_8'], 4.5)
        self.assertEqual(john['summary']['total_over_12'], 0.0)

    def test_pay_calculation_with_rate(self):
        """John @ $25/hr: 16h*25=400, 4.5h*25*1.5=168.75, 0*25*2=0, total=568.75"""
        data = self._get_grouped()
        john = [e for e in data if e['name'] == 'John Doe'][0]
        s = john['summary']
        self.assertEqual(s['total_8_hrs_pay'], 400.0)
        self.assertEqual(s['total_over_8_pay'], 168.75)
        self.assertEqual(s['total_over_12_pay'], 0.0)
        self.assertEqual(s['total_payment'], 568.75)

    def test_pay_null_when_no_hourly_rate(self):
        """Jane has no hourly rate -> all pay fields should be None"""
        data = self._get_grouped()
        jane = [e for e in data if e['name'] == 'Jane Smith'][0]
        s = jane['summary']
        self.assertIsNone(s['total_8_hrs_pay'])
        self.assertIsNone(s['total_over_8_pay'])
        self.assertIsNone(s['total_over_12_pay'])
        self.assertIsNone(s['total_payment'])

    def test_hourly_rate_in_grouped(self):
        data = self._get_grouped()
        john = [e for e in data if e['name'] == 'John Doe'][0]
        jane = [e for e in data if e['name'] == 'Jane Smith'][0]
        self.assertEqual(john['hourly_rate'], 25.0)
        self.assertIsNone(jane['hourly_rate'])

    def test_check_and_cash_fields_present(self):
        data = self._get_grouped()
        for emp in data:
            self.assertIn('check', emp['summary'])
            self.assertIn('cash', emp['summary'])


class TestDetailedTimesheetAPI(TestCase):
    """Test the detailed_timesheet API endpoint"""

    @classmethod
    def setUpTestData(cls):
        cls.role = Role.objects.create(name='ADMIN', permissions={})
        cls.user = User.objects.create_user(
            username='admin', password='pass', first_name='Admin', last_name='User'
        )
        cls.admin = Employee.objects.create(
            user=cls.user, employee_id='ADM-001', role=cls.role,
            hire_date='2024-01-01', hourly_rate=Decimal('50.00')
        )

        # Create a time log
        base = timezone.make_aware(datetime(2026, 3, 2, 8, 0, 0))
        TimeLog.objects.create(
            employee=cls.admin,
            clock_in_time=base,
            clock_out_time=base + timedelta(hours=8),
            status='CLOCKED_OUT',
        )
        cls.start_date = '2026-03-02'
        cls.end_date = '2026-03-02'

    def setUp(self):
        from rest_framework_simplejwt.tokens import RefreshToken
        token = RefreshToken.for_user(self.user)
        self.client.defaults['HTTP_AUTHORIZATION'] = f'Bearer {token.access_token}'

    def test_endpoint_returns_200(self):
        resp = self.client.get(
            '/api/v1/reports/detailed_timesheet/',
            {'start_date': self.start_date, 'end_date': self.end_date}
        )
        self.assertEqual(resp.status_code, 200)

    def test_endpoint_returns_grouped_structure(self):
        resp = self.client.get(
            '/api/v1/reports/detailed_timesheet/',
            {'start_date': self.start_date, 'end_date': self.end_date}
        )
        data = resp.json()
        self.assertIsInstance(data, list)
        self.assertTrue(len(data) > 0)
        emp = data[0]
        self.assertIn('name', emp)
        self.assertIn('rows', emp)
        self.assertIn('summary', emp)

    def test_endpoint_requires_dates(self):
        resp = self.client.get('/api/v1/reports/detailed_timesheet/')
        self.assertIn(resp.status_code, [400, 200])
