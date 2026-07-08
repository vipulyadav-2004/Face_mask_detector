## Face Mask Detector

This project now includes a small browser frontend for the local OpenCV camera feed.

### Run the web app

1. Install dependencies from `requirements.txt`.
2. Start the Flask server:

```bash
python app.py
```

3. Open `http://127.0.0.1:5000` in your browser.

### What it does

- Streams the local webcam through OpenCV.
- Runs the existing face mask classifier on each detected face.
- Overlays `Mask` / `No Mask` labels directly on the feed.
- Provides a polished start/stop dashboard for demos and local testing.


# ⚡ Edge AI Face Mask Detector

A lightweight, real-time edge AI application that detects face masks from a live webcam feed leveraging deep learning (**PyTorch**) and computer vision (**OpenCV**).

## 🛠️ Tech Stack & Core Libraries
* **Deep Learning Framework** 🧠: PyTorch (nn.Module, Torchvision)
* **Computer Vision Processing** 📷: OpenCV (BGR/RGB transformation, Haar Cascades)
* **Image Transformation Pipeline** 🔄: Pillow (PIL)
* **Production Deployment Interface** 🌐: Streamlit & Streamlit-WeBRTC