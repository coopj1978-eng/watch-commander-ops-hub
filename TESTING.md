# Manual Acceptance Test Plan
## Watch Commander Ops Hub

### Prerequisites
1. Run database migrations: `encore db migrate`
2. Load seed data: Execute `/backend/db/seed.sql` against the database
3. Ensure application is running: `encore run`

---

## Test Credentials

| Role | Email | User ID | Password |
|------|-------|---------|----------|
| Watch Commander | wc@firestation.local | user_wc1 | *Set via Clerk* |
| Crew Commander 1 | cc1@firestation.local | user_cc1 | *Set via Clerk* |
| Crew Commander 2 | cc2@firestation.local | user_cc2 | *Set via Clerk* |
| Firefighter 1 | ff1@firestation.local | user_ff1 | *Set via Clerk* |
| Firefighter 2 | ff2@firestation.local | user_ff2 | *Set via Clerk* |
| Firefighter 3 | ff3@firestation.local | user_ff3 | *Set via Clerk* |
| Firefighter 4 | ff4@firestation.local | user_ff4 | *Set via Clerk* |

---

## Test 1: FF Sees Only Own Data

**Objective**: Verify that firefighters can only see their own assigned tasks and data

**Steps**:
1. Sign in as `ff1@firestation.local` (Michael Chen)
2. Navigate to **Tasks** page
3. Navigate to **Staff Portal** → **My Tasks**
4. Navigate to **Personal Calendar**

**Expected Results**:
- ✅ Tasks page shows only tasks assigned to user_ff1
- ✅ Should see: "Complete BA Training Recert", "HFSV Campaign - Elm Street", "Weekly Drill Attendance"
- ✅ Should NOT see tasks assigned to other firefighters
- ✅ Staff Portal shows only FF1's tasks and stats
- ✅ Personal Calendar shows only events/tasks for FF1
- ✅ No access to "People" page (should be hidden/restricted)

**Test Data**:
- FF1 has 3 tasks assigned
- FF1 is assigned to 2 inspections (Tower Heights, Metropolitan Tower)

---

## Test 2: CC Bulk Assign Tasks to 4 FFs

**Objective**: Verify crew commander can bulk assign tasks with staggered due dates

**Steps**:
1. Sign in as `cc1@firestation.local` (Lieutenant James Rodriguez)
2. Navigate to **Crew Commander Home** (/crew-home)
3. Scroll to **Quick Assign Tasks** section
4. Fill in the form:
   - **Task Title**: "Q4 Equipment Inventory Check"
   - **Category**: Admin
   - **Priority**: Med
   - **Start Date**: Today's date
   - **Stagger Days**: 2
   - **Description**: "Complete quarterly PPE and equipment audit"
5. Select 4 firefighters: FF1, FF2, FF3, FF4 (check their boxes)
6. Click **Assign Tasks**

**Expected Results**:
- ✅ Success toast notification appears
- ✅ 4 tasks created successfully
- ✅ Each task has staggered due dates (Day 0, Day 2, Day 4, Day 6)
- ✅ Navigate to each firefighter's calendar and verify task appears on their assigned due date
- ✅ Task appears in CC's crew task list

**Verification Steps**:
1. Sign out and sign in as `ff1@firestation.local`
2. Go to Personal Calendar
3. Verify "Q4 Equipment Inventory Check" appears on today's date
4. Repeat for FF2 (should be +2 days), FF3 (+4 days), FF4 (+6 days)

---

## Test 3: Policy Upload and Q&A with Citations

**Objective**: Verify policy document upload and AI-powered Q&A functionality

**Steps**:
1. Sign in as `wc@firestation.local` (Commander Sarah Mitchell)
2. Navigate to **Policies** page
3. Click **Upload Document** or similar upload button
4. Upload a sample PDF policy document (e.g., fire safety protocol)
5. Fill in metadata:
   - **Title**: "High-Rise Evacuation Procedures 2024"
   - **Category**: Operations
6. Click **Upload**
7. Wait for upload and processing to complete
8. Navigate to **Policy Q&A** page
9. Ask a question related to the uploaded document
   - Example: "What are the procedures for evacuating a high-rise building?"
10. Submit the question

**Expected Results**:
- ✅ PDF uploads successfully
- ✅ Document appears in policy list with correct metadata
- ✅ Policy Q&A page loads without errors
- ✅ Question submission works
- ✅ AI response includes relevant information from the document
- ✅ Response includes citations/references to the source document
- ✅ Query is saved in history (visible in policy query history)

**Note**: This test requires:
- Valid PDF file for upload
- Configured storage backend (Encore Object Storage)
- Configured AI/LLM integration for Q&A functionality

---

## Test 4: Calendar Month View with Colored Dots and Day Modal

**Objective**: Verify calendar visualization with event indicators and day detail modal

**Steps**:
1. Sign in as any user (e.g., `wc@firestation.local`)
2. Navigate to **Watch Calendar** page
3. Ensure **Month** view is selected
4. Observe the calendar grid for the current month

**Expected Results - Month View**:
- ✅ Calendar displays correct month and year
- ✅ Days with events/tasks show colored dots/indicators
- ✅ Different colors for different item types:
  - Tasks (check seed data for task due dates)
  - Calendar events (see seed data for event dates)
- ✅ Multiple items on same day show multiple dots
- ✅ Navigation arrows allow moving between months

**Steps - Day Modal**:
1. Click on a day that has colored dots (e.g., 5 days from now)
2. Observe the modal/popup that appears

**Expected Results - Day Modal**:
- ✅ Modal opens showing details for that specific day
- ✅ Modal title shows the selected date
- ✅ All items for that day are listed:
  - Tasks with titles, priorities, statuses
  - Events with titles and times
  - Inspections if scheduled for that day
- ✅ Items are organized/grouped by type
- ✅ Modal can be closed (X button or click outside)
- ✅ Clicking different days updates modal content

**Test Days** (based on seed data):
- Day with task: NOW() + 3 days (LGV Driver Assessment + Morning Briefing event)
- Day with multiple items: NOW() + 7 days (Hydrant Inspection Route 1 + Shift Debrief event)
- Day with calendar event only: Month day 5 (Safety Briefing - All Watch)

---

## Additional Verification Tests

### Test 5: Role-Based Dashboard Views
1. Sign in as WC → Should see full admin dashboard
2. Sign in as CC → Should see crew commander dashboard with "Go to Crew Home" button
3. Sign in as FF → Should see firefighter dashboard with limited data

### Test 6: Data Isolation
1. Sign in as CC1 (user_cc1)
2. Verify crew stats show only Blue Watch firefighters (6 FFs)
3. Sign in as CC2 (user_cc2)
4. Verify crew stats show same watch but different crew members

### Test 7: Absence Workflow
1. Sign in as FF3
2. Navigate to Staff Portal → Absence Request
3. Submit absence request
4. Sign in as CC1
5. Verify absence request appears in pending approvals (if implemented)

---

## Success Criteria

All tests must pass with:
- ✅ No console errors
- ✅ Correct data filtering by role
- ✅ Proper UI responsiveness (mobile and desktop)
- ✅ Accurate data display
- ✅ Functional navigation
- ✅ Toast notifications for user actions
- ✅ Loading states displayed appropriately

---

## Known Limitations

1. **Policy Q&A**: Requires actual PDF files to be uploaded (seed data only creates metadata)
2. **AI Citations**: Effectiveness depends on AI model configuration and document quality
3. **Calendar Colors**: May vary based on theme settings (light/dark mode)

---

## Troubleshooting

**Issue**: No tasks visible for firefighter
- Check user_id matches in seed data
- Verify assigned_to_user_id in tasks table

**Issue**: Bulk assign doesn't create tasks
- Check browser console for errors
- Verify CC has permission to create tasks
- Check backend logs for database errors

**Issue**: Calendar doesn't show dots
- Verify seed data loaded correctly (check calendar_events and tasks tables)
- Check date ranges (events might be outside current month view)
- Inspect browser console for rendering errors

**Issue**: Policy upload fails
- Verify Encore Object Storage is configured
- Check file size limits
- Review backend logs for storage errors
