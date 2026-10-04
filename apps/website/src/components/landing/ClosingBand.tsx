import { GUEST_ENTRY, SIGN_IN } from "../../appLinks";
import { Button } from "../../design-system";
import { AppIcon } from "../common";

/** The last word on the page: one more way into the app. */
export function ClosingBand() {
  return (
    <section className="s-band" aria-labelledby="s-band-h">
      <AppIcon size={72} style={{ boxShadow: "var(--shadow-2)" }} />
      <h2 id="s-band-h" className="s-h2">Try the journey.</h2>
      <p className="s-body">About a minute. No account needed: as a guest, your plan stays in this browser.</p>
      <div className="s-ctas">
        <Button variant="inverse" size="lg" iconRight="arrow-right" href={GUEST_ENTRY}>Try it as a guest</Button>
        <Button variant="secondary" size="lg" icon="log-in" href={SIGN_IN}>Sign in</Button>
      </div>
    </section>
  );
}
