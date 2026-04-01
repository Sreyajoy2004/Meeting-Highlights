import os
from pyannote.audio import Pipeline
from dotenv import load_dotenv

load_dotenv()

def diarize_audio(file_path):
    """
    Performs speaker diarization on audio file.
    Returns list of segments: [{"start": 0.0, "end": 5.2, "speaker": "SPEAKER_00"}, ...]
    
    Requires HuggingFace token with access to pyannote/speaker-diarization-3.1
    Set HF_TOKEN in .env file
    """
    hf_token = os.getenv("HF_TOKEN")
    if not hf_token:
        print("Warning: HF_TOKEN not found. Speaker diarization disabled.")
        return []
    
    try:
        pipeline = Pipeline.from_pretrained(
            "pyannote/speaker-diarization-3.1",
            use_auth_token=hf_token
        )
        
        diarization = pipeline(file_path)
        
        segments = []
        for turn, _, speaker in diarization.itertracks(yield_label=True):
            segments.append({
                "start": turn.start,
                "end": turn.end,
                "speaker": speaker
            })
        
        return segments
    except Exception as e:
        print(f"Diarization failed: {e}")
        return []
