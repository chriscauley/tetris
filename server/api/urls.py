from django.urls import path

from . import views

urlpatterns = [
    path('auth/register', views.register),
    path('auth/login', views.login_view),
    path('auth/logout', views.logout_view),
    path('auth/me', views.me),
    path('settings', views.user_settings),
    path('game-settings', views.game_settings),
    path('plays', views.plays),
    path('plays/<int:play_id>', views.play_detail),
    path('lobby/games', views.lobby_games),
    path('lobby/games/<int:game_id>/join', views.join_game),
    path('lobby/chat', views.lobby_chat),
]
