// const socket = io("https://google-meet-8dov.onrender.com/");
const socket = io("http://localhost:3000");
const roomInput = document.getElementById("roomInput");
const joinBtn = document.getElementById("joinBtn");
const videos = document.getElementById("videos");
const chatInput = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");
const chatMessages = document.getElementById("chatMessages");

let localStream;
let peers = {}; // { socketId: RTCPeerConnection }

let userName = prompt("Enter your name:") || "Anonymous";
let roomId = "";

const servers = { iceServers: [{ urls: "stun:stun.l.google.com:19302" },
     {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
] };

joinBtn.onclick = async () => {
 roomId = roomInput.value.trim();
  if (!roomId) return alert("Please enter a room ID");

  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  addVideoStream("You", localStream, true);

  socket.emit("join-room", roomId);
};

// When another user joins
socket.on("user-joined", async (socketId) => {
      if (peers[socketId]) return;
  console.log("New user joined:", socketId);
  const peer = createPeer(socketId);
  peers[socketId] = peer;

  localStream.getTracks().forEach((track) => peer.addTrack(track, localStream));

  const offer = await peer.createOffer();
  await peer.setLocalDescription(offer);
  socket.emit("offer", offer, socketId);
});

sendBtn.onclick = () => {
  const message = chatInput.value.trim();
  if (!message) return;
  socket.emit("chat-message", { roomId, name: userName, message });
  chatInput.value = "";
};

socket.on("chat-message", ({ name, message }) => {
  const div = document.createElement("div");
  div.innerHTML = `<strong>${name}:</strong> ${message}`;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight; // auto-scroll
});
socket.on("offer", async (offer, socketId) => {
     if (peers[socketId]) return;
  const peer = createPeer(socketId);
  peers[socketId] = peer;

  localStream.getTracks().forEach((track) => peer.addTrack(track, localStream));

  await peer.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await peer.createAnswer();
  await peer.setLocalDescription(answer);
  socket.emit("answer", answer, socketId);
});

socket.on("answer", async (answer, socketId) => {
  const peer = peers[socketId];
  await peer.setRemoteDescription(new RTCSessionDescription(answer));
});

socket.on("candidate", (candidate, socketId) => {
  const peer = peers[socketId];
  peer.addIceCandidate(new RTCIceCandidate(candidate));
});

socket.on("user-left", (socketId) => {
  if (peers[socketId]) {
    peers[socketId].close();
    delete peers[socketId];
    document.getElementById(socketId)?.remove();
  }
});

// Helper: Create RTCPeerConnection
function createPeer(socketId) {
  const peer = new RTCPeerConnection(servers);

  peer.onicecandidate = (event) => {
    if (event.candidate) socket.emit("candidate", event.candidate, socketId);
  };

  peer.ontrack = (event) => {
    const [stream] = event.streams;
    addVideoStream(socketId, stream, false);
  };

  return peer;
}

// Helper: Add video stream to page
function addVideoStream(id, stream, isLocal) {
    if (document.getElementById(id)) return;
  let video = document.createElement("video");
  video.id = id;
  video.srcObject = stream;
  video.autoplay = true;
  video.playsInline = true;
  if (isLocal) video.muted = true;
  videos.appendChild(video);
}
