const toggleButton = document.getElementById("toggleStream");
const switchButton = document.getElementById("switchCamera");
const cameraFeed = document.getElementById("cameraFeed");
const overlayCanvas = document.getElementById("overlayCanvas");
const emptyState = document.getElementById("emptyState");
const viewer = document.querySelector(".viewer");
const streamState = document.getElementById("streamState");
const cameraStatus = document.getElementById("cameraStatus");

let streamActive = false;
let cameraStream = null;
let useFrontCamera = true;
let animationFrameId = null;
let isClassifying = false;
let faceDetector = null;
let latestFaces = [];

const captureCanvas = document.createElement("canvas");
const captureContext = captureCanvas.getContext("2d", { willReadFrequently: true });

function setStreamState(active) {
  streamActive = active;
  viewer.classList.toggle("active", active);
  emptyState.style.display = active ? "none" : "grid";
  cameraFeed.style.display = active ? "block" : "none";
  overlayCanvas.style.display = active ? "block" : "none";
  toggleButton.textContent = active ? "Stop camera" : "Start camera";
  streamState.textContent = active ? "Camera live" : "Stream idle";
}

function stopStream() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = null;
  }

  cameraFeed.srcObject = null;
  const context = overlayCanvas.getContext("2d");
  context.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  setStreamState(false);
}

function resizeCanvas() {
  const { videoWidth, videoHeight } = cameraFeed;
  if (!videoWidth || !videoHeight) {
    return;
  }

  overlayCanvas.width = videoWidth;
  overlayCanvas.height = videoHeight;
  captureCanvas.width = videoWidth;
  captureCanvas.height = videoHeight;
}

function drawOverlay() {
  const context = overlayCanvas.getContext("2d");
  context.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

  if (!latestFaces.length) {
    return;
  }

  latestFaces.forEach((face) => {
    const isMask = face.label === "Mask";
    const strokeColor = isMask ? "#22c55e" : "#f97316";
    const labelHeight = 44;
    const labelWidth = Math.min(220, Math.max(140, face.width + 8));
    const labelX = Math.max(0, face.x);
    const labelY = Math.max(0, face.y - labelHeight - 6);
    const boxX = face.x;
    const boxY = face.y;
    const boxWidth = face.width;
    const boxHeight = face.height;

    context.strokeStyle = strokeColor;
    context.lineWidth = 4;
    context.strokeRect(boxX, boxY, boxWidth, boxHeight);

    context.fillStyle = "rgba(6, 17, 31, 0.88)";
    context.fillRect(labelX, labelY, labelWidth, labelHeight);
    context.strokeStyle = strokeColor;
    context.lineWidth = 2;
    context.strokeRect(labelX, labelY, labelWidth, labelHeight);

    context.fillStyle = "#eef3ff";
    context.font = "800 14px Manrope, sans-serif";
    context.fillText(`Prediction: ${face.label}`, labelX + 10, labelY + 16);
    context.font = "600 11px Manrope, sans-serif";
    context.fillStyle = "#9db0d0";
    context.fillText(`Confidence: ${(face.confidence * 100).toFixed(1)}%`, labelX + 10, labelY + 31);
  });
}

async function classifyFace(faceBox) {
  if (isClassifying || !streamActive || !cameraFeed.videoWidth) {
    return;
  }

  isClassifying = true;

  try {
    captureContext.drawImage(
      cameraFeed,
      faceBox.x,
      faceBox.y,
      faceBox.width,
      faceBox.height,
      0,
      0,
      captureCanvas.width,
      captureCanvas.height
    );
    const response = await fetch("/api/classify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ image: captureCanvas.toDataURL("image/jpeg", 0.75) }),
    });

    if (!response.ok) {
      throw new Error("classification failed");
    }

    const data = await response.json();
    latestFaces = [
      {
        x: faceBox.x,
        y: faceBox.y,
        width: faceBox.width,
        height: faceBox.height,
        label: data.label,
        confidence: data.confidence,
      },
    ];
    cameraStatus.textContent = `Online - ${data.label}`;
    drawOverlay();
  } catch (error) {
    latestFaces = [];
    drawOverlay();
  } finally {
    isClassifying = false;
  }
}

async function detectionLoop() {
  if (!streamActive || !faceDetector) {
    animationFrameId = window.setTimeout(detectionLoop, 350);
    return;
  }

  try {
    const faces = await faceDetector.detect(cameraFeed);
    if (!faces.length) {
      latestFaces = [];
      drawOverlay();
      cameraStatus.textContent = "Online - No face";
    } else if (!isClassifying) {
      const face = faces[0].boundingBox;
      await classifyFace({
        x: Math.max(0, Math.floor(face.x)),
        y: Math.max(0, Math.floor(face.y)),
        width: Math.floor(face.width),
        height: Math.floor(face.height),
      });
    }
  } catch (error) {
    latestFaces = [];
    drawOverlay();
  }

  animationFrameId = window.setTimeout(detectionLoop, 350);
}

async function startStream() {
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: useFrontCamera ? "user" : "environment",
      },
      audio: false,
    });
    cameraFeed.srcObject = cameraStream;
    setStreamState(true);
    cameraStatus.textContent = "Online";
    resizeCanvas();
    if ("FaceDetector" in window) {
      faceDetector = new FaceDetector({ fastMode: true, maxDetectedFaces: 4 });
      animationFrameId = window.setTimeout(detectionLoop, 250);
    } else {
      cameraStatus.textContent = "Browser FaceDetector not supported";
    }
  } catch (error) {
    cameraStatus.textContent = "Offline";
    setStreamState(false);
  }
}

async function syncStatus() {
  try {
    const response = await fetch("/api/status", { cache: "no-store" });
    const data = await response.json();
    cameraStatus.textContent = data.camera_ready ? "Browser ready" : "Offline";
  } catch (error) {
    cameraStatus.textContent = "Offline";
  }
}

toggleButton.addEventListener("click", () => {
  if (streamActive) {
    stopStream();
    return;
  }

  startStream();
});

switchButton.addEventListener("click", async () => {
  useFrontCamera = !useFrontCamera;
  if (streamActive) {
    stopStream();
    await startStream();
  }
});

cameraFeed.addEventListener("loadedmetadata", () => {
  cameraStatus.textContent = "Online";
  resizeCanvas();
});

cameraFeed.addEventListener("play", () => {
  resizeCanvas();
});

setStreamState(false);
syncStatus();
