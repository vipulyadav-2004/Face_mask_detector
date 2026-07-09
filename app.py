from __future__ import annotations

import torch
from flask import Flask, jsonify, render_template

from src.model import FaceMaskCNN


app = Flask(__name__)

model = FaceMaskCNN()
model.load_state_dict(torch.load("face_mask_cnn.pth", map_location=torch.device("cpu")))
model.eval()


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/status")
def status():
    return jsonify(
        {
            "camera_ready": True,
            "model_ready": True,
            "mode": "browser-camera",
        }
    )


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
