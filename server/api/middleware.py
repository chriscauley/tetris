ALLOWED_ORIGIN = 'http://localhost:5179'


class CorsMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.method == 'OPTIONS':
            response = self._preflight_response()
        else:
            response = self.get_response(request)
            response['Access-Control-Allow-Origin'] = ALLOWED_ORIGIN
            response['Access-Control-Allow-Credentials'] = 'true'
        return response

    def _preflight_response(self):
        from django.http import HttpResponse
        response = HttpResponse()
        response['Access-Control-Allow-Origin'] = ALLOWED_ORIGIN
        response['Access-Control-Allow-Credentials'] = 'true'
        response['Access-Control-Allow-Methods'] = 'GET, POST, PUT, OPTIONS'
        response['Access-Control-Allow-Headers'] = 'Content-Type, X-CSRFToken'
        response['Access-Control-Max-Age'] = '86400'
        return response
