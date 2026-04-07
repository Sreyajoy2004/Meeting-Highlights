from app import app
import sys

with app.test_client() as client:
    with open("requirements.txt", "rb") as f:
        response = client.post("/process-audio", data={"file": (f, "test.mp3")})
        print(response.status_code)
        print(response.data)
