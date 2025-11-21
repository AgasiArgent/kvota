'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { message } from 'antd';

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  phone?: string | null;
  organization_id?: string | null;
  role: 'sales_manager' | 'finance_manager' | 'department_manager' | 'director' | 'admin';
  organizationRole?: string; // Role in current organization (from organization_members table)
  is_financial_manager?: boolean; // Flag for financial approval permissions
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
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
  const supabase = createClient();

  // Fetch user profile from database
  const fetchProfile = async (userId: string): Promise<UserProfile | null> => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        // If profile doesn't exist (PGRST116 = no rows), create it
        if (error.code === 'PGRST116') {
          console.log('Profile not found, creating one...');

          // Get user metadata from auth
          const {
            data: { user },
          } = await supabase.auth.getUser();

          if (user) {
            const newProfile = {
              user_id: userId,
              full_name: user.user_metadata?.full_name || '',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };

            const { data: createdProfile, error: createError } = await supabase
              .from('user_profiles')
              .insert(newProfile)
              .select()
              .single();

            if (createError) {
              console.error('Error creating profile:', createError);
              return null;
            }

            console.log('Profile created successfully!');
            return createdProfile;
          }
        }

        console.error('Error fetching profile:', error);
        return null;
      }

      // Map database fields to UserProfile interface
      // The database has 'last_active_organization_id', we map it to 'organization_id'
      let organizationId = data.last_active_organization_id;

      // If last_active_organization_id is NULL, auto-load first organization
      if (!organizationId) {
        console.log(
          '[fetchProfile] No last_active_organization_id, fetching first organization...'
        );
        const { data: orgMember, error: orgError } = await supabase
          .from('organization_members')
          .select('organization_id')
          .eq('user_id', userId)
          .order('created_at', { ascending: true })
          .limit(1)
          .single();

        if (!orgError && orgMember) {
          organizationId = orgMember.organization_id;
          console.log('[fetchProfile] Auto-selected organization:', organizationId);

          // Update last_active_organization_id in database for future logins
          await supabase
            .from('user_profiles')
            .update({ last_active_organization_id: organizationId })
            .eq('user_id', userId);
        } else {
          console.warn('[fetchProfile] No organization found for user');
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

      // Fetch organization-specific role from organization_members table
      if (profile.organization_id) {
        try {
          const { data: orgMember, error: orgError } = await supabase
            .from('organization_members')
            .select('roles(slug)')
            .eq('user_id', userId)
            .eq('organization_id', profile.organization_id)
            .single();

          console.log('[fetchProfile] orgMember query result:', { orgMember, orgError });

          if (!orgError && orgMember) {
            // @ts-expect-error - roles is a relation
            profile.organizationRole = orgMember.roles?.slug;
            console.log(
              `[fetchProfile] Organization role for org ${profile.organization_id}:`,
              profile.organizationRole
            );
          } else {
            console.warn('[fetchProfile] Failed to load organization role:', orgError);
          }
        } catch (error) {
          console.error('Error fetching organization role:', error);
        }
      } else {
        console.warn('[fetchProfile] No organization_id - skipping role fetch');
      }

      console.log('[fetchProfile] Mapped profile:', profile);
      return profile;
    } catch (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
  };

  // Initialize auth state
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Get initial session
        const {
          data: { session: initialSession },
        } = await supabase.auth.getSession();

        if (initialSession?.user) {
          setUser(initialSession.user);
          setSession(initialSession);
          const userProfile = await fetchProfile(initialSession.user.id);
          setProfile(userProfile);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.email);

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        const userProfile = await fetchProfile(session.user.id);
        setProfile(userProfile);
      } else {
        setProfile(null);
      }

      setLoading(false);
    });

    return () => subscription.unsubscribe();
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
    signIn,
    signUp,
    signOut,
    updateProfile,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
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
