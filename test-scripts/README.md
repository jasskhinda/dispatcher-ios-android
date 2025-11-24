# GPS Location Testing Scripts

These scripts help you test the live tracking feature without needing to physically be at the pickup/destination locations.

## Prerequisites

1. Make sure you have Node.js installed
2. You need a trip that:
   - Has been assigned to a driver
   - Has `status = 'in_progress'`
   - Has valid US pickup and destination addresses

## Option 1: Add a Single Test Location (Quick Test)

This adds one GPS point at the midpoint between pickup and destination.

```bash
cd /Volumes/C/CCTAPPS/dispatcher_mobile
node test-scripts/add-test-location.js <trip_id>
```

**Example:**
```bash
node test-scripts/add-test-location.js 123e4567-e89b-12d3-a456-426614174000
```

**What it does:**
- Geocodes the pickup and destination addresses
- Calculates the midpoint
- Inserts ONE GPS location at that midpoint
- You'll see the driver marker appear on the map

## Option 2: Simulate Moving Driver (Full Test)

This simulates a driver moving from pickup to destination over time.

```bash
cd /Volumes/C/CCTAPPS/dispatcher_mobile
node test-scripts/simulate-driver-location.js <trip_id>
```

**Example:**
```bash
node test-scripts/simulate-driver-location.js 123e4567-e89b-12d3-a456-426614174000
```

**What it does:**
- Geocodes the pickup and destination addresses
- Generates 20 GPS points along a straight line between them
- Inserts one point every 3 seconds
- Calculates realistic heading (direction of travel)
- You'll see the driver marker move across the map in real-time

**To stop the simulation:** Press `Ctrl+C`

## How to Get a Trip ID

### Method 1: From the Database
1. Open your Supabase dashboard
2. Go to Table Editor → trips
3. Find a trip with status = 'in_progress'
4. Copy the `id` column value

### Method 2: From the App
1. Open dispatcher_mobile
2. Navigate to a trip in the "Live" tab
3. The trip ID is in the URL or you can see it in the trip details

## Testing Workflow

### Complete End-to-End Test:

1. **Create a trip** (use US addresses):
   ```
   Pickup: 59 Spruce St, Columbus, OH 43215, USA
   Destination: 205 E Main St, Lancaster, OH 43130, USA
   ```

2. **Assign a driver** in dispatcher_mobile:
   - Go to the trip details
   - Click "Assign Driver"
   - Select a driver

3. **Accept the trip** in driver_mobile:
   - Log in as the driver
   - Go to "My Trips"
   - Click "Accept Trip"

4. **Start the trip** in driver_mobile:
   - Click "Start Trip"
   - This sets status to 'in_progress'

5. **Run the simulation script:**
   ```bash
   node test-scripts/simulate-driver-location.js YOUR_TRIP_ID
   ```

6. **View live tracking** in dispatcher_mobile:
   - Go to "Live" tab
   - Click "VIEW LIVE TRACKING"
   - You should see:
     - Green marker at pickup
     - Red marker at destination
     - Blue car marker moving between them

## Troubleshooting

### "Error fetching trip"
- Make sure the trip ID is correct
- Check that the trip exists in the database

### "Failed to geocode addresses"
- Verify the addresses are valid US addresses
- Check that the Google Maps API key is configured

### Map not showing driver location
- Make sure the trip status is 'in_progress'
- Check that the script successfully inserted GPS data
- Verify the real-time subscription is working in the app

### Script exits immediately
- Check your .env file has the correct Supabase credentials
- Make sure you're running from the dispatcher_mobile directory

## Alternative: Use Real Driver Location

If you have a friend in the US or want to test with real GPS:

1. Install driver_mobile on a phone
2. Log in as a driver
3. Accept and start a trip
4. The app will automatically send GPS data every 10 seconds
5. View it in dispatcher_mobile live tracking

## Cleaning Up Test Data

To remove test GPS points:

```sql
-- Delete all GPS data for a specific trip
DELETE FROM driver_location WHERE trip_id = 'YOUR_TRIP_ID';

-- Or delete all test GPS data
DELETE FROM driver_location;
```
