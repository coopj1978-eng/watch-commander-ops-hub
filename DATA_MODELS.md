# Watch Commander Ops Hub - Data Models & API Documentation

## Updated TypeScript Models

### User
```typescript
interface User {
  id: string;
  email: string;
  name: string;
  role: 'WC' | 'CC' | 'FF' | 'RO';
  watch_unit?: string;
  rank?: string;
  avatar_url?: string;
  last_login_at?: Date;
  created_at: Date;
  updated_at: Date;
}
```

### FirefighterProfile
```typescript
interface DriverQualifications {
  lgv: boolean;
  erd: boolean;
}

interface FirefighterProfile {
  id: number;
  user_id: string;
  service_number?: string;
  station?: string;
  shift?: string;
  rank?: string;
  hire_date?: Date;
  phone?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  skills?: string[];
  certifications?: string[];
  driver?: DriverQualifications;
  prps?: boolean;
  ba?: boolean;
  notes?: string;
  last_one_to_one_date?: Date;
  next_one_to_one_date?: Date;
  created_at: Date;
  updated_at: Date;
}
```

### Absence
```typescript
type AbsenceType = 'sickness' | 'AL' | 'TOIL' | 'parental' | 'other';

interface Absence {
  id: number;
  firefighter_id: string;
  type: AbsenceType;
  start_date: Date;
  end_date: Date;
  reason: string;
  docs?: string[];
  status: 'pending' | 'approved' | 'rejected';
  approved_by?: string;
  approved_at?: Date;
  created_at: Date;
  updated_at: Date;
}
```

### Task
```typescript
type TaskCategory = 'Training' | 'Inspection' | 'HFSV' | 'Admin' | 'Other';
type TaskStatus = 'NotStarted' | 'InProgress' | 'Blocked' | 'Done';
type TaskPriority = 'Low' | 'Med' | 'High';

interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

interface Task {
  id: number;
  title: string;
  description?: string;
  category: TaskCategory;
  assigned_to_user_id?: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_at?: Date;
  checklist?: ChecklistItem[];
  attachments?: string[];
  completed_at?: Date;
  created_at: Date;
  updated_at: Date;
}
```

### Inspection
```typescript
type InspectionType = 'HighRise' | 'LocalProperty' | 'Hydrant' | 'Other';
type InspectionStatus = 'Planned' | 'InProgress' | 'Complete';

interface Inspection {
  id: number;
  type: InspectionType;
  address: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  scheduled_for: Date;
  assigned_crew_ids?: string[];
  status: InspectionStatus;
  notes?: string;
  completed_date?: Date;
  created_at: Date;
  updated_at: Date;
}
```

### Target
```typescript
type TargetMetric = 'HFSV' | 'HighRise' | 'Hydrants' | 'Activities';

interface Target {
  id: number;
  period_start: Date;
  period_end: Date;
  metric: TargetMetric;
  target_count: number;
  actual_count: number;
  notes?: string;
  status: 'active' | 'completed' | 'at_risk' | 'overdue';
  created_at: Date;
  updated_at: Date;
}
```

### PolicyDoc
```typescript
interface PolicyDoc {
  id: number;
  title: string;
  category?: string;
  version?: string;
  file_url: string;
  vector_id?: string;
  uploaded_at: Date;
  review_date?: Date;
  total_pages?: number;
  created_at: Date;
  updated_at: Date;
}
```

### PolicyQuery
```typescript
interface Citation {
  doc_title: string;
  page: number;
}

interface PolicyQuery {
  id: number;
  asked_by_user_id: string;
  question: string;
  answer: string;
  citations: Citation[];
  confidence?: number;
  created_at: Date;
}
```

### ActivityLog
```typescript
interface ActivityLog {
  id: number;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  timestamp: Date;
  metadata?: any;
}
```

## Mock API Endpoints (Development)

All mock endpoints are prefixed with `/api/mock/` and return sample data for development:

### Users
- `GET /api/mock/users?role=WC` - Get mock users (filter by role optional)
- `GET /api/mock/users/:id` - Get single mock user

### Tasks
- `GET /api/mock/tasks?status=InProgress&assigned_to=user_1` - Get mock tasks
- `GET /api/mock/tasks/:id` - Get single mock task

### Inspections
- `GET /api/mock/inspections?status=Planned&type=HighRise` - Get mock inspections
- `GET /api/mock/inspections/:id` - Get single mock inspection

### Targets
- `GET /api/mock/targets?metric=HFSV&status=active` - Get mock targets
- `GET /api/mock/targets/:id` - Get single mock target

### Policies
- `GET /api/mock/policies/docs?category=Operations` - Get mock policy documents
- `GET /api/mock/policies/queries?user_id=user_1` - Get mock policy Q&A history
- `POST /api/mock/policies/ask` - Ask a mock policy question
  ```json
  { "question": "What is the minimum crew requirement?" }
  ```

## Production API Endpoints

All production endpoints require authentication (`auth: true`).

### Users
- `GET /users?role=WC&limit=50&offset=0` - List users
- `GET /users/:id` - Get user by ID
- `POST /users` - Create user
- `PATCH /users/:id` - Update user
- `DELETE /users/:id` - Delete user

### Firefighter Profiles
- `GET /profiles?limit=50&offset=0` - List profiles
- `GET /profiles/user/:user_id` - Get profile by user ID
- `POST /profiles` - Create profile
- `PATCH /profiles/user/:user_id` - Update profile

### Absences
- `GET /absences?user_id=&status=&start_date=&end_date=` - List absences
- `POST /absences` - Create absence
- `POST /absences/:id/approve` - Approve absence

### Tasks
- `GET /tasks?assigned_to=&status=&priority=` - List tasks
- `POST /tasks` - Create task
- `PATCH /tasks/:id` - Update task
- `DELETE /tasks/:id` - Delete task

### Inspections
- `GET /inspections?status=&type=` - List inspections
- `POST /inspections` - Create inspection
- `PATCH /inspections/:id` - Update inspection

### Targets
- `GET /targets?metric=&status=` - List targets
- `POST /targets` - Create target
- `PATCH /targets/:id` - Update target

### Policies
- `GET /policies` - List policy documents
- `POST /policies` - Upload policy document
- `GET /policies/:id/upload-url` - Get upload URL
- `GET /policies/:id/download-url` - Get download URL
- `POST /policies/ask` - Ask policy question (AI-powered)
- `GET /policies/queries` - Get policy query history

### Calendar Events
- `GET /calendar/events` - List events
- `POST /calendar/events` - Create event
- `PATCH /calendar/events/:id` - Update event
- `DELETE /calendar/events/:id` - Delete event

### Reports
- `POST /reports/export-csv` - Export data as CSV
- `POST /reports/import-staff-csv` - Import staff from CSV

### Admin
- `GET /admin/activity-log` - Get activity log

## Database Schema

All tables have been updated to match the new data models. See `/backend/db/migrations/` for the complete schema definitions.

## Notes

- All user_id fields are TEXT (Clerk uses string-based IDs)
- JSONB used for flexible data (checklist, citations)
- Arrays used for multi-value fields (skills, certifications, docs)
- Proper indexing on foreign keys and frequently queried fields
- Timestamps use TIMESTAMPTZ for timezone awareness
