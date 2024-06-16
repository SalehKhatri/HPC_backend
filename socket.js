const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const Message = mongoose.model("Message");
const User = mongoose.model("user");

const emailToSocketIdMap = new Map();
const socketidToEmailMap = new Map();

function initializeSocket(server) {
  const io = new Server(server, {
    allowEIO3: true,
    cors: {
      origin: true,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.query.token;
      const payload = await jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = payload.userId;
      console.log("user verified");
      next();
    } catch (err) {
      next(new Error("Authentication error"));
    }
  });

  io.on("connection", (socket) => {
    console.log("Connected: " + socket.userId);

    socket.on("disconnect", () => {
      console.log("Disconnected: " + socket.userId);
    });

    socket.on("sendMessage", async ({ receiverId, message }) => {
      try {
        if (!receiverId || !message.trim()) {
          throw new Error("Receiver ID and message are required.");
        }
    
        const user = await User.findOne({ _id: socket.userId });
        if (!user) {
          throw new Error("User not found.");
        }
    
        const newMessage = new Message({
          senderId: socket.userId,
          receiverId: receiverId,
          message: message
        });
    
        await newMessage.save();
        console.log("Message saved and sent.");
    
        // Emitting the new message to the receiver
        io.to(receiverId).emit("newMessage", {
          senderId: socket.userId,
          message: message,
          createdAt: newMessage.createdAt
        });
      } catch (err) {
        console.error("Error in sendMessage:", err.message);
        // Handle error appropriately, emit an error event or log it
      }
      console.log("Receiver:", receiverId, "Message:", message, "Sender:", socket.userId);
    });

    socket.join(socket.userId);

    socket.on("room:join", (data) => {
      const { email, room } = data;
      emailToSocketIdMap.set(email, socket.userId);
      socketidToEmailMap.set(socket.userId, email);
      io.to(room).emit("user:joined", { email, id: socket.userId });
      socket.join(room);
      io.to(socket.userId).emit("room:join", data);
    });

    socket.on("user:call", ({ to,name, offer }) => {
      console.log("Call from: ",socket.userId);
      io.to(to).emit("incomming:call", { from: socket.userId,name:name, offer });
    });

    socket.on("call:accepted", ({ to, ans }) => {
      console.log("Call accepted from: ",socket.userId);
      io.to(to).emit("call:accepted", { from: socket.userId, ans:ans });
    });

    socket.on("peer:nego:needed", ({ to, offer }) => {

      io.to(to).emit("peer:nego:needed", { from: socket.userId, offer });
    });

    socket.on("peer:nego:done", ({ to, ans }) => {

      io.to(to).emit("peer:nego:final", { from: socket.userId, ans:ans });
    });

    socket.on('leave:call', ({ to }) => {
      console.log('User leaving call: ', socket.id);
      io.to(to).emit('call:ended', { from: socket.id });
      socket.leave(to);
    });

  });

  return io;
}

module.exports = initializeSocket;
