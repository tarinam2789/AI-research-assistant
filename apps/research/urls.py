from django.urls import path

from .views import QuestionDetailView, QuestionListCreateView

urlpatterns = [
    path("api/questions/", QuestionListCreateView.as_view()),
    path("api/questions/<int:pk>/", QuestionDetailView.as_view()),
]
