import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import heroImage from "@assets/118174652_3488272227872998_1093348718284959373_n_1764914380008.jpg";

const registerSchema = z.object({
  name: z.string().min(2, { message: "Имя должно содержать минимум 2 символа" }),
  email: z.string().email({ message: "Введите корректный email адрес" }),
  password: z.string().min(6, { message: "Пароль должен содержать минимум 6 символов" }),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Пароли не совпадают",
  path: ["confirmPassword"],
});

export default function PlayerRegistration() {
  const [isLoading, setIsLoading] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { register: authRegister } = useAuth();

  const registerForm = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  });

  const onRegister = async (data: z.infer<typeof registerSchema>) => {
    setIsLoading(true);
    try {
      await authRegister(data.email, data.password, data.name, "player");

      toast({
        title: "Аккаунт создан",
        description: "Добро пожаловать! Давайте настроим ваш профиль.",
      });
      
      setLocation("/player/profile");
    } catch (error: any) {
      toast({
        title: "Ошибка регистрации",
        description: error.message || "Пожалуйста, попробуйте снова.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex">
      {/* Left Side - Form */}
      <div className="w-full lg:w-1/2 flex flex-col p-8 md:p-12 lg:p-16 justify-center bg-background relative z-10">
        <Link href="/" className="absolute top-8 left-8 md:left-12 flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors cursor-pointer">
          <ArrowLeft className="w-4 h-4" />
          На главную
        </Link>

        <div className="max-w-md w-full mx-auto space-y-8">
          <div className="text-center lg:text-left">
            <h1 className="text-3xl md:text-4xl font-display font-bold mb-2">
              Присоединиться как <span className="text-primary">Игрок</span>
            </h1>
            <p className="text-muted-foreground">
              Находите партнеров, общайтесь с тренерами и улучшайте свою игру.
            </p>
          </div>

          <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reg-name">Полное имя</Label>
              <Input 
                id="reg-name" 
                placeholder="Иван Иванов" 
                {...registerForm.register("name")} 
                className={registerForm.formState.errors.name ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {registerForm.formState.errors.name && (
                <p className="text-sm text-destructive">{registerForm.formState.errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="reg-email">Электронная почта</Label>
              <Input 
                id="reg-email" 
                placeholder="name@example.com" 
                {...registerForm.register("email")} 
                className={registerForm.formState.errors.email ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {registerForm.formState.errors.email && (
                <p className="text-sm text-destructive">{registerForm.formState.errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="reg-password">Пароль</Label>
              <Input 
                id="reg-password" 
                type="password" 
                {...registerForm.register("password")} 
                className={registerForm.formState.errors.password ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {registerForm.formState.errors.password && (
                <p className="text-sm text-destructive">{registerForm.formState.errors.password.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Подтвердите пароль</Label>
              <Input 
                id="confirm-password" 
                type="password" 
                {...registerForm.register("confirmPassword")} 
                className={registerForm.formState.errors.confirmPassword ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {registerForm.formState.errors.confirmPassword && (
                <p className="text-sm text-destructive">{registerForm.formState.errors.confirmPassword.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full font-bold bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Создать аккаунт игрока
            </Button>
            
            <p className="text-xs text-center text-muted-foreground mt-4">
              Уже есть аккаунт? <Link href="/auth" className="underline hover:text-primary cursor-pointer">Войти</Link>
            </p>
          </form>
        </div>
      </div>

      {/* Right Side - Image */}
      <div className="hidden lg:block lg:w-1/2 relative">
        <div className="absolute inset-0 bg-black">
          <img 
            src={heroImage} 
            alt="Теннисист" 
            className="w-full h-full object-cover object-[50%_0%] opacity-80"
          />
          <div className="absolute inset-0 bg-gradient-to-l from-transparent via-black/20 to-black/80" />
          
          <div className="absolute bottom-16 left-12 right-12 text-white">
            <blockquote className="text-2xl font-display font-bold leading-relaxed mb-6">
              "Я нашла идеального партнера для игры на TennisConnect. Теперь мы играем каждые выходные!"
            </blockquote>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg">
                ЕС
              </div>
              <div>
                <div className="font-bold">Елена Смирнова</div>
                <div className="text-primary text-sm">Игрок с 2024 года</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
