# EduAssess AI

## Overview

EduAssess AI is an intelligent educational assessment platform designed for instructors and students. The platform enables course management, AI-powered quiz generation using Google Gemini, assignment creation and grading, lecture content management with file uploads, and analytics dashboards. It includes proctoring features for quiz integrity and supports role-based access for administrators, instructors, and students.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript, using Vite as the build tool
- **Routing**: Wouter for client-side routing with protected route wrappers
- **State Management**: TanStack React Query for server state, React Context for auth state
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming (light/dark mode support)
- **Forms**: React Hook Form with Zod validation schemas

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **API Design**: RESTful JSON API endpoints under `/api/*`
- **Session Management**: Express-session with session-based authentication
- **Build**: esbuild for server bundling, Vite for client bundling

### Data Storage
- **Database**: PostgreSQL with Drizzle ORM
- **Schema Location**: `shared/schema.ts` contains all table definitions
- **Migrations**: Drizzle Kit for schema migrations (`db:push` command)
- **Object Storage**: Google Cloud Storage integration for file uploads via presigned URLs

### Authentication & Authorization
- **Method**: Session-based authentication with bcrypt password hashing
- **Roles**: Three user roles - admin, instructor, student
- **Middleware**: `requireAuth` and `requireInstructor` middleware for route protection
- **Session Storage**: Configured via express-session

### AI Integration
- **Provider**: Google Gemini via Replit AI Integrations (platform default) or user's own API key
- **Custom API Key**: Instructors/admins can add their own Gemini API key in Settings (/settings). The system uses the user's key when available, falling back to the platform default.
- **AI Client Helper**: `getAiClient(userId?)` in routes.ts returns appropriate GoogleGenAI client based on user's stored key
- **Models**: gemini-2.5-flash (fast), gemini-2.5-pro (advanced), gemini-2.5-flash-image (image generation)
- **Use Cases**: Quiz question generation, content summarization, AI-based grading, chatbot intent parsing
- **Batch Processing**: Utility for rate-limited batch AI operations with retry logic
- **Agentic Chatbot**: AI-powered assistant that can execute app commands via natural language (create quizzes, generate public links, list courses, view analytics)
- **Settings API Endpoints**:
  - `GET /api/settings/gemini-key` - Get key status (masked key)
  - `PUT /api/settings/gemini-key` - Save or remove API key
  - `POST /api/settings/test-gemini-key` - Validate a key against Gemini API

### Public Quiz Links
- **Access Token**: Each quiz can have a public access token for sharing
- **Permission Levels**: "view" (see questions/answers only) or "attempt" (take the quiz)
- **Identification**: Custom required fields (name, email) for anonymous users
- **No Auth Required**: Public quiz pages accessible without login
- **API Endpoints**: 
  - `POST /api/quizzes/:id/generate-public-link` - Generate public link
  - `GET /api/public/quiz/:token` - Access quiz data
  - `POST /api/public/quiz/:token/submit` - Submit quiz answers

### Key Design Patterns
- **Shared Schema**: Database types and Zod schemas shared between client and server via `@shared/*` path alias
- **Storage Interface**: Abstract storage interface (`IStorage`) for database operations
- **File Upload Flow**: Two-step presigned URL pattern - request URL from backend, upload directly to cloud storage

## External Dependencies

### Third-Party Services
- **Google Gemini AI**: Accessed via Replit AI Integrations for quiz generation and grading
- **Google Cloud Storage**: File storage for lecture materials and uploads
- **PostgreSQL**: Primary database (requires `DATABASE_URL` environment variable)

### Key NPM Packages
- **@google/genai**: Google Gemini AI client library
- **@google-cloud/storage**: GCS client for object storage
- **drizzle-orm / drizzle-kit**: Database ORM and migration tooling
- **@uppy/core, @uppy/aws-s3**: File upload handling with S3-compatible storage
- **express-session**: Session management middleware
- **bcryptjs**: Password hashing

### Environment Variables Required
- `DATABASE_URL`: PostgreSQL connection string
- `AI_INTEGRATIONS_GEMINI_API_KEY`: Gemini API key (via Replit AI Integrations)
- `AI_INTEGRATIONS_GEMINI_BASE_URL`: Gemini API base URL (via Replit AI Integrations)