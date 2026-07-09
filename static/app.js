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
let faceDetector = null;
let lastFaces = [];

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
}

function drawOverlay() {
  const context = overlayCanvas.getContext("2d");
  context.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

  lastFaces.forEach((face) => {
    const { x, y, width, height } = face.boundingBox;
    context.strokeStyle = "#5eead4";
    context.lineWidth = 4;
    context.strokeRect(x, y, width, height);
    context.fillStyle = "#06111f";
    context.fillRect(x, y - 28, 100, 24);
    context.fillStyle = "#5eead4";
    context.font = "bold 16px Manrope, sans-serif";
    context.fillText("Mask check", x + 8, y - 10);
  });
}

async function detectFaces() {
  if (!faceDetector || !streamActive) {
    return;
  }

  try {
    lastFaces = await faceDetector.detect(cameraFeed);
    resizeCanvas();
    drawOverlay();
  } catch (error) {
    lastFaces = [];
  }

  animationFrameId = requestAnimationFrame(detectFaces);
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
    if ('FaceDetector' in window) {
      faceDetector = new FaceDetector({ fastMode: true, maxDetectedFaces: 4 });
      animationFrameId = requestAnimationFrame(detectFaces);
    } else {
      cameraStatus.textContent = "Camera only";
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

setStreamState(false);
syncStatus();
