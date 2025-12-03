'use client';

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase/client';
import { message } from 'antd';
import { PhoneRequiredModal } from '@/components/auth/PhoneRequiredModal';

// Supabase REST API URL for direct fetch
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  phone?: string | null;
  organization_id?: string | null;
  role: 'sales_manager' | 'finance_manager' | 'department_manager' | 'director' | 'admin';
  organizationRole?: string; // Role slug in current organization (from organization_members table)
  is_owner?: boolean; // Owner flag for current organization
  is_financial_manager?: boolean; // Flag for financial approval permissions (deprecated - use organizationRole)
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  phoneRequired: boolean; // True when user hasn't set phone yet
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (
    email: string,
    password: string,
    metadata: { full_name: string; role: string }
  ) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [phoneRequired, setPhoneRequired] = useState(false);
  const supabaseRef = useRef(getSupabase());
  const supabase = supabaseRef.current;

  // Helper for direct REST API calls (bypasses Supabase client issues)
  const supabaseRest = async (
    table: string,
    accessToken: string,
    query?: Record<string, string>
  ): Promise<{ data: unknown; error: unknown }> => {
    const params = new URLSearchParams(query || {});
    const url = `${SUPABASE_URL}/rest/v1/${table}?${params}`;

    try {
      const response = await fetch(url, {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { data: null, error: { message: errorText, status: response.status } };
      }

      const data = await response.json();
      return { data, error: null };
    } catch (err) {
      return { data: null, error: err };
    }
  };

  // Fetch user profile from database using direct REST API
  const fetchProfile = async (
    userId: string,
    accessToken?: string
  ): Promise<UserProfile | null> => {
    try {
      // Get access token from cookie if not provided
      let token = accessToken;
      if (!token) {
        const sessionData = getSessionDataFromCookie();
        token = sessionData?.access_token;
      }

      if (!token) {
        console.error('[fetchProfile] No access token available');
        return null;
      }

      console.log('[fetchProfile] Fetching profile via REST API for user:', userId);

      // Fetch user profile via REST API
      const { data: profileData, error: profileError } = await supabaseRest(
        'user_profiles',
        token,
        { user_id: `eq.${userId}`, select: '*' }
      );

      if (profileError || !profileData || !Array.isArray(profileData) || profileData.length === 0) {
        console.error('[fetchProfile] Error fetching profile:', profileError);
        return null;
      }

      const data = profileData[0];
      console.log('[fetchProfile] Got profile data:', data);

      // Map database fields to UserProfile interface
      let organizationId = data.last_active_organization_id;

      // If no organization, try to fetch first one
      if (!organizationId) {
        console.log(
          '[fetchProfile] No last_active_organization_id, fetching first organization...'
        );
        const { data: orgData } = await supabaseRest('organization_members', token, {
          user_id: `eq.${userId}`,
          select: 'organization_id',
          order: 'created_at.asc',
          limit: '1',
        });

        if (orgData && Array.isArray(orgData) && orgData.length > 0) {
          organizationId = orgData[0].organization_id;
          console.log('[fetchProfile] Auto-selected organization:', organizationId);
        }
      }

      const profile: UserProfile = {
        id: data.user_id,
        email: data.email || '',
        full_name: data.full_name,
        avatar_url: data.avatar_url,
        phone: data.phone,
        organization_id: organizationId,
        role: data.role || 'sales_manager',
        is_financial_manager: data.is_financial_manager || false,
        created_at: data.created_at,
        updated_at: data.updated_at,
      };

      // Fetch organization role if we have an organization
      if (profile.organization_id) {
        const { data: orgMemberData } = await supabaseRest('organization_members', token, {
          user_id: `eq.${userId}`,
          organization_id: `eq.${profile.organization_id}`,
          select: 'is_owner,role_id,roles(slug)',
        });

        if (orgMemberData && Array.isArray(orgMemberData) && orgMemberData.length > 0) {
          const orgMember = orgMemberData[0];
          profile.organizationRole = orgMember.roles?.slug;
          profile.is_owner = orgMember.is_owner || false;
          console.log(
            '[fetchProfile] Organization role:',
            profile.organizationRole,
            'is_owner:',
            profile.is_owner
          );
        }
      }

      console.log('[fetchProfile] Mapped profile:', profile);
      return profile;
    } catch (error) {
      console.error('[fetchProfile] Error:', error);
      return null;
    }
  };

  // Get session data (access_token) from cookie
  const getSessionDataFromCookie = (): { access_token: string; refresh_token: string } | null => {
    if (typeof document === 'undefined') return null;

    const cookieName = 'sb-wstwwmiihkzlgvlymlfd-auth-token';
    const cookies = document.cookie.split(';');

    for (const cookie of cookies) {
      const trimmed = cookie.trim();
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;
      const name = trimmed.substring(0, eqIndex);
      const value = trimmed.substring(eqIndex + 1);

      if (name === cookieName) {
        try {
          const decoded = decodeURIComponent(value);
          const jsonStr = decoded.startsWith('base64-') ? atob(decoded.slice(7)) : decoded;
          const data = JSON.parse(jsonStr);
          return {
            access_token: data.access_token,
            refresh_token: data.refresh_token,
          };
        } catch {
          return null;
        }
      }
    }
    return null;
  };

  // Helper to get user info from cookie (extracts user id/email from the session JWT)
  const getUserFromCookie = (): { id: string; email: string } | null => {
    if (typeof document === 'undefined') return null;

    const sessionData = getSessionDataFromCookie();
    if (!sessionData?.access_token) return null;

    try {
      // Decode JWT payload (middle part, base64)
      const parts = sessionData.access_token.split('.');
      if (parts.length !== 3) return null;

      const payload = JSON.parse(atob(parts[1]));
      return {
        id: payload.sub,
        email: payload.email,
      };
    } catch {
      return null;
    }
  };

  // Initialize auth state by reading from cookie directly
  useEffect(() => {
    let isMounted = true;
    console.log('[AuthProvider] Setting up auth');

    const initAuth = async () => {
      try {
        // Read user from cookie directly (middleware sets this)
        const cookieUser = getUserFromCookie();
        console.log('[AuthProvider] Cookie user:', cookieUser?.email);

        if (!isMounted) return;

        if (cookieUser) {
          // Create minimal user object
          setUser({ id: cookieUser.id, email: cookieUser.email } as any);

          // Fetch profile
          console.log('[AuthProvider] User found, fetching profile...');
          const userProfile = await fetchProfile(cookieUser.id);
          if (isMounted) {
            console.log(
              '[AuthProvider] Profile fetched:',
              userProfile?.id,
              'phone:',
              userProfile?.phone
            );
            setProfile(userProfile);
          }
        } else {
          console.log('[AuthProvider] No user in cookie');
          setUser(null);
          setSession(null);
          setProfile(null);
        }
      } catch (err) {
        console.error('[AuthProvider] Error in initAuth:', err);
      } finally {
        if (isMounted) {
          console.log('[AuthProvider] Setting loading to false');
          setLoading(false);
        }
      }
    };

    initAuth();

    // Also set up auth state change listener for login/logout events
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[AuthProvider] Auth state changed:', event, session?.user?.email);

      if (!isMounted) return;

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        const userProfile = await fetchProfile(session.user.id);
        if (isMounted) {
          setProfile(userProfile);
        }
      } else {
        setProfile(null);
      }

      setLoading(false);
    });

    return () => {
      console.log('[AuthProvider] Cleanup');
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Safety check: Re-fetch profile if user exists but profile is missing
  useEffect(() => {
    const recheckProfile = async () => {
      if (user && !profile && !loading) {
        console.log('[AuthProvider] Profile missing but user exists - re-fetching...');
        const userProfile = await fetchProfile(user.id);
        setProfile(userProfile);
      }
    };

    recheckProfile();
  }, [user, profile, loading]);

  // Check if phone is required (first login)
  useEffect(() => {
    console.log(
      '[AuthProvider] Phone check - profile:',
      profile?.id,
      'loading:',
      loading,
      'phone:',
      profile?.phone
    );
    if (profile && !loading) {
      const needsPhone = !profile.phone || profile.phone.trim() === '';
      console.log('[AuthProvider] needsPhone:', needsPhone);
      setPhoneRequired(needsPhone);
      if (needsPhone) {
        console.log('[AuthProvider] Phone required - showing modal');
      }
    } else {
      setPhoneRequired(false);
    }
  }, [profile, loading]);

  // Helper for direct REST API updates (bypasses Supabase client issues)
  const supabaseRestUpdate = async (
    table: string,
    accessToken: string,
    data: Record<string, unknown>,
    query: Record<string, string>
  ): Promise<{ error: unknown }> => {
    const params = new URLSearchParams(query);
    const url = `${SUPABASE_URL}/rest/v1/${table}?${params}`;

    try {
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { error: { message: errorText, status: response.status } };
      }

      return { error: null };
    } catch (err) {
      return { error: err };
    }
  };

  // Handle phone submission from modal
  const handlePhoneSubmit = async (phone: string) => {
    if (!user) return;

    // Get access token from cookie
    const sessionData = getSessionDataFromCookie();
    if (!sessionData?.access_token) {
      throw new Error('No access token available');
    }

    console.log('[handlePhoneSubmit] Updating phone via REST API...');

    const { error } = await supabaseRestUpdate(
      'user_profiles',
      sessionData.access_token,
      {
        phone: phone,
        updated_at: new Date().toISOString(),
      },
      { user_id: `eq.${user.id}` }
    );

    if (error) {
      console.error('[handlePhoneSubmit] Error:', error);
      throw new Error((error as { message?: string }).message || 'Failed to save phone');
    }

    console.log('[handlePhoneSubmit] Phone saved, refreshing profile...');

    // Refresh profile to update state
    const userProfile = await fetchProfile(user.id);
    setProfile(userProfile);
    setPhoneRequired(false);

    console.log('[handlePhoneSubmit] Complete!');
  };

  // Sign in function
  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        message.error(`Ошибка входа: ${error.message}`);
        return { error };
      }

      message.success('Вход выполнен успешно');
      return { error: null };
    } catch (error) {
      console.error('Sign in error:', error);
      message.error('Произошла ошибка при входе');
      return { error: error as AuthError };
    } finally {
      setLoading(false);
    }
  };

  // Sign up function
  const signUp = async (
    email: string,
    password: string,
    metadata: { full_name: string; role: string }
  ) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata,
        },
      });

      if (error) {
        message.error(`Ошибка регистрации: ${error.message}`);
        return { error };
      }

      // Check if user was actually created (Supabase returns null user for existing emails)
      // When email confirmation is disabled, data.user exists but data.session is null for existing users
      // When email confirmation is enabled, we check if identities array is empty
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        const duplicateError = {
          name: 'AuthApiError',
          message: 'User already registered',
          status: 400,
        } as AuthError;
        message.error('Этот email уже зарегистрирован');
        return { error: duplicateError };
      }

      message.success('Регистрация успешна! Проверьте email для подтверждения.');
      return { error: null };
    } catch (error) {
      console.error('Sign up error:', error);
      message.error('Произошла ошибка при регистрации');
      return { error: error as AuthError };
    } finally {
      setLoading(false);
    }
  };

  // Sign out function
  const signOut = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signOut();

      if (error) {
        message.error(`Ошибка выхода: ${error.message}`);
        return;
      }

      setUser(null);
      setProfile(null);
      setSession(null);
      message.success('Выход выполнен успешно');

      // Redirect to login page
      window.location.href = '/auth/login';
    } catch (error) {
      console.error('Sign out error:', error);
      message.error('Произошла ошибка при выходе');
    } finally {
      setLoading(false);
    }
  };

  // Update user profile
  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      if (error) {
        message.error(`Ошибка обновления профиля: ${error.message}`);
        return;
      }

      // Refresh profile data
      await refreshProfile();
      message.success('Профиль обновлен успешно');
    } catch (error) {
      console.error('Update profile error:', error);
      message.error('Произошла ошибка при обновлении профиля');
    }
  };

  // Refresh profile data
  const refreshProfile = async () => {
    if (!user) return;

    const userProfile = await fetchProfile(user.id);
    setProfile(userProfile);
  };

  const value: AuthContextType = {
    user,
    profile,
    session,
    loading,
    phoneRequired,
    signIn,
    signUp,
    signOut,
    updateProfile,
    refreshProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      <PhoneRequiredModal open={phoneRequired} onSubmit={handlePhoneSubmit} />
    </AuthContext.Provider>
  );
}

// Custom hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Helper function to check user roles
export function hasRole(userRole: string, requiredRoles: string | string[]): boolean {
  const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
  return roles.includes(userRole);
}

// Helper function to check if user can approve at certain level
export function canApprove(userRole: string, requiredLevel: number): boolean {
  const roleHierarchy = {
    sales_manager: 1,
    finance_manager: 2,
    department_manager: 3,
    director: 4,
    admin: 5,
  };

  const userLevel = roleHierarchy[userRole as keyof typeof roleHierarchy] || 0;
  return userLevel >= requiredLevel;
}
