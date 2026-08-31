import { it } from "vitest";
it("probe", () => {
  console.log("LOCATION:", window.location.href);
  console.log("HAS_WINDOW_LS:", "localStorage" in window);
  console.log("SAME:", window.localStorage === globalThis.localStorage);
  try {
    const ls = window.localStorage;
    ls.setItem("k", "v");
    console.log("WINDOW_LS_WORKS:", ls.getItem("k"));
  } catch (e) {
    console.log("WINDOW_LS_ERR:", String(e));
  }
});
