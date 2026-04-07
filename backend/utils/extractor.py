import os
import time
from groq import Groq, RateLimitError
from dotenv import load_dotenv

load_dotenv()

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

MAX_CHARS = 12000  # faster


def _chat(prompt, retries=3):
    for attempt in range(retries):
        try:
            response = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[{"role": "user", "content": prompt}]
            )
            return response.choices[0].message.content.strip()
        except RateLimitError as e:
            import re
            match = re.search(r'try again in (\d+\.?\d*)s', str(e))
            wait = float(match.group(1)) + 1 if match else 20 * (attempt + 1)
            print(f"Rate limit hit, waiting {wait:.1f}s... (attempt {attempt+1}/{retries})")
            time.sleep(wait)
        except Exception as e:
            print("Groq error:", e)
            raise
    raise Exception("Rate limit exceeded after retries. Please wait a moment and try again.")


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


def chat_with_transcript(question, transcript, meeting_name, history=None):
    """Answer a question about a transcript with conversation history and cited sources."""
    if not transcript or not question:
        return {"answer": "No transcript provided.", "citations": []}

    import re

    # Trim transcript to fit within token limits (~12000 chars)
    transcript_context = transcript[:12000] if len(transcript) > 12000 else transcript

    # Build conversation messages with full history
    messages = [
        {
            "role": "system",
            "content": (
                f"You are an AI assistant that answers questions about a meeting transcript.\n"
                f"Meeting: {meeting_name}\n\n"
                f"FULL TRANSCRIPT:\n{transcript_context}\n\n"
                f"Instructions:\n"
                f"1. Answer accurately using only the transcript above.\n"
                f"2. Use conversation history to understand follow-up questions.\n"
                f"3. After your answer, output a SOURCES block in exactly this format:\n"
                f"SOURCES:\n"
                f"- Speaker Name (Role) – what they said or decided [timestamp if present]\n"
                f"4. Extract speaker name, role, timestamp directly from the transcript.\n"
                f"5. If no role is mentioned, write name only without parentheses.\n"
                f"6. If the answer is not in the transcript, say so and output SOURCES: None."
            )
        }
    ]

    # Add previous conversation turns
    for turn in (history or []):
        if turn.get("role") in ("user", "assistant") and turn.get("content"):
            messages.append({"role": turn["role"], "content": turn["content"]})

    # Add current question
    messages.append({"role": "user", "content": question})

    # Call Groq with full message history
    for attempt in range(3):
        try:
            response = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=messages
            )
            raw = response.choices[0].message.content.strip()
            break
        except RateLimitError as e:
            match = re.search(r'try again in (\d+\.?\d*)s', str(e))
            wait = float(match.group(1)) + 1 if match else 20 * (attempt + 1)
            print(f"Rate limit, waiting {wait:.1f}s...")
            time.sleep(wait)
    else:
        raise Exception("Rate limit exceeded after retries. Please wait a moment and try again.")

    # Parse answer and SOURCES block
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
                ts_match = re.search(r'\[(\d{2}:\d{2}(?::\d{2})?)\]', line)
                timestamp = ts_match.group(0) if ts_match else ""
                line_clean = re.sub(r'\[\d{2}:\d{2}(?::\d{2})?\]', '', line).strip()
                citations.append({
                    "source_line": line_clean,
                    "timestamp": timestamp,
                    "meeting": meeting_name
                })

    return {"answer": answer, "citations": citations}