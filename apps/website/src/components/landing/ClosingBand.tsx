import { Button } from "../../design-system";
import * as route from "../../routing";
import { AppIcon } from "../common";

/** The last word on the page: one more way into the demo. */
export function ClosingBand() {
  return (
    <section className="s-band" aria-labelledby="s-band-h">
      <AppIcon size={72} style={{ boxShadow: "var(--shadow-2)" }} />
      <h2 id="s-band-h" className="s-h2">Try the journey.</h2>
      <p className="s-body">About a minute. No account needed.</p>
      <div className="s-btnrow">
        <Button variant="inverse" size="lg" iconRight="arrow-right" onClick={() => route.navigate(route.stepPath(route.FIRST_STEP))}>
          Try it
        </Button>
      </div>
    </section>
  );
}
