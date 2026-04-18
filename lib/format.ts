export function formatCurrency(value: number | null | undefined) {
  if (typeof value !== "number") {
    return "미정";
  }

  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0
  }).format(value);
}

export function formatDate(value: Date | string | null | undefined) {
  if (!value) {
    return "일정 미정";
  }

  const date = typeof value === "string" ? new Date(value) : value;

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "Asia/Seoul"
  }).format(date);
}
