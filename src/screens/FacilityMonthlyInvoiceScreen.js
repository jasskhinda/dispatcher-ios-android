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
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useNavigation, useRoute } from '@react-navigation/native';
import Header from '../components/Header';

const BRAND_COLOR = '#5fbfc0';

const FacilityMonthlyInvoiceScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { facilityId, facilityName, year: initialYear, month: initialMonth } = route.params;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [invoiceData, setInvoiceData] = useState(null);
  const [activeTab, setActiveTab] = useState('due'); // 'due' or 'other'
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [verificationType, setVerificationType] = useState(null); // 'received' or 'has_issues'
  const [verificationNotes, setVerificationNotes] = useState('');
  const [processingAction, setProcessingAction] = useState(false);
  const [expandedTripId, setExpandedTripId] = useState(null);

  // Month selection state
  const [selectedYear, setSelectedYear] = useState(initialYear);
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  useEffect(() => {
    fetchInvoiceData();
  }, [facilityId, selectedYear, selectedMonth]);

  const fetchInvoiceData = async () => {
    try {
      console.log('🔍 Fetching invoice data for:', { facilityId, year: selectedYear, month: selectedMonth });

      // Fetch all trips for this facility in the specified month
      const startDate = new Date(selectedYear, selectedMonth - 1, 1);
      const endDate = new Date(selectedYear, selectedMonth, 0, 23, 59, 59);

      const { data: trips, error: tripsError } = await supabase
        .from('trips')
        .select('*')
        .eq('facility_id', facilityId)
        .gte('pickup_time', startDate.toISOString())
        .lte('pickup_time', endDate.toISOString())
        .order('pickup_time', { ascending: false });

      if (tripsError) throw tripsError;

      // Fetch facility details
      const { data: facility, error: facilityError } = await supabase
        .from('facilities')
        .select('*')
        .eq('id', facilityId)
        .single();

      if (facilityError) throw facilityError;

      // Fetch facility invoice for this month
      const invoiceMonth = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
      const { data: invoice, error: invoiceError } = await supabase
        .from('facility_invoices')
        .select('*, facility_invoice_payments(*)')
        .eq('facility_id', facilityId)
        .eq('month', invoiceMonth)
        .single();

      // Invoice might not exist yet - that's okay
      if (invoiceError && invoiceError.code !== 'PGRST116') {
        console.warn('Error fetching invoice:', invoiceError);
      }

      // Fetch client details for trips with managed_client_id
      const clientIds = [...new Set(trips.map(t => t.managed_client_id).filter(Boolean))];
      let clientsMap = {};

      if (clientIds.length > 0) {
        const { data: clients } = await supabase
          .from('facility_managed_clients')
          .select('id, first_name, last_name')
          .in('id', clientIds);

        if (clients) {
          clientsMap = clients.reduce((acc, client) => {
            acc[client.id] = client;
            return acc;
          }, {});
        }
      }

      // Attach client data to trips
      const tripsWithClients = trips.map(trip => ({
        ...trip,
        facility_managed_clients: trip.managed_client_id ? clientsMap[trip.managed_client_id] : null,
      }));

      // Categorize trips - completed trips with price are "due" (billable)
      const dueTrips = tripsWithClients.filter(t =>
        t.status === 'completed' && t.price && parseFloat(t.price) > 0
      );

      // Other trips include pending, upcoming, confirmed
      const otherTrips = tripsWithClients.filter(t =>
        t.status === 'pending' || t.status === 'upcoming' || t.status === 'confirmed'
      );

      const cancelledTrips = tripsWithClients.filter(t => t.status === 'cancelled');

      // Calculate amounts
      const totalRevenue = dueTrips.reduce((sum, trip) => sum + parseFloat(trip.price || 0), 0);
      const amountDue = totalRevenue; // Same as total revenue for completed trips
      const otherAmount = otherTrips.reduce((sum, trip) => sum + parseFloat(trip.price || 0), 0);

      setInvoiceData({
        facility,
        invoice: invoice || null,
        trips: tripsWithClients,
        dueTrips,
        otherTrips,
        cancelledTrips,
        totalRevenue,
        amountDue,
        otherAmount,
        totalTrips: tripsWithClients.length,
      });
    } catch (error) {
      console.error('Error fetching invoice data:', error);
      Alert.alert('Error', 'Failed to load invoice data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchInvoiceData();
  };

  const formatCurrency = (amount) => {
    return `$${parseFloat(amount).toFixed(2)}`;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getMonthName = (yearNum, monthNum) => {
    const date = new Date(yearNum, monthNum - 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  // Month navigation helpers
  const generateMonthOptions = () => {
    const options = [];
    const currentDate = new Date();

    // Generate last 12 months
    for (let i = 0; i < 12; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const displayName = date.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric'
      });
      options.push({ year, month, displayName, value: `${year}-${month}` });
    }
    return options;
  };

  const handlePreviousMonth = () => {
    const prevDate = new Date(selectedYear, selectedMonth - 2, 1);
    setSelectedYear(prevDate.getFullYear());
    setSelectedMonth(prevDate.getMonth() + 1);
  };

  const handleNextMonth = () => {
    const nextDate = new Date(selectedYear, selectedMonth, 1);
    setSelectedYear(nextDate.getFullYear());
    setSelectedMonth(nextDate.getMonth() + 1);
  };

  const handleMonthSelect = (value) => {
    const [year, month] = value.split('-').map(Number);
    setSelectedYear(year);
    setSelectedMonth(month);
    setShowMonthPicker(false);
  };

  const getPaymentStatus = () => {
    if (!invoiceData?.invoice) return null;
    return invoiceData.invoice.payment_status;
  };

  const getPaymentStatusColor = (status) => {
    if (!status) return '#999';
    if (status === 'UNPAID') return '#F44336'; // Red for unpaid
    if (status.includes('VERIFIED') || status.includes('PAID WITH CHECK - VERIFIED')) return '#4CAF50';
    if (status.includes('BEING VERIFIED') || status.includes('CHECK PAYMENT')) return '#FFA500';
    if (status.includes('ISSUES') || status.includes('ATTENTION')) return '#F44336';
    if (status.includes('PAID')) return '#4CAF50';
    return '#999';
  };

  const canVerifyPayment = () => {
    const status = getPaymentStatus();
    return status && (
      status.includes('CHECK PAYMENT') ||
      status.includes('BEING VERIFIED') ||
      status === 'PAID WITH CHECK (BEING VERIFIED)'
    );
  };

  const handleVerificationAction = (type) => {
    setVerificationType(type);
    setVerificationNotes('');
    setShowVerificationModal(true);
  };

  const confirmVerification = async () => {
    if (!invoiceData?.invoice) {
      Alert.alert('Error', 'No invoice found to verify');
      return;
    }

    try {
      setProcessingAction(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'Authentication required');
        return;
      }

      let newStatus, message;

      if (verificationType === 'received') {
        newStatus = 'PAID WITH CHECK - VERIFIED';
        message = 'Check received and deposited - payment verified';
      } else if (verificationType === 'has_issues') {
        newStatus = 'CHECK PAYMENT - HAS ISSUES';
        message = 'Payment marked as having issues - facility will be notified';
      }

      const paymentNote = `${message}. Verified by dispatcher on ${new Date().toLocaleDateString()}. ${verificationNotes ? `Notes: ${verificationNotes}` : ''}`;

      // Update invoice
      const { error: updateError } = await supabase
        .from('facility_invoices')
        .update({
          payment_status: newStatus,
          payment_notes: paymentNote,
          verified_by: user.id,
          verified_at: new Date().toISOString(),
        })
        .eq('id', invoiceData.invoice.id);

      if (updateError) throw updateError;

      // Update payment record if exists
      if (invoiceData.invoice.facility_invoice_payments && invoiceData.invoice.facility_invoice_payments.length > 0) {
        await supabase
          .from('facility_invoice_payments')
          .update({
            status: verificationType === 'received' ? 'completed' : 'has_issues',
            payment_note: paymentNote,
            verified_by: user.id,
            verified_at: new Date().toISOString(),
          })
          .eq('id', invoiceData.invoice.facility_invoice_payments[0].id);
      }

      Alert.alert(
        'Success',
        verificationType === 'received'
          ? '✅ Check payment verified successfully. Invoice marked as PAID.'
          : '⚠️ Payment marked as having issues. Facility will be notified.',
        [{ text: 'OK' }]
      );

      setShowVerificationModal(false);
      setVerificationNotes('');
      setVerificationType(null);

      // Refresh data
      await fetchInvoiceData();

    } catch (error) {
      console.error('Error verifying payment:', error);
      Alert.alert('Error', 'Failed to verify payment. Please try again.');
    } finally {
      setProcessingAction(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={BRAND_COLOR} />
        <Text style={styles.loadingText}>Loading invoice...</Text>
      </View>
    );
  }

  if (!invoiceData) {
    return (
      <View style={styles.container}>
        <Header
          title="Invoice"
          onBack={() => navigation.goBack()}
          showMessaging={false}
        />
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>No invoice data found</Text>
        </View>
      </View>
    );
  }

  const currentTrips = activeTab === 'due' ? invoiceData.dueTrips : invoiceData.otherTrips;
  const paymentStatus = getPaymentStatus();

  return (
    <View style={styles.container}>
      <Header
        title="Billing & Invoices"
        onBack={() => navigation.goBack()}
        showMessaging={false}
      />

      {/* Teal Header Section */}
      <View style={styles.headerSection}>
        <Text style={styles.headerTitle}>Billing & Invoices</Text>
        <Text style={styles.headerSubtitle}>{facilityName}</Text>
      </View>

      {/* Month Selector with Navigation */}
      <View style={styles.monthSelector}>
        <TouchableOpacity
          style={styles.monthNavButton}
          onPress={handlePreviousMonth}
        >
          <Ionicons name="chevron-back" size={24} color={BRAND_COLOR} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.monthDisplayButton}
          onPress={() => setShowMonthPicker(!showMonthPicker)}
        >
          <Ionicons name="calendar" size={20} color={BRAND_COLOR} />
          <Text style={styles.monthValue}>{getMonthName(selectedYear, selectedMonth)}</Text>
          <Ionicons
            name={showMonthPicker ? "chevron-up" : "chevron-down"}
            size={20}
            color={BRAND_COLOR}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.monthNavButton}
          onPress={handleNextMonth}
        >
          <Ionicons name="chevron-forward" size={24} color={BRAND_COLOR} />
        </TouchableOpacity>
      </View>

      {/* Month Picker Dropdown */}
      {showMonthPicker && (
        <View style={styles.monthPickerContainer}>
          {generateMonthOptions().map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.monthOption,
                option.year === selectedYear && option.month === selectedMonth && styles.monthOptionSelected
              ]}
              onPress={() => handleMonthSelect(option.value)}
            >
              <Text style={[
                styles.monthOptionText,
                option.year === selectedYear && option.month === selectedMonth && styles.monthOptionTextSelected
              ]}>
                {option.displayName}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

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
          {/* Month Title */}
          <Text style={styles.monthTitle}>{getMonthName(selectedYear, selectedMonth)}</Text>

          {/* Payment Status Card */}
          {paymentStatus && (
            <View style={[
              styles.paymentStatusCard,
              { backgroundColor: getPaymentStatusColor(paymentStatus) }
            ]}>
              <View style={styles.paymentStatusContent}>
                <Ionicons
                  name={paymentStatus.includes('VERIFIED') || paymentStatus.includes('PAID') ? 'checkmark-circle' : paymentStatus.includes('ISSUES') ? 'alert-circle' : 'time'}
                  size={24}
                  color="#fff"
                />
                <View style={styles.paymentStatusText}>
                  <Text style={styles.paymentStatusLabel}>Payment Status</Text>
                  <Text style={styles.paymentStatusValue}>{paymentStatus}</Text>
                </View>
              </View>
              {canVerifyPayment() && (
                <View style={styles.verificationActions}>
                  <TouchableOpacity
                    style={styles.verifyButton}
                    onPress={() => handleVerificationAction('received')}
                  >
                    <Ionicons name="checkmark-circle" size={18} color="#4CAF50" />
                    <Text style={styles.verifyButtonText}>Check Received</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.issueButton}
                    onPress={() => handleVerificationAction('has_issues')}
                  >
                    <Ionicons name="warning" size={18} color="#F44336" />
                    <Text style={styles.issueButtonText}>Mark as Having Issues</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* Summary Cards Grid */}
          <View style={styles.summaryGrid}>
            <View style={[styles.summaryCard, { backgroundColor: BRAND_COLOR }]}>
              <Ionicons name="car" size={32} color="#fff" />
              <Text style={styles.summaryAmount}>{invoiceData.dueTrips.length}</Text>
              <Text style={styles.summaryLabel}>Billable Trips</Text>
              <Text style={styles.summarySubtext}>Completed</Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: '#FFA500' }]}>
              <Ionicons name="cash" size={32} color="#fff" />
              <Text style={styles.summaryAmount}>{formatCurrency(invoiceData.amountDue)}</Text>
              <Text style={styles.summaryLabel}>Amount Due</Text>
              <Text style={styles.summarySubtext}>{invoiceData.dueTrips.length} trips</Text>
            </View>
          </View>

          <View style={styles.summaryGrid}>
            <View style={[styles.summaryCard, { backgroundColor: '#4A90E2' }]}>
              <Ionicons name="time" size={32} color="#fff" />
              <Text style={styles.summaryAmount}>{invoiceData.otherTrips.length}</Text>
              <Text style={styles.summaryLabel}>Other Trips</Text>
              <Text style={styles.summarySubtext}>Pending/Upcoming</Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: '#F44336' }]}>
              <Ionicons name="close-circle" size={32} color="#fff" />
              <Text style={styles.summaryAmount}>{invoiceData.cancelledTrips.length}</Text>
              <Text style={styles.summaryLabel}>Cancelled</Text>
              <Text style={styles.summarySubtext}>This month</Text>
            </View>
          </View>

          {/* Invoice Paid Indicator */}
          {paymentStatus && paymentStatus.includes('VERIFIED') && (
            <View style={styles.invoicePaidCard}>
              <Ionicons name="checkmark-circle" size={24} color="#fff" />
              <Text style={styles.invoicePaidText}>Invoice Paid for this month</Text>
            </View>
          )}

          {/* Download Button */}
          <TouchableOpacity style={styles.downloadButton}>
            <Ionicons name="download" size={20} color={BRAND_COLOR} />
            <Text style={styles.downloadButtonText}>Download</Text>
          </TouchableOpacity>

          {/* Tabs */}
          <View style={styles.tabsContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'due' && styles.tabActive]}
              onPress={() => setActiveTab('due')}
            >
              <Text style={[styles.tabText, activeTab === 'due' && styles.tabTextActive]}>
                📋 DUE TRIPS ({invoiceData.dueTrips.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'other' && styles.tabActive]}
              onPress={() => setActiveTab('other')}
            >
              <Text style={[styles.tabText, activeTab === 'other' && styles.tabTextActive]}>
                📂 OTHER TRIPS ({invoiceData.otherTrips.length})
              </Text>
            </TouchableOpacity>
          </View>

          {/* Trips List */}
          <View style={styles.tripsContainer}>
            {currentTrips.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>📄</Text>
                <Text style={styles.emptyText}>No trips found</Text>
              </View>
            ) : (
              currentTrips.map((trip) => {
                const clientName = trip.facility_managed_clients
                  ? `${trip.facility_managed_clients.first_name} ${trip.facility_managed_clients.last_name}`
                  : 'Account Deleted';
                const isExpanded = expandedTripId === trip.id;
                const isClientDeleted = !trip.facility_managed_clients;

                return (
                  <TouchableOpacity
                    key={trip.id}
                    style={styles.tripCard}
                    onPress={() => setExpandedTripId(isExpanded ? null : trip.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.tripRow}>
                      <View style={styles.tripLeft}>
                        <Text style={[styles.tripClient, isClientDeleted && styles.deletedText]}>
                          {clientName}
                        </Text>
                        <Text style={styles.tripDate}>{formatDate(trip.pickup_time)}</Text>
                      </View>
                      <Text style={styles.tripPrice}>{formatCurrency(trip.price)}</Text>
                    </View>

                    {isExpanded && (
                      <View style={styles.tripExpandedContent}>
                        {/* Pickup Address */}
                        <View style={styles.tripDetailRow}>
                          <Ionicons name="location" size={16} color="#F44336" />
                          <Text style={styles.tripDetailText}>{trip.pickup_address}</Text>
                        </View>

                        {/* Dropoff Address */}
                        <View style={styles.tripDetailRow}>
                          <Ionicons name="navigate" size={16} color="#4CAF50" />
                          <Text style={styles.tripDetailText}>{trip.destination_address}</Text>
                        </View>

                        {/* Trip Type */}
                        <View style={styles.tripDetailRow}>
                          <Ionicons name="sync" size={16} color={BRAND_COLOR} />
                          <Text style={styles.tripDetailText}>
                            {trip.round_trip ? 'Round Trip' : 'One Way'}
                          </Text>
                        </View>

                        {/* Trip Details Button */}
                        <TouchableOpacity
                          style={styles.tripDetailsButton}
                          onPress={() => navigation.navigate('TripDetails', { tripId: trip.id })}
                        >
                          <Text style={styles.tripDetailsButtonText}>TRIP DETAILS</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </View>
      </ScrollView>

      {/* Verification Modal */}
      <Modal
        visible={showVerificationModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowVerificationModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {verificationType === 'received' ? '🏦 Confirm Check Payment' : '⚠️ Report Payment Issue'}
              </Text>
              <TouchableOpacity
                onPress={() => setShowVerificationModal(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {verificationType === 'received' ? (
                <>
                  <Text style={styles.modalSectionTitle}>✅ Final Verification Checklist</Text>
                  <View style={styles.checklistItem}>
                    <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                    <Text style={styles.checklistText}>Physical check received and verified</Text>
                  </View>
                  <View style={styles.checklistItem}>
                    <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                    <Text style={styles.checklistText}>Check amount verified: {formatCurrency(invoiceData.amountDue)}</Text>
                  </View>
                  <View style={styles.checklistItem}>
                    <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                    <Text style={styles.checklistText}>Check DEPOSITED into company bank account</Text>
                  </View>
                  <View style={styles.checklistItem}>
                    <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                    <Text style={styles.checklistText}>Bank deposit confirmation received</Text>
                  </View>

                  <View style={styles.warningBox}>
                    <Ionicons name="warning" size={20} color="#F44336" />
                    <Text style={styles.warningText}>
                      This action is IRREVERSIBLE and will mark the invoice as FULLY PAID
                    </Text>
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.modalDescription}>
                    Mark this payment as having issues. The facility will be notified to contact billing.
                  </Text>
                </>
              )}

              <Text style={styles.inputLabel}>Verification Notes (Optional)</Text>
              <TextInput
                style={styles.textInput}
                multiline
                numberOfLines={4}
                value={verificationNotes}
                onChangeText={setVerificationNotes}
                placeholder="Add any notes about this verification..."
                placeholderTextColor="#999"
              />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowVerificationModal(false)}
                disabled={processingAction}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.confirmButton,
                  verificationType === 'has_issues' && styles.confirmButtonDanger,
                  processingAction && styles.confirmButtonDisabled
                ]}
                onPress={confirmVerification}
                disabled={processingAction}
              >
                {processingAction ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons
                      name={verificationType === 'received' ? 'checkmark-circle' : 'alert-circle'}
                      size={18}
                      color="#fff"
                    />
                    <Text style={styles.confirmButtonText}>
                      {verificationType === 'received' ? 'Confirm Payment Received' : 'Report Issue'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  headerSection: {
    backgroundColor: BRAND_COLOR,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
  },
  monthSelector: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  monthNavButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  monthDisplayButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginHorizontal: 12,
  },
  monthValue: {
    fontSize: 16,
    fontWeight: '600',
    color: BRAND_COLOR,
    marginHorizontal: 8,
  },
  monthPickerContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    maxHeight: 300,
  },
  monthOption: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  monthOptionSelected: {
    backgroundColor: '#E8F5F5',
  },
  monthOptionText: {
    fontSize: 15,
    color: '#333',
  },
  monthOptionTextSelected: {
    color: BRAND_COLOR,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  monthTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 16,
  },
  paymentStatusCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  paymentStatusContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  paymentStatusText: {
    marginLeft: 12,
    flex: 1,
  },
  paymentStatusLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 4,
  },
  paymentStatusValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  verificationActions: {
    flexDirection: 'row',
    gap: 8,
  },
  verifyButton: {
    flex: 1,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
  },
  verifyButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4CAF50',
  },
  issueButton: {
    flex: 1,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
  },
  issueButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F44336',
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  summaryIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  summaryAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
    marginBottom: 2,
  },
  summarySubtext: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
  },
  invoicePaidCard: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  invoicePaidText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 8,
  },
  downloadButton: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: BRAND_COLOR,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  downloadButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: BRAND_COLOR,
    marginLeft: 8,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: BRAND_COLOR,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  tabTextActive: {
    color: '#fff',
  },
  tripsContainer: {
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
    shadowRadius: 4,
    elevation: 2,
  },
  tripRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tripLeft: {
    flex: 1,
  },
  tripClient: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  deletedText: {
    color: '#999',
    fontStyle: 'italic',
  },
  tripDate: {
    fontSize: 14,
    color: '#666',
  },
  tripPrice: {
    fontSize: 20,
    fontWeight: 'bold',
    color: BRAND_COLOR,
    marginLeft: 12,
  },
  tripExpandedContent: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  tripDetailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    paddingRight: 8,
  },
  tripDetailText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 10,
    flex: 1,
    lineHeight: 20,
  },
  tripDetailsButton: {
    backgroundColor: BRAND_COLOR,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  tripDetailsButtonText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 0.5,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
    flex: 1,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalBody: {
    padding: 20,
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  modalDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  checklistText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 10,
    flex: 1,
  },
  warningBox: {
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 16,
  },
  warningText: {
    fontSize: 13,
    color: '#E65100',
    marginLeft: 10,
    flex: 1,
    fontWeight: '600',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#333',
    textAlignVertical: 'top',
    minHeight: 80,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  confirmButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
    paddingVertical: 14,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  confirmButtonDanger: {
    backgroundColor: '#F44336',
  },
  confirmButtonDisabled: {
    opacity: 0.5,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default FacilityMonthlyInvoiceScreen;
