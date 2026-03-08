/**
 * AeroChat — Main Application
 *
 * Offline acoustic mesh network.
 * Top: waterfall spectrogram (18kHz–20kHz)
 * Bottom: terminal chat log + input
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StatusBar,
  StyleSheet,
  SafeAreaView,
  Pressable,
  PermissionsAndroid,
  Platform,
  Alert,
  KeyboardAvoidingView,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';

import WaterfallSpectrogram, { pushSpectrumData } from './src/components/WaterfallSpectrogram';
import TerminalChat from './src/components/TerminalChat';
import { MeshController, MeshMessage } from './src/protocol/MeshController';
import { Colors, Fonts, Layout } from './src/styles/theme';

const App: React.FC = () => {
  const meshRef = useRef<MeshController | null>(null);
  const [messages, setMessages] = useState<MeshMessage[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [bufferLength, setBufferLength] = useState(0);

  useEffect(() => {
    const mesh = new MeshController();
    meshRef.current = mesh;
    mesh.onMessage((msg) => setMessages(prev => [...prev, msg]));
    mesh.onSpectrum((spectrum) => {
      pushSpectrumData(spectrum);
      setBufferLength(spectrum.bandMagnitudes?.length || 0);
    });
    mesh.onError((error) => Alert.alert('MESH ERROR', error));
    return () => { mesh.destroy(); };
  }, []);

  const requestMicPermission = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      { title: 'AeroChat', message: 'Microphone required for acoustic mesh.', buttonPositive: 'GRANT' },
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }, []);

  const toggleListening = useCallback(async () => {
    const mesh = meshRef.current;
    if (!mesh) return;
    if (isListening) {
      await mesh.stopListening();
      setIsListening(false);
    } else {
      const ok = await requestMicPermission();
      if (!ok) { Alert.alert('DENIED', 'Microphone required.'); return; }
      await mesh.startListening();
      setIsListening(true);
    }
  }, [isListening, requestMicPermission]);

  const handleSend = useCallback(async (text: string) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    setIsTransmitting(true);
    try { await mesh.sendMessage(text); }
    catch (e: any) { Alert.alert('TX FAILED', e.message || 'Error'); }
    finally { setIsTransmitting(false); }
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0A" />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.flex}>

            {/* Header */}
            <View style={styles.header}>
              <View>
                <Text style={styles.title}>AEROCHAT</Text>
                <Text style={styles.subtitle}>16.5 / 17.5 kHz FSK MESH · 50 BPS</Text>
              </View>
              <Pressable
                onPress={toggleListening}
                style={({ pressed }) => [
                  styles.btn,
                  {
                    backgroundColor: pressed ? '#F5F5F5' : '#0A0A0A',
                    borderColor: isListening ? '#F5F5F5' : '#555555',
                  },
                ]}
              >
                {({ pressed }) => (
                  <Text style={[styles.btnText, {
                    color: pressed ? '#0A0A0A' : isListening ? '#F5F5F5' : '#555555',
                  }]}>
                    {isListening ? 'STOP RX' : 'START RX'}
                  </Text>
                )}
              </Pressable>
            </View>

            {/* Divider */}
            <View style={styles.div} />

            {/* Waterfall — 45% */}
            <View style={styles.topSection}>
              <WaterfallSpectrogram isActive={isListening} />
            </View>

            {/* Divider */}
            <View style={styles.div} />

            {/* Chat — 55% */}
            <View style={styles.bottomSection}>
              <TerminalChat
                messages={messages}
                onSend={handleSend}
                isTransmitting={isTransmitting}
                bufferLength={bufferLength}
              />
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default App;

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Layout.PADDING,
    paddingVertical: 8,
  },
  title: {
    fontFamily: Fonts.MONO,
    fontSize: 18,
    color: '#F5F5F5',
    fontWeight: '700',
    letterSpacing: 4,
  },
  subtitle: {
    fontFamily: Fonts.MONO,
    fontSize: 9,
    color: '#444444',
    letterSpacing: 1,
    marginTop: 2,
  },
  btn: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  btnText: {
    fontFamily: Fonts.MONO,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
  },
  div: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#1A1A1A',
  },
  topSection: {
    flex: 4.5,
  },
  bottomSection: {
    flex: 5.5,
  },
});
