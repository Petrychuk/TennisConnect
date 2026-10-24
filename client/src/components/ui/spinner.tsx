import { TennisBallSpinner } from "@/components/ui/tennisLoader"

// Single app-wide spinner = the bouncing tennis ball.
function Spinner({ className }: { className?: string }) {
  return (
    <span role="status" aria-label="Loading" className="inline-flex">
      <TennisBallSpinner className={className} />
    </span>
  )
}

export { Spinner }
