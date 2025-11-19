import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Header from '../components/Header';

const BRAND_COLOR = '#5fbfc0';

const AllTripsScreen = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [trips, setTrips] = useState([]);
  const [filteredTrips, setFilteredTrips] = useState([]);
  const [statusFilter, setStatusFilter] = useState('recent');

  // Fetch trips on screen focus
  useFocusEffect(
    React.useCallback(() => {
      fetchAllTrips();
    }, [])
  );

  const fetchAllTrips = async () => {
    try {
      console.log('🔍 Fetching all trips...');

      // Fetch all trips (both facility and individual)
      const { data: rawTripsData, error: tripsError } = await supabase
        .from('trips')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (tripsError) throw tripsError;

      console.log(`✅ Found ${rawTripsData?.length || 0} total trips`);

      // Enrich trips with related data
      const tripsWithData = await Promise.all(
        rawTripsData.map(async (trip) => {
          const tripData = { ...trip };

          // Check if it's a facility trip
          if (trip.facility_id) {
            tripData.tripType = 'facility';

            // Fetch facility data
            const { data: facilityData } = await supabase
              .from('facilities')
              .select('name')
              .eq('id', trip.facility_id)
              .single();
            if (facilityData) tripData.facility = facilityData;

            // Fetch managed client data
            if (trip.managed_client_id) {
              const { data: clientData } = await supabase
                .from('facility_managed_clients')
                .select('first_name, last_name')
                .eq('id', trip.managed_client_id)
                .single();
              if (clientData) tripData.client = clientData;
            }
          } else if (trip.user_id) {
            // Individual booking from booking_app
            tripData.tripType = 'individual';

            // Fetch user profile
            const { data: profile } = await supabase
              .from('profiles')
              .select('first_name, last_name, email, phone_number')
              .eq('id', trip.user_id)
              .single();
            if (profile) tripData.user_profile = profile;
          }

          return tripData;
        })
      );

      setTrips(tripsWithData);
      filterTrips(tripsWithData, statusFilter);
    } catch (error) {
      console.error('Error fetching trips:', error);
      Alert.alert('Error', 'Failed to load trips');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filterTrips = (tripsToFilter, filter) => {
    let filtered = tripsToFilter || trips;

    if (filter === 'recent') {
      // Show all trips, most recent first (already sorted)
      filtered = filtered;
    } else if (filter === 'pending') {
      filtered = filtered.filter(trip =>
        trip.status === 'pending' || trip.status === 'approved_pending_payment'
      );
    } else if (filter === 'cancelled') {
      filtered = filtered.filter(trip => trip.status === 'cancelled');
    } else if (filter === 'upcoming') {
      filtered = filtered.filter(trip =>
        trip.status === 'upcoming' || trip.status === 'confirmed'
      );
    } else if (filter === 'completed') {
      filtered = filtered.filter(trip => trip.status === 'completed');
    }

    setFilteredTrips(filtered);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchAllTrips();
  };

  const handleFilterChange = (filter) => {
    setStatusFilter(filter);
    filterTrips(trips, filter);
  };

  const getClientName = (trip) => {
    if (trip.tripType === 'facility') {
      if (trip.client) {
        return `${trip.client.first_name} ${trip.client.last_name}`;
      }
      return 'Unknown Client';
    } else {
      if (trip.user_profile) {
        const firstName = trip.user_profile.first_name || '';
        const lastName = trip.user_profile.last_name || '';
        const fullName = `${firstName} ${lastName}`.trim();
        return fullName || 'Client';
      }
      return 'Deleted Account';
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: '#FFA500',
      approved_pending_payment: '#FFD700',
      upcoming: '#4A90E2',
      confirmed: '#00BCD4',
      in_progress: '#2196F3',
      in_process: '#2196F3',
      paid_in_progress: '#2196F3',
      completed: '#4CAF50',
      cancelled: '#F44336',
      payment_failed: '#E91E63',
    };
    return colors[status] || '#999';
  };

  const formatStatus = (status) => {
    const statusMap = {
      pending: 'Pending',
      approved_pending_payment: 'Processing',
      upcoming: 'Upcoming',
      confirmed: 'Confirmed',
      in_progress: 'In Progress',
      in_process: 'In Progress',
      paid_in_progress: 'In Progress',
      completed: 'Completed',
      cancelled: 'Cancelled',
      payment_failed: 'Payment Failed',
    };
    return statusMap[status] || status;
  };

  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={BRAND_COLOR} />
        <Text style={styles.loadingText}>Loading trips...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header showMessaging={true} />

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {[
            { key: 'recent', label: 'Recent Trips' },
            { key: 'pending', label: 'Pending' },
            { key: 'cancelled', label: 'Cancelled' },
            { key: 'upcoming', label: 'Upcoming' },
            { key: 'completed', label: 'Completed' },
          ].map((filter) => (
            <TouchableOpacity
              key={filter.key}
              style={[
                styles.filterTab,
                statusFilter === filter.key && styles.filterTabActive,
              ]}
              onPress={() => handleFilterChange(filter.key)}
            >
              <Text
                style={[
                  styles.filterText,
                  statusFilter === filter.key && styles.filterTextActive,
                ]}
              >
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={BRAND_COLOR}
          />
        }
      >
        <View style={styles.content}>
          {/* Stats Header */}
          <View style={styles.statsHeader}>
            <Text style={styles.statsText}>
              Showing {filteredTrips.length} of {trips.length} trips
            </Text>
          </View>

          {/* Trips List */}
          {filteredTrips.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="car-outline" size={60} color="#ccc" />
              <Text style={styles.emptyStateText}>No trips found</Text>
              {statusFilter !== 'recent' && (
                <Text style={styles.emptyStateSubtext}>
                  Try adjusting your filters
                </Text>
              )}
            </View>
          ) : (
            <View style={styles.tripsList}>
              {filteredTrips.map((trip) => (
                <TouchableOpacity
                  key={trip.id}
                  style={styles.tripCard}
                  onPress={() => navigation.navigate('TripDetails', { tripId: trip.id })}
                >
                  <View style={styles.tripCardHeader}>
                    <View style={styles.tripCardLeft}>
                      <Text style={styles.tripClientName}>{getClientName(trip)}</Text>

                      {/* Trip Type Badge */}
                      <View style={[
                        styles.typeBadge,
                        trip.tripType === 'facility' ? styles.facilityBadge : styles.individualBadge
                      ]}>
                        <Ionicons
                          name={trip.tripType === 'facility' ? 'business' : 'person'}
                          size={12}
                          color={trip.tripType === 'facility' ? '#10B981' : '#4A90E2'}
                        />
                        <Text style={[
                          styles.typeText,
                          trip.tripType === 'facility' ? styles.facilityText : styles.individualText
                        ]}>
                          {trip.tripType === 'facility' ? trip.facility?.name || 'Facility' : 'Individual'}
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(trip.status) }]}>
                      <Text style={styles.statusText}>{formatStatus(trip.status)}</Text>
                    </View>
                  </View>

                  <View style={styles.tripCardBody}>
                    <View style={styles.tripDetailRow}>
                      <Ionicons name="location" size={16} color="#666" />
                      <Text style={styles.tripDetailText} numberOfLines={1}>
                        {trip.pickup_address || trip.pickup_location}
                      </Text>
                    </View>
                    <View style={styles.tripDetailRow}>
                      <Ionicons name="navigate" size={16} color="#666" />
                      <Text style={styles.tripDetailText} numberOfLines={1}>
                        {trip.destination_address || trip.dropoff_location}
                      </Text>
                    </View>
                    <View style={styles.tripDetailRow}>
                      <Ionicons name="calendar-outline" size={16} color="#666" />
                      <Text style={styles.tripDetailText}>
                        {formatDateTime(trip.pickup_time)}
                      </Text>
                    </View>
                    {trip.price && (
                      <View style={styles.tripDetailRow}>
                        <Ionicons name="cash-outline" size={16} color="#666" />
                        <Text style={styles.tripDetailText}>
                          ${parseFloat(trip.price).toFixed(2)}
                        </Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  filterContainer: {
    paddingVertical: 12,
    paddingLeft: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filterTab: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
  },
  filterTabActive: {
    backgroundColor: BRAND_COLOR,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  filterTextActive: {
    color: '#fff',
  },
  statsHeader: {
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  statsText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  tripsList: {
    marginBottom: 20,
  },
  tripCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  tripCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  tripCardLeft: {
    flex: 1,
  },
  tripClientName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 6,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  facilityBadge: {
    backgroundColor: '#D1FAE5',
  },
  individualBadge: {
    backgroundColor: '#E3F2FD',
  },
  typeText: {
    fontSize: 11,
    marginLeft: 4,
    fontWeight: '600',
  },
  facilityText: {
    color: '#10B981',
  },
  individualText: {
    color: '#4A90E2',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '600',
  },
  tripCardBody: {
    gap: 8,
  },
  tripDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tripDetailText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#999',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#bbb',
    marginTop: 8,
  },
});

export default AllTripsScreen;
