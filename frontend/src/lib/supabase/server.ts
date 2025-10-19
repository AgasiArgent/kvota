import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}

// Convenience function to get the authenticated user
export async function getUser() {
  const supabase = await createClient();

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    // Get user profile from our users table
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    return {
      ...user,
      profile,
    };
  } catch (error) {
    console.error('Error getting user:', error);
    return null;
  }
}

// Convenience function to check if user has required role
export async function checkUserRole(requiredRole: string | string[]) {
  const user = await getUser();

  if (!user?.profile) {
    return false;
  }

  const userRole = user.profile.role;
  const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];

  return roles.includes(userRole);
}

// Role hierarchy for Russian business approval workflow
export const ROLE_HIERARCHY = {
  sales_manager: 1,
  finance_manager: 2,
  department_manager: 3,
  director: 4,
  admin: 5,
};

// Check if user can approve quotes at a certain level
export async function canApproveQuotes(requiredLevel: number) {
  const user = await getUser();

  if (!user?.profile) {
    return false;
  }

  const userLevel = ROLE_HIERARCHY[user.profile.role as keyof typeof ROLE_HIERARCHY] || 0;
  return userLevel >= requiredLevel;
}
