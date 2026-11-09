// Amount in words using the Indian system (thousand, lakh, crore). Whole rupees only.
const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function belowHundred(n) {
  if (n < 20) return ONES[n];
  return TENS[Math.floor(n / 10)] + (n % 10 ? ` ${ONES[n % 10]}` : "");
}

function belowThousand(n) {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const parts = [];
  if (hundreds) parts.push(`${ONES[hundreds]} Hundred`);
  if (rest) parts.push(belowHundred(rest));
  return parts.join(" ");
}

function amountInWords(amount) {
  if (!Number.isInteger(amount) || amount < 0) {
    throw new TypeError("Amount must be a whole number of rupees");
  }
  if (amount === 0) return "Rupees Zero Only";

  const units = [
    [10000000, "Crore"],
    [100000, "Lakh"],
    [1000, "Thousand"],
  ];
  let rest = amount;
  const parts = [];
  for (const [size, name] of units) {
    const count = Math.floor(rest / size);
    if (count) {
      parts.push(`${belowHundred(count)} ${name}`);
      rest %= size;
    }
  }
  if (rest) parts.push(belowThousand(rest));
  return `Rupees ${parts.join(" ")} Only`;
}

module.exports = { amountInWords };
