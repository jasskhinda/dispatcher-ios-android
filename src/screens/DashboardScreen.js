import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useNavigation } from '@react-navigation/native';
import Header from '../components/Header';

const BRAND_COLOR = '#5fbfc0';

const DashboardScreen = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalTrips: 0,
    facilityTrips: 0,
    individualTrips: 0,
    pendingTrips: 0,
    upcomingTrips: 0,
    inProgressTrips: 0,
    completedTrips: 0,
  });
  const [recentTrips, setRecentTrips] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch all trips (no limit for accurate stats)
      const { data: trips, error: tripsError } = await supabase
        .from('trips')
        .select('*')
        .order('created_at', { ascending: false });

      if (tripsError) throw tripsError;

      // Fetch related data for each trip
      const tripsWithData = await Promise.all(
        trips.map(async (trip) => {
          const tripData = { ...trip };

          // Fetch individual client profile if user_id exists
          if (trip.user_id) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('first_name, last_name, email')
              .eq('id', trip.user_id)
              .single();
            if (profile) tripData.profiles = profile;
          }

          // Fetch facility if facility_id exists
          if (trip.facility_id) {
            const { data: facility } = await supabase
              .from('facilities')
              .select('name')
              .eq('id', trip.facility_id)
              .single();
            if (facility) tripData.facilities = facility;
          }

          // Fetch managed client if managed_client_id exists
          if (trip.managed_client_id) {
            const { data: managedClient } = await supabase
              .from('facility_managed_clients')
              .select('first_name, last_name')
              .eq('id', trip.managed_client_id)
              .single();
            if (managedClient) tripData.facility_managed_clients = managedClient;
          }

          return tripData;
        })
      );

      // Calculate stats
      const facilityTrips = tripsWithData.filter(t => t.facility_id);
      const individualTrips = tripsWithData.filter(t => !t.facility_id && t.user_id);

      const tripStats = {
        totalTrips: tripsWithData.length,
        facilityTrips: facilityTrips.length,
        individualTrips: individualTrips.length,
        pendingTrips: tripsWithData.filter(t => t.status === 'pending').length,
        upcomingTrips: tripsWithData.filter(t =>
          t.status === 'upcoming' ||
          t.status === 'approved_pending_payment' ||
          t.status === 'confirmed'
        ).length,
        inProgressTrips: tripsWithData.filter(t =>
          t.status === 'in_progress' ||
          t.status === 'in_process' ||
          t.status === 'paid_in_progress'
        ).length,
        completedTrips: tripsWithData.filter(t => t.status === 'completed').length,
      };

      setStats(tripStats);
      setRecentTrips(tripsWithData.slice(0, 5));
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  const getClientName = (trip) => {
    if (trip.facility_managed_clients) {
      return `${trip.facility_managed_clients.first_name} ${trip.facility_managed_clients.last_name}`;
    }
    if (trip.profiles) {
      return `${trip.profiles.first_name} ${trip.profiles.last_name}`;
    }
    return 'Account Deleted';
  };

  const isClientDeleted = (trip) => {
    return !trip.facility_managed_clients && !trip.profiles;
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
      approved_pending_payment: 'Approved',
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
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header showMessaging={true} />

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
          {/* Quick Stats */}
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, { backgroundColor: BRAND_COLOR }]}>
              <Ionicons name="car" size={28} color="#fff" />
              <Text style={styles.statNumber}>{stats.totalTrips}</Text>
              <Text style={styles.statLabel}>Total Trips</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: '#FFA500' }]}>
              <Ionicons name="time" size={28} color="#fff" />
              <Text style={styles.statNumber}>{stats.pendingTrips}</Text>
              <Text style={styles.statLabel}>Pending</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: '#4A90E2' }]}>
              <Ionicons name="calendar" size={28} color="#fff" />
              <Text style={styles.statNumber}>{stats.upcomingTrips}</Text>
              <Text style={styles.statLabel}>Upcoming</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: '#2196F3' }]}>
              <Ionicons name="navigate" size={28} color="#fff" />
              <Text style={styles.statNumber}>{stats.inProgressTrips}</Text>
              <Text style={styles.statLabel}>In Progress</Text>
            </View>
          </View>

          {/* Trip Source Breakdown */}
          <Text style={styles.sectionTitle}>Booking Sources</Text>
          <View style={styles.sourceCards}>
            <TouchableOpacity
              style={[styles.sourceCard, { backgroundColor: '#9C27B0' }]}
              onPress={() => navigation.navigate('FacilityOverview')}
            >
              <View style={styles.sourceCardContent}>
                <Ionicons name="business" size={32} color="#fff" />
                <View style={styles.sourceCardText}>
                  <Text style={styles.sourceNumber}>{stats.facilityTrips}</Text>
                  <Text style={styles.sourceLabel}>Facility Bookings</Text>
                  <Text style={styles.sourceSubLabel}>Manage billing & invoices</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.sourceCard, { backgroundColor: '#00BCD4' }]}
              onPress={() => navigation.navigate('IndividualTrips')}
            >
              <View style={styles.sourceCardContent}>
                <Ionicons name="person" size={32} color="#fff" />
                <View style={styles.sourceCardText}>
                  <Text style={styles.sourceNumber}>{stats.individualTrips}</Text>
                  <Text style={styles.sourceLabel}>Individual Bookings</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Recent Trips */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Trips</Text>
            <TouchableOpacity onPress={() => navigation.navigate('AllTrips')}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>

          {recentTrips.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="car-outline" size={60} color="#ccc" />
              <Text style={styles.emptyStateText}>No trips yet</Text>
            </View>
          ) : (
            <View style={styles.tripsList}>
              {recentTrips.map((trip) => (
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
                      {trip.facilities && (
                        <View style={styles.facilityBadge}>
                          <Ionicons name="business" size={12} color="#666" />
                          <Text style={styles.facilityName}>{trip.facilities.name}</Text>
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
                        {trip.pickup_address}
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
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statCard: {
    width: '48%',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#fff',
    marginTop: 4,
    fontWeight: '600',
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 12,
    marginTop: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 8,
  },
  viewAllText: {
    fontSize: 14,
    color: BRAND_COLOR,
    fontWeight: '600',
  },
  sourceCards: {
    marginBottom: 20,
  },
  sourceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sourceCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sourceCardText: {
    marginLeft: 16,
  },
  sourceNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  sourceLabel: {
    fontSize: 14,
    color: '#fff',
    marginTop: 2,
    fontWeight: '600',
  },
  sourceSubLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
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
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
  },
});

export default DashboardScreen;
