const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
// const fetch = require("node-fetch"); // अगर Zoho webhook यूज़ करना हो तो इसे अन-कमेंट करें

const app = express();
app.use(cors());
app.use(express.json()); // JSON बॉडी पार्स करने के लिए ज़रूरी है

// 1. HTTP Server & Socket.IO Setup
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// 2. API Route (Server zinda hai ya nahi check karne ke liye)
app.get("/", (req, res) => {
  res.send(
    "☁️ NexKhata Cloud Socket & Universal EDI Server is Running smoothly! 🚀",
  );
});

// 3. ⚡ THE MAGIC: Socket.IO Connection Logic (For Mobile App Live Sync)
io.on("connection", (socket) => {
  console.log(`🟢 New Device Connected: ${socket.id}`);

  socket.on("join_company", (companyId) => {
    socket.join(companyId);
    console.log(`🏢 Device ${socket.id} joined Company Room: ${companyId}`);
  });

  socket.on("new_bill_generated", (data) => {
    console.log(
      `🧾 New Bill Received from Desktop for Company ${data.company_id}: ${data.total_amount}`,
    );
    socket.to(data.company_id).emit("dashboard_update_live", data);
  });

  socket.on("disconnect", () => {
    console.log(`🔴 Device Disconnected: ${socket.id}`);
  });
});

// ====================================================
// 🤝 UNIVERSAL B2B EDI POST OFFICE (TALLY, BUSY, ZOHO, NEXKHATA)
// ====================================================

// यह एक टेम्पररी इनबॉक्स है जो क्लाउड पर बिल्स को तब तक रखेगा
// जब तक सामने वाला सॉफ्टवेयर उसे पूरी तरह रिसीव और सेव नहीं कर लेता।
let b2bCloudInbox = [];

// 1. 📤 SENDER: जब कोई पार्टी (Tally या NexKhata) बिल बनाएगी, तो वो इस API पर बिल भेजेगी
app.post("/api/relay/send", async (req, res) => {
  try {
    const billData = req.body;

    if (!billData.receiver_gstin || !billData.sender_gstin) {
      return res.status(400).json({
        success: false,
        message: "Sender or Receiver GSTIN is missing!",
      });
    }

    // ⚡ THE FIX: अब इसमें items की लिस्ट और सॉफ्टवेयर का नाम भी सेव होगा
    const newBill = {
      id: Date.now().toString(),
      software_source: billData.software_source || "NexKhata", // e.g., 'Tally Prime'
      sender_name: billData.sender_name,
      sender_gstin: billData.sender_gstin,
      receiver_gstin: billData.receiver_gstin,
      invoice_no: billData.invoice_no,
      amount: billData.amount,
      date: billData.date,
      items: billData.items || [], // 👈 Items array add ho gaya
      timestamp: new Date(),
    };

    b2bCloudInbox.push(newBill);

    console.log(
      `🤝 B2B Bill Queued: From [${newBill.software_source} - ${newBill.sender_gstin}] To [${newBill.receiver_gstin}]`,
    );

    // ⚡ (OPTIONAL) ZOHO WEBHOOK PUSH: अगर क्लाइंट Zoho चलाता है, तो डायरेक्ट धक्का मार के बिल भेज दो!
    /*
    if (billData.receiver_webhook_url) {
        try {
            await fetch(billData.receiver_webhook_url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newBill)
            });
        } catch(e) { console.log("Webhook failed, kept in queue."); }
    }
    */

    res
      .status(200)
      .json({ success: true, message: "Bill securely stored in Cloud Relay." });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 2. 📥 RECEIVER: जब सामने वाली पार्टी का Tally/NexKhata इनबॉक्स रिफ्रेश करेगा
app.get("/api/relay/receive/:gstin", (req, res) => {
  try {
    const myGstin = req.params.gstin;

    // इनबॉक्स में चेक करो कि मेरे GSTIN के नाम से कोई बिल आया है क्या?
    const myPendingBills = b2bCloudInbox.filter(
      (bill) => bill.receiver_gstin === myGstin,
    );

    // ⚡ THE FIX: यहाँ से बिल डिलीट (filter) नहीं करना है!
    // सिर्फ भेज दो। जब Tally में सेव हो जाएगा, तब Tally खुद Delete की API कॉल करेगा।

    res.status(200).json({
      success: true,
      count: myPendingBills.length,
      data: myPendingBills,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 3. 🧹 MARK AS CLEARED: (SAFE DELETE) जब Tally या NexKhata में बिल सफलतापूर्वक बन जाए
app.post("/api/relay/mark-cleared/:id", (req, res) => {
  try {
    const billId = req.params.id;
    // अब बिल को इनबॉक्स से हमेशा के लिए हटा दो
    b2bCloudInbox = b2bCloudInbox.filter((bill) => bill.id !== billId);

    console.log(
      `🗑️ Bill ${billId} successfully saved by client and cleared from cloud.`,
    );
    res
      .status(200)
      .json({ success: true, message: "Bill cleared from Cloud Inbox." });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 4. Start Cloud Server
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`🚀 NexKhata Cloud Sync Engine running on port ${PORT}`);
});
