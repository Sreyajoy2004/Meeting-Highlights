import os
import re
import subprocess
import math
import time
from groq import Groq, RateLimitError
from dotenv import load_dotenv

load_dotenv()
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

FFMPEG = "ffmpeg"
FFPROBE = "ffprobe"
CHUNK_MINUTES = 10

def get_duration(file_path):
    result = subprocess.run(
        [FFPROBE, "-v", "error", "-show_entries",
         "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", file_path],
        capture_output=True, text=True
    )
    try:
        return float(result.stdout.strip())
    except:
        return 0

def transcribe_chunk(chunk_path, retries=3):
    for attempt in range(retries):
        try:
            with open(chunk_path, "rb") as f:
                result = client.audio.transcriptions.create(
                    model="whisper-large-v3",   # most accurate model
                    file=f,
                    response_format="text",
                    language="en",
                )
            text = result.strip() if isinstance(result, str) else str(result).strip()
            return text
        except RateLimitError as e:
            match = re.search(r'try again in (\d+)m(\d+)s', str(e))
            wait = int(match.group(1)) * 60 + int(match.group(2)) + 5 if match else 60 * (attempt + 1)
            print(f"Rate limit hit, waiting {wait}s... retry {attempt+1}/{retries}")
            time.sleep(wait)
    raise Exception("Rate limit exceeded after retries.")

def transcribe_audio(file_path):
    duration = get_duration(file_path)
    if duration == 0:
        return ""

    chunk_sec = CHUNK_MINUTES * 60
    total_chunks = math.ceil(duration / chunk_sec)
    print(f"Audio duration: {duration:.0f}s, {total_chunks} chunk(s)")

    transcripts = []
    for i in range(total_chunks):
        start = i * chunk_sec
        chunk_path = f"{file_path}_chunk{i}.mp3"

        subprocess.run([
            FFMPEG, "-y", "-i", file_path,
            "-ss", str(start), "-t", str(chunk_sec),
            "-ar", "16000", "-ac", "1",   # 16kHz mono — Whisper optimal, no noise filter
            "-q:a", "0", chunk_path
        ], capture_output=True)

        print(f"Transcribing chunk {i+1}/{total_chunks}...")
        text = transcribe_chunk(chunk_path)
        if text:
            transcripts.append(text)

        if os.path.exists(chunk_path):
            os.remove(chunk_path)

    return " ".join(transcripts).strip()
