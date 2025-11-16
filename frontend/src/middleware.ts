import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protected routes - require authentication
  const protectedPaths = [
    '/dashboard',
    '/quotes',
    '/customers',
    '/profile',
    '/admin',
    '/onboarding',
  ];

  const isProtectedPath = protectedPaths.some((path) => request.nextUrl.pathname.startsWith(path));

  // Admin only routes
  const adminPaths = ['/admin'];
  const isAdminPath = adminPaths.some((path) => request.nextUrl.pathname.startsWith(path));

  // Manager only routes (finance_manager and above)
  const managerPaths = ['/quotes/approval', '/reports'];
  const isManagerPath = managerPaths.some((path) => request.nextUrl.pathname.startsWith(path));

  // If accessing protected route without authentication, redirect to login
  if (isProtectedPath && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/login';
    url.searchParams.set('redirectTo', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // If authenticated but accessing auth pages, redirect based on organization status
  // EXCLUDE /auth/callback to avoid breaking Supabase auth flow
  if (
    user &&
    request.nextUrl.pathname.startsWith('/auth/') &&
    !request.nextUrl.pathname.startsWith('/auth/callback')
  ) {
    // Check if user has any organization memberships
    const { data: memberships } = await supabase
      .from('organization_members')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .limit(1);

    const url = request.nextUrl.clone();

    // Check for redirectTo parameter in the URL
    const redirectTo = request.nextUrl.searchParams.get('redirectTo');

    if (redirectTo && memberships && memberships.length > 0) {
      // User has organization and wants to go to specific page
      url.pathname = redirectTo;
      url.searchParams.delete('redirectTo'); // Clean up URL
    } else {
      // Default redirect logic
      // If user has no organization, send to onboarding
      // Otherwise send to dashboard
      url.pathname = memberships && memberships.length > 0 ? '/dashboard' : '/onboarding';
    }

    return NextResponse.redirect(url);
  }

  // If user is on dashboard but has no organization, redirect to onboarding
  if (user && request.nextUrl.pathname === '/dashboard') {
    const { data: memberships } = await supabase
      .from('organization_members')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .limit(1);

    if (!memberships || memberships.length === 0) {
      const url = request.nextUrl.clone();
      url.pathname = '/onboarding';
      return NextResponse.redirect(url);
    }
  }

  // If user is on onboarding but already has an organization, redirect to dashboard
  if (user && request.nextUrl.pathname === '/onboarding') {
    const { data: memberships } = await supabase
      .from('organization_members')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .limit(1);

    if (memberships && memberships.length > 0) {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }
  }

  // Check admin permissions (check organization role, not global role)
  if (isAdminPath && user) {
    const { data: orgMember } = await supabase
      .from('organization_members')
      .select('roles(slug), is_owner')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .limit(1)
      .single();

    // Allow if user is owner OR has admin role in organization
    const isOwner = orgMember?.is_owner || false;
    const roleSlug = ((orgMember as any)?.roles?.slug as string) || '';

    if (!isOwner && !['admin', 'owner'].includes(roleSlug.toLowerCase())) {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }
  }

  // Check manager permissions
  if (isManagerPath && user) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    const managerRoles = ['finance_manager', 'department_manager', 'director', 'admin'];
    if (!profile || !managerRoles.includes(profile.role)) {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is. If you're
  // creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object instead of the supabaseResponse object

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
