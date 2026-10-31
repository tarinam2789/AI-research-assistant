from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent
env = environ.Env()
environ.Env.read_env(BASE_DIR / ".env")

SECRET_KEY = env("DJANGO_SECRET_KEY", default="dev-secret")
DEBUG = env.bool("DJANGO_DEBUG", default=True)
ALLOWED_HOSTS = ["*"]

INSTALLED_APPS = [
    "daphne",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "channels",
    "apps.research",
    "apps.sources",
    "apps.citations",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ]
        },
    }
]

ASGI_APPLICATION = "config.asgi.application"

DATABASES = {"default": env.db("DATABASE_URL")}

REDIS_URL = env("REDIS_URL", default="redis://redis:6379/0")
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {"hosts": [REDIS_URL]},
    }
}
CELERY_BROKER_URL = REDIS_URL

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [],
    "DEFAULT_PERMISSION_CLASSES": [],
}

GEMINI_API_KEY = env("GEMINI_API_KEY", default="")
TAVILY_API_KEY = env("TAVILY_API_KEY", default="")
GEMINI_MODEL = env("GEMINI_MODEL", default="gemini-flash-latest")
EMBEDDING_MODEL = env("EMBEDDING_MODEL", default="BAAI/bge-small-en-v1.5")

STATIC_URL = "static/"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
USE_TZ = True

USE_CELERY = env.bool("USE_CELERY", default=True)
EMBEDDING_BACKEND = env("EMBEDDING_BACKEND", default="local")
GEMINI_EMBEDDING_MODEL = env("GEMINI_EMBEDDING_MODEL", default="gemini-embedding-001")
MAX_CHUNKS_PER_SOURCE = env.int("MAX_CHUNKS_PER_SOURCE", default=40)

_frontend_dist = BASE_DIR / "frontend_dist"
if _frontend_dist.exists():
    WHITENOISE_ROOT = _frontend_dist
    WHITENOISE_INDEX_FILE = True

GEMINI_FALLBACK_MODEL = env("GEMINI_FALLBACK_MODEL", default="gemini-flash-lite-latest")
