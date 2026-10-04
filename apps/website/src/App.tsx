/* The demo's shell: which view the route asks for, which one the state allows, and the
   page frame around it. All of the demo's own state lives in useDemo. */

import { useEffect, useLayoutEffect } from "react";
import { startOfDay, type ComfortValue } from "./domain";
import { DemoHeader, SiteFooter, SiteHeader } from "./components/chrome";
import { Landing } from "./components/landing";
import { PlanView } from "./components/plan";
import { PlanningView } from "./components/planning";
import { StepView } from "./components/steps";
import { redirectFor } from "./demo/redirects";
import { useDemo, type Demo } from "./demo/useDemo";
import { useBreakpoint, type Breakpoint } from "./hooks/useMediaQuery";
import { useHashRoute } from "./hooks/useHashRoute";
import { scrollToPageTop, useRouteFocus } from "./hooks/useRouteFocus";
import { useTheme } from "./hooks/useTheme";
import * as route from "./routing";
import type { Route } from "./routing";

/** The skip link's target, which is also where focus lands on every route. */
const MAIN_ID = "s-main";

interface ViewProps {
  current: Route;
  demo: Demo;
  breakpoint: Breakpoint;
  today: Date;
}

function CurrentView({ current, demo, breakpoint, today }: ViewProps) {
  const { state, ranked, sport, actions } = demo;
  switch (current.view) {
    case "landing":
      return (
        <Landing
          answers={state.answers}
          breakpoint={breakpoint}
          onAnswer={(comfort: ComfortValue) => {
            actions.answer({ comfort });
            route.navigate(route.stepPath(route.FIRST_STEP + 1));
          }}
        />
      );

    case "step":
      return (
        <StepView
          step={current.step ?? route.FIRST_STEP}
          answers={state.answers}
          ranked={ranked}
          sport={sport}
          visited={Math.max(state.visited, current.step ?? route.FIRST_STEP)}
          hasPlan={!!state.plan}
          breakpoint={breakpoint}
          today={today}
          onAnswer={actions.answer}
          onTogglePlace={actions.togglePlace}
          onToggleCompany={actions.toggleCompany}
          onPickSport={actions.pickSport}
          onChoose={actions.chooseSport}
        />
      );

    case "planning":
      return <PlanningView answers={state.answers} sport={sport} today={today} onDone={actions.planningFinished} />;

    case "plan":
      return state.plan ? (
        <PlanView
          plan={state.plan}
          chat={state.chat}
          busy={state.busy}
          lastFeeling={state.lastFeeling}
          status={state.status}
          selectedOffset={state.selectedOffset}
          dialog={state.dialog}
          chatOpen={state.chatOpen}
          ticked={state.ticked}
          breakpoint={breakpoint}
          onSelectDay={actions.selectDay}
          onOpenSession={actions.openSession}
          onCloseDialog={actions.closeDialog}
          onAskHowItFelt={actions.askHowItFelt}
          onToggleExercise={actions.toggleExercise}
          onSaveFeedback={actions.saveFeedback}
          onOpenChat={actions.openChat}
          onCloseChat={actions.closeChat}
          onSend={actions.send}
          onUndo={actions.undo}
          onStartOver={actions.startOver}
        />
      ) : null;

    /* The sample route only seeds the guest plan, then redirects to it. */
    case "sample":
      return null;
  }
}

export function App() {
  const { route: current, navigationId } = useHashRoute();
  const breakpoint = useBreakpoint();
  const { theme, toggle: toggleTheme } = useTheme();
  const demo = useDemo();
  const today = startOfDay(new Date());

  const pendingRedirect = redirectFor(current, demo.state);
  useLayoutEffect(() => {
    if (pendingRedirect) route.redirect(pendingRedirect);
  }, [pendingRedirect, current.key]);

  useEffect(() => {
    if (current.view === "step" && current.step) demo.actions.visitStep(current.step);
    if (current.view === "sample") demo.actions.openSample();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.key]);

  /* Nothing to focus or scroll to while the view on screen is about to be replaced. */
  const showing = !pendingRedirect && current.view !== "sample";
  useRouteFocus({ route: current, navigationId, active: showing });

  const onLanding = current.view === "landing";
  return (
    <>
      <a
        className="s-skip"
        href={route.LANDING}
        onClick={event => {
          event.preventDefault();
          document.getElementById(MAIN_ID)?.focus();
        }}
      >
        Skip to content
      </a>
      {onLanding ? (
        <SiteHeader hasPlan={!!demo.state.plan} theme={theme} onToggleTheme={toggleTheme} />
      ) : (
        <DemoHeader onStartOver={demo.actions.startOver} theme={theme} onToggleTheme={toggleTheme} breakpoint={breakpoint} />
      )}
      <main id={MAIN_ID} tabIndex={-1}>
        {showing ? <CurrentView current={current} demo={demo} breakpoint={breakpoint} today={today} /> : null}
      </main>
      {onLanding ? <SiteFooter onBackToTop={scrollToPageTop} /> : null}
    </>
  );
}
