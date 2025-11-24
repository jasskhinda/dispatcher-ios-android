/**
 * Simulate Driver Location for Testing
 *
 * This script simulates a driver moving from pickup to destination
 * by inserting GPS coordinates into the driver_location table.
 *
 * Usage: node test-scripts/simulate-driver-location.js <trip_id>
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

// Helper to interpolate between two points
function interpolateCoordinates(start, end, steps) {
  const coordinates = [];
  for (let i = 0; i <= steps; i++) {
    const ratio = i / steps;
    coordinates.push({
      latitude: start.latitude + (end.latitude - start.latitude) * ratio,
      longitude: start.longitude + (end.longitude - start.longitude) * ratio,
    });
  }
  return coordinates;
}

async function simulateDriverLocation(tripId) {
  console.log(`🚗 Starting location simulation for trip ${tripId}...`);

  // Fetch trip details
  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select('*')
    .eq('id', tripId)
    .single();

  if (tripError || !trip) {
    console.error('❌ Error fetching trip:', tripError);
    return;
  }

  console.log('📍 Pickup:', trip.pickup_address);
  console.log('📍 Destination:', trip.destination_address);

  // Geocode addresses
  const pickupCoords = await geocodeAddress(trip.pickup_address);
  const destCoords = await geocodeAddress(trip.destination_address);

  if (!pickupCoords || !destCoords) {
    console.error('❌ Failed to geocode addresses');
    return;
  }

  console.log(`✅ Pickup coords: ${pickupCoords.latitude}, ${pickupCoords.longitude}`);
  console.log(`✅ Destination coords: ${destCoords.latitude}, ${destCoords.longitude}`);

  // Generate 20 points along the route
  const route = interpolateCoordinates(pickupCoords, destCoords, 20);
  console.log(`\n🗺️  Generated ${route.length} GPS points along route`);

  // Insert GPS points every 3 seconds
  let pointIndex = 0;
  const interval = setInterval(async () => {
    if (pointIndex >= route.length) {
      clearInterval(interval);
      console.log('\n✅ Simulation complete!');
      process.exit(0);
    }

    const coords = route[pointIndex];

    // Calculate heading (direction of travel)
    let heading = 0;
    if (pointIndex < route.length - 1) {
      const next = route[pointIndex + 1];
      heading = calculateBearing(coords, next);
    }

    const { error } = await supabase
      .from('driver_location')
      .insert({
        trip_id: tripId,
        latitude: coords.latitude,
        longitude: coords.longitude,
        heading: heading,
        speed: 15.0, // ~15 m/s = ~54 km/h
        accuracy: 10,
        timestamp: new Date().toISOString(),
      });

    if (error) {
      console.error('❌ Error inserting location:', error);
    } else {
      console.log(`📍 Point ${pointIndex + 1}/${route.length}: ${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`);
    }

    pointIndex++;
  }, 3000); // Every 3 seconds
}

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

function calculateBearing(start, end) {
  const startLat = start.latitude * Math.PI / 180;
  const startLng = start.longitude * Math.PI / 180;
  const endLat = end.latitude * Math.PI / 180;
  const endLng = end.longitude * Math.PI / 180;

  const dLng = endLng - startLng;

  const y = Math.sin(dLng) * Math.cos(endLat);
  const x = Math.cos(startLat) * Math.sin(endLat) -
            Math.sin(startLat) * Math.cos(endLat) * Math.cos(dLng);

  let bearing = Math.atan2(y, x) * 180 / Math.PI;
  bearing = (bearing + 360) % 360;

  return bearing;
}

// Get trip ID from command line
const tripId = process.argv[2];

if (!tripId) {
  console.error('❌ Usage: node simulate-driver-location.js <trip_id>');
  process.exit(1);
}

simulateDriverLocation(tripId);
