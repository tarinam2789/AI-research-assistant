from django.urls import path

from .consumers import ResearchConsumer

websocket_urlpatterns = [
    path("ws/questions/<int:question_id>/", ResearchConsumer.as_asgi()),
]
