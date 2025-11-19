import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUnreadMessages } from '../contexts/UnreadMessagesContext';

export default function Header({ title, onBack, showMessaging = true }) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { unreadCount } = useUnreadMessages();

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
            <View style={styles.messageIconContainer}>
              <Text style={styles.messageIcon}>💬</Text>
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Text>
                </View>
              )}
            </View>
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
  messageIconContainer: {
    position: 'relative',
  },
  messageIcon: {
    fontSize: 24,
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
});
