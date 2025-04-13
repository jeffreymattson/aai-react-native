import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Dimensions, Text, SafeAreaView, Keyboard, Platform } from 'react-native';
import WebView from 'react-native-webview';
import { Button } from '@rneui/themed';
import { supabase } from '../lib/supabase';

interface ChatProps {
  onClose: () => void;
}

const DEV_MACHINE_IP = '192.168.1.22'; // Replace with your actual IP
const { width: windowWidth, height: windowHeight } = Dimensions.get('window');

// CSS to inject into the WebView
const injectedCSS = `
  /* Base styles */
  body {
    margin: 0 !important;
    padding: 0 !important;
    height: 100vh !important;
    overflow: hidden !important;
  }

  /* Container styles */
  .gradio-container {
    margin: 0 !important;
    padding: 0 !important;
    max-width: none !important;
    height: 100vh !important;
    display: flex !important;
    flex-direction: column !important;
  }

  /* Chat container */
  .gradio-chatbot {
    flex: 1 !important;
    min-height: calc(100vh - 120px) !important;
    height: calc(100vh - 120px) !important;
    margin: 0 !important;
    padding: 16px !important;
    overflow-y: auto !important;
    -webkit-overflow-scrolling: touch !important;
  }

  /* Message styles */
  .message {
    max-width: 85% !important;
    margin: 8px 0 !important;
    padding: 12px !important;
    border-radius: 12px !important;
    background: #f0f0f0 !important;
  }

  /* Input container */
  .input-row {
    position: fixed !important;
    bottom: 0 !important;
    left: 0 !important;
    right: 0 !important;
    padding: 12px !important;
    background: white !important;
    border-top: 1px solid #eee !important;
    display: flex !important;
    gap: 8px !important;
    z-index: 1000 !important;
  }

  /* Input box */
  .input-row textarea {
    flex: 1 !important;
    min-height: 44px !important;
    max-height: 120px !important;
    padding: 10px !important;
    border: 1px solid #ddd !important;
    border-radius: 8px !important;
    font-size: 16px !important;
    line-height: 1.4 !important;
    margin: 0 !important;
  }

  /* Button */
  .input-row button {
    min-height: 44px !important;
    padding: 0 16px !important;
    border-radius: 8px !important;
  }

  /* Hide unnecessary elements */
  footer, .debug-info, .gradio-debug, .debug-area, .debug-message,
  .footer, .app-footer, .gr-footer, .gr-form, .gr-padded, .gr-box,
  .gr-panel, .gr-toolbar, .gr-button-tool {
    display: none !important;
  }

  /* Ensure proper spacing */
  .wrap {
    max-width: none !important;
    margin: 0 !important;
    padding: 0 !important;
    height: 100vh !important;
  }

  /* Add padding for iOS safe area */
  @supports (padding: max(0px)) {
    .input-row {
      padding-bottom: max(12px, env(safe-area-inset-bottom)) !important;
    }
  }
`;

// JavaScript to inject into the WebView
const injectedJavaScript = `
  function applyStyles() {
    const style = document.createElement('style');
    style.textContent = ${JSON.stringify(injectedCSS)};
    document.head.appendChild(style);

    // Add viewport meta tag
    let viewport = document.querySelector('meta[name="viewport"]');
    if (!viewport) {
      viewport = document.createElement('meta');
      viewport.name = 'viewport';
      document.head.appendChild(viewport);
    }
    viewport.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';

    // Log dimensions for debugging
    console.log('Window dimensions:', window.innerWidth, window.innerHeight);
    console.log('Document dimensions:', document.documentElement.clientWidth, document.documentElement.clientHeight);
  }

  // Function to clear input
  function clearInput() {
    const textarea = document.querySelector('.input-row textarea');
    if (textarea) {
      textarea.value = '';
    }
  }

  // Function to set up input clearing
  function setupInputClearing() {
    // Find the textarea
    const textarea = document.querySelector('.input-row textarea');
    if (textarea) {
      // Handle Enter key press
      textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          // Clear after a short delay to ensure the message is sent
          setTimeout(clearInput, 100);
        }
      });
    }

    // Find the submit button
    const submitButton = document.querySelector('.input-row button');
    if (submitButton) {
      // Add click event listener
      submitButton.addEventListener('click', () => {
        // Clear after a short delay to ensure the message is sent
        setTimeout(clearInput, 100);
      });
    }
  }

  // Apply styles immediately
  applyStyles();
  
  // Also apply styles when the DOM changes
  new MutationObserver(applyStyles).observe(document.body, { 
    childList: true, 
    subtree: true 
  });

  // Set up input clearing
  setupInputClearing();

  // Also set up input clearing when the DOM changes
  new MutationObserver(setupInputClearing).observe(document.body, {
    childList: true,
    subtree: true
  });

  true;
`;

export default function Chat({ onClose }: ChatProps) {
  const [userId, setUserId] = React.useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
        setIsKeyboardVisible(true);
      }
    );

    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
        setIsKeyboardVisible(false);
      }
    );

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, []);

  React.useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      }
    };
    getCurrentUser();
  }, []);

  const gradioUrl = `http://${DEV_MACHINE_IP}:7860${userId ? `?user_id=${userId}` : ''}`;

  // Calculate content height (total height minus header and keyboard)
  const contentHeight = windowHeight - 56 - (isKeyboardVisible ? keyboardHeight : 0);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Chat Assistant</Text>
          <Button
            title="Close"
            onPress={onClose}
            type="clear"
            containerStyle={styles.closeButton}
          />
        </View>
        
        {userId ? (
          <View style={[styles.webviewContainer, { height: contentHeight }]}>
            <WebView
              source={{ uri: gradioUrl }}
              style={[styles.webview, { height: contentHeight }]}
              injectedJavaScript={injectedJavaScript}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              startInLoadingState={true}
              scrollEnabled={true}
              bounces={false}
              onError={(syntheticEvent) => {
                console.warn('WebView error:', syntheticEvent.nativeEvent);
              }}
              onHttpError={(syntheticEvent) => {
                console.warn('WebView HTTP error:', syntheticEvent.nativeEvent);
              }}
              onLoadEnd={() => {
                console.log('WebView loaded. Content height:', contentHeight);
              }}
            />
          </View>
        ) : (
          <View style={styles.loadingContainer}>
            <Text>Loading chat...</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 56,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    zIndex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    marginLeft: 'auto',
  },
  webviewContainer: {
    backgroundColor: '#fff',
    width: windowWidth,
    minHeight: 200,
  },
  webview: {
    backgroundColor: '#fff',
    width: '100%',
    minHeight: 200,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
}); 