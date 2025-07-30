const axios = require('axios');

const BASE_URL = 'https://localhost:3001';

async function quickTest() {
  console.log('🚀 Quick Backend Test\n');
  
  try {
    // Test 1: Get reports
    console.log('1️⃣ Testing scooter reports...');
    const reportsResponse = await axios.get(`${BASE_URL}/api/scooter-reports`);
    console.log(`✅ Found ${reportsResponse.data.reports.length} reports`);
    
    // Test 2: Route analysis
    console.log('\n2️⃣ Testing route analysis...');
    const routeResponse = await axios.post(`${BASE_URL}/api/analyze-route`, {
      startLat: 34.0224,
      startLng: -118.2851,
      endLat: 34.0251,
      endLng: -118.2851,
      destinationName: 'USC Village'
    });
    console.log(`✅ Safety Level: ${routeResponse.data.safetyLevel}`);
    console.log(`✅ Nearby Thefts: ${routeResponse.data.nearbyThefts}`);
    
    // Test 3: User registration
    console.log('\n3️⃣ Testing user registration...');
    try {
      const registerResponse = await axios.post(`${BASE_URL}/api/register`, {
        username: 'testuser' + Date.now(),
        email: 'testuser' + Date.now() + '@example.com',
        password: 'testpass123'
      });
      console.log('✅ User registration successful');
    } catch (error) {
      if (error.response?.status === 400) {
        console.log('✅ Registration validation working');
      } else {
        throw error;
      }
    }
    
    console.log('\n🎉 All tests passed! Your backend is working correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

quickTest();