def build_context(chunks):
    """Turn retrieved chunks into a numbered source block for the prompt."""
    blocks = [
        f"[{chunk.source.number}] {chunk.source.title or chunk.source.url}\n{chunk.text}"
        for chunk in chunks
    ]
    return "Sources:\n\n" + "\n\n".join(blocks)
