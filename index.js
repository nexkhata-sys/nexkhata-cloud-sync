// ====================================================
// ☁️ NEXKHATA CLOUD MASTER SERVER (Render / VPS)
// Features: Socket.IO Live Sync + B2B EDI Relay + Public B2B Catalog
// ====================================================

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" })); // Limit बढ़ाई गई है ताकि बड़े कैटलॉग सेव हो सकें

// 1. HTTP Server & Socket.IO Setup
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.get("/", (req, res) => {
  res.send("☁️ NexKhata Master Cloud Server is Running 24x7! 🚀");
});

// ====================================================
// ⚡ 1. SOCKET.IO (LIVE DASHBOARD SYNC)
// ====================================================
io.on("connection", (socket) => {
  console.log(`🟢 New Device Connected: ${socket.id}`);

  socket.on("join_company", (companyId) => {
    socket.join(companyId);
    console.log(`🏢 Device ${socket.id} joined Company Room: ${companyId}`);
  });

  socket.on("new_bill_generated", (data) => {
    console.log(
      `🧾 New Bill from Company ${data.company_id}: ₹${data.total_amount}`,
    );
    socket.to(data.company_id).emit("dashboard_update_live", data);
  });

  socket.on("disconnect", () => {
    console.log(`🔴 Device Disconnected: ${socket.id}`);
  });
});

// ====================================================
// 🤝 2. UNIVERSAL B2B EDI POST OFFICE
// ====================================================
let b2bCloudInbox = [];

app.post("/api/relay/send", (req, res) => {
  try {
    const billData = req.body;
    if (!billData.receiver_gstin || !billData.sender_gstin) {
      return res
        .status(400)
        .json({ success: false, message: "GSTIN is missing!" });
    }

    const newBill = {
      id: Date.now().toString(),
      software_source: billData.software_source || "NexKhata",
      sender_name: billData.sender_name,
      sender_gstin: billData.sender_gstin,
      receiver_gstin: billData.receiver_gstin,
      invoice_no: billData.invoice_no,
      amount: billData.amount,
      date: billData.date,
      items: billData.items || [],
      timestamp: new Date(),
    };

    b2bCloudInbox.push(newBill);
    console.log(`🤝 B2B Bill Queued: To [${newBill.receiver_gstin}]`);

    res
      .status(200)
      .json({ success: true, message: "Bill securely stored in Cloud Relay." });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get("/api/relay/receive/:gstin", (req, res) => {
  try {
    const myGstin = req.params.gstin;
    const myPendingBills = b2bCloudInbox.filter(
      (bill) => bill.receiver_gstin === myGstin,
    );
    res.status(200).json({
      success: true,
      count: myPendingBills.length,
      data: myPendingBills,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post("/api/relay/mark-cleared/:id", (req, res) => {
  try {
    const billId = req.params.id;
    b2bCloudInbox = b2bCloudInbox.filter((bill) => bill.id !== billId);
    console.log(`🗑️ Bill ${billId} cleared from cloud.`);
    res
      .status(200)
      .json({ success: true, message: "Bill cleared from Cloud Inbox." });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ====================================================
// 🛒 3. B2B PUBLIC CATALOG ENGINE (NEW)
// ====================================================
let globalCatalogs = {}; // RAM में क्लाइंट्स का कैटलॉग सेव करेगा

// A. Local Software se Catalog Receive karega aur Cloud me store karega
app.post("/api/cloud/sync-catalog", (req, res) => {
  try {
    const { company_id, companyName, whatsappNumber, catalogData } = req.body;

    if (!company_id || !catalogData) {
      return res.status(400).json({ success: false, message: "Invalid Data!" });
    }

    globalCatalogs[company_id] = {
      companyName: companyName,
      whatsappNumber: whatsappNumber,
      data: catalogData,
      lastUpdated: new Date().toISOString(),
    };

    console.log(
      `☁️ Catalog Synced for: ${companyName} (${catalogData.length} items)`,
    );
    res.status(200).json({
      success: true,
      message: "Catalog successfully synced to Cloud!",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// B. Vercel Frontend (Public Website) ko Catalog Dikhayega
app.get("/api/public/catalog/:companyId", (req, res) => {
  try {
    const cid = req.params.companyId;
    const catalog = globalCatalogs[cid];

    if (catalog) {
      res.status(200).json({
        success: true,
        isLicensed: true,
        companyName: catalog.companyName,
        whatsappNumber: catalog.whatsappNumber,
        catalogDate: catalog.lastUpdated,
        data: catalog.data,
      });
    } else {
      res.status(404).json({
        success: false,
        message:
          "Catalog not found on Cloud. Please sync from NexKhata Desktop.",
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: "Cloud Error" });
  }
});

// ====================================================
// 📊 4. DYNAMIC DASHBOARD SUMMARY RELAY (NEW)
// ====================================================
let cloudDashboardSummaries = {}; // रैम में लाइव समरी होल्ड करने के लिए

// A. दुकान का ऑफलाइन PC यहाँ आकर अपनी ताज़ा समरी जमा करेगा
app.post("/api/cloud/update-summary", (req, res) => {
  try {
    const { company_id, summaryData } = req.body;
    if (!company_id || !summaryData)
      return res.status(400).json({ success: false });

    cloudDashboardSummaries[company_id] = summaryData;
    console.log(`📊 Cloud Summary updated for Company ID: ${company_id}`);
    res.json({ success: true, message: "Summary synced to cloud!" });
  } catch (e) {
    res.status(500).json({ success: false });
  }
});

let cloudCompanies = {}; // क्लाउड पर सक्रिय कंपनियों की लिस्ट
let cloudUsers = {}; // क्लाउड पर लॉगिन के लिए क्रेडेंशियल्स

// A. लोकल पीसी केवल पेड प्लान होने पर यहाँ आकर अपना लॉगिन डेटा सिंक करेगा
app.post("/api/cloud/sync-auth", (req, res) => {
  try {
    const { company_id, companyProfile, users } = req.body;
    if (!company_id)
      return res.status(400).json({ success: false, message: "Missing ID" });

    cloudCompanies[company_id] = companyProfile;
    cloudUsers[company_id] = users; // [ {username, password, role, permissions} ]

    console.log(
      `🔐 Auth & Company synced to cloud for Company ID: ${company_id}`,
    );
    res.json({ success: true, message: "Auth data synced safely!" });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// B. मोबाइल ऐप के लिए कंपनियों की लिस्ट का रूट (जो एरर आ रही थी वो अब यहाँ से सॉल्व होगी)
app.get("/api/companies", (req, res) => {
  try {
    const list = Object.values(cloudCompanies);
    res.status(200).json({ success: true, data: list });
  } catch (e) {
    res.status(500).json({ success: false, data: [] });
  }
});

// C. मोबाइल ऐप के लिए क्लाउड लॉगिन वेरिफिकेशन रूट
app.post("/api/login", (req, res) => {
  try {
    const { username, password, company_id } = req.body;
    const users = cloudUsers[company_id] || [];

    // क्रेडेंशियल्स चेक करना
    const user = users.find(
      (u) => u.username === username && u.password === password,
    );

    if (user) {
      res.status(200).json({
        success: true,
        token: "NEX_CLOUD_" + Date.now(), // डमी टोकन मोबाइल ऐप के लिए
        role: user.role,
        permissions:
          typeof user.permissions === "string"
            ? JSON.parse(user.permissions)
            : user.permissions,
        message: `Welcome ${user.role} to Cloud Mode!`,
      });
    } else {
      res.status(401).json({
        success: false,
        message: "❌ Invalid Cloud Username or Password!",
      });
    }
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// B. मोबाइल ऐप सीधे यहाँ से उस कंपनी की समरी उठा लेगा
app.get("/api/dashboard/summary", (req, res) => {
  try {
    const cid = req.query.company_id || 1;
    const summary = cloudDashboardSummaries[cid];

    if (summary) {
      res.status(200).json({ success: true, data: summary });
    } else {
      // अगर पहली बार में डेटा न मिले तो ब्लैंक फॉलबैक भेजें ताकि मोबाइल ऐप क्रैश न हो
      res.status(200).json({
        success: true,
        data: {
          totalSales: 0,
          totalPurchase: 0,
          bankAccounts: 0,
          cashInHand: 0,
          sundryDebtors: 0,
          sundryCreditors: 0,
          recentActivity: [],
          monthlyTrend: [],
        },
      });
    }
  } catch (e) {
    res.status(500).json({ success: false, message: "Cloud Summary Error" });
  }
});

// ====================================================
// 🚀 START SERVER
// ====================================================
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`🚀 NexKhata Cloud Engine is LIVE on port ${PORT}`);
});
