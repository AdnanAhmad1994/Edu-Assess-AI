import { storage } from "../server/storage";
import bcrypt from "bcryptjs";

async function main() {
  try {
    const hashedPassword = await bcrypt.hash("password123", 10);
    const user = await storage.createUser({
      username: "test_student",
      password: hashedPassword,
      name: "Test Student",
      email: "test_student@example.com",
      role: "student",
    });
    console.log("Test student created:", user.username);
  } catch (error) {
    console.error("Error creating test student:", error);
  }
}

main();
