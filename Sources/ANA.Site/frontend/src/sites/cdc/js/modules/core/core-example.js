/**
 * This is an example module that is bundled into main app.js file
 */
export default class CoreExample {

  /**
   * Sets up the example widget
   * @param {HTMLElement} el - The widget's DOM element
   */
  constructor(el) {

    /**
     * @type {HTMLElement}
     */
    this.el = el;
    this.el.innerHTML = `
      <div style="background-color:#ffcccb">
      <p>This is an example of a core module</p>
      <p>The javascript for a core module will be loaded on every page.</p>
      <p>Use this for widgets and other important scripts that are used throughout the site
        and need to be loaded ASAP</p>
      </div>
    `;
  }

  /**
   * Unload the widget
   */
  unload() {
    this.el.innerHTML = 'Core Example Module unloaded';
  }
}
