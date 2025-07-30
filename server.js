const express = require('express');
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const cors = require('cors');
const mongoose = require('mongoose');
const { OpenAI } = require('openai');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

const ScooterReportSchema = new mongoose.Schema({
  raw: String,
  location: String,
  latitude: Number,
  longitude: Number,
  title: String,
  description: String,
  date: { type: Date, default: Date.now },
  processed: { type: Boolean, default: false }
});
const ScooterReport = mongoose.model('ScooterReport', ScooterReportSchema);

// Add this near your other schemas
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  password: { type: String, required: true }, // For production, hash this!
  email: { type: String, default: null }, // Add email field
  profilePicture: { type: String, default: null }, // Store image URI
});
const User = mongoose.model('User', UserSchema);

// Community Post Schema
const CommunityPostSchema = new mongoose.Schema({
  username: { type: String, required: true },
  avatar: { type: String, default: '👤' },
  text: { type: String, required: true },
  image: { type: String }, // Optional image URL
  timestamp: { type: Date, default: Date.now },
  likes: { type: Number, default: 0 },
  comments: { type: Number, default: 0 },
  location: { type: String, default: 'Your Location' },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
});
const CommunityPost = mongoose.model('CommunityPost', CommunityPostSchema);

const openai = new OpenAI({ apiKey: process.env.OPEN_AI_KEY });

// Function to calculate distance between two coordinates in kilometers
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const d = R * c; // Distance in kilometers
  return d;
}

// Function to check if a report is a valid crime (not service/administrative)
function isValidCrime(reportText, location) {
  const nonCrimeKeywords = [
    'service', 'no crime', 'administrative', 'disposition', 'closed',
    'unfounded', 'report writing', 'information', 'assist', 'welfare check',
    'civil', 'traffic stop', 'parking', 'noise complaint', 'animal'
  ];
  
  const crimeKeywords = [
    'theft', 'stolen', 'robbery', 'burglary', 'larceny', 'vandalism',
    'assault', 'battery', 'fraud', 'scam', 'break', 'breaking'
  ];
  
  const textLower = reportText.toLowerCase();
  const locationLower = location ? location.toLowerCase() : '';
  
  // Check if it contains non-crime keywords
  const hasNonCrime = nonCrimeKeywords.some(keyword => 
    textLower.includes(keyword) || locationLower.includes(keyword)
  );
  
  // Check if it contains crime keywords
  const hasCrime = crimeKeywords.some(keyword => 
    textLower.includes(keyword) || locationLower.includes(keyword)
  );
  
  // Return true only if it has crime keywords and no non-crime keywords
  return hasCrime && !hasNonCrime;
}

// Utility to extract scooter reports from PDF text
function extractScooterReports(text) {
  const reports = [];
  
  // More comprehensive regex patterns for e-scooter theft reports
  const patterns = [
    /(?:scooter|e-scooter|electric scooter)[\s\S]*?(?:theft|stolen|missing|taken)[\s\S]*?(?:location|address|street)[\s\S]*?$/gmi,
    /(?:theft|stolen|missing|taken)[\s\S]*?(?:scooter|e-scooter|electric scooter)[\s\S]*?(?:location|address|street)[\s\S]*?$/gmi,
    /incident[\s\S]*?(?:scooter|e-scooter)[\s\S]*?(?:theft|stolen)[\s\S]*?$/gmi
  ];

  // USC area coordinates for more realistic demo data (2318 Hoover Street area)
  const uscCenterCoord = { lat: 34.0224, lng: -118.2851 }; // USC center
  const maxDistanceKm = 3; // 3km radius around USC
  
  const uscAreaCoordinates = [
    { lat: 34.0224, lng: -118.2851, area: "USC Campus" },
    { lat: 34.0251, lng: -118.2851, area: "USC Village" },
    { lat: 34.0199, lng: -118.2899, area: "USC Vicinity" },
    { lat: 34.0189, lng: -118.2820, area: "Exposition Park" },
    { lat: 34.0240, lng: -118.2790, area: "Downtown USC" },
    { lat: 34.0210, lng: -118.2870, area: "USC Area" },
    { lat: 34.0260, lng: -118.2830, area: "USC North" },
    { lat: 34.0180, lng: -118.2880, area: "USC South" },
    { lat: 34.0230, lng: -118.2810, area: "USC East" },
    { lat: 34.0200, lng: -118.2920, area: "USC West" },
    { lat: 34.0245, lng: -118.2865, area: "USC Central" },
    { lat: 34.0215, lng: -118.2845, area: "USC Perimeter" },
    { lat: 34.0235, lng: -118.2875, area: "USC Neighborhood" },
    { lat: 34.0205, lng: -118.2835, area: "USC District" },
    { lat: 34.0255, lng: -118.2855, area: "USC Zone" }
  ];

  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const reportText = match[0];
      
      // Extract location information
      const locationMatch = /(?:location|address|street)[\s:]*([^\n\r.]+)/i.exec(reportText);
      const location = locationMatch ? locationMatch[1].trim() : null;
      
      // Only include if it's a valid crime and contains scooter reference
      if (location && reportText.toLowerCase().includes('scooter') && isValidCrime(reportText, location)) {
        // Assign random USC area coordinates for demo purposes
        const randomCoord = uscAreaCoordinates[Math.floor(Math.random() * uscAreaCoordinates.length)];
        const finalLat = randomCoord.lat + (Math.random() - 0.5) * 0.01;
        const finalLng = randomCoord.lng + (Math.random() - 0.5) * 0.01;
        
        // Check if the coordinates are within USC area perimeter
        const distanceFromUSC = calculateDistance(uscCenterCoord.lat, uscCenterCoord.lng, finalLat, finalLng);
        
        if (distanceFromUSC <= maxDistanceKm) {
          reports.push({
            raw: reportText,
            location: location,
            latitude: finalLat,
            longitude: finalLng,
            title: "E-Scooter Theft Reported",
            description: reportText.substring(0, 100) + "...",
            processed: false
          });
        }
      }
    }
  });

  // If no reports found, create sample data for demo with better red/yellow balance
  if (reports.length === 0) {
    const sampleReports = [
      // RED MARKERS (Completed thefts - investigation worthy)
      {
        raw: "E-scooter theft reported at USC Village. Black scooter taken from bike rack.",
        location: "USC Village",
        latitude: 34.0251,
        longitude: -118.2851,
        title: "E-Scooter Theft Reported",
        description: "Black scooter taken from bike rack",
        processed: false
      },
      {
        raw: "Electric scooter stolen from Exposition Park area. Victim reported scooter missing from parking area.",
        location: "Exposition Park",
        latitude: 34.0189,
        longitude: -118.2820,
        title: "Electric Scooter Stolen",
        description: "Scooter missing from parking area",
        processed: false
      },
      {
        raw: "Red electric scooter theft reported near USC North area. Lock was cut.",
        location: "USC North",
        latitude: 34.0260,
        longitude: -118.2830,
        title: "Red E-Scooter Theft",
        description: "Lock was cut, scooter stolen",
        processed: false
      },
      {
        raw: "Blue scooter stolen from USC South parking area during evening hours.",
        location: "USC South",
        latitude: 34.0180,
        longitude: -118.2880,
        title: "Blue Scooter Theft",
        description: "Stolen during evening hours",
        processed: false
      },
      {
        raw: "E-scooter theft incident at USC East. Scooter was secured but lock was broken.",
        location: "USC East",
        latitude: 34.0230,
        longitude: -118.2810,
        title: "E-Scooter Theft - Lock Broken",
        description: "Secured scooter, lock was broken",
        processed: false
      },
      {
        raw: "White electric scooter reported stolen from USC West area near dormitories.",
        location: "USC West",
        latitude: 34.0200,
        longitude: -118.2920,
        title: "White E-Scooter Theft",
        description: "Stolen near dormitories",
        processed: false
      },
      
      // YELLOW MARKERS (Attempted/prevented thefts - non-investigation)
      {
        raw: "Attempted theft of e-scooter near USC Campus. Suspect fled when confronted.",
        location: "USC Campus",
        latitude: 34.0224,
        longitude: -118.2851,
        title: "Attempted E-Scooter Theft",
        description: "Suspect fled when confronted",
        processed: false
      },
      {
        raw: "Scooter theft attempt foiled by security at USC Central area.",
        location: "USC Central",
        latitude: 34.0245,
        longitude: -118.2865,
        title: "Theft Attempt Foiled",
        description: "Security prevented theft",
        processed: false
      },
      {
        raw: "Suspicious person seen near scooters at USC Library. No theft occurred, person left when approached.",
        location: "USC Library",
        latitude: 34.0205,
        longitude: -118.2840,
        title: "Suspicious Activity - No Theft",
        description: "Person left when approached, no crime",
        processed: false
      },
      {
        raw: "Report of someone tampering with scooter lock near Doheny Library. Scooter owner returned, no theft.",
        location: "Doheny Library",
        latitude: 34.0195,
        longitude: -118.2835,
        title: "Lock Tampering - No Theft",
        description: "Owner returned, scooter safe",
        processed: false
      },
      {
        raw: "Attempted scooter theft interrupted by passerby. Suspect fled immediately, no damage to scooter.",
        location: "USC Village Gateway",
        latitude: 34.0248,
        longitude: -118.2825,
        title: "Interrupted Attempt - No Damage",
        description: "Passerby intervention, scooter safe",
        processed: false
      },
      {
        raw: "Scooter alarm activated but turned out to be accidental bump by pedestrian.",
        location: "USC Bookstore",
        latitude: 34.0220,
        longitude: -118.2860,
        title: "False Alarm - Accidental Bump",
        description: "Pedestrian accidentally triggered alarm",
        processed: false
      },
      {
        raw: "Attempted theft deterred by security camera. Suspect noticed camera and left immediately.",
        location: "USC Marshall",
        latitude: 34.0185,
        longitude: -118.2825,
        title: "Camera Deterrent - No Theft",
        description: "Security camera prevented theft",
        processed: false
      },
      {
        raw: "Report of suspicious activity near scooters. Investigation revealed person was just checking tire pressure.",
        location: "USC Parking Structure",
        latitude: 34.0235,
        longitude: -118.2875,
        title: "Suspicious Activity - Tire Check",
        description: "Person checking tire pressure",
        processed: false
      },
      {
        raw: "Scooter moved without permission but returned within hour. No theft charges filed.",
        location: "USC Engineering",
        latitude: 34.0190,
        longitude: -118.2890,
        title: "Unauthorized Move - Returned",
        description: "Returned quickly, no charges",
        processed: false
      }
    ];
    
    reports.push(...sampleReports);
  }

  return reports;
}

// Test endpoint to verify server is working
app.get('/api/test', (req, res) => {
  console.log('Test endpoint called');
  res.json({ message: 'Server is working', timestamp: new Date().toISOString() });
});

// Endpoint to get scooter reports from a PDF file and save to MongoDB
app.get('/api/scooter-reports', async (req, res) => {
  console.log('GET /api/scooter-reports endpoint called');
  console.time('scooter-reports-total');
  try {
    console.time('find-existing-reports');
    const existingReports = await ScooterReport.find({});
    console.timeEnd('find-existing-reports');
    
    if (existingReports.length === 0) {
      // Process PDF only if no reports exist (one-time initialization)
      const pdfPath = path.join(__dirname, 'pdfs', '60-Day-7-17.pdf');
      
      if (fs.existsSync(pdfPath)) {
        console.time('read-pdf');
        const dataBuffer = fs.readFileSync(pdfPath);
        const data = await pdfParse(dataBuffer);
        console.timeEnd('read-pdf');
        console.time('extract-reports');
        const scooterReports = extractScooterReports(data.text);
        console.timeEnd('extract-reports');

        // Save new reports to MongoDB
        console.time('save-reports');
        for (const report of scooterReports) {
          if (report.location) {
            await ScooterReport.updateOne(
              { raw: report.raw },
              { $setOnInsert: report },
              { upsert: true }
            );
          }
        }
        console.timeEnd('save-reports');
        console.log(`Processed ${scooterReports.length} reports from PDF`);
      } else {
        // If no PDF, create sample data
        console.time('extract-sample-reports');
        const sampleReports = extractScooterReports('');
        console.timeEnd('extract-sample-reports');
        console.time('save-sample-reports');
        for (const report of sampleReports) {
          await ScooterReport.updateOne(
            { raw: report.raw },
            { $setOnInsert: report },
            { upsert: true }
          );
        }
        console.timeEnd('save-sample-reports');
        console.log('Created sample reports for demo');
      }
    }

    console.time('find-all-reports');
    const allReports = await ScooterReport.find({}).lean();
    console.timeEnd('find-all-reports');
    console.log(`Found ${allReports.length} total reports in database`);
    
    const uscCenterCoord = { lat: 34.0224, lng: -118.2851 }; // USC center
    const maxDistanceKm = 3; // 3km radius around USC
    
    console.time('filter-reports');
    const filteredReports = allReports.filter(report => {
      // Check if it's within USC area
      const distanceFromUSC = calculateDistance(
        uscCenterCoord.lat, 
        uscCenterCoord.lng, 
        report.latitude, 
        report.longitude
      );
      
      // Check if it's a valid crime
      const isValidCrimeReport = isValidCrime(report.raw || '', report.location || '');
      
      console.log(`Report: location="${report.location}", distance=${distanceFromUSC.toFixed(2)}km, isValidCrime=${isValidCrimeReport}`);
      
      return distanceFromUSC <= maxDistanceKm && isValidCrimeReport;
    });
    console.timeEnd('filter-reports');
    
    console.log(`Filtered ${allReports.length} reports to ${filteredReports.length} valid crimes in USC area`);
    res.json({ reports: filteredReports });
    console.timeEnd('scooter-reports-total');
    
  } catch (err) {
    console.error('Error processing reports:', err);
    console.timeEnd('scooter-reports-total');
    res.status(500).json({ error: err.message });
  }
});

// Endpoint to clear all reports (for testing)
app.delete('/api/scooter-reports', express.json(), async (req, res) => {
  try {
    await ScooterReport.deleteMany({});
    res.json({ message: 'All reports cleared' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Alternative endpoint to clear all reports (for testing)
app.get('/api/clear-reports', async (req, res) => {
  try {
    await ScooterReport.deleteMany({});
    res.json({ message: 'All reports cleared' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint to get parking suggestions using OpenAI
app.get('/api/parking-suggestions', async (req, res) => {
  try {
    const reports = await ScooterReport.find({ location: { $ne: null } }).lean();
    const locations = reports.map(r => r.location).join(', ');

    const prompt = `Based on these locations where scooters have been reported stolen: ${locations}. Suggest safe places to park an e-scooter in the city and tips to avoid theft.`;

    const completion = await openai.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "gpt-4o-mini"
    });

    res.json({ suggestions: completion.choices[0].message.content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// New endpoint to analyze route safety and suggest better parking spots
app.post('/api/analyze-route', express.json(), async (req, res) => {
  console.time('analyze-route-total');
  try {
    const { startLat, startLng, endLat, endLng, destinationName } = req.body;
    
    if (!startLat || !startLng || !endLat || !endLng) {
      return res.status(400).json({ error: 'Start and end coordinates required' });
    }

    console.time('find-reports');
    const reports = await ScooterReport.find({}).lean();
    console.timeEnd('find-reports');
    
    console.time('filter-nearby-thefts');
    const nearbyThefts = reports.filter(report => {
      const distance = calculateDistance(endLat, endLng, report.latitude, report.longitude);
      return distance <= 0.5; // Within 0.5km of destination
    });
    console.timeEnd('filter-nearby-thefts');

    console.time('generate-safe-alternatives');
    const safeAlternatives = generateSafeAlternatives(endLat, endLng, reports);
    console.timeEnd('generate-safe-alternatives');

    // Use GPT-4o-mini to analyze the route and provide recommendations
    const analysisPrompt = `
    Analyze this scooter route for safety:
    - Destination: ${destinationName || 'Unknown location'} (${endLat}, ${endLng})
    - Nearby theft reports: ${nearbyThefts.length} incidents within 500m
    - Theft details: ${nearbyThefts.map(t => t.description).join('; ')}
    
    Provide a VERY SHORT response with:
    1. **Safety Assessment:** Safe/Moderate Risk/High Risk
    2. **Brief Explanation:** One sentence only (max 25 words) explaining why it's safe/unsafe
    3. **Specific Parking Recommendations:** One short tip (max 15 words)
    
    Keep it simple and easy to read on mobile. Use bullet points.
    `;

    console.time('openai-analysis');
    const completion = await openai.chat.completions.create({
      messages: [{ role: "user", content: analysisPrompt }],
      model: "gpt-4o-mini"
    });
    console.timeEnd('openai-analysis');

    const analysis = completion.choices[0].message.content;

    res.json({
      safetyLevel: determineSafetyLevel(nearbyThefts.length),
      nearbyThefts: nearbyThefts.length,
      analysis: analysis,
      safeAlternatives: safeAlternatives,
      theftReports: nearbyThefts
    });
    console.timeEnd('analyze-route-total');

  } catch (err) {
    console.error('Route analysis error:', err);
    console.timeEnd('analyze-route-total');
    res.status(500).json({ error: err.message });
  }
});

// Helper function to determine safety level based on nearby thefts
function determineSafetyLevel(theftCount) {
  if (theftCount === 0) return 'Safe';
  if (theftCount <= 2) return 'Moderate Risk';
  return 'High Risk';
}

// Helper function to generate safe parking alternatives
function generateSafeAlternatives(destLat, destLng, allReports) {
  // Real USC area safe parking locations with actual addresses
  const realSafeParkingSpots = [
    {
      name: "USC Village Parking Structure",
      latitude: 34.0259,
      longitude: -118.2851,
      address: "2715 Portland St, Los Angeles, CA 90007",
      description: "Secure parking structure with 24/7 security and good lighting"
    },
    {
      name: "Leavey Library Bike Racks",
      latitude: 34.0219,
      longitude: -118.2829,
      address: "650 Child's Way, Los Angeles, CA 90089",
      description: "Well-lit bike racks near library entrance with high foot traffic"
    },
    {
      name: "USC Bookstore Area",
      latitude: 34.0205,
      longitude: -118.2851,
      address: "840 Childs Way, Los Angeles, CA 90089",
      description: "Busy area with security cameras and regular patrols"
    },
    {
      name: "Trousdale Parkway (Near Gate)",
      latitude: 34.0195,
      longitude: -118.2890,
      address: "Trousdale Pkwy, Los Angeles, CA 90089",
      description: "Main campus entrance with security presence and good visibility"
    },
    {
      name: "Exposition Park (Natural History Museum)",
      latitude: 34.0173,
      longitude: -118.2887,
      address: "900 Exposition Blvd, Los Angeles, CA 90007",
      description: "Public area with museum security and regular maintenance"
    },
    {
      name: "USC Caruso Catholic Center",
      latitude: 34.0234,
      longitude: -118.2901,
      address: "3565 Trousdale Pkwy, Los Angeles, CA 90089",
      description: "Quiet area with good lighting and community presence"
    },
    {
      name: "Ronald Tutor Campus Center",
      latitude: 34.0205,
      longitude: -118.2886,
      address: "3607 Trousdale Pkwy, Los Angeles, CA 90089",
      description: "Central campus location with high student traffic"
    },
    {
      name: "USC Parking Structure A",
      latitude: 34.0188,
      longitude: -118.2918,
      address: "3335 S Figueroa St, Los Angeles, CA 90007",
      description: "Secure parking structure near Figueroa Gate"
    },
    {
      name: "Doheny Memorial Library",
      latitude: 34.0201,
      longitude: -118.2839,
      address: "3550 Trousdale Pkwy, Los Angeles, CA 90089",
      description: "Historic library area with good lighting and foot traffic"
    },
    {
      name: "USC Marshall School Courtyard",
      latitude: 34.0186,
      longitude: -118.2851,
      address: "3670 Trousdale Pkwy, Los Angeles, CA 90089",
      description: "Business school area with security and professional atmosphere"
    }
  ];

  const alternatives = [];
  
  // Filter and score real parking spots based on distance and safety
  realSafeParkingSpots.forEach(spot => {
    const distanceToDestination = calculateDistance(destLat, destLng, spot.latitude, spot.longitude);
    
    // Only include spots within reasonable walking distance (1km)
    if (distanceToDestination <= 1.0) {
      // Count nearby thefts for this real location
      const nearbyThefts = allReports.filter(report => {
        const distance = calculateDistance(spot.latitude, spot.longitude, report.latitude, report.longitude);
        return distance <= 0.3; // Within 300m of this parking spot
      }).length;
      
      // Calculate safety score based on theft count and distance
      const baseScore = 10;
      const theftPenalty = nearbyThefts * 2; // Less penalty than before
      const distanceBonus = Math.max(0, 2 - distanceToDestination); // Closer is better
      const safetyScore = Math.max(1, baseScore - theftPenalty + distanceBonus);
      
      alternatives.push({
        latitude: spot.latitude,
        longitude: spot.longitude,
        theftCount: nearbyThefts,
        distanceFromDestination: distanceToDestination,
        safetyScore: Math.round(safetyScore),
        name: spot.name,
        address: spot.address,
        description: spot.description
      });
    }
  });
  
  // Return top 3 safest and closest alternatives
  return alternatives
    .sort((a, b) => {
      // Primary sort: safety score (higher is better)
      if (b.safetyScore !== a.safetyScore) {
        return b.safetyScore - a.safetyScore;
      }
      // Secondary sort: distance (closer is better)
      return a.distanceFromDestination - b.distanceFromDestination;
    })
    .slice(0, 3);
}

app.post('/api/login', express.json(), async (req, res) => {
  // Login logic with user lookup and UserID return
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    const user = await User.findOne({ username, password });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    // Return user ID for tracking
    res.json({ message: 'Login successful', userId: user._id });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Registration endpoint
app.post('/api/register', express.json(), async (req, res) => {
  const { username, phone, password } = req.body;
  if (!username || !phone || !password) {
    return res.status(400).json({ error: 'All fields required' });
  }
  try {
    const user = new User({ username, phone, password });
    await user.save();
    res.json({ message: 'Registration successful' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update profile picture endpoint
app.post('/api/update-profile-picture', express.json(), async (req, res) => {
  try {
    const { userId, profilePicture } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { profilePicture },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'Profile picture updated successfully', user });
  } catch (err) {
    console.error('Error updating profile picture:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user profile endpoint
app.get('/api/user-profile/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId).select('-password'); // Exclude password
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (err) {
    console.error('Error fetching user profile:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update user profile endpoint (username and email)
app.post('/api/update-user-profile', express.json(), async (req, res) => {
  try {
    const { userId, username, email } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Check if username is being changed and if it's already taken
    if (username) {
      const existingUser = await User.findOne({ username, _id: { $ne: userId } });
      if (existingUser) {
        return res.status(400).json({ error: 'Username is already taken' });
      }
    }

    // Update user profile
    const updateData = {};
    if (username) updateData.username = username;
    if (email !== undefined) updateData.email = email; // Allow setting email to empty string

    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'Profile updated successfully', user });
  } catch (err) {
    console.error('Error updating user profile:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


// Community Posts endpoints
app.post('/api/community-posts', express.json(), async (req, res) => {
  try {
    const { text, image, userId } = req.body;
    
    if (!text || !userId) {
      return res.status(400).json({ error: 'Text and userId are required' });
    }

    // Get user information to include username and profile picture
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const newPost = new CommunityPost({
      username: user.username,
      text,
      image: image || undefined,
      userId,
      avatar: user.profilePicture || '👤', // Use user's profile picture or default avatar
      location: 'Your Location' // You can make this dynamic later
    });

    await newPost.save();
    res.json({ message: 'Post created successfully', post: newPost });
  } catch (err) {
    console.error('Error creating post:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/community-posts', async (req, res) => {
  try {
    const posts = await CommunityPost.find()
      .sort({ timestamp: -1 }) // Most recent first
      .populate('userId', 'username profilePicture') // Include username and profile picture from user
      .lean();

    // Update avatar field with user's profile picture if available
    const postsWithProfilePictures = posts.map(post => ({
      ...post,
      avatar: post.userId?.profilePicture || post.avatar || '👤'
    }));

    res.json({ posts: postsWithProfilePictures });
  } catch (err) {
    console.error('Error fetching posts:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/community-posts/:postId/like', express.json(), async (req, res) => {
  try {
    const { postId } = req.params;
    
    const post = await CommunityPost.findByIdAndUpdate(
      postId,
      { $inc: { likes: 1 } },
      { new: true }
    );

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    res.json({ message: 'Post liked', likes: post.likes });
  } catch (err) {
    console.error('Error liking post:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete post endpoint - only allows post creator to delete
app.delete('/api/community-posts/:postId', express.json(), async (req, res) => {
  try {
    const { postId } = req.params;
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Find the post and check if the user is the creator
    const post = await CommunityPost.findById(postId);
    
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Check if the current user is the creator of the post
    if (post.userId.toString() !== userId) {
      return res.status(403).json({ error: 'You can only delete your own posts' });
    }

    // Delete the post
    await CommunityPost.findByIdAndDelete(postId);
    
    res.json({ message: 'Post deleted successfully' });
  } catch (err) {
    console.error('Error deleting post:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});

