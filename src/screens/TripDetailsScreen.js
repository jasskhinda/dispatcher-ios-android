import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import Header from '../components/Header';

const BRAND_COLOR = '#5fbfc0';

const TripDetailsScreen = ({ route, navigation }) => {
  const { tripId } = route.params;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [trip, setTrip] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);

  useEffect(() => {
    fetchTripDetails();
  }, [tripId]);

  const fetchTripDetails = async () => {
    try {
      console.log('🔍 Fetching trip details for:', tripId);

      // Fetch trip with all related data
      const { data: tripData, error: tripError } = await supabase
        .from('trips')
        .select('*')
        .eq('id', tripId)
        .single();

      if (tripError) throw tripError;

      // Fetch client data if this is a facility trip
      let clientData = null;
      if (tripData.managed_client_id) {
        const { data: client } = await supabase
          .from('facility_managed_clients')
          .select('id, first_name, last_name, phone_number')
          .eq('id', tripData.managed_client_id)
          .single();
        clientData = client;
      }

      // Fetch user profile if this is an individual trip
      let userData = null;
      if (tripData.user_id && !tripData.facility_id) {
        const { data: user } = await supabase
          .from('profiles')
          .select('id, full_name, phone_number')
          .eq('id', tripData.user_id)
          .single();
        userData = user;
      }

      // Fetch facility data if applicable
      let facilityData = null;
      if (tripData.facility_id) {
        const { data: facility } = await supabase
          .from('facilities')
          .select('id, name, phone, email')
          .eq('id', tripData.facility_id)
          .single();
        facilityData = facility;
      }

      // Fetch assigned driver if applicable
      let driverData = null;
      if (tripData.assigned_driver_id) {
        const { data: driver } = await supabase
          .from('profiles')
          .select('id, full_name, phone_number')
          .eq('id', tripData.assigned_driver_id)
          .single();
        driverData = driver;
      }

      setTrip({
        ...tripData,
        client: clientData,
        user: userData,
        facility: facilityData,
        driver: driverData,
      });

    } catch (error) {
      console.error('Error fetching trip details:', error);
      Alert.alert('Error', 'Failed to load trip details');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchTripDetails();
  };

  const updateTripStatus = async (newStatus) => {
    Alert.alert(
      'Update Status',
      `Change trip status to "${newStatus}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setUpdating(true);
            try {
              // Update trip status
              const { error } = await supabase
                .from('trips')
                .update({
                  status: newStatus,
                  updated_at: new Date().toISOString()
                })
                .eq('id', tripId);

              if (error) throw error;

              // If completing a trip and there's an assigned driver, update driver status to available
              if (newStatus === 'completed' && trip.assigned_driver_id) {
                const { error: driverUpdateError } = await supabase
                  .from('profiles')
                  .update({
                    status: 'available',
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', trip.assigned_driver_id);

                if (driverUpdateError) {
                  console.warn('Warning: Failed to update driver status:', driverUpdateError);
                  // Don't fail the trip completion if driver update fails
                }
              }

              Alert.alert('Success', `Trip status updated to ${newStatus}`);
              await fetchTripDetails();
            } catch (error) {
              console.error('Error updating trip status:', error);
              Alert.alert('Error', 'Failed to update trip status');
            } finally {
              setUpdating(false);
            }
          },
        },
      ]
    );
  };

  const formatCurrency = (amount) => {
    return `$${parseFloat(amount || 0).toFixed(2)}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return '#FFA500';
      case 'upcoming':
      case 'confirmed':
      case 'assigned':
        return '#4A90E2';
      case 'in_progress':
      case 'in_process':
      case 'paid_in_progress':
        return '#9C27B0';
      case 'completed':
        return '#4CAF50';
      case 'cancelled':
        return '#F44336';
      default:
        return '#999';
    }
  };

  const getClientName = () => {
    if (trip.client) {
      return `${trip.client.first_name} ${trip.client.last_name}`;
    }
    if (trip.user) {
      return trip.user.full_name || 'Individual Client';
    }
    return 'Account Deleted';
  };

  const getClientPhone = () => {
    if (trip.client) {
      return trip.client.phone_number || 'Not Available';
    }
    if (trip.user) {
      return trip.user.phone_number || 'Not Available';
    }
    return 'Not Available';
  };

  const isClientDeleted = () => {
    return !trip.client && !trip.user;
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={BRAND_COLOR} />
        <Text style={styles.loadingText}>Loading trip details...</Text>
      </View>
    );
  }

  if (!trip) {
    return (
      <View style={styles.container}>
        <Header
          title="Trip Details"
          onBack={() => navigation.goBack()}
          showMessaging={false}
        />
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Trip not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header
        title="Trip Details"
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
          {/* Status Badge */}
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(trip.status) }]}>
            <Text style={styles.statusText}>{trip.status?.toUpperCase()}</Text>
          </View>

          {/* Trip ID */}
          <Text style={styles.tripId}>Trip ID: {trip.id.substring(0, 8)}</Text>

          {/* Client Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Client Information</Text>
            {isClientDeleted() && (
              <View style={styles.deletedAccountNotice}>
                <Ionicons name="information-circle" size={20} color="#E65100" />
                <Text style={styles.deletedAccountText}>
                  Client account has been deleted. Trip information is retained for records.
                </Text>
              </View>
            )}
            <View style={styles.infoRow}>
              <Ionicons name="person" size={20} color={BRAND_COLOR} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Name</Text>
                <Text style={[styles.infoValue, isClientDeleted() && styles.deletedText]}>
                  {getClientName()}
                </Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="call" size={20} color={BRAND_COLOR} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Phone</Text>
                <Text style={[styles.infoValue, isClientDeleted() && styles.deletedText]}>
                  {getClientPhone()}
                </Text>
              </View>
            </View>
            {trip.facility && (
              <View style={styles.infoRow}>
                <Ionicons name="business" size={20} color={BRAND_COLOR} />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Facility</Text>
                  <Text style={styles.infoValue}>{trip.facility.name}</Text>
                </View>
              </View>
            )}
          </View>

          {/* Trip Details */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Trip Details</Text>
            <View style={styles.infoRow}>
              <Ionicons name="calendar" size={20} color={BRAND_COLOR} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Pickup Time</Text>
                <Text style={styles.infoValue}>{formatDate(trip.pickup_time)}</Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="location" size={20} color="#F44336" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Pickup Address</Text>
                <Text style={styles.infoValue}>{trip.pickup_address}</Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="navigate" size={20} color="#4CAF50" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Destination</Text>
                <Text style={styles.infoValue}>{trip.destination_address}</Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="sync" size={20} color={BRAND_COLOR} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Trip Type</Text>
                <Text style={styles.infoValue}>{trip.round_trip ? 'Round Trip' : 'One Way'}</Text>
              </View>
            </View>
            {trip.distance && (
              <View style={styles.infoRow}>
                <Ionicons name="speedometer" size={20} color={BRAND_COLOR} />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Distance</Text>
                  <Text style={styles.infoValue}>{trip.distance} miles</Text>
                </View>
              </View>
            )}
          </View>

          {/* Special Requirements */}
          {(trip.wheelchair_accessible || trip.extra_passengers > 0 || trip.special_instructions) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Special Requirements</Text>
              {trip.wheelchair_accessible && (
                <View style={styles.infoRow}>
                  <Ionicons name="accessibility" size={20} color={BRAND_COLOR} />
                  <View style={styles.infoContent}>
                    <Text style={styles.infoValue}>Wheelchair Accessible</Text>
                  </View>
                </View>
              )}
              {trip.extra_passengers > 0 && (
                <View style={styles.infoRow}>
                  <Ionicons name="people" size={20} color={BRAND_COLOR} />
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Extra Passengers</Text>
                    <Text style={styles.infoValue}>{trip.extra_passengers}</Text>
                  </View>
                </View>
              )}
              {trip.special_instructions && (
                <View style={styles.infoRow}>
                  <Ionicons name="document-text" size={20} color={BRAND_COLOR} />
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Special Instructions</Text>
                    <Text style={styles.infoValue}>{trip.special_instructions}</Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Cost Breakdown */}
          <View style={styles.section}>
            <View style={styles.costHeader}>
              <Text style={styles.sectionTitle}>Cost Breakdown</Text>
              {trip.pricing_breakdown_locked_at && (
                <>
                  <Text style={styles.lockedText}>
                    Pricing Locked from Booking
                  </Text>
                  <Text style={styles.lockedDate}>
                    {new Date(trip.pricing_breakdown_locked_at).toLocaleDateString()}
                  </Text>
                </>
              )}
            </View>

            {/* Total Amount - Featured */}
            <View style={styles.priceCard}>
              <Text style={styles.priceLabel}>Total Amount</Text>
              <Text style={styles.priceValue}>{formatCurrency(trip.price)}</Text>
            </View>

            {/* Detailed Breakdown */}
            {trip.pricing_breakdown_data?.pricing && (
              <View style={styles.breakdownSection}>
                <TouchableOpacity
                  style={styles.breakdownToggle}
                  onPress={() => setShowBreakdown(!showBreakdown)}
                >
                  <Ionicons
                    name={showBreakdown ? 'chevron-down' : 'chevron-forward'}
                    size={20}
                    color={BRAND_COLOR}
                  />
                  <Text style={styles.breakdownToggleText}>
                    View detailed breakdown
                  </Text>
                </TouchableOpacity>

                {showBreakdown && (
                  <View style={styles.breakdownDetails}>
                    {/* Base Fare */}
                    {trip.pricing_breakdown_data.pricing.basePrice > 0 && (
                      <View style={styles.breakdownRow}>
                        <Text style={styles.breakdownLabel}>
                          Base fare ({trip.is_round_trip || trip.round_trip ? '2' : '1'} leg @ ${trip.pricing_breakdown_data.pricing.isBariatric ? '150' : '50'}/leg)
                        </Text>
                        <Text style={styles.breakdownValue}>
                          ${(trip.pricing_breakdown_data.pricing.basePrice + (trip.pricing_breakdown_data.pricing.roundTripPrice || 0)).toFixed(2)}
                        </Text>
                      </View>
                    )}

                    {/* Distance Charge */}
                    {trip.pricing_breakdown_data.pricing.distancePrice > 0 && (
                      <View style={styles.breakdownRow}>
                        <Text style={styles.breakdownLabel}>
                          Distance charge (${trip.pricing_breakdown_data.countyInfo?.isInFranklinCounty ? '3' : '4'}/mile)
                        </Text>
                        <Text style={styles.breakdownValue}>
                          ${trip.pricing_breakdown_data.pricing.distancePrice.toFixed(2)}
                        </Text>
                      </View>
                    )}

                    {/* County Surcharge */}
                    {trip.pricing_breakdown_data.pricing.countyPrice > 0 && (
                      <View style={styles.breakdownRow}>
                        <Text style={styles.breakdownLabel}>County surcharge</Text>
                        <Text style={styles.breakdownValue}>
                          ${trip.pricing_breakdown_data.pricing.countyPrice.toFixed(2)}
                        </Text>
                      </View>
                    )}

                    {/* Dead Mileage */}
                    {trip.pricing_breakdown_data.pricing.deadMileagePrice > 0 && (
                      <View style={styles.breakdownRow}>
                        <Text style={styles.breakdownLabel}>Dead mileage</Text>
                        <Text style={styles.breakdownValue}>
                          ${trip.pricing_breakdown_data.pricing.deadMileagePrice.toFixed(2)}
                        </Text>
                      </View>
                    )}

                    {/* Weekend/After-hours */}
                    {trip.pricing_breakdown_data.pricing.weekendAfterHoursSurcharge > 0 && (
                      <View style={styles.breakdownRow}>
                        <Text style={styles.breakdownLabel}>Weekend/After-hours surcharge</Text>
                        <Text style={styles.breakdownValue}>
                          ${trip.pricing_breakdown_data.pricing.weekendAfterHoursSurcharge.toFixed(2)}
                        </Text>
                      </View>
                    )}

                    {/* Emergency Fee */}
                    {trip.pricing_breakdown_data.pricing.emergencyFee > 0 && (
                      <View style={styles.breakdownRow}>
                        <Text style={styles.breakdownLabel}>Emergency fee</Text>
                        <Text style={styles.breakdownValue}>
                          ${trip.pricing_breakdown_data.pricing.emergencyFee.toFixed(2)}
                        </Text>
                      </View>
                    )}

                    {/* Holiday Surcharge */}
                    {trip.pricing_breakdown_data.pricing.holidaySurcharge > 0 && (
                      <View style={styles.breakdownRow}>
                        <Text style={styles.breakdownLabel}>Holiday surcharge</Text>
                        <Text style={styles.breakdownValue}>
                          ${trip.pricing_breakdown_data.pricing.holidaySurcharge.toFixed(2)}
                        </Text>
                      </View>
                    )}

                    {/* Wheelchair */}
                    {trip.pricing_breakdown_data.pricing.wheelchairPrice > 0 && (
                      <View style={styles.breakdownRow}>
                        <Text style={styles.breakdownLabel}>Wheelchair rental</Text>
                        <Text style={styles.breakdownValue}>
                          ${trip.pricing_breakdown_data.pricing.wheelchairPrice.toFixed(2)}
                        </Text>
                      </View>
                    )}

                    {/* Total Line */}
                    <View style={[styles.breakdownRow, styles.breakdownTotal]}>
                      <Text style={styles.breakdownTotalLabel}>Total</Text>
                      <Text style={styles.breakdownTotalValue}>
                        ${trip.pricing_breakdown_data.pricing.total.toFixed(2)}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            )}

            {trip.status === 'completed' && (
              <View style={styles.paymentStatusBox}>
                <Ionicons name="time" size={18} color="#FFA500" />
                <Text style={styles.paymentStatusText}>Payment Status: Awaiting Payment</Text>
              </View>
            )}
          </View>

          {/* Driver Information */}
          {trip.driver && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Assigned Driver</Text>
              <View style={styles.infoRow}>
                <Ionicons name="car" size={20} color={BRAND_COLOR} />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Driver Name</Text>
                  <Text style={styles.infoValue}>{trip.driver.full_name}</Text>
                </View>
              </View>
              {trip.driver.phone_number && (
                <View style={styles.infoRow}>
                  <Ionicons name="call" size={20} color={BRAND_COLOR} />
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Driver Phone</Text>
                    <Text style={styles.infoValue}>{trip.driver.phone_number}</Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Action Buttons */}
          {trip.status !== 'completed' && trip.status !== 'cancelled' && (
            <View style={styles.actionsSection}>
              <Text style={styles.sectionTitle}>Trip Actions</Text>

              {/* Edit Trip Button - Available for all non-completed trips */}
              <TouchableOpacity
                style={[styles.actionButton, styles.editButton]}
                onPress={() => navigation.navigate('EditTrip', { tripId: trip.id })}
                disabled={updating}
              >
                <Ionicons name="create" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Edit Trip Details</Text>
              </TouchableOpacity>

              {trip.status === 'pending' && (
              <>
                <TouchableOpacity
                  style={[styles.actionButton, styles.approveButton]}
                  onPress={() => updateTripStatus('upcoming')}
                  disabled={updating}
                >
                  {updating ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={20} color="#fff" />
                      <Text style={styles.actionButtonText}>Approve Trip</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.rejectButton]}
                  onPress={() => updateTripStatus('cancelled')}
                  disabled={updating}
                >
                  <Ionicons name="close-circle" size={20} color="#fff" />
                  <Text style={styles.actionButtonText}>Reject Trip</Text>
                </TouchableOpacity>
              </>
            )}

            {trip.status === 'upcoming' && (
              <>
                <TouchableOpacity
                  style={[styles.actionButton, styles.assignButton]}
                  onPress={() => Alert.alert(
                    'Assign Driver (Recommended)',
                    'Assigning a driver is optional but recommended to track the driver\'s live location and provide real-time updates to clients.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Assign Driver', onPress: () => Alert.alert('Coming Soon', 'Driver assignment feature will be available soon') }
                    ]
                  )}
                  disabled={updating}
                >
                  <Ionicons name="person-add" size={20} color="#fff" />
                  <Text style={styles.actionButtonText}>Assign Driver (Recommended)</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.completeButton]}
                  onPress={() => updateTripStatus('completed')}
                  disabled={updating}
                >
                  {updating ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-done-circle" size={20} color="#fff" />
                      <Text style={styles.actionButtonText}>Complete Trip</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}

            {trip.status === 'assigned' && (
              <TouchableOpacity
                style={[styles.actionButton, styles.startButton]}
                onPress={() => updateTripStatus('in_progress')}
                disabled={updating}
              >
                <Ionicons name="play-circle" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Start Trip</Text>
              </TouchableOpacity>
            )}

            {trip.status === 'in_progress' && (
              <TouchableOpacity
                style={[styles.actionButton, styles.completeButton]}
                onPress={() => updateTripStatus('completed')}
                disabled={updating}
              >
                <Ionicons name="checkmark-done-circle" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Complete Trip</Text>
              </TouchableOpacity>
            )}

              {trip.status !== 'completed' && trip.status !== 'cancelled' && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.cancelButton]}
                  onPress={() => updateTripStatus('cancelled')}
                  disabled={updating}
                >
                  <Ionicons name="close-circle" size={20} color="#fff" />
                  <Text style={styles.actionButtonText}>Cancel Trip</Text>
                </TouchableOpacity>
              )}
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
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    fontSize: 16,
    color: '#999',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 12,
  },
  statusText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  tripId: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  infoContent: {
    marginLeft: 12,
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 15,
    color: '#1a1a1a',
    lineHeight: 22,
  },
  deletedAccountNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#E65100',
  },
  deletedAccountText: {
    fontSize: 13,
    color: '#E65100',
    marginLeft: 10,
    flex: 1,
    lineHeight: 18,
  },
  deletedText: {
    color: '#999',
    fontStyle: 'italic',
  },
  costHeader: {
    marginBottom: 12,
  },
  lockedText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  lockedDate: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  priceCard: {
    backgroundColor: BRAND_COLOR,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  priceLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 8,
  },
  priceValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  breakdownSection: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 16,
  },
  breakdownToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  breakdownToggleText: {
    fontSize: 15,
    color: BRAND_COLOR,
    fontWeight: '600',
    marginLeft: 8,
  },
  breakdownDetails: {
    marginTop: 12,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  breakdownLabel: {
    fontSize: 14,
    color: '#666',
    flex: 1,
    marginRight: 12,
  },
  breakdownValue: {
    fontSize: 14,
    color: '#1a1a1a',
    fontWeight: '600',
  },
  breakdownTotal: {
    borderTopWidth: 2,
    borderTopColor: BRAND_COLOR,
    borderBottomWidth: 0,
    marginTop: 8,
    paddingTop: 12,
  },
  breakdownTotalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  breakdownTotalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: BRAND_COLOR,
  },
  paymentStatusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  paymentStatusText: {
    fontSize: 14,
    color: '#E65100',
    fontWeight: '600',
    marginLeft: 8,
  },
  actionsSection: {
    marginBottom: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 12,
    gap: 8,
  },
  editButton: {
    backgroundColor: '#FF9800',
  },
  approveButton: {
    backgroundColor: '#4CAF50',
  },
  rejectButton: {
    backgroundColor: '#F44336',
  },
  assignButton: {
    backgroundColor: '#9C27B0',
  },
  startButton: {
    backgroundColor: '#4A90E2',
  },
  completeButton: {
    backgroundColor: '#4CAF50',
  },
  cancelButton: {
    backgroundColor: '#F44336',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default TripDetailsScreen;
