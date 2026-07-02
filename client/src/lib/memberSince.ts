export function getMemberSince(createdAt?: string | Date) {
    if (!createdAt) return "New";
  
    const created = new Date(createdAt);
    const now = new Date();
  
    const months =
      (now.getFullYear() - created.getFullYear()) * 12 +
      (now.getMonth() - created.getMonth());
  
    if (months <= 0) return "New";
  
    return `${months}m`;
  }