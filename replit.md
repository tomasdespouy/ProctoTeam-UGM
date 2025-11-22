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
  - Users click login → MSAL loginRedirect() → Azure AD authentication
  - Azure AD redirects to `/auth/callback` with authorization code in URL hash
  - Callback page processes redirect using handleRedirectPromise()
  - **CRITICAL ORDER**: Must process redirect BEFORE cleaning sessionStorage states (MSAL needs correlation states)
  - After successful auth, set active account and redirect to appropriate portal
- **User Roles**: Role-based access control with 'student', 'instructor', and 'super-admin' roles
- **Data Storage**: PostgreSQL (Replit) for user profiles and session data
- **Identity Verification**: AI-powered biometric verification comparing ID cards with live facial recognition
- **Token Management**: JWT tokens from Azure AD validated on the server using jsonwebtoken
- **MSAL State Management**: 
  - Clean interaction states BEFORE loginRedirect() to prevent "interaction_in_progress" errors
  - NEVER clean states before handleRedirectPromise() or it returns null
  - Clean states AFTER successful redirect processing in callback

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