const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/scooter-safety', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Define the schema (same as in server.js)
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

// Sample data for USC area
const sampleReports = [
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
    raw: "Attempted theft of e-scooter near USC Campus. Suspect fled when confronted.",
    location: "USC Campus",
    latitude: 34.0224,
    longitude: -118.2851,
    title: "Attempted E-Scooter Theft",
    description: "Suspect fled when confronted",
    processed: false
  },
  {
    raw: "E-scooter theft incident reported at USC North. Scooter was secured but lock was cut.",
    location: "USC North",
    latitude: 34.0260,
    longitude: -118.2830,
    title: "E-Scooter Theft Incident",
    description: "Scooter was secured but lock was cut",
    processed: false
  },
  {
    raw: "Electric scooter stolen from USC South area. Theft occurred during daylight hours.",
    location: "USC South",
    latitude: 34.0180,
    longitude: -118.2880,
    title: "Electric Scooter Stolen",
    description: "Theft occurred during daylight hours",
    processed: false
  },
  {
    raw: "Scooter theft reported near USC East campus. Multiple witnesses saw suspect.",
    location: "USC East",
    latitude: 34.0230,
    longitude: -118.2810,
    title: "Scooter Theft Reported",
    description: "Multiple witnesses saw suspect",
    processed: false
  },
  {
    raw: "E-scooter missing from USC West parking area. Owner suspects theft.",
    location: "USC West",
    latitude: 34.0200,
    longitude: -118.2920,
    title: "E-Scooter Missing",
    description: "Owner suspects theft",
    processed: false
  },
  {
    raw: "Electric scooter theft at USC Central location. Security footage being reviewed.",
    location: "USC Central",
    latitude: 34.0245,
    longitude: -118.2865,
    title: "Electric Scooter Theft",
    description: "Security footage being reviewed",
    processed: false
  },
  {
    raw: "Scooter stolen from USC Perimeter area. Lock was broken by suspect.",
    location: "USC Perimeter",
    latitude: 34.0215,
    longitude: -118.2845,
    title: "Scooter Stolen",
    description: "Lock was broken by suspect",
    processed: false
  },
  {
    raw: "E-scooter theft in USC Neighborhood. Victim chased suspect but lost them.",
    location: "USC Neighborhood",
    latitude: 34.0235,
    longitude: -118.2875,
    title: "E-Scooter Theft",
    description: "Victim chased suspect but lost them",
    processed: false
  },
  {
    raw: "Electric scooter stolen from USC District. Theft reported to campus security.",
    location: "USC District",
    latitude: 34.0205,
    longitude: -118.2835,
    title: "Electric Scooter Stolen",
    description: "Theft reported to campus security",
    processed: false
  },
  {
    raw: "Scooter theft at USC Zone parking area. Suspect used bolt cutters on lock.",
    location: "USC Zone",
    latitude: 34.0255,
    longitude: -118.2855,
    title: "Scooter Theft",
    description: "Suspect used bolt cutters on lock",
    processed: false
  },
  {
    raw: "E-scooter stolen from Downtown USC area. Theft occurred late at night.",
    location: "Downtown USC",
    latitude: 34.0240,
    longitude: -118.2790,
    title: "E-Scooter Stolen",
    description: "Theft occurred late at night",
    processed: false
  },
  {
    raw: "Electric scooter theft reported in USC Area. Multiple scooters targeted.",
    location: "USC Area",
    latitude: 34.0210,
    longitude: -118.2870,
    title: "Electric Scooter Theft",
    description: "Multiple scooters targeted",
    processed: false
  },
  {
    raw: "Scooter stolen from USC Vicinity. Suspect seen fleeing on foot.",
    location: "USC Vicinity",
    latitude: 34.0199,
    longitude: -118.2899,
    title: "Scooter Stolen",
    description: "Suspect seen fleeing on foot",
    processed: false
  }
];

async function seedDatabase() {
  try {
    console.log('🌱 Seeding database with sample scooter theft reports...');
    
    // Clear existing reports
    await ScooterReport.deleteMany({});
    console.log('✅ Cleared existing reports');
    
    // Insert sample reports
    const insertedReports = await ScooterReport.insertMany(sampleReports);
    console.log(`✅ Inserted ${insertedReports.length} sample reports`);
    
    // Verify the data
    const count = await ScooterReport.countDocuments();
    console.log(`📊 Total reports in database: ${count}`);
    
    console.log('🎉 Database seeded successfully!');
    console.log('\n🧪 Now you can test with:');
    console.log('curl https://localhost:3001/api/scooter-reports');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

// Run seeding if this file is executed directly
if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };