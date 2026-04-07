import os
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

MAX_CHARS = 12000  # faster


def _chat(prompt):
    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}]
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print("Groq error:", e)
        return "Error generating response"


def _chunk_text(text, max_chars=MAX_CHARS):
    return [text[i:i+max_chars] for i in range(0, len(text), max_chars)]


def generate_summary(transcript):
    if not transcript:
        return "No transcript available"

    chunks = _chunk_text(transcript)

    summaries = []
    for chunk in chunks:
        summaries.append(_chat(f"Summarize this:\n{chunk}"))

    return "\n".join(summaries)


def extract_action_items(transcript):
    if not transcript:
        return []

    chunks = _chunk_text(transcript)
    actions = []

    for chunk in chunks:
        result = _chat(f"List action items as a plain numbered list, one per line, no blank lines:\n{chunk}")
        actions.extend([line.strip() for line in result.split("\n") if line.strip()])

    return actions


def extract_decisions(transcript):
    if not transcript:
        return []

    chunks = _chunk_text(transcript)
    decisions = []

    for chunk in chunks:
        result = _chat(
            f"Extract only the decisions (things the team agreed on) from this transcript as a plain numbered list, one per line, no blank lines. If none, reply 'None':\n{chunk}"
        )
        if result.strip().lower() != "none":
            decisions.extend([line.strip() for line in result.split("\n") if line.strip()])

    return decisions


def extract_structured_action_items(transcript):
    if not transcript:
        return []

    chunks = _chunk_text(transcript)
    all_items = []

    for chunk in chunks:
        result = _chat(
            "Extract action items from this transcript. For each, output exactly one line in this format:\n"
            "PERSON | TASK | DEADLINE\n"
            "If deadline is not mentioned use 'Not specified'. No blank lines, no extra text.\n\n"
            f"{chunk}"
        )
        for line in result.split("\n"):
            line = line.strip()
            if "|" in line:
                parts = [p.strip() for p in line.split("|")]
                if len(parts) == 3:
                    all_items.append({"person": parts[0], "task": parts[1], "deadline": parts[2]})

    return all_items


def chat_with_transcript(question, transcript, meeting_name):
    """Answer a question about a transcript with cited excerpts."""
    if not transcript or not question:
        return {"answer": "No transcript provided.", "citations": []}

    import re
    sentences = re.split(r'(?<=[.!?])\s+', transcript.strip())
    segment_size = 4
    segments = []
    for i in range(0, len(sentences), segment_size):
        seg = " ".join(sentences[i:i + segment_size]).strip()
        if seg:
            segments.append({"id": i // segment_size + 1, "text": seg})

    q_words = set(re.sub(r'[^\w\s]', '', question.lower()).split())
    stopwords = {"what", "who", "why", "how", "when", "did", "was", "were", "the", "a", "an",
                 "is", "are", "in", "on", "at", "to", "of", "and", "or", "for", "with", "that"}
    q_words -= stopwords

    def score(seg):
        words = set(re.sub(r'[^\w\s]', '', seg["text"].lower()).split())
        return len(q_words & words)

    ranked = sorted(segments, key=score, reverse=True)
    top = ranked[:5] if len(ranked) >= 5 else ranked
    top = sorted(top, key=lambda s: s["id"])

    context = "\n\n".join([f"[Segment {s['id']}]: {s['text']}" for s in top])

    prompt = (
        f"You are an AI assistant answering questions about a meeting transcript.\n"
        f"Meeting: {meeting_name}\n\n"
        f"Relevant transcript segments:\n{context}\n\n"
        f"Question: {question}\n\n"
        f"Instructions:\n"
        f"1. Write a clear, concise answer based only on the transcript above.\n"
        f"2. After the answer, output a SOURCES block in exactly this format (one line per source):\n"
        f"SOURCES:\n"
        f"- Speaker Name (Role) – brief quote or point they made [timestamp if present, else omit]\n"
        f"- Speaker Name (Role) – brief quote or point they made [timestamp if present, else omit]\n"
        f"3. Extract speaker name, role, and timestamp directly from the transcript text if available.\n"
        f"4. If a speaker has no role mentioned, write their name only without parentheses.\n"
        f"5. If the answer is not in the transcript, say so clearly and output SOURCES: None."
    )

    raw = _chat(prompt)

    answer = raw
    citations = []

    if "SOURCES:" in raw:
        parts = raw.split("SOURCES:", 1)
        answer = parts[0].strip()
        sources_block = parts[1].strip()

        if sources_block.lower() != "none":
            for line in sources_block.split("\n"):
                line = line.strip().lstrip("- ").strip()
                if not line:
                    continue
                # Extract timestamp like [00:01:40]
                ts_match = re.search(r'\[(\d{2}:\d{2}(?::\d{2})?)\]', line)
                timestamp = ts_match.group(0) if ts_match else ""
                line_clean = re.sub(r'\[\d{2}:\d{2}(?::\d{2})?\]', '', line).strip()
                citations.append({
                    "source_line": line_clean,
                    "timestamp": timestamp,
                    "meeting": meeting_name
                })

    return {"answer": answer, "citations": citations}