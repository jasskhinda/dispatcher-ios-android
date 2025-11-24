# Driver Assignment and Tracking Workflow

## Overview
This document explains the driver assignment workflow that keeps dispatcher_mobile and driver_mobile functionality separate from facility_app and booking_app.

## Database Schema Changes

### New Column: `driver_acceptance_status`
A separate column to track driver workflow without affecting the main `status` column used by facility_app and booking_app.

**Values:**
- `pending` - Default state, no driver assigned
- `assigned_waiting` - Dispatcher has assigned a driver, waiting for acceptance
- `accepted` - Driver has accepted the trip
- `started` - Driver has started the trip (status = 'in_progress')
- `completed` - Trip completed (status = 'completed')

### Existing Columns Used:
- `assigned_driver_id` - Set by dispatcher when assigning a driver
- `driver_id` - Set when driver accepts the trip
- `status` - Main trip status (unchanged by driver acceptance, used by all apps)

## SQL Migrations Required

Run these migrations in order:

1. **add_assigned_driver_id.sql** - Adds assigned_driver_id column and RLS policies
2. **add_driver_acceptance_status.sql** - Adds driver_acceptance_status column

Do NOT run: `fix_trips_status_constraint.sql` (this was the old approach)

## Workflow Steps

### 1. Dispatcher Assigns Driver
**App:** dispatcher_mobile
**Action:** Navigate to trip → Click "Assign Driver" → Select driver
**Database Update:**
```javascript
{
  assigned_driver_id: driverId,
  driver_acceptance_status: 'assigned_waiting',
  // status remains 'upcoming' or whatever it was
}
```

### 2. Driver Sees Assigned Trip
**App:** driver_mobile
**Screen:** TripsScreen (My Trips tab)
**Query:** Shows trips where `assigned_driver_id = user.id` OR `driver_id = user.id`

### 3. Driver Accepts Trip
**App:** driver_mobile
**Screen:** TripDetailsScreen
**Button:** "Accept Trip" (shows when `driver_acceptance_status = 'assigned_waiting'`)
**Database Update:**
```javascript
{
  driver_id: user.id,
  driver_acceptance_status: 'accepted',
  // status remains unchanged
}
```

### 4. Driver Starts Trip
**App:** driver_mobile
**Screen:** TripDetailsScreen
**Button:** "Start Trip" (shows when `driver_acceptance_status = 'accepted'`)
**Database Update:**
```javascript
{
  status: 'in_progress',
  driver_acceptance_status: 'started',
}
```
**GPS Tracking:** Starts automatically when status becomes 'in_progress'

### 5. Driver Completes Trip
**App:** driver_mobile
**Screen:** TripDetailsScreen
**Button:** "Complete Trip" (shows when `status = 'in_progress'`)
**Database Update:**
```javascript
{
  status: 'completed',
  driver_acceptance_status: 'completed',
}
```

## Why This Approach?

### Problem with Original Approach
The original approach changed trip `status` to 'assigned' when driver accepted, which:
- Violated the database constraint (status constraint didn't include 'assigned')
- Would break facility_app and booking_app which rely on specific status values
- Made trips disappear from facility views when assigned to driver

### Solution
Using `driver_acceptance_status` column:
- ✅ Keeps main `status` column unchanged
- ✅ facility_app and booking_app are unaffected
- ✅ dispatcher_mobile and driver_mobile have their own workflow tracking
- ✅ GPS tracking still activates when `status = 'in_progress'`
- ✅ No database constraint violations

## Code Changes Summary

### dispatcher_mobile
- **AssignDriverScreen.js** - Sets `driver_acceptance_status: 'assigned_waiting'`

### driver_mobile
- **TripDetailsScreen.js**:
  - `acceptTrip()` - Sets `driver_acceptance_status: 'accepted'`
  - `updateStatus()` - Updates `driver_acceptance_status` when starting/completing
  - `canAccept` - Checks `driver_acceptance_status === 'assigned_waiting'`
  - `canStart` - Checks `driver_acceptance_status === 'accepted'`
- **TripsScreen.js** - Already queries by `assigned_driver_id` and `driver_id`

## Testing Checklist

- [ ] Run both SQL migrations
- [ ] Dispatcher assigns driver → trip stays "upcoming" in all apps
- [ ] Driver sees trip in "My Trips"
- [ ] Driver accepts trip → `driver_acceptance_status = 'accepted'`
- [ ] Driver starts trip → GPS tracking activates
- [ ] Dispatcher sees live location in "Live" tab
- [ ] Driver completes trip
- [ ] Verify trip still visible in facility_app and booking_app throughout
