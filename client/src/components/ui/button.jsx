import * as React from "react"

// Utility function to merge class names
const cn = (...classes) => {
  return classes.filter(Boolean).join(' ')
}

const buttonVariants = {
  variant: {
    default: "bg-blue-600 text-white hover:bg-blue-700",
    destructive: "bg-red-600 text-white hover:bg-red-700", 
    outline: "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
    secondary: "bg-gray-200 text-gray-900 hover:bg-gray-300",
    ghost: "text-gray-600 hover:bg-gray-100",
    link: "text-blue-600 underline-offset-4 hover:underline",
  },
  size: {
    default: "h-10 px-4 py-2",
    sm: "h-9 px-3 py-1.5 text-sm",
    lg: "h-11 px-8 py-3 text-lg",
    icon: "h-10 w-10 p-0",
  },
}

const getVariantClass = (variant = 'default', size = 'default') => {
  return `inline-flex items-center justify-center whitespace-nowrap rounded-md font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${buttonVariants.variant[variant]} ${buttonVariants.size[size]}`
}

const Button = React.forwardRef(({ className, variant, size, ...props }, ref) => {
  return (
    <button
      className={cn(getVariantClass(variant, size), className)}
      ref={ref}
      {...props}
    />
  )
})
Button.displayName = "Button"

export { Button }
