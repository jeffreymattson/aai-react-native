import { Platform } from 'react-native';

if (Platform.OS === 'web') {
  // Initialize React Native Web components
  require('react-native-web/dist/exports/View');
  require('react-native-web/dist/exports/Text');
  require('react-native-web/dist/exports/TextInput');
  require('react-native-web/dist/exports/TouchableOpacity');
  require('react-native-web/dist/exports/Alert');
  require('react-native-web/dist/exports/StyleSheet');
} 