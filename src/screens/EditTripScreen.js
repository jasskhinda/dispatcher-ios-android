import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Platform,
  Modal,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Calendar } from 'react-native-calendars';
import { Picker } from '@react-native-picker/picker';
import { supabase } from '../lib/supabase';
import { getPricingEstimate } from '../lib/pricing';
import Header from '../components/Header';

const BRAND_COLOR = '#5fbfc0';
const API_URL = process.env.EXPO_PUBLIC_API_URL;

const EditTripScreen = ({ route, navigation }) => {
  const { tripId } = route.params;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [trip, setTrip] = useState(null);
  const [calculatingPrice, setCalculatingPrice] = useState(false);

  // Form state
  const [pickupDate, setPickupDate] = useState(new Date());
  const [pickupTime, setPickupTime] = useState(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [tripNotes, setTripNotes] = useState('');
  const [isRoundTrip, setIsRoundTrip] = useState(false);
  const [returnTime, setReturnTime] = useState(new Date());
  const [showReturnTimePicker, setShowReturnTimePicker] = useState(false);

  // Address state
  const [pickupAddress, setPickupAddress] = useState('');
  const [destinationAddress, setDestinationAddress] = useState('');
  const [pickupCoords, setPickupCoords] = useState(null);
  const [destinationCoords, setDestinationCoords] = useState(null);

  // Address input modal
  const [showAddressInput, setShowAddressInput] = useState(false);
  const [addressInputType, setAddressInputType] = useState('pickup'); // 'pickup' or 'destination'
  const [addressInput, setAddressInput] = useState('');
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

  // Client information
  const [clientWeight, setClientWeight] = useState('');
  const [clientHeightFeet, setClientHeightFeet] = useState('5');
  const [clientHeightInches, setClientHeightInches] = useState('0');
  const [clientDOB, setClientDOB] = useState('');
  const [clientEmail, setClientEmail] = useState('');

  // Trip details
  const [wheelchairType, setWheelchairType] = useState('none');
  const [wheelchairRequirements, setWheelchairRequirements] = useState({
    stepStool: false,
    smallerRamp: false,
    largerRamp: false,
    bariatricRamp: false,
    widerVehicle: false,
  });
  const [wheelchairDetails, setWheelchairDetails] = useState('');
  const [isEmergency, setIsEmergency] = useState(false);
  const [additionalPassengers, setAdditionalPassengers] = useState('0');

  // Pricing
  const [pricingBreakdown, setPricingBreakdown] = useState(null);
  const [estimatedPrice, setEstimatedPrice] = useState(null);
  const [showPriceBreakdown, setShowPriceBreakdown] = useState(false);

  useEffect(() => {
    fetchTripDetails();
  }, [tripId]);

  // Recalculate price when relevant fields change
  useEffect(() => {
    if (trip && !loading) {
      calculatePricing();
    }
  }, [
    pickupDate,
    pickupTime,
    isRoundTrip,
    returnTime,
    clientWeight,
    wheelchairType,
    isEmergency,
    pickupAddress,
    destinationAddress,
    additionalPassengers,
  ]);

  // Watch for address input changes
  useEffect(() => {
    if (addressInput.length >= 3) {
      const timeoutId = setTimeout(() => {
        fetchAddressSuggestions(addressInput);
      }, 300);
      return () => clearTimeout(timeoutId);
    } else {
      setAddressSuggestions([]);
    }
  }, [addressInput]);

  const fetchTripDetails = async () => {
    try {
      console.log('🔍 Fetching trip details for editing:', tripId);

      // Fetch trip data
      const { data: tripData, error: tripError } = await supabase
        .from('trips')
        .select('*')
        .eq('id', tripId)
        .single();

      if (tripError) throw tripError;

      console.log('✅ Trip data loaded:', tripData);

      // Fetch facility data if needed
      if (tripData.facility_id) {
        const { data: facilityData } = await supabase
          .from('facilities')
          .select('*')
          .eq('id', tripData.facility_id)
          .single();

        tripData.facility = facilityData;
      }

      // Fetch managed client data if needed
      if (tripData.managed_client_id) {
        const { data: clientData } = await supabase
          .from('facility_managed_clients')
          .select('*')
          .eq('id', tripData.managed_client_id)
          .single();

        tripData.client = clientData;

        // Pre-fill client information
        if (clientData) {
          setClientWeight(clientData.weight?.toString() || '');
          const height = clientData.height || '5\'0"';
          const [feet, inches] = height.split("'");
          setClientHeightFeet(feet || '5');
          setClientHeightInches(inches?.replace('"', '') || '0');
          setClientDOB(clientData.date_of_birth || '');
          setClientEmail(clientData.email || '');
        }
      }

      // Fetch user profile if needed (for individual bookings)
      if (tripData.user_id) {
        const { data: userData} = await supabase
          .from('profiles')
          .select('*')
          .eq('id', tripData.user_id)
          .single();

        tripData.user = userData;
      }

      // Fetch driver data if assigned
      if (tripData.assigned_driver_id) {
        const { data: driverData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', tripData.assigned_driver_id)
          .single();

        tripData.driver = driverData;
      }

      setTrip(tripData);

      // Initialize form fields
      if (tripData.pickup_time) {
        const pickupDateTime = new Date(tripData.pickup_time);
        setPickupDate(pickupDateTime);
        setPickupTime(pickupDateTime);
      }

      setPickupAddress(tripData.pickup_address || '');
      setDestinationAddress(tripData.destination_address || '');
      setTripNotes(tripData.trip_notes || tripData.special_instructions || '');
      setIsRoundTrip(tripData.is_round_trip || tripData.round_trip || false);
      setIsEmergency(tripData.is_emergency || false);
      setWheelchairType(tripData.wheelchair_type || 'none');
      setAdditionalPassengers(tripData.additional_passengers?.toString() || '0');

      // Load wheelchair requirements if available
      if (tripData.pricing_breakdown_data?.wheelchairInfo?.requirements) {
        setWheelchairRequirements(tripData.pricing_breakdown_data.wheelchairInfo.requirements);
      }
      if (tripData.pricing_breakdown_data?.wheelchairInfo?.details) {
        setWheelchairDetails(tripData.pricing_breakdown_data.wheelchairInfo.details);
      }

      if (tripData.return_pickup_time) {
        setReturnTime(new Date(tripData.return_pickup_time));
      }

      // Load existing pricing breakdown if available
      if (tripData.price) {
        setEstimatedPrice(tripData.price);
      }
      if (tripData.pricing_breakdown_data) {
        // Combine pricing data with county/wheelchair info
        const breakdownData = {
          ...tripData.pricing_breakdown_data.pricing,
          countyInfo: tripData.pricing_breakdown_data.countyInfo,
          wheelchairInfo: tripData.pricing_breakdown_data.wheelchairInfo,
        };
        setPricingBreakdown(breakdownData);
      }

      setLoading(false);
    } catch (error) {
      console.error('❌ Error fetching trip:', error);
      Alert.alert('Error', 'Failed to load trip details: ' + (error.message || 'Unknown error'));
      navigation.goBack();
    }
  };

  const calculatePricing = async () => {
    if (!trip || !clientWeight || !pickupAddress || !destinationAddress) return;

    try {
      setCalculatingPrice(true);

      // Combine date and time for pickup
      const combinedPickupDateTime = new Date(
        pickupDate.getFullYear(),
        pickupDate.getMonth(),
        pickupDate.getDate(),
        pickupTime.getHours(),
        pickupTime.getMinutes()
      );

      console.log('🔄 Recalculating pricing preview...');
      console.log('📍 Pickup:', pickupAddress);
      console.log('📍 Destination:', destinationAddress);

      // CRITICAL FIX: Calculate distance using Directions API (same as facility_mobile)
      // This ensures we get the accurate driving distance and can detect counties correctly
      let calculatedDistance = trip.distance || 0;
      try {
        const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
        const directionsUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(pickupAddress)}&destination=${encodeURIComponent(destinationAddress)}&alternatives=true&mode=driving&units=imperial&departure_time=now&traffic_model=best_guess&key=${GOOGLE_MAPS_API_KEY}`;

        console.log('🌐 Fetching route from Google Directions API...');
        const response = await fetch(directionsUrl);
        const data = await response.json();

        if (data.status === 'OK' && data.routes && data.routes.length > 0) {
          // Find fastest route (same logic as facility_mobile)
          let fastestRoute = data.routes[0];
          let shortestDuration = data.routes[0].legs[0].duration.value;

          for (let i = 1; i < data.routes.length; i++) {
            const routeDuration = data.routes[i].legs[0].duration.value;
            if (routeDuration < shortestDuration) {
              shortestDuration = routeDuration;
              fastestRoute = data.routes[i];
            }
          }

          const leg = fastestRoute.legs[0];
          const distanceInMiles = leg.distance.value * 0.000621371;
          calculatedDistance = Math.round(distanceInMiles * 100) / 100;

          console.log('✅ Distance calculated:', calculatedDistance, 'miles');
        } else {
          console.error('❌ Directions API failed:', data.status);
        }
      } catch (directionsError) {
        console.error('❌ Error calling Directions API:', directionsError);
      }

      // Now calculate pricing with the accurate distance
      const estimate = await getPricingEstimate({
        isRoundTrip,
        distance: calculatedDistance,
        pickupDateTime: combinedPickupDateTime,
        wheelchairType,
        clientType: 'managed',
        additionalPassengers: parseInt(additionalPassengers) || 0,
        isEmergency,
        pickupAddress,
        destinationAddress,
        clientWeight: clientWeight ? parseInt(clientWeight) : null,
      });

      console.log('💰 Pricing estimate:', estimate);

      if (estimate && estimate.pricing) {
        console.log('💰 Updated fare estimate:', estimate.pricing.total);
        console.log('📊 County info:', estimate.countyInfo);
        // Store the full estimate with county info
        setPricingBreakdown({
          ...estimate.pricing,
          countyInfo: estimate.countyInfo,
          wheelchairInfo: estimate.wheelchairInfo,
        });
        setEstimatedPrice(estimate.pricing.total);
      }
    } catch (error) {
      console.error('❌ Error calculating pricing:', error);
      // Don't show error to user, just log it
    } finally {
      setCalculatingPrice(false);
    }
  };

  // Fetch address suggestions from Google Places API
  const fetchAddressSuggestions = async (input) => {
    if (!input || input.length < 3) {
      setAddressSuggestions([]);
      return;
    }

    setIsLoadingSuggestions(true);
    try {
      const url = `${API_URL}/api/maps/autocomplete?input=${encodeURIComponent(input)}`;
      console.log('🔍 Fetching autocomplete:', url);

      const response = await fetch(url);
      console.log('📡 Response status:', response.status, response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.log('❌ Error response:', errorText.substring(0, 200));
        setAddressSuggestions([]);
        return;
      }

      const responseText = await response.text();
      console.log('📄 Response preview:', responseText.substring(0, 100));

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.log('⚠️ Not valid JSON, got HTML or other format');
        setAddressSuggestions([]);
        return;
      }

      if (data.status === 'OK' && data.predictions) {
        console.log('✅ Got', data.predictions.length, 'suggestions');
        setAddressSuggestions(data.predictions);
      } else {
        console.log('⚠️ No predictions in response:', data.status);
        setAddressSuggestions([]);
      }
    } catch (error) {
      console.log('⚠️ Fetch error (silently handled):', error.message);
      setAddressSuggestions([]);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  // Get place details for selected address
  const getPlaceDetails = async (placeId) => {
    try {
      const url = `${API_URL}/api/maps/place-details?place_id=${placeId}`;
      console.log('🔍 Fetching place details:', url);

      const response = await fetch(url);
      console.log('📡 Place details response status:', response.status, response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.log('❌ Place details error:', errorText.substring(0, 200));
        return null;
      }

      const responseText = await response.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.log('⚠️ Place details response not valid JSON');
        return null;
      }

      if (data.status === 'OK' && data.result) {
        console.log('✅ Got place details');
        return {
          address: data.result.formatted_address,
          coords: {
            latitude: data.result.geometry.location.lat,
            longitude: data.result.geometry.location.lng,
          },
        };
      }
      console.log('⚠️ No result in place details:', data.status);
      return null;
    } catch (error) {
      console.log('⚠️ Place details error (silently handled):', error.message);
      return null;
    }
  };

  // Handle selecting an address suggestion
  const handleAddressSelect = async (suggestion) => {
    const details = await getPlaceDetails(suggestion.place_id);
    if (!details) {
      Alert.alert('Error', 'Could not get address details. Please try again.');
      return;
    }

    if (addressInputType === 'pickup') {
      setPickupAddress(details.address);
      setPickupCoords(details.coords);
    } else {
      setDestinationAddress(details.address);
      setDestinationCoords(details.coords);
    }

    setAddressInput('');
    setAddressSuggestions([]);
    setShowAddressInput(false);
  };

  const handleSave = async () => {
    try {
      // Validate required fields
      if (!pickupAddress || !destinationAddress) {
        Alert.alert('Required Fields', 'Please enter both pickup and destination addresses');
        return;
      }

      setSaving(true);

      // Combine date and time
      const combinedPickupDateTime = new Date(
        pickupDate.getFullYear(),
        pickupDate.getMonth(),
        pickupDate.getDate(),
        pickupTime.getHours(),
        pickupTime.getMinutes()
      );

      const updateData = {
        pickup_time: combinedPickupDateTime.toISOString(),
        pickup_address: pickupAddress,
        destination_address: destinationAddress,
        trip_notes: tripNotes,
        is_round_trip: isRoundTrip,
        is_emergency: isEmergency,
        wheelchair_type: wheelchairType,
        additional_passengers: parseInt(additionalPassengers) || 0,
        updated_at: new Date().toISOString(),
      };

      // Add return time if round trip
      if (isRoundTrip) {
        const combinedReturnDateTime = new Date(
          pickupDate.getFullYear(),
          pickupDate.getMonth(),
          pickupDate.getDate(),
          returnTime.getHours(),
          returnTime.getMinutes()
        );
        updateData.return_pickup_time = combinedReturnDateTime.toISOString();
      } else {
        updateData.return_pickup_time = null;
      }

      // Update price if we have a new calculation
      if (estimatedPrice && pricingBreakdown) {
        updateData.price = estimatedPrice;
        updateData.pricing_breakdown_data = {
          pricing: {
            ...pricingBreakdown,
            // Remove nested countyInfo/wheelchairInfo from pricing to avoid duplication
            countyInfo: undefined,
            wheelchairInfo: undefined,
          },
          countyInfo: pricingBreakdown.countyInfo,
          wheelchairInfo: pricingBreakdown.wheelchairInfo,
        };
      }

      console.log('💾 Updating trip with data:', updateData);

      const { error: tripError } = await supabase
        .from('trips')
        .update(updateData)
        .eq('id', tripId);

      if (tripError) throw tripError;

      Alert.alert(
        'Success',
        'Trip updated successfully!',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack()
          }
        ]
      );
    } catch (error) {
      console.error('❌ Error updating trip:', error);
      Alert.alert('Error', 'Failed to update trip: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const onCalendarDayPress = (day) => {
    // day.dateString is in format 'YYYY-MM-DD'
    // Create date in local timezone to avoid UTC conversion issues
    const [year, month, date] = day.dateString.split('-').map(Number);
    const selectedDate = new Date(year, month - 1, date);
    setPickupDate(selectedDate);
    setShowCalendar(false);
  };

  const onTimeChange = (event, selectedTime) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
    }
    if (Platform.OS === 'ios') {
      setShowTimePicker(false);
    }
    if (event.type === 'set' && selectedTime) {
      setPickupTime(selectedTime);
    }
  };

  const onReturnTimeChange = (event, selectedTime) => {
    if (Platform.OS === 'android') {
      setShowReturnTimePicker(false);
    }
    if (Platform.OS === 'ios') {
      setShowReturnTimePicker(false);
    }
    if (event.type === 'set' && selectedTime) {
      setReturnTime(selectedTime);
    }
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
    });
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatCurrency = (amount) => {
    return `$${parseFloat(amount).toFixed(2)}`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return '#FFA500';
      case 'upcoming':
      case 'confirmed':
        return '#4A90E2';
      case 'completed':
        return '#4CAF50';
      case 'cancelled':
        return '#F44336';
      default:
        return '#999';
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={BRAND_COLOR} />
        <Text style={styles.loadingText}>Loading trip details...</Text>
      </View>
    );
  }

  const isBariatric = parseInt(clientWeight) >= 300;

  return (
    <View style={styles.container}>
      <Header title="Edit Trip Details" onBack={() => navigation.goBack()} />

      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          {/* Trip Status Header */}
          <View style={styles.statusCard}>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Trip Status</Text>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(trip.status) }]}>
                <Text style={styles.statusText}>{trip.status}</Text>
              </View>
            </View>
            <Text style={styles.tripId}>Trip ID: {trip.id.substring(0, 8)}</Text>
          </View>

          {/* Status Warning */}
          <View style={styles.warningBox}>
            <Ionicons name="information-circle" size={20} color="#FF9800" />
            <Text style={styles.warningText}>
              You can edit trip details until completed. Client information is locked as set by the facility. Note: Changing addresses will recalculate pricing.
            </Text>
          </View>

          {/* Date & Time Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📅 Pickup Date & Time</Text>

            <Text style={styles.fieldLabel}>Pickup Date *</Text>
            <TouchableOpacity
              style={styles.inputButton}
              onPress={() => setShowCalendar(true)}
            >
              <View style={styles.inputButtonContent}>
                <Ionicons name="calendar" size={20} color={BRAND_COLOR} />
                <Text style={styles.inputButtonText}>{formatDate(pickupDate)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </TouchableOpacity>

            <Text style={styles.fieldLabel}>Pickup Time *</Text>
            <TouchableOpacity
              style={styles.inputButton}
              onPress={() => setShowTimePicker(true)}
            >
              <View style={styles.inputButtonContent}>
                <Ionicons name="time" size={20} color={BRAND_COLOR} />
                <Text style={styles.inputButtonText}>{formatTime(pickupTime)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </TouchableOpacity>
          </View>

          {/* Addresses Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📍 Trip Addresses</Text>

            <TouchableOpacity
              style={styles.addressCard}
              onPress={() => {
                setAddressInputType('pickup');
                setShowAddressInput(true);
              }}
            >
              <Text style={styles.fieldLabel}>Pickup Address *</Text>
              <Text style={styles.addressValue} numberOfLines={2}>
                {pickupAddress || 'Tap to enter pickup address'}
              </Text>
              <Text style={styles.changeText}>Tap to change</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.addressCard}
              onPress={() => {
                setAddressInputType('destination');
                setShowAddressInput(true);
              }}
            >
              <Text style={styles.fieldLabel}>Destination Address *</Text>
              <Text style={styles.addressValue} numberOfLines={2}>
                {destinationAddress || 'Tap to enter destination address'}
              </Text>
              <Text style={styles.changeText}>Tap to change</Text>
            </TouchableOpacity>

            <View style={styles.infoBox}>
              <Ionicons name="information-circle" size={16} color="#666" />
              <Text style={styles.infoText}>
                Changing addresses will automatically recalculate trip pricing based on distance and location.
              </Text>
            </View>
          </View>

          {/* Client Information (Read-Only) */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>👤 Client Information (Locked)</Text>

            <Text style={styles.fieldLabel}>Weight (lbs)</Text>
            <View style={styles.readOnlyField}>
              <Ionicons name="scale" size={18} color="#666" />
              <Text style={styles.readOnlyText}>{clientWeight ? `${clientWeight} lbs` : 'Not specified'}</Text>
            </View>
            {isBariatric && (
              <View style={styles.bariatricNotice}>
                <Ionicons name="warning" size={16} color="#E65100" />
                <Text style={styles.bariatricText}>
                  Bariatric transportation required ($150 per leg vs $50 regular rate)
                </Text>
              </View>
            )}

            <Text style={styles.fieldLabel}>Height</Text>
            <View style={styles.readOnlyField}>
              <Ionicons name="resize" size={18} color="#666" />
              <Text style={styles.readOnlyText}>{clientHeightFeet}' {clientHeightInches}"</Text>
            </View>

            {clientDOB && (
              <>
                <Text style={styles.fieldLabel}>Date of Birth</Text>
                <View style={styles.readOnlyField}>
                  <Ionicons name="calendar-outline" size={18} color="#666" />
                  <Text style={styles.readOnlyText}>{clientDOB}</Text>
                </View>
              </>
            )}

            {clientEmail && (
              <>
                <Text style={styles.fieldLabel}>Email Address</Text>
                <View style={styles.readOnlyField}>
                  <Ionicons name="mail-outline" size={18} color="#666" />
                  <Text style={styles.readOnlyText}>{clientEmail}</Text>
                </View>
              </>
            )}

            <View style={styles.infoBox}>
              <Ionicons name="lock-closed" size={16} color="#666" />
              <Text style={styles.infoText}>
                Client information is locked as set by the facility during booking. Contact support if changes are required.
              </Text>
            </View>
          </View>

          {/* Round Trip */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setIsRoundTrip(!isRoundTrip)}
            >
              <View style={styles.checkbox}>
                {isRoundTrip && (
                  <Ionicons name="checkmark" size={18} color={BRAND_COLOR} />
                )}
              </View>
              <Text style={styles.checkboxLabel}>Round Trip</Text>
            </TouchableOpacity>

            {isRoundTrip && (
              <>
                <Text style={styles.fieldLabel}>Return Time</Text>
                <TouchableOpacity
                  style={styles.inputButton}
                  onPress={() => setShowReturnTimePicker(true)}
                >
                  <View style={styles.inputButtonContent}>
                    <Ionicons name="arrow-back" size={20} color={BRAND_COLOR} />
                    <Text style={styles.inputButtonText}>{formatTime(returnTime)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#999" />
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Wheelchair Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>♿ Wheelchair Assistance</Text>

            {['none', 'manual', 'power'].map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.radioOption,
                  wheelchairType === type && styles.radioOptionActive
                ]}
                onPress={() => setWheelchairType(type)}
              >
                <View style={[styles.radio, wheelchairType === type && styles.radioActive]}>
                  {wheelchairType === type && <View style={styles.radioInner} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.radioLabel}>
                    {type === 'none' && 'None (No wheelchair assistance needed)'}
                    {type === 'manual' && 'Manual Wheelchair'}
                    {type === 'power' && 'Power Wheelchair'}
                  </Text>
                  {type !== 'none' && (
                    <Text style={styles.wheelchairFeeText}>+$0 wheelchair fee</Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}

            {/* Transport Chair - Disabled */}
            <View style={[styles.radioOption, styles.radioOptionDisabled]}>
              <View style={[styles.radio, styles.radioDisabled]}>
                <Ionicons name="close" size={16} color="#999" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.radioLabel, styles.radioLabelDisabled]}>
                  Transport wheelchair
                </Text>
                <Text style={styles.notAvailableText}>Not Available</Text>
                <Text style={styles.disabledReasonText}>
                  Lightweight transport chair - Not permitted for safety reasons
                </Text>
              </View>
            </View>

            {/* Show "Do you want us to provide wheelchair?" only when None is selected */}
            {wheelchairType === 'none' && (
              <View style={styles.provideWheelchairSection}>
                <Text style={styles.provideWheelchairTitle}>
                  Do you want us to provide a wheelchair?
                </Text>

                <TouchableOpacity
                  style={[
                    styles.radioOption,
                    wheelchairType === 'provided' && styles.radioOptionActive
                  ]}
                  onPress={() => setWheelchairType('provided')}
                >
                  <View style={[styles.radio, wheelchairType === 'provided' && styles.radioActive]}>
                    {wheelchairType === 'provided' && <View style={styles.radioInner} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.radioLabel}>Yes, please provide a wheelchair</Text>
                    <Text style={styles.provideWheelchairSubtext}>
                      We will provide a suitable wheelchair for your trip
                    </Text>
                    <Text style={styles.wheelchairFeeText}>+$0 wheelchair rental fee</Text>
                  </View>
                </TouchableOpacity>
              </View>
            )}

            {/* Transport Chair Safety Notice */}
            <View style={styles.safetyNoticeBox}>
              <View style={styles.safetyNoticeHeader}>
                <Ionicons name="shield-checkmark" size={20} color="#DC2626" />
                <Text style={styles.safetyNoticeTitle}>Important Safety Notice</Text>
              </View>
              <Text style={styles.safetyNoticeText}>
                We're unable to accommodate transport wheelchairs due to safety regulations and vehicle accessibility requirements. Please consider selecting a manual or power wheelchair option, or choose "None" if you'd like us to provide suitable wheelchair accommodation.
              </Text>
              <Text style={styles.safetyNoticePriority}>
                Our priority is ensuring safe and comfortable transportation for all passengers.
              </Text>
            </View>

            {/* Wheelchair Requirements for "provided" */}
            {wheelchairType === 'provided' && (
              <View style={styles.requirementsSection}>
                <Text style={styles.requirementsTitle}>Equipment Requirements:</Text>
                {[
                  { key: 'stepStool', label: 'Step stool' },
                  { key: 'smallerRamp', label: 'Smaller ramp' },
                  { key: 'largerRamp', label: 'Larger ramp' },
                  { key: 'bariatricRamp', label: 'Bariatric ramp' },
                  { key: 'widerVehicle', label: 'Wider vehicle' },
                ].map(({ key, label }) => (
                  <TouchableOpacity
                    key={key}
                    style={styles.checkboxRow}
                    onPress={() => setWheelchairRequirements(prev => ({
                      ...prev,
                      [key]: !prev[key]
                    }))}
                  >
                    <View style={[styles.checkbox, wheelchairRequirements[key] && styles.checkboxActive]}>
                      {wheelchairRequirements[key] && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <Text style={styles.checkboxLabel}>{label}</Text>
                  </TouchableOpacity>
                ))}
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  value={wheelchairDetails}
                  onChangeText={setWheelchairDetails}
                  placeholder="Additional wheelchair details..."
                  placeholderTextColor="#999"
                  multiline
                  numberOfLines={3}
                />
              </View>
            )}
          </View>

          {/* Emergency Trip */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setIsEmergency(!isEmergency)}
            >
              <View style={styles.checkbox}>
                {isEmergency && (
                  <Ionicons name="checkmark" size={18} color={BRAND_COLOR} />
                )}
              </View>
              <View style={styles.emergencyLabelContainer}>
                <Text style={styles.checkboxLabel}>🚨 Emergency Trip</Text>
                <Text style={styles.emergencySubtext}>Additional $40 emergency fee applies</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Additional Passengers */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>👥 Additional Passengers</Text>
            <Text style={styles.fieldLabel}>Number of Additional Passengers</Text>
            <TextInput
              style={styles.textInput}
              value={additionalPassengers}
              onChangeText={setAdditionalPassengers}
              placeholder="0"
              keyboardType="numeric"
              placeholderTextColor="#999"
            />
            <View style={styles.infoBox}>
              <Ionicons name="information-circle" size={16} color="#666" />
              <Text style={styles.infoText}>
                Additional passengers traveling with the primary client (does not include the primary client).
              </Text>
            </View>
          </View>

          {/* Trip Notes */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📝 Trip Notes</Text>
            <TextInput
              style={styles.textArea}
              multiline
              numberOfLines={4}
              value={tripNotes}
              onChangeText={setTripNotes}
              placeholder="Special instructions, medical equipment, etc."
              placeholderTextColor="#999"
            />
          </View>

          {/* Pricing Estimate */}
          {estimatedPrice !== null && (
            <View style={styles.pricingSection}>
              <Text style={styles.sectionTitle}>💰 Updated Price Estimate</Text>

              {calculatingPrice ? (
                <View style={styles.calculatingBox}>
                  <ActivityIndicator size="small" color={BRAND_COLOR} />
                  <Text style={styles.calculatingText}>Calculating price...</Text>
                </View>
              ) : (
                <>
                  <View style={styles.priceCard}>
                    <Text style={styles.priceLabel}>
                      {isRoundTrip ? 'Round Trip' : 'One Way'} • {pricingBreakdown?.distance?.toFixed(1)} miles
                    </Text>
                    <Text style={styles.priceValue}>{formatCurrency(estimatedPrice)}</Text>
                  </View>

                  <TouchableOpacity
                    style={styles.breakdownToggle}
                    onPress={() => setShowPriceBreakdown(!showPriceBreakdown)}
                  >
                    <Ionicons
                      name={showPriceBreakdown ? 'chevron-down' : 'chevron-forward'}
                      size={20}
                      color={BRAND_COLOR}
                    />
                    <Text style={styles.breakdownToggleText}>View price breakdown</Text>
                  </TouchableOpacity>

                  {showPriceBreakdown && pricingBreakdown && (
                    <View style={styles.breakdownDetails}>
                      {pricingBreakdown.basePrice > 0 && (
                        <View style={styles.breakdownRow}>
                          <Text style={styles.breakdownLabel}>
                            Base fare ({isRoundTrip ? '2' : '1'} leg @ ${isBariatric ? '150' : '50'}/leg)
                          </Text>
                          <Text style={styles.breakdownValue}>
                            {formatCurrency(pricingBreakdown.basePrice + (pricingBreakdown.roundTripPrice || 0))}
                          </Text>
                        </View>
                      )}

                      {pricingBreakdown.distancePrice > 0 && (
                        <View style={styles.breakdownRow}>
                          <Text style={styles.breakdownLabel}>
                            Distance charge (${pricingBreakdown.countyInfo?.isInFranklinCounty ? '3' : '4'}/mile)
                          </Text>
                          <Text style={styles.breakdownValue}>
                            {formatCurrency(pricingBreakdown.distancePrice)}
                          </Text>
                        </View>
                      )}

                      {pricingBreakdown.countyPrice > 0 && (
                        <View style={styles.breakdownRow}>
                          <Text style={styles.breakdownLabel}>County surcharge</Text>
                          <Text style={styles.breakdownValue}>
                            {formatCurrency(pricingBreakdown.countyPrice)}
                          </Text>
                        </View>
                      )}

                      {pricingBreakdown.deadMileagePrice > 0 && (
                        <View style={styles.breakdownRow}>
                          <Text style={styles.breakdownLabel}>
                            Dead mileage ({pricingBreakdown.deadMileage?.toFixed(1)} mi @ $4/mile)
                          </Text>
                          <Text style={styles.breakdownValue}>
                            {formatCurrency(pricingBreakdown.deadMileagePrice)}
                          </Text>
                        </View>
                      )}

                      {pricingBreakdown.weekendAfterHoursSurcharge > 0 && (
                        <View style={styles.breakdownRow}>
                          <Text style={styles.breakdownLabel}>Weekend/After-hours surcharge</Text>
                          <Text style={styles.breakdownValue}>
                            {formatCurrency(pricingBreakdown.weekendAfterHoursSurcharge)}
                          </Text>
                        </View>
                      )}

                      {pricingBreakdown.emergencyFee > 0 && (
                        <View style={styles.breakdownRow}>
                          <Text style={styles.breakdownLabel}>Emergency fee</Text>
                          <Text style={styles.breakdownValue}>
                            {formatCurrency(pricingBreakdown.emergencyFee)}
                          </Text>
                        </View>
                      )}

                      {pricingBreakdown.holidaySurcharge > 0 && (
                        <View style={styles.breakdownRow}>
                          <Text style={styles.breakdownLabel}>Holiday surcharge</Text>
                          <Text style={styles.breakdownValue}>
                            {formatCurrency(pricingBreakdown.holidaySurcharge)}
                          </Text>
                        </View>
                      )}

                      <View style={[styles.breakdownRow, styles.breakdownTotal]}>
                        <Text style={styles.breakdownTotalLabel}>Total</Text>
                        <Text style={styles.breakdownTotalValue}>
                          {formatCurrency(pricingBreakdown.total)}
                        </Text>
                      </View>
                    </View>
                  )}

                  {isBariatric && (
                    <View style={styles.pricingNote}>
                      <Text style={styles.pricingNoteText}>
                        • Enhanced bariatric rate ($150 vs $50) applied based on client weight
                      </Text>
                    </View>
                  )}
                </>
              )}
            </View>
          )}

          {/* Action Buttons */}
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving || calculatingPrice}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => navigation.goBack()}
            disabled={saving}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Calendar Modal */}
      <Modal
        visible={showCalendar}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowCalendar(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.calendarContainer}>
            <View style={styles.calendarHeader}>
              <Text style={styles.calendarHeaderText}>Select Pickup Date</Text>
              <TouchableOpacity onPress={() => setShowCalendar(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <Calendar
              current={pickupDate.toISOString().split('T')[0]}
              minDate={new Date().toISOString().split('T')[0]}
              onDayPress={onCalendarDayPress}
              markedDates={{
                [pickupDate.toISOString().split('T')[0]]: {
                  selected: true,
                  selectedColor: BRAND_COLOR,
                }
              }}
              theme={{
                todayTextColor: BRAND_COLOR,
                selectedDayBackgroundColor: BRAND_COLOR,
                selectedDayTextColor: '#ffffff',
                arrowColor: BRAND_COLOR,
                monthTextColor: '#333',
                textDayFontWeight: '500',
                textMonthFontWeight: 'bold',
                textDayHeaderFontWeight: '600',
              }}
            />
          </View>
        </View>
      </Modal>

      {/* Time Pickers */}
      {showTimePicker && (
        <DateTimePicker
          value={pickupTime}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onTimeChange}
        />
      )}

      {showReturnTimePicker && (
        <DateTimePicker
          value={returnTime}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onReturnTimeChange}
        />
      )}

      {/* Address Input Modal */}
      <Modal
        visible={showAddressInput}
        animationType="slide"
        transparent={false}
        onRequestClose={() => {
          setShowAddressInput(false);
          setAddressInput('');
          setAddressSuggestions([]);
        }}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => {
                setShowAddressInput(false);
                setAddressInput('');
                setAddressSuggestions([]);
              }}
            >
              <Text style={styles.modalCancelButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {addressInputType === 'pickup' ? 'Pickup Address' : 'Destination Address'}
            </Text>
            <View style={{ width: 60 }} />
          </View>

          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Start typing an address..."
              placeholderTextColor="#999"
              value={addressInput}
              onChangeText={setAddressInput}
              autoFocus
              returnKeyType="search"
            />
          </View>

          {isLoadingSuggestions && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={BRAND_COLOR} />
            </View>
          )}

          <ScrollView style={styles.suggestionsContainer} keyboardShouldPersistTaps="handled">
            {addressSuggestions.map((suggestion) => (
              <TouchableOpacity
                key={suggestion.place_id}
                style={styles.suggestionItem}
                onPress={() => handleAddressSelect(suggestion)}
              >
                <View style={styles.suggestionIcon}>
                  <Ionicons name="location" size={20} color={BRAND_COLOR} />
                </View>
                <View style={styles.suggestionTextContainer}>
                  <Text style={styles.suggestionMainText}>
                    {suggestion.structured_formatting?.main_text || suggestion.description}
                  </Text>
                  <Text style={styles.suggestionSecondaryText}>
                    {suggestion.structured_formatting?.secondary_text || ''}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
            {addressSuggestions.length === 0 && addressInput.length >= 3 && !isLoadingSuggestions && (
              <View style={styles.noResultsContainer}>
                <Text style={styles.noResultsText}>No results found. Try a different search.</Text>
              </View>
            )}
          </ScrollView>
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
  statusCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    textTransform: 'uppercase',
  },
  tripId: {
    fontSize: 13,
    color: '#999',
  },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: '#FFF3E0',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: '#E65100',
    marginLeft: 10,
    lineHeight: 18,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
    marginTop: 8,
  },
  inputButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginBottom: 12,
  },
  inputButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputButtonText: {
    fontSize: 15,
    color: '#333',
    marginLeft: 10,
  },
  readOnlyField: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 12,
  },
  readOnlyText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 10,
    flex: 1,
    lineHeight: 20,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
    marginTop: 8,
  },
  infoText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
    flex: 1,
    lineHeight: 16,
  },
  textInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#333',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  bariatricNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    padding: 10,
    borderRadius: 6,
    marginTop: 8,
  },
  bariatricText: {
    fontSize: 12,
    color: '#E65100',
    marginLeft: 8,
    flex: 1,
  },
  heightRow: {
    flexDirection: 'row',
    gap: 12,
  },
  heightPicker: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  pickerContainer: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  picker: {
    height: 50,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  radioOptionActive: {
    borderColor: BRAND_COLOR,
    backgroundColor: '#F0F9FF',
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioActive: {
    borderColor: BRAND_COLOR,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: BRAND_COLOR,
  },
  radioLabel: {
    fontSize: 14,
    color: '#1F2937',
    flex: 1,
  },
  requirementsSection: {
    marginTop: 12,
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
  },
  requirementsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2E4F54',
    marginBottom: 12,
  },
  helpText: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
    fontStyle: 'italic',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  checkboxActive: {
    backgroundColor: BRAND_COLOR,
    borderColor: BRAND_COLOR,
  },
  checkmark: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#1F2937',
  },
  wheelchairFeeText: {
    fontSize: 12,
    color: '#10B981',
    marginTop: 4,
    fontWeight: '500',
  },
  radioOptionDisabled: {
    opacity: 0.6,
    backgroundColor: '#F9FAFB',
  },
  radioDisabled: {
    borderColor: '#9CA3AF',
    backgroundColor: '#F3F4F6',
  },
  radioLabelDisabled: {
    color: '#6B7280',
  },
  notAvailableText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
    marginTop: 2,
  },
  disabledReasonText: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 4,
    fontStyle: 'italic',
  },
  provideWheelchairSection: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  provideWheelchairTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0C4A6E',
    marginBottom: 12,
  },
  provideWheelchairSubtext: {
    fontSize: 13,
    color: '#475569',
    marginTop: 4,
    lineHeight: 18,
  },
  safetyNoticeBox: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  safetyNoticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  safetyNoticeTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#DC2626',
    marginLeft: 8,
  },
  safetyNoticeText: {
    fontSize: 13,
    color: '#7F1D1D',
    lineHeight: 20,
    marginBottom: 8,
  },
  safetyNoticePriority: {
    fontSize: 13,
    color: '#991B1B',
    fontWeight: '600',
    lineHeight: 18,
  },
  emergencyLabelContainer: {
    flex: 1,
  },
  emergencySubtext: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  textArea: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#333',
    textAlignVertical: 'top',
    minHeight: 100,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  pricingSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  calculatingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  calculatingText: {
    marginLeft: 10,
    fontSize: 15,
    color: '#666',
  },
  priceCard: {
    backgroundColor: BRAND_COLOR,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 12,
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
  pricingNote: {
    marginTop: 12,
    padding: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
  },
  pricingNoteText: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
  },
  saveButton: {
    flexDirection: 'row',
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  saveButtonDisabled: {
    backgroundColor: '#999',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  calendarContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: BRAND_COLOR,
  },
  calendarHeaderText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  // Address modal styles
  addressCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  addressValue: {
    fontSize: 15,
    color: '#1F2937',
    marginBottom: 6,
    marginTop: 4,
  },
  changeText: {
    fontSize: 13,
    color: BRAND_COLOR,
    fontWeight: '500',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
  },
  modalCancelButton: {
    fontSize: 16,
    color: BRAND_COLOR,
    width: 60,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2E4F54',
  },
  searchContainer: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  searchInput: {
    fontSize: 16,
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  suggestionsContainer: {
    flex: 1,
  },
  suggestionItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    alignItems: 'center',
  },
  suggestionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0F9FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  suggestionTextContainer: {
    flex: 1,
  },
  suggestionMainText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1F2937',
    marginBottom: 2,
  },
  suggestionSecondaryText: {
    fontSize: 13,
    color: '#6B7280',
  },
  noResultsContainer: {
    padding: 40,
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: 15,
    color: '#6B7280',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
});

export default EditTripScreen;
