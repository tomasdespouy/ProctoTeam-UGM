# UGM ProctoTeam

This is a comprehensive online exam proctoring platform built for Universidad Gabriela Mistral (UGM) with Azure AD Single Sign-On, real-time exam monitoring, and AI-powered assistance.

## Tech Stack

- **Frontend**: Next.js 15.3.3 with App Router
- **Authentication**: Azure AD SSO via MSAL (Microsoft Authentication Library)
- **Database**: PostgreSQL (Replit)
- **AI**: Google Genkit with Gemini 1.5 Flash
- **UI**: shadcn/ui components with Tailwind CSS
- **Real-time Monitoring**: TensorFlow.js with COCO-SSD model

## Features

- Azure AD Single Sign-On for UGM institutional accounts
- Real-time exam monitoring with AI-powered behavior detection
- Instructor dashboard with live monitoring and alert management
- Student portal with exam interface and help system
- Super-admin portal for system-wide oversight
- Biometric identity verification using AI

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
   - `AZURE_CLIENT_SECRET`: Azure AD client secret
   - `DATABASE_URL`: PostgreSQL connection string
   - `GOOGLE_GENAI_API_KEY`: Google AI API key

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:5000](http://localhost:5000) with your browser to see the result.

## Authentication

The platform uses Azure AD SSO via MSAL for authentication:
- Tenant ID: `05970e72-c674-4f1f-8033-6e35dd7f76aa`
- Client ID: `e9f08a61-0e07-4a60-b825-c6041cdf0505`

## Database

PostgreSQL database with the following main tables:
- `users`: User profiles with Azure AD UID mapping
- `exam_sessions`: Exam configurations and student participation
- `alerts`: Proctoring alerts generated during exams
- `student_details`: Session completion details and timing

## License

This project is built for Universidad Gabriela Mistral.
