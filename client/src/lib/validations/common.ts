// src/lib/validations/common.ts

/**
 * Удаляем лишние пробелы
 */
export const cleanText = (value: string) => {
    return value.trim().replace(/\s+/g, " ");
  };
  
  /**
   * Удаляем потенциально опасные HTML символы
   */
  export const sanitizeInput = (value: string) => {
    return value
      .trim()
      .replace(/<script.*?>.*?<\/script>/gi, "")
      .replace(/javascript:/gi, "")
      .replace(/onerror=/gi, "")
      .replace(/onclick=/gi, "")
      .replace(/[<>]/g, "");
  };
  
  /**
   * Проверка URL
   */
  export const isValidUrl = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };
  
  /**
   * Проверка телефона AU
   */
  export const isValidPhone = (phone: string) => {
    return /^(\+61|0)[0-9]{9}$/.test(phone);
  };
  
  /**
   * Проверка slug
   */
  export const isValidSlug = (slug: string) => {
    return /^[a-z0-9-]+$/.test(slug);
  };