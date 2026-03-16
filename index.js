// ------------------ REQUIRES ------------------ //
const express = require("express");
const mongoose = require("mongoose");
const allCities = require("all-the-cities");
const countries = require("i18n-iso-countries");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// ------------------ JWT & ADMIN ------------------ //
const JWT_SECRET = "supersecretkey123"; // change for production
const adminUser = {
  username: "admin",
  passwordHash: bcrypt.hashSync("admin123", 10),
};

// ------------------ APP SETUP ------------------ //
const app = express();
app.use(cors());
app.use(express.json());

countries.registerLocale(require("i18n-iso-countries/langs/en.json"));

require("dotenv").config();
// ------------------ MONGODB CONNECTION ------------------ //
mongoose.connect(process.env.MONGODB_URI, {
  dbName: "courier",
})
.then(() => console.log("MongoDB Connected"))
.catch(err => console.error("MongoDB connection error:", err));

// ------------------ DELIVERY MODEL ------------------ //
const Delivery = mongoose.model(
  "Delivery",
  new mongoose.Schema({
    trackingNumber: { type: String, unique: true },
    senderFullName: String,
    senderAddress: String,
    senderZip: String,
    senderPhone: String,
    senderEmail: String,
    senderCountry: String,
    receiverFullName: String,
    receiverAddress: String,
    receiverZip: String,
    receiverPhone: String,
    receiverEmail: String,
    receiverCountry: String,
    weight: Number,
    packageType: String,
    service: String,
    signatureRequired: Boolean,
    saturdayDelivery: Boolean,
    shipmentDate: Date,
    pickupDate: Date,
    estimatedDeliveryDate: Date,
    status: String,
    currentLocation: String,
    trackingHistory: [
      {
        date: Date,
        location: String,
        status: String,
      },
    ],
    createdAt: { type: Date, default: Date.now },
    items: [
      {
        itemName: String,
        itemDescription: String,
        itemQuantity: Number,
        itemPrice: Number,
        currency: String,
      },
    ],
  })
);

// ------------------ TRACKING NUMBER GENERATOR ------------------ //
function generateTrackingNumber() {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const random = Math.floor(100000 + Math.random() * 900000);
  return `VTX${year}${month}${random}`;
}

// ------------------ AUTH ------------------ //
app.post("/admin/login", (req, res) => {
  const { username, password } = req.body;
  if (
    username === adminUser.username &&
    bcrypt.compareSync(password, adminUser.passwordHash)
  ) {
    const token = jwt.sign({ role: "admin" }, JWT_SECRET, { expiresIn: "2h" });
    return res.json({ token });
  }
  res.status(401).json({ message: "Invalid credentials" });
});

function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token provided" });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: "Invalid token." });
    req.user = user;
    next();
  });
}

// ------------------ COUNTRIES & CITIES ------------------ //
app.get("/countries", (req, res) => {
  try {
    const codes = [...new Set(allCities.map(c => c.country))];
    const countryNames = codes
      .map(code => countries.getName(code, "en"))
      .filter(Boolean)
      .sort();
    res.json(countryNames);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/cities/:country", (req, res) => {
  try {
    const countryName = req.params.country;
    const code = countries.getAlpha2Code(countryName, "en");
    if (!code) return res.status(404).json({ error: "Country not found" });

    const cityList = allCities
      .filter(c => c.country === code)
      .map(c => c.name)
      .sort();

    res.json(cityList);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------ ADMIN DELIVERIES ------------------ //
app.post("/admin/deliveries", authenticateToken, async (req, res) => {
  try {
    const data = req.body;
    const trackingNumber = generateTrackingNumber();
    const delivery = new Delivery({ ...data, trackingNumber });
    await delivery.save();
    res.json({ trackingNumber });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/admin/deliveries", authenticateToken, async (req, res) => {
  try {
    const deliveries = await Delivery.find().sort({ createdAt: -1 });
    res.json(deliveries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/admin/deliveries/:trackingNumber", authenticateToken, async (req, res) => {
  try {
    const delivery = await Delivery.findOne({ trackingNumber: req.params.trackingNumber });
    if (!delivery) return res.status(404).json({ message: "Shipment not found" });
    res.json(delivery);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/admin/deliveries/:trackingNumber", authenticateToken, async (req, res) => {
  try {
    const { status, currentLocation } = req.body;
    const delivery = await Delivery.findOneAndUpdate(
      { trackingNumber: req.params.trackingNumber },
      { status, currentLocation },
      { new: true }
    );
    if (!delivery) return res.status(404).json({ message: "Shipment not found" });
    res.json(delivery);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/admin/deliveries/:trackingNumber", authenticateToken, async (req, res) => {
  try {
    const delivery = await Delivery.findOneAndDelete({ trackingNumber: req.params.trackingNumber });
    if (!delivery) return res.status(404).json({ message: "Shipment not found" });
    res.json({ message: "Deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------ TRACK SHIPMENT PUBLIC ------------------ //
app.get("/track/:trackingNumber", async (req, res) => {
  try {
    const delivery = await Delivery.findOne({ trackingNumber: req.params.trackingNumber });
    if (!delivery) return res.status(404).json({ message: "Shipment not found" });
    res.json(delivery);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------ SERVE FRONTEND ------------------ //
app.use(express.static(__dirname + "/frontend"));

// ------------------ START SERVER ------------------ //
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));