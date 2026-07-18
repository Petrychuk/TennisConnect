export const ORGANIZATION_TYPES = [
    "community",
    "club",
    "academy",
    "coach",
    "company",
  ] as const;
  
  export const ORGANIZATION_LISTING_TYPES = [
    "free",
    "featured",
    "premium",
  ] as const;
  
  export const ORGANIZATION_STATUSES = [
    "draft",
    "published",
    "inactive",
  ] as const;
  
  export const ORGANIZATION_MEMBER_ROLES = [
    "owner",
    "admin",
    "coach",
    "member",
  ] as const;
  
  export type OrganizationType = typeof ORGANIZATION_TYPES[number];
  export type OrganizationListingType =
    typeof ORGANIZATION_LISTING_TYPES[number];
  export type OrganizationStatus =
    typeof ORGANIZATION_STATUSES[number];
  export type OrganizationMemberRole =
    typeof ORGANIZATION_MEMBER_ROLES[number];