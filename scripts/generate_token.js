const { PrismaClient } = require("@prisma/client");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
    }
  });

  console.log("\nAvailable Users in Database:");
  console.log("============================");
  users.forEach((u, i) => {
    console.log(`${i + 1}. Name: ${u.name} | Email: ${u.email} | Role: ${u.role} | ID: ${u.id}`);
  });

  if (users.length === 0) {
    console.log("No users found in database.");
    return;
  }

  console.log("\nGenerated JWT Access Tokens (Valid for 7 days):");
  console.log("===============================================");
  for (const user of users) {
    const payload = {
      id: user.id,
      role: user.role,
      jti: `${user.id}-${Date.now()}`
    };
    
    const secret = process.env.JWT_ACCESS_SECRET || "learnflow_access_secret_super_secure_key_2024";
    const token = jwt.sign(payload, secret, { expiresIn: "7d" });
    
    console.log(`\nUser: ${user.name} (${user.role})`);
    console.log(`Email: ${user.email}`);
    console.log(`Token: Bearer ${token}`);
  }
}

main()
  .catch(e => {
    console.error("Error generating token:", e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
