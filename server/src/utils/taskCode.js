export function generateTaskCode(sequence) {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const seq = String(sequence).padStart(4, "0");
  return `TSK-${y}${m}-${seq}`;
}