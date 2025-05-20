import React, { useState } from 'react'
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native'
import { supabase } from '../lib/supabase'
import { Button, Input } from '@rneui/themed'

interface SignUpProps {
  onNavigateToSignIn: () => void
}

export default function SignUp({ onNavigateToSignIn }: SignUpProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  async function signUpWithEmail() {
    if (password !== confirmPassword) {
      setMessage({ text: 'Passwords do not match', type: 'error' })
      return
    }

    if (password.length < 6) {
      setMessage({ text: 'Password must be at least 6 characters long', type: 'error' })
      return
    }

    setLoading(true)
    setMessage(null)
    const { error } = await supabase.auth.signUp({
      email: email,
      password: password,
      options: {
        emailRedirectTo: 'http://3.20.51.149/confirm-email'
      }
    })

    if (error) {
      setMessage({ text: error.message, type: 'error' })
    } else {
      setMessage({ 
        text: `We've sent a confirmation email to ${email}. Please check your inbox and click the verification link to complete your registration.`, 
        type: 'success' 
      })
      // Clear the form
      setEmail('')
      setPassword('')
      setConfirmPassword('')
      // Navigate to sign in after 5 seconds
      setTimeout(() => {
        onNavigateToSignIn()
      }, 5000)
    }
    setLoading(false)
  }

  return (
    <View>
      {message && (
        <View style={[
          styles.messageContainer,
          message.type === 'success' ? styles.successMessage : styles.errorMessage
        ]}>
          <Text style={styles.messageText}>{message.text}</Text>
        </View>
      )}
      <View style={[styles.verticallySpaced, styles.mt20]}>
        <Input
          label="Email"
          leftIcon={{ type: 'font-awesome', name: 'envelope' }}
          onChangeText={(text) => {
            setEmail(text)
            setMessage(null)
          }}
          value={email}
          placeholder="email@address.com"
          autoCapitalize={'none'}
        />
      </View>
      <View style={styles.verticallySpaced}>
        <Input
          label="Password"
          leftIcon={{ type: 'font-awesome', name: 'lock' }}
          onChangeText={(text) => {
            setPassword(text)
            setMessage(null)
          }}
          value={password}
          secureTextEntry={true}
          placeholder="Password"
          autoCapitalize={'none'}
        />
      </View>
      <View style={styles.verticallySpaced}>
        <Input
          label="Confirm Password"
          leftIcon={{ type: 'font-awesome', name: 'lock' }}
          onChangeText={(text) => {
            setConfirmPassword(text)
            setMessage(null)
          }}
          value={confirmPassword}
          secureTextEntry={true}
          placeholder="Confirm Password"
          autoCapitalize={'none'}
        />
      </View>
      <View style={[styles.verticallySpaced, styles.mt20]}>
        <Button title="Sign up" disabled={loading} onPress={() => signUpWithEmail()} />
      </View>
      <View style={styles.signInContainer}>
        <Text style={styles.signInText}>Already have an account? </Text>
        <TouchableOpacity onPress={onNavigateToSignIn} disabled={loading}>
          <Text style={styles.linkText}>Sign in</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  verticallySpaced: {
    paddingTop: 4,
    paddingBottom: 4,
    alignSelf: 'stretch',
  },
  mt20: {
    marginTop: 20,
  },
  signInContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  signInText: {
    fontSize: 14,
  },
  linkText: {
    color: '#2089dc',
    fontSize: 14,
  },
  messageContainer: {
    padding: 15,
    borderRadius: 5,
    marginBottom: 20,
  },
  successMessage: {
    backgroundColor: '#d4edda',
    borderColor: '#c3e6cb',
  },
  errorMessage: {
    backgroundColor: '#f8d7da',
    borderColor: '#f5c6cb',
  },
  messageText: {
    fontSize: 14,
    textAlign: 'center',
    color: '#155724',
  },
}) 