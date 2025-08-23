import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();
const prisma = new PrismaClient();

async function main() {
    const email = process.env.ADMIN_EMAIL || "admin@app.com";
    const password = process.env.ADMIN_PASSWORD || "uu123456";
    const role = process.env.ADMIN_ROLE as Role || Role.ADMIN;

    const existingAdmin = await prisma.user.findUnique({ where: { email } });

    if (!existingAdmin) {
        const hashedPassword = await bcrypt.hash(password, 10);

        await prisma.user.create({
            data: { email, password: hashedPassword, role, name: "Admin" },
        });

        console.log(`✅ Admin user created: ${email}`);
    } else {
        console.log("ℹ️ Admin already exists, skipping seed.");
    }
}

main()
    .catch((e) => {
        console.error("❌ Error seeding database:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
