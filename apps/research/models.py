from django.db import models
from pgvector.django import VectorField


class Question(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending"
        RUNNING = "running"
        DONE = "done"
        FAILED = "failed"

    text = models.TextField()
    answer = models.TextField(blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    error = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class Source(models.Model):
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name="sources")
    number = models.PositiveSmallIntegerField()
    url = models.URLField(max_length=2000)
    title = models.CharField(max_length=500, blank=True)
    content = models.TextField(blank=True)

    class Meta:
        ordering = ["number"]


class Chunk(models.Model):
    source = models.ForeignKey(Source, on_delete=models.CASCADE, related_name="chunks")
    text = models.TextField()
    embedding = VectorField(dimensions=384)
