# Acceptance Tests - Watch Commander Ops Hub

## Setup & Seed Data

### Loading Seed Data

To populate the development database with test data:

1. Ensure database migrations have run (automatic in Encore)
2. Load seed data manually via SQL:
   ```bash
   psql <database_connection> < backend/db/seed.sql
   ```

### Seed Data Contents

**Users (15 total):**
- 1 Watch Commander (WC): Commander Sarah Mitchell
- 2 Crew Commanders (CC): Lt. James Rodriguez, Lt. Emma Thompson
- 12 Firefighters (FF): Mix of skills (PRPS/BA/Drivers)

**Profiles:**
- Complete firefighter profiles for all 12 FFs
- Various qualifications: BA, LGV, ERD, PRPS, First Aid, etc.
- One-to-one dates spread across months

**Tasks (30):**
- Training (5): BA recert, First Aid, LGV assessment, etc.
- Inspection (4): Pre-inspection planning, hydrant checks, etc.
- HFSV (4): Home fire safety visits and campaigns
- Admin (6): Equipment inventory, training records, etc.
- Other (5): SOP reviews, uniform requests, fitness tests, etc.
- Mixed statuses: NotStarted, InProgress, Done
- Some overdue for testing

**Inspections (10):**
- 3 High-Rise buildings
- 4 Local properties (school, care home, mall, sports center)
- 2 Hydrant districts
- 1 Industrial/Other
- Crew assignments with mixed statuses

**Targets (6 for current month):**
- HFSV Completions: 112/150
- High-Rise Inspections: 6/8
- Hydrant Inspections: 38/50
- Training Certifications: 9/12
- Local Property Visits: 19/25
- Community Events: 3/4

**Absences (9):**
- Covering all trigger stages
- Multiple sickness episodes for user_ff9 (Stage 3 trigger)
- user_ff5 has 2 episodes within 6 months (Stage 1/2)
- Approved and pending statuses

**Policies (5 PDFs with mocked vector IDs):**
- High-Rise Building Fire Safety Protocol
- Absence Management Policy
- Home Fire Safety Visit Guidelines
- Hydrant Inspection SOP
- Training and Development Framework

**Settings:**
- Absence thresholds configured
- Branding (Station A - Blue Watch)
- Skills and certifications list

---

## Manual Acceptance Tests

### Test 1: Fresh System - First User Becomes WC

**Steps:**
1. Clear all users: `DELETE FROM users;`
2. Sign up as first user via Clerk
3. Verify you're assigned WC role automatically
4. Access `/people` - should work
5. Create a new person - should succeed

**Expected:**
- First authenticated user auto-promoted to WC
- Can access /people endpoint
- Can create firefighter profiles

---

### Test 2: ADMIN_EMAIL User Becomes WC

**Steps:**
1. Set `ADMIN_EMAIL` secret in Encore settings
2. Ensure at least one WC exists
3. Sign in with admin email account
4. Check role in database

**Expected:**
- Admin email user promoted to WC on first login
- Even when other WCs exist

---

### Test 3: CC Permissions

**Steps:**
1. Sign in as CC user (cc1@firestation.local or cc2@firestation.local)
2. Navigate to `/people`
3. Try to create a person
4. Edit an existing profile:
   - Try editing `phone`, `notes`, `skills` (should work)
   - Try editing `role`, `rank`, `watch_unit` (should be locked)

**Expected:**
- CC can access /people index
- CC can create new persons
- CC can edit allowed fields but not WC-restricted fields

---

### Test 4: FF Permissions

**Steps:**
1. Sign in as FF user (ff1@firestation.local through ff12@firestation.local)
2. Try accessing `/people` (should redirect or show unauthorized)
3. Access `/profile` or personal dashboard
4. Try to view another FF's profile via URL manipulation

**Expected:**
- FF cannot access /people index
- FF can view only their own profile
- Attempting to view others' profiles blocked

---

### Test 5: Sickness Absence Triggers

**Steps:**
1. Sign in as WC
2. Navigate to People → select user_ff9 (should show Stage 3 trigger)
3. Check user_ff5 (should show Stage 1 or 2)
4. Add new sickness absence to a clean user:
   - Add 8 days sickness → should trigger Stage 1
   - Add 4 episodes → should trigger Stage 1
5. View absence stats on profile page

**Expected:**
- Rolling 6-month sickness calculations work
- Trigger stages set based on thresholds:
  - Stage 1: 7+ days OR 3+ episodes
  - Stage 2: 10+ days OR 4+ episodes
  - Stage 3: 14+ days OR 5+ episodes
- Badge/indicator shown on profile

---

### Test 6: Dictionary Updates

**Steps:**
1. Sign in as WC
2. Go to Settings → Skills & Certifications tab
3. Add new skill: "Drone Operator"
4. Add new cert: "Drone License"
5. Save changes
6. Navigate to People → Create/Edit person
7. Open Skills dropdown

**Expected:**
- New skill "Drone Operator" appears immediately
- New cert "Drone License" appears immediately
- No page refresh needed

---

### Test 7: Policy Q&A

**Steps:**
1. Sign in as any user
2. Navigate to Policies → Q&A tab
3. Ask: "What is the absence management policy?"
   - Should return answer with citation (mocked vector ID)
4. Ask about non-existent topic: "What is the space exploration policy?"
   - Should return "Not specified in current documentation"

**Expected:**
- When policy doc exists with vector_id, answer returned with citations
- When no matching policy, show "Not specified..." message
- Query history logged

---

### Test 8: Offboarding Wizard

**Steps:**
1. Sign in as WC
2. Navigate to Admin Panel → Users tab
3. Select an FF user with assigned tasks/inspections
4. Click "Deactivate" button
5. **Step 1**: Set deactivation date, add reason
   - Should show count of assets to reassign
6. **Step 2**: Select replacement user
   - Check boxes for tasks, inspections, absences
7. **Step 3**: Review summary
8. Confirm deactivation

**Expected:**
- Preview shows counts of tasks, inspections, pending approvals
- Must select replacement if any assets need reassignment
- All selected assets reassigned to replacement
- User marked `is_active = false`
- Deactivated user cannot sign in (test by signing out and back in)
- Activity log entry created

**Additional Checks:**
- Try to deactivate yourself → should be prevented
- If only 1 active WC, try to deactivate them → should be prevented with error message

---

## Running Automated Tests

```bash
cd backend
npm test acceptance.test.ts
```

**Note:** Tests require seed data to be loaded first. Some tests are integration tests that verify business logic rather than full end-to-end flows.

---

## Success Criteria Summary

✅ **Test 1**: First user auto-promoted to WC with full admin access
✅ **Test 2**: ADMIN_EMAIL user always gets WC role
✅ **Test 3**: CC has limited permissions (can view/edit but not change roles)
✅ **Test 4**: FF restricted to own profile only
✅ **Test 5**: Sickness absence rolling calculations and trigger stages work
✅ **Test 6**: Dictionary changes immediately reflected in forms
✅ **Test 7**: Policy Q&A returns contextual answers or "not specified"
✅ **Test 8**: Offboarding wizard with asset reassignment and deactivation guards
