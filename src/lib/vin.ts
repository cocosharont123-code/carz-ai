// Everything a VIN tells you without asking anyone.
//
// A VIN is not an opaque serial — the standard (ISO 3779/3780) fixes what each
// position means, so the manufacturer, the country, the model year and a
// self-check are all readable arithmetically. Doing that here rather than in the
// model matters twice over: it's free and exact, and the check digit turns an
// OCR read into something that can be *verified* instead of trusted.
//
// The model's job is then narrow: read 17 characters off a photo, and name the
// specific model once the decode has pinned the maker and the year.

/** Legal VIN alphabet. I, O and Q are excluded by the standard precisely
 *  because they're confusable with 1 and 0 — which is what makes a misread of
 *  them unambiguously repairable. */
const VIN_ALPHABET = /^[A-HJ-NPR-Z0-9]{17}$/;

/**
 * Uppercase, drop anything that isn't a letter or digit, and fold the three
 * characters a VIN can never contain onto the ones they're mistaken for. A VIN
 * plate reading "1HGCM82633A004352" through a phone camera routinely comes back
 * with an O in it; there is no VIN in the world where that O is correct.
 */
export function normalizeVin(raw: string): string {
  return (raw || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .replace(/I/g, "1")
    .replace(/O/g, "0")
    .replace(/Q/g, "0");
}

// Letter → number, per the standard. There is no 8th-letter (I) or 15th (O) or
// 17th (Q) entry because those characters can't appear.
const TRANSLITERATE: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
  J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
};

// Positional weights. Position 9 — the check digit itself — weighs 0, which is
// what lets it be computed from the other sixteen.
const WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

/** The character that position 9 must hold for this VIN to be self-consistent. */
export function vinCheckDigit(vin: string): string {
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    const c = vin[i];
    const v = c >= "0" && c <= "9" ? Number(c) : TRANSLITERATE[c];
    if (v === undefined) return "";
    sum += v * WEIGHTS[i];
  }
  const rem = sum % 11;
  return rem === 10 ? "X" : String(rem);
}

export function hasVinShape(vin: string): boolean {
  return VIN_ALPHABET.test(vin);
}

export function checkDigitPasses(vin: string): boolean {
  if (!hasVinShape(vin)) return false;
  const expected = vinCheckDigit(vin);
  return expected !== "" && expected === vin[8];
}

/**
 * The check digit is mandatory in North America and optional everywhere else.
 * A European or Japanese VIN whose digit doesn't compute is usually a perfectly
 * valid VIN, so a failure there is worth mentioning and nothing more — only for
 * a 1/2/3/4/5 VIN does it mean the read is actually wrong.
 */
export function checkDigitIsMandatory(vin: string): boolean {
  return /^[1-5]/.test(vin);
}

// --- Model year --------------------------------------------------------------

// Position 10, on a 30-year cycle. U, Z and 0 are skipped along with I/O/Q, so
// the same letter means two years thirty apart.
const YEAR_CODES = "ABCDEFGHJKLMNPRSTVWXY123456789";

/**
 * Both years position 10 could mean, newest first. The seventh character breaks
 * the tie on North American VINs — numeric for 1980-2009, alphabetic for
 * 2010-2039 — which is exactly why manufacturers started putting a letter
 * there. Elsewhere there's no rule, so the recent cycle is the better bet and
 * the older year is returned alongside it rather than thrown away.
 */
export function decodeModelYear(vin: string): { year: number | null; alt: number | null } {
  const i = YEAR_CODES.indexOf(vin[9] ?? "");
  if (i < 0) return { year: null, alt: null };
  const older = 1980 + i;
  const newer = 2010 + i;
  // Can't be a year that hasn't happened: the code rolls over in the future, so
  // a 2039 code read today is a 2009 car.
  const maxYear = new Date().getFullYear() + 1;
  if (newer > maxYear) return { year: older, alt: null };

  const seventh = vin[6] ?? "";
  if (/^[1-5]/.test(vin) && seventh) {
    const numeric = seventh >= "0" && seventh <= "9";
    return numeric ? { year: older, alt: newer } : { year: newer, alt: older };
  }
  return { year: newer, alt: older };
}

// --- Who built it ------------------------------------------------------------

// World Manufacturer Identifier — the first three characters. Not exhaustive by
// any stretch; it covers the makes someone is realistically photographing, and
// anything unlisted falls through to the country and then to the model.
const WMI: Record<string, string> = {
  // GM
  "1G1": "Chevrolet", "1G2": "Pontiac", "1G3": "Oldsmobile", "1G4": "Buick",
  "1G6": "Cadillac", "1G8": "Saturn", "1GC": "Chevrolet Truck", "1GK": "GMC",
  "1GN": "Chevrolet", "1GT": "GMC Truck", "1GY": "Cadillac", "2G1": "Chevrolet",
  "3G1": "Chevrolet", "6G1": "Holden", "KL1": "Chevrolet (Korea)",
  "KL4": "Buick (Korea)", "KL7": "Chevrolet (Korea)",
  // Ford
  "1FA": "Ford", "1FB": "Ford", "1FC": "Ford", "1FD": "Ford", "1FM": "Ford",
  "1FT": "Ford", "1F1": "Ford", "2FA": "Ford", "2FM": "Ford", "3FA": "Ford",
  "WF0": "Ford (Germany)", "MAJ": "Ford (India)",
  "1LN": "Lincoln", "2LM": "Lincoln", "5LM": "Lincoln",
  // Stellantis / FCA
  "1C3": "Chrysler", "1C4": "Jeep", "1C6": "Ram", "2C3": "Chrysler",
  "2C4": "Chrysler", "3C4": "Chrysler", "3C6": "Ram", "1J4": "Jeep",
  "ZAC": "Jeep (Italy)", "ZFA": "Fiat", "ZAR": "Alfa Romeo", "ZLA": "Lancia",
  "ZAM": "Maserati",
  // Honda
  "1HG": "Honda", "2HG": "Honda", "2HK": "Honda", "5FN": "Honda",
  "JHM": "Honda", "JHL": "Honda", "SHH": "Honda (UK)", "19U": "Acura",
  "19X": "Acura", "JH4": "Acura",
  // Toyota
  "4T1": "Toyota", "4T3": "Toyota", "2T1": "Toyota", "5TD": "Toyota",
  "5TF": "Toyota", "JTD": "Toyota", "JTE": "Toyota", "JTM": "Toyota",
  "JTN": "Toyota", "JT2": "Toyota", "JT3": "Toyota", "VNK": "Toyota (Turkey)",
  "JTH": "Lexus", "JTJ": "Lexus", "58A": "Lexus", "2T2": "Lexus",
  // Nissan
  "1N4": "Nissan", "1N6": "Nissan", "3N1": "Nissan", "5N1": "Nissan",
  "JN1": "Nissan", "JN8": "Nissan", "SJN": "Nissan (UK)", "VSK": "Nissan (Spain)",
  "JNK": "Infiniti", "JNR": "Infiniti",
  // Other Japanese
  "JM1": "Mazda", "JM3": "Mazda", "JM7": "Mazda", "3MZ": "Mazda",
  "4F2": "Mazda", "4F4": "Mazda",
  "JF1": "Subaru", "JF2": "Subaru", "4S3": "Subaru", "4S4": "Subaru",
  "JA3": "Mitsubishi", "JA4": "Mitsubishi", "4A3": "Mitsubishi",
  "JMB": "Mitsubishi", "6MM": "Mitsubishi (Australia)",
  "JS1": "Suzuki", "JS2": "Suzuki", "JS3": "Suzuki", "MA3": "Suzuki (India)",
  // German
  "WBA": "BMW", "WBS": "BMW M", "WBX": "BMW", "WBY": "BMW i",
  "4US": "BMW", "5UX": "BMW", "5YM": "BMW M",
  "WMW": "MINI", "WMX": "MINI",
  "WDB": "Mercedes-Benz", "WDC": "Mercedes-Benz", "WDD": "Mercedes-Benz",
  "WDF": "Mercedes-Benz", "W1K": "Mercedes-Benz", "W1N": "Mercedes-Benz",
  "W1V": "Mercedes-Benz", "4JG": "Mercedes-Benz", "55S": "Mercedes-Benz",
  "WAU": "Audi", "WA1": "Audi", "WUA": "Audi Sport", "TRU": "Audi (Hungary)",
  "WVW": "Volkswagen", "WV1": "Volkswagen", "WV2": "Volkswagen",
  "1VW": "Volkswagen", "3VW": "Volkswagen", "9BW": "Volkswagen (Brazil)",
  "WP0": "Porsche", "WP1": "Porsche",
  "TMB": "Škoda", "VSS": "SEAT",
  // British / Italian exotica
  "SCA": "Rolls-Royce", "SCB": "Bentley", "SAJ": "Jaguar", "SAL": "Land Rover",
  "SCC": "Lotus", "SCF": "Aston Martin", "SBM": "McLaren", "SCE": "DeLorean",
  "ZFF": "Ferrari", "ZHW": "Lamborghini", "ZA9": "Lamborghini",
  // French / Swedish
  "VF1": "Renault", "VF3": "Peugeot", "VF7": "Citroën", "VF6": "Renault Trucks",
  "93Y": "Renault (Brazil)", "YV1": "Volvo", "YV4": "Volvo", "YS3": "Saab",
  // Korean
  "KMH": "Hyundai", "KMF": "Hyundai", "KM8": "Hyundai", "5NP": "Hyundai",
  "KNA": "Kia", "KND": "Kia", "KNM": "Kia", "KNE": "Kia", "5XY": "Kia",
  "KMT": "Genesis", "KM4": "Genesis",
  // Electric
  "5YJ": "Tesla", "7SA": "Tesla", "LRW": "Tesla (China)", "XP7": "Tesla (Berlin)",
  "7FC": "Rivian", "7PD": "Rivian",
  "LGX": "BYD", "LC0": "NIO", "LB3": "Geely",
};

// For a WMI that isn't listed, the first two characters still narrow it down
// where they belong to one maker outright. Only unambiguous pairs live here.
const WMI_PREFIX: Record<string, string> = {
  WB: "BMW", WD: "Mercedes-Benz", WA: "Audi", WU: "Audi", WV: "Volkswagen",
  WP: "Porsche", WM: "MINI", JT: "Toyota", JN: "Nissan", JH: "Honda",
  JM: "Mazda", JF: "Subaru", JA: "Mitsubishi", JS: "Suzuki", KM: "Hyundai",
  KN: "Kia", YV: "Volvo", ZF: "Ferrari or Fiat", SA: "Jaguar Land Rover",
};

/** Assembly country, from the first character and where in the range the second
 *  falls (ISO 3780). Coarse on purpose — it's a sanity check on the read, not a
 *  spec. */
export function vinCountry(vin: string): string {
  const a = vin[0] ?? "";
  const b = vin[1] ?? "";
  const between = (lo: string, hi: string) => b >= lo && b <= hi;

  switch (a) {
    case "1": case "4": case "5": return "United States";
    case "2": return "Canada";
    case "3": return between("0", "W") ? "Mexico" : "Costa Rica";
    case "6": return "Australia";
    case "7": return "New Zealand";
    case "8": return "Argentina, Chile or Peru";
    case "9": return "Brazil";
    case "J": return "Japan";
    case "K": return between("L", "R") ? "South Korea" : "Sri Lanka or Israel";
    case "L": return "China";
    case "M": return between("A", "E") ? "India" : "Indonesia or Thailand";
    case "N": return between("F", "T") ? "Turkey" : "Iran or Pakistan";
    case "P": return between("A", "E") ? "Philippines" : "Singapore or Malaysia";
    case "R": return between("F", "K") ? "Taiwan" : "UAE or Vietnam";
    case "S": {
      if (between("A", "M")) return "United Kingdom";
      if (between("N", "T")) return "Germany";
      if (between("U", "Z")) return "Poland";
      return "Europe";
    }
    case "T": {
      if (between("A", "H")) return "Switzerland";
      if (between("J", "P")) return "Czech Republic";
      if (between("R", "V")) return "Hungary";
      return "Portugal";
    }
    case "U": {
      if (between("H", "M")) return "Denmark";
      if (between("N", "T")) return "Ireland";
      return "Romania or Slovakia";
    }
    case "V": {
      if (between("A", "E")) return "Austria";
      if (between("F", "R")) return "France";
      if (between("S", "W")) return "Spain";
      return "Serbia or Croatia";
    }
    case "W": return "Germany";
    case "X": return between("A", "E") ? "Bulgaria" : "Russia or Ukraine";
    case "Y": {
      if (between("A", "E")) return "Belgium";
      if (between("F", "K")) return "Finland";
      if (between("S", "W")) return "Sweden";
      return "Europe";
    }
    case "Z": return "Italy";
    default: return "";
  }
}

export function vinManufacturer(vin: string): string {
  const wmi = vin.slice(0, 3);
  return WMI[wmi] ?? WMI_PREFIX[vin.slice(0, 2)] ?? "";
}

// --- The whole picture -------------------------------------------------------

export type VinFacts = {
  vin: string;
  /** 17 characters from the legal alphabet. */
  wellFormed: boolean;
  checkDigitOk: boolean;
  /** Whether a failed check digit actually condemns this VIN. */
  checkDigitRequired: boolean;
  wmi: string;
  manufacturer: string;
  country: string;
  modelYear: number | null;
  /** The other year position 10 could mean, when nothing disambiguates it. */
  modelYearAlt: number | null;
  plantCode: string;
  serial: string;
  /** Plain-English problems with this VIN, if any. */
  issues: string[];
};

export function decodeVin(raw: string): VinFacts {
  const vin = normalizeVin(raw);
  const wellFormed = hasVinShape(vin);
  const checkDigitRequired = checkDigitIsMandatory(vin);
  const checkDigitOk = wellFormed && checkDigitPasses(vin);
  const { year, alt } = wellFormed ? decodeModelYear(vin) : { year: null, alt: null };

  const issues: string[] = [];
  if (!vin) {
    issues.push("No VIN found.");
  } else if (vin.length !== 17) {
    issues.push(`A VIN is 17 characters — this one has ${vin.length}.`);
  } else if (!wellFormed) {
    issues.push("Contains characters a VIN can't have.");
  } else if (!checkDigitOk) {
    issues.push(
      checkDigitRequired
        ? "The check digit doesn't match — at least one character is misread."
        : "The check digit doesn't match, which is common and allowed outside North America.",
    );
  }

  return {
    vin,
    wellFormed,
    checkDigitOk,
    checkDigitRequired,
    wmi: wellFormed ? vin.slice(0, 3) : "",
    manufacturer: wellFormed ? vinManufacturer(vin) : "",
    country: wellFormed ? vinCountry(vin) : "",
    modelYear: year,
    modelYearAlt: alt,
    plantCode: wellFormed ? vin[10] : "",
    serial: wellFormed ? vin.slice(11) : "",
    issues,
  };
}

// --- Repairing an OCR read ---------------------------------------------------

// Characters that trade places when read off a stamped plate at an angle. Only
// pairs that genuinely confuse a camera — this list decides what gets silently
// corrected, so a loose one would invent VINs.
const CONFUSABLE: Record<string, string[]> = {
  "0": ["D", "8"], D: ["0"],
  "1": ["7", "T", "L"], "7": ["1", "T"], T: ["1", "7"], L: ["1"],
  "2": ["Z"], Z: ["2"],
  "5": ["S", "6"], S: ["5"],
  "6": ["G", "5", "8"], G: ["6"],
  "8": ["B", "6", "0"], B: ["8"],
  "4": ["A"], A: ["4"],
  "9": ["P"], P: ["9"],
  U: ["V"], V: ["U"],
  C: ["G"], K: ["X"], X: ["K"],
  M: ["N"], N: ["M"],
  W: ["V"], H: ["N"],
};

/**
 * Try to rescue a read whose check digit doesn't compute.
 *
 * One substitution at a time, only between characters a camera actually
 * confuses. If exactly one candidate passes, the misread character is found and
 * the fix is certain enough to apply. If several pass, we've learned only that
 * the VIN is ambiguous — roughly one in eleven random strings passes by luck —
 * so they're handed back as candidates and nothing is corrected silently.
 *
 * Never called for a VIN whose check digit isn't mandatory: outside North
 * America a mismatch usually means the standard wasn't followed, not that the
 * read was wrong, and "fixing" those would corrupt good VINs.
 */
export function repairVin(vin: string): { fixed: string | null; candidates: string[] } {
  if (!hasVinShape(vin) || !checkDigitIsMandatory(vin)) return { fixed: null, candidates: [] };

  const candidates: string[] = [];
  for (let i = 0; i < 17; i++) {
    for (const swap of CONFUSABLE[vin[i]] ?? []) {
      const candidate = vin.slice(0, i) + swap + vin.slice(i + 1);
      if (checkDigitPasses(candidate)) candidates.push(candidate);
    }
  }
  return { fixed: candidates.length === 1 ? candidates[0] : null, candidates };
}
