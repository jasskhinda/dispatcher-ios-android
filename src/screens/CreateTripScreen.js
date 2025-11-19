import React, { useState, useEffect, useRef } from 'react';
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
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Calendar } from 'react-native-calendars';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import { supabase } from '../lib/supabase';
import { getPricingEstimate } from '../lib/pricing';
import Header from '../components/Header';

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

const BRAND_COLOR = '#5fbfc0';
const API_URL = process.env.EXPO_PUBLIC_API_URL;

const CreateTripScreen = ({ navigation }) => {
  const mapRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [calculatingPrice, setCalculatingPrice] = useState(false);

  // Client type selection
  const [clientType, setClientType] = useState('individual'); // 'individual' or 'facility'
  const [facilities, setFacilities] = useState([]);
  const [selectedFacility, setSelectedFacility] = useState(null);
  const [managedClients, setManagedClients] = useState([]);
  const [selectedManagedClient, setSelectedManagedClient] = useState(null);
  const [individualClients, setIndividualClients] = useState([]);
  const [selectedIndividualClient, setSelectedIndividualClient] = useState(null);

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
  const [addressInputType, setAddressInputType] = useState('pickup');
  const [addressInput, setAddressInput] = useState('');
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

  // Picker modals
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [showFacilityPicker, setShowFacilityPicker] = useState(false);
  const [showManagedClientPicker, setShowManagedClientPicker] = useState(false);

  // Client information (read-only for existing clients)
  const [clientWeight, setClientWeight] = useState('');
  const [clientHeightFeet, setClientHeightFeet] = useState('5');
  const [clientHeightInches, setClientHeightInches] = useState('0');

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
    fetchClients();
    fetchFacilities();
  }, []);

  useEffect(() => {
    if (clientType === 'facility' && selectedFacility) {
      fetchManagedClients(selectedFacility);
    }
  }, [selectedFacility]);

  // Recalculate price when relevant fields change
  useEffect(() => {
    if (pickupAddress && destinationAddress) {
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

  // Debounce address input
  useEffect(() => {
    if (addressInput && addressInput.length >= 3) {
      const timeoutId = setTimeout(() => {
        fetchAddressSuggestions(addressInput);
      }, 300);
      return () => clearTimeout(timeoutId);
    } else {
      setAddressSuggestions([]);
    }
  }, [addressInput]);

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'client')
        .order('first_name', { ascending: true });

      if (error) throw error;
      setIndividualClients(data || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  };

  const fetchFacilities = async () => {
    try {
      const { data, error } = await supabase
        .from('facilities')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setFacilities(data || []);
    } catch (error) {
      console.error('Error fetching facilities:', error);
    }
  };

  const fetchManagedClients = async (facilityId) => {
    try {
      const { data, error } = await supabase
        .from('facility_managed_clients')
        .select('*')
        .eq('facility_id', facilityId)
        .order('first_name', { ascending: true });

      if (error) throw error;
      setManagedClients(data || []);
    } catch (error) {
      console.error('Error fetching managed clients:', error);
    }
  };

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

  const getPlaceDetails = async (placeId) => {
    try {
      const url = `${API_URL}/api/maps/place-details?place_id=${placeId}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.result) {
        return {
          lat: data.result.geometry.location.lat,
          lng: data.result.geometry.location.lng,
          formatted_address: data.result.formatted_address,
        };
      }
    } catch (error) {
      console.error('Error getting place details:', error);
    }
    return null;
  };

  const handleSelectAddress = async (prediction) => {
    const placeDetails = await getPlaceDetails(prediction.place_id);

    if (placeDetails) {
      if (addressInputType === 'pickup') {
        setPickupAddress(placeDetails.formatted_address);
        setPickupCoords({ lat: placeDetails.lat, lng: placeDetails.lng });
      } else {
        setDestinationAddress(placeDetails.formatted_address);
        setDestinationCoords({ lat: placeDetails.lat, lng: placeDetails.lng });
      }
    }

    setShowAddressInput(false);
    setAddressInput('');
    setAddressSuggestions([]);
  };

  const calculatePricing = async () => {
    if (!pickupAddress || !destinationAddress || !clientWeight) return;

    setCalculatingPrice(true);
    try {
      const tripDateTime = new Date(pickupDate);
      tripDateTime.setHours(pickupTime.getHours());
      tripDateTime.setMinutes(pickupTime.getMinutes());

      // Calculate distance using Directions API (same as EditTripScreen)
      let calculatedDistance = 0;
      try {
        const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
        const directionsUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(pickupAddress)}&destination=${encodeURIComponent(destinationAddress)}&alternatives=true&mode=driving&units=imperial&departure_time=now&traffic_model=best_guess&key=${GOOGLE_MAPS_API_KEY}`;

        console.log('🌐 Fetching route from Google Directions API...');
        const response = await fetch(directionsUrl);
        const data = await response.json();

        if (data.status === 'OK' && data.routes && data.routes.length > 0) {
          // Find fastest route
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

      const pricingData = {
        pickupAddress,
        destinationAddress,
        pickupDateTime: tripDateTime.toISOString(),
        isRoundTrip,
        isEmergency,
        clientWeight: clientWeight ? parseFloat(clientWeight) : null,
        wheelchairType: wheelchairType === 'none' ? null : wheelchairType,
        additionalPassengers: parseInt(additionalPassengers) || 0,
        distance: calculatedDistance,
        clientType: clientType === 'facility' ? 'facility' : 'individual',
      };

      console.log('💰 Calculating pricing with:', pricingData);

      const result = await getPricingEstimate(pricingData);

      console.log('📊 Pricing result:', result);

      if (result.success && result.pricing) {
        // Add distance and county info to the breakdown
        const breakdownWithExtras = {
          ...result.pricing,
          distance: calculatedDistance,
          countyInfo: result.countyInfo,
          wheelchairInfo: {
            type: wheelchairType,
            requirements: wheelchairRequirements,
            details: wheelchairDetails,
          },
        };
        setPricingBreakdown(breakdownWithExtras);
        setEstimatedPrice(result.pricing.total);
      } else {
        console.error('Pricing calculation error:', result.error);
      }
    } catch (error) {
      console.error('Error calculating pricing:', error);
    } finally {
      setCalculatingPrice(false);
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

  const fitMapToRoute = (pickup, destination) => {
    if (mapRef.current && pickup && destination) {
      mapRef.current.fitToCoordinates([pickup, destination], {
        edgePadding: {
          top: 100,
          right: 50,
          bottom: 50,
          left: 50,
        },
        animated: true,
      });
    }
  };

  const onCalendarDayPress = (day) => {
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

  const handleSave = async () => {
    // Validation
    if (clientType === 'individual' && !selectedIndividualClient) {
      Alert.alert('Error', 'Please select an individual client');
      return;
    }

    if (clientType === 'facility' && (!selectedFacility || !selectedManagedClient)) {
      Alert.alert('Error', 'Please select a facility and client');
      return;
    }

    if (!pickupAddress || !destinationAddress) {
      Alert.alert('Error', 'Please enter pickup and destination addresses');
      return;
    }

    if (!estimatedPrice) {
      Alert.alert('Error', 'Price calculation failed. Please try again.');
      return;
    }

    setSaving(true);
    try {
      const tripDateTime = new Date(pickupDate);
      tripDateTime.setHours(pickupTime.getHours());
      tripDateTime.setMinutes(pickupTime.getMinutes());

      const returnDateTime = isRoundTrip ? new Date(pickupDate) : null;
      if (returnDateTime) {
        returnDateTime.setHours(returnTime.getHours());
        returnDateTime.setMinutes(returnTime.getMinutes());
      }

      const tripData = {
        pickup_address: pickupAddress,
        destination_address: destinationAddress,
        pickup_time: tripDateTime.toISOString(),
        return_time: returnDateTime?.toISOString() || null,
        is_round_trip: isRoundTrip,
        passenger_name: clientType === 'individual'
          ? `${selectedIndividualClient.first_name} ${selectedIndividualClient.last_name}`
          : `${selectedManagedClient.first_name} ${selectedManagedClient.last_name}`,
        passenger_phone: clientType === 'individual'
          ? selectedIndividualClient.phone_number
          : selectedManagedClient.phone_number,
        wheelchair_accessible: wheelchairType !== 'none',
        wheelchair_type: wheelchairType === 'none' ? null : wheelchairType,
        wheelchair_details: wheelchairDetails || null,
        estimated_price: estimatedPrice,
        pricing_breakdown: pricingBreakdown,
        notes: tripNotes || null,
        is_emergency: isEmergency,
        additional_passengers: parseInt(additionalPassengers) || 0,
        status: 'pending',
        created_at: new Date().toISOString(),
      };

      if (clientType === 'individual') {
        tripData.user_id = selectedIndividualClient.id;
      } else {
        tripData.facility_id = selectedFacility;
        tripData.managed_client_id = selectedManagedClient.id;
      }

      const { data, error } = await supabase
        .from('trips')
        .insert([tripData])
        .select()
        .single();

      if (error) throw error;

      // Send notification to dispatchers about new trip
      try {
        await fetch(`${API_URL}/api/notifications/send-dispatcher-push`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tripId: data.id,
            action: 'created',
            source: clientType === 'facility' ? 'facility_app' : 'booking_app',
            tripDetails: {
              pickup_address: pickupAddress,
              destination_address: destinationAddress,
              pickup_time: tripDateTime.toISOString(),
            },
          }),
        });
      } catch (notifError) {
        console.error('Failed to send notification:', notifError);
      }

      Alert.alert('Success', 'Trip created successfully', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      console.error('Error creating trip:', error);
      Alert.alert('Error', 'Failed to create trip');
    } finally {
      setSaving(false);
    }
  };

  // ... (rest of the component with UI will be added in next part)

  return (
    <View style={styles.container}>
      <Header
        title="Create New Trip"
        onBack={() => navigation.goBack()}
        showMessaging={false}
      />
      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          <Text style={styles.sectionTitle}>Client Type</Text>
          <View style={styles.clientTypeSelector}>
            <TouchableOpacity
              style={[styles.typeButton, clientType === 'individual' && styles.typeButtonActive]}
              onPress={() => setClientType('individual')}
            >
              <Text style={[styles.typeButtonText, clientType === 'individual' && styles.typeButtonTextActive]}>
                Individual Client
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeButton, clientType === 'facility' && styles.typeButtonActive]}
              onPress={() => setClientType('facility')}
            >
              <Text style={[styles.typeButtonText, clientType === 'facility' && styles.typeButtonTextActive]}>
                Facility Client
              </Text>
            </TouchableOpacity>
          </View>

          {/* Client Selection */}
          {clientType === 'individual' ? (
            <View style={styles.formGroup}>
              <Text style={styles.label}>Select Client</Text>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => setShowClientPicker(true)}
              >
                <Text style={selectedIndividualClient ? styles.pickerButtonText : styles.pickerButtonPlaceholder}>
                  {selectedIndividualClient
                    ? `${selectedIndividualClient.first_name} ${selectedIndividualClient.last_name}`
                    : 'Select a client...'}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#666" />
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Select Facility</Text>
                <TouchableOpacity
                  style={styles.pickerButton}
                  onPress={() => setShowFacilityPicker(true)}
                >
                  <Text style={selectedFacility ? styles.pickerButtonText : styles.pickerButtonPlaceholder}>
                    {selectedFacility
                      ? facilities.find(f => f.id === selectedFacility)?.name
                      : 'Select a facility...'}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color="#666" />
                </TouchableOpacity>
              </View>

              {selectedFacility && (
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Select Client</Text>
                  <TouchableOpacity
                    style={styles.pickerButton}
                    onPress={() => setShowManagedClientPicker(true)}
                  >
                    <Text style={selectedManagedClient ? styles.pickerButtonText : styles.pickerButtonPlaceholder}>
                      {selectedManagedClient
                        ? `${selectedManagedClient.first_name} ${selectedManagedClient.last_name}`
                        : 'Select a client...'}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color="#666" />
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}

          {/* Addresses */}
          <Text style={styles.sectionTitle}>Trip Details</Text>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Pickup Address</Text>
            <TouchableOpacity
              style={styles.addressButton}
              onPress={() => {
                setAddressInputType('pickup');
                setAddressInput(pickupAddress);
                setShowAddressInput(true);
              }}
            >
              <Text style={pickupAddress ? styles.addressText : styles.addressPlaceholder}>
                {pickupAddress || 'Enter pickup address'}
              </Text>
              <Ionicons name="location" size={20} color={BRAND_COLOR} />
            </TouchableOpacity>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Destination Address</Text>
            <TouchableOpacity
              style={styles.addressButton}
              onPress={() => {
                setAddressInputType('destination');
                setAddressInput(destinationAddress);
                setShowAddressInput(true);
              }}
            >
              <Text style={destinationAddress ? styles.addressText : styles.addressPlaceholder}>
                {destinationAddress || 'Enter destination address'}
              </Text>
              <Ionicons name="location" size={20} color={BRAND_COLOR} />
            </TouchableOpacity>
          </View>

          {/* Route Overview Map */}
          {pickupCoords && destinationCoords && (
            <View style={styles.mapSection}>
              <Text style={styles.sectionTitle}>🗺️ Route Overview</Text>
              <View style={styles.mapContainer}>
                <MapView
                  ref={mapRef}
                  provider={PROVIDER_GOOGLE}
                  style={styles.map}
                  initialRegion={{
                    latitude: 39.9612,
                    longitude: -82.9988,
                    latitudeDelta: 0.5,
                    longitudeDelta: 0.5,
                  }}
                >
                  <Marker
                    coordinate={pickupCoords}
                    title="Pickup"
                    pinColor="green"
                  />
                  <Marker
                    coordinate={destinationCoords}
                    title="Destination"
                    pinColor="red"
                  />
                  {GOOGLE_MAPS_API_KEY && (
                    <MapViewDirections
                      origin={pickupCoords}
                      destination={destinationCoords}
                      apikey={GOOGLE_MAPS_API_KEY}
                      strokeWidth={4}
                      strokeColor={BRAND_COLOR}
                      mode="DRIVING"
                      onReady={() => {
                        fitMapToRoute(pickupCoords, destinationCoords);
                      }}
                      onError={(errorMessage) => {
                        console.warn('MapViewDirections Error:', errorMessage);
                        // Silently fail - map will still show markers
                      }}
                    />
                  )}
                </MapView>
              </View>
            </View>
          )}

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

          {/* Round Trip Section */}
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
              <Text style={styles.sectionTitle}>💰 Price Estimate</Text>

              {calculatingPrice ? (
                <View style={styles.calculatingBox}>
                  <ActivityIndicator size="small" color={BRAND_COLOR} />
                  <Text style={styles.calculatingText}>Calculating price...</Text>
                </View>
              ) : (
                <>
                  <View style={styles.priceCard}>
                    <Text style={styles.priceLabel}>
                      {isRoundTrip ? 'Round Trip' : 'One Way'} • {pricingBreakdown?.distance?.toFixed(1) || '0.0'} miles
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
                            Base fare ({isRoundTrip ? '2' : '1'} leg)
                          </Text>
                          <Text style={styles.breakdownValue}>
                            {formatCurrency(pricingBreakdown.basePrice + (pricingBreakdown.roundTripPrice || 0))}
                          </Text>
                        </View>
                      )}

                      {pricingBreakdown.distancePrice > 0 && (
                        <View style={styles.breakdownRow}>
                          <Text style={styles.breakdownLabel}>Distance charge</Text>
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
                          <Text style={styles.breakdownLabel}>Dead mileage</Text>
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
                          {formatCurrency(pricingBreakdown.total || estimatedPrice)}
                        </Text>
                      </View>
                    </View>
                  )}
                </>
              )}
            </View>
          )}

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={24} color="#fff" />
                <Text style={styles.saveButtonText}>Create Trip</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Address Input Modal */}
      <Modal
        visible={showAddressInput}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {addressInputType === 'pickup' ? 'Pickup Address' : 'Destination Address'}
            </Text>
            <TouchableOpacity onPress={() => setShowAddressInput(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.addressInput}
            placeholder="Start typing address..."
            value={addressInput}
            onChangeText={setAddressInput}
            autoFocus
          />

          {isLoadingSuggestions && (
            <ActivityIndicator style={styles.loader} color={BRAND_COLOR} />
          )}

          <ScrollView style={styles.suggestionsList}>
            {addressSuggestions.map((suggestion) => (
              <TouchableOpacity
                key={suggestion.place_id}
                style={styles.suggestionItem}
                onPress={() => handleSelectAddress(suggestion)}
              >
                <Ionicons name="location-outline" size={20} color="#666" />
                <Text style={styles.suggestionText}>{suggestion.description}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Client Picker Modal */}
      <Modal
        visible={showClientPicker}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Client</Text>
            <TouchableOpacity onPress={() => setShowClientPicker(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.suggestionsList}>
            {individualClients.map((client) => (
              <TouchableOpacity
                key={client.id}
                style={styles.suggestionItem}
                onPress={() => {
                  setSelectedIndividualClient(client);
                  if (client.weight) {
                    setClientWeight(client.weight.toString());
                  }
                  setShowClientPicker(false);
                }}
              >
                <Ionicons name="person-outline" size={20} color="#666" />
                <Text style={styles.suggestionText}>
                  {client.first_name} {client.last_name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Facility Picker Modal */}
      <Modal
        visible={showFacilityPicker}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Facility</Text>
            <TouchableOpacity onPress={() => setShowFacilityPicker(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.suggestionsList}>
            {facilities.map((facility) => (
              <TouchableOpacity
                key={facility.id}
                style={styles.suggestionItem}
                onPress={() => {
                  setSelectedFacility(facility.id);
                  setSelectedManagedClient(null);
                  setShowFacilityPicker(false);
                }}
              >
                <Ionicons name="business-outline" size={20} color="#666" />
                <Text style={styles.suggestionText}>{facility.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Managed Client Picker Modal */}
      <Modal
        visible={showManagedClientPicker}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Client</Text>
            <TouchableOpacity onPress={() => setShowManagedClientPicker(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.suggestionsList}>
            {managedClients.map((client) => (
              <TouchableOpacity
                key={client.id}
                style={styles.suggestionItem}
                onPress={() => {
                  setSelectedManagedClient(client);
                  if (client.weight) {
                    setClientWeight(client.weight.toString());
                  }
                  setShowManagedClientPicker(false);
                }}
              >
                <Ionicons name="person-outline" size={20} color="#666" />
                <Text style={styles.suggestionText}>
                  {client.first_name} {client.last_name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>

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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginTop: 20,
    marginBottom: 12,
  },
  clientTypeSelector: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  typeButtonActive: {
    backgroundColor: BRAND_COLOR,
    borderColor: BRAND_COLOR,
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  typeButtonTextActive: {
    color: '#fff',
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  pickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  pickerButtonText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  pickerButtonPlaceholder: {
    flex: 1,
    fontSize: 16,
    color: '#999',
  },
  addressButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  addressText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  addressPlaceholder: {
    flex: 1,
    fontSize: 14,
    color: '#999',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BRAND_COLOR,
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 24,
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
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
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  cancelText: {
    fontSize: 16,
    color: BRAND_COLOR,
    fontWeight: '600',
  },
  addressInput: {
    padding: 16,
    fontSize: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  loader: {
    padding: 16,
  },
  suggestionsList: {
    flex: 1,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  suggestionText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    marginLeft: 12,
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
  textInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#333',
    borderWidth: 1,
    borderColor: '#e0e0e0',
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
  emergencyLabelContainer: {
    flex: 1,
  },
  emergencySubtext: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
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
  mapSection: {
    marginBottom: 16,
  },
  mapContainer: {
    height: 250,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  map: {
    width: '100%',
    height: '100%',
  },
});

export default CreateTripScreen;
