import { Reveal } from 'foundation-sites';

/**
 * This is an example of a dynamic module
 * This class is triggered by an element with the attribute: data-module-dynamic="modal"
 */
export default class Modal {

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

    this.modal = new Reveal(this.$el);
  }

  /**
   * Unload the widget
   */
  unload() {
    this.$el.html('Dynamic Example Module unloaded');
  }
}
