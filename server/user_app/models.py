from django.db import models
from django.contrib.auth.models import AbstractUser

class User(AbstractUser):
    class Role(models.TextChoices):
        ADMIN    = 'admin',    'Admin'
        EMPLOYEE = 'employee', 'Employee'

    email = models.EmailField(unique=True)
    role  = models.CharField(max_length=20, choices=Role.choices, default=Role.EMPLOYEE)
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']
    
    groups = models.ManyToManyField(
        'auth.Group',
        related_name='user_app_users',
        blank=True,
    )
    user_permissions = models.ManyToManyField(
        'auth.Permission',
        related_name='user_app_users',
        blank=True,
    )
    
