/**
 * The cars on the home page's Featured strip.
 *
 * A plain array so swapping the line-up is an edit here and nothing else.
 *
 * `photo` points at /public. None of these files exist yet -- there is no
 * stock imagery in this repo and inventing a URL to someone else's photograph
 * is not a thing to ship -- so each card falls back to a dark tile with a car
 * glyph until the file is added. Drop a JPEG at the path and the card picks it
 * up with no code change.
 *
 * `href` goes to CarzBot with the question prefilled. There is no per-car spec
 * page in this app to link to, and CarzBot is the thing that actually answers
 * "what is this car" -- a link to a page that does not exist would be worse
 * than one that goes somewhere useful.
 */
export type FeaturedCar = {
  id: string;
  make: string;
  model: string;
  /** A file under /public, or "" to show the fallback tile. */
  photo: string;
};

export const FEATURED_CARS: FeaturedCar[] = [
  { id: "revuelto", make: "Lamborghini", model: "Revuelto", photo: "/featured/revuelto.jpg" },
  { id: "gt3rs", make: "Porsche", model: "911 GT3 RS", photo: "/featured/911-gt3-rs.jpg" },
  { id: "sf90", make: "Ferrari", model: "SF90", photo: "/featured/sf90.jpg" },
];

export const featuredHref = (c: FeaturedCar) =>
  `/carzbot?q=${encodeURIComponent(`Tell me about the ${c.make} ${c.model}`)}`;
