from services.memory_service import search_memories


async def process(text: str) -> str:
    results = await search_memories(query=text, limit=3)

    if not results:
        return "I don't have any memories related to that."

    best = results[0]
    content = best.payload.get("content", "")

    if len(results) == 1:
        return f"You noted: {content}"

    lines = [f"Here's what I found ({len(results)} memories):"]
    for i, r in enumerate(results, 1):
        lines.append(f"  {i}. {r.payload.get('content', '')}")
    return "\n".join(lines)
