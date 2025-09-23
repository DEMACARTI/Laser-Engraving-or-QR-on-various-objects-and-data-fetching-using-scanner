from flask import make_response, request
from functools import wraps

def cors_middleware(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        response = make_response(f(*args, **kwargs))
        
        # Get origin from request
        origin = request.headers.get('Origin', '*')
        
        # Allow requests from localhost during development
        if origin and ('localhost' in origin or '127.0.0.1' in origin):
            response.headers['Access-Control-Allow-Origin'] = origin
        else:
            # In production, allow requests from Vercel deployment
            response.headers['Access-Control-Allow-Origin'] = 'https://your-vercel-app-url.vercel.app'
        
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Origin, X-Requested-With, Content-Type, Accept, Authorization'
        response.headers['Access-Control-Allow-Credentials'] = 'true'
        
        return response
    return decorated_function