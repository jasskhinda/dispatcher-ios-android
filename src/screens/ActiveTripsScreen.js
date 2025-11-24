import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import Header from '../components/Header';

const BRAND_COLOR = '#5fbfc0';

export default function ActiveTripsScreen({ navigation }) {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchActiveTrips();

    // Subscribe to real-time changes for in_progress trips
    const subscription = supabase
      .channel('active_trips')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trips',
          filter: 'status=eq.in_progress',
        },
        (payload) => {
          console.log('Trip status changed:', payload);
          fetchActiveTrips();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchActiveTrips = async () => {
    try {
      console.log('🚗 Fetching active trips...');

      // Fetch all trips with status='in_progress'
      const { data: tripsData, error } = await supabase
        .from('trips')
        .select('*')
        .eq('status', 'in_progress')
        .order('pickup_time', { ascending: true });

      if (error) throw error;

      // Enrich trips with driver and client data
      const enrichedTrips = await Promise.all(
        tripsData.map(async (trip) => {
          let driverData = null;
          let clientData = null;

          // Fetch driver info
          if (trip.assigned_driver_id) {
            const { data: driver } = await supabase
              .from('profiles')
              .select('id, full_name, phone_number')
              .eq('id', trip.assigned_driver_id)
              .single();
            driverData = driver;
          }

          // Fetch client info
          if (trip.managed_client_id) {
            const { data: client } = await supabase
              .from('facility_managed_clients')
              .select('id, first_name, last_name')
              .eq('id', trip.managed_client_id)
              .single();
            clientData = client;
          } else if (trip.user_id) {
            const { data: user } = await supabase
              .from('profiles')
              .select('id, full_name')
              .eq('id', trip.user_id)
              .single();
            clientData = user;
          }

          return {
            ...trip,
            driver: driverData,
            client: clientData,
          };
        })
      );

      setTrips(enrichedTrips);
      console.log(`✅ Found ${enrichedTrips.length} active trips`);
    } catch (error) {
      console.error('Error fetching active trips:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchActiveTrips();
  }, []);

  const getClientName = (trip) => {
    if (trip.client) {
      if (trip.client.first_name && trip.client.last_name) {
        return `${trip.client.first_name} ${trip.client.last_name}`;
      }
      if (trip.client.full_name) {
        return trip.client.full_name;
      }
    }
    return 'Unknown Client';
  };

  const getDriverName = (trip) => {
    if (trip.driver?.full_name) {
      return trip.driver.full_name;
    }
    return 'Unassigned';
  };

  const formatTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const renderTripCard = ({ item: trip }) => (
    <TouchableOpacity
      style={styles.tripCard}
      onPress={() => navigation.navigate('LiveTracking', { tripId: trip.id })}
      activeOpacity={0.7}
    >
      {/* Header with Status Badge */}
      <View style={styles.cardHeader}>
        <View style={styles.statusBadge}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>In Progress</Text>
        </View>
        <View style={styles.liveIndicator}>
          <Ionicons name="navigate" size={16} color={BRAND_COLOR} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      </View>

      {/* Driver Info */}
      <View style={styles.driverSection}>
        <View style={styles.driverAvatar}>
          <Ionicons name="person" size={24} color={BRAND_COLOR} />
        </View>
        <View style={styles.driverInfo}>
          <Text style={styles.driverLabel}>Driver</Text>
          <Text style={styles.driverName}>{getDriverName(trip)}</Text>
        </View>
      </View>

      {/* Client Info */}
      <View style={styles.detailRow}>
        <Ionicons name="person-outline" size={18} color="#666" />
        <Text style={styles.detailText}>{getClientName(trip)}</Text>
      </View>

      {/* Pickup Location */}
      <View style={styles.detailRow}>
        <Ionicons name="location" size={18} color="#10B981" />
        <Text style={styles.detailText} numberOfLines={1}>
          {trip.pickup_address}
        </Text>
      </View>

      {/* Destination */}
      <View style={styles.detailRow}>
        <Ionicons name="flag" size={18} color="#EF4444" />
        <Text style={styles.detailText} numberOfLines={1}>
          {trip.destination_address}
        </Text>
      </View>

      {/* Pickup Time */}
      <View style={styles.timeRow}>
        <Ionicons name="time-outline" size={18} color="#666" />
        <Text style={styles.timeText}>
          {formatDate(trip.pickup_time)} at {formatTime(trip.pickup_time)}
        </Text>
      </View>

      {/* View Live Tracking Button */}
      <View style={styles.trackingButtonContainer}>
        <View style={styles.trackingButton}>
          <Ionicons name="navigate-circle" size={20} color="#fff" />
          <Text style={styles.trackingButtonText}>View Live Tracking</Text>
          <Ionicons name="chevron-forward" size={20} color="#fff" />
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Active Trips" showMessaging={true} />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={BRAND_COLOR} />
          <Text style={styles.loadingText}>Loading active trips...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Active Trips" showMessaging={true} />

      {trips.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="car-outline" size={64} color="#ccc" />
          <Text style={styles.emptyTitle}>No Active Trips</Text>
          <Text style={styles.emptySubtitle}>
            When drivers start trips, they'll appear here for live tracking
          </Text>
        </View>
      ) : (
        <FlatList
          data={trips}
          renderItem={renderTripCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={BRAND_COLOR}
            />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },
  listContainer: {
    padding: 16,
  },
  tripCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  separator: {
    height: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F59E0B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E6F7F7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  liveText: {
    color: BRAND_COLOR,
    fontSize: 12,
    fontWeight: '700',
  },
  driverSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    gap: 12,
  },
  driverAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E6F7F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  driverInfo: {
    flex: 1,
  },
  driverLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 2,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  detailText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 10,
  },
  timeText: {
    fontSize: 13,
    color: '#666',
  },
  trackingButtonContainer: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 16,
    marginTop: 4,
  },
  trackingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BRAND_COLOR,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  trackingButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
