# Clerk Configuration Guide

## Email + Password & Magic Link Setup

1. **Open Clerk Dashboard**: Navigate to your Clerk application dashboard
2. **Configure Authentication Methods**:
   - Go to **User & Authentication** → **Email, Phone, Username**
   - Enable **Email address**
   - Enable **Password** authentication
   - Enable **Email verification code** (Magic Link)

3. **Set up roles in Clerk**:
   - Go to **User & Authentication** → **Metadata**
   - Add custom `publicMetadata` field for roles
   - Roles: `WC`, `CC`, `FF`, `RO`

4. **Example user creation with role**:
   ```javascript
   // When creating a user in Clerk Dashboard or via API
   publicMetadata: {
     role: "WC" // or "CC", "FF", "RO"
   }
   ```

## Role-Based Access Control (RBAC)

### Role Permissions Matrix

| Permission | WC | CC | FF | RO |
|------------|----|----|----|----|
| Full Admin | ✅ | ❌ | ❌ | ❌ |
| Manage All Users | ✅ | ❌ | ❌ | ❌ |
| Manage All Tasks | ✅ | ✅* | ❌ | ❌ |
| Manage All Inspections | ✅ | ✅* | ❌ | ❌ |
| View All Profiles | ✅ | ✅ | ❌ | ✅ |
| Edit All Profiles | ✅ | ⚠️** | ❌ | ❌ |
| View Own Profile | ✅ | ✅ | ✅ | ✅ |
| Edit Own Profile | ✅ | ✅ | ✅ | ❌ |
| Create Policies | ✅ | ❌ | ❌ | ❌ |
| View Policies | ✅ | ✅ | ✅ | ✅ |
| Export Reports | ✅ | ✅ | ❌ | ✅ |
| View Activity Log | ✅ | ❌ | ❌ | ❌ |

*CC: Only for assigned crews
**CC: Limited fields for assigned firefighters only

## Setting User Roles

You can set roles via the Clerk Dashboard or programmatically:

### Via Clerk Dashboard:
1. Go to **Users**
2. Select a user
3. Click **Metadata** tab
4. Add to **Public metadata**:
   ```json
   {
     "role": "WC",
     "watch_unit": "Red Watch",
     "rank": "Watch Commander"
   }
   ```

### Via Clerk API:
```typescript
import { clerkClient } from "@clerk/clerk-sdk-node";

await clerkClient.users.updateUserMetadata(userId, {
  publicMetadata: {
    role: "CC",
    watch_unit: "Blue Watch",
    rank: "Crew Commander"
  }
});
```

## Authentication Flow

1. User signs in via email+password or magic link
2. Clerk validates credentials
3. Backend auth handler extracts role from `publicMetadata`
4. Role is included in `AuthData` for all authenticated requests
5. Sign-in event is logged to ActivityLog
6. Frontend receives user data with role
7. Route guards enforce role-based access

## Example Role Assignment

```typescript
// Watch Commander
{
  email: "john.smith@fire.gov.uk",
  publicMetadata: {
    role: "WC",
    watch_unit: "Red Watch",
    rank: "Watch Commander"
  }
}

// Crew Commander
{
  email: "sarah.jones@fire.gov.uk",
  publicMetadata: {
    role: "CC",
    watch_unit: "Red Watch",
    rank: "Crew Commander",
    assigned_crews: ["crew_1", "crew_2"]
  }
}

// Firefighter
{
  email: "mike.wilson@fire.gov.uk",
  publicMetadata: {
    role: "FF",
    watch_unit: "Red Watch",
    rank: "Firefighter"
  }
}

// Read-Only (Admin, HR, etc.)
{
  email: "admin@fire.gov.uk",
  publicMetadata: {
    role: "RO",
    department: "Administration"
  }
}
```
