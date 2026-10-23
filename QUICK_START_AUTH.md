# Quick Start Guide: Supabase Authentication in Oern

## URLs

| Page | URL | Purpose |
|------|-----|---------|
| Welcome | `http://localhost:3000/welcome` | Public landing page |
| Sign In | `http://localhost:3000/signin` | Login existing users |
| Sign Up | `http://localhost:3000/signup` | Register new accounts |
| Home | `http://localhost:3000/home` | User dashboard (auto-redirects by role) |

## How It Works

### 1. Welcome Page Flow
```
User visits /welcome
    ↓
Sees "Get started" or "I already have an account"
    ↓
Chooses action → /signin or /signup
```

### 2. Sign In Flow
```
User enters email + password on /signin
    ↓
Client sends to Supabase Auth API
    ↓
Supabase validates credentials
    ↓
Returns JWT + session
    ↓
Proxy middleware updates cookies
    ↓
User redirected to appropriate workspace
```

### 3. Sign Up Flow
```
User fills form: name, email, password, phone (optional)
    ↓
Client sends to Supabase Auth API
    ↓
Supabase creates account
    ↓
If auto-confirm enabled:
  → Session created → Redirect to workspace
If email required:
  → Show "Check your inbox" screen
  → User clicks email link → Auto-login → Redirect
```

## Key Components

### Frontend Files

**Welcome Page**
- File: `src/app/welcome/page.tsx`
- Component: `WelcomeScreen` from `src/components/delivery/welcome-screen.tsx`
- Features: Animated mascot, brand messaging, call-to-action buttons

**Sign In Form**
- File: `src/components/delivery/signin-form.tsx`
- Features: Email/password validation, error handling, role-based copy
- Uses: `createClient().auth.signInWithPassword()`

**Sign Up Form**
- File: `src/components/delivery/signup-form.tsx`
- Features: Name/email/password validation, optional phone, email confirmation
- Uses: `createClient().auth.signUp()`

### Backend Files

**Supabase Client (Browser)**
- File: `src/lib/supabase/client.ts`
- Purpose: Provides browser-side Supabase client
- Features: QUIC resilience, retry mechanism, singleton pattern

**Supabase Client (Server)**
- File: `src/lib/supabase/server.ts`
- Purpose: Server-side auth operations
- Features: Cookie-based session management, proper error handling

**Session Management**
- File: `src/lib/supabase/proxy.ts`
- Purpose: Refreshes sessions on every request
- Used by: `src/proxy.ts` (Next.js middleware)

**Request Proxy Middleware**
- File: `src/proxy.ts`
- Purpose: Intercepts all requests and updates sessions
- Features: Session refresh, role lookup, workspace redirects

## Testing

### Manual Testing

```bash
# 1. Start the dev server
npm run dev

# 2. Visit welcome page
curl http://localhost:3000/welcome

# 3. Try signing in with test credentials
# (Use email from Supabase test users)

# 4. Check session was created
# Browser DevTools → Application → Cookies
# Look for: sb-access-token, sb-refresh-token
```

### Using curl

```bash
# Check welcome page
curl -i http://localhost:3000/welcome
# Expected: 200 OK

# Check signin page
curl -i http://localhost:3000/signin  
# Expected: 200 OK

# Check proxy middleware
curl -v http://localhost:3000/welcome 2>&1 | grep -i "sb-"
# Expected: See Supabase cookies in headers
```

## Configuration

### Environment Variables (.env)

```env
# Required for authentication to work
NEXT_PUBLIC_SUPABASE_URL=https://wmmvbfcnxivqouyfzelv.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_LB9HGzaccvJDA4uPyr0xyg_Wp4BdSZ9
```

### Supabase Project Settings

In [Supabase Dashboard](https://supabase.com/dashboard):

1. **Authentication**
   - Enable email/password auth
   - Configure email confirmation if needed
   - Set up redirect URL: `http://localhost:3000/auth/callback`

2. **Security**
   - Enable RLS on all tables
   - Create policies for data access
   - Set rate limits

3. **Database**
   - Ensure `profiles` table exists
   - Has `id`, `full_name`, `phone`, `role` columns
   - Set up RLS policies

## Troubleshooting

### Issue: "Cannot fetch from Supabase"
**Solution**: 
- Check internet connection
- Verify NEXT_PUBLIC_SUPABASE_URL is correct
- Check Supabase status page

### Issue: "Invalid credentials"
**Solution**:
- Ensure user account exists in Supabase
- Check password is correct
- Verify email is confirmed (if required)

### Issue: "Session not persisting"
**Solution**:
- Check cookies are enabled
- Verify cookies setting in DevTools
- Check proxy.ts is running (look for proxy time in logs)

### Issue: "Getting redirected wrong"
**Solution**:
- Check user's `role` in `profiles` table
- Verify `workspaceRedirect()` in `src/lib/delivery/access.ts`
- Check `?next=` parameter in URL

### Issue: "Form won't submit"
**Solution**:
- Open browser console (F12)
- Look for error messages
- Check network tab for failed requests
- Verify Supabase URL in .env

## Code Examples

### Sign In a User

```typescript
import { createClient } from "@/lib/supabase/client";

const { error } = await createClient().auth.signInWithPassword({
  email: "user@example.com",
  password: "password123",
});

if (error) {
  console.error("Sign in failed:", error.message);
} else {
  // User is now logged in
  // Session cookies are set automatically by proxy
}
```

### Sign Up a User

```typescript
import { createClient } from "@/lib/supabase/client";

const { data, error } = await createClient().auth.signUp({
  email: "newuser@example.com",
  password: "password123",
  options: {
    data: {
      full_name: "John Doe",
      phone: "+1234567890",
    },
  },
});

if (error) {
  console.error("Sign up failed:", error.message);
} else if (data.session) {
  // User logged in automatically
} else {
  // Email confirmation required
}
```

### Listen to Auth Changes

```typescript
import { createClient } from "@/lib/supabase/client";
import { useEffect } from "react";

export function MyComponent() {
  useEffect(() => {
    const supabase = createClient();
    
    const { data } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_IN") {
          console.log("User signed in:", session?.user.email);
        } else if (event === "SIGNED_OUT") {
          console.log("User signed out");
        }
      }
    );

    return () => data.subscription.unsubscribe();
  }, []);

  return <div>Listening to auth changes...</div>;
}
```

## Performance Tips

1. **Minimize Auth Calls**
   - Use `useWorkspace()` hook for cached session
   - Avoid multiple `getSession()` calls

2. **Enable Caching**
   - Supabase client caches tokens automatically
   - Proxy refreshes efficiently

3. **Monitor Cookies**
   - Keep HTTP-only cookies small
   - Session tokens are compressed

## Security Checklist

- ✅ Never expose service role key
- ✅ Always use HTTPS in production
- ✅ Enable rate limiting
- ✅ Validate all form inputs
- ✅ Use secure password requirements
- ✅ Enable email verification
- ✅ Monitor failed login attempts
- ✅ Implement account lockout

## Next Steps

1. **Test the flows**
   - Try signing up
   - Try signing in
   - Try logging out

2. **Customize if needed**
   - Modify form validation
   - Change error messages
   - Adjust styling

3. **Add features**
   - Password reset
   - Email verification
   - Social sign-in
   - MFA

4. **Deploy to production**
   - Set env vars in hosting platform
   - Update Supabase redirect URL
   - Enable HTTPS
   - Set up monitoring

## Resources

- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [Next.js Auth with Supabase](https://supabase.com/docs/guides/auth/auth-helpers/nextjs)
- [@supabase/ssr Package](https://www.npmjs.com/package/@supabase/ssr)
- [@supabase/supabase-js Package](https://www.npmjs.com/package/@supabase/supabase-js)

## Support

For issues with:
- **Supabase**: Visit [Supabase Community](https://github.com/supabase/supabase/discussions)
- **Oern App**: Check project documentation
- **Next.js**: Visit [Next.js Documentation](https://nextjs.org/docs)

---

**Last Updated**: October 23, 2026  
**Status**: Production Ready ✅
