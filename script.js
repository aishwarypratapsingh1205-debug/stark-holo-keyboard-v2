const video = document.getElementById("video");
const overlay = document.getElementById("overlay");
const ctx = overlay.getContext("2d");

const status = document.getElementById("status");
const gestureText = document.getElementById("gesture");
const output = document.getElementById("output");
const keyboard = document.getElementById("keyboard");

const startBtn = document.getElementById("start");
const stopBtn = document.getElementById("stop");
const clearBtn = document.getElementById("clear");
const cameraMessage = document.getElementById("cameraMessage");

let stream = null;
let running = false;
let handLandmarker = null;
let lastKey = "";
let lastPressTime = 0;

// ---------------- KEYBOARD ----------------

const rows = [
  ["1","2","3","4","5","6","7","8","9","0","-","=","BACKSPACE"],
  ["Q","W","E","R","T","Y","U","I","O","P","[","]","\\"],
  ["A","S","D","F","G","H","J","K","L",";","'","ENTER"],
  ["Z","X","C","V","B","N","M",",",".","/"],
  ["SPACE"]
];

const keyElements = [];

function createKeyboard() {
  keyboard.innerHTML = "";
  keyElements.length = 0;

  rows.forEach(row => {
    const rowDiv = document.createElement("div");
    rowDiv.className = "key-row";

    row.forEach(key => {
      const button = document.createElement("div");

      button.className = "key";

      if (key === "SPACE") {
        button.classList.add("space");
      }

      button.textContent = key;
      button.dataset.key = key;

      button.addEventListener("click", () => {
        pressKey(key);
      });

      rowDiv.appendChild(button);
      keyElements.push(button);
    });

    keyboard.appendChild(rowDiv);
  });
}

function pressKey(key) {

  if (key === "BACKSPACE") {
    output.value = output.value.slice(0, -1);

  } else if (key === "ENTER") {
    output.value += "\n";

  } else if (key === "SPACE") {
    output.value += " ";

  } else {
    output.value += key;
  }

  output.focus();
}

// ---------------- CAMERA ----------------

async function startCamera() {

  try {

    status.textContent = "STARTING CAMERA...";
    cameraMessage.textContent = "STARTING CAMERA...";

    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user",
        width: {
          ideal: 1280
        },
        height: {
          ideal: 720
        }
      },
      audio: false
    });

    video.srcObject = stream;

    await video.play();

    cameraMessage.style.display = "none";

    status.textContent = "CAMERA ON";
    gestureText.textContent = "Show your hand";

    running = true;

    await setupHandTracking();

    detectHands();

  } catch (error) {

    console.error(error);

    status.textContent = "CAMERA ERROR";
    cameraMessage.style.display = "flex";
    cameraMessage.textContent =
      "Camera permission required";

    alert(
      "Camera start nahi hua.\n\n" +
      "Browser ko camera permission Allow karo."
    );
  }
}

// ---------------- STOP CAMERA ----------------

function stopCamera() {

  running = false;

  if (stream) {

    stream.getTracks().forEach(track => {
      track.stop();
    });

    stream = null;
  }

  video.srcObject = null;

  cameraMessage.style.display = "flex";
  cameraMessage.textContent = "CAMERA OFF";

  status.textContent = "SYSTEM READY";
  gestureText.textContent = "Waiting...";
}

// ---------------- MEDIAPIPE ----------------

async function setupHandTracking() {

  status.textContent = "LOADING HAND AI...";

  const vision =
    await import(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/+esm"
    );

  const {
    HandLandmarker,
    FilesetResolver
  } = vision;

  const filesetResolver =
    await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm"
    );

  handLandmarker =
    await HandLandmarker.createFromOptions(
      filesetResolver,
      {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",

          delegate: "CPU"
        },

        runningMode: "VIDEO",

        numHands: 1,

        minHandDetectionConfidence: 0.5,

        minHandPresenceConfidence: 0.5,

        minTrackingConfidence: 0.5
      }
    );

  status.textContent = "HAND AI READY";
}

// ---------------- HAND DETECTION ----------------

async function detectHands() {

  if (!running || !handLandmarker) {
    return;
  }

  if (video.readyState >= 2) {

    overlay.width = video.videoWidth;
    overlay.height = video.videoHeight;

    const results =
      handLandmarker.detectForVideo(
        video,
        performance.now()
      );

    drawHands(results);
  }

  requestAnimationFrame(detectHands);
}

// ---------------- DRAW HAND ----------------

function drawHands(results) {

  ctx.clearRect(
    0,
    0,
    overlay.width,
    overlay.height
  );

  if (
    !results ||
    !results.landmarks ||
    results.landmarks.length === 0
  ) {

    gestureText.textContent =
      "No hand detected";

    clearActiveKeys();

    return;
  }

  const landmarks =
    results.landmarks[0];

  // Draw hand points
  landmarks.forEach(point => {

    const x =
      point.x * overlay.width;

    const y =
      point.y * overlay.height;

    ctx.beginPath();

    ctx.arc(
      x,
      y,
      5,
      0,
      Math.PI * 2
    );

    ctx.fillStyle = "#00eaff";
    ctx.fill();
  });

  // Index finger tip
  const indexFinger =
    landmarks[8];

  const thumb =
    landmarks[4];

  const indexX =
    indexFinger.x * overlay.width;

  const indexY =
    indexFinger.y * overlay.height;

  // Draw pointer
  ctx.beginPath();

  ctx.arc(
    indexX,
    indexY,
    12,
    0,
    Math.PI * 2
  );

  ctx.strokeStyle = "#00eaff";
  ctx.lineWidth = 3;
  ctx.stroke();

  // Convert finger position to screen position
  const screenX =
    indexFinger.x * window.innerWidth;

  const screenY =
    indexFinger.y * window.innerHeight;

  const key =
    findKey(screenX, screenY);

  clearActiveKeys();

  if (key) {

    key.classList.add("active");

    gestureText.textContent =
      "Pointing: " + key.dataset.key;

    // Pinch detection
    const dx =
      indexFinger.x - thumb.x;

    const dy =
      indexFinger.y - thumb.y;

    const distance =
      Math.sqrt(
        dx * dx +
        dy * dy
      );

    if (distance < 0.055) {

      const now =
        Date.now();

      if (
        now - lastPressTime > 700 ||
        lastKey !== key.dataset.key
      ) {

        pressKey(
          key.dataset.key
        );

        lastPressTime = now;
        lastKey = key.dataset.key;

        gestureText.textContent =
          "Pressed: " +
          key.dataset.key;
      }

    } else {

      lastKey = "";
    }

  } else {

    gestureText.textContent =
      "Move finger over keyboard";
  }
}

// ---------------- FIND KEY ----------------

function findKey(x, y) {

  for (const key of keyElements) {

    const rect =
      key.getBoundingClientRect();

    if (
      x >= rect.left &&
      x <= rect.right &&
      y >= rect.top &&
      y <= rect.bottom
    ) {

      return key;
    }
  }

  return null;
}

// ---------------- CLEAR ACTIVE ----------------

function clearActiveKeys() {

  keyElements.forEach(key => {
    key.classList.remove("active");
  });
}

// ---------------- BUTTONS ----------------

startBtn.addEventListener(
  "click",
  startCamera
);

stopBtn.addEventListener(
  "click",
  stopCamera
);

clearBtn.addEventListener(
  "click",
  () => {
    output.value = "";
    output.focus();
  }
);

// ---------------- START ----------------

createKeyboard();

status.textContent =
  "SYSTEM READY";
