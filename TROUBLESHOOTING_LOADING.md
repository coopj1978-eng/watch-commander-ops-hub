# Troubleshooting: Continuous Loading Screen

## Problem
The app shows a loading spinner indefinitely and never loads.

## Root Causes & Solutions

### 1. Missing Clerk Publishable Key ⚠️

**Symptom:** Loading screen with "Connecting to Clerk..." message  
**Cause:** Clerk publishable key not configured

**Solution:**
1. Open Encore Settings (sidebar)
2. Add a new secret: `VITE_CLERK_PUBLISHABLE_KEY`
3. Get your key from [Clerk Dashboard](https://dashboard.clerk.com) → Your App → API Keys
4. Copy the **Publishable Key** (starts with `pk_test_` or `pk_live_`)
5. Paste into Encore settings
6. Restart the app

**Alternative (for development):**
Create a `.env` file in the `frontend/` directory:
```bash
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
```

---

### 2. Clerk Application Not Set Up

**Symptom:** Loading screen, console shows Clerk errors  
**Cause:** No Clerk application created

**Solution:**
1. Go to [clerk.com](https://clerk.com) and sign up/sign in
2. Create a new application
3. Choose authentication methods:
   - ✅ Email + Password
   - ✅ Email verification codes (magic links)
4. Copy the **Publishable Key**
5. Set it as `VITE_CLERK_PUBLISHABLE_KEY` (see above)

---

### 3. Backend Secret Missing

**Symptom:** Can't sign in, "authentication failed" errors  
**Cause:** Backend Clerk secret not configured

**Solution:**
1. Open Encore Settings
2. Add secret: `ClerkSecretKey`
3. Get **Secret Key** from Clerk Dashboard → API Keys
4. Paste the secret key (starts with `sk_test_` or `sk_live_`)
5. Restart backend

---

### 4. Network/CORS Issues

**Symptom:** Loading screen, network errors in browser console  
**Cause:** Clerk API blocked by network/firewall

**Solution:**
1. Check browser console for errors (F12)
2. Look for CORS or network errors
3. Ensure these domains are accessible:
   - `*.clerk.accounts.dev`
   - `clerk.com`
   - `api.clerk.com`
4. Disable VPN if using one
5. Try different network/browser

---

### 5. Browser Cache Issues

**Symptom:** Loading screen after updates  
**Cause:** Stale cached JavaScript

**Solution:**
1. Hard reload: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
2. Clear browser cache for the site
3. Open in incognito/private window
4. Clear Clerk session storage:
   - Open DevTools (F12)
   - Go to Application/Storage tab
   - Clear Local Storage and Session Storage for your domain

---

## Debugging Steps

### Step 1: Check Browser Console
1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for errors:
   - ❌ `Missing Clerk Publishable Key` → Configure VITE_CLERK_PUBLISHABLE_KEY
   - ❌ `Failed to load Clerk` → Check network, CORS
   - ❌ `401 Unauthorized` → Check ClerkSecretKey backend secret
   - ✅ `Clerk loaded successfully!` → Clerk working, check other issues

### Step 2: Check Network Tab
1. Open DevTools → Network tab
2. Reload page
3. Filter by "clerk"
4. Look for failed requests (red)
5. Check response for error details

### Step 3: Verify Environment Variables
```bash
# Frontend .env should have:
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...

# Backend secrets (in Encore Settings):
ClerkSecretKey=sk_test_...
AdminEmail=your-admin@email.com (optional)
SetupToken=your-setup-token (optional)
```

### Step 4: Test Clerk Independently
1. Go to your Clerk Dashboard
2. Navigate to Sessions
3. Create a test user manually
4. Try signing in with that user
5. If successful, issue is configuration; if fails, issue is Clerk setup

---

## Quick Fix Checklist

- [ ] `VITE_CLERK_PUBLISHABLE_KEY` set in frontend/.env or Encore settings
- [ ] `ClerkSecretKey` set in Encore backend secrets
- [ ] Clerk application created and configured
- [ ] Email + Password authentication enabled in Clerk
- [ ] Browser cache cleared
- [ ] No VPN blocking Clerk domains
- [ ] Console shows "Clerk loaded successfully!"
- [ ] Network tab shows successful Clerk API calls

---

## Still Stuck?

### Check Console Output

Look for these console messages in order:

1. ✅ `App rendering` - App component loaded
2. ✅ `AppInner rendering` - Router initialized
3. ✅ `AppRoutes - isLoaded: false` - Clerk initializing
4. ✅ `Waiting for Clerk to load...` - Normal loading state
5. ✅ `Clerk loaded successfully!` - Should appear within 2-3 seconds
6. ✅ `AppRoutes - isLoaded: true, isSignedIn: false` - Ready for sign-in

**If stuck at step 3-4 for >10 seconds:**
- Missing or invalid VITE_CLERK_PUBLISHABLE_KEY
- Network blocking Clerk
- Clerk service down (check status.clerk.com)

**If reaches step 5 but still loading:**
- React routing issue (check browser console)
- Missing component (check for import errors)

### Contact Support

Provide this information:
1. Browser console output (screenshot or copy/paste)
2. Network tab filtered by "clerk" (screenshot)
3. Environment variable configuration (redact actual keys)
4. Encore app ID
5. Steps to reproduce

---

## Development Mode Bypass

For local development only, you can temporarily bypass Clerk:

**NOT RECOMMENDED FOR PRODUCTION**

```typescript
// frontend/App.tsx - temporary bypass
function AppRoutes() {
  const { isLoaded, isSignedIn } = useUser();
  
  // DEVELOPMENT ONLY - Remove before production
  if (import.meta.env.DEV && !PUBLISHABLE_KEY.startsWith('pk_')) {
    return <Navigate to="/dashboard" replace />;
  }
  
  if (!isLoaded) {
    return <div>Loading...</div>;
  }
  // ... rest of code
}
```

This lets you test the UI without Clerk configured, but authentication won't work.

---

## Prevention

### Before Deploying:
1. ✅ Set all required secrets in Encore Settings
2. ✅ Test sign-in flow end-to-end
3. ✅ Verify both frontend and backend environments
4. ✅ Document secrets in team password manager
5. ✅ Add monitoring/alerts for authentication failures

### For Team Members:
Create a setup guide with:
- Clerk application URL
- Where to find publishable/secret keys
- How to add secrets in Encore
- Test credentials for development

---

## Related Issues

- **"Invalid token" errors:** Check ClerkSecretKey matches your app
- **"User not found" after sign-in:** Database not seeded, user record missing
- **Redirects to sign-in immediately:** Check auth guards in routes
- **Role not showing:** Set publicMetadata.role in Clerk user

See `CLERK_RBAC_SETUP.md` for detailed Clerk configuration.
