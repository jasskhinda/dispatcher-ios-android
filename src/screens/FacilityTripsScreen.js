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

const FacilityTripsScreen = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [trips, setTrips] = useState([]);
  const [filteredTrips, setFilteredTrips] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');

  // Fetch trips on screen focus
  useFocusEffect(
    React.useCallback(() => {
      fetchFacilityTrips();
    }, [])
  );

  const fetchFacilityTrips = async () => {
    try {
      console.log('🔍 Fetching facility trips...');

      // Fetch trips from facilities (has facility_id)
      const { data: rawTripsData, error: tripsError } = await supabase
        .from('trips')
        .select('*')
        .not('facility_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(100);

      if (tripsError) throw tripsError;

      console.log(`✅ Found ${rawTripsData?.length || 0} facility trips`);

      // Fetch related data for each trip
      const tripsWithData = await Promise.all(
        (rawTripsData || []).map(async (trip) => {
          const tripData = { ...trip };

          // Fetch facility
          if (trip.facility_id) {
            const { data: facility } = await supabase
              .from('facilities')
              .select('name, address, contact_email')
              .eq('id', trip.facility_id)
              .single();
            if (facility) tripData.facility = facility;
          }

          // Fetch managed client
          if (trip.managed_client_id) {
            const { data: managedClient } = await supabase
              .from('facility_managed_clients')
              .select('first_name, last_name, date_of_birth')
              .eq('id', trip.managed_client_id)
              .single();
            if (managedClient) tripData.managed_client = managedClient;
          }

          return tripData;
        })
      );

      setTrips(tripsWithData);
      filterTrips(tripsWithData, statusFilter);
    } catch (error) {
      console.error('Error fetching facility trips:', error);
      Alert.alert('Error', 'Failed to load facility trips');
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
    fetchFacilityTrips();
  };

  const handleFilterChange = (filter) => {
    setStatusFilter(filter);
    filterTrips(trips, filter);
  };

  const getClientName = (trip) => {
    if (trip.managed_client) {
      return `${trip.managed_client.first_name} ${trip.managed_client.last_name}`;
    }
    return 'Account Deleted';
  };

  const isClientDeleted = (trip) => {
    return !trip.managed_client;
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
        <Text style={styles.loadingText}>Loading facility trips...</Text>
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
              <Ionicons name="business-outline" size={60} color="#ccc" />
              <Text style={styles.emptyStateText}>No facility trips found</Text>
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
                      <Text style={[styles.tripClientName, isClientDeleted(trip) && styles.deletedText]}>
                        {getClientName(trip)}
                      </Text>
                      {trip.facility && (
                        <View style={styles.facilityBadge}>
                          <Ionicons name="business" size={12} color="#666" />
                          <Text style={styles.facilityName}>{trip.facility.name}</Text>
                        </View>
                      )}
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
  tripClientName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  deletedText: {
    color: '#999',
    fontStyle: 'italic',
  },
  facilityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  facilityName: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
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

export default FacilityTripsScreen;
