
/**
 * SkipNav module moves tabindex to the block that the links skips to for browsers that
 * don't do this automatically
 */
export default class SkipNav {

  /**
   * Sets up the widget
   * @param {HTMLElement} el - The widget's DOM element
   */
  constructor(el) {

    /**
     * @type {jQuery}
     */
    this.$el = $(el);

    // bind a click event to the 'skip' link
    this.$el.click(function SkipNavClick() {
      // strip the leading hash and declare

      // the content we're skipping to
      const skipTo = `#${this.href.split('#')[1]}`;

      // Setting 'tabindex' to -1 takes an element out of normal
      // tab flow but allows it to be focused via javascript
      $(skipTo).attr('tabindex', -1).on('blur focusout', function SkipNavBlur() {
        $(this).removeAttr('tabindex');
      });
    });
  }

  /**
   * Unload the widget
   */
  unload() {
  // Remove the click binding
    this.$el.off();
  }
}
