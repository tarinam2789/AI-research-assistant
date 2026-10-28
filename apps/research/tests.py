from unittest.mock import patch

import pytest

from apps.citations.mapper import build_context
from apps.sources.services import chunk_text


def test_chunk_text_overlaps():
    text = " ".join(str(i) for i in range(500))
    chunks = chunk_text(text, size=200, overlap=40)
    assert len(chunks) == 4
    assert chunks[1].split()[0] == "160"


def test_build_context_numbers_sources():
    class S:
        number = 2
        title = "Title"
        url = "https://example.com"

    class C:
        text = "hello"
        source = S()

    context = build_context([C()])
    assert "[2] Title" in context
    assert "hello" in context


@pytest.mark.django_db
def test_create_question(client):
    with patch("apps.research.views.start_research") as start:
        resp = client.post(
            "/api/questions/", {"text": "What is pgvector?"}, content_type="application/json"
        )
    assert resp.status_code == 201
    start.assert_called_once()
