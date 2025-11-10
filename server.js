const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

app.use(express.static(path.join(__dirname, "public")));

const rooms = {}; // { roomId: [socketIds...] }

io.on("connection", (socket) => {
  console.log("New user connected:", socket.id);

  socket.on("join-room", (roomId) => {
    socket.join(roomId);
    if (!rooms[roomId]) rooms[roomId] = [];
    rooms[roomId].push(socket.id);

    console.log(`User ${socket.id} joined room ${roomId}`);

    // Notify other users in the room
    socket.to(roomId).emit("user-joined", socket.id);
  });

  socket.on("offer", (offer, to) => {
    io.to(to).emit("offer", offer, socket.id);
  });

  socket.on("answer", (answer, to) => {
    io.to(to).emit("answer", answer, socket.id);
  });

  socket.on("candidate", (candidate, to) => {
    io.to(to).emit("candidate", candidate, socket.id);
  });

  socket.on("disconnect", () => {
    for (const [roomId, users] of Object.entries(rooms)) {
      rooms[roomId] = users.filter((id) => id !== socket.id);
      socket.to(roomId).emit("user-left", socket.id);
    }
  });
});

server.listen(3000, () => console.log("✅ Server running at http://localhost:3000"));
