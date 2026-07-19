import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AiRecommendation } from "@/lib/organiser-hub-mock-data";

interface AiAssistantCardProps {
  recommendations: AiRecommendation[];
  className?: string;
}

export function AiAssistantCard({ recommendations, className }: AiAssistantCardProps) {
  return (
    <Card
      className={cn("shadow-sm hover:shadow-md transition-shadow bg-primary/5 border-primary/20", className)}
      data-testid="organiser-ai-assistant-card"
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="w-4 h-4 text-primary" />
          AI Assistant
        </CardTitle>
      </CardHeader>
      <CardContent>
        {recommendations.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2" data-testid="organiser-ai-assistant-empty">
            No recommendations right now — check back after your next session.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {recommendations.map((rec) => (
              <li
                key={rec.id}
                className="flex items-start gap-2 text-sm"
                data-testid={`organiser-ai-recommendation-${rec.id}`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-1.5" aria-hidden="true" />
                <span>{rec.message}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
