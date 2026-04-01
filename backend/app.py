import os
import subprocess
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from werkzeug.utils import secure_filename
from utils.transcriber import transcribe_audio
from utils.extractor import generate_summary, extract_action_items


FFMPEG_PATH = r"C:\Users\Amal\AppData\Local\Microsoft\WinGet\Links\ffmpeg.exe"

app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

@app.route("/", methods=["GET"])
def home():
    return jsonify({"message": "Meeting Highlights Flask API is running"})

@app.route("/process-audio", methods=["POST"])
def process_audio():
    try:
        print("\n===== REQUEST RECEIVED =====")

        if "file" not in request.files:
            print("No file in request")
            return jsonify({"error": "No file"}), 400

        file = request.files["file"]

        if file.filename == "":
            print("Empty filename")
            return jsonify({"error": "Empty filename"}), 400

        filename = secure_filename(file.filename)
        file_path = os.path.join(app.config["UPLOAD_FOLDER"], filename)

        print("Saving file to:", file_path)
        file.save(file_path)

        print("File saved successfully")

        # CHECK FILE EXISTS
        print("File exists:", os.path.exists(file_path))

        # 🔥 TRANSCRIBE
        print("Starting transcription...")
        transcript = transcribe_audio(file_path)

        print("Transcription done")

        # 🔥 GENERATE SUMMARY
        print("Generating summary...")
        summary = generate_summary(transcript)

        # 🔥 EXTRACT ACTION ITEMS
        print("Extracting action items...")
        actions = extract_action_items(transcript)

        return jsonify({
    "filename": filename,
    "transcript": transcript,
    "summary": summary,
    "action_items": actions
})

    except Exception as e:
        import traceback
        print("\n===== ERROR OCCURRED =====")
        traceback.print_exc()
        print("==========================\n")

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
    except Exception as e:
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

        return send_file(audio_path, mimetype="audio/mpeg", as_attachment=True, download_name=audio_filename)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True)