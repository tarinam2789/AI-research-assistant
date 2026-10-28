from rest_framework import generics

from .models import Question
from .serializers import QuestionListSerializer, QuestionSerializer
from .tasks import run_research


class QuestionListCreateView(generics.ListCreateAPIView):
    def get_queryset(self):
        return Question.objects.order_by("-created_at")[:40]

    def get_serializer_class(self):
        if self.request.method == "GET":
            return QuestionListSerializer
        return QuestionSerializer

    def perform_create(self, serializer):
        question = serializer.save()
        run_research.delay(question.id)


class QuestionDetailView(generics.RetrieveDestroyAPIView):
    queryset = Question.objects.all()
    serializer_class = QuestionSerializer
