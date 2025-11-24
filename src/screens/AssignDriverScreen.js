import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import Header from '../components/Header';

const BRAND_COLOR = '#5fbfc0';

export default function AssignDriverScreen({ route, navigation }) {
  const { tripId } = route.params;
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(null);

  useEffect(() => {
    fetchAvailableDrivers();
  }, []);

  const fetchAvailableDrivers = async () => {
    try {
      console.log('🔍 Fetching available drivers...');

      // Fetch all users with role='driver'
      const { data: driversData, error } = await supabase
        .from('profiles')
        .select('id, full_name, first_name, last_name, email, phone_number, status')
        .eq('role', 'driver')
        .order('full_name', { ascending: true });

      if (error) throw error;

      console.log(`✅ Found ${driversData.length} drivers`);
      setDrivers(driversData);
    } catch (error) {
      console.error('Error fetching drivers:', error);
      Alert.alert('Error', 'Failed to load drivers');
    } finally {
      setLoading(false);
    }
  };

  const assignDriver = async (driverId) => {
    setAssigning(driverId);
    try {
      console.log(`🚗 Assigning driver ${driverId} to trip ${tripId}`);

      // Update trip with assigned driver - keep status as 'upcoming'
      // Set driver_acceptance_status to 'assigned_waiting'
      const { error: tripError } = await supabase
        .from('trips')
        .update({
          assigned_driver_id: driverId,
          driver_acceptance_status: 'assigned_waiting',
          updated_at: new Date().toISOString(),
        })
        .eq('id', tripId);

      if (tripError) throw tripError;

      console.log('✅ Driver assigned successfully. Trip status remains "upcoming".');

      Alert.alert(
        'Success',
        'Driver assigned successfully. The driver can now accept and start the trip.',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      console.error('Error assigning driver:', error);
      Alert.alert('Error', 'Failed to assign driver. Please try again.');
    } finally {
      setAssigning(null);
    }
  };

  const confirmAssignment = (driver) => {
    const driverName = driver.full_name || `${driver.first_name || ''} ${driver.last_name || ''}`.trim() || 'this driver';

    Alert.alert(
      'Assign Driver',
      `Assign ${driverName} to this trip?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Assign',
          onPress: () => assignDriver(driver.id),
        },
      ]
    );
  };

  const getDriverName = (driver) => {
    if (driver.full_name) return driver.full_name;
    if (driver.first_name || driver.last_name) {
      return `${driver.first_name || ''} ${driver.last_name || ''}`.trim();
    }
    return 'Unnamed Driver';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'available':
        return '#10B981';
      case 'busy':
        return '#F59E0B';
      case 'offline':
        return '#6B7280';
      default:
        return '#999';
    }
  };

  const getStatusLabel = (status) => {
    if (!status) return 'Unknown';
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const renderDriverItem = ({ item: driver }) => {
    const isAssigning = assigning === driver.id;

    return (
      <TouchableOpacity
        style={styles.driverCard}
        onPress={() => confirmAssignment(driver)}
        disabled={isAssigning}
        activeOpacity={0.7}
      >
        <View style={styles.driverAvatar}>
          <Ionicons name="person" size={28} color={BRAND_COLOR} />
        </View>

        <View style={styles.driverInfo}>
          <Text style={styles.driverName}>{getDriverName(driver)}</Text>

          {driver.phone_number && (
            <View style={styles.contactRow}>
              <Ionicons name="call-outline" size={14} color="#666" />
              <Text style={styles.contactText}>{driver.phone_number}</Text>
            </View>
          )}

          {driver.email && (
            <View style={styles.contactRow}>
              <Ionicons name="mail-outline" size={14} color="#666" />
              <Text style={styles.contactText}>{driver.email}</Text>
            </View>
          )}

          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(driver.status) }]}>
            <Text style={styles.statusText}>{getStatusLabel(driver.status)}</Text>
          </View>
        </View>

        <View style={styles.assignButtonContainer}>
          {isAssigning ? (
            <ActivityIndicator size="small" color={BRAND_COLOR} />
          ) : (
            <Ionicons name="chevron-forward" size={24} color={BRAND_COLOR} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Assign Driver" showBack showMessaging={false} onBackPress={() => navigation.goBack()} />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={BRAND_COLOR} />
          <Text style={styles.loadingText}>Loading drivers...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Assign Driver" showBack showMessaging={false} onBackPress={() => navigation.goBack()} />

      {drivers.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="person-outline" size={64} color="#ccc" />
          <Text style={styles.emptyTitle}>No Drivers Available</Text>
          <Text style={styles.emptySubtitle}>
            Please add drivers to the system first
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.infoBox}>
            <Ionicons name="information-circle" size={20} color={BRAND_COLOR} />
            <Text style={styles.infoText}>
              Assigning a driver enables live GPS tracking once they start the trip. You'll be able to monitor their location in real-time from the Live tab.
            </Text>
          </View>

          <FlatList
            data={drivers}
            renderItem={renderDriverItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        </>
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
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#E6F7F7',
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 12,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  listContainer: {
    padding: 16,
  },
  driverCard: {
    flexDirection: 'row',
    alignItems: 'center',
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
    height: 12,
  },
  driverAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E6F7F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 6,
  },
  contactText: {
    fontSize: 13,
    color: '#666',
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
    textTransform: 'uppercase',
  },
  assignButtonContainer: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
