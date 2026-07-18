export function getMemberSince(createdAt?: string | Date) {
    if (!createdAt) return "New";
  
    const created = new Date(createdAt);
    const now = new Date();
  
    const months =
      (now.getFullYear() - created.getFullYear()) * 12 +
      (now.getMonth() - created.getMonth());
  
    if (months <= 0) return "New";
  
    return `${months} m`;
  }

// e.g. "Jul 2026" — the month/year someone joined, abbreviated to 3
// letters. Replaces the old static "Member" label on profile stat cards.
export function getJoinedMonthLabel(createdAt?: string | Date) {
  if (!createdAt) return "—";

  const created = new Date(createdAt);
  return created.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}