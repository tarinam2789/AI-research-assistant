import logging

from asgiref.sync import async_to_sync
from celery import shared_task
from channels.layers import get_channel_layer
from pgvector.django import CosineDistance

from apps.citations.mapper import build_context
from apps.sources import services

from . import llm
from .models import Chunk, Question, Source

log = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "You are a research assistant. Answer using only the numbered sources provided. "
    "After every claim, cite the source number in square brackets, like [1]. "
    "Use one bracket per number, like [1][2], never [1, 2]. "
    "Only use source numbers that appear in the provided sources. "
    "Be concise and accurate. If the sources do not answer the question, say so."
)


def _emit(question_id, payload):
    async_to_sync(get_channel_layer().group_send)(
        f"question_{question_id}", {"type": "stream.event", "payload": payload}
    )


@shared_task
def run_research(question_id):
    question = Question.objects.get(pk=question_id)
    question.status = Question.Status.RUNNING
    question.save(update_fields=["status"])
    try:
        _research(question)
    except Exception as exc:
        log.exception("Research failed for question %s", question_id)
        question.status = Question.Status.FAILED
        question.error = str(exc)
        question.save(update_fields=["status", "error"])
        _emit(question.id, {"type": "error", "message": str(exc)})


def _research(question):
    _emit(question.id, {"type": "status", "message": "Searching the web..."})
    sources = []
    for result in services.search_web(question.text):
        text = services.fetch_text(result["url"]) or result.get("content", "")
        if not text:
            continue
        sources.append(
            Source.objects.create(
                question=question,
                number=len(sources) + 1,
                url=result["url"],
                title=(result.get("title") or "")[:500],
                content=text,
            )
        )
    if not sources:
        raise RuntimeError("No sources found for this question.")

    _emit(question.id, {"type": "status", "message": "Reading and indexing sources..."})
    pieces = [(s, c) for s in sources for c in services.chunk_text(s.content)]
    vectors = services.embed([c for _, c in pieces], "document")
    Chunk.objects.bulk_create(
        [Chunk(source=s, text=c, embedding=v) for (s, c), v in zip(pieces, vectors)]
    )

    query_vector = services.embed([question.text], "query")[0]
    top = list(
        Chunk.objects.filter(source__question=question)
        .select_related("source")
        .order_by(CosineDistance("embedding", query_vector))[:8]
    )

    _emit(
        question.id,
        {
            "type": "sources",
            "sources": [{"number": s.number, "title": s.title, "url": s.url} for s in sources],
        },
    )
    _emit(question.id, {"type": "status", "message": "Writing answer..."})

    parts = []
    prompt = build_context(top) + "\n\nQuestion: " + question.text
    for text in llm.stream_answer(SYSTEM_PROMPT, prompt):
        parts.append(text)
        _emit(question.id, {"type": "token", "text": text})

    question.answer = "".join(parts)
    question.status = Question.Status.DONE
    question.save(update_fields=["answer", "status"])
    _emit(question.id, {"type": "done"})
