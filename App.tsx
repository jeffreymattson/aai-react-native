import './lib/webInit'
import 'react-native-url-polyfill/auto'
import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import SignIn from './components/SignIn'
import SignUp from './components/SignUp'
import Account from './components/Account'
import { View, Platform, StyleSheet, ViewStyle, Text } from 'react-native'
import { Session } from '@supabase/supabase-js'

// Add web-specific styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  webContainer: {
    minHeight: '100vh' as any, // Type assertion to handle web-specific units
  },
});

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [isSignUp, setIsSignUp] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    try {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session)
      })

      supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session)
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      console.error('Auth error:', err)
    }
  }, [])

  const containerStyle = Platform.select<ViewStyle[]>({
    web: [styles.container, styles.webContainer],
    default: [styles.container],
  });

  if (error) {
    return (
      <View style={containerStyle}>
        <View style={{ padding: 20 }}>
          <Text style={{ color: 'red' }}>Error: {error}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={containerStyle}>
      {session && session.user ? (
        <Account key={session.user.id} session={session} />
      ) : isSignUp ? (
        <SignUp onNavigateToSignIn={() => setIsSignUp(false)} />
      ) : (
        <SignIn onNavigateToSignUp={() => setIsSignUp(true)} />
      )}
    </View>
  )
}
