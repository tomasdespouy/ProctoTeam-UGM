# Overview

UGM Proctor is a comprehensive online exam proctoring platform built for university settings. The system provides real-time monitoring capabilities for remote examinations, featuring AI-powered behavior detection, live video surveillance, and instructor dashboards for comprehensive exam oversight. The platform is designed to ensure academic integrity while providing a user-friendly experience for both students and instructors.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: Next.js 15.3.3 with App Router for modern React development
- **UI Library**: shadcn/ui components built on Radix UI primitives for consistent, accessible interface
- **Styling**: Tailwind CSS with custom design tokens and dark/light theme support
- **State Management**: React Context API for authentication, loading states, and theme management
- **Animation**: Framer Motion for smooth transitions and micro-interactions

## Authentication & Authorization
- **Provider**: Azure AD Single Sign-On (SSO) via MSAL (Microsoft Authentication Library) for UGM institutional accounts
- **Tenant**: UGM Azure AD (05970e72-c674-4f1f-8033-6e35dd7f76aa)
- **Client ID**: e9f08a61-0e07-4a60-b825-c6041cdf0505
- **Redirect URI**: `/auth/callback` - Standard OAuth2/OIDC callback endpoint
- **Production Domain**: `https://UGM-proctoring.replit.app`
- **Authentication Flow**: 
  - Users click login → MSAL popup/redirect → Azure AD authentication
  - Azure AD redirects to `/auth/callback` with token
  - Callback page processes token and redirects to appropriate portal (student/instructor)
- **User Roles**: Role-based access control with 'student', 'instructor', and 'super-admin' roles
- **Data Storage**: PostgreSQL (Replit) for user profiles and session data
- **Identity Verification**: AI-powered biometric verification comparing ID cards with live facial recognition
- **Token Management**: JWT tokens from Azure AD validated on the server using jsonwebtoken

## AI Integration
- **Framework**: Google Genkit for AI workflow orchestration
- **Model**: Google Gemini 1.5 Flash for natural language processing
- **Use Cases**: 
  - Proctoring alert evaluation and severity assessment
  - Student help desk automation
  - Instructor support system
  - Biometric identity verification

## Real-time Monitoring System
- **Computer Vision**: TensorFlow.js with COCO-SSD model for object detection
- **Behavior Detection**: Custom algorithms for suspicious activity identification including:
  - Tab switching and window focus monitoring
  - Audio spike detection for conversation monitoring
  - Multiple person detection in camera feed
  - Face visibility verification
- **Live Session Management**: In-memory service for real-time student tracking and alert management

## Data Architecture
- **Primary Database**: PostgreSQL (Replit) for persistent data storage with zero latency
- **Database Schema**: 
  - `users`: User profiles with Azure AD UID mapping
  - `exam_sessions`: Exam configurations and student participation
  - `alerts`: Proctoring alerts generated during exams
  - `student_details`: Session completion details and timing
- **Real-time Data**: In-memory session service for live monitoring capabilities
- **Session Management**: Temporary data structures for active exam sessions

## Component Structure
- **Student Portal**: Exam interface with video monitoring, requirements verification, and help systems
- **Instructor Dashboard**: Live monitoring grid, alert management, and analytics visualization
- **Super-Admin Portal**: Comprehensive historic dashboard with system-wide oversight capabilities
- **Shared Components**: Reusable UI elements, authentication flows, and accessibility controls

## Super-Admin System
- **Unified Login**: Super-admin users authenticate through the same instructor login interface
- **Role-Based Routing**: Automatic redirection to appropriate dashboard based on user role after login
- **Enhanced Historic View**: System-wide exam history with additional details including:
  - Number of students per session
  - Instructor names and information
  - Cross-instructor analytics and oversight
- **Supervisory Function**: Administrative oversight of all instructor activities without exam creation privileges

## Security Features
- **Permission Controls**: Camera and microphone access management
- **Content Security**: Tab switching prevention and window focus monitoring
- **Data Protection**: Secure handling of biometric data and exam recordings
- **Role Validation**: Server-side role verification for access control

# External Dependencies

## Core Services
- **Azure AD**: Enterprise Single Sign-On for UGM institutional authentication via MSAL
- **PostgreSQL (Replit)**: High-performance relational database with zero latency
- **Google AI**: Gemini 1.5 Flash model via Genkit for AI-powered features
- **Vercel/Deployment Platform**: Application hosting and serverless functions

## AI & Machine Learning
- **TensorFlow.js**: Client-side machine learning for real-time object detection
- **COCO-SSD Model**: Pre-trained model for person and object detection in video streams
- **MediaPipe Face Mesh**: Real-time face detection and head pose estimation
- **Google Genkit**: AI workflow framework for structured AI operations

## UI & Styling
- **Radix UI**: Headless component primitives for accessibility
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: Icon library for consistent iconography
- **Google Fonts**: Typography (Inter and Space Grotesk fonts)

## Development Tools
- **TypeScript**: Type safety and development experience
- **React Hook Form**: Form state management with validation
- **Date-fns**: Date manipulation and formatting
- **Recharts**: Data visualization for analytics dashboards
- **node-postgres (pg)**: PostgreSQL client for Node.js
- **Drizzle ORM**: Type-safe SQL toolkit for database operations
- **@azure/msal-browser**: Microsoft Authentication Library for browser-based authentication
- **@azure/msal-node**: Microsoft Authentication Library for server-side operations
- **jsonwebtoken**: JWT token validation and decoding

## Browser APIs
- **MediaDevices API**: Camera and microphone access for monitoring
- **Notifications API**: Browser notifications for alerts and messages
- **Visibility API**: Tab focus and window state monitoring
- **Audio Context**: Audio level monitoring for conversation detection

# Recent Changes (Jan 10, 2026)

## Block 5: Mandatory Screen Sharing
- **Blocking Setup Flow**: Three-phase initialization (camera → screen → ready)
  - Student cannot connect to instructor until both camera AND screen are shared
  - Explicit "Compartir Pantalla" button using `getDisplayMedia`
  - Error handling for cancelled/failed screen share attempts
- **Dead Man's Switch**: `track.onended` listener detects when student stops sharing
  - Triggers immediate `screen_share_ended` critical alert with snapshot
  - Activates full-screen blocking modal (z-50 fixed inset-0)
  - Disables all controls until screen sharing is restored
- **WebRTC Integration**: Screen track added to RTCPeerConnection
  - `addScreenTrackToWebRTC()` function handles track addition and renegotiation
  - `isRenegotiation` flag signals backend of updated offer
  - Screen feed reaches instructor alongside webcam feed

## Block 4: AI-Powered Proctoring Engine
- **Modular AI Architecture** (`src/lib/ai/`):
  - `face-detector.ts`: MediaPipe Face Mesh for presence detection (0/1/>1 faces) and head pose estimation (yaw/pitch/roll)
  - `object-detector.ts`: COCO-SSD for prohibited object detection (only 'cell phone' with 60%+ confidence)
  - `ai-coordinator.ts`: Central orchestration with debounce logic and cooldown timers
  - `index.ts`: Barrel exports for clean imports
- **Detection Rules**:
  - Multiple faces (>1): Immediate critical alert with snapshot
  - No face (0): Alert after 5 seconds continuous absence
  - Looking away: Alert after 5 seconds continuous deviation (yaw >30° or pitch >25°)
  - Cell phone: Immediate critical alert with snapshot
- **Spam Prevention**: 30-second cooldown between repeated alerts for same violation type
- **Event-Driven Snapshots**: Evidence captured only on alerts, instructor request, or AI detection (no periodic polling)
- **StudentCam Integration**: AI auto-initializes with visual status indicator (loading/active/error)

# Previous Changes (Jan 09, 2026)

## Block 3: Real-time Monitoring Infrastructure
- **WebSocket Server**: Custom Next.js server with Socket.io for real-time communication
  - Path: `/api/socket`
  - Handles WebRTC signaling (offer/answer/ICE candidates)
  - Manages exam room membership and student connections
  - Broadcasts alerts and snapshots to instructors
- **Evidence Storage**: `POST /api/exam/evidence` endpoint
  - Uploads snapshots to Replit Object Storage
  - Persists alerts in `exam_alerts` table with severity levels
  - Requires authentication via `getAuthenticatedUser`
- **Database**: New `exam_alerts` table
  - Related to `exam_participations` via `participation_id`
  - Tracks alert type, severity, evidence URL, and review status
- **Frontend Components**:
  - `ProctorView`: Instructor dashboard with video grid and alert panel
  - `StudentCam`: Student camera component with WebRTC streaming

## Exam Session Improvements
- **Recursive Access Code Generation**: System auto-generates unique 6-char codes without user intervention
- **Immutable started_at**: Prevents time fraud on student rejoin (ON CONFLICT preserves original timestamp)
- **Blocked Student Validation**: Join endpoint checks participation status before allowing entry

## Previous Changes (Nov 29, 2025)

### Authentication Fixes
- **Auth Context**: Now uses `idToken` instead of `accessToken` for API authentication
- **Token Refresh**: `getIdToken()` function now obtains fresh tokens on each call via `acquireTokenSilent`
- **Super-Admin Dashboard**: Fixed 401 errors by adding Authorization headers to API calls

### Live Session Service
- **Force Close Exam**: Added `forceCloseExam` method to properly terminate exams and mark all participants as submitted
- **Database Schema**: Uses `exam_participations` table for student session tracking

### Performance Optimizations
- **Proctoring Panel**: Image snapshots optimized to 320px width with 0.4 JPEG quality (~5KB per image)
- **Update Frequency**: Snapshots sent every 5 seconds to minimize bandwidth