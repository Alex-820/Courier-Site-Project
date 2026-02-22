// ------------------ REQUIRES ------------------ //
const express = require('express');
const mongoose = require('mongoose');
const allCities = require('all-the-cities');
const countries = require('i18n-iso-countries');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// ------------------ JWT & ADMIN ------------------ //
const JWT_SECRET = "supersecretkey123"; // change this in production

// Example admin account
const adminUser = {
  username: "admin",
  passwordHash: bcrypt.hashSync("admin123", 10) // password is "admin123"
};

// ------------------ APP SETUP ------------------ //
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname + '/frontend')); // serve frontend HTML/CSS/JS

// Register English locale for countries
countries.registerLocale(require("i18n-iso-countries/langs/en.json"));

// ------------------ RANDOM CITY GENERATOR ------------------ //
function getRandomCity() {
  const randomIndex = Math.floor(Math.random() * allCities.length);
  const city = allCities[randomIndex];
  return `${city.name}, ${city.country}`;
}

// ------------------ DELIVERY MODEL ------------------ //
const Delivery = mongoose.model('Delivery', new mongoose.Schema({
  trackingNumber: String,
  senderName: String,
  receiverName: String,
  status: String,
  estimatedDelivery: Date,
  trackingHistory: [
    {
      date: Date,
      location: String,
      status: String
    }
  ]
}));

// ------------------ COUNTRIES & CITIES ENDPOINTS ------------------ //
app.get('/countries', (req, res) => {
  try {
    const codes = [...new Set(allCities.map(c => c.country))];
    const countryNames = codes
      .map(code => countries.getName(code, "en"))
      .filter(Boolean)
      .sort();
    res.json(countryNames);
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/cities/:country', (req, res) => {
  try {
    const countryName = req.params.country;
    const code = countries.getAlpha2Code(countryName, "en"); // full name → code
    if (!code) return res.status(404).json({ error: "Country not found" });

    const cityList = allCities
      .filter(c => c.country === code)
      .map(c => c.name)
      .sort();
    res.json(cityList);
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------ PATCH DELIVERY STATUS & LOCATION ------------------ //
app.patch('/deliveries/:trackingNumber', async (req, res) => {
  try {
    const { status, estimatedDelivery, location } = req.body;
    const delivery = await Delivery.findOne({ trackingNumber: req.params.trackingNumber });
    if (!delivery) return res.status(404).json({ error: "Delivery not found" });

    if (status) {
      delivery.status = status;
      delivery.trackingHistory.push({
        date: new Date(),
        location: location || getRandomCity(),
        status
      });
    }

    if (estimatedDelivery) {
      delivery.estimatedDelivery = new Date(estimatedDelivery);
    }

    await delivery.save();
    res.json(delivery);

  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------ GET ALL DELIVERIES ------------------ //
app.get('/deliveries', async (req, res) => {
  try {
    const deliveries = await Delivery.find();
    res.json(deliveries);
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------ GET DELIVERY BY TRACKING NUMBER ------------------ //
app.get('/deliveries/:trackingNumber', async (req, res) => {
  try {
    const trackingNumber = req.params.trackingNumber;
    const delivery = await Delivery.findOne({ trackingNumber });

    if (!delivery) {
      return res.status(404).json({ error: "Delivery not found" });
    }

    res.json(delivery);
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------ DELETE DELIVERY ------------------ //
app.delete('/deliveries/:trackingNumber', async (req, res) => {
  try {
    const deletedDelivery = await Delivery.findOneAndDelete({
      trackingNumber: req.params.trackingNumber
    });

    if (!deletedDelivery) {
      return res.status(404).json({ error: "Delivery not found" });
    }

    res.json({ message: "Delivery deleted successfully" });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------ START SERVER ------------------ //
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
