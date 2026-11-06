"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";

/**
 * The account form on step two.
 *
 * Three things, all of which need an account to already exist: the username,
 * which is checked against every other one on save; the display name, which
 * starts as whatever Google gave and is usually already right; and the date of
 * birth.
 *
 * The date is three selects rather than a date input. A native date picker on a
 * phone opens on the current month and expects you to page back two hundred and
 * forty times to reach 1995, and `<input type="date">` styles differently in
 * every browser -- the one control iOS will not let anyone match to the rest of
 * a form.
 *
 * Only the year is new to this app. Month and day are kept as the existing
 * "MM-DD" birthday, and the year is stored separately and used for one thing:
 * confirming the person is old enough to be here.
 */

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Real days in that month of that year -- the leap day included only when it is one. */
function daysIn(month: number, year: number): number {
  if (!month) return 31;
  if (month === 2) {
    const leap = year ? (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 : true;
    return leap ? 29 : 28;
  }
  return [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

const USERNAME_SHAPE = /^[a-z0-9_]{3,20}$/;

/** The field styling, in one place so the three selects cannot drift apart. */
const FIELD =
  "h-12 w-full rounded-card border border-[var(--line-card)] glass-chip px-3 text-[16px] outline-none transition focus:border-carz/60 focus:bg-foreground/[0.08]";

export function FinishStep({
  callbackUrl,
  initialUsername,
  initialDisplayName,
  maxBirthYear,
}: {
  callbackUrl: string;
  initialUsername: string;
  initialDisplayName: string;
  /** The most recent year old enough to sign up, computed on the server. */
  maxBirthYear: number;
}) {
  const router = useRouter();

  const [username, setUsername] = useState(initialUsername);
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [month, setMonth] = useState("");
  const [day, setDay] = useState("");
  const [year, setYear] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // A hundred years, newest first: the year somebody is looking for is near the
  // top of the list, not nine hundred rows down it.
  const years = Array.from({ length: 101 }, (_, i) => maxBirthYear - i);
  const dayCount = daysIn(Number(month), Number(year));

  // Shortening February under a chosen 30th has to move the value too, or the
  // select is left showing a day that is no longer one of its options.
  const safeDay = Number(day) > dayCount ? "" : day;

  /**
   * What is still missing, named.
   *
   * The button used to carry `disabled` until all of this was filled in, which
   * is the wrong half of that pattern: a date of birth is three separate
   * selects, and missing one -- the year being the easy one to miss, since a
   * month and a day read as a complete answer -- left Finish grey and silent.
   * The button looked broken, and the only thing on the screen that did
   * anything was "Do this later", which saves nothing.
   *
   * So the button always presses, and pressing it says what is wrong.
   */
  const missingDob = !month || !safeDay || !year;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    if (!USERNAME_SHAPE.test(username)) {
      setError("Usernames are 3–20 characters: letters, numbers and underscores.");
      return;
    }
    if (missingDob) {
      // Named one by one: "pick your date of birth", over three selects two of
      // which are filled, reads as though the answer has been ignored.
      const parts = [!month && "month", !safeDay && "day", !year && "year"].filter(Boolean);
      setError(`Your date of birth still needs a ${parts.join(" and a ")}.`);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          displayName,
          dob: `${year}-${month}-${safeDay}`,
          setup: true,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        // The endpoint's own message, because every one of them says something
        // the person can act on: the name is taken, the date is not real, they
        // are too young, storage is down.
        setError(data?.error || "Couldn't save that. Try again.");
        setSaving(false);
        return;
      }
      // replace, not push: step two is finished and the back button should go
      // wherever they came from, not into a form they have already filled.
      router.replace(callbackUrl);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate>
      {/* Labels above the fields, not inside them. A placeholder disappears the
          moment someone starts typing, which is the moment they most need to
          know what they are filling in. */}
      <label htmlFor="username" className="util-label block opacity-60">
        Username
      </label>
      <div className="mt-2 flex items-center">
        <span aria-hidden className="pointer-events-none -mr-7 pl-4 text-[16px] opacity-35">
          @
        </span>
        <input
          id="username"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="next"
          maxLength={20}
          value={username}
          // Lowercased as they type rather than on save, so what is stored is
          // visibly what they typed.
          onChange={(e) => {
            setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""));
            if (error) setError(null);
          }}
          className={`${FIELD} pl-9`}
        />
      </div>
      <p className="mt-1.5 text-[12px] opacity-55">
        We picked one — keep it or change it.
      </p>

      <label htmlFor="displayName" className="util-label mt-4 block opacity-60">
        Display name
      </label>
      <input
        id="displayName"
        name="displayName"
        autoComplete="name"
        enterKeyHint="next"
        maxLength={40}
        value={displayName}
        onChange={(e) => {
          setDisplayName(e.target.value);
          if (error) setError(null);
        }}
        placeholder="How your name shows"
        className={`${FIELD} mt-2 placeholder:opacity-35`}
      />

      <p className="util-label mt-4 opacity-60" id="dob-label">
        Date of birth
      </p>
      {/* Month widest, because its labels are words. */}
      <div
        role="group"
        aria-labelledby="dob-label"
        className="mt-2 grid grid-cols-[1.1fr_0.8fr_1fr] gap-2"
      >
        <select
          aria-label="Birth month"
          autoComplete="bday-month"
          value={month}
          onChange={(e) => {
            setMonth(e.target.value);
            if (error) setError(null);
          }}
          className={FIELD}
        >
          <option value="">Month</option>
          {MONTHS.map((m, i) => (
            <option key={m} value={String(i + 1).padStart(2, "0")}>
              {m}
            </option>
          ))}
        </select>

        <select
          aria-label="Birth day"
          autoComplete="bday-day"
          value={safeDay}
          onChange={(e) => {
            setDay(e.target.value);
            if (error) setError(null);
          }}
          className={FIELD}
        >
          {/* A placeholder that matches the empty value: without one React has
              a select whose value is not among its options. */}
          <option value="">Day</option>
          {Array.from({ length: dayCount }, (_, i) => String(i + 1).padStart(2, "0")).map((d) => (
            <option key={d} value={d}>
              {Number(d)}
            </option>
          ))}
        </select>

        <select
          aria-label="Birth year"
          autoComplete="bday-year"
          value={year}
          onChange={(e) => {
            setYear(e.target.value);
            if (error) setError(null);
          }}
          className={`${FIELD} tabular-nums`}
        >
          <option value="">Year</option>
          {years.map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </select>
      </div>
      <p className="mt-1.5 text-[12px] opacity-55">
        Your year confirms your age and is never shown.
      </p>

      {/* Held open whether or not it is filled, so the button does not jump out
          from under a thumb when the message appears. */}
      <div className="min-h-[1.25rem] pt-2">
        {error && (
          <p role="alert" className="text-[12px] leading-snug text-neon-red">
            {error}
          </p>
        )}
      </div>

      <button
        type="submit"
        // Always pressable. See missingDob above.
        disabled={saving}
        className="press mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-card bg-carz text-[15px] font-semibold text-carz-ink transition disabled:opacity-40"
      >
        {saving ? (
          <>
            Saving
            {/* §6: the spinner lives inside the control that started the work. */}
            <Loader2 className="h-[18px] w-[18px] animate-spin" strokeWidth={2.5} aria-hidden />
          </>
        ) : (
          <>
            Finish
            <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2.5} aria-hidden />
          </>
        )}
      </button>
    </form>
  );
}
