require("dotenv").config();

const express = require("express");
const http = require("http");
const fs = require("fs");
const cors = require("cors");
const bodyParser = require("body-parser");
const mongoose = require('mongoose');

const userRouterV1 = require("./routes/userRouteV1");
const childRouterV1 = require("./routes/childRouteV1");
// const imageRouterV1 = require("./routes/imageRouteV1")
const appointmentRouterV1 = require("./routes/appointmentRouteV1");
const doctorRouterV1 = require("./routes/doctorRouteV1");
const documentRouterV1 = require("./routes/documentRouterV1");
const paymentRouterV1 = require("./routes/paymentRouteV1");
const subscriptionRouterV1 = require("./routes/subscriptionRouterV1");
const messageRouterV1 = require("./routes/messageRouteV1");
const reportRouterV1 = require("./routes/reportRoute")

const { checkForAuthenticationToken } = require("./middlewares/authentication");
const { connectMongoDb } = require("./connection");

const app = express();
const PORT = 8080;

// Connection
connectMongoDb(process.env.MONGO_CONNECTION_URL).then(() =>
  console.log("Mongodb connected")
);

// Ensure Message model is registered
require("./models/message");
app.get('/',(req,res)=>{res.send("Hello")})
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());

app.use((req, res, next) => {
  const msg = `${req.method} \ ${req.url} ${req.hostname} ${Date.now()}\n`;
  fs.appendFile("log.txt", msg, () => { });
  next();
});


// User - Route
app.use("/api/v1/user", checkForAuthenticationToken(), userRouterV1);
app.use("/api/v1/child", childRouterV1);
app.use("/api/v1/appointment", appointmentRouterV1);
app.use("/api/v1/doctor", doctorRouterV1);
app.use("/api/v1/document", documentRouterV1);
app.use("/api/v1/payment", paymentRouterV1);
app.use("/api/v1/subscription", subscriptionRouterV1);
app.use("/api/v1/chat", messageRouterV1);

const server = app.listen(PORT, () => console.log(`running on port ${PORT}`));

// Socket.io setup
const io = require("socket.io")(server, {
  allowEIO3: true,
  cors: {
    origin: true,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

const jwt = require("jsonwebtoken");
const { validateToken } = require("./services/authentication");
const Message = mongoose.model("Message");
const User = mongoose.model("user");

 io.use(async (socket, next) => {
  try {
    const token = socket.handshake.query.token;
    if (!token) {
      throw new Error('Authentication error: Token missing');
    }
    
    const decoded = validateToken(token);

    socket.userId = decoded.userId;
    console.log("User verified: " + socket.userId);
    next();
  } catch (err) {
    console.error("Socket authentication error:", err.message);
    next(new Error('Authentication error'));
  }
});

io.on("connection", (socket) => {
  console.log("Connected: " + socket.id);

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
        receiverId:receiverId,
        message:message
      });
  
      await newMessage.save();
      console.log("Message saved and sent.");
  
      // Emitting the new message to the receiver
      io.to(receiverId).emit("newMessage", {
        message:message,
        name: user.name,
        userId: socket.userId,
        createdAt: newMessage.createdAt
      });
    } catch (err) {
      console.error("Error in sendMessage:", err.message);
      // Handle error appropriately, emit an error event or log it
    }
    console.log("reciver:",receiverId,"message:",message,"Sender:",socket.userId);
  });

  socket.join(socket.userId);
});
