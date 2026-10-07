
/**
 * This is an example of a dynamic module
 * This class is triggered by an element with the attribute: data-module-dynamic="dynamic-example"
 */
export default class DynamicExample {

  /**
   * Sets up the widget
   * @param {HTMLElement} el - The widget's DOM element
   */
  constructor(el) {

    /**
     * @type {HTMLElement}
     */
    this.el = el; // Save a reference to the element with the data-module-dynamic attribute

    /**
     * @type {jQuery}
     */
    this.$el = $(el); // Convert the reference into a jQuery object

    this.exampleFunction();
  }

  /**
   * An example function that sets the widget's inner html value and changes its background
   * color using jQuery
   */
  exampleFunction() {
    this.$el.html(`
      <div>
      <p>This is an example of a dynamic module</p>
      <p>The javascript for a dynamic module is loaded on demand.</p>
      <p>Use this for widgets and other scripts that might appear only on a few pages
        or is not critical during page load</p>
      </div>
    `)
      .css('background-color', '#32cd32');
  }

  /**
   * Unload the widget
   */
  unload() {
    this.$el.html('Dynamic Example Module unloaded');
  }
}
