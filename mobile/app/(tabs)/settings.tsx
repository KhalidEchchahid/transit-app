import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { useHealth } from '@/hooks/useTransport';
import { useAuth } from '@/lib/AuthContext';
import { Button, Card, Badge, Switch, Accordion } from '@/components/ui';

function SettingsScreen() {
  const { theme, isDark, toggleTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const { data: health } = useHealth();
  const { user, signOut } = useAuth();

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
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Sign Out', 
          style: 'destructive',
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            await signOut();
          }
        },
      ]
    );
  }, [signOut]);

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
                    <Ionicons name="person-circle" size={40} color={theme.colors.primary} />
                    <View>
                      <Text style={styles.settingLabel}>{user.name}</Text>
                      <Text style={styles.settingDescription}>{user.email}</Text>
                    </View>
                  </View>
                </View>
              )}
              <Button variant="destructive" onPress={handleLogout} block>
                Sign Out
              </Button>
            </View>
          </Card>
        </View>

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
