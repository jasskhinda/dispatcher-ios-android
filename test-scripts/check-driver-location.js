/**
 * Check driver location data for a trip
 *
 * Usage: node test-scripts/check-driver-location.js <trip_id>
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function checkDriverLocation(tripId) {
  console.log(`🔍 Checking driver location for trip ${tripId}...\n`);

  // Fetch all driver locations for this trip
  const { data: locations, error } = await supabase
    .from('driver_location')
    .select('*')
    .eq('trip_id', tripId)
    .order('timestamp', { ascending: false })
    .limit(10);

  if (error) {
    console.error('❌ Error fetching locations:', error);
    process.exit(1);
  }

  if (!locations || locations.length === 0) {
    console.log('⚠️  No driver location data found for this trip');
    console.log('📱 Make sure the driver has:');
    console.log('   1. Accepted the trip');
    console.log('   2. Started the trip (status = in_progress)');
    console.log('   3. Granted location permissions in driver_mobile app');
    process.exit(0);
  }

  console.log(`✅ Found ${locations.length} location record(s):\n`);
  locations.forEach((loc, index) => {
    console.log(`${index + 1}. 📍 ${loc.latitude.toFixed(6)}, ${loc.longitude.toFixed(6)}`);
    console.log(`   🧭 Heading: ${loc.heading || 'N/A'}`);
    console.log(`   ⏱️  Timestamp: ${new Date(loc.timestamp).toLocaleString()}`);
    console.log(`   👤 Driver ID: ${loc.driver_id}`);
    console.log('');
  });

  console.log('💡 Latest location will be shown on Live Tracking screen\n');
  process.exit(0);
}

// Get trip ID from command line
const tripId = process.argv[2];

if (!tripId) {
  console.error('❌ Usage: node test-scripts/check-driver-location.js <trip_id>');
  console.error('Example: node test-scripts/check-driver-location.js 123e4567-e89b-12d3-a456-426614174000');
  process.exit(1);
}

checkDriverLocation(tripId);
