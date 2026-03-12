import { storage } from "../server/storage";

async function main() {
  try {
    const user = await storage.getUserByUsername("test_student");
    if (!user) {
      console.error("Test student not found");
      return;
    }
    const courses = await storage.getCourses();
    console.log(`Enrolling student ${user.username} in ${courses.length} courses...`);
    for (const c of courses) {
      await storage.createEnrollment({
        courseId: c.id,
        studentId: user.id,
      });
      console.log(`- Enrolled in course: ${c.name} (${c.code})`);
    }
  } catch (error) {
    console.error("Error enrolling student:", error);
  }
}

main();
