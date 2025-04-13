import React, { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import SignIn from './SignIn'
import SignUp from './SignUp'

export default function Auth() {
  const [isSignUp, setIsSignUp] = useState(false)

  return (
    <View style={styles.container}>
      {isSignUp ? (
        <SignUp onNavigateToSignIn={() => setIsSignUp(false)} />
      ) : (
        <SignIn onNavigateToSignUp={() => setIsSignUp(true)} />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 12,
  },
})