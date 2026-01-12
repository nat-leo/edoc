"use client"

import * as React from "react"
import { GripVerticalIcon } from "lucide-react"
import { Group, Panel, Separator } from "react-resizable-panels"

import { cn } from "@/lib/utils"

const ResizablePanelGroup = React.forwardRef<
  React.ElementRef<typeof Group>,
  React.ComponentPropsWithoutRef<typeof Group>
>(({ className, ...props }, ref) => (
  <Group
    ref={ref}
    className={cn("flex h-full w-full data-[panel-group-direction=vertical]:flex-col", className)}
    {...props}
  />
))
ResizablePanelGroup.displayName = "ResizablePanelGroup"

const ResizablePanel = Panel

const ResizableHandle = React.forwardRef<
  React.ElementRef<typeof Separator>,
  React.ComponentPropsWithoutRef<typeof Separator> & {
    withHandle?: boolean
  }
>(({ className, withHandle, ...props }, ref) => (
  <Separator
    ref={ref}
    className={cn(
      "relative flex w-px items-center justify-center bg-border",
      "data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full",
      className
    )}
    {...props}
  >
    {withHandle ? (
      <div className="z-10 flex h-4 w-3 items-center justify-center rounded-sm border bg-background">
        <GripVerticalIcon className="h-2.5 w-2.5" />
      </div>
    ) : null}
  </Separator>
))
ResizableHandle.displayName = "ResizableHandle"

export { ResizablePanelGroup, ResizablePanel, ResizableHandle }
