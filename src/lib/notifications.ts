import { prisma } from "@/lib/prisma";

export async function markQuoteNotificationsRead(quoteId: string) {
  return prisma.notification.updateMany({
    where: { quoteId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
}
