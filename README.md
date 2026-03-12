# Edu-Assess-AI

Edu-Assess-AI is a premium, AI-powered educational assessment platform designed to streamline quiz creation, delivery, and analysis. It provides instructors with powerful tools to generate assessments using AI, schedule them with precision, and monitor student performance through advanced analytics.

## 🚀 Key Features

### 🧠 AI-Powered Quiz Generation
- **Intelligent Creation**: Generate high-quality MCQs from text descriptions or uploaded lecture materials.
- **Provider Support**: Seamless integration with multiple AI providers (Groq, OpenAI, Google Gemini).
- **Customizable Difficulty**: Tailor questions based on difficulty levels (Easy, Medium, Hard).

### 📅 Advanced Quiz Scheduling
- **Precise Timing**: Set exact **Start** and **End** dates and times for quiz availability.
- **Automated Locking**: Quizzes automatically become available when scheduled and lock immediately upon expiration.
- **Live Status Badges**: Students see real-time "Upcoming", "Available", or "Expired" statuses with exact time windows.

### 🛡️ Smart Proctoring & Anti-Cheat
- **Violation Tracking**: Monitor browser focus loss and tab switching during attempts.
- **Pattern Detection**: Advanced logic to identify suspicious behavior.
- **Violation Thresholds**: Set customizable limits for allowed violations before flagging.

### 📊 Comprehensive Analytics & Gradebook
- **Instructor Dashboard**: Overview of total students, average scores, and pending grading.
- **Visual Performance Charts**: Dynamic score distribution and performance trend visualization using Recharts.
- **Dynamic Gradebook**: Real-time access to student performance across all courses and quizzes.
- **Recent Performance tracking**: Keep track of the latest student submissions and scores.

### 👥 Role-Based Access Control
- **Admin**: Full system management, user control, and global settings.
- **Instructor**: Manage courses, create quizzes, and analyze student results.
- **Student**: Attempt assigned quizzes, view results, and track progress.

---

## 🛠️ Technology Stack

- **Frontend**: React, Vite, Tailwind CSS, Lucide Icons, Recharts, Radix UI.
- **Backend**: Node.js, Express.
- **Database**: Supabase (PostgreSQL) with Drizzle ORM.
- **State Management**: TanStack Query (React Query).
- **Authentication**: Passport.js with Session Management.
- **AI Integration**: Groq SDK, Google Generative AI.

---

## ⚙️ Getting Started

### Prerequisites
- Node.js (v18+)
- Supabase Account (for PostgreSQL)

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Abdulrahman50ab/Edu-Access-.git
   cd Edu-Access-
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env` file in the root directory and add the following:
   ```env
   DATABASE_URL=your_postgres_url
   GROQ_API_KEY=your_groq_api_key
   GENAI_API_KEY=your_google_ai_key
   SESSION_SECRET=your_secure_secret
   ```

4. **Database Push**:
   ```bash
   npm run db:push
   ```

5. **Run the development server**:
   ```bash
   npm run dev
   ```

---

## 🎨 UI/UX Design

Edu-Assess-AI features a premium, responsive design with:
- **Glassmorphism effects**
- **Sleek Dark Mode support**
- **Smooth micro-animations**
- **Modern typography (Inter/Geist)**

---

## 📜 License

This project is licensed under the MIT License.
