// The US government's own VIN decoder.
//
// vPIC is the registry manufacturers file their VIN schemes with, so for any car
// sold in the United States it doesn't guess the model — it looks it up. That
// beats anything inferred, which is why it runs first and the model is told not
// to contradict it.
//
// Free, no key, no account. Everything here is best-effort: it's a third-party
// service on the path of a scan, so a timeout or an outage degrades to "we
// decode it ourselves" rather than failing the request.

const ENDPOINT = "https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues";

// Long enough for a cold lookup, short enough that a hanging vPIC doesn't hold
// the whole scan hostage — the model decode alone is a decent answer.
const TIMEOUT_MS = 7000;

export type NhtsaVin = {
  make: string;
  model: string;
  modelYear: string;
  series: string;
  trim: string;
  bodyClass: string;
  driveType: string;
  engine: string;
  fuel: string;
  manufacturer: string;
  plantCountry: string;
  vehicleType: string;
  /** True only when vPIC actually recognised the VIN and named a make. */
  resolved: boolean;
};

// vPIC returns "Not Applicable", "" and literal "null" strings interchangeably.
function clean(v: unknown): string {
  const s = String(v ?? "").trim();
  if (!s || s === "null" || /^not applicable$/i.test(s)) return "";
  return s;
}

/** Engine as a phrase rather than the four separate columns vPIC splits it into. */
function engineOf(r: Record<string, unknown>): string {
  const litres = clean(r.DisplacementL);
  const cylinders = clean(r.EngineCylinders);
  const config = clean(r.EngineConfiguration);
  const hp = clean(r.EngineHP);
  const parts = [
    litres ? `${Number(litres).toFixed(1)}L` : "",
    cylinders ? `${config ? `${config} ` : ""}${cylinders}-cyl` : config,
    hp ? `${Math.round(Number(hp))} hp` : "",
  ].filter(Boolean);
  return parts.join(" ");
}

export async function lookupVinNhtsa(vin: string): Promise<NhtsaVin | null> {
  try {
    const res = await fetch(`${ENDPOINT}/${encodeURIComponent(vin)}?format=json`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { accept: "application/json" },
      // The mapping for a given VIN doesn't change; Next would not cache a POST
      // route's fetch by default, so this is asked for explicitly.
      next: { revalidate: 60 * 60 * 24 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { Results?: Record<string, unknown>[] };
    const r = data.Results?.[0];
    if (!r) return null;

    const make = clean(r.Make);
    return {
      make,
      model: clean(r.Model),
      modelYear: clean(r.ModelYear),
      series: clean(r.Series),
      trim: clean(r.Trim),
      bodyClass: clean(r.BodyClass),
      driveType: clean(r.DriveType),
      engine: engineOf(r),
      fuel: clean(r.FuelTypePrimary),
      manufacturer: clean(r.Manufacturer),
      plantCountry: clean(r.PlantCountry),
      vehicleType: clean(r.VehicleType),
      // A make is the bar: vPIC answers 200 OK with an empty row for VINs it
      // doesn't know, which is most of the world outside the US market.
      resolved: !!make,
    };
  } catch {
    return null; // timeout, DNS, outage — the caller has a fallback
  }
}
