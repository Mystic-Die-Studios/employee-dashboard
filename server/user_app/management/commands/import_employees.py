import csv
import json

from django.core.management.base import BaseCommand, CommandError

from user_app.models import Employee


class Command(BaseCommand):
    help = 'Import employees from a GitHub org members export (.csv or .json)'

    def add_arguments(self, parser):
        parser.add_argument('file_path', type=str)

    def handle(self, *args, **options):
        file_path = options['file_path']

        if file_path.endswith('.json'):
            rows = self._read_json(file_path)
        elif file_path.endswith('.csv'):
            rows = self._read_csv(file_path)
        else:
            raise CommandError('File must be .json or .csv')

        created, updated = 0, 0
        for row in rows:
            login = row.get('login')
            if not login:
                continue
            _, was_created = Employee.objects.update_or_create(
                github_username=login,
                defaults={
                    'name': row.get('name') or '',
                    'org_role': row.get('role') or '',
                },
            )
            created += was_created
            updated += not was_created

        self.stdout.write(self.style.SUCCESS(
            f'Imported {created + updated} employees ({created} created, {updated} updated)'
        ))

    def _read_json(self, file_path):
        with open(file_path) as f:
            return json.load(f)

    def _read_csv(self, file_path):
        with open(file_path, newline='') as f:
            return list(csv.DictReader(f))
