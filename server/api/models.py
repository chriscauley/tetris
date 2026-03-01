from django.conf import settings
from django.db import models


class UserSettings(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='user_settings')
    controls = models.JSONField(default=dict)

    class Meta:
        verbose_name_plural = 'user settings'


class GameSettings(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='game_settings')
    playerCount = models.IntegerField(default=1)
    boardHeight = models.IntegerField(default=20)
    gameMode = models.CharField(max_length=10, default='a')
    startLevel = models.IntegerField(default=1)
    gravityMode = models.CharField(max_length=10, default='normal')
    manualShake = models.BooleanField(default=False)
    shakeAnimation = models.BooleanField(default=False)
    garbageHeight = models.IntegerField(default=0)
    sparsity = models.IntegerField(default=0)

    class Meta:
        verbose_name_plural = 'game settings'


class Play(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='plays')
    score = models.IntegerField(default=0)
    level = models.IntegerField(default=0)
    lines = models.IntegerField(default=0)
    gameMode = models.CharField(max_length=10, default='a')
    gravityMode = models.CharField(max_length=10, default='normal')
    boardHeight = models.IntegerField(default=20)
    startLevel = models.IntegerField(default=1)
    garbageHeight = models.IntegerField(default=0)
    sparsity = models.IntegerField(default=0)
    manualShake = models.BooleanField(default=False)
    replay = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']


class LobbyGame(models.Model):
    host = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='lobby_games')
    gameMode = models.CharField(max_length=10, default='a')
    startLevel = models.IntegerField(default=1)
    boardHeight = models.IntegerField(default=20)
    gravityMode = models.CharField(max_length=10, default='normal')
    garbageHeight = models.IntegerField(default=0)
    sparsity = models.IntegerField(default=0)
    manualShake = models.BooleanField(default=False)
    guest = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.CASCADE, related_name='joined_games')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']


class ChatMessage(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='chat_messages')
    message = models.CharField(max_length=500)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']
