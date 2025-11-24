/**
 * Add a single test GPS location
 *
 * This script adds one GPS point at the midpoint between pickup and destination
 * for quick testing of the live tracking map.
 *
 * Usage: node test-scripts/add-test-location.js <trip_id>
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function geocodeAddress(address) {
  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=AIzaSyDylwCsypHOs6T9e-JnTA7AoqOMrc3hbhE`
    );
    const data = await response.json();

    if (data.results && data.results.length > 0) {
      const { lat, lng } = data.results[0].geometry.location;
      return { latitude: lat, longitude: lng };
    }
    return null;
  } catch (error) {
    console.error('Error geocoding:', error);
    return null;
  }
}

async function addTestLocation(tripId) {
  console.log(`🚗 Adding test location for trip ${tripId}...`);

  // Fetch trip details
  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select('*')
    .eq('id', tripId)
    .single();

  if (tripError || !trip) {
    console.error('❌ Error fetching trip:', tripError);
    process.exit(1);
  }

  console.log('📍 Pickup:', trip.pickup_address);
  console.log('📍 Destination:', trip.destination_address);

  // Geocode addresses
  const pickupCoords = await geocodeAddress(trip.pickup_address);
  const destCoords = await geocodeAddress(trip.destination_address);

  if (!pickupCoords || !destCoords) {
    console.error('❌ Failed to geocode addresses');
    process.exit(1);
  }

  // Calculate midpoint
  const midpoint = {
    latitude: (pickupCoords.latitude + destCoords.latitude) / 2,
    longitude: (pickupCoords.longitude + destCoords.longitude) / 2,
  };

  console.log(`\n📍 Pickup coords: ${pickupCoords.latitude.toFixed(6)}, ${pickupCoords.longitude.toFixed(6)}`);
  console.log(`📍 Destination coords: ${destCoords.latitude.toFixed(6)}, ${destCoords.longitude.toFixed(6)}`);
  console.log(`📍 Test location (midpoint): ${midpoint.latitude.toFixed(6)}, ${midpoint.longitude.toFixed(6)}`);

  // Insert the test location
  const { error } = await supabase
    .from('driver_location')
    .insert({
      trip_id: tripId,
      latitude: midpoint.latitude,
      longitude: midpoint.longitude,
      heading: 45, // Northeast
      speed: 15.0,
      accuracy: 10,
      timestamp: new Date().toISOString(),
    });

  if (error) {
    console.error('❌ Error inserting location:', error);
    process.exit(1);
  }

  console.log('\n✅ Test location added successfully!');
  console.log('🗺️  Open the Live Tracking screen in dispatcher_mobile to see it on the map');
  process.exit(0);
}

// Get trip ID from command line
const tripId = process.argv[2];

if (!tripId) {
  console.error('❌ Usage: node test-scripts/add-test-location.js <trip_id>');
  console.error('Example: node test-scripts/add-test-location.js 123e4567-e89b-12d3-a456-426614174000');
  process.exit(1);
}

addTestLocation(tripId);
