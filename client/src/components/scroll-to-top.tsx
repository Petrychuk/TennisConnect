import { useEffect } from "react";
import { useLocation } from "wouter";

export function ScrollToTop() {
  const [location] = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    // Если идём к секции на главной —
    // не скроллим наверх
    if (params.get("section")) {
      return;
    }

    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "auto",
    });
  }, [location]);

  return null;
}