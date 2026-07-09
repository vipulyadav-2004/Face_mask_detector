from __future__ import annotations

import base64
import io

import cv2
import numpy as np
from PIL import Image
import onnxruntime as ort
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

# 🧠 1. Load the lightweight ONNX model session
ort_session = ort.InferenceSession("face_mask_cnn.onnx")

face_cascade = cv2.CascadeClassifier(
    cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
)

# 🛠️ 2. Manual preprocessing to match the original PyTorch transforms
def preprocess_image(image: Image.Image) -> np.ndarray:
    # Resize to 128x128 pixels
    image = image.resize((128, 128))
    
    # Convert to a numpy array and normalize pixels to [0, 1]
    img_array = np.array(image).astype(np.float32) / 255.0
    
    # Apply PyTorch ImageNet normalization (mean and std)
    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
    std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
    img_array = (img_array - mean) / std
    
    # Change shape from (H, W, C) to (C, H, W) and add a batch dimension (1, C, H, W)
    img_array = np.transpose(img_array, (2, 0, 1))
    img_array = np.expand_dims(img_array, axis=0)
    
    return img_array


def classify_face(face_image: Image.Image) -> tuple[str, float]:
    input_data = preprocess_image(face_image)

    ort_inputs = {ort_session.get_inputs()[0].name: input_data}
    ort_outputs = ort_session.run(None, ort_inputs)
    outputs = ort_outputs[0]

    exp_outputs = np.exp(outputs - np.max(outputs, axis=1, keepdims=True))
    probabilities = exp_outputs / np.sum(exp_outputs, axis=1, keepdims=True)

    predicted_index = np.argmax(probabilities, axis=1)[0]
    confidence = float(probabilities[0][predicted_index])
    label = "Mask" if predicted_index == 1 else "No Mask"

    return label, confidence

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/status")
def status():
    return jsonify({"camera_ready": True, "model_ready": True, "mode": "frame-classification"})

@app.route("/api/classify", methods=["POST"])
def classify():
    payload = request.get_json(silent=True) or {}
    image_data = payload.get("image")

    if not image_data:
        return jsonify({"error": "Missing image data."}), 400

    if "," in image_data:
        _, image_data = image_data.split(",", 1)

    try:
        image_bytes = base64.b64decode(image_data)
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        rgb_frame = np.array(image)
        bgr_frame = cv2.cvtColor(rgb_frame, cv2.COLOR_RGB2BGR)
        gray_frame = cv2.cvtColor(bgr_frame, cv2.COLOR_BGR2GRAY)

        faces = face_cascade.detectMultiScale(
            gray_frame,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(60, 60),
        )

        results = []
        for (x, y, w, h) in faces:
            face_crop = rgb_frame[y : y + h, x : x + w]
            if face_crop.size == 0:
                continue

            face_image = Image.fromarray(face_crop)
            label, confidence = classify_face(face_image)
            results.append(
                {
                    "x": int(x),
                    "y": int(y),
                    "width": int(w),
                    "height": int(h),
                    "label": label,
                    "confidence": round(confidence, 4),
                }
            )

        return jsonify({"faces": results})
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500

if __name__ == "__main__":
    # Listening on all interfaces for cloud deployment
    app.run(host="0.0.0.0", port=5000, debug=False)