import threading

from django.conf import settings
from django.db import connection
from rest_framework import generics

from .models import Question
from .serializers import QuestionListSerializer, QuestionSerializer
from .tasks import run_research


def _run_in_thread(question_id):
    try:
        run_research(question_id)
    finally:
        connection.close()


def start_research(question_id):
    if settings.USE_CELERY:
        run_research.delay(question_id)
    else:
        threading.Thread(target=_run_in_thread, args=(question_id,), daemon=True).start()


class QuestionListCreateView(generics.ListCreateAPIView):
    def get_queryset(self):
        return Question.objects.order_by("-created_at")[:40]

    def get_serializer_class(self):
        if self.request.method == "GET":
            return QuestionListSerializer
        return QuestionSerializer

    def perform_create(self, serializer):
        question = serializer.save()
        start_research(question.id)


class QuestionDetailView(generics.RetrieveDestroyAPIView):
    queryset = Question.objects.all()
    serializer_class = QuestionSerializer
