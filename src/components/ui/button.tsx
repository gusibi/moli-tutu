import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "../../lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center font-medium transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none",
  {
    variants: {
      variant: {
        default: "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg hover:shadow-xl hover:from-blue-600 hover:to-purple-700 hover:scale-105 focus:ring-blue-500/20",
        destructive: "bg-gradient-to-r from-red-500 to-pink-600 text-white shadow-lg hover:shadow-xl hover:from-red-600 hover:to-pink-700 hover:scale-105 focus:ring-red-500/20",
        outline: "bg-white/80 backdrop-blur-sm border border-slate-200 text-slate-700 shadow-sm hover:bg-slate-50 hover:border-slate-300 hover:scale-105 focus:ring-slate-500/20",
        secondary: "bg-gradient-to-r from-slate-100 to-slate-200 text-slate-700 shadow-sm hover:from-slate-200 hover:to-slate-300 hover:scale-105 focus:ring-slate-500/20",
        ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-700 hover:scale-105",
        link: "text-blue-600 underline-offset-4 hover:underline hover:text-blue-700",
      },
      size: {
        default: "h-12 px-6 py-3 rounded-xl text-sm",
        sm: "h-10 px-4 py-2 rounded-lg text-sm",
        lg: "h-14 px-8 py-4 rounded-xl text-base",
        icon: "h-12 w-12 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }