/**
 * What Home shows, in one place so the cars can be swapped without touching JSX.
 */

export type FeaturedCar = {
  /** Used for the key and for the spec page it opens. */
  id: string;
  make: string;
  model: string;
  /** Photo URL. Remote hosts must be allowed in next.config for next/image. */
  image: string;
};

export const FEATURED_CARS: FeaturedCar[] = [
  { id: "lamborghini-revuelto", make: "Lamborghini", model: "Revuelto", image: "" },
  { id: "porsche-911-gt3-rs", make: "Porsche", model: "911 GT3 RS", image: "" },
  { id: "ferrari-sf90", make: "Ferrari", model: "SF90", image: "" },
];

/** Where a featured card goes. Search already resolves a name to a spec page. */
export function featuredHref(car: FeaturedCar): string {
  return `/search?q=${encodeURIComponent(`${car.make} ${car.model}`)}`;
}

/** The hero photo when none is set, nobody is signed in, or one fails to load. */
export const DEFAULT_HERO = "/home-hero-default.jpg";
