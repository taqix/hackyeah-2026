import { BricolageGrotesque_400Regular } from '@expo-google-fonts/bricolage-grotesque/400Regular';
import { BricolageGrotesque_600SemiBold } from '@expo-google-fonts/bricolage-grotesque/600SemiBold';
import { BricolageGrotesque_700Bold } from '@expo-google-fonts/bricolage-grotesque/700Bold';
import { HankenGrotesk_400Regular } from '@expo-google-fonts/hanken-grotesk/400Regular';
import { HankenGrotesk_400Regular_Italic } from '@expo-google-fonts/hanken-grotesk/400Regular_Italic';
import { HankenGrotesk_500Medium } from '@expo-google-fonts/hanken-grotesk/500Medium';
import { HankenGrotesk_600SemiBold } from '@expo-google-fonts/hanken-grotesk/600SemiBold';
import { HankenGrotesk_700Bold } from '@expo-google-fonts/hanken-grotesk/700Bold';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider as NavigationThemeProvider,
  Stack,
  type Theme as NavigationTheme,
} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { apiConfig } from '@/api/config';
import { queryClient } from '@/api/query-client';
import { AuthSessionSync } from '@/features/auth/session-sync';
import { SetupScreen } from '@/features/setup/setup-screen';
import { fontFamily, ThemeProvider, useTheme } from '@/theme';

void SplashScreen.preventAutoHideAsync();

/** A Supabase build without its URL or key shows the setup screen, never the mock. */
const needsSetup = apiConfig.mode === 'supabase' && !apiConfig.configured;

// Every weight is its own family on native: register exactly the names in tokens.
const FONTS = {
  [fontFamily.displayRegular]: BricolageGrotesque_400Regular,
  [fontFamily.displaySemibold]: BricolageGrotesque_600SemiBold,
  [fontFamily.displayBold]: BricolageGrotesque_700Bold,
  [fontFamily.bodyRegular]: HankenGrotesk_400Regular,
  [fontFamily.bodyItalic]: HankenGrotesk_400Regular_Italic,
  [fontFamily.bodyMedium]: HankenGrotesk_500Medium,
  [fontFamily.bodySemibold]: HankenGrotesk_600SemiBold,
  [fontFamily.bodyBold]: HankenGrotesk_700Bold,
};

export default function RootLayout() {
  const [loaded, error] = useFonts(FONTS);

  useEffect(() => {
    if (loaded || error) void SplashScreen.hideAsync();
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            {needsSetup ? (
              <SetupScreen missing={apiConfig.missing} />
            ) : (
              <>
                <AuthSessionSync />
                <RootNavigator />
              </>
            )}
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator() {
  const { scheme, colors } = useTheme();
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navigationTheme: NavigationTheme = {
    ...base,
    colors: {
      ...base.colors,
      background: colors.bgApp,
      card: colors.bgApp,
      text: colors.textPrimary,
      border: colors.borderSubtle,
      primary: colors.accent,
      notification: colors.danger,
    },
  };

  return (
    <NavigationThemeProvider value={navigationTheme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bgApp } }}>
        <Stack.Screen name="index" options={{ animation: 'none' }} />
        <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
        <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen
          name="coach"
          options={{ presentation: Platform.OS === 'android' ? 'modal' : 'fullScreenModal' }}
        />
        <Stack.Screen name="feedback/[logId]" options={{ presentation: 'modal' }} />
        <Stack.Screen
          name="gym/[sessionId]"
          options={{ presentation: 'fullScreenModal', gestureEnabled: false }}
        />
      </Stack>
    </NavigationThemeProvider>
  );
}
