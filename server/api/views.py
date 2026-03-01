import json
from functools import wraps

from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt, ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST

from .models import ChatMessage, GameSettings, LobbyGame, Play, UserSettings


def login_required_json(view):
    @wraps(view)
    def wrapper(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Authentication required'}, status=401)
        return view(request, *args, **kwargs)
    return wrapper


def json_body(request):
    return json.loads(request.body) if request.body else {}


# --- Auth ---

@csrf_exempt
@require_POST
def register(request):
    data = json_body(request)
    username = data.get('username', '').strip()
    password = data.get('password', '')
    if not username or not password:
        return JsonResponse({'error': 'Username and password required'}, status=400)
    if User.objects.filter(username=username).exists():
        return JsonResponse({'error': 'Username already taken'}, status=409)
    user = User.objects.create_user(username=username, password=password)
    login(request, user)
    return JsonResponse({'id': user.id, 'username': user.username}, status=201)


@csrf_exempt
@require_POST
def login_view(request):
    data = json_body(request)
    user = authenticate(request, username=data.get('username', ''), password=data.get('password', ''))
    if user is None:
        return JsonResponse({'error': 'Invalid credentials'}, status=401)
    login(request, user)
    return JsonResponse({'id': user.id, 'username': user.username})


@csrf_exempt
@require_POST
def logout_view(request):
    logout(request)
    return JsonResponse({'ok': True})


@require_GET
@ensure_csrf_cookie
def me(request):
    if request.user.is_authenticated:
        return JsonResponse({'id': request.user.id, 'username': request.user.username})
    return JsonResponse({'user': None})


# --- Settings ---

@login_required_json
def user_settings(request):
    obj, _ = UserSettings.objects.get_or_create(user=request.user)
    if request.method == 'GET':
        return JsonResponse({'controls': obj.controls})
    if request.method == 'PUT':
        data = json_body(request)
        if 'controls' in data:
            obj.controls = data['controls']
        obj.save()
        return JsonResponse({'controls': obj.controls})
    return JsonResponse({'error': 'Method not allowed'}, status=405)


GAME_SETTINGS_FIELDS = [
    'playerCount', 'boardHeight', 'gameMode', 'startLevel',
    'gravityMode', 'manualShake', 'shakeAnimation', 'garbageHeight', 'sparsity',
]

@login_required_json
def game_settings(request):
    obj, _ = GameSettings.objects.get_or_create(user=request.user)
    if request.method == 'GET':
        return JsonResponse({f: getattr(obj, f) for f in GAME_SETTINGS_FIELDS})
    if request.method == 'PUT':
        data = json_body(request)
        for f in GAME_SETTINGS_FIELDS:
            if f in data:
                setattr(obj, f, data[f])
        obj.save()
        return JsonResponse({f: getattr(obj, f) for f in GAME_SETTINGS_FIELDS})
    return JsonResponse({'error': 'Method not allowed'}, status=405)


# --- Plays ---

PLAY_SUMMARY_FIELDS = [
    'id', 'score', 'level', 'lines', 'gameMode', 'gravityMode',
    'boardHeight', 'startLevel', 'garbageHeight', 'sparsity', 'manualShake',
]

PLAY_SUBMIT_FIELDS = [
    'score', 'level', 'lines', 'gameMode', 'gravityMode',
    'boardHeight', 'startLevel', 'garbageHeight', 'sparsity', 'manualShake', 'replay',
]

@login_required_json
def plays(request):
    if request.method == 'GET':
        qs = Play.objects.filter(user=request.user)[:50]
        result = []
        for p in qs:
            d = {f: getattr(p, f) for f in PLAY_SUMMARY_FIELDS}
            d['created_at'] = p.created_at.isoformat()
            result.append(d)
        return JsonResponse(result, safe=False)
    if request.method == 'POST':
        data = json_body(request)
        kwargs = {f: data[f] for f in PLAY_SUBMIT_FIELDS if f in data}
        play = Play.objects.create(user=request.user, **kwargs)
        d = {f: getattr(play, f) for f in PLAY_SUMMARY_FIELDS}
        d['created_at'] = play.created_at.isoformat()
        return JsonResponse(d, status=201)
    return JsonResponse({'error': 'Method not allowed'}, status=405)


@require_GET
@login_required_json
def play_detail(request, play_id):
    try:
        play = Play.objects.get(id=play_id, user=request.user)
    except Play.DoesNotExist:
        return JsonResponse({'error': 'Not found'}, status=404)
    d = {f: getattr(play, f) for f in PLAY_SUMMARY_FIELDS}
    d['created_at'] = play.created_at.isoformat()
    d['replay'] = play.replay
    return JsonResponse(d)


# --- Lobby ---

LOBBY_GAME_SETTINGS = [
    'gameMode', 'startLevel', 'boardHeight', 'gravityMode',
    'garbageHeight', 'sparsity', 'manualShake',
]

def serialize_game(g):
    d = {f: getattr(g, f) for f in LOBBY_GAME_SETTINGS}
    d['id'] = g.id
    d['host'] = g.host.username
    d['createdAt'] = g.created_at.isoformat()
    return d

@login_required_json
def lobby_games(request):
    if request.method == 'GET':
        games = LobbyGame.objects.filter(guest__isnull=True).select_related('host')
        return JsonResponse([serialize_game(g) for g in games], safe=False)
    if request.method == 'POST':
        data = json_body(request)
        kwargs = {f: data[f] for f in LOBBY_GAME_SETTINGS if f in data}
        game = LobbyGame.objects.create(host=request.user, **kwargs)
        return JsonResponse(serialize_game(game), status=201)
    return JsonResponse({'error': 'Method not allowed'}, status=405)


@require_POST
@login_required_json
def join_game(request, game_id):
    try:
        game = LobbyGame.objects.select_related('host').get(id=game_id)
    except LobbyGame.DoesNotExist:
        return JsonResponse({'error': 'Not found'}, status=404)
    if game.guest is not None:
        return JsonResponse({'error': 'Game already has a guest'}, status=400)
    if game.host == request.user:
        return JsonResponse({'error': 'Cannot join your own game'}, status=400)
    game.guest = request.user
    game.save()
    return JsonResponse(serialize_game(game))


@login_required_json
def lobby_chat(request):
    if request.method == 'GET':
        msgs = ChatMessage.objects.select_related('user').order_by('-created_at')[:100]
        result = [{'id': m.id, 'username': m.user.username, 'message': m.message, 'createdAt': m.created_at.isoformat()} for m in reversed(msgs)]
        return JsonResponse(result, safe=False)
    if request.method == 'POST':
        data = json_body(request)
        msg = ChatMessage.objects.create(user=request.user, message=data.get('message', '')[:500])
        return JsonResponse({'id': msg.id, 'username': request.user.username, 'message': msg.message, 'createdAt': msg.created_at.isoformat()}, status=201)
    return JsonResponse({'error': 'Method not allowed'}, status=405)
