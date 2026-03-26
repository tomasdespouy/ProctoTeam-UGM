# Overview

UGM Proctor is an online exam proctoring platform for universities, designed to ensure academic integrity during remote examinations. It features AI-powered behavior detection, real-time video surveillance, and instructor dashboards for comprehensive oversight. The platform aims to provide a user-friendly experience for both students and instructors while maintaining high standards of exam security.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend
- **Framework**: Next.js with App Router
- **UI Library**: shadcn/ui built on Radix UI
- **Styling**: Tailwind CSS with custom design tokens and theme support
- **State Management**: React Context API
- **Animation**: Framer Motion

## Authentication & Authorization
- **Provider**: Azure AD Single Sign-On (SSO) via MSAL
- **Authentication Flow**: Azure AD redirects to `/auth/callback` with token, then to student/instructor portal.
- **User Roles**: 'student', 'instructor', and 'super-admin' roles with role-based access control.
- **Identity Verification**: AI-powered biometric verification (ID cards vs. live facial recognition).
- **Token Management**: JWT tokens from Azure AD validated server-side.
- **Unified Login**: Single entry point with automatic role detection based on email domain.

## AI Integration
- **Framework**: Google Genkit for AI workflow orchestration.
- **Model**: Google Gemini 1.5 Flash for NLP.
- **Use Cases**: Proctoring alert evaluation, student help desk, instructor support, biometric identity verification.
- **Proctoring Engine**: Modular AI architecture for face detection (presence, pose), object detection (prohibited items like cell phones), and behavior detection.
- **Detection Rules**: Alerts for multiple faces, no face, looking away, and prohibited objects. Includes spam prevention with cooldowns.

## Real-time Monitoring System
- **Computer Vision**: TensorFlow.js with COCO-SSD for object detection, MediaPipe Face Mesh for face detection and head pose.
- **Behavior Detection**: Custom algorithms for tab switching, audio spikes, multiple person detection, and face visibility.
- **Live Session Management**: In-memory service for real-time student tracking and alert management.
- **Mandatory Screen Sharing**: Students must share screen to join. Dead Man's Switch detects screen share termination, triggering critical alerts and blocking modals.
- **WebSocket Server**: Custom Next.js server with Socket.io for real-time communication, WebRTC signaling, and alert broadcasting.

## Data Architecture
- **Primary Database**: PostgreSQL (Replit) for persistent data storage.
- **Schema**: `users`, `exam_sessions`, `alerts`, `student_details`, `exam_alerts`.
- **Real-time Data**: In-memory session service.
- **Evidence Storage**: Snapshots uploaded to Replit Object Storage; alerts persisted in `exam_alerts` table.

## Component Structure
- **Student Portal**: Exam interface with monitoring and help systems.
- **Instructor Dashboard**: Live monitoring, alert management, analytics.
- **Super-Admin Portal**: System-wide oversight and analytics.
- **Shared Components**: Reusable UI elements, authentication, accessibility.

## Super-Admin System
- **Unified Login**: Authenticates via instructor login, then redirects based on role.
- **Enhanced Historic View**: System-wide exam history with student counts, instructor details, and cross-instructor analytics.
- **Supervisory Function**: Administrative oversight without exam creation privileges.

## Security Features
- **Permission Controls**: Camera/microphone access management.
- **Content Security**: Tab switching prevention and window focus monitoring.
- **Data Protection**: Secure handling of biometric data and exam recordings.
- **Role Validation**: Server-side role verification for access control.

# External Dependencies

## Core Services
- **Azure AD**: Enterprise Single Sign-On (SSO).
- **PostgreSQL (Replit → Supabase)**: Relational database — migration in progress. Real schema captured in `scripts/real-schema-dump.sql`.
- **Supabase**: Target platform for DB + Storage (MVP Free Tier). Client: `@supabase/supabase-js`. Storage bucket: `evidences`. Env vars needed: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- **Google AI**: Gemini 1.5 Flash via Genkit.

## Storage Migration Notes
- `src/app/api/exam/evidence/route.ts` migrated from Replit GCS sidecar (`@google-cloud/storage` + `http://127.0.0.1:1106`) to **Supabase Storage**.
- All DB queries (`pg` pool, raw SQL with `$1/$2`) remain unchanged — Supabase is PostgreSQL-compatible.
- `drizzle-orm` is installed but not used (db.ts uses raw `pg` Pool); decision pending on whether to adopt it.

## AI & Machine Learning
- **TensorFlow.js**: Client-side machine learning.
- **COCO-SSD Model**: Pre-trained model for object detection.
- **MediaPipe Face Mesh**: Real-time face detection and head pose estimation.
- **Google Genkit**: AI workflow framework.

## UI & Styling
- **Radix UI**: Headless component primitives.
- **Tailwind CSS**: Utility-first CSS framework.
- **Lucide React**: Icon library.
- **Google Fonts**: Typography (Inter and Space Grotesk).

## Development Tools
- **TypeScript**: Type safety.
- **React Hook Form**: Form management.
- **Date-fns**: Date manipulation.
- **Recharts**: Data visualization.
- **node-postgres (pg)**: PostgreSQL client.
- **Drizzle ORM**: Type-safe SQL toolkit.
- **@azure/msal-browser**: MSAL for browser.
- **@azure/msal-node**: MSAL for server.
- **jsonwebtoken**: JWT validation.

## Browser APIs
- **MediaDevices API**: Camera and microphone access.
- **Notifications API**: Browser notifications.
- **Visibility API**: Tab focus and window state monitoring.
- **Audio Context**: Audio level monitoring.