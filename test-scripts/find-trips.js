/**
 * Find active trips in the database
 *
 * Usage: node test-scripts/find-trips.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function findTrips() {
  console.log('🔍 Searching for trips...\n');

  // Find in_progress trips
  const { data: inProgressTrips, error: inProgressError } = await supabase
    .from('trips')
    .select('id, status, pickup_address, destination_address, pickup_time, driver_id, assigned_driver_id')
    .eq('status', 'in_progress')
    .order('pickup_time', { ascending: false })
    .limit(10);

  if (inProgressError) {
    console.error('❌ Error fetching in_progress trips:', inProgressError);
  } else if (inProgressTrips && inProgressTrips.length > 0) {
    console.log('✅ IN PROGRESS TRIPS:');
    inProgressTrips.forEach((trip, index) => {
      console.log(`\n${index + 1}. Trip ID: ${trip.id}`);
      console.log(`   Status: ${trip.status}`);
      console.log(`   Pickup: ${trip.pickup_address}`);
      console.log(`   Destination: ${trip.destination_address}`);
      console.log(`   Driver ID: ${trip.driver_id || 'Not assigned'}`);
      console.log(`   Assigned Driver ID: ${trip.assigned_driver_id || 'None'}`);
    });
  } else {
    console.log('⚠️  No in_progress trips found');
  }

  // Find upcoming trips
  const { data: upcomingTrips, error: upcomingError } = await supabase
    .from('trips')
    .select('id, status, pickup_address, destination_address, pickup_time, driver_id, assigned_driver_id')
    .eq('status', 'upcoming')
    .order('pickup_time', { ascending: false })
    .limit(10);

  if (upcomingError) {
    console.error('❌ Error fetching upcoming trips:', upcomingError);
  } else if (upcomingTrips && upcomingTrips.length > 0) {
    console.log('\n\n✅ UPCOMING TRIPS:');
    upcomingTrips.forEach((trip, index) => {
      console.log(`\n${index + 1}. Trip ID: ${trip.id}`);
      console.log(`   Status: ${trip.status}`);
      console.log(`   Pickup: ${trip.pickup_address}`);
      console.log(`   Destination: ${trip.destination_address}`);
      console.log(`   Driver ID: ${trip.driver_id || 'Not assigned'}`);
      console.log(`   Assigned Driver ID: ${trip.assigned_driver_id || 'None'}`);
    });
  } else {
    console.log('\n⚠️  No upcoming trips found');
  }

  // Find all recent trips
  const { data: allTrips, error: allError } = await supabase
    .from('trips')
    .select('id, status, pickup_address, destination_address, pickup_time, driver_id, assigned_driver_id')
    .order('created_at', { ascending: false })
    .limit(5);

  if (allError) {
    console.error('❌ Error fetching all trips:', allError);
  } else if (allTrips && allTrips.length > 0) {
    console.log('\n\n✅ MOST RECENT TRIPS (any status):');
    allTrips.forEach((trip, index) => {
      console.log(`\n${index + 1}. Trip ID: ${trip.id}`);
      console.log(`   Status: ${trip.status}`);
      console.log(`   Pickup: ${trip.pickup_address}`);
      console.log(`   Destination: ${trip.destination_address}`);
      console.log(`   Driver ID: ${trip.driver_id || 'Not assigned'}`);
      console.log(`   Assigned Driver ID: ${trip.assigned_driver_id || 'None'}`);
    });
  }

  console.log('\n\n💡 To test live tracking:');
  console.log('   1. Pick a trip ID from above (preferably in_progress)');
  console.log('   2. Run: node test-scripts/add-test-location.js <trip_id>');
  console.log('   3. Open Live Tracking in dispatcher_mobile\n');

  process.exit(0);
}

findTrips();
