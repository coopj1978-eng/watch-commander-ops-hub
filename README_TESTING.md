# Testing Guide - Watch Commander Ops Hub

## Overview

This guide covers seed data setup and acceptance testing for the Watch Commander Operations Hub.

## Quick Start

### 1. Load Seed Data

The seed data file (`backend/db/seed.sql`) contains comprehensive test data:
- 15 users (1 WC, 2 CCs, 12 FFs)
- Complete firefighter profiles with qualifications
- 30 tasks across all categories
- 10 inspections with crew assignments
- 6 monthly targets
- 9 absences (including trigger stage examples)
- 5 policy documents with mocked vector IDs
- Calendar events and system settings

**To load:**
```bash
# Option 1: Via psql
psql <database_url> < backend/db/seed.sql

# Option 2: Via Encore Dashboard
# Copy/paste seed.sql contents into SQL editor
```

### 2. Create Test Accounts

Sign up via Clerk using these emails:
- **WC**: wc@firestation.local
- **CC**: cc1@firestation.local, cc2@firestation.local  
- **FF**: ff1@firestation.local through ff12@firestation.local

The backend will link Clerk accounts to seeded database records.

### 3. Run Manual Tests

See `ACCEPTANCE_TESTS.md` for detailed test procedures.

## Documentation Files

- **`SEED_DATA.md`** - Complete reference of all seeded data
- **`ACCEPTANCE_TESTS.md`** - Manual test procedures for 8 acceptance criteria
- **`backend/acceptance.test.ts`** - Automated test suite (requires seeded database)

## Acceptance Criteria

### ✅ Test 1: First User Becomes WC
Fresh system auto-promotes first authenticated user to Watch Commander role.

### ✅ Test 2: Admin Email Promotion
User with ADMIN_EMAIL becomes WC on first login, even when WCs exist.

### ✅ Test 3: CC Permissions
Crew Commanders can access /people, create persons, edit allowed fields (not role/rank).

### ✅ Test 4: FF Permissions  
Firefighters can only view own profile, cannot access /people index.

### ✅ Test 5: Sickness Absence Triggers
Adding sickness absence updates rolling 6-month totals and sets trigger stage badges.

### ✅ Test 6: Dictionary Updates
Skills/certifications changes in Settings immediately reflected in People forms.

### ✅ Test 7: Policy Q&A
Returns answers with citations when docs exist, shows "Not specified..." when absent.

### ✅ Test 8: Offboarding Wizard
WC can deactivate users with forced asset reassignment; deactivated users cannot sign in.

## Key Test Scenarios

### Role-Based Access Control
```
WC  → Full access to everything
CC  → Can manage assigned crews, limited profile editing  
FF  → Own profile only
RO  → Read-only access to profiles and reports
```

### Sickness Absence Triggers

Check these seeded users:
- **user_ff9** (Robert Brown): 4 episodes = **Stage 3 trigger**
- **user_ff5** (Tom Wilson): 2 episodes = **Stage 1/2 trigger**

Add new absences to test calculations.

### Offboarding Workflow

Test with user_ff1 (has assigned tasks):
1. Admin Panel → Users tab → Deactivate
2. Preview shows task count
3. Select replacement user
4. Reassign assets
5. Confirm deactivation
6. Verify user cannot sign in

### Policy Q&A

Seeded policies have mocked vector IDs:
- High-Rise Building Fire Safety Protocol
- Absence Management Policy  
- HFSV Guidelines
- Hydrant Inspection SOP
- Training and Development Framework

Ask questions about these topics to test Q&A responses.

## Running Automated Tests

```bash
cd backend
npm test acceptance.test.ts
```

**Note:** Automated tests require database to be seeded first. Some tests verify business logic in isolation.

## Resetting Environment

The seed script is idempotent - it begins with DELETE statements:
```sql
DELETE FROM calendar_events;
DELETE FROM activity_log;
-- ... etc
```

Re-run anytime to reset to clean state.

## Test Credentials Summary

| Role | Email | Password | Notes |
|------|-------|----------|-------|
| WC | wc@firestation.local | (set in Clerk) | Full admin |
| CC | cc1@firestation.local | (set in Clerk) | Manages FF1-FF6 |
| CC | cc2@firestation.local | (set in Clerk) | Manages FF7-FF12 |
| FF | ff1-ff12@firestation.local | (set in Clerk) | Various skills |

**Special Test Users:**
- **ff9@firestation.local** - Has Stage 3 sickness trigger
- **ff5@firestation.local** - Has Stage 1 sickness trigger  
- **ff8@firestation.local** - Has all qualifications (LGV, ERD, PRPS, BA)
- **ff11@firestation.local** - Recently joined (minimal quals)

## Known Test Data Characteristics

- **Overdue Tasks**: 3 tasks overdue for testing alerts
- **Pending Absences**: 1 absence awaiting approval (user_ff7)
- **Targets**: All at ~75% completion for current month
- **Inspections**: Mix of Planned/InProgress/Complete statuses
- **Calendar**: Events spread across current month

## Troubleshooting

### Tests Failing
- Ensure database migrations have run
- Load seed data before running tests
- Check database connection in `.env`

### Users Not Linking
- Clerk user ID must match seeded user ID, OR
- Email must match seeded email for auto-linking
- Check `backend/auth/auth.ts` for linking logic

### Missing Data
- Re-run seed.sql to reset
- Check for foreign key constraint errors
- Verify migrations applied in correct order

## Next Steps

After loading seed data:
1. Sign in with each role (WC, CC, FF) to experience different UIs
2. Run through all 8 manual acceptance tests
3. Test offboarding wizard end-to-end
4. Verify sickness trigger badges appear
5. Test policy Q&A with seeded documents
6. Modify dictionaries and verify form updates
7. Create new tasks/inspections
8. Generate reports

## Support

For issues or questions:
- Check `SEED_DATA.md` for data reference
- Check `ACCEPTANCE_TESTS.md` for test procedures  
- Review `backend/acceptance.test.ts` for expected behaviors
- Inspect database directly via Encore dashboard
