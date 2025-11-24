import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Alert,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { supabase } from '../lib/supabase';
import Header from '../components/Header';

const BRAND_COLOR = '#5fbfc0';
const { width, height } = Dimensions.get('window');

export default function LiveTrackingScreen({ route, navigation }) {
  const { tripId } = route.params;
  const [trip, setTrip] = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pickupCoords, setPickupCoords] = useState(null);
  const [destinationCoords, setDestinationCoords] = useState(null);
  const mapRef = useRef(null);
  const locationSubscription = useRef(null);

  useEffect(() => {
    fetchTripDetails();
    subscribeToDriverLocation();

    return () => {
      if (locationSubscription.current) {
        locationSubscription.current.unsubscribe();
      }
    };
  }, [tripId]);

  const fetchTripDetails = async () => {
    try {
      const { data: tripData, error } = await supabase
        .from('trips')
        .select('*')
        .eq('id', tripId)
        .single();

      if (error) throw error;

      // Fetch driver profile
      let driverData = null;
      if (tripData.driver_id) {
        const { data: driver } = await supabase
          .from('profiles')
          .select('first_name, last_name, phone')
          .eq('id', tripData.driver_id)
          .single();
        driverData = driver;
      }

      // Fetch client data
      let clientData = null;
      if (tripData.managed_client_id) {
        const { data: client } = await supabase
          .from('facility_managed_clients')
          .select('first_name, last_name')
          .eq('id', tripData.managed_client_id)
          .single();
        clientData = client;
      } else if (tripData.user_id) {
        const { data: user } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', tripData.user_id)
          .single();
        clientData = user;
      }

      setTrip({ ...tripData, driver: driverData, client: clientData });

      // Geocode addresses
      if (tripData.pickup_address) {
        geocodeAddress(tripData.pickup_address, setPickupCoords);
      }
      if (tripData.destination_address) {
        geocodeAddress(tripData.destination_address, setDestinationCoords);
      }

      // Fetch latest driver location
      const { data: latestLocation } = await supabase
        .from('driver_location')
        .select('*')
        .eq('trip_id', tripId)
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();

      if (latestLocation) {
        setDriverLocation({
          latitude: latestLocation.latitude,
          longitude: latestLocation.longitude,
          heading: latestLocation.heading,
          speed: latestLocation.speed,
        });
      }

      setLoading(false);
    } catch (error) {
      console.error('Error fetching trip details:', error);
      Alert.alert('Error', 'Failed to load trip details');
      setLoading(false);
    }
  };

  const subscribeToDriverLocation = () => {
    locationSubscription.current = supabase
      .channel(`driver_location_${tripId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'driver_location',
          filter: `trip_id=eq.${tripId}`,
        },
        (payload) => {
          const newLocation = payload.new;
          setDriverLocation({
            latitude: newLocation.latitude,
            longitude: newLocation.longitude,
            heading: newLocation.heading,
            speed: newLocation.speed,
          });
        }
      )
      .subscribe();
  };

  const geocodeAddress = async (address, setCoords) => {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=AIzaSyDylwCsypHOs6T9e-JnTA7AoqOMrc3hbhE`
      );
      const data = await response.json();
      if (data.results && data.results.length > 0) {
        const { lat, lng } = data.results[0].geometry.location;
        setCoords({ latitude: lat, longitude: lng });
      }
    } catch (error) {
      console.error('Error geocoding address:', error);
    }
  };

  // Fit map to show all markers
  useEffect(() => {
    if (mapRef.current && pickupCoords && destinationCoords && driverLocation) {
      const coordinates = [pickupCoords, destinationCoords, driverLocation];
      mapRef.current.fitToCoordinates(coordinates, {
        edgePadding: { top: 100, right: 50, bottom: 300, left: 50 },
        animated: true,
      });
    }
  }, [pickupCoords, destinationCoords, driverLocation]);

  const getClientName = () => {
    if (!trip?.client) return 'Unknown Client';
    return `${trip.client.first_name || ''} ${trip.client.last_name || ''}`.trim();
  };

  const getDriverName = () => {
    if (!trip?.driver) return 'Driver';
    return `${trip.driver.first_name || ''} ${trip.driver.last_name || ''}`.trim();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'assigned':
        return '#3B82F6';
      case 'in_progress':
        return '#F59E0B';
      case 'completed':
        return '#10B981';
      default:
        return '#6B7280';
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Live Tracking" showBack onBackPress={() => navigation.goBack()} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={BRAND_COLOR} />
        </View>
      </View>
    );
  }

  if (!trip) {
    return (
      <View style={styles.container}>
        <Header title="Live Tracking" showBack onBackPress={() => navigation.goBack()} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Trip not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Live Tracking" showBack onBackPress={() => navigation.goBack()} />

      {/* Map View */}
      <View style={styles.mapContainer}>
        {pickupCoords && destinationCoords ? (
          <MapView
            ref={mapRef}
            style={styles.map}
            provider={PROVIDER_GOOGLE}
            initialRegion={{
              latitude: pickupCoords.latitude,
              longitude: pickupCoords.longitude,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            }}
            showsUserLocation={false}
            showsMyLocationButton={false}
            loadingEnabled={true}
          >
            {/* Pickup Marker */}
            <Marker
              coordinate={pickupCoords}
              title="Pickup Location"
              description={trip.pickup_address}
            >
              <View style={styles.pickupMarker}>
                <Ionicons name="location" size={32} color="#10B981" />
              </View>
            </Marker>

            {/* Destination Marker */}
            <Marker
              coordinate={destinationCoords}
              title="Destination"
              description={trip.destination_address}
            >
              <View style={styles.destinationMarker}>
                <Ionicons name="flag" size={32} color="#EF4444" />
              </View>
            </Marker>

            {/* Driver Location Marker */}
            {driverLocation && (
              <Marker
                coordinate={driverLocation}
                title={getDriverName()}
                anchor={{ x: 0.5, y: 0.5 }}
                rotation={driverLocation.heading || 0}
              >
                <View style={styles.driverMarker}>
                  <View style={styles.driverMarkerInner}>
                    <Ionicons name="car" size={24} color="#fff" />
                  </View>
                </View>
              </Marker>
            )}

            {/* Route Polyline */}
            {driverLocation && (
              <Polyline
                coordinates={[pickupCoords, driverLocation, destinationCoords]}
                strokeColor={BRAND_COLOR}
                strokeWidth={4}
                lineDashPattern={[1]}
              />
            )}
          </MapView>
        ) : (
          <View style={styles.map}>
            <ActivityIndicator size="large" color={BRAND_COLOR} />
          </View>
        )}
      </View>

      {/* Trip Info Overlay */}
      <View style={styles.infoOverlay}>
        {/* Status Badge */}
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(trip.status) }]}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>
            {trip.status === 'in_progress' ? 'Trip in Progress' : trip.status}
          </Text>
        </View>

        {/* Driver Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.driverInfoHeader}>
            <View style={styles.driverAvatar}>
              <Ionicons name="person" size={28} color={BRAND_COLOR} />
            </View>
            <View style={styles.driverInfo}>
              <Text style={styles.driverName}>{getDriverName()}</Text>
              <Text style={styles.driverLabel}>Your Driver</Text>
            </View>
            {trip.driver?.phone && (
              <TouchableOpacity
                style={styles.callButton}
                onPress={() => {
                  if (trip.driver?.phone) {
                    Linking.openURL(`tel:${trip.driver.phone}`);
                  }
                }}
              >
                <Ionicons name="call" size={20} color="#fff" />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.divider} />

          {/* Trip Details */}
          <View style={styles.tripDetails}>
            <View style={styles.detailRow}>
              <Ionicons name="person-outline" size={18} color="#666" />
              <Text style={styles.detailText}>{getClientName()}</Text>
            </View>

            <View style={styles.detailRow}>
              <Ionicons name="location-outline" size={18} color="#10B981" />
              <Text style={styles.detailText} numberOfLines={1}>
                {trip.pickup_address}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Ionicons name="flag-outline" size={18} color="#EF4444" />
              <Text style={styles.detailText} numberOfLines={1}>
                {trip.destination_address}
              </Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.detailsButton}
            onPress={() => navigation.navigate('TripDetails', { tripId: trip.id })}
          >
            <Ionicons name="information-circle-outline" size={20} color={BRAND_COLOR} />
            <Text style={styles.detailsButtonText}>View Full Details</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#999',
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  pickupMarker: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  destinationMarker: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverMarker: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  driverMarkerInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: BRAND_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  statusBadge: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  statusText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  driverInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  driverAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  driverLabel: {
    fontSize: 13,
    color: '#999',
    marginTop: 2,
  },
  callButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: BRAND_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginVertical: 12,
  },
  tripDetails: {
    gap: 10,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  detailText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  actionButtons: {
    gap: 10,
  },
  detailsButton: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: BRAND_COLOR,
  },
  detailsButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: BRAND_COLOR,
  },
});
