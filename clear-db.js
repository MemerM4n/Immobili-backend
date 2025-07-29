const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/scooter-safety', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Define the schema (same as in server.js)
const scooterReportSchema = new mongoose.Schema({
  raw: String,
  location: String,
  latitude: Number,
  longitude: Number,
  title: String,
  description: String,
  date: { type: Date, default: Date.now }
});

const ScooterReport = mongoose.model('ScooterReport', scooterReportSchema);

async function clearDatabase() {
  try {
    console.log('Connecting to database...');
    
    // Clear all existing reports
    const result = await ScooterReport.deleteMany({});
    console.log(`Cleared ${result.deletedCount} existing reports`);
    
    console.log('Database cleared successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error clearing database:', error);
    process.exit(1);
  }
}

clearDatabase();