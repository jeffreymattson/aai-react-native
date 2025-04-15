import '../lib/webInit'
import React, { useState } from 'react'
import { Alert, StyleSheet, View, Text, TouchableOpacity, TextInput, Platform } from 'react-native'
import { supabase } from '../lib/supabase'
import { Button } from '@rneui/themed'

interface SignInProps {
  onNavigateToSignUp: () => void
}

export default function SignIn({ onNavigateToSignUp }: SignInProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`)
    } else {
      Alert.alert(title, message, [{ text: 'OK' }])
    }
  }

  async function signInWithEmail() {
    console.log('Sign in attempted with:', { email, password })
    
    if (!email || !password) {
      console.log('Validation failed - missing email or password')
      showAlert('Missing Information', 'Please enter both email and password to sign in.')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      })

      console.log('Sign in response:', error ? 'Error: ' + error.message : 'Success')

      if (error) {
        if (error.message.includes('Invalid login credentials') || 
            error.message.includes('Invalid email or password') ||
            error.message.includes('Email not confirmed') ||
            error.message.includes('Validation failed - missing email or password')) {
          showAlert('Sign In Failed', 'Incorrect email or password. Please try again.')
        } else {
          console.error('Sign in error:', error)
          showAlert('Error', error.message)
        }
      }
    } catch (err) {
      console.error('Unexpected error during sign in:', err)
      showAlert('Error', 'An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function resetPassword() {
    if (!email) {
      showAlert('Error', 'Please enter your email address')
      return
    }
    
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'http://localhost:3000/reset-password'
    })

    if (error) {
      showAlert('Error', error.message)
    } else {
      showAlert('Password Reset Email Sent', 'Please check your email for the password reset link.')
    }
    setLoading(false)
  }

  return (
    <View style={styles.container}>
      <View style={[styles.verticallySpaced, styles.mt20]}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          onChangeText={(text) => setEmail(text)}
          value={email}
          placeholder="email@address.com"
          autoCapitalize="none"
          keyboardType="email-address"
        />
      </View>
      <View style={styles.verticallySpaced}>
        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          onChangeText={(text) => setPassword(text)}
          value={password}
          secureTextEntry={true}
          placeholder="Password"
          autoCapitalize="none"
        />
      </View>
      <View style={styles.forgotPasswordContainer}>
        <TouchableOpacity onPress={resetPassword} disabled={loading}>
          <Text style={styles.linkText}>Forgot Password?</Text>
        </TouchableOpacity>
      </View>
      <View style={[styles.verticallySpaced, styles.mt20]}>
        <Button 
          title="Sign in" 
          disabled={loading} 
          onPress={() => signInWithEmail()}
          buttonStyle={styles.button}
        />
      </View>
      <View style={styles.signUpContainer}>
        <Text style={styles.signUpText}>Don't have an account? </Text>
        <TouchableOpacity onPress={onNavigateToSignUp} disabled={loading}>
          <Text style={styles.linkText}>Sign up</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  verticallySpaced: {
    paddingTop: 4,
    paddingBottom: 4,
    alignSelf: 'stretch',
  },
  mt20: {
    marginTop: 20,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 10,
    fontSize: 16,
    borderRadius: 4,
    marginBottom: 8,
  },
  button: {
    marginTop: 10,
  },
  forgotPasswordContainer: {
    alignItems: 'flex-end',
    paddingRight: 4,
    marginBottom: 10,
  },
  signUpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  signUpText: {
    fontSize: 16,
  },
  linkText: {
    color: '#007AFF',
    fontSize: 16,
  },
}) 