const toggleButton = document.getElementById("toggleStream");
const cameraFeed = document.getElementById("cameraFeed");
const overlayCanvas = document.getElementById("overlayCanvas");
const emptyState = document.getElementById("emptyState");
const viewer = document.querySelector(".viewer");
const cameraStatus = document.getElementById("cameraStatus");
const liveBadge = document.getElementById("liveFloatingBadge"); // From the HTML template

let streamActive = false;
let cameraStream = null;
let animationFrameId = null;
let isClassifying = false;
let useFaceDetector = false;

const captureCanvas = document.createElement("canvas");
const captureContext = captureCanvas.getContext("2d", { willReadFrequently: true });

function setStreamState(active) {
  streamActive = active;
  viewer.classList.toggle("active", active);
  emptyState.style.display = active ? "none" : "grid";
  toggleButton.textContent = active ? "Stop camera" : "Start camera";
}

async function classifyFrame() {
  if (isClassifying || !streamActive) return;
  isClassifying = true;

  try {
    captureContext.drawImage(cameraFeed, 0, 0, captureCanvas.width, captureCanvas.height);
    const response = await fetch("/api/classify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: captureCanvas.toDataURL("image/jpeg", 0.7) }),
    });

    const data = await response.json();
    if (data.label) {
      // Update UI elements from your new HTML template
      const badge = document.getElementById('liveFloatingBadge');
      badge.style.display = 'block';
      badge.innerText = data.label;
      badge.className = data.label === "Mask" ? "live-prediction-badge status-mask" : "live-prediction-badge status-no-mask";
      document.getElementById('textPredictionResult').innerText = data.label;
      document.getElementById('textConfidenceResult').innerText = (data.confidence * 100).toFixed(1) + "%";
    }
  } catch (err) {
    console.error("Classification error:", err);
  } finally {
    isClassifying = false;
  }
}

async function detectionLoop() {
  if (!streamActive) return;
  
  // If FaceDetector exists, use it, otherwise classify the whole frame
  if (useFaceDetector && faceDetector) {
    const faces = await faceDetector.detect(cameraFeed);
    if (faces.length > 0) await classifyFrame();
  } else {
    await classifyFrame();
  }
  animationFrameId = setTimeout(detectionLoop, 500); // 2 frames per second is enough for smooth UI
}

async function startStream() {
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    cameraFeed.srcObject = cameraStream;
    
    // Setup canvases
    cameraFeed.onloadedmetadata = () => {
        captureCanvas.width = cameraFeed.videoWidth;
        captureCanvas.height = cameraFeed.videoHeight;
        setStreamState(true);
        cameraStatus.textContent = "Online";
        detectionLoop();
    };
  } catch (error) {
    cameraStatus.textContent = "Camera Error";
    setStreamState(false);
  }
}

function stopStream() {
  clearTimeout(animationFrameId);
  if (cameraStream) cameraStream.getTracks().forEach(t => t.stop());
  setStreamState(false);
  cameraStatus.textContent = "Offline";
}

toggleButton.addEventListener("click", () => streamActive ? stopStream() : startStream());