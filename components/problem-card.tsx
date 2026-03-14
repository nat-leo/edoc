import { ReactNode } from "react";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ProblemCardProps = {
  title: string;
  description?: ReactNode;
  badge?: ReactNode;
  content?: ReactNode;
  actions?: ReactNode;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  footerClassName?: string;
  titleClassName?: string;
};

export function ProblemCard({
  title,
  description,
  badge,
  content,
  actions,
  className,
  headerClassName,
  contentClassName,
  footerClassName,
  titleClassName,
}: ProblemCardProps) {
  const hasHeaderMeta = Boolean(description) || Boolean(badge);

  return (
    <Card className={cn("h-full", className)}>
      <CardHeader className={cn(hasHeaderMeta ? "gap-3" : "", headerClassName)}>
        {hasHeaderMeta ? (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className={cn("line-clamp-2 text-base", titleClassName)}>{title}</CardTitle>
              {description ? <CardDescription>{description}</CardDescription> : null}
            </div>
            {badge ? <div className="shrink-0">{badge}</div> : null}
          </div>
        ) : (
          <CardTitle className={cn("line-clamp-2 text-base", titleClassName)}>{title}</CardTitle>
        )}
      </CardHeader>

      {content ? <CardContent className={cn("pt-0", contentClassName)}>{content}</CardContent> : null}
      {actions ? <CardFooter className={cn("pt-0", footerClassName)}>{actions}</CardFooter> : null}
    </Card>
  );
}
