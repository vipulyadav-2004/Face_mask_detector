from __future__ import annotations

import base64
import io

from PIL import Image
import torch
from flask import Flask, jsonify, render_template, request
from torchvision import transforms

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


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/status")
def status():
    return jsonify(
        {
            "camera_ready": True,
            "model_ready": True,
            "mode": "frame-classification",
        }
    )


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
        input_tensor = transform(image).unsqueeze(0)

        with torch.no_grad():
            outputs = model(input_tensor)
            probabilities = torch.softmax(outputs, dim=1)
            confidence, predicted_index = torch.max(probabilities, dim=1)

        label = "Mask" if predicted_index.item() == 1 else "No Mask"

        return jsonify(
            {
                "label": label,
                "confidence": round(confidence.item(), 4),
            }
        )
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
