import os
import subprocess
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from werkzeug.utils import secure_filename
from dotenv import load_dotenv

# 🔐 Load environment variables
load_dotenv()

# (Optional) Check API key
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
print("GROQ API KEY LOADED:", "YES" if GROQ_API_KEY else "NO")

# 🔥 IMPORT YOUR LOGIC
from utils.transcriber import transcribe_audio
from utils.extractor import generate_summary, extract_action_items, extract_decisions, extract_structured_action_items, chat_with_transcript

# ✅ FIXED FFMPEG PATH
FFMPEG_PATH = "ffmpeg"

app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER


@app.route("/", methods=["GET"])
def home():
    return jsonify({"message": "Meeting Highlights Flask API is running 🚀"})


@app.route("/process-audio", methods=["POST"])
def process_audio():
    try:
        if "file" not in request.files:
            return jsonify({"error": "No file"}), 400

        file = request.files["file"]

        if file.filename == "":
            return jsonify({"error": "Empty filename"}), 400

        filename = secure_filename(file.filename)
        file_path = os.path.join(app.config["UPLOAD_FOLDER"], filename)

        file.save(file_path)

        # 🔥 TRANSCRIBE
        transcript = transcribe_audio(file_path)

        # 🔥 GENERATE SUMMARY (Groq used inside utils)
        summary = generate_summary(transcript)

        # 🔥 ACTION ITEMS
        actions = extract_action_items(transcript)

        return jsonify({
            "filename": filename,
            "transcript": transcript,
            "summary": summary,
            "action_items": actions
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/transcribe-chunk", methods=["POST"])
def transcribe_chunk_endpoint():
    try:
        if "audio" not in request.files:
            return jsonify({"error": "No audio"}), 400

        file = request.files["audio"]
        chunk_path = os.path.join(app.config["UPLOAD_FOLDER"], "live_chunk.webm")
        file.save(chunk_path)

        mp3_path = chunk_path + ".mp3"

        subprocess.run([
            FFMPEG_PATH, "-y", "-i", chunk_path,
            "-vn", "-acodec", "libmp3lame", "-q:a", "2", mp3_path
        ], check=True, capture_output=True)

        text = transcribe_audio(mp3_path)

        os.remove(mp3_path)

        return jsonify({"text": text})

    except Exception:
        return jsonify({"text": ""}), 200


@app.route("/process-video", methods=["POST"])
def process_video():
    try:
        if "video" not in request.files:
            return jsonify({"error": "No video file"}), 400

        file = request.files["video"]
        filename = secure_filename(file.filename or "meeting.webm")

        video_path = os.path.join(app.config["UPLOAD_FOLDER"], filename)
        file.save(video_path)

        audio_path = video_path + ".mp3"

        subprocess.run([
            FFMPEG_PATH, "-y", "-i", video_path,
            "-vn", "-acodec", "libmp3lame", "-q:a", "2", audio_path
        ], check=True)

        transcript = transcribe_audio(audio_path)
        summary = generate_summary(transcript)
        actions = extract_action_items(transcript)

        os.remove(audio_path)

        return jsonify({
            "filename": filename,
            "transcript": transcript,
            "summary": summary,
            "action_items": actions
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/process-live", methods=["POST"])
def process_live():
    try:
        data = request.get_json()
        transcript = (data or {}).get("transcript", "").strip()
        if not transcript:
            return jsonify({"error": "No transcript provided"}), 400
        summary = generate_summary(transcript)
        actions = extract_action_items(transcript)
        return jsonify({"transcript": transcript, "summary": summary, "action_items": actions})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/process-transcript", methods=["POST"])
def process_transcript():
    try:
        if "file" not in request.files:
            return jsonify({"error": "No file"}), 400

        file = request.files["file"]
        filename = secure_filename(file.filename or "transcript.txt")
        ext = os.path.splitext(filename)[1].lower()

        if ext not in [".txt", ".vtt"]:
            return jsonify({"error": "Only .txt and .vtt files are supported"}), 400

        raw = file.read().decode("utf-8", errors="ignore")

        # Strip VTT formatting: remove header, timestamps, blank lines
        if ext == ".vtt":
            import re
            raw = re.sub(r"WEBVTT.*?\n", "", raw)
            raw = re.sub(r"\d{2}:\d{2}[:\.]\d{2}[.,]\d{3}\s*-->.*?\n", "", raw)
            raw = re.sub(r"^\d+\s*$", "", raw, flags=re.MULTILINE)
            raw = re.sub(r"\n{2,}", "\n", raw).strip()

        decisions = extract_decisions(raw)
        action_items = extract_structured_action_items(raw)

        return jsonify({
            "filename": filename,
            "transcript": raw,
            "decisions": decisions,
            "action_items": action_items
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500



@app.route("/extract-pdf", methods=["POST"])
def extract_pdf():
    try:
        if "file" not in request.files:
            return jsonify({"error": "No file"}), 400
        file = request.files["file"]
        if not file.filename.lower().endswith(".pdf"):
            return jsonify({"error": "Only PDF files supported"}), 400
        import pdfplumber, io
        text_pages = []
        with pdfplumber.open(io.BytesIO(file.read())) as pdf:
            for page in pdf.pages:
                t = page.extract_text()
                if t:
                    text_pages.append(t.strip())
        text = "\n".join(text_pages).strip()
        if not text:
            return jsonify({"error": "Could not extract text from PDF. It may be scanned/image-based."}), 400
        return jsonify({"text": text})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/chat", methods=["POST"])
def chat():
    try:
        data = request.get_json()
        question = (data or {}).get("question", "").strip()
        transcript = (data or {}).get("transcript", "").strip()
        meeting_name = (data or {}).get("meeting_name", "Meeting").strip()
        history = (data or {}).get("history", [])
        if not question:
            return jsonify({"error": "No question provided"}), 400
        if not transcript:
            return jsonify({"error": "No transcript provided"}), 400
        result = chat_with_transcript(question, transcript, meeting_name, history)
        return jsonify(result)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/convert", methods=["POST"])
def convert_video():
    try:
        if "video" not in request.files:
            return jsonify({"error": "No video file"}), 400

        file = request.files["video"]
        filename = secure_filename(file.filename)

        video_path = os.path.join(app.config["UPLOAD_FOLDER"], filename)
        file.save(video_path)

        audio_filename = os.path.splitext(filename)[0] + ".mp3"
        audio_path = os.path.join(app.config["UPLOAD_FOLDER"], audio_filename)

        subprocess.run([
            FFMPEG_PATH, "-y", "-i", video_path,
            "-vn", "-acodec", "libmp3lame", "-q:a", "2", audio_path
        ], check=True)

        return send_file(
            audio_path,
            mimetype="audio/mpeg",
            as_attachment=True,
            download_name=audio_filename
        )

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True)