/* The demo's rules, which stand in for the API and the AI step of the real app.
   Everything here is pure: no markup, no page access, no clock of its own — every
   function that needs the date takes it as a parameter, so all of it is testable.

   catalog    the fixed option tables (sports, places, times of day, feelings)
   answers    the questionnaire's result and the questions asked of it
   sports     which sport to suggest, and why
   sessions/  what a session is made of, one module per sport
   schedule   which days of the week sessions land on
   plan       a plan, its versions, and the queries the views need
   chat/      turning a message into a refusal or a new version
   copy       the sentences the views show
   dates/text formatting with no domain knowledge */

export * from "./answers";
export * from "./catalog";
export * from "./copy";
export * from "./dates";
export * from "./plan";
export * from "./reasons";
export * from "./schedule";
export * from "./sessions";
export * from "./sports";
export * from "./text";
export * from "./chat/patterns";
export * from "./chat/pipeline";
export * from "./chat/revision";
export * from "./chat/suggestions";
export * from "./chat/types";
