from django.db import models
from django.contrib.auth.models import AbstractUser

# Custom user models for authentication
class User(AbstractUser):
    email = models.EmailField(unique=True)
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    
# class Employee(models.Model):
#     user = models.OneToOneField(User, on_delete=models.CASCADE)
#     first_name = models.CharField(max_length=100)
#     last_name = models.CharField(max_length=100)
#     email = models.EmailField(unique=True)
#     github_username = models.CharField(max_length=100)