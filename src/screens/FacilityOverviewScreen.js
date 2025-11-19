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

const FacilityOverviewScreen = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [facilities, setFacilities] = useState([]);
  const [overallStats, setOverallStats] = useState({
    totalFacilities: 0,
    totalTrips: 0,
    pendingTrips: 0,
    upcomingTrips: 0,
    completedTrips: 0,
    totalAmount: 0,
  });

  useFocusEffect(
    React.useCallback(() => {
      fetchFacilityOverview();
    }, [])
  );

  const fetchFacilityOverview = async () => {
    try {
      console.log('🔍 Fetching facility overview...');

      // Fetch all facility trips
      const { data: tripsData, error: tripsError } = await supabase
        .from('trips')
        .select('*')
        .not('facility_id', 'is', null)
        .order('created_at', { ascending: false });

      if (tripsError) throw tripsError;

      console.log(`✅ Found ${tripsData?.length || 0} facility trips`);

      // Group trips by facility
      const facilityTripsMap = {};
      (tripsData || []).forEach((trip) => {
        if (!facilityTripsMap[trip.facility_id]) {
          facilityTripsMap[trip.facility_id] = [];
        }
        facilityTripsMap[trip.facility_id].push(trip);
      });

      // Fetch facility details and build stats
      const facilityStatsPromises = Object.entries(facilityTripsMap).map(
        async ([facilityId, facilityTrips]) => {
          // Fetch facility details
          const { data: facility } = await supabase
            .from('facilities')
            .select('id, name, address, contact_email, phone_number')
            .eq('id', facilityId)
            .single();

          // Get unique clients
          const uniqueClientIds = [
            ...new Set(
              facilityTrips
                .map((trip) => trip.managed_client_id || trip.user_id)
                .filter(Boolean)
            ),
          ];

          // Calculate stats
          const totalTrips = facilityTrips.length;
          const pendingTrips = facilityTrips.filter(
            (t) => t.status === 'pending'
          ).length;
          const upcomingTrips = facilityTrips.filter(
            (t) => t.status === 'upcoming' || t.status === 'confirmed'
          ).length;
          const completedTrips = facilityTrips.filter(
            (t) => t.status === 'completed'
          ).length;
          const cancelledTrips = facilityTrips.filter(
            (t) => t.status === 'cancelled'
          ).length;

          // Calculate billable amount (only completed trips with price)
          const billableTrips = facilityTrips.filter(
            (trip) => trip.status === 'completed' && trip.price && parseFloat(trip.price) > 0
          );
          const totalAmount = billableTrips.reduce(
            (sum, trip) => sum + parseFloat(trip.price || 0),
            0
          );

          return {
            id: facilityId,
            name: facility?.name || `Facility ${facilityId.substring(0, 8)}`,
            address: facility?.address || '',
            contact_email: facility?.contact_email || '',
            phone_number: facility?.phone_number || '',
            clientCount: uniqueClientIds.length,
            totalTrips,
            pendingTrips,
            upcomingTrips,
            completedTrips,
            cancelledTrips,
            totalAmount,
          };
        }
      );

      const facilityStats = await Promise.all(facilityStatsPromises);

      // Calculate overall stats
      const overall = {
        totalFacilities: facilityStats.length,
        totalTrips: facilityStats.reduce((sum, f) => sum + f.totalTrips, 0),
        pendingTrips: facilityStats.reduce((sum, f) => sum + f.pendingTrips, 0),
        upcomingTrips: facilityStats.reduce((sum, f) => sum + f.upcomingTrips, 0),
        completedTrips: facilityStats.reduce((sum, f) => sum + f.completedTrips, 0),
        totalAmount: facilityStats.reduce((sum, f) => sum + f.totalAmount, 0),
      };

      setFacilities(facilityStats);
      setOverallStats(overall);
    } catch (error) {
      console.error('Error fetching facility overview:', error);
      Alert.alert('Error', 'Failed to load facility overview');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchFacilityOverview();
  };

  const formatCurrency = (amount) => {
    return `$${parseFloat(amount).toFixed(2)}`;
  };

  const handleManageFacility = (facility) => {
    // Navigate to monthly invoice with current month
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    navigation.navigate('FacilityMonthlyInvoice', {
      facilityId: facility.id,
      facilityName: facility.name,
      year,
      month,
    });
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={BRAND_COLOR} />
        <Text style={styles.loadingText}>Loading facilities...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header
        title="Facility Overview"
        onBack={() => navigation.goBack()}
        showMessaging={false}
      />

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
          {/* Overall Stats */}
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, { backgroundColor: '#5fbfc0' }]}>
              <Text style={styles.statNumber}>{overallStats.totalFacilities}</Text>
              <Text style={styles.statLabel}>Facilities</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: '#9C27B0' }]}>
              <Text style={styles.statNumber}>{overallStats.totalTrips}</Text>
              <Text style={styles.statLabel}>Total Trips</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: '#FFA500' }]}>
              <Text style={styles.statNumber}>{overallStats.pendingTrips}</Text>
              <Text style={styles.statLabel}>Pending</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: '#4A90E2' }]}>
              <Text style={styles.statNumber}>{overallStats.upcomingTrips}</Text>
              <Text style={styles.statLabel}>Upcoming</Text>
            </View>
          </View>

          {/* Total Revenue Card */}
          <View style={styles.revenueCard}>
            <View style={styles.revenueContent}>
              <Text style={styles.revenueLabel}>Total Revenue</Text>
              <Text style={styles.revenueAmount}>
                {formatCurrency(overallStats.totalAmount)}
              </Text>
              <Text style={styles.revenueSubtext}>
                From {overallStats.completedTrips} completed trips
              </Text>
            </View>
            <Ionicons name="cash" size={48} color="rgba(255,255,255,0.3)" />
          </View>

          {/* Facilities List */}
          <Text style={styles.sectionTitle}>Facilities</Text>
          {facilities.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="business-outline" size={60} color="#ccc" />
              <Text style={styles.emptyStateText}>No facilities found</Text>
            </View>
          ) : (
            facilities.map((facility) => (
              <View key={facility.id} style={styles.facilityCard}>
                <View style={styles.facilityHeader}>
                  <View style={styles.facilityTitleRow}>
                    <Ionicons name="business" size={20} color={BRAND_COLOR} />
                    <Text style={styles.facilityName}>{facility.name}</Text>
                  </View>
                  {facility.address && (
                    <Text style={styles.facilityAddress} numberOfLines={1}>
                      {facility.address}
                    </Text>
                  )}
                  {facility.contact_email && (
                    <View style={styles.contactRow}>
                      <Ionicons name="mail" size={14} color="#666" />
                      <Text style={styles.contactText} numberOfLines={1}>
                        {facility.contact_email}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.facilityStats}>
                  <View style={styles.statItem}>
                    <Text style={styles.statItemNumber}>{facility.clientCount}</Text>
                    <Text style={styles.statItemLabel}>Clients</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statItemNumber}>{facility.totalTrips}</Text>
                    <Text style={styles.statItemLabel}>Trips</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statItemNumber}>{facility.pendingTrips}</Text>
                    <Text style={styles.statItemLabel}>Pending</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statItemNumber}>{facility.completedTrips}</Text>
                    <Text style={styles.statItemLabel}>Completed</Text>
                  </View>
                </View>

                <View style={styles.facilityFooter}>
                  <View style={styles.amountContainer}>
                    <Text style={styles.amountLabel}>Revenue</Text>
                    <Text style={styles.amountValue}>
                      {formatCurrency(facility.totalAmount)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.manageButton}
                    onPress={() => handleManageFacility(facility)}
                  >
                    <Text style={styles.manageButtonText}>Manage Billing</Text>
                    <Ionicons name="chevron-forward" size={18} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
            ))
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
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
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
    marginTop: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#fff',
    marginTop: 4,
    fontWeight: '600',
  },
  revenueCard: {
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  revenueContent: {
    flex: 1,
  },
  revenueLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
    marginBottom: 8,
  },
  revenueAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  revenueSubtext: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  facilityCard: {
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
  facilityHeader: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  facilityTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  facilityName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginLeft: 8,
    flex: 1,
  },
  facilityAddress: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  contactText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 6,
    flex: 1,
  },
  facilityStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
    paddingVertical: 8,
  },
  statItem: {
    alignItems: 'center',
  },
  statItemNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: BRAND_COLOR,
  },
  statItemLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  facilityFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  amountContainer: {
    flex: 1,
  },
  amountLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  amountValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  manageButton: {
    backgroundColor: BRAND_COLOR,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  manageButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 4,
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
});

export default FacilityOverviewScreen;
