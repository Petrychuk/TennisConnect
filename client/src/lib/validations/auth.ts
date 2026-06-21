import { z } from "zod";

export const registerSchema = z.object({
  role: z.enum(["player", "coach"], {
    required_error: "Please select a role",
  }),

  name: z
    .string()
    .min(2, {
      message: "Name must be at least 2 characters",
    }),

  email: z
    .string()
    .email({
      message: "Please enter a valid email address",
    }),

  password: z
    .string()
    .min(8, {
      message: "Password must be at least 8 characters",
    }),

  confirmPassword: z.string(),

  agreeToTerms: z.boolean().refine(
    (value) => value === true,
    {
      message:
        "You must accept the Terms of Service and Privacy Policy",
    }
  ),
})
.refine(
  (data) => data.password === data.confirmPassword,
  {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  }
);

export const loginSchema = z.object({
    email: z.string().email({ message: "Please enter a valid email address" }),
    password: z.string().min(6, { message: "Password must be at least 6 characters" }),
  });

export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(20, "Password is too long"),

    confirmPassword: z.string(),
  })
  .refine(
    (data) => data.password === data.confirmPassword,
    {
      message: "Passwords do not match",
      path: ["confirmPassword"],
    }
  );