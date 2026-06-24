from django.db import models
from django.contrib.auth.models import AbstractUser

# Custom user models for authentication
class User(AbstractUser):
    email = models.EmailField(unique=True)
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']
    
    # Added groups and user permissions for the User model to prevent clash with Django default
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
    
# class Employee(models.Model):
#     user = models.OneToOneField(User, on_delete=models.CASCADE)
#     first_name = models.CharField(max_length=100)
#     last_name = models.CharField(max_length=100)
#     email = models.EmailField(unique=True)
#     github_username = models.CharField(max_length=100)