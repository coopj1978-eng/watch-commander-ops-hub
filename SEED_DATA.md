# Seed Data Documentation

## Overview

The seed data (`backend/db/seed.sql`) populates a development environment with realistic test data for the Watch Commander Ops Hub application.

## Data Contents

### Users (15 total)

#### 1 Watch Commander (WC)
- **user_wc1**: Commander Sarah Mitchell (wc@firestation.local)
  - Full system admin access
  - Can manage all users, tasks, inspections, policies

#### 2 Crew Commanders (CC)
- **user_cc1**: Lieutenant James Rodriguez (cc1@firestation.local)
  - Manages 6 firefighters (FF1-FF6)
  - Can assign tasks and inspections
  - Can edit firefighter profiles (limited fields)

- **user_cc2**: Lieutenant Emma Thompson (cc2@firestation.local)
  - Manages 6 firefighters (FF7-FF12)
  - Can assign tasks and inspections
  - Can edit firefighter profiles (limited fields)

#### 12 Firefighters (FF)

**CC1's Crew:**
- **user_ff1**: Michael Chen - BA qualified, LGV driver
- **user_ff2**: Lisa Anderson - BA, PRPS specialist
- **user_ff3**: David Martinez - BA, Hazmat
- **user_ff4**: Rachel Green - Leading FF, BA, ERD driver
- **user_ff5**: Tom Wilson - BA, Swift Water (has 2 sickness episodes)
- **user_ff6**: Sarah Johnson - BA, LGV driver, Hazmat

**CC2's Crew:**
- **user_ff7**: Ahmed Hassan - BA, First Aid, Rope Rescue
- **user_ff8**: Maria Garcia - Leading FF, All qualifications (BA, LGV, ERD, PRPS)
- **user_ff9**: Robert Brown - BA, Hazmat (4 sickness episodes - Stage 3 trigger)
- **user_ff10**: Jennifer Lee - BA, Swift Water, First Aid
- **user_ff11**: Kevin O'Brien - BA only (recently joined)
- **user_ff12**: Sophie Taylor - BA, LGV driver, Rope Rescue

### Firefighter Profiles

All 12 FFs have complete profiles including:
- Service numbers (FF-YYYY-XXX format)
- Station assignment (Station A)
- Shift/Watch (Blue Watch)
- Ranks (Firefighter or Leading Firefighter)
- Hire dates (ranging from 2016-2021)
- Contact information
- Emergency contacts
- Skills arrays (BA, Driver, PRPS, First Aid, etc.)
- Certifications (BA Wearer, licenses, etc.)
- Qualification flags: `driver_lgv`, `driver_erd`, `prps`, `ba`
- One-to-one dates scheduled across next 2 months

### Tasks (30 total)

**By Category:**
- Training: 5 tasks (BA recert, First Aid, assessments)
- Inspection: 4 tasks (planning, hydrant checks, reports)
- HFSV: 4 tasks (campaigns, follow-ups, data entry)
- Admin: 6 tasks (inventory, records, maintenance)
- Other: 5 tasks (SOPs, fitness, mentoring)
- Overdue: 3 tasks (for testing)
- Completed: 3 tasks (for history)

**By Status:**
- NotStarted: 14
- InProgress: 9
- Done: 7

**By Priority:**
- High: 8
- Med: 14
- Low: 8

### Inspections (10 total)

**By Type:**
- HighRise: 3 (tower blocks, apartments)
- LocalProperty: 4 (school, care home, mall, sports center)
- Hydrant: 2 (district maintenance checks)
- Other: 1 (industrial warehouse)

**Status:**
- Planned: 8
- InProgress: 1
- Complete: 1

All inspections have crew assignments (1-3 personnel each).

### Targets (6 for current month)

| Metric | Target | Current | Progress |
|--------|--------|---------|----------|
| HFSV Completions | 150 | 112 | 75% |
| High-Rise Inspections | 8 | 6 | 75% |
| Hydrant Inspections | 50 | 38 | 76% |
| Training Certifications | 12 | 9 | 75% |
| Local Property Visits | 25 | 19 | 76% |
| Community Events | 4 | 3 | 75% |

### Absences (9 total)

**Testing Trigger Stages:**
- **user_ff9** (Robert Brown): 4 sickness episodes in 6 months = **Stage 3**
  - 3 days @ 120 days ago
  - 3 days @ 90 days ago
  - 3 days @ 60 days ago
  - 3 days @ 20 days ago

- **user_ff5** (Tom Wilson): 2 sickness episodes = **Stage 1**
  - 4 days @ 45 days ago
  - 3 days @ 30 days ago

**Other Absences:**
- user_ff3: 8 days AL (approved, future)
- user_ff7: 3 days sickness (pending approval)
- user_ff11: 3 days training (approved, future)

### Policy Documents (5 total)

All have mocked `vector_id` for testing Policy Q&A:

1. **High-Rise Building Fire Safety Protocol**
   - Category: Operations
   - Vector ID: `mock_vector_highrise_001`

2. **Absence Management Policy**
   - Category: HR
   - Vector ID: `mock_vector_absence_002`

3. **Home Fire Safety Visit Guidelines**
   - Category: Community
   - Vector ID: `mock_vector_hfsv_003`

4. **Hydrant Inspection SOP**
   - Category: Operations
   - Vector ID: `mock_vector_hydrant_004`

5. **Training and Development Framework**
   - Category: Training
   - Vector ID: `mock_vector_training_005`

### Calendar Events (10 total)

Spread across current month:
- Watch changeover
- Safety briefings
- Training sessions
- Station inspection
- Community open day
- Drills and exercises
- Fitness testing
- Equipment workshops

### Settings

**Absence Thresholds:**
```json
{
  "stage1Days": 7,
  "stage1Episodes": 3,
  "stage2Days": 10,
  "stage2Episodes": 4,
  "stage3Days": 14,
  "stage3Episodes": 5
}
```

**Branding:**
```json
{
  "stationName": "Station A - Blue Watch",
  "logo": "",
  "primaryColor": "#3B82F6"
}
```

**Skills & Certifications:**
```json
{
  "skills": [
    "BA",
    "Driver - LGV",
    "Driver - ERD",
    "PRPS",
    "First Aid",
    "Rope Rescue",
    "Swift Water",
    "Hazmat"
  ],
  "certifications": [
    "BA Wearer",
    "BA Team Leader",
    "LGV License",
    "ERD License",
    "PRPS Certified",
    "First Aid Level 3",
    "Technical Rescue",
    "Hazmat Operations"
  ]
}
```

## How to Load

### Via SQL

```bash
# Connect to your database
psql <database_url>

# Run seed file
\i backend/db/seed.sql
```

### Via Encore Dashboard

1. Open Encore local development dashboard
2. Navigate to Database section
3. Use SQL editor to paste and run `seed.sql` contents

## Resetting Data

The seed script begins with `DELETE` statements to clear existing data:

```sql
DELETE FROM calendar_events;
DELETE FROM activity_log;
DELETE FROM policy_queries;
DELETE FROM policy_documents;
DELETE FROM targets;
DELETE FROM absences;
DELETE FROM tasks;
DELETE FROM inspections;
DELETE FROM firefighter_profiles;
DELETE FROM users;
```

This ensures idempotent seeding - run it multiple times safely.

## Test Credentials

Use any of these emails to sign in (after creating accounts in Clerk):

**Watch Commander:**
- wc@firestation.local

**Crew Commanders:**
- cc1@firestation.local
- cc2@firestation.local

**Firefighters:**
- ff1@firestation.local through ff12@firestation.local

*Note: You must create these accounts in Clerk first, then the backend will link them to seeded user records based on matching IDs or emails.*

## Key Testing Scenarios

1. **User Roles**: Sign in as WC/CC/FF to test different permission levels
2. **Task Management**: View assigned tasks, update status, check overdue items
3. **Inspections**: See crew assignments, update progress
4. **Absence Triggers**: Check user_ff9 profile for Stage 3 badge
5. **Targets Dashboard**: View current month progress bars
6. **Policy Q&A**: Ask questions about seeded policies
7. **Calendar**: Month view should show various colored dots for events
8. **One-to-Ones**: Check upcoming/past one-to-one dates in crew view
