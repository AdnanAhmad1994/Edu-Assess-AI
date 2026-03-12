import { storage } from "../server/storage";

async function main() {
  try {
    const quizzes = await storage.getQuizzes();
    console.log("Quizzes in DB:");
    for (const q of quizzes) {
      console.log(`- ID: ${q.id}, Title: ${q.title}, Status: ${q.status}, CourseId: ${q.courseId}`);
      const questions = await storage.getQuizQuestions(q.id);
      console.log(`  Count: ${questions.length} questions`);
    }
  } catch (error) {
    console.error("Error listing quizzes:", error);
  }
}

main();
