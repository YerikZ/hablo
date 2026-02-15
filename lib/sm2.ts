export function reviewCard(current: { intervalDays: number; ease: number }, rating: "again" | "good") {
  if (rating === "again") {
    return {
      intervalDays: 1,
      ease: Math.max(1.3, current.ease - 0.2)
    };
  }

  const nextEase = Math.max(1.3, current.ease + 0.05);
  const intervalDays = Math.max(1, Math.round(current.intervalDays * nextEase));

  return {
    intervalDays,
    ease: nextEase
  };
}
