import pg from "pg";
const { Pool } = pg;

async function applyCascade() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log("Applying cascade delete constraint...");

    // 1. Drop the existing foreign key constraint
    // We try multiple possible names just in case
    const constraints = ["courses_instructor_id_users_id_fk"];
    
    for (const constraint of constraints) {
      try {
        await pool.query(`ALTER TABLE "courses" DROP CONSTRAINT IF EXISTS "${constraint}"`);
        console.log(`Dropped constraint: ${constraint}`);
      } catch (e: unknown) {
        if (e instanceof Error) {
          console.log(`Could not drop ${constraint}:`, e.message);
        } else {
          console.log(`Could not drop ${constraint}:`, e);
        }
      }
    }

    // 2. Add the new constraint with ON DELETE CASCADE
    await pool.query(`
      ALTER TABLE "courses" 
      ADD CONSTRAINT "courses_instructor_id_users_id_fk" 
      FOREIGN KEY ("instructor_id") 
      REFERENCES "users"("id") 
      ON DELETE CASCADE
    `);
    
    console.log("✅ Successfully applied ON DELETE CASCADE to courses.instructor_id");

  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("❌ Failed to apply SQL changes:", error.message);
    } else {
      console.error("❌ Failed to apply SQL changes:", error);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

applyCascade();
