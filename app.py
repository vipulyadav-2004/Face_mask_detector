from __future__ import annotations
import base64
import io
import numpy as np
from PIL import Image
import onnxruntime as ort
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

# Load the optimized ONNX model session
ort_session = ort.InferenceSession("face_mask_cnn.onnx")

def preprocess_image(image: Image.Image) -> np.ndarray:
    image = image.resize((128, 128))
    img_array = np.array(image).astype(np.float32) / 255.0
    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
    std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
    img_array = (img_array - mean) / std
    img_array = np.transpose(img_array, (2, 0, 1))
    img_array = np.expand_dims(img_array, axis=0)
    return img_array

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
        input_data = preprocess_image(image)

        ort_inputs = {ort_session.get_inputs()[0].name: input_data}
        ort_outputs = ort_session.run(None, ort_inputs)
        outputs = ort_outputs[0]

        exp_outputs = np.exp(outputs - np.max(outputs, axis=1, keepdims=True))
        probabilities = exp_outputs / np.sum(exp_outputs, axis=1, keepdims=True)
        
        predicted_index = np.argmax(probabilities, axis=1)[0]
        confidence = probabilities[0][predicted_index]

        label = "Mask" if predicted_index == 1 else "No Mask"

        return jsonify({
            "label": label,
            "confidence": float(round(confidence, 4)),
        })
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)