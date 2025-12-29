# Skills Functionality - Complete Implementation

## Overview
The Skills functionality has been fully restored and enhanced with proper separation between the Overview tab (removed) and the dedicated Skills tab (fully functional).

## What Was Fixed

### 1. Removed Deprecated Skills Card from Overview Tab
**Problem:** The Overview tab had an old "Skills" card showing "Auto-added to dictionary" with a simple text input. This was confusing and conflicted with the proper Skills tab.

**Solution:** 
- Removed the entire Skills card from ProfileDetail Overview tab
- Removed associated state variables (`newSkill`) and handlers (`handleSkillAdd`, `handleSkillRemove`)
- Skills are now ONLY managed via the dedicated Skills tab

**Files Changed:**
- `/frontend/pages/ProfileDetail.tsx` - Lines 744-793 removed

### 2. Skills Tab - Fully Functional
**Location:** People → Individual Profile → Skills Tab

**Features:**
- ✅ View all assigned skills in a table with columns:
  - Skill name
  - Acquired date
  - Renewal date
  - Expiry date
  - Reminder date
  - Status (Valid/Warning/Expired)
  - Notes
  - Actions (Edit/Delete)

- ✅ Add skills via dropdown populated from global Skills Dictionary
- ✅ Custom skill entry option
- ✅ Per-person skill fields:
  - Acquired Date (manual)
  - Renewal Date (manual)
  - Expiry Date (manual)
  - Reminder Date (auto-calculated)
  - Notes (optional)

### 3. Auto-Calculation of Reminder Dates
**Requirement:** When an Expiry Date is set, the Reminder Date must automatically default to 30 days prior.

**Implementation:**
- Both Add and Edit dialogs now auto-calculate reminder date
- When user sets/changes expiry date, reminder date is automatically set to expiry - 30 days
- User can still manually override the reminder date if needed
- Clearing expiry date clears reminder date

**Code Location:** `/frontend/components/SkillsTab.tsx` lines 376-395 (Add dialog) and 483-502 (Edit dialog)

```typescript
onChange={(e) => {
  const newExpiryDate = e.target.value;
  setExpiryDate(newExpiryDate);
  if (newExpiryDate) {
    const expiry = new Date(newExpiryDate);
    const reminder = new Date(expiry);
    reminder.setDate(reminder.getDate() - 30);
    setReminderDate(reminder.toISOString().split('T')[0]);
  } else {
    setReminderDate('');
  }
}}
```

### 4. Calendar Integration
**Requirement:** When a skill has a Reminder Date, automatically create a calendar event.

**Implementation:**
- When adding a skill with a reminder date, a calendar event is automatically created
- Event type: "training" (shows in the in-app calendar)
- Event title: "Skill Renewal Reminder: [Skill Name]"
- Event description: "Reminder to renew [Skill Name] skill. Expires on [Expiry Date]."
- Event is all-day and assigned to the user
- Silent error handling - calendar creation failure won't prevent skill creation

**Code Location:** `/frontend/components/SkillsTab.tsx` lines 80-98

```typescript
if (data.reminder_date && userId) {
  try {
    await backend.calendar.create({
      title: `Skill Renewal Reminder: ${data.skill_name}`,
      description: `Reminder to renew ${data.skill_name} skill. Expires on ${data.expiry_date || 'N/A'}.`,
      event_type: "training",
      start_time: new Date(data.reminder_date),
      end_time: new Date(data.reminder_date),
      all_day: true,
      user_id: userId,
      is_watch_event: false,
      created_by: userId,
    });
  } catch (error) {
    console.error("Failed to create calendar reminder:", error);
  }
}
```

## Data Model

### Global Skills Dictionary
- **Table:** `dictionaries`
- **Filters:** `type = 'skill'`
- **Management:** WC/CC only via People dashboard "Manage Skills" button or Settings → Skills & Certs

### Per-Person Skills
- **Table:** `skill_renewals`
- **Columns:**
  - `id` - Primary key
  - `profile_id` - Links to firefighter profile
  - `skill_name` - Text (from dictionary or custom)
  - `acquired_date` - Date (optional)
  - `renewal_date` - Date (optional)
  - `expiry_date` - Date (optional)
  - `reminder_date` - Date (optional, auto-calculated)
  - `notes` - Text (optional)
  - `created_at`, `updated_at` - Timestamps

### Calendar Events
- **Table:** `calendar_events`
- **Created automatically** when skill has reminder_date
- **Type:** "training"
- **User-specific:** Shows in user's personal calendar

## Permissions

### Skills Tab
- **View:** All users can view skills on profiles
- **Edit:** Only WC and CC can add/edit/remove skills
- **Implemented via:** `useCanEditProfiles()` hook in SkillsTab component

### Skills Dictionary
- **View:** All users
- **Edit:** Only WC and CC
- **Implemented via:** RBAC checks in backend dictionary endpoints

## User Workflow

### Adding a Skill to a Person
1. Navigate to People → Click person → Skills tab
2. Click "Add Skill" button
3. Select skill from dropdown (or "Custom Skill" to enter new name)
4. Enter Acquired Date (optional)
5. Enter Renewal Date (optional)
6. **Enter Expiry Date** → Reminder Date auto-fills to 30 days before
7. Adjust Reminder Date if needed
8. Add notes (optional)
9. Click "Add Skill"
10. **Calendar event is automatically created** for the reminder date

### Editing a Skill
1. Click Edit button on skill row
2. Modify any fields
3. Changing expiry date re-calculates reminder date
4. Click "Save Changes"

### Deleting a Skill
1. Click Delete (trash icon) on skill row
2. Confirm deletion
3. Skill is removed from profile

## Status Calculations

Skills display real-time status badges:
- **Valid** (green): No expiry date OR expiry date > 30 days away
- **Warning** (yellow): Expiry date ≤ 30 days away OR reminder date has passed
- **Expired** (red): Expiry date has passed

**Logic:** Backend calculates in `/backend/skill/list.ts:calculateSkillStatus()`

## Integration Points

### 1. People Dashboard Filters
- Skills filter shows all skills from global dictionary
- Skills shown in People table match assigned skills from skill_renewals
- **Data sync:** Both read from same database tables

### 2. In-App Calendar
- Calendar shows "training" events for skill renewal reminders
- Navigate to Calendar → My Calendar or Watch Calendar
- Events are user-specific (only visible to assigned user)

### 3. Profile Overview
- Skills section **removed** from Overview tab
- Users must go to Skills tab for all skills management

## Testing Checklist

### ✅ Basic Functionality
- [x] Skills tab appears on all profiles
- [x] WC/CC can add skills
- [x] FF/RO cannot edit (view only)
- [x] Skills dropdown populated from global dictionary
- [x] Custom skills can be added
- [x] All date fields work correctly
- [x] Notes field saves properly
- [x] Edit dialog pre-fills with existing data
- [x] Delete removes skill

### ✅ Auto-Calculation
- [x] Setting expiry date auto-sets reminder to expiry - 30 days
- [x] Changing expiry date updates reminder date
- [x] Clearing expiry date clears reminder date
- [x] Manual override of reminder date works

### ✅ Calendar Integration
- [x] Adding skill with reminder creates calendar event
- [x] Calendar event appears in user's calendar
- [x] Event has correct title and description
- [x] Event is on the reminder date
- [x] Skill creation succeeds even if calendar fails

### ✅ Data Persistence
- [x] Skills persist to database
- [x] Skills appear in People table
- [x] Skills filterable in People dashboard
- [x] Skills show correct status badges
- [x] Dates display correctly

### ✅ Regression Prevention
- [x] Overview tab no longer has Skills card
- [x] No duplicate skills management UI
- [x] No confusion about where to manage skills

## Files Modified

### Frontend
1. `/frontend/pages/ProfileDetail.tsx`
   - Removed deprecated Skills card from Overview tab
   - Removed unused state/handlers
   - Pass userId prop to SkillsTab

2. `/frontend/components/SkillsTab.tsx`
   - Added userId prop
   - Implemented auto-calculation of reminder dates
   - Added calendar integration for reminder events
   - Updated dialog labels to indicate auto-calculation

### Backend
No backend changes required - all infrastructure already in place:
- ✅ skill_renewals table with reminder_date column
- ✅ dictionaries table with global skills
- ✅ calendar_events table for reminders
- ✅ All CRUD endpoints working

## Known Limitations

1. **Calendar Event Updates:** Currently, only skill creation creates calendar events. Updating a skill's reminder date does not update the corresponding calendar event. This would require:
   - Storing `calendar_event_id` in skill_renewals table
   - Adding logic to update/delete calendar events on skill edit/delete

2. **Calendar Event Deletion:** Deleting a skill does not automatically delete its calendar reminder. Users would need to manually delete the calendar event.

3. **Bulk Operations:** No bulk skill assignment or bulk reminder creation currently supported.

## Future Enhancements

1. **Full Calendar Sync:**
   - Store calendar_event_id with each skill
   - Update calendar event when skill/reminder date changes
   - Delete calendar event when skill deleted

2. **Skill Templates:**
   - Pre-populate common skill sets (e.g., "BA Operative" could add multiple related skills)

3. **Expiry Notifications:**
   - Email/SMS notifications at reminder date
   - Dashboard widget showing upcoming expirations

4. **Skill Reports:**
   - Report of all expired skills across all staff
   - Skills gap analysis

5. **Advanced Reminders:**
   - Multiple reminder dates (e.g., 60 days, 30 days, 7 days before expiry)
   - Escalation to line manager if not renewed

## Acceptance Criteria - ALL MET ✅

1. ✅ Skills tab is present and functional in every person profile
2. ✅ WC/CC can add a skill, set dates, and reminder auto-sets to expiry-30 days
3. ✅ Calendar reminder/event is automatically created for the reminder date
4. ✅ Skills shown in dashboard filters match global dictionary
5. ✅ Skills are selectable in profiles from global dictionary
6. ✅ No regression - Skills UI is clear and functional
7. ✅ Overview tab no longer has confusing Skills section
8. ✅ All data persists correctly to database
9. ✅ Permissions enforced (WC/CC edit, others view-only)

## Summary

The Skills functionality is now **fully functional and production-ready**:
- ✅ Clean separation: Overview tab for basic info, Skills tab for detailed skills management
- ✅ Auto-calculation of reminder dates saves time and reduces errors
- ✅ Calendar integration ensures users don't miss skill renewals
- ✅ Single source of truth: Global Skills Dictionary used everywhere
- ✅ Proper permissions: WC/CC manage, others view
- ✅ Complete data persistence and synchronization
