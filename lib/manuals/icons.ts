export function departmentIcon(name: string, hotelWide = false) {
  if (hotelWide) return "📚";
  const text = name.toLowerCase();
  if (/admin/.test(text)) return "👤";
  if (/house|reinig/.test(text)) return "🧹";
  if (/küche|kuche|kitchen|cucina/.test(text)) return "👨‍🍳";
  if (/restau|service|ristor/.test(text)) return "🍽";
  if (/recep|front/.test(text)) return "📖";
  if (/market/.test(text)) return "📣";
  if (/technik|mainten|haust/.test(text)) return "🔧";
  return "📖";
}
