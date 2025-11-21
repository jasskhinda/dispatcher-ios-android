import React, { useEffect, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../hooks/useAuth';
import { setupNotificationListeners, cleanupNotificationListeners } from '../services/notificationService';

// Screens
import LoginScreen from '../screens/LoginScreen';
import DashboardScreen from '../screens/DashboardScreen';
import AllTripsScreen from '../screens/AllTripsScreen';
import FacilityTripsScreen from '../screens/FacilityTripsScreen';
import IndividualTripsScreen from '../screens/IndividualTripsScreen';
import FacilityOverviewScreen from '../screens/FacilityOverviewScreen';
import FacilityMonthlyInvoiceScreen from '../screens/FacilityMonthlyInvoiceScreen';
import TripDetailsScreen from '../screens/TripDetailsScreen';
import EditTripScreen from '../screens/EditTripScreen';
import CreateTripScreen from '../screens/CreateTripScreen';
import DriversScreen from '../screens/DriversScreen';
import ProfileScreen from '../screens/ProfileScreen';
import MessagingScreen from '../screens/MessagingScreen';
import NotificationsScreen from '../screens/NotificationsScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Brand color
const BRAND_COLOR = '#5fbfc0';
const INACTIVE_COLOR = '#1a1a1a';

const AuthStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Login" component={LoginScreen} />
  </Stack.Navigator>
);

const HomeTabs = () => {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: BRAND_COLOR,
        tabBarInactiveTintColor: INACTIVE_COLOR,
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopColor: '#e0e0e0',
          borderTopWidth: 1,
          paddingBottom: insets.bottom,
          paddingTop: 8,
          height: 70 + insets.bottom,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          marginTop: 4,
        },
        tabBarItemStyle: {
          paddingVertical: 4,
        },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({ color, focused }) => {
            const isFocused = Boolean(focused);
            return (
              <Ionicons
                name={isFocused ? 'grid' : 'grid-outline'}
                size={24}
                color={color}
              />
            );
          },
        }}
      />
      <Tab.Screen
        name="FacilityOverview"
        component={FacilityOverviewScreen}
        options={{
          tabBarLabel: 'Facilities',
          tabBarIcon: ({ color, focused }) => {
            const isFocused = Boolean(focused);
            return (
              <Ionicons
                name={isFocused ? 'business' : 'business-outline'}
                size={24}
                color={color}
              />
            );
          },
        }}
      />
      <Tab.Screen
        name="AllTrips"
        component={AllTripsScreen}
        options={{
          tabBarLabel: 'Trips',
          tabBarIcon: ({ color, focused }) => {
            const isFocused = Boolean(focused);
            return (
              <Ionicons
                name={isFocused ? 'car' : 'car-outline'}
                size={24}
                color={color}
              />
            );
          },
        }}
      />
      <Tab.Screen
        name="IndividualTrips"
        component={IndividualTripsScreen}
        options={{
          tabBarLabel: 'Individual',
          tabBarIcon: ({ color, focused }) => {
            const isFocused = Boolean(focused);
            return (
              <Ionicons
                name={isFocused ? 'person' : 'person-outline'}
                size={24}
                color={color}
              />
            );
          },
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, focused }) => {
            const isFocused = Boolean(focused);
            return (
              <Ionicons
                name={isFocused ? 'settings' : 'settings-outline'}
                size={24}
                color={color}
              />
            );
          },
        }}
      />
    </Tab.Navigator>
  );
};

const AppStack = () => (
  <Stack.Navigator>
    <Stack.Screen
      name="HomeTabs"
      component={HomeTabs}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="FacilityTrips"
      component={FacilityTripsScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="FacilityMonthlyInvoice"
      component={FacilityMonthlyInvoiceScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="TripDetails"
      component={TripDetailsScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="EditTrip"
      component={EditTripScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="CreateTrip"
      component={CreateTripScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="Messaging"
      component={MessagingScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="Notifications"
      component={NotificationsScreen}
      options={{ headerShown: false }}
    />
  </Stack.Navigator>
);

const AppNavigator = () => {
  const { user, loading } = useAuth();
  const isLoading = Boolean(loading);
  const navigationRef = useRef(null);
  const listenersRef = useRef(null);

  // Set up notification listeners when user is authenticated
  useEffect(() => {
    if (user && navigationRef.current) {
      listenersRef.current = setupNotificationListeners(navigationRef.current);
      console.log('📱 Notification listeners set up');

      return () => {
        if (listenersRef.current) {
          cleanupNotificationListeners(listenersRef.current);
          console.log('📱 Notification listeners cleaned up');
        }
      };
    }
  }, [user]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={BRAND_COLOR} />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      {user ? <AppStack /> : <AuthStack />}
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
});

export default AppNavigator;
