This folder contains the module controller class and the loadable modules.

Core folder contains modules that are folded into the main app.js.
Dynamic folder contains modules that are not added to app.js, but instead are in their own file that is loaded on demand.


Usage:
======

html
----
<button data-module-core="disappear">disappear!</button>

js
--
// core/disappear.js
export default class Disappear {
  constructor(el) {
    el.style.display = none
  }
}