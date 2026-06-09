import { useState } from "react";
import { CircleCheck } from "lucide-react";
import styles from "@/styles/landing.module.css";

const LOCAL_KEY = "pb_waitlist";
const SEED = 47;

/**
 * Waitlist capture for the promptbase.sh landing page.
 *
 * Currently persists submissions to localStorage as a placeholder — wire the
 * `submit` handler to a Supabase edge function (or an `api.waitlist_join` RPC)
 * once the waitlist backend is live.
 */
export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [count, setCount] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState(false);

  // Lazily seed the displayed count from prior local submissions.
  if (count === null && typeof window !== "undefined") {
    const stored = JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]");
    setCount(SEED + stored.length);
  }

  function submit() {
    const value = email.trim();
    if (!value || !value.includes("@") || !value.includes(".")) {
      setError(true);
      setTimeout(() => setError(false), 1500);
      return;
    }

    setSubmitting(true);

    // TODO: replace with a real call to the waitlist edge function / RPC.
    setTimeout(() => {
      const stored = JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]");
      stored.push({ email: value, ts: Date.now() });
      localStorage.setItem(LOCAL_KEY, JSON.stringify(stored));
      setCount((c) => (c ?? SEED) + 1);
      setJoined(true);
    }, 700);
  }

  const showCount = count !== null && count > SEED;

  return (
    <>
      <div className={styles.countPill}>
        <div className={styles.pulse} />
        <span>{showCount ? `${count} people waiting` : "join the waitlist"}</span>
      </div>

      {joined ? (
        <div className={styles.successMsg}>
          <CircleCheck size={16} />
          You&apos;re on the list — we&apos;ll be in touch.
        </div>
      ) : (
        <div className={styles.waitlistForm}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            placeholder="your@email.com"
            autoComplete="email"
            style={
              error
                ? {
                    borderColor: "#E24B4A",
                    boxShadow: "0 0 0 3px rgba(226,75,74,0.12)",
                  }
                : undefined
            }
          />
          <button
            className={styles.btnPrimary}
            onClick={submit}
            disabled={submitting}
          >
            {submitting ? "Joining..." : "Get early access"}
          </button>
        </div>
      )}

      <p className={styles.formNote}>No spam. Just a ping when it&apos;s ready.</p>
    </>
  );
}
