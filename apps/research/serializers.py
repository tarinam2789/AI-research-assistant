from rest_framework import serializers

from .models import Question, Source


class SourceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Source
        fields = ["number", "url", "title"]


class QuestionSerializer(serializers.ModelSerializer):
    sources = SourceSerializer(many=True, read_only=True)

    class Meta:
        model = Question
        fields = ["id", "text", "answer", "status", "error", "created_at", "sources"]
        read_only_fields = ["answer", "status", "error", "created_at"]


class QuestionListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Question
        fields = ["id", "text", "status", "created_at"]
