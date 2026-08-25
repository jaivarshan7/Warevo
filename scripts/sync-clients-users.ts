import { PrismaClient, Role, UserStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function syncClientsToUsers() {
  console.log("Checking for unlinked client records...");
  const unlinkedClients = await prisma.client.findMany({
    where: { userId: null },
  });

  console.log(`Found ${unlinkedClients.length} unlinked clients.`);

  for (const client of unlinkedClients) {
    // Check if user exists with same mobile or email
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { mobile: client.mobile },
          ...(client.email ? [{ email: client.email }] : []),
        ],
      },
    });

    if (existingUser) {
      await prisma.client.update({
        where: { id: client.id },
        data: { userId: existingUser.id },
      });
      console.log(`Linked ${client.companyName} → ${client.contactPerson} to existing user "${existingUser.name}"`);
    } else {
      const newUser = await prisma.user.create({
        data: {
          tenantId: client.tenantId,
          name: client.contactPerson,
          mobile: client.mobile,
          email: client.email,
          role: Role.CLIENT,
          status: UserStatus.ACTIVE,
        },
      });

      await prisma.client.update({
        where: { id: client.id },
        data: { userId: newUser.id },
      });

      console.log(`Created USER for ${client.companyName} → ${client.contactPerson} (${client.mobile})`);
    }
  }

  console.log("Sync complete!");
}

syncClientsToUsers()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
