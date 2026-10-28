from functools import lru_cache

import httpx
import trafilatura
from django.conf import settings
from fastembed import TextEmbedding


def search_web(query, max_results=5):
    resp = httpx.post(
        "https://api.tavily.com/search",
        headers={"Authorization": f"Bearer {settings.TAVILY_API_KEY}"},
        json={"query": query, "max_results": max_results},
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json().get("results", [])


def fetch_text(url):
    try:
        resp = httpx.get(
            url,
            follow_redirects=True,
            timeout=15,
            headers={"User-Agent": "Mozilla/5.0 (research-assistant)"},
        )
        resp.raise_for_status()
        return trafilatura.extract(resp.text) or ""
    except httpx.HTTPError:
        return ""


def chunk_text(text, size=200, overlap=40, max_chunks=40):
    words = text.split()
    step = size - overlap
    chunks = []
    for start in range(0, len(words), step):
        piece = words[start : start + size]
        if piece:
            chunks.append(" ".join(piece))
    return chunks[:max_chunks]


@lru_cache(maxsize=1)
def _model():
    return TextEmbedding(
        model_name=settings.EMBEDDING_MODEL,
        cache_dir=str(settings.BASE_DIR / ".fastembed"),
    )


def embed(texts, input_type):
    return [vector.tolist() for vector in _model().embed(texts)]
