'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Spin, Row, Col } from 'antd'
import { useAuth } from '@/lib/auth/AuthProvider'

export default function Home() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading) {
      if (user) {
        // User is authenticated, redirect to dashboard
        router.push('/dashboard')
      } else {
        // User is not authenticated, redirect to login
        router.push('/auth/login')
      }
    }
  }, [user, loading, router])

  // Show loading spinner while determining auth state
  return (
    <Row
      justify="center"
      align="middle"
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}
    >
      <Col>
        <Spin size="large" />
      </Col>
    </Row>
  )
}
