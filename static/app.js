const toggleButton = document.getElementById("toggleStream");
const refreshButton = document.getElementById("refreshStream");
const cameraFeed = document.getElementById("cameraFeed");
const emptyState = document.getElementById("emptyState");
const viewer = document.querySelector(".viewer");
const streamState = document.getElementById("streamState");
const cameraStatus = document.getElementById("cameraStatus");

let streamActive = false;

function setStreamState(active) {
  streamActive = active;
  viewer.classList.toggle("active", active);
  emptyState.style.display = active ? "none" : "grid";
  cameraFeed.style.display = active ? "block" : "none";
  toggleButton.textContent = active ? "Stop camera" : "Start camera";
  streamState.textContent = active ? "Stream live" : "Stream idle";
}

function startStream() {
  cameraFeed.src = "/video_feed?ts=" + Date.now();
  setStreamState(true);
}

function stopStream() {
  cameraFeed.src = "";
  setStreamState(false);
}

async function syncStatus() {
  try {
    const response = await fetch("/api/status", { cache: "no-store" });
    const data = await response.json();
    cameraStatus.textContent = data.camera_ready ? "Online" : "Offline";
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

refreshButton.addEventListener("click", () => {
  if (!streamActive) {
    startStream();
    return;
  }

  cameraFeed.src = "/video_feed?ts=" + Date.now();
});

cameraFeed.addEventListener("load", () => {
  cameraStatus.textContent = "Online";
});

cameraFeed.addEventListener("error", () => {
  cameraStatus.textContent = "Offline";
});

setStreamState(false);
syncStatus();
