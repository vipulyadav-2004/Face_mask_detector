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
let latestPrediction = null;

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

  if (!latestPrediction) {
    return;
  }

  const isMask = latestPrediction.label === "Mask";
  const panelWidth = 210;
  context.fillStyle = "rgba(6, 17, 31, 0.82)";
  context.fillRect(16, 16, panelWidth, 72);
  context.strokeStyle = isMask ? "#22c55e" : "#f97316";
  context.lineWidth = 3;
  context.strokeRect(16, 16, panelWidth, 72);
  context.fillStyle = "#eef3ff";
  context.font = "800 18px Manrope, sans-serif";
  context.fillText(`Prediction: ${latestPrediction.label}`, 28, 44);
  context.font = "600 14px Manrope, sans-serif";
  context.fillStyle = "#9db0d0";
  context.fillText(`Confidence: ${(latestPrediction.confidence * 100).toFixed(1)}%`, 28, 68);
}

async function classifyFrame() {
  if (isClassifying || !streamActive || !cameraFeed.videoWidth) {
    return;
  }

  isClassifying = true;

  try {
    captureContext.drawImage(cameraFeed, 0, 0, captureCanvas.width, captureCanvas.height);
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

    latestPrediction = await response.json();
    cameraStatus.textContent = `Online - ${latestPrediction.label}`;
    drawOverlay();
  } catch (error) {
    latestPrediction = null;
  }

  isClassifying = false;
  animationFrameId = window.setTimeout(classifyFrame, 350);
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
    latestPrediction = null;
    animationFrameId = window.setTimeout(classifyFrame, 250);
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
