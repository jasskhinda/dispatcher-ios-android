import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function Header({ title, onBack, showMessaging = true }) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  // If title and onBack are provided, show simple back header
  if (title && onBack) {
    return (
      <View style={[styles.headerContainer, { paddingTop: insets.top }]}>
        <View style={styles.simpleHeaderTop}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
          >
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{title}</Text>
          <View style={styles.headerSpacer} />
        </View>
      </View>
    );
  }

  // Default header with logo
  return (
    <View style={[styles.headerContainer, { paddingTop: insets.top }]}>
      <View style={styles.headerTop}>
        {/* Logo */}
        <View style={styles.headerLeft}>
          <Image
            source={require('../../assets/mainlogo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        {/* Message Icon */}
        {showMessaging && (
          <TouchableOpacity
            style={styles.messageButton}
            onPress={() => navigation.navigate('Messaging')}
          >
            <Text style={styles.messageIcon}>💬</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  simpleHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  backIcon: {
    fontSize: 28,
    color: '#5fbfc0',
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  headerSpacer: {
    width: 44, // Same width as back button to center title
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 150,
    height: 50,
  },
  messageButton: {
    padding: 8,
  },
  messageIcon: {
    fontSize: 24,
  },
});
