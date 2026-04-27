const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

// 1. HTTP Server & Socket.IO Setup
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Yahan baad me aap security ke liye apna IP/Domain daal sakte hain
    methods: ["GET", "POST"],
  },
});

// 2. API Route (Server zinda hai ya nahi check karne ke liye)
app.get("/", (req, res) => {
  res.send("☁️ NexKhata Cloud Socket Server is Running smoothly!");
});

// 3. ⚡ THE MAGIC: Socket.IO Connection Logic
io.on("connection", (socket) => {
  console.log(`🟢 New Device Connected: ${socket.id}`);

  // STEP A: Mobile ya Desktop 'Company Room' me judega
  // (Taaki Company 1 ka data Company 2 ke mobile me na chala jaye)
  socket.on("join_company", (companyId) => {
    socket.join(companyId);
    console.log(`🏢 Device ${socket.id} joined Company Room: ${companyId}`);
  });

  // STEP B: Jab Desktop par naya bill banega, wo ye event bhejega
  socket.on("new_bill_generated", (data) => {
    console.log(
      `🧾 New Bill Received from Desktop for Company ${data.company_id}: ${data.total_amount}`,
    );

    // STEP C: Cloud Server turant us company ke MOBILE APP ko data bhej dega!
    socket.to(data.company_id).emit("dashboard_update_live", data);
  });

  // Disconnect Logic
  socket.on("disconnect", () => {
    console.log(`🔴 Device Disconnected: ${socket.id}`);
  });
});

// 4. Start Cloud Server
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`🚀 NexKhata Cloud Sync Engine running on port ${PORT}`);
});
