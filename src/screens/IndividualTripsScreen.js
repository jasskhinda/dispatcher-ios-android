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

const IndividualTripsScreen = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [trips, setTrips] = useState([]);
  const [filteredTrips, setFilteredTrips] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');

  // Fetch trips on screen focus
  useFocusEffect(
    React.useCallback(() => {
      fetchIndividualTrips();
    }, [])
  );

  const fetchIndividualTrips = async () => {
    try {
      console.log('🔍 Fetching individual trips...');

      // Fetch trips from individual bookings (has user_id but NO facility_id)
      const { data: rawTripsData, error: tripsError } = await supabase
        .from('trips')
        .select('*')
        .is('facility_id', null)
        .not('user_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(100);

      if (tripsError) throw tripsError;

      console.log(`✅ Found ${rawTripsData?.length || 0} individual trips`);

      // Additional safety filter
      const tripsData = rawTripsData?.filter(trip => !trip.facility_id && trip.user_id) || [];

      // Fetch user profiles for the trips
      const tripsWithData = await Promise.all(
        tripsData.map(async (trip) => {
          const tripData = { ...trip };

          // Fetch user profile
          if (trip.user_id) {
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
      console.error('Error fetching individual trips:', error);
      Alert.alert('Error', 'Failed to load individual trips');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filterTrips = (tripsToFilter, filter) => {
    let filtered = tripsToFilter || trips;

    if (filter !== 'all') {
      filtered = filtered.filter(trip => trip.status === filter);
    }

    setFilteredTrips(filtered);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchIndividualTrips();
  };

  const handleFilterChange = (filter) => {
    setStatusFilter(filter);
    filterTrips(trips, filter);
  };

  const getClientName = (trip) => {
    if (trip.user_profile) {
      const firstName = trip.user_profile.first_name || '';
      const lastName = trip.user_profile.last_name || '';
      const fullName = `${firstName} ${lastName}`.trim();
      return fullName || 'Client';
    }
    return 'Deleted Account';
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
        <Text style={styles.loadingText}>Loading individual trips...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header showMessaging={true} />

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {['all', 'pending', 'upcoming', 'in_progress', 'completed', 'cancelled'].map((filter) => (
            <TouchableOpacity
              key={filter}
              style={[
                styles.filterTab,
                statusFilter === filter && styles.filterTabActive,
              ]}
              onPress={() => handleFilterChange(filter)}
            >
              <Text
                style={[
                  styles.filterText,
                  statusFilter === filter && styles.filterTextActive,
                ]}
              >
                {filter === 'all' ? 'All' : filter === 'in_progress' ? 'In Progress' : filter.charAt(0).toUpperCase() + filter.slice(1)}
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
              <Ionicons name="person-outline" size={60} color="#ccc" />
              <Text style={styles.emptyStateText}>No individual trips found</Text>
              {statusFilter !== 'all' && (
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
                      <View style={styles.clientNameRow}>
                        <Text style={styles.tripClientName}>{getClientName(trip)}</Text>
                        {!trip.user_profile && (
                          <View style={styles.deletedAccountBadge}>
                            <Ionicons name="person-remove" size={10} color="#999" />
                          </View>
                        )}
                      </View>
                      {trip.user_profile ? (
                        <View style={styles.contactInfo}>
                          {trip.user_profile.email && (
                            <Text style={styles.contactText} numberOfLines={1}>
                              {trip.user_profile.email}
                            </Text>
                          )}
                          {trip.user_profile.phone_number && (
                            <Text style={styles.contactText}>
                              {trip.user_profile.phone_number}
                            </Text>
                          )}
                        </View>
                      ) : (
                        <Text style={styles.deletedAccountText}>
                          Account no longer active
                        </Text>
                      )}
                      <View style={styles.individualBadge}>
                        <Ionicons name="person" size={12} color="#4A90E2" />
                        <Text style={styles.individualText}>Individual</Text>
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
  filterContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
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
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  statsHeader: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
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
  clientNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tripClientName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  deletedAccountBadge: {
    backgroundColor: '#F5F5F5',
    padding: 4,
    borderRadius: 12,
    marginBottom: 4,
  },
  deletedAccountText: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 2,
    marginBottom: 4,
  },
  contactInfo: {
    marginTop: 4,
    marginBottom: 4,
  },
  contactText: {
    fontSize: 12,
    color: '#666',
  },
  individualBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  individualText: {
    fontSize: 11,
    color: '#4A90E2',
    marginLeft: 4,
    fontWeight: '600',
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
    fontSize: 16,
    color: '#999',
    marginTop: 12,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#ccc',
    marginTop: 8,
  },
});

export default IndividualTripsScreen;
