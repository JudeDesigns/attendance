# Generated migration for break tracking enhancements

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('attendance', '0002_break'),
    ]

    operations = [
        # Add clock_out_reason field to track why employee clocked out
        migrations.AddField(
            model_name='timelog',
            name='clock_out_reason',
            field=models.CharField(
                max_length=50,
                choices=[
                    ('END_SHIFT', 'End of Shift'),
                    ('LUNCH_BREAK', 'Lunch Break'),
                    ('SHORT_BREAK', 'Short Break'),
                    ('PERSONAL_BREAK', 'Personal Break'),
                    ('EMERGENCY', 'Emergency'),
                    ('OTHER', 'Other'),
                ],
                blank=True,
                null=True,
                help_text="Reason for clocking out"
            ),
        ),
        
        # Add break_reminder_sent timestamp
        migrations.AddField(
            model_name='timelog',
            name='break_reminder_sent_at',
            field=models.DateTimeField(
                blank=True,
                null=True,
                help_text="When break reminder was last sent"
            ),
        ),
        
        # Add break_reminder_count
        migrations.AddField(
            model_name='timelog',
            name='break_reminder_count',
            field=models.IntegerField(
                default=0,
                help_text="Number of break reminders sent"
            ),
        ),
        
        # Add compliance tracking fields to Break model
        migrations.AddField(
            model_name='break',
            name='was_waived',
            field=models.BooleanField(
                default=False,
                help_text="Employee waived their break"
            ),
        ),
        
        migrations.AddField(
            model_name='break',
            name='waiver_reason',
            field=models.TextField(
                blank=True,
                help_text="Reason for waiving the break"
            ),
        ),
        
        migrations.AddField(
            model_name='break',
            name='is_compliant',
            field=models.BooleanField(
                default=True,
                help_text="Meets labor law requirements"
            ),
        ),
        
        migrations.AddField(
            model_name='break',
            name='reminder_acknowledged',
            field=models.BooleanField(
                default=False,
                help_text="Employee acknowledged break reminder"
            ),
        ),
        
        migrations.AddField(
            model_name='break',
            name='reminder_acknowledged_at',
            field=models.DateTimeField(
                blank=True,
                null=True,
                help_text="When break reminder was acknowledged"
            ),
        ),
    ]
