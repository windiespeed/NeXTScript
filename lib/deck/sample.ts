import type { DeckContent } from "./schema";

/**
 * A short NeXTStack-style deck used by the preview page and tests. It mixes typical slides with
 * one deliberately crowded slide, so the warning badges have something to show.
 */
export const SAMPLE_DECK: DeckContent = {
  lessonTitle: "React components and props",
  slides: [
    {
      id: "title",
      type: "title",
      kicker: "Week 6 · Day 2",
      title: "React components and props",
      subtitle: "Breaking a page into reusable pieces",
      notes: "Welcome everyone back. Today is about thinking in components. Ask: who has used a site this morning that repeats the same card over and over?",
    },
    {
      id: "what-is-a-component",
      type: "concept",
      title: "What a component is",
      lead: "Every piece of a React page is a component, including the page itself.",
      bullets: [
        "A JavaScript function that returns JSX",
        "Named with a capital letter, so React can tell it from an HTML tag",
        "Used like a tag: <ProfileCard />",
        "Small and focused: one job per component",
      ],
      notes: "Draw a page on the board and box off the pieces. Ask students to name each box. Watch for anyone mixing up components and HTML elements.",
    },
    {
      id: "props",
      type: "concept",
      title: "Props pass data down",
      bullets: [
        "Props are the inputs to a component",
        "The parent decides the values; the child only reads them",
        "Change the props and the component re-renders",
      ],
      aside: {
        label: "Analogy",
        body: "A component is a cookie cutter. Props are the dough, sprinkles and icing: same shape every time, different cookie.",
      },
      notes: "Use the cookie-cutter analogy, then live-code a Greeting component with a name prop. Ask: what happens if we forget to pass name?",
    },
    {
      id: "crowded",
      type: "concept",
      title: "When to split a component into smaller components",
      lead: "This slide is deliberately crowded to show what a warning looks like in the preview.",
      bullets: [
        "If you scroll to read a component, it is probably doing more than one job and should be broken up",
        "If two parts of the JSX change for different reasons, they belong in different components",
        "If you copy and paste the same markup twice, turn it into a component and pass the differences as props",
        "If a piece needs its own state that nothing else cares about, it can live in its own component",
        "If you can't name a component in two or three words, it is probably doing too much at once",
      ],
      notes: "Go through each rule quickly with an example from last week's project. Let students vote on whether the NavBar should be split.",
    },
    {
      id: "lab",
      type: "lab",
      title: "Lab: build a profile card",
      minutes: 50,
      tasks: ["Create a ProfileCard component", "Pass name, role and photo as props", "Render three cards with different data"],
      doneWhen: ["Three different cards show on the page", "No markup is repeated"],
      notes: "Circulate. The common mistake is hard-coding values inside the card. Ask students to explain which values come from props.",
    },
  ],
};
