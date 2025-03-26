const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

async function main() {
  // Hash password sebelum disimpan
  const passwordHash = await bcrypt.hash("password123", 10);

  // Buat akun pengguna
  await prisma.user.createMany({
    data: [
      {
        id: "550e8400-e29b-41d4-a716-446655440000", // UUID bisa di-generate otomatis juga
        email: "mugiwara@gmail.com",
        password: passwordHash,
        name: "Daffa Gans",
      },
      {
        id: "550e8400-e29b-41d4-a716-446655440001",
        email: "user2@example.com",
        password: passwordHash,
        name: "123",
      },
    ],
    skipDuplicates: true, // Mencegah error jika data sudah ada
  });

  console.log("✅ Seeder selesai!");
}

main()
  .catch((e) => {
    console.error("❌ Error saat seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
