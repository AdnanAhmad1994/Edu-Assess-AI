import { storage } from "../server/storage";

async function main() {
  try {
    const users = await storage.getUsers();
    console.log("Users in DB:");
    users.forEach(u => {
      console.log(`- Username: ${u.username}, Role: ${u.role}, Email: ${u.email}`);
    });
  } catch (error) {
    console.error("Error listing users:", error);
  }
}

main();
