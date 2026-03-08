/**
 * AeroChat — Terminal Chat
 *
 * Terminal-style chat log and input.
 * Monospaced, obsidian black, stark white.
 * No rounded elements. No gradients.
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  Pressable,
  Dimensions,
} from 'react-native';
import { Colors, Fonts, Layout } from '../styles/theme';
import type { MeshMessage } from '../protocol/MeshController';

interface TerminalChatProps {
  messages: MeshMessage[];
  onSend: (text: string) => void;
  isTransmitting: boolean;
  bufferLength: number;
}

const TerminalChat: React.FC<TerminalChatProps> = ({
  messages,
  onSend,
  isTransmitting,
  bufferLength,
}) => {
  const [input, setInput] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isTransmitting) return;
    onSend(trimmed);
    setInput('');
  }, [input, isTransmitting, onSend]);

  const fmtTime = (ts: number): string => {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      {/* Status bar */}
      <View style={styles.statusBar}>
        <Text style={styles.statusLabel}>
          MESH LOG — {messages.length} MSG{messages.length !== 1 ? 'S' : ''}
        </Text>
        <Text style={styles.statusLabel}>BUF {bufferLength}b</Text>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        style={styles.messageList}
        contentContainerStyle={styles.messageContent}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyLine}>┌──────────────────────┐</Text>
            <Text style={styles.emptyLine}>│                      │</Text>
            <Text style={styles.emptyLine}>│  AWAITING TRAFFIC    │</Text>
            <Text style={styles.emptyLine}>│  TYPE BELOW TO TX    │</Text>
            <Text style={styles.emptyLine}>│                      │</Text>
            <Text style={styles.emptyLine}>└──────────────────────┘</Text>
          </View>
        ) : (
          messages.map((msg, i) => {
            const isSent = msg.direction === 'sent';
            return (
              <View key={`${msg.timestamp}-${i}`} style={styles.msgRow}>
                <Text style={[styles.msgPrefix, { color: isSent ? '#555555' : '#F5F5F5' }]}>
                  {isSent ? '▸ TX' : '◂ RX'}
                </Text>
                <Text style={styles.msgTime}>{fmtTime(msg.timestamp)}</Text>
                <Text style={styles.msgText}>{msg.text}</Text>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Input bar */}
      <View style={styles.inputBar}>
        <Text style={styles.prompt}>{'>'}</Text>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={handleSend}
          placeholder="message..."
          placeholderTextColor="#333333"
          returnKeyType="send"
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          editable={!isTransmitting}
          maxLength={255}
        />
        <Pressable
          onPress={handleSend}
          disabled={isTransmitting || !input.trim()}
          style={({ pressed }) => [
            styles.sendBtn,
            {
              backgroundColor: pressed ? '#F5F5F5' : '#0A0A0A',
              borderColor: (!input.trim() || isTransmitting) ? '#333333' : '#F5F5F5',
            },
          ]}
        >
          {({ pressed }) => (
            <Text style={[styles.sendText, {
              color: pressed ? '#0A0A0A' : (!input.trim() || isTransmitting) ? '#333333' : '#F5F5F5',
            }]}>
              {isTransmitting ? 'TX..' : 'SEND'}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
};

export default React.memo(TerminalChat);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.BLACK,
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Layout.PADDING,
    paddingVertical: 5,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1A1A1A',
  },
  statusLabel: {
    fontFamily: Fonts.MONO,
    fontSize: 9,
    color: '#444444',
    letterSpacing: 1.5,
  },
  messageList: {
    flex: 1,
  },
  messageContent: {
    paddingHorizontal: Layout.PADDING,
    paddingVertical: 8,
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyLine: {
    fontFamily: Fonts.MONO,
    fontSize: 11,
    color: '#222222',
    lineHeight: 16,
  },
  msgRow: {
    flexDirection: 'row',
    marginBottom: 3,
    flexWrap: 'wrap',
  },
  msgPrefix: {
    fontFamily: Fonts.MONO,
    fontSize: 12,
    fontWeight: '700',
    marginRight: 6,
    width: 32,
  },
  msgTime: {
    fontFamily: Fonts.MONO,
    fontSize: 12,
    color: '#444444',
    marginRight: 6,
  },
  msgText: {
    fontFamily: Fonts.MONO,
    fontSize: 12,
    color: '#F5F5F5',
    flex: 1,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Layout.PADDING,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#1A1A1A',
  },
  prompt: {
    fontFamily: Fonts.MONO,
    fontSize: 14,
    color: '#F5F5F5',
    fontWeight: '700',
    marginRight: 6,
  },
  input: {
    flex: 1,
    fontFamily: Fonts.MONO,
    fontSize: 12,
    color: '#F5F5F5',
    paddingVertical: 6,
  },
  sendBtn: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: 8,
  },
  sendText: {
    fontFamily: Fonts.MONO,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
