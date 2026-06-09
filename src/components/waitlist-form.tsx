import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import styles from "@/styles/landing.module.css";

/**
 * Landing-page early-access entry point. Carries the typed email into the
 * sign-up form (which does the real validation). After sign-up + email
 * verification the user lands on /pending until an admin approves them.
 */
export function WaitlistForm() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");

  function submit() {
    const value = email.trim();
    navigate({
      to: "/auth/sign-up",
      search: value ? { email: value } : {},
    });
  }

  return (
    <>
      <div className={styles.countPill}>
        <div className={styles.pulse} />
        <span>Early access · approval required</span>
      </div>

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
        />
        <button className={styles.btnPrimary} onClick={submit}>
          Get early access
        </button>
      </div>

      <p className={styles.formNote}>
        Sign up now — we&apos;ll email you once you&apos;re approved.
      </p>
    </>
  );
}
