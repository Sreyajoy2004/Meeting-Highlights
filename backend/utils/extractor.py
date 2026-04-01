import os
from groq import Groq
from dotenv import load_dotenv

load_dotenv()
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

MAX_CHARS = 20000

def _chat(prompt):
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}]
    )
    return response.choices[0].message.content.strip()

def _chunk_text(text, max_chars=MAX_CHARS):
    return [text[i:i+max_chars] for i in range(0, len(text), max_chars)]

def generate_summary(transcript):
    chunks = _chunk_text(transcript)
    if len(chunks) == 1:
        return _chat(f"Summarize this meeting transcript in a few sentences:\n\n{transcript}")
    chunk_summaries = [_chat(f"Summarize this part of a meeting transcript:\n\n{chunk}") for chunk in chunks]
    combined = "\n".join(chunk_summaries)
    return _chat(f"Combine these summaries into one concise summary:\n\n{combined}")

def extract_action_items(transcript):
    chunks = _chunk_text(transcript)
    all_items = []
    for chunk in chunks:
        result = _chat(
            f"Extract action items from this meeting transcript. "
            f"Try to identify who is responsible for each action based on context (e.g. who said they will do it, who was asked to do it). "
            f"Return format per line: 'Action description - Assigned to: Person Name' or 'Assigned to: Unknown' if unclear. "
            f"Only a numbered list, one action item per line, no extra text:\n\n{chunk}"
        )
        lines = [line.strip() for line in result.splitlines() if line.strip()]
        all_items.extend([line.lstrip("0123456789.-) ") for line in lines])
    return all_items
