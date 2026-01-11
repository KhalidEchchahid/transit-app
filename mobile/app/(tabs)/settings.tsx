import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Alert, TextInput, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { useHealth } from '@/hooks/useTransport';
import { useAnonymousAuth } from '@/lib/AnonymousAuthContext';
import { Button, Card, Badge, Switch, Accordion } from '@/components/ui';

function SettingsScreen() {
  const { theme, isDark, toggleTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const { data: health } = useHealth();
  const { user, logout, getStoredCredentials, credentials, clearCredentialsDisplay } = useAnonymousAuth();
  
  const [showCredentials, setShowCredentials] = useState(false);
  const [storedCreds, setStoredCreds] = useState<{ uuid: string; passkey: string } | null>(null);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoreUuid, setRestoreUuid] = useState('');
  const [restorePasskey, setRestorePasskey] = useState('');
  const { login } = useAnonymousAuth();

  // Load stored credentials for display
  const handleShowCredentials = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const creds = await getStoredCredentials();
    setStoredCreds(creds);
    setShowCredentials(true);
  }, [getStoredCredentials]);

  const handleCopyCredentials = useCallback(async () => {
    if (storedCreds) {
      const text = `UUID: ${storedCreds.uuid}\nPasskey: ${storedCreds.passkey}`;
      // Using Share API since Clipboard requires additional package
      Alert.alert(
        'Your Credentials',
        `Save these somewhere safe!\n\n${text}`,
        [{ text: 'OK' }]
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [storedCreds]);

  const handleRestore = useCallback(async () => {
    if (!restoreUuid.trim() || !restorePasskey.trim()) {
      Alert.alert('Error', 'Please enter both UUID and passkey');
      return;
    }
    
    try {
      await login(restoreUuid.trim(), restorePasskey.trim());
      setShowRestoreModal(false);
      setRestoreUuid('');
      setRestorePasskey('');
      Alert.alert('Success', 'Account restored successfully!');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      Alert.alert('Error', 'Invalid credentials. Please check and try again.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [restoreUuid, restorePasskey, login]);

  const handleToggleTheme = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    toggleTheme();
  }, [toggleTheme]);

  const handleOpenGithub = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL('https://github.com/eamonamkassou/morocco_transport');
  }, []);

  const handleOpenIssue = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL('https://github.com/eamonamkassou/morocco_transport/issues/new');
  }, []);

  const handleLogout = useCallback(() => {
    Alert.alert(
      'Reset Account',
      'This will clear your anonymous account from this device. Make sure you have saved your credentials if you want to restore it later!',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Reset', 
          style: 'destructive',
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            await logout();
          }
        },
      ]
    );
  }, [logout]);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      paddingTop: insets.top,
      paddingHorizontal: theme.spacing[4],
      paddingBottom: theme.spacing[4],
      backgroundColor: theme.colors.muted,
      borderBottomWidth: theme.borderWidths.thick,
      borderBottomColor: theme.colors.border,
    },
    headerTitle: {
      fontFamily: theme.typography.fonts.heading,
      fontSize: theme.typography.sizes['2xl'],
      color: theme.colors.foreground,
      textTransform: 'uppercase',
      letterSpacing: theme.typography.letterSpacing.wider,
    },
    scrollContent: {
      padding: theme.spacing[4],
      paddingBottom: insets.bottom + theme.spacing[4],
      gap: theme.spacing[4],
    },
    sectionTitle: {
      fontFamily: theme.typography.fonts.heading,
      fontSize: theme.typography.sizes.lg,
      color: theme.colors.foreground,
      textTransform: 'uppercase',
      letterSpacing: theme.typography.letterSpacing.wide,
      marginBottom: theme.spacing[2],
    },
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: theme.spacing[2],
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.muted,
    },
    settingLabel: {
      fontFamily: theme.typography.fonts.regular,
      fontSize: theme.typography.sizes.base,
      color: theme.colors.foreground,
    },
    settingDescription: {
      fontFamily: theme.typography.fonts.regular,
      fontSize: theme.typography.sizes.sm,
      color: theme.colors.mutedForeground,
      marginTop: theme.spacing[1],
    },
    brandBlock: {
      alignItems: 'center',
      padding: theme.spacing[6],
      gap: theme.spacing[2],
    },
    brandTitle: {
      fontFamily: theme.typography.fonts.heading,
      fontSize: theme.typography.sizes['3xl'],
      color: theme.colors.primary,
      textTransform: 'uppercase',
      letterSpacing: theme.typography.letterSpacing.widest,
    },
    version: {
      fontFamily: theme.typography.fonts.regular,
      fontSize: theme.typography.sizes.sm,
      color: theme.colors.mutedForeground,
    },
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Appearance Section */}
        <View>
          <Text style={styles.sectionTitle}>Appearance</Text>
          <Card>
            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>Dark Mode</Text>
                <Text style={styles.settingDescription}>
                  Switch between light and dark themes
                </Text>
              </View>
              <Switch
                value={isDark}
                onValueChange={handleToggleTheme}
                accessibilityLabel="Toggle dark mode"
              />
            </View>
          </Card>
        </View>

        {/* System Status */}
        <View>
          <Text style={styles.sectionTitle}>System Status</Text>
          <Card>
            <View style={{ gap: theme.spacing[3] }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] }}>
                <View
                  style={{
                    width: 12,
                    height: 12,
                    backgroundColor: health?.status === 'ok' 
                      ? theme.colors.modes.busway 
                      : theme.colors.destructive,
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                  }}
                />
                <Text style={styles.settingLabel}>
                  API Status: {health?.status === 'ok' ? 'Connected' : 'Disconnected'}
                </Text>
              </View>
              
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] }}>
                <View
                  style={{
                    width: 12,
                    height: 12,
                    backgroundColor: health?.db === 'connected' 
                      ? theme.colors.modes.busway 
                      : theme.colors.destructive,
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                  }}
                />
                <Text style={styles.settingLabel}>
                  Database: {health?.db === 'connected' ? 'Connected' : 'Disconnected'}
                </Text>
              </View>
            </View>
          </Card>
        </View>

        {/* About Section */}
        <View>
          <Text style={styles.sectionTitle}>About</Text>
          <Accordion>
            <Accordion.Item
              title="What is Casa Transit?"
              icon={<Ionicons name="information-circle" size={20} color={theme.colors.foreground} />}
            >
              <Text style={styles.settingDescription}>
                Casa Transit is an open-source public transit app for Casablanca, Morocco.
                It provides real-time journey planning across bus, tram, busway, and train networks.
              </Text>
            </Accordion.Item>

            <Accordion.Item
              title="Data Sources"
              icon={<Ionicons name="server" size={20} color={theme.colors.foreground} />}
            >
              <Text style={styles.settingDescription}>
                Transit data is sourced from official operators and OpenStreetMap.
                Route planning uses the RAPTOR algorithm for optimal journey calculation.
              </Text>
            </Accordion.Item>

            <Accordion.Item
              title="Contribute"
              icon={<Ionicons name="git-branch" size={20} color={theme.colors.foreground} />}
            >
              <Text style={[styles.settingDescription, { marginBottom: theme.spacing[3] }]}>
                Help improve Casa Transit by contributing code, reporting issues,
                or adding missing transit data (especially Grand Taxi routes!).
              </Text>
              <Button variant="ghost" size="sm" onPress={handleOpenGithub}>
                View on GitHub
              </Button>
            </Accordion.Item>
          </Accordion>
        </View>

        {/* Actions */}
        <View style={{ gap: theme.spacing[3] }}>
          <Button variant="muted" onPress={handleOpenIssue} block>
            Report an Issue
          </Button>
          <Button variant="accent" onPress={handleOpenGithub} block>
            Contribute on GitHub
          </Button>
        </View>

        {/* Account Section */}
        <View>
          <Text style={styles.sectionTitle}>Account</Text>
          <Card>
            <View style={{ gap: theme.spacing[3] }}>
              {user && (
                <View style={{ gap: theme.spacing[2] }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] }}>
                    <Ionicons name="finger-print" size={40} color={theme.colors.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.settingLabel}>Anonymous Account</Text>
                      <Text style={[styles.settingDescription, { fontSize: 10 }]} numberOfLines={1}>
                        ID: {user.uuid.substring(0, 8)}...
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.settingDescription, { marginTop: theme.spacing[2] }]}>
                    Your account is anonymous - no personal data is collected. 
                    Save your credentials to restore access on other devices.
                  </Text>
                </View>
              )}
              
              <Button variant="accent" onPress={handleShowCredentials} block>
                View My Credentials
              </Button>
              
              <Button variant="muted" onPress={() => setShowRestoreModal(true)} block>
                Restore Account on This Device
              </Button>
              
              <Button variant="destructive" onPress={handleLogout} block>
                Reset Account
              </Button>
            </View>
          </Card>
        </View>

        {/* Credentials Display Modal */}
        {showCredentials && storedCreds && (
          <Modal
            visible={showCredentials}
            transparent
            animationType="fade"
            onRequestClose={() => setShowCredentials(false)}
          >
            <View style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.8)',
              justifyContent: 'center',
              alignItems: 'center',
              padding: theme.spacing[4],
            }}>
              <Card style={{ width: '100%', maxWidth: 400 }}>
                <View style={{ gap: theme.spacing[4] }}>
                  <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>
                    Your Credentials
                  </Text>
                  <Text style={styles.settingDescription}>
                    ⚠️ Save these somewhere safe! You'll need them to restore your account on another device.
                  </Text>
                  
                  <View style={{ gap: theme.spacing[2] }}>
                    <Text style={styles.settingLabel}>UUID:</Text>
                    <Text style={[styles.settingDescription, { 
                      fontFamily: theme.typography.fonts.regular,
                      backgroundColor: theme.colors.muted,
                      padding: theme.spacing[2],
                    }]} selectable>
                      {storedCreds.uuid}
                    </Text>
                  </View>
                  
                  <View style={{ gap: theme.spacing[2] }}>
                    <Text style={styles.settingLabel}>Passkey:</Text>
                    <Text style={[styles.settingDescription, { 
                      fontFamily: theme.typography.fonts.regular,
                      backgroundColor: theme.colors.muted,
                      padding: theme.spacing[2],
                    }]} selectable>
                      {storedCreds.passkey}
                    </Text>
                  </View>
                  
                  <Button variant="accent" onPress={handleCopyCredentials} block>
                    Show Full Credentials
                  </Button>
                  <Button variant="muted" onPress={() => setShowCredentials(false)} block>
                    Close
                  </Button>
                </View>
              </Card>
            </View>
          </Modal>
        )}

        {/* Restore Account Modal */}
        <Modal
          visible={showRestoreModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowRestoreModal(false)}
        >
          <View style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.8)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: theme.spacing[4],
          }}>
            <Card style={{ width: '100%', maxWidth: 400 }}>
              <View style={{ gap: theme.spacing[4] }}>
                <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>
                  Restore Account
                </Text>
                <Text style={styles.settingDescription}>
                  Enter your credentials to restore your account on this device.
                </Text>
                
                <View style={{ gap: theme.spacing[2] }}>
                  <Text style={styles.settingLabel}>UUID:</Text>
                  <TextInput
                    style={{
                      borderWidth: theme.borderWidths.base,
                      borderColor: theme.colors.border,
                      padding: theme.spacing[3],
                      fontFamily: theme.typography.fonts.regular,
                      color: theme.colors.foreground,
                      backgroundColor: theme.colors.background,
                    }}
                    value={restoreUuid}
                    onChangeText={setRestoreUuid}
                    placeholder="Enter your UUID"
                    placeholderTextColor={theme.colors.mutedForeground}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
                
                <View style={{ gap: theme.spacing[2] }}>
                  <Text style={styles.settingLabel}>Passkey:</Text>
                  <TextInput
                    style={{
                      borderWidth: theme.borderWidths.base,
                      borderColor: theme.colors.border,
                      padding: theme.spacing[3],
                      fontFamily: theme.typography.fonts.regular,
                      color: theme.colors.foreground,
                      backgroundColor: theme.colors.background,
                    }}
                    value={restorePasskey}
                    onChangeText={setRestorePasskey}
                    placeholder="Enter your passkey"
                    placeholderTextColor={theme.colors.mutedForeground}
                    autoCapitalize="none"
                    autoCorrect={false}
                    secureTextEntry
                  />
                </View>
                
                <Button variant="accent" onPress={handleRestore} block>
                  Restore Account
                </Button>
                <Button variant="muted" onPress={() => {
                  setShowRestoreModal(false);
                  setRestoreUuid('');
                  setRestorePasskey('');
                }} block>
                  Cancel
                </Button>
              </View>
            </Card>
          </View>
        </Modal>

        {/* Brand */}
        <View style={styles.brandBlock}>
          <Text style={styles.brandTitle}>Casa Transit</Text>
          <Text style={styles.version}>Version 1.0.0</Text>
          <Badge tone="accent">Open Source</Badge>
        </View>
      </ScrollView>
    </View>
  );
}

export default SettingsScreen;
