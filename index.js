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
app.use(express.static(__dirname + "/frontend"));

countries.registerLocale(require("i18n-iso-countries/langs/en.json"));

// ------------------ MONGODB CONNECTION ------------------ //
mongoose.connect("mongodb://127.0.0.1:27017/courier", {
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
  })
);

// ------------------ PROFESSIONAL TRACKING GENERATOR ------------------ //
// Format: VTX + YY + MM + 6-digit random
// Example: VTX2602482931
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
    const token = jwt.sign({ role: "admin" }, JWT_SECRET, {
      expiresIn: "2h",
    });
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

// ------------------ ROUTES ------------------ //

// Get all countries
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

// Get cities for a country
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

// ------------------ ADMIN DELIVERY ROUTES ------------------ //

// Create delivery (UPDATED WITH PROFESSIONAL TRACKING)
app.post("/admin/deliveries", authenticateToken, async (req, res) => {
  try {

    const trackingNumber = generateTrackingNumber();

    const delivery = new Delivery({
      trackingNumber,
      ...req.body,
      status: "Shipment Created",
      currentLocation: "Vertex Express Warehouse",
      trackingHistory: [
        {
          date: new Date(),
          location: "Vertex Express Warehouse",
          status: "Shipment Created",
        },
      ],
    });

    await delivery.save();

    res.json({
      message: "Delivery created successfully",
      trackingNumber,
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all deliveries
app.get("/admin/deliveries", authenticateToken, async (req, res) => {
  try {
    const deliveries = await Delivery.find().sort({ createdAt: -1 });
    res.json(deliveries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Public tracking route
app.get("/admin/deliveries/:trackingNumber", async (req, res) => {
  try {
    const delivery = await Delivery.findOne({
      trackingNumber: req.params.trackingNumber,
    });

    if (!delivery)
      return res.status(404).json({ message: "Delivery not found" });

    res.json({
      trackingNumber: delivery.trackingNumber,
      status: delivery.status,
      currentLocation: delivery.currentLocation,
      sender: {
        fullName: delivery.senderFullName,
        address: delivery.senderAddress,
        zip: delivery.senderZip,
        phone: delivery.senderPhone,
        email: delivery.senderEmail,
        country: delivery.senderCountry,
      },
      receiver: {
        fullName: delivery.receiverFullName,
        address: delivery.receiverAddress,
        zip: delivery.receiverZip,
        phone: delivery.receiverPhone,
        email: delivery.receiverEmail,
        country: delivery.receiverCountry,
      },
      package: {
        weight: delivery.weight,
        type: delivery.packageType,
        service: delivery.service,
        signatureRequired: delivery.signatureRequired,
        saturdayDelivery: delivery.saturdayDelivery,
      },
      trackingHistory: delivery.trackingHistory,
      createdAt: delivery.createdAt,
    });
  } catch (err) {
    res.status(500).json({ message: "Error fetching delivery" });
  }
});

// Update delivery
app.put("/admin/deliveries/:trackingNumber", authenticateToken, async (req, res) => {
  try {
    const delivery = await Delivery.findOne({
      trackingNumber: req.params.trackingNumber,
    });

    if (!delivery)
      return res.status(404).json({ message: "Delivery not found" });

    Object.assign(delivery, req.body);
    await delivery.save();

    res.json({ message: "Delivery updated successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete delivery
app.delete("/admin/deliveries/:trackingNumber", authenticateToken, async (req, res) => {
  try {
    const deleted = await Delivery.findOneAndDelete({
      trackingNumber: req.params.trackingNumber,
    });

    if (!deleted)
      return res.status(404).json({ message: "Delivery not found" });

    res.json({ message: "Delivery deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------ START SERVER ------------------ //
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`Vertex Express server running on http://localhost:${PORT}`)
);
