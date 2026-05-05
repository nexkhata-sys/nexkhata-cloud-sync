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

// ====================================================
// 🤝 B2B EDI POST OFFICE (COMPANY A TO COMPANY B)
// ====================================================

// यह एक टेम्पररी इनबॉक्स है जो क्लाउड पर बिल्स को तब तक रखेगा
// जब तक सामने वाला उसे रिसीव नहीं कर लेता। (असली प्रोडक्शन में इसे Redis या MongoDB में रखें)
let b2bCloudInbox = [];

// 1. 📤 SENDER: जब कोई पार्टी बिल बनाएगी, तो वो इस API पर बिल भेजेगी
app.post("/api/relay/send", express.json(), (req, res) => {
  try {
    const billData = req.body;

    if (!billData.receiver_gstin) {
      return res
        .status(400)
        .json({ success: false, message: "Receiver GSTIN is missing!" });
    }

    // बिल को क्लाउड इनबॉक्स में सुरक्षित रख लिया
    b2bCloudInbox.push({
      id: Date.now().toString(),
      sender_name: billData.sender_name,
      sender_gstin: billData.sender_gstin,
      receiver_gstin: billData.receiver_gstin,
      invoice_no: billData.invoice_no,
      amount: billData.amount,
      date: billData.date,
      timestamp: new Date(),
    });

    console.log(
      `🤝 B2B Bill Queued: From [${billData.sender_gstin}] To [${billData.receiver_gstin}]`,
    );

    res
      .status(200)
      .json({ success: true, message: "Bill securely stored in Cloud Relay." });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 2. 📥 RECEIVER: जब सामने वाली पार्टी अपना 'B2B Inbox' रिफ्रेश करेगी, तो वो यहाँ से बिल ले जाएगी
app.get("/api/relay/receive/:gstin", (req, res) => {
  try {
    const myGstin = req.params.gstin;

    // इनबॉक्स में चेक करो कि मेरे GSTIN के नाम से कोई बिल आया है क्या?
    const myPendingBills = b2bCloudInbox.filter(
      (bill) => bill.receiver_gstin === myGstin,
    );

    if (myPendingBills.length > 0) {
      // अगर बिल मिल गए, तो उन्हें मेन इनबॉक्स से डिलीट कर दो (ताकि अगली बार फिर से न जाएं)
      b2bCloudInbox = b2bCloudInbox.filter(
        (bill) => bill.receiver_gstin !== myGstin,
      );
    }

    res.status(200).json({ success: true, data: myPendingBills });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 4. Start Cloud Server
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`🚀 NexKhata Cloud Sync Engine running on port ${PORT}`);
});
