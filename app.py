from __future__ import annotations

import atexit
import threading

import cv2
import numpy as np
import torch
from flask import Flask, Response, jsonify, render_template
from PIL import Image
from torchvision.transforms import transforms

from src.model import FaceMaskCNN


app = Flask(__name__)

model = FaceMaskCNN()
model.load_state_dict(torch.load("face_mask_cnn.pth", map_location=torch.device("cpu")))
model.eval()

transform = transforms.Compose(
    [
        transforms.Resize((128, 128)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ]
)

face_cascade = cv2.CascadeClassifier(
    cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
)


class CameraService:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._capture = None

    def get(self) -> cv2.VideoCapture:
        with self._lock:
            if self._capture is None or not self._capture.isOpened():
                capture = cv2.VideoCapture(0)
                if not capture.isOpened():
                    raise RuntimeError("Unable to access the camera.")
                self._capture = capture
            return self._capture

    def is_ready(self) -> bool:
        with self._lock:
            return self._capture is not None and self._capture.isOpened()

    def release(self) -> None:
        with self._lock:
            if self._capture is not None:
                self._capture.release()
                self._capture = None


camera_service = CameraService()


def annotate_frame(frame):
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    faces = face_cascade.detectMultiScale(
        gray, scaleFactor=1.1, minNeighbors=5, minSize=(60, 60)
    )

    for (x, y, w, h) in faces:
        face_roi = frame[y : y + h, x : x + w]
        if face_roi.size == 0:
            continue

        rgb_face = cv2.cvtColor(face_roi, cv2.COLOR_BGR2RGB)
        pil_img = Image.fromarray(rgb_face)
        input_tensor = transform(pil_img).unsqueeze(0)

        with torch.no_grad():
            outputs = model(input_tensor)
            label_idx = torch.argmax(outputs, dim=1).item()

        label = "Mask" if label_idx == 1 else "No Mask"
        color = (0, 200, 83) if label_idx == 1 else (33, 150, 243)

        label_y = y - 12 if y > 24 else y + 24
        cv2.putText(frame, label, (x, label_y), cv2.FONT_HERSHEY_SIMPLEX, 0.75, color, 2)
        cv2.rectangle(frame, (x, y), (x + w, y + h), color, 2)

    cv2.putText(
        frame,
        "Face Mask Detector",
        (16, 32),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.8,
        (255, 255, 255),
        2,
    )
    return frame


def generate_frames():
    try:
        capture = camera_service.get()
    except RuntimeError as exc:
        error_frame = np.full((480, 640, 3), 18, dtype=np.uint8)
        cv2.putText(
            error_frame,
            str(exc),
            (30, 240),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (0, 0, 255),
            2,
        )
        success, buffer = cv2.imencode(".jpg", error_frame)
        if success:
            yield b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + buffer.tobytes() + b"\r\n"
        return

    while True:
        success, frame = capture.read()
        if not success:
            break

        annotated = annotate_frame(frame)
        success, buffer = cv2.imencode(".jpg", annotated)
        if not success:
            continue

        yield b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + buffer.tobytes() + b"\r\n"


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/video_feed")
def video_feed():
    return Response(generate_frames(), mimetype="multipart/x-mixed-replace; boundary=frame")


@app.route("/api/status")
def status():
    return jsonify(
        {
            "camera_ready": camera_service.is_ready(),
            "model_ready": True,
            "mode": "live",
        }
    )


@atexit.register
def cleanup() -> None:
    camera_service.release()


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
