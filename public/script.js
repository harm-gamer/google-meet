const socket = io("http://localhost:3000");

const roomInput = document.getElementById("roomInput");
const joinBtn = document.getElementById("joinBtn");
const videos = document.getElementById("videos");

let localStream;
let peers = {}; // { socketId: RTCPeerConnection }

const servers = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

joinBtn.onclick = async () => {
  const roomId = roomInput.value.trim();
  if (!roomId) return alert("Please enter a room ID");

  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  addVideoStream("You", localStream, true);

  socket.emit("join-room", roomId);
};

// When another user joins
socket.on("user-joined", async (socketId) => {
  console.log("New user joined:", socketId);
  const peer = createPeer(socketId);
  peers[socketId] = peer;

  localStream.getTracks().forEach((track) => peer.addTrack(track, localStream));

  const offer = await peer.createOffer();
  await peer.setLocalDescription(offer);
  socket.emit("offer", offer, socketId);
});

socket.on("offer", async (offer, socketId) => {
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
  let video = document.createElement("video");
  video.id = id;
  video.srcObject = stream;
  video.autoplay = true;
  video.playsInline = true;
  if (isLocal) video.muted = true;
  videos.appendChild(video);
}
