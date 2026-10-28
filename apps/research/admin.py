from django.contrib import admin

from .models import Chunk, Question, Source

admin.site.register(Question)
admin.site.register(Source)
admin.site.register(Chunk)
