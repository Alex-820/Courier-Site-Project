// ===========================
// backend.js - Vertex Express
// ===========================
const express = require("express");
const fs = require("fs");
const bodyParser = require("body-parser");
const cors = require("cors");
const app = express();
const port = 3000;

// Enable CORS if frontend is served from a different port
app.use(cors());

// Middleware
app.use(bodyParser.json());

// -------------------
// Optional JWT token check
// -------------------
const USE_JWT = false; // set to true if you want token auth
const ADMIN_TOKEN = "YOUR_ADMIN_TOKEN_HERE";

function authMiddleware(req, res, next) {
  if (!USE_JWT) return next();
  const auth = req.headers["authorization"];
  if (!auth) return res.status(401).json({ message: "No token provided" });
  const token = auth.split(" ")[1];
  if (token !== ADMIN_TOKEN) return res.status(401).json({ message: "Invalid token" });
  next();
}

// -------------------
// Load deliveries from JSON file
// -------------------
const DATA_FILE = "deliveries.json";
let deliveries = [];

function loadDeliveries() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      deliveries = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
    } else {
      deliveries = [];
      fs.writeFileSync(DATA_FILE, JSON.stringify(deliveries, null, 2));
    }
  } catch (err) {
    console.error("Error loading deliveries:", err);
    deliveries = [];
  }
}

function saveDeliveries() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(deliveries, null, 2));
}

// Load deliveries on server start
loadDeliveries();

// -------------------
// Routes
// -------------------

// Create a new delivery
app.post("/admin/deliveries", authMiddleware, (req, res) => {
  const delivery = req.body;

  // Assign unique tracking number if missing
  if (!delivery.trackingNumber) {
    delivery.trackingNumber = "TRK" + Math.floor(Math.random() * 900000 + 100000);
  }

  delivery.status = delivery.status || "Pending";
  deliveries.push(delivery);
  saveDeliveries();

  res.json({ message: "Delivery created", trackingNumber: delivery.trackingNumber });
});

// Get all deliveries
app.get("/admin/deliveries", authMiddleware, (req, res) => {
  res.json(deliveries);
});

// Get single delivery by tracking number
app.get("/admin/deliveries/:trackingNumber", (req, res) => {
  const tn = req.params.trackingNumber;
  const delivery = deliveries.find(d => d.trackingNumber === tn);
  if (!delivery) return res.status(404).json({ message: "Delivery not found" });
  res.json(delivery);
});

// Delete delivery
app.delete("/admin/deliveries/:trackingNumber", authMiddleware, (req, res) => {
  const tn = req.params.trackingNumber;
  const index = deliveries.findIndex(d => d.trackingNumber === tn);
  if (index === -1) return res.status(404).json({ message: "Delivery not found" });
  deliveries.splice(index, 1);
  saveDeliveries();
  res.json({ message: "Delivery deleted" });
});

// -------------------
// Start server
// -------------------
app.listen(port, () => {
  console.log(`Vertex Express backend running at http://localhost:${port}`);
});
